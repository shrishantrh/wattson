#!/usr/bin/env node
// Unit tests for src/lib/relocate.js (move one site, watch the physical figure move) against a
// tiny fixture, then against the real export in public/api (skipped when those files are absent).
// Node ESM, node:test, no app imports beyond the pure module.
//
//   node --test web/test/relocate.test.mjs      (or: node web/test/relocate.test.mjs)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { indexRegions, regionShare, regionLabel, siteRegionIds, siteRegionId, siteRegion, siteShare, companyPhysical, relocate, bestMoves, MIN_DEMAND_MW } from '../src/lib/relocate.js'

const near = (a, b, eps = 1e-9) => assert.ok(a != null && Math.abs(a - b) <= eps, `${a} != ${b}`)
const WEB = join(dirname(fileURLToPath(import.meta.url)), '..')
const P = { regions: join(WEB, 'public', 'api', 'regions.json'), coords: join(WEB, 'src', 'data', 'region_coords.json'), company: t => join(WEB, 'public', 'api', 'company', `${t}.json`) }

// Six grids: Alpha (dirty), Bravo and its zone (same generation), Charlie (overnight figure only),
// Delta (clean but under 500 MW), Echo (no figure at all).
const REGIONS = [
  { id: 'A', cf_share_2025: { all: 0.1, overnight: 0.05 }, siting: { overnight_cf_share_2025: 0.05 }, c: { label: 'Alpha' } },
  { id: 'B', cf_share_2025: { all: 0.5 }, c: { label: 'Bravo' } },
  { id: 'B/Z', ba: 'B', zone: 'Z', cf_share_2025: { all: 0.5 }, c: { label: 'Bravo zone' } },
  { id: 'C', siting: { overnight_cf_share_2025: 0.9 }, c: { label: 'Charlie' } },
  { id: 'D', cf_share_2025: { all: 1.0 }, demand_avg_mw: 120, c: { label: 'Delta' } },
  { id: 'E', cf_share_2025: {}, c: { label: 'Echo' } },
]
const BY = indexRegions(REGIONS)
const SITES = [
  { metro: 'One', ba: 'A', region_id: 'A', grid_label: 'Alpha' },
  { metro: 'Two', ba: 'B', zone: 'Z', region_id: 'B/Z', grid_label: 'Bravo zone' },
]

test('regionShare: all-hours first, overnight siting figure as the fallback, null otherwise', () => {
  near(regionShare(BY.A), 0.1)
  near(regionShare(BY.C), 0.9)
  assert.equal(regionShare(BY.E), null)
  assert.equal(regionShare(null), null)
  assert.equal(regionLabel(BY.A), 'Alpha'); assert.equal(regionLabel(null, 'X'), 'X'); assert.equal(regionLabel({ id: 'Y' }), 'Y')
})

test('a site is filed under its region_id, then BA/zone, then the BA', () => {
  assert.deepEqual(siteRegionIds({ ba: 'B', zone: 'Z' }), ['B/Z', 'B'])
  assert.deepEqual(siteRegionIds({ ba: 'B', zone: 'B/Z' }), ['B/Z', 'B'])            // a zone that already reads BA/zone
  assert.deepEqual(siteRegionIds({ ba: 'B', pjm_zone: 'Z' }), ['B/Z', 'B'])
  assert.deepEqual(siteRegionIds({ region_id: 'B/B/Z', ba: 'B', zone: 'B/Z' }), ['B/B/Z', 'B/Z', 'B'])
  assert.deepEqual(siteRegionIds({ ba: 'A' }), ['A'])
  assert.deepEqual(siteRegionIds(null), [])
  assert.equal(siteRegionId({ ba: 'A', zone: null }), 'A')
  assert.equal(siteRegion({ region_id: 'nope', ba: 'A' }, BY)?.id, 'A')            // unknown region_id falls to the BA
  assert.equal(siteRegion({ ba: 'nope' }, BY), null)
})

test('siteShare: the grid figure, the site own figure only when the grid is unknown, null otherwise', () => {
  near(siteShare(SITES[0], BY), 0.1)
  near(siteShare(SITES[1], BY), 0.5)
  near(siteShare({ ba: 'C' }, BY), 0.9)
  near(siteShare({ ba: 'nope', cf_share_2025: 0.33 }, BY), 0.33)
  near(siteShare({ ba: 'A', cf_share_2025: 0.33 }, BY), 0.1)                       // the grid wins over the site's copy
  assert.equal(siteShare({ ba: 'E' }, BY), null)
  assert.equal(siteShare({ ba: 'nope' }, BY), null)
  assert.equal(siteShare(null, BY), null)
  assert.equal(siteShare(SITES[0], null), null)
})

test('regions may be an object, a Map or the plain array', () => {
  const m = new Map(REGIONS.map(r => [r.id, r]))
  for (const src of [BY, m, REGIONS]) { near(siteShare(SITES[0], src), 0.1); near(companyPhysical(SITES, src).mean, 0.3); assert.equal(bestMoves(SITES, src, 1)[0].toRegionId, 'C') }
  assert.equal(siteShare({ ba: '__proto__' }, BY), null)
})

test('companyPhysical: min, max, unweighted mean, n over the sites with a figure', () => {
  const p = companyPhysical(SITES, BY)
  near(p.min, 0.1); near(p.max, 0.5); near(p.mean, 0.3); assert.equal(p.n, 2)
  assert.deepEqual(companyPhysical([], BY), { min: null, max: null, mean: null, n: 0 })
  assert.deepEqual(companyPhysical(null, BY), { min: null, max: null, mean: null, n: 0 })
  const q = companyPhysical([...SITES, { ba: 'nope' }], BY)
  assert.equal(q.n, 2); near(q.mean, 0.3)                                          // an unknown grid is skipped, not zero
})

test('relocate: before and after, and what moved where', () => {
  const r = relocate(SITES, 0, 'C', BY)
  near(r.before.min, 0.1); near(r.before.max, 0.5); near(r.before.mean, 0.3)
  near(r.after.min, 0.5); near(r.after.max, 0.9); near(r.after.mean, 0.7)
  assert.deepEqual(r.moved, { from: 'Alpha', to: 'Charlie', fromShare: 0.1, toShare: 0.9, fromRegionId: 'A', toRegionId: 'C' })
  const same = relocate(SITES, 1, 'B', BY)                                          // its own generation: nothing moves
  near(same.after.mean, same.before.mean); assert.equal(same.moved.from, 'Bravo zone')
  const down = relocate(SITES, 1, 'A', BY)                                          // dirtier is allowed and reported as is
  near(down.after.mean, 0.1); near(down.after.max, 0.1)
  const add = relocate([...SITES, { ba: 'nope' }], 2, 'C', BY)                      // a site without a figure gains one
  assert.equal(add.before.n, 2); assert.equal(add.after.n, 3); near(add.after.mean, 0.5); assert.equal(add.moved.fromShare, null)
  assert.equal(relocate(SITES, 5, 'C', BY), null)
  assert.equal(relocate(SITES, -1, 'C', BY), null)
  assert.equal(relocate(SITES, 0, 'nope', BY), null)
  assert.equal(relocate(SITES, 0, 'E', BY), null)                                   // a destination without a figure
  assert.equal(relocate(null, 0, 'C', BY), null)
  assert.equal(relocate(SITES, 0, 'C', null), null)
})

test('bestMoves: raises only, one per grid, tiny grids skipped, best first', () => {
  const mv = bestMoves(SITES, BY, 3)
  // Site One to Charlie (0.7) beats everything; Bravo and its zone collapse to one grid (0.5);
  // Delta (120 MW) is skipped; Echo has no figure; Two to Charlie ties at 0.5 but Charlie is taken.
  assert.deepEqual(mv.map(m => [m.siteIndex, m.toRegionId]), [[0, 'C'], [0, 'B']])
  near(mv[0].meanAfter, 0.7); near(mv[1].meanAfter, 0.5)
  assert.deepEqual(bestMoves(SITES, BY, 1).map(m => m.toRegionId), ['C'])
  assert.deepEqual(bestMoves(SITES, BY, 3, { siteIndex: 1 }).map(m => [m.siteIndex, m.toRegionId]), [[1, 'C']])
  assert.deepEqual(bestMoves(SITES, BY, 3, { siteIndex: 9 }), [])
  assert.deepEqual(bestMoves([{ ba: 'C' }], BY, 3), [])                              // already on the cleanest grid
  assert.deepEqual(bestMoves([], BY), []); assert.deepEqual(bestMoves(SITES, null), []); assert.deepEqual(bestMoves(SITES, BY, 0), [])
  const big = indexRegions([...REGIONS, { id: 'D2', cf_share_2025: { all: 1.0 }, demand_avg_mw: MIN_DEMAND_MW }])
  assert.equal(bestMoves(SITES, big, 1)[0].toRegionId, 'D2')                        // exactly 500 MW is in
})

test('real export: Google Moncks Corner to Omaha, the walk scores, the best moves', { skip: !existsSync(P.regions) || !existsSync(P.company('GOOGL')) || !existsSync(P.company('META')) }, () => {
  const coords = existsSync(P.coords) ? JSON.parse(readFileSync(P.coords, 'utf8')).regions : {}
  const regions = JSON.parse(readFileSync(P.regions, 'utf8')).regions.map(r => ({ ...r, c: coords[r.id] }))
  const by = indexRegions(regions)
  const load = t => JSON.parse(readFileSync(P.company(t), 'utf8'))
  const google = load('GOOGL'), meta = load('META')
  const mc = google.sites.findIndex(s => /Moncks Corner/.test(s.metro))
  assert.ok(mc >= 0)
  const r = relocate(google.sites, mc, 'SWPP/OPPD', by)
  near(r.before.mean, 0.056, 1e-6); near(r.after.mean, 0.456, 1e-6)
  assert.equal(r.moved.from, 'Santee Cooper'); assert.equal(r.moved.to, 'Omaha')
  near(companyPhysical(google.sites, by).mean, google.walk_score, 1e-3)
  near(companyPhysical(meta.sites, by).mean, meta.walk_score, 1e-3)               // the zone written as "SWPP/OPPD" still resolves
  assert.equal(companyPhysical(meta.sites, by).n, meta.sites.length)
  for (const co of [google, meta]) {
    const mv = bestMoves(co.sites, by, 3)
    assert.equal(mv.length, 3)
    assert.ok(mv.every(m => m.meanAfter > companyPhysical(co.sites, by).mean))
    assert.equal(new Set(mv.map(m => m.toRegionId.split('/')[0])).size, 3)
    assert.ok(mv[0].meanAfter >= mv[1].meanAfter && mv[1].meanAfter >= mv[2].meanAfter)
  }
})
