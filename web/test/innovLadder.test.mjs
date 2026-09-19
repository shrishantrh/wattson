#!/usr/bin/env node
// Unit tests for web/src/lib/innovLadder.js: the formatters and the increment on small fixtures, then the
// company and region ladders against the real static export in public/api (skipped when absent), so the
// sentences the module shows for Google and for PJM/DOM are pinned. Node ESM, stdlib only.
//
//   node --test web/test/innovLadder.test.mjs      (or: node web/test/innovLadder.test.mjs)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fmtShare, fmtRange, fmtPts, fmtSignedGw, incrementOf, gridFacts, primaryClaim, disclosedHourly, companyLadder, regionLadder, biggestDrop } from '../src/lib/innovLadder.js'

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..')
const API = join(WEB, 'public', 'api')
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps
const readJSON = p => JSON.parse(readFileSync(p, 'utf8'))
const coords = existsSync(join(WEB, 'src', 'data', 'region_coords.json')) ? readJSON(join(WEB, 'src', 'data', 'region_coords.json')).regions : {}
// The same normalisation lib/data.js applies: the region file wraps { meta, region }; the place label rides on `c`.
const region = id => { const p = join(API, 'region', `${encodeURIComponent(id)}.json`); if (!existsSync(p)) return null; const raw = readJSON(p); return { ...(raw.region || raw), c: coords[id] } }
const company = t => {
  const p = join(API, 'company', `${t}.json`); if (!existsSync(p)) return null
  const c = readJSON(p)
  const sites = (c.sites || []).map(s => { const zone = s.zone ?? s.pjm_zone ?? null; const region_id = s.region_id || (zone ? (String(zone).includes('/') ? zone : `${s.ba}/${zone}`) : s.ba); return { ...s, zone, region_id, grid_label: coords[region_id]?.label || s.ba } })
  const counts = (c.claims || []).reduce((a, k) => ({ ...a, [k.verdict]: (a[k.verdict] || 0) + 1 }), {})
  return { ...c, sites, cannot_verify_count: c.cannot_verify_count ?? counts.cannot_verify ?? 0 }
}
const gridsFor = co => Object.fromEntries(co.sites.map(s => [s.region_id, gridFacts(region(s.region_id))]).filter(([, g]) => g))

// ---- formatters ------------------------------------------------------------------------------
test('fmtShare: one decimal under 10%, whole above, clamps below zero, dash for nothing', () => {
  assert.equal(fmtShare(0.056), '5.6%')
  assert.equal(fmtShare(0.007), '0.7%')
  assert.equal(fmtShare(0.393), '39%')
  assert.equal(fmtShare(1), '100%')
  assert.equal(fmtShare(0), '0%')
  assert.equal(fmtShare(-0.01), '0%')       // clean output fell: the share of growth is not negative on screen
  assert.equal(fmtShare(null), '—')
  assert.equal(fmtShare('0.65'), '65%')
})
test('fmtRange collapses equal ends and keeps the two figures otherwise', () => {
  assert.equal(fmtRange(0.056, 0.056), '5.6%')
  assert.equal(fmtRange(0.456, 0.75), '46–75%')
  assert.equal(fmtRange(null, 0.5), '50%')
  assert.equal(fmtRange(null, null), '—')
})
test('fmtPts and fmtSignedGw', () => {
  assert.equal(fmtPts(-0.35), '−35 pts')
  assert.equal(fmtPts(-0.049), '−4.9 pts')
  assert.equal(fmtPts(0.02), '+2.0 pts')
  assert.equal(fmtSignedGw(10.74), '+10.7 GW')
  assert.equal(fmtSignedGw(-0.09), '−0.1 GW')
  assert.equal(fmtSignedGw(0.01), '0.0 GW')  // rounds first, so a hair above zero is not "+0.0"
})

// ---- the increment on fixtures ------------------------------------------------------------------
const pjmLike = { id: 'X', type: 'ba', cf_share: { 2019: { overnight: 0.433, all: 0.391 }, 2025: { overnight: 0.39, all: 0.393 } }, total_avg_mw: { 2019: { overnight: 82539 } }, fuel_delta_overnight_gw: { nuclear: -0.95, hydro: -0.22, wind: 1.07, solar: 0.01, geothermal: null, gas: 10.74, coal: -2.52, oil: 0.15, other: 0.41 } }
test('incrementOf: growth met by gas reads as a share of growth below zero, with gas as the top fuel', () => {
  const inc = incrementOf(pjmLike)
  assert.ok(near(inc.total_gw, 8.69, 1e-6))
  assert.ok(near(inc.clean_gw, -0.09, 1e-6))
  assert.equal(inc.gas_gw, 10.74)
  assert.equal(inc.readable, true)
  assert.ok(inc.share < 0 && inc.share > -0.02)
  assert.deepEqual(inc.top, { fuel: 'gas', gw: 10.74 })
})
test('incrementOf: unreadable when the footprint did not grow, when it fell, when there is no breakdown', () => {
  const flat = incrementOf({ total_avg_mw: { 2019: { overnight: 1896 } }, fuel_delta_overnight_gw: { hydro: -0.06, gas: -0.13, coal: 0.21, other: -0.01 } })
  assert.equal(flat.readable, false); assert.equal(flat.reason, 'did not grow'); assert.ok(near(flat.total_gw, 0.01, 1e-9))
  const fell = incrementOf({ total_avg_mw: { 2019: { overnight: 1441 } }, fuel_delta_overnight_gw: { hydro: 0.03, wind: 0.08, gas: 0.16, coal: -1.0, other: 0.01 } })
  assert.equal(fell.readable, false); assert.equal(fell.reason, 'fell'); assert.ok(near(fell.total_gw, -0.72, 1e-9))
  const none = incrementOf({ total_avg_mw: { 2019: { overnight: 100 } } })
  assert.equal(none.readable, false); assert.equal(none.reason, 'no fuel breakdown'); assert.equal(none.total_gw, null)
  assert.equal(incrementOf(null).readable, false)
})
test('incrementOf: derives deltas from overnight_fuel_mw when the GW deltas are absent; a zone reads its parent', () => {
  const parent = { id: 'P', total_avg_mw: { 2019: { overnight: 1000 } }, overnight_fuel_mw: { 2019: { wind: 100, gas: 400, coal: 500 }, 2025: { wind: 500, gas: 450, coal: 350 } } }
  const inc = incrementOf({ id: 'P/Z', type: 'zone', parent })
  assert.ok(near(inc.total_gw, 0.3, 1e-9))
  assert.ok(near(inc.clean_gw, 0.4, 1e-9))
  assert.equal(inc.readable, true)
  assert.ok(inc.share > 1)   // wind rose more than the total: coal fell
  assert.deepEqual(inc.top, { fuel: 'wind', gw: 0.4 })
})
test('gridFacts: corrected baseline is used, zone flags drop the generic inheritance note, caveat becomes a flag', () => {
  const g = gridFacts({ ...pjmLike, id: 'X/Z', type: 'zone', cf_inherited_from_ba: true, data_flags: ["Generation numbers are the parent BA's (zones report demand only).", 'odd month'], demand: { 2019: { overnight_avg_mw: 1000 }, 2025: { overnight_avg_mw: 1500 } }, corrections: { corrections: [{ path: 'cf_share.2019', corrected: { overnight: 0.2 } }] } }, { caveat: 'history corrected' })
  assert.equal(g.all, 0.393); assert.equal(g.overnight, 0.39)
  assert.equal(g.overnight_baseline, 0.2); assert.equal(g.corrected, true)
  assert.ok(near(g.demand_delta_gw, 0.5, 1e-9))
  assert.deepEqual(g.flags, ['history corrected', 'odd month'])
  assert.equal(g.inherited, true); assert.equal(g.zone, true)
  assert.equal(gridFacts(null), null)
  assert.equal(gridFacts({ id: 'E', cf_share: { 2025: {} } }), null)
})

// ---- company ladder on fixtures ---------------------------------------------------------------------
const co = { company: 'Acme', ticker: 'ACME', notes: ['Grid-only.', 'Nuclear reports under NB, not under AA (0.10).'], cannot_verify_count: 0,
  sites: [{ metro: 'One', ba: 'AA', zone: null, region_id: 'AA', grid_label: 'Place A', cf_share_2025: 0.1 }, { metro: 'Two', ba: 'BB', zone: 'BB/Z', region_id: 'BB/Z', grid_label: 'Place B', cf_share_2025: 0.5 }],
  claims: [
    { claim_id: 'c0', verbatim: 'vague', magnitude: null, verdict: 'unfalsifiable', page: 1 },
    { claim_id: 'c1', verbatim: 'matched 100%', metric: 'renewable_electricity_share', magnitude: 1, unit: 'fraction', timeframe: 'annual', scope: 'market_based', page: 4, source_doc: 'acme-report.pdf', verdict: 'true_on_paper',
      evidence: [{ type: 'grid', ba: 'AA', cf_share: 0.1 }, { type: 'internal_contradiction', page: 94, label: 'CFE across data centers (hourly)', values: [60, 62, 65], years: [2023, 2025, 2024], source_doc: 'acme-report.pdf' }] },
  ] }
test('primaryClaim prefers a fraction claim with a verdict; disclosedHourly takes the latest year and reads percents as fractions', () => {
  assert.equal(primaryClaim(co).claim_id, 'c1')
  const h = disclosedHourly(co)
  assert.equal(h.share, 0.62); assert.equal(h.year, 2025); assert.equal(h.page, 94)
  assert.equal(disclosedHourly({ claims: [{ evidence: [{ label: 'emissions', values: [1, 2] }] }] }), null)   // not an hourly figure
  assert.equal(primaryClaim({ claims: [{ magnitude: null, verdict: 'cannot_verify' }] }), null)
})
test('companyLadder without grid details: rungs from the company file, overnight and increment marked loading', () => {
  const L = companyLadder(co)
  assert.equal(L.kind, 'company')
  assert.deepEqual(L.rungs.map(r => r.id), ['claimed', 'hourly', 'grid_all', 'grid_night', 'increment'])
  assert.equal(L.rungs[0].share, 1); assert.equal(L.rungs[0].status, 'paper'); assert.equal(L.rungs[0].source, 'p. 4, acme-report')
  assert.equal(L.rungs[1].share, 0.62); assert.equal(L.rungs[1].status, 'disclosed'); assert.equal(L.rungs[1].source, 'p. 94, acme-report, 2025')
  assert.equal(L.rungs[2].lo, 0.1); assert.equal(L.rungs[2].hi, 0.5); assert.ok(near(L.rungs[2].share, 0.3))
  assert.equal(L.rungs[3].status, 'loading'); assert.equal(L.rungs[4].status, 'loading')
  assert.ok(near(L.rungs[1].drop, -0.38)); assert.ok(near(L.rungs[2].drop, -0.32))
  assert.match(L.sentence, /^Acme says 100% renewable on an annual, market-based basis \(p\. 4\)\. Measured hourly, its own report puts it at 62% \(p\. 94, 2025\)\. On the grids its 2 mapped sites draw from \(Place A, Place B\), with contracted power excluded, 2025 generation was 10–50% clean over all hours\. Each rung removes one accounting convention; the claim is true on paper at the rung it was made for\.$/)
  assert.deepEqual(L.flags, ['Nuclear reports under NB, not under AA (0.10).'])   // the note that names a site's grid, and only that one
  assert.equal(L.counts.cannot_verify, 0)
})
test('companyLadder with grids: a range overnight, one readable increment and one that fell, a cannot-verify hourly rung', () => {
  const grids = {
    AA: gridFacts({ id: 'AA', type: 'ba', name: 'Place A', cf_share: { 2025: { all: 0.1, overnight: 0.05 } }, total_avg_mw: { 2019: { overnight: 1000 } }, fuel_delta_overnight_gw: { gas: 0.5, coal: -1.0 } }),
    'BB/Z': gridFacts({ id: 'BB/Z', type: 'zone', ba: 'BB', name: 'Place B', cf_inherited_from_ba: true, cf_share: { 2025: { all: 0.5, overnight: 0.6 } }, total_avg_mw: { 2019: { overnight: 1000 } }, fuel_delta_overnight_gw: { wind: 0.9, gas: 0.1 } }),
  }
  const noHourly = { ...co, claims: [{ ...co.claims[1], evidence: [{ type: 'grid', ba: 'AA', cf_share: 0.1 }] }] }
  const L = companyLadder(noHourly, { grids })
  assert.equal(L.rungs[1].status, 'cannot_verify'); assert.equal(L.rungs[1].share, null)
  assert.equal(L.rungs[3].lo, 0.05); assert.equal(L.rungs[3].hi, 0.6)
  assert.equal(L.rungs[4].status, 'grid'); assert.ok(near(L.rungs[4].share, 0.9)); assert.equal(L.rungs[4].source, '1 of 2 grids readable')
  assert.ok(near(L.rungs[2].drop, -0.7))   // from the claim straight to the grid when the hourly rung is empty
  assert.match(L.sentence, /It discloses no hourly figure in the documents read, so that rung cannot be verified\./)
  assert.match(L.sentence, /10–50% clean over all hours and 5\.0–60% between midnight and 6am\./)
  assert.match(L.sentence, /Of the generation added at night since 2019, Place A's overnight generation fell 0\.5 GW, so its increment cannot be read and Place B's grid was 90% clean \(wind \+0\.9 GW\)\./)
  assert.equal(L.counts.cannot_verify, 1)
  const step = biggestDrop(L.rungs)
  assert.equal(step.from.id, 'claimed'); assert.equal(step.to.id, 'grid_all'); assert.ok(near(step.pts, 0.7))
})
test('companyLadder is null with no fraction claim or no site', () => {
  assert.equal(companyLadder({ company: 'Nil', sites: [{ ba: 'AA' }], claims: [{ magnitude: null, verdict: 'cannot_verify' }] }), null)
  assert.equal(companyLadder({ company: 'Nil', sites: [], claims: co.claims }), null)
  assert.equal(companyLadder(null), null)
})

// ---- region ladder on a fixture -----------------------------------------------------------------------
test('regionLadder: average, overnight, increment; the sentence says what moved and what a flat load means', () => {
  const L = regionLadder({ ...pjmLike, id: 'X/Z', type: 'zone', ba: 'X', cf_inherited_from_ba: true, demand: { 2019: { overnight_avg_mw: 10060 }, 2025: { overnight_avg_mw: 14033 } } }, { label: 'Somewhere', load_mw: 300 })
  assert.deepEqual(L.rungs.map(r => [r.id, r.status]), [['grid_all', 'grid'], ['grid_night', 'grid'], ['increment', 'grid']])
  assert.equal(L.rungs[0].share, 0.393); assert.equal(L.rungs[1].share, 0.39); assert.ok(L.rungs[2].share < 0)
  assert.equal(L.sentence, 'In Somewhere the X grid (this zone inherits its generation figures) ran 39% clean over all hours of 2025 and 39% between midnight and 6am. Of the 8.7 GW of overnight generation added since 2019, 0% was clean: clean output fell 0.1 GW, gas rose 10.7 GW and coal fell 2.5 GW. Consistent with the zone\'s +4.0 GW of overnight demand growth being served by gas. For a 300 MW flat load that means 182 MW not carbon-free at the average mix, and 300 MW if it is served the way the last 8.7 GW was.')
  assert.equal(L.counts.cannot_verify, 0)
})
test('regionLadder: unreadable increment says so, a clean increment names the fuel, a corrected history is said', () => {
  const flat = regionLadder({ id: 'S', type: 'ba', cf_share: { 2025: { all: 0.056, overnight: 0.007 } }, total_avg_mw: { 2019: { overnight: 1896 } }, fuel_delta_overnight_gw: { hydro: -0.06, gas: -0.13, coal: 0.21, other: -0.01 }, demand: { 2019: { overnight_avg_mw: 2107 }, 2025: { overnight_avg_mw: 2817 } } }, { label: 'S-place' })
  assert.equal(flat.rungs[2].status, 'unreadable')
  assert.match(flat.sentence, /^In S-place the S grid ran 5\.6% clean over all hours of 2025 and 0\.7% between midnight and 6am\. Its own overnight generation did not grow since 2019 \(0\.0 GW\) while overnight demand rose 0\.7 GW, so the increment cannot be read from generation inside the footprint\.$/)
  assert.equal(flat.counts.cannot_verify, 1)
  const wind = regionLadder({ id: 'W', type: 'ba', cf_share: { 2025: { all: 0.456, overnight: 0.519 } }, total_avg_mw: { 2019: { overnight: 28275 } }, fuel_delta_overnight_gw: { nuclear: -0.01, hydro: -0.91, wind: 4.16, solar: 0.05, gas: 0.6, coal: -0.41, other: 0.01 }, demand: { 2019: { overnight_avg_mw: 1160 }, 2025: { overnight_avg_mw: 1682 } }, corrections: { corrections: [{ path: 'cf_share.2019', corrected: { overnight: 0.4 } }] } }, { label: 'W-place', load_mw: 100 })
  assert.match(wind.sentence, /Of the 3\.5 GW of overnight generation added since 2019, 94% was clean: clean output rose 3\.3 GW, gas rose 0\.6 GW and coal fell 0\.4 GW\. Consistent with its \+0\.5 GW of overnight demand growth being served by wind\. For a 100 MW flat load that means 54 MW not carbon-free at the average mix, and 6 MW if it is served the way the last 3\.5 GW was\. Its published 2019 history is corrected here; read the increment with care\.$/)
  assert.equal(wind.counts.corrected, 1)
  assert.equal(regionLadder(null), null)
  assert.equal(regionLadder({ id: 'E', cf_share: {} }), null)
})

// ---- the real export: the sentences the module shows -------------------------------------------------
test('real export: Google', { skip: !company('GOOGL') || !region('SC') }, () => {
  const c = company('GOOGL')
  const L = companyLadder(c, { grids: gridsFor(c) })
  assert.deepEqual(L.rungs.map(r => [r.id, r.status]), [['claimed', 'paper'], ['hourly', 'disclosed'], ['grid_all', 'grid'], ['grid_night', 'grid'], ['increment', 'unreadable']])
  assert.equal(L.rungs[0].share, 1); assert.equal(L.rungs[1].share, 0.65); assert.equal(L.rungs[2].share, 0.056); assert.equal(L.rungs[3].share, 0.007)
  assert.equal(L.rungs[1].source, 'p. 94, google-2026-environmental-report, 2025')
  assert.equal(L.sentence, "Alphabet (Google) says 100% renewable on an annual, market-based basis (p. 4). Measured hourly, its own report puts it at 65% (p. 94, 2025). On the grid its one mapped site draws from (Santee Cooper), with contracted power excluded, 2025 generation was 5.6% clean over all hours and 0.7% between midnight and 6am. The footprint's own overnight generation did not grow since 2019 (0.0 GW against +0.7 GW of demand), so the increment cannot be read. Each rung removes one accounting convention; the claim is true on paper at the rung it was made for.")
  assert.equal(L.flags.length, 1); assert.match(L.flags[0], /V\.C\. Summer/)
  const step = biggestDrop(L.rungs); assert.equal(step.from.id, 'hourly'); assert.equal(step.to.id, 'grid_all'); assert.ok(near(step.pts, 0.594))
})
test('real export: PJM/DOM', { skip: !region('PJM/DOM') }, () => {
  const L = regionLadder(region('PJM/DOM'), { label: coords['PJM/DOM']?.label, load_mw: 300 })
  assert.equal(L.sentence, "In N. Virginia the PJM grid (this zone inherits its generation figures) ran 39% clean over all hours of 2025 and 39% between midnight and 6am. Of the 8.7 GW of overnight generation added since 2019, 0% was clean: clean output fell 0.1 GW, gas rose 10.7 GW and coal fell 2.5 GW. Consistent with the zone's +4.0 GW of overnight demand growth being served by gas. For a 300 MW flat load that means 182 MW not carbon-free at the average mix, and 300 MW if it is served the way the last 8.7 GW was.")
  assert.deepEqual(L.flags, [])
})
test('real export: Meta (two sites, no hourly disclosure) and Amazon (nothing measurable)', { skip: !company('META') || !region('PACW') }, () => {
  const m = company('META')
  const L = companyLadder(m, { grids: gridsFor(m) })
  assert.equal(L.rungs[1].status, 'cannot_verify')
  assert.equal(fmtRange(L.rungs[2].lo, L.rungs[2].hi), '46–75%')
  assert.equal(fmtRange(L.rungs[3].lo, L.rungs[3].hi), '52–72%')
  assert.match(L.sentence, /W\. Oregon's overnight generation fell 0\.7 GW, so its increment cannot be read and Omaha's grid was 94% clean \(wind \+4\.2 GW\)/)
  assert.equal(L.counts.cannot_verify, 1)
  const a = company('AMZN')
  if (a) assert.equal(companyLadder(a), null)
})
test('real export: Microsoft carries the Phoenix correction as a flag', { skip: !company('MSFT') || !region('AZPS') }, () => {
  const m = company('MSFT')
  const L = companyLadder(m, { grids: Object.fromEntries(m.sites.map(s => [s.region_id, gridFacts(region(s.region_id), { caveat: s.region_id === 'AZPS' ? 'Phoenix history corrected' : null })]).filter(([, g]) => g)) })
  assert.deepEqual(L.corrected, ['Phoenix'])
  assert.ok(L.flags.includes('Phoenix history corrected'))
  assert.match(L.sentence, /Grant Co\. WA's grid was 100% clean \(hydro \+0\.2 GW\)/)
})
