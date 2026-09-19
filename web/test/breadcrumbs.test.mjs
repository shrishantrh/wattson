#!/usr/bin/env node
// Unit tests for the pure trail derivation in src/components/Breadcrumbs.jsx (useCrumbs).
//
//   node web/test/breadcrumbs.test.mjs        (or: node --test web/test/breadcrumbs.test.mjs)
//
// useCrumbs takes a hash and returns [{ label, href?, icon? }] with no hooks, no DOM and no fetch,
// so it can be called straight from Node. The file is .jsx, so Vite (already a dev dependency)
// compiles it for us; nothing here starts a server or touches the network.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..')
let server, useCrumbs

before(async () => {
  server = await createServer({ root: WEB, configFile: join(WEB, 'vite.config.js'), server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  ;({ useCrumbs } = await server.ssrLoadModule('/src/components/Breadcrumbs.jsx'))
})
after(async () => { await server?.close() })

const labels = hash => useCrumbs(hash).map(c => c.label)

// Every segment but the last links somewhere; the last is where you are.
function assertShape(hash) {
  const trail = useCrumbs(hash)
  trail.forEach((c, i) => {
    assert.equal(typeof c.label, 'string', `${hash}: segment ${i} has a label`)
    assert.ok(c.label.length > 0, `${hash}: segment ${i} label is not empty`)
    assert.equal(typeof c.icon, 'function', `${hash}: segment ${i} carries an icon`)
    if (i < trail.length - 1) assert.ok(c.href, `${hash}: segment ${i} ("${c.label}") is a link`)
    else assert.equal(c.href, undefined, `${hash}: the last segment ("${c.label}") is plain text`)
  })
  return trail
}

test('landing renders nothing', () => {
  assert.deepEqual(useCrumbs('#/'), [])
  assert.deepEqual(useCrumbs('#'), [])
  assert.deepEqual(useCrumbs(''), [])
})

test('a company check: Home / Companies / the company', () => {
  assert.deepEqual(labels('#/check/GOOGL'), ['Home', 'Companies', 'Google'])
  assert.deepEqual(labels('#/check/META?evidence=1'), ['Home', 'Companies', 'Meta'])
  assert.deepEqual(labels('#/check/ZZZZ'), ['Home', 'Companies', 'ZZZZ'])   // unknown ticker keeps its symbol
  const trail = assertShape('#/check/GOOGL')
  assert.equal(trail[1].href, '#/companies')
})

test('a comparison: Home / Compare places / the load and the count', () => {
  assert.deepEqual(labels('#/compare?mw=300&metros=Phoenix%7CNorthern%20Virginia%7COmaha'), ['Home', 'Compare places', '300 MW, 3 places'])
  assert.deepEqual(labels('#/compare?mw=50&metros=Omaha'), ['Home', 'Compare places', '50 MW, 1 place'])
  assertShape('#/compare?mw=300&metros=Phoenix%7COmaha')
})

test('a zone carries its grid; a balancing authority does not', () => {
  assert.deepEqual(labels('#/region/PJM%2FDOM'), ['Home', 'Places', 'PJM grid', 'N. Virginia'])
  assert.deepEqual(labels('#/region/AZPS'), ['Home', 'Places', 'Phoenix'])
  const trail = assertShape('#/region/PJM%2FDOM')
  assert.equal(trail[2].href, '#/region/PJM')
  assert.deepEqual(labels('#/region/NOPE'), ['Home', 'Places', 'NOPE'])   // unknown id falls back to the id
})

test('what we found: the scene is the last segment', () => {
  assert.deepEqual(labels('#/found?s=sweep'), ['Home', 'What we found', 'Day vs night'])
  assert.deepEqual(labels('#/found?s=detector'), ['Home', 'What we found', 'Where load is landing'])
  assert.deepEqual(labels('#/found'), ['Home', 'What we found'])
  assertShape('#/found?s=sweep')
  assertShape('#/found')
})

test('the screener and the sheets name their tab', () => {
  assert.deepEqual(labels('#/screen'), ['Home', 'Screener'])
  assert.deepEqual(labels('#/screen?by=rising'), ['Home', 'Screener', 'New flat load rising'])
  assert.deepEqual(labels('#/data'), ['Home', 'Data'])
  assert.deepEqual(labels('#/data?t=claims'), ['Home', 'Data', 'Claims'])
  assertShape('#/screen?by=rising')
  assertShape('#/data?t=claims')
})

test('the one-level screens', () => {
  assert.deepEqual(labels('#/explore'), ['Home', 'Explore'])
  assert.deepEqual(labels('#/alerts'), ['Home', 'Alerts'])
  assert.deepEqual(labels('#/companies'), ['Home', 'Companies'])
  assert.deepEqual(labels('#/method'), ['Home', 'Method'])
  for (const h of ['#/explore', '#/alerts', '#/companies', '#/method']) assertShape(h)
})

test('an unknown route degrades to Home alone', () => {
  assert.deepEqual(labels('#/nonsense/deep/path?x=1'), ['Home'])
  const trail = assertShape('#/nonsense')
  assert.equal(trail.length, 1)
  assert.equal(trail[0].href, undefined)
})
