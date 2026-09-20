// Everything the palette can do, as data. buildCommands() turns the static tables plus the
// ranked regions into groups of items; matchGroups() narrows them for a query using cmdk's
// own scorer; askItem() is the free-text fallback that runs parseQuery(). The two dispatchers
// at the bottom are the only DOM this file touches.
import { useEffect, useMemo, useState } from 'react'
import { defaultFilter } from 'cmdk'
import metrosData from '../data/metros.json'
import coords from '../data/region_coords.json'
import { href } from '../router.js'
import { COMPANIES, DEMO_COMPARE, parseQuery, queryHref } from './query.js'
import { loadRegions } from './data.js'

export const GROUP = { company: 'Check a company', compare: 'Compare places', places: 'Places', regions: 'Regions', found: 'What we found', screen: 'Screen', view: 'View', ask: 'Ask' }

// Scenes of the evidence page (Found.jsx) and the screener presets (Screener.jsx). Kept here so
// the palette does not import page modules.
export const SCENES = [['headline', 'The finding'], ['night', 'At night'], ['sweep', 'Day vs night'], ['detector', 'Where load is landing']]
// Satellite irradiance overlay: why the day cleaned up and the night did not.
export const IRRADIANCE = ['irradiance', 'Why the day got clean and the night did not']
export const SCREENS = [['rising', 'New flat load rising'], ['cleanest', 'Cleanest at night'], ['dirtiest', 'Dirtiest at night'], ['worsening', 'Getting worse fastest'], ['improving', 'Improving fastest']]

// View toggles. The shell (console/Console.jsx) and demo mode (demo/DemoMode.jsx) listen for
// window 'wattson:toggle' events with detail.key set to one of these.
export const TOGGLES = [
  { key: 'night', label: 'Toggle night lights', hint: 'day-night line', keywords: ['terminator', 'dark', 'lights', 'sun'] },
  { key: 'demo', label: 'Toggle demo mode', hint: 'd', keywords: ['walkthrough', 'present', 'scenes'] },
]

export const toggleView = key => window.dispatchEvent(new CustomEvent('wattson:toggle', { detail: { key } }))
export const openPalette = (open = true) => window.dispatchEvent(new CustomEvent('wattson:palette', { detail: { open } }))

// Nicknames people type for the big grids; the EIA codes and long names are on the region rows.
const BA_ALIASES = { ERCO: ['ercot', 'texas'], PJM: ['pjm'], MISO: ['miso', 'midcontinent'], SWPP: ['spp', 'southwest power pool'], CISO: ['caiso', 'california'], NYIS: ['nyiso', 'new york'], ISNE: ['iso-ne', 'isone', 'new england'], BPAT: ['bpa', 'bonneville'], SOCO: ['southern company', 'georgia power'], TVA: ['tennessee valley'], DUK: ['duke'], CPLE: ['duke progress'], AZPS: ['aps', 'arizona public service'], SRP: ['salt river project'], NEVP: ['nv energy'], PACE: ['pacificorp', 'rocky mountain power'], PACW: ['pacificorp', 'pacific power'], PSCO: ['xcel'], LDWP: ['ladwp'], WACM: ['wapa'], FPL: ['florida power light', 'nextera'] }
const rankOf = r => r?.detection?.rank ?? r?.rank ?? Infinity
const patternOf = r => r?.detection?.pattern ?? r?.pattern ?? ''
const flaggedOf = r => !!(r?.data_flagged ?? r?.detection?.data_flagged)
const labelOf = r => coords.regions[r.id]?.label || r.c?.label || r.name || r.id
const words = s => String(s || '').split(/[\s,()/]+/).filter(w => w.length > 1)
const shortMetro = m => m.metro.replace(/,\s*[A-Z]{2}$/, '')

export function buildCommands({ regions = [] } = {}) {
  const ranked = regions.filter(r => r && r.id).slice().sort((a, b) => rankOf(a) - rankOf(b))
  const groups = []

  // Every operator the engine holds, the four with documents first. The hint says what we
  // have on each one, so an operator with sites and no claims is visibly different from a
  // verified one before you open it -- and from one we could not map at all.
  const RANK = { sites_and_claims: 0, sites_only: 1, no_site_resolved: 2 }
  const coverageHint = c => (c.coverage_status === 'sites_and_claims'
    ? `${c.ticker} · ${c.n_claims} claim${c.n_claims === 1 ? '' : 's'} checked`
    : c.coverage_status === 'no_site_resolved'
      ? `${c.ticker || 'private'} · no site we could map`
      : `${c.ticker || 'no listed equity'} · ${c.n_sites} site${c.n_sites === 1 ? '' : 's'}, no documents read`)
  const companies = [...COMPANIES].sort((a, b) => (RANK[a.coverage_status] ?? 3) - (RANK[b.coverage_status] ?? 3))
  groups.push({ id: 'company', label: GROUP.company, items: companies.map(c => ({
    id: `check:${c.key}`, group: GROUP.company, label: c.name, hint: coverageHint(c), mono: true,
    keywords: [...c.aliases, c.key, c.ticker, ...(c.grids || []), 'company', 'operator', 'claims', 'clean', '100%',
      ...(c.coverage_status === 'sites_and_claims' ? ['verified'] : ['unverified', 'neocloud'])].filter(Boolean),
    href: href.check(c.key),
  })) })

  const preset = (mw, metros, label, hint, extra = []) => ({
    id: `compare:${mw}:${metros.join('|')}`, group: GROUP.compare, label, hint, mono: false,
    keywords: [...metros, 'compare', 'site', 'siting', 'datacenter', `${mw}`, 'mw', ...extra], href: href.compare({ mw, metros }),
  })
  const presets = [
    preset(DEMO_COMPARE.mw, DEMO_COMPARE.metros, `${DEMO_COMPARE.mw} MW: ${DEMO_COMPARE.metros.join(' vs ')}`, 'the demo comparison'),
    preset(300, ['Dallas', 'Columbus', 'Hillsboro'], '300 MW: Dallas vs Columbus vs Hillsboro', 'three metros new load is landing in'),
  ]
  // Top five by detector rank that map to a metro we have hand-mapped. Data-flagged regions
  // (WACM) are skipped: their demand rise is unexplained, so they do not belong in a preset
  // that names where load is landing. Skipped entirely until the regions have loaded.
  const seen = new Set(), five = []
  for (const r of ranked) {
    if (five.length === 5) break
    if (flaggedOf(r) || seen.has(r.id)) continue
    const m = metrosData.metros.find(x => x.region_id === r.id)
    if (!m) continue
    seen.add(r.id); five.push({ metro: m.metro, label: labelOf(r) })
  }
  if (five.length === 5) presets.push(preset(500, five.map(x => x.metro), '500 MW: the five places new load is landing', five.map(x => x.label).join(' · '), five.map(x => x.label)))
  groups.push({ id: 'compare', label: GROUP.compare, items: presets })

  groups.push({ id: 'places', label: GROUP.places, items: metrosData.metros.map(m => ({
    id: `metro:${m.metro}`, group: GROUP.places, label: m.metro, hint: 'compare 300 MW here', mono: false,
    keywords: [...m.aliases, shortMetro(m), m.serving_utility, m.region_id, m.ba, m.zone].filter(Boolean),
    href: href.compare({ mw: 300, metros: [m.metro] }),
  })) })

  if (ranked.length) groups.push({ id: 'regions', label: GROUP.regions, items: ranked.map(r => {
    const rank = rankOf(r), pattern = patternOf(r), c = coords.regions[r.id] || r.c || {}
    const hint = [Number.isFinite(rank) ? `#${rank}` : null, pattern || null, flaggedOf(r) ? 'flagged' : null].filter(Boolean).join(' · ')
    return { id: `region:${r.id}`, group: GROUP.regions, label: labelOf(r), hint, mono: true,
      keywords: [r.id, r.ba, r.zone, r.name, r.ba_name, pattern, ...(BA_ALIASES[r.ba] || []), ...words(c.place), ...words(c.label)].filter(Boolean), href: href.region(r.id) }
  }) })

  groups.push({ id: 'found', label: GROUP.found, items: [
    ...SCENES.map(([s, label], i) => ({ id: `found:${s}`, group: GROUP.found, label, hint: String(i + 1), mono: true, keywords: [s, 'found', 'evidence', 'finding', 'pjm', 'dominion'], href: href.found(s) })),
    { id: 'method', group: GROUP.found, label: 'Method', hint: 'how the numbers are made', mono: false, keywords: ['method', 'methodology', 'caveats', 'honesty', 'how', 'eia', 'pudl', 'detector'], href: href.method() },
    // The free-text ask is offered the moment you type. This is the door for someone who has
    // typed nothing yet and does not know the box answers questions with a table.
    { id: 'ask:page', group: GROUP.found, label: 'Ask anything', hint: 'type a question, get the numbers', mono: false, keywords: ['ask', 'question', 'compare', 'rank', 'custom', 'chat'], href: href.ask() },
  ] })

  if (typeof href.screen === 'function') groups.push({ id: 'screen', label: GROUP.screen, items: SCREENS.map(([by, label]) => ({
    id: `screen:${by}`, group: GROUP.screen, label, hint: 'screener', mono: false, keywords: [by, 'screen', 'screener', 'table', 'rank', 'sort', 'regions'], href: href.screen(by),
  })) })

  groups.push({ id: 'view', label: GROUP.view, items: TOGGLES.map(t => ({
    id: `toggle:${t.key}`, group: GROUP.view, label: t.label, hint: t.hint, mono: t.key === 'demo', keywords: ['toggle', 'view', t.key, ...t.keywords], action: () => toggleView(t.key),
  })) })

  return groups
}

// Free text. Returns null for an empty query; `unknown` items carry the parser's hint and no href.
export function askItem(query) {
  const q = String(query || '').trim()
  if (!q) return null
  const r = parseQuery(q)
  if (r.kind === 'unknown') return { id: 'ask', group: GROUP.ask, label: `Ask: ${q}`, hint: r.hint, mono: false, unknown: true, keywords: [], composed: looksComposed(q) }
  const hint = r.kind === 'check' ? `check ${r.name || r.ticker}` : `compare ${r.mw} MW: ${r.metros.join(' vs ')}${r.unknown?.length ? ` (skipping ${r.unknown.join(', ')})` : ''}`
  // "compare ERCOT, PJM and CAISO on clean power at night" parses as a siting comparison of
  // PJM alone, with the question itself in the skipped pile. A parse that threw away a phrase
  // is not a parse: those go to the ask layer, which can answer the whole sentence. A single
  // skipped word (a typo, a place we never mapped) still takes the deterministic route.
  const partial = r.kind === 'compare' && (r.unknown || []).some(u => /\s/.test(u))
  return { id: 'ask', group: GROUP.ask, label: `Ask: ${q}`, hint, mono: false, keywords: [], href: queryHref(r), composed: looksComposed(q), partial }
}
// A query with a MW figure or a "vs" list is a composed request; fuzzy hits on presets would
// be misleading there, so the Ask item is offered first even when something else matches.
const looksComposed = q => /\d\s*(mw|gw|megawatt)|\bvs\.?\b|\bversus\b|,|\||;/i.test(q)

const rawScore = (it, q) => defaultFilter(`${it.label} ${it.hint || ''}`, q, it.keywords || [])
// cmdk's scorer handles one word well (prefix and word-boundary hits score 0.89-1.0, scattered
// letters 0.8 or less on this data set) but not phrases: "n virginia" scores 0.79 against
// N. Virginia. So a multi-word query is also scored token by token, every token must hit, and
// the weaker of the two views is discarded.
const score = (it, q) => {
  const whole = rawScore(it, q)
  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length < 2) return whole
  let min = 1
  for (const t of tokens) { const s = rawScore(it, t); if (s < min) min = s; if (!min) break }
  return Math.max(whole, min * 0.98)
}
const MIN_SCORE = 0.85

// Narrow groups for a query. Empty query: the first `emptyLimit` items of every group (0 = none),
// in the fixed group order. Non-empty: up to `limit` per group, best score first, ties in original
// order (regions stay in rank order), and groups ordered by their best hit so the first item in
// the list is the best match overall. Adds `total` per group so the UI can say "5 of 111".
export function matchGroups(groups, query, { limit = 6, emptyLimit = 5 } = {}) {
  const q = String(query || '').trim()
  const out = []
  for (const g of groups) {
    if (!q) { if (emptyLimit > 0 && g.items.length) out.push({ ...g, items: g.items.slice(0, emptyLimit), total: g.items.length }); continue }
    const scored = g.items.map((it, i) => ({ it, s: score(it, q), i })).filter(x => x.s >= MIN_SCORE).sort((a, b) => b.s - a.s || a.i - b.i)
    if (scored.length) out.push({ ...g, items: scored.slice(0, limit).map(x => x.it), total: scored.length, best: scored[0].s })
  }
  if (q) out.sort((a, b) => b.best - a.best)
  return out
}

// Loads the ranked regions once per session and memoises the groups. Shared by every palette
// instance; the fetch is deduplicated and cached at module level.
let regionsCache = null, regionsPromise = null
const fetchRegions = () => {
  if (regionsCache) return Promise.resolve(regionsCache)
  if (!regionsPromise) regionsPromise = loadRegions().then(d => { regionsCache = d.regions || []; return regionsCache }, () => { regionsPromise = null; return [] })
  return regionsPromise
}
export function useCommands() {
  const [regions, setRegions] = useState(regionsCache)
  useEffect(() => { let alive = true; if (!regionsCache) fetchRegions().then(r => { if (alive) setRegions(r) }); return () => { alive = false } }, [])
  const groups = useMemo(() => buildCommands({ regions: regions || [] }), [regions])
  return { groups, loading: regions == null }
}
