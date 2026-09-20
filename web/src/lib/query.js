// The one box. Accepts a company (name or ticker) or a location comparison
// ("300 MW: Phoenix vs Northern Virginia vs Omaha", "300mw in Dallas, Columbus, Portland").
import metros from '../data/metros.json'
import coords from '../data/region_coords.json'
import index from '../data/companies_index.json'
import { href } from '../router.js'

// EVERY operator the engine wrote, not a hand-kept list of four. Generated from
// claims/companies.json by web/scripts/companies_index.mjs, so what the box can find is
// exactly what the API can answer: 4 with documents read, 11 mapped to grids with no
// documents, 1 we could not map at all. Each row carries `key` (what the URL uses),
// `ticker` (null when there is no listed equity), and what we hold on it.
export const COMPANIES = index.companies
export const COMPANY_COUNTS = index.counts
// The four we have read documents from. Used where a short list is wanted.
export const VERIFIED = COMPANIES.filter(c => c.coverage_status === 'sites_and_claims')
export const companyByKey = k => COMPANIES.find(c => c.key === String(k || '').toUpperCase()
  || (c.ticker || '').toUpperCase() === String(k || '').toUpperCase()) || null
export const DEMO_COMPARE = { mw: 300, metros: ['Phoenix', 'Northern Virginia', 'Omaha'] }

const norm = s => s.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim()

// An operator we actually hold something on. Never a guess.
export function matchCompany(text) {
  const t = norm(text)
  if (!t) return null
  for (const c of COMPANIES) {
    if (c.aliases.includes(t) || c.key.toLowerCase() === t || (c.ticker || '').toLowerCase() === t) return c
  }
  return null
}

// A ticker-shaped string we hold nothing on. Returned so the not-found screen can say
// plainly what we have and what we do not, rather than the box silently refusing.
export function unknownTicker(text) {
  const t = norm(text)
  return /^[a-z]{1,5}$/.test(t) ? { key: t.toUpperCase(), ticker: t.toUpperCase(), name: t.toUpperCase(), aliases: [], unknown: true } : null
}

// Closest operators to a string we hold nothing on, for the not-found screen. Substring
// only: sending someone to the wrong company is worse than admitting we have nothing.
export function nearestCompanies(text, limit = 3) {
  const t = norm(text)
  if (!t) return []
  const hits = []
  for (const c of COMPANIES) {
    const hay = [c.key, c.name, ...c.aliases].map(norm)
    if (hay.some(h => h.startsWith(t) || (t.length >= 3 && h.includes(t)))) hits.push(c)
  }
  return hits.slice(0, limit)
}

export function matchMetro(text) {
  const t = norm(text)
  if (!t) return null
  let best = null
  for (const m of metros.metros) {
    if (m.aliases.some(a => a === t)) return m
    if (!best && m.aliases.some(a => a.startsWith(t) || t.startsWith(a))) best = m
  }
  return best
}

// Any place the app knows: a hand-mapped metro, or one of the 124 regions by label, place name or id.
export function resolvePlace(text) {
  const raw = String(text || '').trim()
  if (!raw) return null
  const m = matchMetro(raw)
  if (m) return { metro: m.metro, region_id: m.region_id, lat: m.lat, lng: m.lng, serving_utility: m.serving_utility, source: 'metro' }
  const t = norm(raw)
  const ids = Object.keys(coords.regions)
  const id = coords.regions[raw] ? raw : ids.find(i => i.toLowerCase() === t) || ids.find(i => norm(coords.regions[i].label) === t) || ids.find(i => norm(coords.regions[i].place).startsWith(t)) || ids.find(i => norm(coords.regions[i].place).includes(t) && t.length >= 4)
  if (!id) return null
  const c = coords.regions[id]
  return { metro: c.label, region_id: id, lat: c.lat, lng: c.lng, serving_utility: null, source: 'region' }
}

export function parseQuery(text) {
  const raw = String(text || '').trim()
  if (!raw) return { kind: 'unknown', hint: 'Try a company, or "300 MW: Phoenix vs Omaha"' }
  const mwMatch = raw.match(/(\d+(?:\.\d+)?)\s*(mw|megawatts?|gw)/i)
  const parts = raw.replace(/(\d+(?:\.\d+)?)\s*(mw|megawatts?|gw)\s*(:|in|at|for|-|—)?/i, '').split(/\s*(?:\bvs\.?\b|\bversus\b|\bor\b|,|\||;|\/|\band\b)\s*/i).map(s => s.trim()).filter(Boolean)
  if (!mwMatch && parts.length === 1) {
    const c = matchCompany(parts[0])
    if (c) return { kind: 'check', ticker: c.key, name: c.name, coverage_status: c.coverage_status }
    // A place beats a ticker-shaped guess: "omaha" and "tulsa" are five letters each, and
    // routing them to a company page nobody has heard of was the old behaviour.
    const m = resolvePlace(parts[0])
    if (m) return { kind: 'compare', mw: 300, metros: [m.metro] }
    const u = unknownTicker(parts[0])
    if (u) return { kind: 'check', ticker: u.key, name: u.name, unknown: true }
    return { kind: 'unknown', hint: `Didn't recognise "${parts[0]}". Try ${VERIFIED.slice(0, 2).map(x => x.name).join(' or ')}, a ticker like IREN, or "300 MW: Phoenix vs Omaha".` }
  }
  let mw = mwMatch ? Number(mwMatch[1]) * (/gw/i.test(mwMatch[2]) ? 1000 : 1) : 300
  const metrosOut = [], unknown = []
  for (const p of parts) { const m = resolvePlace(p); if (m) metrosOut.push(m.metro); else unknown.push(p) }
  if (!metrosOut.length) return { kind: 'unknown', hint: `No known locations in "${raw}". Try "300 MW: Phoenix vs Northern Virginia vs Omaha".` }
  return { kind: 'compare', mw, metros: metrosOut, unknown }
}

export function queryHref(r) {
  if (r.kind === 'check') return href.check(r.ticker)
  if (r.kind === 'compare') return href.compare(r)
  return '#/'
}
