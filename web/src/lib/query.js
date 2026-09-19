// The one box. Accepts a company (name or ticker) or a location comparison
// ("300 MW: Phoenix vs Northern Virginia vs Omaha", "300mw in Dallas, Columbus, Portland").
import metros from '../data/metros.json'
import coords from '../data/region_coords.json'
import { href } from '../router.js'

export const COMPANIES = [
  { ticker: 'META', name: 'Meta', aliases: ['meta', 'facebook', 'meta platforms'] },
  { ticker: 'GOOGL', name: 'Google', aliases: ['google', 'alphabet', 'goog'] },
  { ticker: 'MSFT', name: 'Microsoft', aliases: ['microsoft', 'msft', 'azure'] },
  { ticker: 'AMZN', name: 'Amazon', aliases: ['amazon', 'aws', 'amzn'] },
]
export const DEMO_COMPARE = { mw: 300, metros: ['Phoenix', 'Northern Virginia', 'Omaha'] }

const norm = s => s.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim()

export function matchCompany(text) {
  const t = norm(text)
  if (!t) return null
  for (const c of COMPANIES) if (c.aliases.includes(t) || c.ticker.toLowerCase() === t) return c
  if (/^[a-z]{1,5}$/.test(t)) return { ticker: t.toUpperCase(), name: t.toUpperCase(), aliases: [] }
  return null
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
  const id = coords.regions[raw] ? raw : ids.find(i => i.toLowerCase() === t) || ids.find(i => coords.regions[i].label.toLowerCase() === t) || ids.find(i => coords.regions[i].place.toLowerCase().startsWith(t)) || ids.find(i => coords.regions[i].place.toLowerCase().includes(t) && t.length >= 4)
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
    if (c) return { kind: 'check', ticker: c.ticker, name: c.name }
    const m = resolvePlace(parts[0])
    if (m) return { kind: 'compare', mw: 300, metros: [m.metro] }
    return { kind: 'unknown', hint: `Didn't recognise "${parts[0]}". Try Meta, Google, or "300 MW: Phoenix vs Omaha".` }
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
