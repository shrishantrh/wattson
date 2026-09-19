#!/usr/bin/env node
// Unit tests for the load-shape arithmetic in src/lib/shape.js. Node ESM, node:test, no JSON.
//
//   node web/test/shape.test.mjs
//
// The two profiles are PJM's clean share by local hour (0..1), copied from the region export:
// 2025 is cleaner by day (solar), 2019 was cleaner at night. Nothing here reads a data file.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SHAPES, FLEX_FRACTION, shapeById, cleanShareFor, bestHours, worstHours, shiftable, compareShapes, fossilMW, describeShape, profileOf, profilesOf, hourWord, hourSpanWords } from '../src/lib/shape.js'

const DAY = [0.373, 0.384, 0.391, 0.396, 0.4, 0.399, 0.395, 0.39, 0.388, 0.401, 0.413, 0.417, 0.418, 0.418, 0.416, 0.414, 0.408, 0.398, 0.388, 0.375, 0.365, 0.36, 0.36, 0.364]
const NIGHT = [0.419, 0.43, 0.437, 0.441, 0.439, 0.43, 0.417, 0.404, 0.394, 0.386, 0.379, 0.375, 0.375, 0.374, 0.375, 0.375, 0.373, 0.371, 0.367, 0.366, 0.366, 0.368, 0.383, 0.401]
const mean = a => a.reduce((s, x) => s + x, 0) / a.length
const sum = a => a.reduce((s, x) => s + x, 0)
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`)

test('shapes: four, unique ids, 24 non-negative weights summing to 1', () => {
  assert.deepEqual(SHAPES.map(s => s.id), ['flat', 'business', 'overnight', 'solar'])
  for (const s of SHAPES) {
    assert.equal(s.weights.length, 24, s.id)
    assert.ok(s.weights.every(w => w >= 0), s.id)
    near(sum(s.weights), 1)
    assert.ok(typeof s.label === 'string' && s.label && typeof s.hint === 'string' && s.hint, s.id)
  }
  const flat = shapeById('flat').weights, biz = shapeById('business').weights, ovn = shapeById('overnight').weights, sol = shapeById('solar').weights
  assert.ok(flat.every(w => Math.abs(w - 1 / 24) < 1e-12))
  near(biz[12] / biz[3], 4)                  // 08:00-18:00 at 1, elsewhere 0.25
  near(biz[7], biz[18]); assert.ok(biz[8] > biz[7] && biz[17] > biz[18])
  near(ovn[23] / ovn[12], 1 / 0.35)          // 22:00-06:00 at 1, elsewhere 0.35
  assert.ok(ovn[5] > ovn[6] && ovn[22] > ovn[21])
  assert.equal(sol.indexOf(Math.max(...sol)), 13)   // bell on 13:00, floor 0.15
  near(sol[13] / sol[0], 1 / 0.15)
  assert.equal(shapeById('nope'), null)
})

test('cleanShareFor: the flat share is the plain mean; weights are normalised', () => {
  near(cleanShareFor(DAY, shapeById('flat').weights), mean(DAY))
  near(cleanShareFor(NIGHT, shapeById('flat').weights), mean(NIGHT))
  near(cleanShareFor(DAY, Array(24).fill(7)), mean(DAY))   // unnormalised weights give the same answer
  const one = Array(24).fill(0); one[12] = 1
  near(cleanShareFor(DAY, one), DAY[12])
})

test('business beats overnight where the grid is cleaner by day, and the reverse at night', () => {
  const biz = shapeById('business').weights, ovn = shapeById('overnight').weights
  assert.ok(cleanShareFor(DAY, biz) > cleanShareFor(DAY, ovn))
  assert.ok(cleanShareFor(NIGHT, ovn) > cleanShareFor(NIGHT, biz))
  assert.ok(cleanShareFor(DAY, biz) > mean(DAY) && cleanShareFor(DAY, ovn) < mean(DAY))
})

test('bestHours / worstHours: the n cleanest and dirtiest hours and their mean', () => {
  const b = bestHours(DAY, 6), w = worstHours(DAY, 6)
  assert.deepEqual(b.hours, [10, 11, 12, 13, 14, 15])
  near(b.mean, mean(b.hours.map(h => DAY[h])))
  assert.deepEqual(w.hours, [0, 19, 20, 21, 22, 23])
  near(w.mean, mean(w.hours.map(h => DAY[h])))
  assert.ok(b.mean > mean(DAY) && w.mean < mean(DAY))
  assert.deepEqual(bestHours(NIGHT, 6).hours, [0, 1, 2, 3, 4, 5])
  assert.deepEqual(bestHours(DAY, 1).hours.length, 1)
  assert.deepEqual(bestHours(DAY, 0), { hours: [], mean: null })
})

test('shiftable: never lowers the share, keeps the energy, respects the 2x cap', () => {
  for (const profile of [DAY, NIGHT]) {
    const top6 = bestHours(profile, 6).mean
    for (const s of SHAPES) {
      const base = cleanShareFor(profile, s.weights)
      let prev = base
      for (const f of [0, 0.05, 0.1, 0.2, 0.5, 1]) {
        const r = shiftable(profile, s.weights, f)
        assert.ok(r.share >= base - 1e-12, `${s.id} f=${f} lowered the share`)
        assert.ok(r.share >= prev - 1e-12, `${s.id} f=${f} not monotone in the fraction`)
        near(sum(r.weights), sum(s.weights))                                   // energy is moved, not made
        assert.ok(r.weights.every((w, h) => w >= -1e-12 && w <= 2 * s.weights[h] + 1e-12), `${s.id} f=${f} broke the 2x cap`)
        assert.ok(r.moved <= f + 1e-12 && r.moved >= 0)
        assert.ok(r.from.every(h => !r.to.includes(h)), 'an hour is both source and destination')
        if (s.id === 'flat') assert.ok(r.share <= top6 + 1e-12, `flat f=${f} beat the best-six mean`)
        prev = r.share
      }
    }
  }
  const none = shiftable(DAY, shapeById('flat').weights, 0)
  near(none.share, mean(DAY)); assert.equal(none.moved, 0); assert.deepEqual(none.from, []); assert.deepEqual(none.to, [])
  const fifth = shiftable(DAY, shapeById('flat').weights, 0.2)
  near(fifth.moved, 0.2)
  assert.ok(fifth.to.every(h => bestHours(DAY, 6).hours.includes(h)), 'a fifth of a flat load lands in the cleanest six hours')
  assert.ok(fifth.share > mean(DAY) && fifth.share < bestHours(DAY, 6).mean)
  const all = shiftable(DAY, shapeById('flat').weights, 1)
  near(all.moved, 0.5)   // the cap: a flat load can at most double its 12 best hours
  const flatProfile = Array(24).fill(0.4)
  const still = shiftable(flatProfile, shapeById('business').weights, 0.2)
  near(still.share, 0.4); assert.equal(still.moved, 0)   // nothing cleaner to move into
})

test('compareShapes: one entry per shape plus flexible20', () => {
  const c = compareShapes(DAY)
  assert.deepEqual(c.shapes.map(s => s.id), SHAPES.map(s => s.id))
  for (const s of c.shapes) { assert.equal(typeof s.label, 'string'); near(s.share, cleanShareFor(DAY, shapeById(s.id).weights)) }
  near(c.flexible20.share, shiftable(DAY, shapeById('flat').weights, FLEX_FRACTION).share)
  assert.ok(c.flexible20.share > c.byId.flat.share)
  assert.equal(typeof c.flexible20.label, 'string')
  assert.ok(['flat', 'business', 'overnight', 'solar', 'flexible20'].includes(c.best))
  assert.equal(c.best, 'solar')
})

test('fossilMW', () => {
  near(fossilMW(300, 0.4), 180)
  near(fossilMW('300', 0.393), 182.1)
  assert.equal(fossilMW(300, null), null)
  assert.equal(fossilMW(null, 0.4), null)
  assert.equal(fossilMW(300, 'x'), null)
})

test('null handling: missing hours are skipped, too few hours give null, nothing throws', () => {
  const flat = shapeById('flat').weights
  assert.equal(cleanShareFor(null, flat), null)
  assert.equal(cleanShareFor(undefined, flat), null)
  assert.equal(cleanShareFor(DAY, null), null)
  assert.equal(cleanShareFor({ 2025: DAY }, flat), null)   // a year map is not a profile
  assert.equal(cleanShareFor(DAY.slice(0, 20), flat), null)
  const holes6 = DAY.map((v, h) => (h % 4 === 0 ? null : v))
  near(cleanShareFor(holes6, flat), mean(holes6.filter(v => v != null)))
  const holes13 = DAY.map((v, h) => (h < 13 ? null : v))
  assert.equal(cleanShareFor(holes13, flat), null)
  assert.deepEqual(bestHours(null), { hours: [], mean: null })
  assert.deepEqual(worstHours(undefined), { hours: [], mean: null })
  assert.ok(!bestHours(holes6, 6).hours.some(h => h % 4 === 0), 'a null hour is never a best hour')
  const r = shiftable(null, flat, 0.2)
  assert.equal(r.share, null); assert.equal(r.moved, 0); assert.deepEqual(r.from, []); assert.deepEqual(r.to, [])
  const rh = shiftable(holes6, flat, 0.2)
  assert.ok(rh.share >= cleanShareFor(holes6, flat) - 1e-12)
  assert.ok(!rh.from.some(h => h % 4 === 0) && !rh.to.some(h => h % 4 === 0), 'a null hour is neither source nor destination')
  const c = compareShapes(null)
  assert.ok(c.shapes.every(s => s.share === null)); assert.equal(c.flexible20.share, null); assert.equal(c.best, null)
  assert.equal(typeof describeShape('Nowhere', null, 300), 'string')
})

test('describeShape: one sentence, names the region, no jargon', () => {
  const s = describeShape('Northern Virginia', DAY, 300)
  assert.equal(typeof s, 'string')
  assert.ok(s.startsWith('In Northern Virginia a flat 300 MW runs on '), s)
  assert.ok(s.endsWith('.'), s)
  assert.ok(/clean power/.test(s) && /a fifth/.test(s) && /cleanest six hours \(10am to 4pm\)/.test(s), s)
  assert.ok(!/profile|weight|null|NaN|undefined/i.test(s), s)
  const n = describeShape('Northern Virginia', NIGHT, 1200)
  assert.ok(n.includes('1,200 MW') && n.includes('midnight to 6am'), n)
  assert.ok(describeShape('Nowhere', null).includes('Nowhere'))
  assert.ok(describeShape(null, DAY).startsWith('Here '))
})

test('profileOf / profilesOf: an array, a year map, a parent, or nothing', () => {
  assert.equal(profileOf(null), null)
  assert.equal(profileOf({}), null)
  assert.equal(profileOf({ profile_24h: DAY }), DAY)
  assert.equal(profileOf({ profile_24h: { 2019: NIGHT, 2025: DAY } }), DAY)
  assert.equal(profileOf({ profile_24h: { 2019: NIGHT, 2025: DAY } }, '2019'), NIGHT)
  assert.equal(profileOf({ profile_24h: { 2019: NIGHT } }), NIGHT)                       // falls back to the latest year present
  assert.equal(profileOf({ type: 'zone', parent: { profile_24h: { 2025: DAY } } }), DAY)
  assert.equal(profileOf({ profile_24h: { 2025: [0.1, 0.2] } }), null)                   // not 24 hours
  assert.deepEqual(profilesOf({ profile_24h: { 2019: NIGHT, 2025: DAY } }), { 2019: NIGHT, 2025: DAY })
  assert.equal(profilesOf({ profile_24h: DAY }), null)
  assert.equal(profilesOf({}), null)
})

test('hour words: 12-hour clock, spans, wrap past midnight', () => {
  assert.equal(hourWord(0), 'midnight'); assert.equal(hourWord(12), 'noon'); assert.equal(hourWord(9), '9am'); assert.equal(hourWord(16), '4pm'); assert.equal(hourWord(24), 'midnight')
  assert.equal(hourSpanWords([10, 11, 12, 13, 14, 15]), '10am to 4pm')
  assert.equal(hourSpanWords([22, 23, 0, 1, 2, 3]), '10pm to 4am')
  assert.equal(hourSpanWords([10, 11, 14, 15]), '10am to noon and 2pm to 4pm')
  assert.equal(hourSpanWords([0, 1, 5, 12, 13, 23]), '11pm to 2am, 5am and noon to 2pm')
  assert.equal(hourSpanWords([7]), '7am')
  assert.equal(hourSpanWords([]), '')
  assert.equal(hourSpanWords(null), '')
  assert.equal(hourSpanWords(Array.from({ length: 24 }, (_, h) => h)), 'all day')
})
