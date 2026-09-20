#!/usr/bin/env node
// Unit tests for the nearby-cleaner-grid arithmetic in src/lib/nearby.js. Node ESM, node:test, no JSON.
//
//   node web/test/nearby.test.mjs
//
// The fixture is synthetic: a query grid A with one zone, a cleaner neighbour B (with a zone of its
// own, to test the collapse), a cleaner grid C further out, a dirtier grid D, two cleaner grids E and F
// whose data is flagged, and a far-away clean grid G. Nothing here reads a data file.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { haversineKm, nearbyCleaner, describeNearby, milesToKm, kmToMiles, fossilMW, isFlagged, realFlags, canAnswer, regionList } from '../src/lib/nearby.js'

const INHERIT = "Generation numbers are the parent BA's (zones report demand only)."
const row = (id, lat, lng, share, extra = {}) => ({ id, ba: id.split('/')[0], zone: id.includes('/') ? id.split('/')[1] : null, name: `${id} name`, siting: { overnight_cf_share_2025: share, change_since_2019: extra.change ?? 0.01, ratio_slope_per_year: 0.002 }, detection: { rank: extra.rank ?? 50 }, data_flags: extra.flags ?? (id.includes('/') ? [INHERIT] : []), has_corrections: !!extra.corr, c: { lat, lng, label: extra.label ?? id, place: `${id} place` } })

const A = row('A', 40, -80, 0.40, { label: 'Pittsburgh' })
const AZ = row('A/Z', 39, -77, 0.40, { label: 'Washington' })
const B = row('B', 41, -81, 0.60, { label: 'Cleveland', change: 0.03, rank: 12 })
const BY = row('B/Y', 41.2, -81.5, 0.60, { label: 'Akron' })
const C = row('C', 36, -86, 0.70, { label: 'Nashville', change: -0.02 })
const D = row('D', 40.5, -79, 0.30, { label: 'Dirty' })
const E = row('E', 42, -83, 0.65, { label: 'Detroit', corr: true })
const F = row('F', 43, -85, 0.65, { label: 'Grand Rapids', flags: ['Demand rose 1.5 GW in 2022 with flat generation.'] })
const G = row('G', 34, -118, 0.90, { label: 'Los Angeles' })
const NOCOORD = { ...row('N', 0, 0, 0.99), c: null }
const FIX = [A, AZ, B, BY, C, D, E, F, G, NOCOORD]

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`)
const ids = res => res.candidates.map(c => c.id)

test('haversineKm: symmetric, zero at the same point, a known distance, null when a point is missing', () => {
  const nyc = { lat: 40.7128, lng: -74.006 }, la = { lat: 34.0522, lng: -118.2437 }
  const d = haversineKm(nyc, la)
  assert.ok(Math.abs(d - 3936) < 25, `NYC to LA ${d} km`)
  near(haversineKm(nyc, la), haversineKm(la, nyc))
  near(haversineKm(nyc, nyc), 0)
  assert.equal(haversineKm(nyc, null), null)
  assert.equal(haversineKm({ lat: 'x', lng: 1 }, nyc), null)
  assert.equal(haversineKm({ lat: 1 }, nyc), null)
  // Coordinates given as strings still work; distance grows with separation.
  near(haversineKm({ lat: '40.7128', lng: '-74.006' }, la), d)
  assert.ok(haversineKm(A.c, C.c) > haversineKm(A.c, B.c))
})

test('miles and km round-trip', () => {
  near(kmToMiles(milesToKm(500)), 500)
  near(milesToKm(1), 1.609344)
})

test('fossilMW and flags helpers', () => {
  near(fossilMW(300, 0.4), 180)
  assert.equal(fossilMW(300, null), null)
  assert.equal(fossilMW('x', 0.4), null)
  assert.deepEqual(realFlags(AZ), [])                 // the inheritance note is not a data flag
  assert.equal(isFlagged(AZ), false)
  assert.equal(isFlagged(E), true)                    // has_corrections
  assert.equal(isFlagged(F), true)                    // a real data_flags entry
  assert.equal(isFlagged(B, { B: 'meta flag' }), true) // meta.data_flags by id
  assert.equal(canAnswer(FIX, 'A'), true)
  assert.equal(canAnswer(FIX, 'N'), false)            // no coordinates
  assert.equal(canAnswer(FIX, 'nope'), false)
  assert.deepEqual(regionList({ meta: {}, regions: [A] }), [A])
  assert.deepEqual(regionList(null), [])
})

test('candidates: only cleaner grids in range, flagged ones excluded but marked, share desc then distance', () => {
  const res = nearbyCleaner(FIX, 'A', { radiusKm: 1000, k: 3, loadMW: 300 })
  assert.equal(res.from.id, 'A'); assert.equal(res.from.label, 'Pittsburgh'); near(res.from.share, 0.4); near(res.from.fossilMW, 180)
  assert.equal(res.from.flagged, false); assert.equal(res.from.zone, false)
  assert.deepEqual(ids(res), ['C', 'B'])               // 0.70 before 0.60; D (0.30) is dirtier; G is out of range
  assert.deepEqual(res.excluded.map(c => c.id), ['E', 'F'])
  assert.ok(res.excluded.every(c => c.flagged))
  assert.ok(res.candidates.every(c => !c.flagged && c.share > res.from.share && c.km <= 1000))
  assert.equal(res.n_cleaner, 2)
  assert.equal(res.nearest_outside, null)
  const c = res.candidates.find(x => x.id === 'C')
  near(c.km, haversineKm(A.c, C.c)); near(c.miles, kmToMiles(c.km))
  near(c.fossilMW, 300 * 0.3); near(c.saving, 180 - 90)
  near(c.change_since_2019, -0.02)
  assert.equal(c.place, 'C place')
  const b = res.candidates.find(x => x.id === 'B')
  assert.equal(b.rank, 12)
})

test('share ties break on distance; k truncates; n_cleaner counts before the cut', () => {
  const B2 = row('B2', 44, -84, 0.60, { label: 'Farther' })    // same share as B, farther away
  const res = nearbyCleaner([...FIX, B2], 'A', { radiusKm: 1000, k: 2 })
  assert.deepEqual(ids(res), ['C', 'B'])                       // B before B2 at equal share; k=2 drops B2
  assert.equal(res.n_cleaner, 3)
  assert.equal(res.k, 2)
  const all = nearbyCleaner([...FIX, B2], 'A', { radiusKm: 1000, k: 10 })
  assert.deepEqual(ids(all), ['C', 'B', 'B2'])
})

test('radius: a tight radius drops the farther grid and names the nearest one outside', () => {
  const res = nearbyCleaner(FIX, 'A', { radiusKm: 200, k: 3 })
  assert.deepEqual(ids(res), ['B'])                             // C is ~670 km away
  assert.equal(res.nearest_outside, null)                       // only reported when nothing is in range
  const none = nearbyCleaner(FIX, 'A', { radiusKm: 50, k: 3 })
  assert.deepEqual(ids(none), [])
  assert.equal(none.nearest_outside.id, 'B')                    // nearest cleaner unflagged grid, not E/F
  assert.equal(none.n_cleaner, 0)
  near(none.radiusMiles, kmToMiles(50))
})

test('zone collapse: one entry per grid, the query zone keeps its own coordinates, its grid is never a candidate', () => {
  const res = nearbyCleaner(FIX, 'A/Z', { radiusKm: 1000, k: 5 })
  assert.equal(res.from.id, 'A/Z'); assert.equal(res.from.label, 'Washington'); assert.equal(res.from.zone, true); assert.equal(res.from.grid, 'A')
  assert.ok(!ids(res).includes('A') && !ids(res).includes('A/Z'), 'own grid excluded')
  assert.equal(ids(res).filter(x => x === 'B').length, 1, 'B once')
  assert.ok(!ids(res).includes('B/Y'), 'zone of B collapsed into B')
  assert.ok(res.candidates.every(c => !c.id.includes('/')), 'candidates are grids')
  const b = res.candidates.find(x => x.id === 'B')
  near(b.km, haversineKm(AZ.c, B.c))                            // measured from the zone, not from A
  assert.notEqual(Math.round(b.km), Math.round(haversineKm(A.c, B.c)))
  // A grid known only through its zones is represented by the zone nearest the query.
  const HQ = row('H/Q', 38, -84, 0.55, { label: 'Lexington' }), HR = row('H/R', 37, -88, 0.55, { label: 'Paducah' })
  const viaZone = nearbyCleaner([...FIX, HQ, HR], 'A', { radiusKm: 1000, k: 10 })
  const h = viaZone.candidates.filter(c => c.id.startsWith('H'))
  assert.equal(h.length, 1); assert.equal(h[0].id, 'H/Q')
})

test('input shapes: the { meta, regions } wrapper works and meta.data_flags marks a grid', () => {
  const wrapped = { meta: { data_flags: { C: 'unexplained demand step' } }, regions: FIX }
  const res = nearbyCleaner(wrapped, 'A', { radiusKm: 1000, k: 3 })
  assert.deepEqual(ids(res), ['B'])
  assert.deepEqual(res.excluded.map(c => c.id), ['C', 'E', 'F'])
  assert.equal(res.excluded[0].flagged, true)
})

// The sentence is the card's lead, read above the radius control and the candidate rows. The rows already
// print each grid's name, distance, clean share and fossil MW, and two figures beside them give the fossil
// MW here and at the best grid, so the sentence must NOT repeat those: what it owes the reader is the count
// of cleaner grids in range, which of them is cleanest (the rows are ordered nearest first), this place's
// own share, and, in words, that a flagged grid is not a recommendation.
test('describeNearby: how many are cleaner, which is cleanest, and this place’s own share', () => {
  const s = describeNearby(nearbyCleaner(FIX, 'A', { radiusKm: milesToKm(500), k: 3, loadMW: 300 }))
  assert.equal(s, "2 grids in range run cleaner at night than Pittsburgh's 40%; the cleanest is Nashville at 70%.")
  assert.ok(s.includes('40%') && s.includes('70%'), 'both shares are figures, not adjectives')
  // Never the figures the rows and the two Num tiles already carry.
  for (const dup of ['180', '90', '428 miles', '300 MW']) assert.ok(!s.includes(dup), `${dup} is already on the card`)
  // k truncates the list, so the sentence has to say the count is larger than what is shown.
  const listed = describeNearby(nearbyCleaner([...FIX, row('B2', 44, -84, 0.60)], 'A', { radiusKm: milesToKm(500), k: 2 }))
  assert.ok(listed.startsWith('3 grids in range run cleaner'), listed)
  assert.ok(listed.endsWith('and the 2 cleanest are listed.'), listed)
  // Exactly one: singular, and no count that would read as a list.
  const one = describeNearby(nearbyCleaner(FIX, 'A', { radiusKm: 200, k: 3 }))
  assert.equal(one, "One grid in range runs cleaner at night than Pittsburgh's 40%: Cleveland at 60%.")
  // Nothing in range: the distance to the nearest one that is, which no row can state until it is drawn.
  const none = describeNearby(nearbyCleaner(FIX, 'A', { radiusKm: 50, k: 3 }))
  assert.equal(none, "No grid in range is cleaner at night than Pittsburgh's 40%; the nearest that is lies 87 miles away.")
  // Flagged and in range but nothing else: named, and said in words not to be a recommendation.
  const onlyFlagged = describeNearby(nearbyCleaner([A, E, G], 'A', { radiusKm: 1000, k: 3 }))
  assert.ok(onlyFlagged.startsWith("No grid in range is cleaner at night than Pittsburgh's 40%; the nearest that is lies 2,121 miles away."), onlyFlagged)
  assert.ok(onlyFlagged.endsWith('Detroit reads cleaner, but its data is flagged, so it is not recommended.'), onlyFlagged)
  // Nothing cleaner anywhere.
  assert.equal(describeNearby(nearbyCleaner([A, D], 'A', { radiusKm: 1000 })), "No grid in range is cleaner at night than Pittsburgh's 40%.")
  // Shares that round to the same whole percent get a decimal, so the two figures cannot read identically.
  const closeCall = describeNearby(nearbyCleaner([A, row('K', 40.2, -80.2, 0.404, { label: 'Close' })], 'A', { radiusKm: 1000 }))
  assert.ok(closeCall.includes("Pittsburgh's 40.0%") && closeCall.includes('Close at 40.4%'), closeCall)
  // Unknown id and a region without coordinates.
  assert.equal(describeNearby(nearbyCleaner(FIX, 'nope')), 'That place is not in the scored regions, so there is nothing to compare.')
  assert.ok(describeNearby(nearbyCleaner(FIX, 'N')).includes('no load-centre coordinates'))
  assert.ok(describeNearby(null).includes('not in the scored regions'))
})

test('describeNearby stays one short sentence in every branch', () => {
  const cases = [
    nearbyCleaner(FIX, 'A', { radiusKm: milesToKm(500), k: 3 }),
    nearbyCleaner([...FIX, row('B2', 44, -84, 0.60)], 'A', { radiusKm: milesToKm(500), k: 2 }),
    nearbyCleaner(FIX, 'A', { radiusKm: 200, k: 3 }),
    nearbyCleaner(FIX, 'A', { radiusKm: 50, k: 3 }),
    nearbyCleaner([A, E, G], 'A', { radiusKm: 1000, k: 3 }),
    nearbyCleaner([A, D], 'A', { radiusKm: 1000 }),
  ]
  for (const res of cases) {
    const s = describeNearby(res)
    assert.ok(s.length <= 180, `${s.length} chars: ${s}`)
    // At most two: the finding, and at most one caveat about flagged data.
    assert.ok(s.split('. ').length <= 2, s)
  }
})

test('defaults: 500 km, k 3, 300 MW; bad options fall back', () => {
  const res = nearbyCleaner(FIX, 'A')
  assert.equal(res.radiusKm, 500); assert.equal(res.k, 3); assert.equal(res.loadMW, 300)
  const bad = nearbyCleaner(FIX, 'A', { radiusKm: -1, k: 'x', loadMW: 0 })
  assert.equal(bad.radiusKm, 500); assert.equal(bad.k, 0); assert.equal(bad.loadMW, 300)
  assert.deepEqual(ids(bad), [])
})
