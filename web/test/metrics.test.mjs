#!/usr/bin/env node
// Unit tests for web/src/lib/metrics.js: the pure statistics and the interconnection lookup
// against small fixtures, then every metric and preset against the real export in
// public/api/regions.json (skipped when that file is absent). Node ESM, stdlib only.
//
//   node --test web/test/metrics.test.mjs      (or: node web/test/metrics.test.mjs)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { METRICS, PRESETS, metric, tickFormat, pairs, pearson, linfit, quantiles, median, residuals, outliers, niceTicks, sectorOf } from '../src/lib/metrics.js'

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps
const REGIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'api', 'regions.json')

test('pairs drops non-finite values pairwise', () => {
  assert.deepEqual(pairs([1, 2, null, 4, NaN], [1, undefined, 3, 4, 5]), [[1, 1], [4, 4]])
  assert.deepEqual(pairs([1, 2, 3], [1]), [[1, 1]])
})

test('pearson: perfect, inverse, none, degenerate', () => {
  assert.ok(near(pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1))
  assert.ok(near(pearson([1, 2, 3, 4], [8, 6, 4, 2]), -1))
  assert.ok(near(pearson([1, 2, 3, 4, 5], [2, 1, 4, 3, 5]), 0.8))            // textbook: r = 0.8
  assert.ok(near(pearson([-1, 0, 1], [1, 0, 1]), 0))                          // symmetric parabola
  assert.equal(pearson([1, 2], [1, 2]), null)                                 // fewer than 3 pairs
  assert.equal(pearson([1, 1, 1], [1, 2, 3]), null)                           // constant x
  assert.equal(pearson([], []), null)
  assert.ok(near(pearson([1, 2, null, 3, 4], [2, 4, 100, 6, 8]), 1))          // null pair ignored
})

test('linfit recovers slope and intercept', () => {
  const f = linfit([0, 1, 2, 3], [1, 3, 5, 7])
  assert.ok(near(f.slope, 2)); assert.ok(near(f.intercept, 1)); assert.equal(f.n, 4)
  const g = linfit([1, 2, 3, 4, 5], [2, 1, 4, 3, 5])                          // least squares on noisy data
  assert.ok(near(g.slope, 0.8)); assert.ok(near(g.intercept, 0.6))
  assert.deepEqual(linfit([2, 2, 2], [1, 2, 3]), { slope: null, intercept: null, n: 3 })
  assert.deepEqual(linfit([1], [1]), { slope: null, intercept: null, n: 1 })
})

test('quantiles use linear interpolation (R type 7) and ignore junk', () => {
  assert.deepEqual(quantiles([1, 2, 3, 4], [0.5]), [2.5])
  assert.deepEqual(quantiles([3, 1, 2], [0, 0.5, 1]), [1, 2, 3])
  assert.deepEqual(quantiles([1, 2, 3, 4, 5, 6, 7, 8], [0.25, 0.75]), [2.75, 6.25])
  assert.deepEqual(quantiles([null, 'x', 5, NaN, 1], [0.5]), [3])
  assert.deepEqual(quantiles([], [0.5]), [null])
  assert.equal(median([9, 1, 5]), 5)
})

test('residuals and outliers rank by distance from the fit', () => {
  const pts = [{ id: 'a', x: 0, y: 1 }, { id: 'b', x: 1, y: 3 }, { id: 'c', x: 2, y: 5 }, { id: 'd', x: 3, y: 12 }, { id: 'e', x: 4, y: 9 }]
  const fit = { slope: 2, intercept: 1 }
  const r = residuals(pts, fit)
  assert.deepEqual(r.map(p => p.resid), [0, 0, 0, 5, 0])
  assert.deepEqual(outliers(pts, fit, 2).map(p => p.id), ['d', 'a'])
  assert.deepEqual(residuals(pts, { slope: null, intercept: null }).map(p => p.resid), [null, null, null, null, null])
  assert.deepEqual(outliers(pts, { slope: null }), [])
})

test('niceTicks gives round steps that cover the range', () => {
  assert.deepEqual(niceTicks(0, 100, 5), [0, 20, 40, 60, 80, 100])
  assert.deepEqual(niceTicks(-3.2, 14.1, 5), [0, 5, 10])
  assert.deepEqual(niceTicks(-3.2, 14.1, 8), [-2, 0, 2, 4, 6, 8, 10, 12, 14])
  assert.deepEqual(niceTicks(0.11, 0.79, 4), [0.2, 0.4, 0.6])
  assert.deepEqual(niceTicks(5, 5), [5])
  assert.deepEqual(niceTicks(10, 0, 5), [0, 2, 4, 6, 8, 10])                  // reversed input
  assert.deepEqual(niceTicks(NaN, 1), [])
  assert.ok(niceTicks(-0.5, 0.5, 5).includes(0))
  for (const [lo, hi] of [[-7, 95], [0.003, 0.021], [1234, 98765]]) { const t = niceTicks(lo, hi, 5); assert.ok(t.length >= 3 && t.length <= 9, `${lo}..${hi} -> ${t}`); assert.ok(t.every(v => v >= lo && v <= hi)) }
})

test('sectorOf maps balancing authorities to interconnections', () => {
  assert.equal(sectorOf({ ba: 'PJM', id: 'PJM/DOM' }), 'Eastern')
  assert.equal(sectorOf({ id: 'SWPP/OPPD' }), 'Eastern')
  assert.equal(sectorOf('ERCO/NCEN'), 'Texas')
  assert.equal(sectorOf({ ba: 'ERCO' }), 'Texas')
  assert.equal(sectorOf('CISO/PGAE'), 'Western')
  assert.equal(sectorOf({ ba: 'WACM' }), 'Western')                           // not Eastern, despite sitting next to SWPP
  assert.equal(sectorOf('PNM/PNM'), 'Western')
  assert.equal(sectorOf('FMPP'), 'Eastern')
  assert.equal(sectorOf('XXXX'), 'Other')
  assert.equal(sectorOf(null), 'Other')
})

test('METRICS: keys unique, getters read the export shape, formatters handle null', () => {
  const keys = METRICS.map(m => m.key)
  assert.equal(new Set(keys).size, keys.length)
  assert.deepEqual(keys, ['growth_pct', 'overnight_growth_pct', 'overnight_excess', 'neighbor_divergence', 'score', 'rank', 'night_cf', 'day_cf', 'day_night_gap', 'change_since_2019', 'ratio_slope_per_year', 'clean_over_demand', 'siting_score', 'siting_rank'])
  const r = { detection: { rank: 6, score: 7.71, growth_pct: 31.8, overnight_growth_pct: 39.5, overnight_excess: 7.7, neighbor_divergence: 32.9 }, siting: { siting_score: 0.436, siting_rank: 34, overnight_cf_share_2025: 0.39, change_since_2019: -0.042, overnight_clean_mw_over_demand: 0.408, ratio_slope_per_year: -0.0044 }, cf_share_2025: { overnight: 0.39, daytime: 0.416 } }
  const v = Object.fromEntries(METRICS.map(m => [m.key, m.get(r)]))
  assert.deepEqual(v, { growth_pct: 31.8, overnight_growth_pct: 39.5, overnight_excess: 7.7, neighbor_divergence: 32.9, score: 7.71, rank: 6, night_cf: 39, day_cf: 41.6, day_night_gap: 2.6, change_since_2019: -4.2, ratio_slope_per_year: -0.44, clean_over_demand: 0.408, siting_score: 0.436, siting_rank: 34 })
  assert.equal(metric('growth_pct').format(31.8), '+31.8%')
  assert.equal(metric('night_cf').format(39), '39.0%')
  assert.equal(metric('change_since_2019').format(-4.2), '-4.2 pts')
  assert.equal(metric('ratio_slope_per_year').format(-0.44), '-0.44 pts/yr')
  assert.equal(metric('clean_over_demand').format(0.408), '0.41×')
  assert.equal(metric('rank').format(6), '#6')
  assert.equal(metric('siting_score').format(0.436), '0.436')
  for (const m of METRICS) { assert.equal(m.format(null), '—', m.key); assert.equal(m.get({}), null, m.key); assert.equal(m.get(null), null, m.key) }
  assert.equal(metric('nope'), null)
  assert.equal(tickFormat(metric('night_cf'))(40), '40%')
  assert.equal(tickFormat(metric('clean_over_demand'))(0.30000000000000004), '0.3×')
  assert.equal(tickFormat(metric('rank'))(20), '#20')
  assert.equal(tickFormat(metric('overnight_excess'))(-5), '-5')
})

test('PRESETS reference real metrics and carry a question', () => {
  assert.deepEqual(PRESETS.map(p => p.key), ['fingerprint', 'gas', 'solar', 'improving', 'score_vs_siting'])
  for (const p of PRESETS) { assert.ok(metric(p.x), p.key); assert.ok(metric(p.y), p.key); assert.ok(p.question && p.reading.pos && p.reading.neg && p.reading.none, p.key) }
})

test('real export: every metric is finite for all scored regions, and preset correlations', { skip: !existsSync(REGIONS) && 'public/api/regions.json absent' }, () => {
  const doc = JSON.parse(readFileSync(REGIONS, 'utf8'))
  const regs = doc.regions
  assert.equal(regs.length, doc.meta?.n_scored ?? 111)
  for (const m of METRICS) {
    const missing = regs.filter(r => m.get(r) == null).map(r => r.id)
    assert.deepEqual(missing, [], `${m.key} null for ${missing.join(', ')}`)
  }
  const sectors = regs.reduce((a, r) => ({ ...a, [sectorOf(r)]: (a[sectorOf(r)] || 0) + 1 }), {})
  assert.equal(sectors.Other || 0, 0, `unmapped BAs: ${[...new Set(regs.filter(r => sectorOf(r) === 'Other').map(r => r.ba))].join(', ')}`)
  console.log(`  sectors: ${JSON.stringify(sectors)}`)
  const named = doc.meta?.validation_named_in_advance || []
  for (const p of PRESETS) {
    const mx = metric(p.x), my = metric(p.y)
    const xs = regs.map(mx.get), ys = regs.map(my.get)
    const r = pearson(xs, ys), fit = linfit(xs, ys)
    assert.ok(r != null && Math.abs(r) <= 1, p.key)
    const outs = outliers(regs.map(rg => ({ id: rg.id, x: mx.get(rg), y: my.get(rg) })), fit, 3).map(o => `${o.id} ${o.resid > 0 ? '+' : ''}${o.resid.toFixed(1)}`)
    console.log(`  ${p.key.padEnd(16)} ${p.x} vs ${p.y}: r = ${r.toFixed(3)}, slope = ${fit.slope.toFixed(3)} ${my.unit}/${mx.unit}, n = ${fit.n}; top outliers ${outs.join(', ')}`)
    if (p.key === 'fingerprint') assert.ok(r > 0, 'growth and overnight excess should be positively correlated')
  }
  const fp = PRESETS[0], xs = regs.map(metric(fp.x).get), ys = regs.map(metric(fp.y).get)
  const [xm] = quantiles(xs, [0.5]), [ym] = quantiles(ys, [0.5])
  const quad = regs.filter(r => metric(fp.x).get(r) > xm && metric(fp.y).get(r) > ym).map(r => r.id)
  console.log(`  fingerprint medians: growth ${xm.toFixed(1)}%, excess ${ym.toFixed(1)} pts; top-right quadrant has ${quad.length} regions; named in advance there: ${named.filter(n => quad.includes(n)).join(', ') || 'none'}`)
})
