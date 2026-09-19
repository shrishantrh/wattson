#!/usr/bin/env node
// Unit tests for src/lib/insight.js, the "what am I looking at" text. Node ESM, node:test.
//
//   node web/test/insight.test.mjs
//
// The rules the panel depends on: every route kind gets a title and at least one line, no line is
// long enough to grow the card, and no digit is ever printed that the page did not hand in.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { insightFor, insightForRoute, ROUTE_KINDS, MAX_LINE } from '../src/lib/insight.js'

const routeFor = kind => {
  if (kind === 'check') return { page: 'check', ticker: 'GOOGL', params: {} }
  if (kind === 'compare') return { page: 'compare', mw: 300, metros: ['Phoenix', 'Omaha'], params: {} }
  if (kind === 'region') return { page: 'region', id: 'PJM/DOM', params: {} }
  if (kind === 'found') return { page: 'found', params: { s: 'detector' } }
  return { page: kind, params: {} }
}
const digits = s => (String(s).match(/\d+(?:\.\d+)?/g) || [])
const textOf = r => [r.title, ...r.lines, r.hint || '', ...(r.actions || []).map(a => a.label)]

test('every route kind: a title and at least one line', () => {
  for (const kind of ROUTE_KINDS) {
    const r = insightFor(routeFor(kind))
    assert.ok(typeof r.title === 'string' && r.title.trim(), kind)
    assert.ok(Array.isArray(r.lines) && r.lines.length >= 1, kind)
    assert.ok(r.lines.every(l => typeof l === 'string' && l.trim()), kind)
    for (const a of r.actions || []) assert.ok(a.label && a.href, kind)
  }
})

test('no line is longer than the panel allows', () => {
  for (const kind of ROUTE_KINDS) {
    for (const ctx of [{}, { company: 'Alphabet', physicalRange: '31–58%', mw: 300, name: 'Dominion', rank: '6th', inherited: true }]) {
      const r = insightFor(routeFor(kind), ctx)
      for (const line of textOf(r)) assert.ok(line.length <= MAX_LINE, `${kind}: ${line.length} chars: ${line}`)
    }
  }
})

test('no number appears that was not passed in ctx', () => {
  for (const kind of ROUTE_KINDS) {
    const r = insightFor(routeFor(kind))               // nothing given, so nothing numeric may print
    for (const line of textOf(r)) assert.deepEqual(digits(line), [], `${kind}: ${line}`)
  }
})

test('numbers from ctx are interpolated, and only those', () => {
  const ctx = { company: 'Alphabet', physicalRange: '31–58%', mw: 300, name: 'Dominion (PJM/DOM)', rank: '6th' }
  const given = new Set(Object.values(ctx).flatMap(v => digits(v)))
  for (const kind of ROUTE_KINDS) {
    const r = insightFor(routeFor(kind), ctx)
    for (const line of textOf(r)) for (const d of digits(line)) assert.ok(given.has(d), `${kind} invented ${d} in: ${line}`)
  }
  assert.match(insightFor(routeFor('compare'), ctx).lines.join(' '), /300 MW/)
  assert.match(insightFor(routeFor('check'), ctx).lines.join(' '), /31–58%/)
  assert.match(insightFor(routeFor('check'), ctx).title, /Alphabet/)
})

test('each found scene says something different about the globe', () => {
  const seen = new Set()
  for (const s of ['headline', 'night', 'sweep', 'detector']) {
    const r = insightFor({ page: 'found', params: { s } })
    seen.add(r.lines[0])
  }
  assert.equal(seen.size, 4)
})

test('insightForRoute parses a hash the way the router does', () => {
  assert.equal(insightForRoute('#/check/GOOGL?evidence=1', { company: 'Alphabet' }).title, 'Checking Alphabet')
  assert.equal(insightForRoute('#/region/PJM%2FDOM', { name: 'Dominion' }).title, 'Dominion')
  assert.equal(insightForRoute('#/').title, insightFor({ page: 'landing' }).title)
  assert.equal(insightForRoute('').title, insightFor({ page: 'landing' }).title)
  assert.equal(insightForRoute('#/nope/what').lines.length >= 1, true)
  const cmp = insightForRoute('#/compare?mw=300&metros=Phoenix%7COmaha', { mw: 300 })
  assert.match(cmp.lines.join(' '), /shape picker/)
})
