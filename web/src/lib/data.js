import { useCallback, useEffect, useState } from 'react'
import coords from '../data/region_coords.json'
import metros from '../data/metros.json'

// Data access, in resolution order:
//   1. VITE_API_BASE set  -> the engine's live endpoints (contracts/api.v1.yaml)
//   2. public/api/**      -> the engine's static export (server --static-export), copied at build
//   3. public/fixtures/*  -> fixtures (Yash's contract fixtures, else the provisional ones)
// Every loader returns the same normalised shape whichever source answered.
const base = import.meta.env.BASE_URL
const api = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

export class NotFound extends Error { constructor(what, available) { super(`${what} is not in the data`); this.name = 'NotFound'; this.available = available || [] } }

async function getJSON(url, init) {
  const res = await fetch(url, init)
  if (res.status === 404) throw new NotFound(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('json')) throw new NotFound(url)   // dev server returns index.html for missing files
  return res.json()
}
const tryEach = async fns => { let last; for (const f of fns) { try { return await f() } catch (e) { last = e; if (e.name !== 'NotFound') throw e } } throw last }
const fixture = name => getJSON(`${base}fixtures/${name}.json`)
const staticExport = path => getJSON(`${base}api/${path}.json`)
export const regionCoords = id => coords.regions[id]
export const metroFor = name => metros.metros.find(m => m.metro === name || m.aliases.includes(String(name || '').toLowerCase()))

// ---------- regions (ranked list) ----------
export async function loadRegions() {
  const raw = await tryEach([
    ...(api ? [() => getJSON(`${api}/api/regions`)] : []), () => staticExport('regions'), () => fixture('regions'),
    async () => { const o = await fixture('opening'); return { meta: { ...o.detector, caveats: o.caveats, data_flags: o.data_flags, national: o.national, pjm: o.pjm, data_snapshot_end: o.data_snapshot_end, baseline_year: o.baseline_year }, regions: o.detector.regions, _provisional: true } },
  ])
  const regions = (raw.regions || []).map(r => ({ ...r, detection: r.detection || { rank: r.rank, score: r.score, pattern: r.pattern, growth_pct: r.growth_pct, overnight_excess: r.overnight_excess, neighbor_divergence: r.neighbor_divergence }, c: coords.regions[r.id] }))
  return { meta: raw.meta || {}, regions, _provisional: raw._provisional }
}

// ---------- the finding (evidence page) ----------
export async function loadOpening() {
  return tryEach([() => fixture('opening'), async () => {
    const [regs, pjm, dom] = await Promise.all([loadRegions(), loadRegion('PJM'), loadRegion('PJM/DOM')])
    const y = (o, k) => ({ 2019: o?.['2019']?.[k], 2025: o?.['2025']?.[k] })
    return { headline: regs.meta.headline, data_snapshot_end: regs.meta.data_snapshot_end, baseline_year: regs.meta.baseline_year || 2019,
      pjm: { overnight_clean_mw: y(pjm.cf_avg_mw, 'overnight'), overnight_total_mw: y(pjm.total_avg_mw, 'overnight'), overnight_cf_share: y(pjm.cf_share, 'overnight'), overnight_net_export_mw: pjm.interchange ? { 2019: pjm.interchange['2019']?.net_export_overnight_mw, 2025: pjm.interchange['2025']?.net_export_overnight_mw } : {}, fuel_delta_overnight_gw: pjm.fuel_delta_overnight_gw, dom_overnight_demand_mw: y(dom.demand, 'overnight_avg_mw'), dom_avg_demand_mw: y(dom.demand, 'avg_mw'), profile_24h: pjm.profile_24h },
      national: regs.meta.national || null, detector: { ...regs.meta, regions: regs.regions.map(r => ({ ...r, ...(r.detection || {}), validation: (regs.meta.validation_named_in_advance || []).includes(r.id), data_flagged: !!(regs.meta.data_flags || {})[r.id] })), new_leads: regs.regions.filter(r => (r.detection?.rank || 99) <= 10 && !(regs.meta.validation_named_in_advance || []).includes(r.id) && !(regs.meta.data_flags || {})[r.id]).map(r => r.id) },
      caveats: regs.meta.caveats, pattern_labels: regs.meta.pattern_labels, data_flags: regs.meta.data_flags }
  }])
}

// ---------- one region ----------
export async function loadRegion(id) {
  const raw = await tryEach([
    ...(api ? [() => getJSON(`${api}/api/region/${encodeURIComponent(id)}`)] : []), () => staticExport(`region/${encodeURIComponent(id)}`),
    async () => { const f = await fixture('region'); if (f.regions) { const r = f.regions[id]; if (!r) throw new NotFound(`Region ${id}`, Object.keys(f.regions)); return { ...r, _provisional: f._provisional } } if (f.region?.id === id) return { ...f.region, meta: f.meta }; throw new NotFound(`Region ${id}`, f.region ? [f.region.id] : []) },
  ])
  const r = raw.region ? { ...raw.region, meta: raw.meta } : raw
  return { ...r, operators_manual: r.operators_manual || r.operators || [], c: coords.regions[id] }
}

// ---------- company ----------
export function normalizeCompany(raw, ticker) {
  let c = raw
  if (raw?.companies && !Array.isArray(raw.companies)) c = raw.companies[ticker]
  else if (Array.isArray(raw?.companies)) c = raw.companies.find(x => x.ticker === ticker)
  if (!c || (c.ticker && c.ticker !== ticker)) throw new NotFound(`Company ${ticker}`, raw?.companies ? (Array.isArray(raw.companies) ? raw.companies.map(x => x.ticker) : Object.keys(raw.companies)) : c?.ticker ? [c.ticker] : [])
  const sites = (c.sites || []).map(s => {
    const zone = s.zone ?? s.pjm_zone ?? null, region_id = s.region_id || (zone ? `${s.ba}/${zone}` : s.ba)
    const m = metroFor(s.metro), rc = coords.regions[region_id] || coords.regions[s.ba]
    return { ...s, zone, region_id, lat: s.lat ?? m?.lat ?? rc?.lat, lng: s.lng ?? m?.lng ?? rc?.lng, grid_label: rc?.label || s.ba }
  })
  const claims = c.claims || []
  const counts = c.verdict_counts || claims.reduce((a, k) => ({ ...a, [k.verdict]: (a[k.verdict] || 0) + 1 }), {})
  return { ...c, sites, claims, verdict_counts: counts, cannot_verify_count: c.cannot_verify_count ?? counts.cannot_verify ?? 0, is_mock: c.is_mock ?? c._mock ?? false, _provisional: raw?._provisional }
}
export async function loadCompany(ticker) {
  const t = String(ticker || '').trim().toUpperCase()
  if (!t) throw new NotFound('An empty ticker')
  const raw = await tryEach([...(api ? [() => getJSON(`${api}/api/company/${encodeURIComponent(t)}`)] : []), () => staticExport(`company/${t}`), () => fixture('company')])
  return normalizeCompany(raw, t)
}

// ---------- siting ----------
const slug = s => String(s).toLowerCase().replace(/northern virginia|n\. virginia/, 'nova').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const argmaxFuel = fd => { if (!fd) return null; let best = null; for (const [f, v] of Object.entries(fd)) if (v != null && f !== 'other' && (best == null || v > best.gw)) best = { fuel: f, gw: v }; return best }
export function normalizeSite(raw, request) {
  const list = raw.candidates || raw.results || []
  const req = { mw: raw.request?.mw ?? request?.mw ?? 300, metros: raw.request?.metros || raw.request?.candidates || request?.metros || [], flat: raw.request?.flat_247 ?? raw.request?.flat_24_7 ?? true }
  const candidates = list.map((r, i) => {
    const comp = r.components || {}, sit = r.siting || {}
    const region_id = r.region_id || r.id, rc = coords.regions[region_id], m = metroFor(r.metro)
    const siting = { overnight_cf_share_2025: sit.overnight_cf_share_2025 ?? comp.level_overnight_cf_share_2025 ?? null, ratio_slope_per_year: sit.ratio_slope_per_year ?? comp.direction_ratio_slope_per_year ?? null, overnight_clean_mw_over_demand: sit.overnight_clean_mw_over_demand ?? comp.headroom_overnight_clean_mw_over_demand ?? null, change_since_2019: sit.change_since_2019 ?? comp.change_since_2019 ?? null, siting_score: sit.siting_score ?? r.siting_score ?? null, siting_rank: sit.siting_rank ?? r.siting_rank ?? null, n_ranked: sit.n_ranked ?? 52 }
    const op = r.operator || (r.operators && r.operators[0]) || null
    return { rank: r.verdict_rank ?? r.rank ?? i + 1, metro: r.metro, region_id, ba: r.ba || region_id.split('/')[0], zone: r.zone || (region_id.includes('/') ? region_id.split('/')[1] : null), name: r.name || rc?.place, serving_utility: r.serving_utility || op?.utility || r.name, operator: op ? { utility: op.utility, parent: op.parent, ticker: op.ticker } : null, siting, detector: r.detector || null, filled_by: r.fuel_that_filled_growth ? { fuel: r.fuel_that_filled_growth.fuel, gw: r.fuel_that_filled_growth.gw } : r.last_growth_filled_by ? { fuel: r.last_growth_filled_by.fuel, gw: r.last_growth_filled_by.delta_gw } : argmaxFuel(r.fuel_delta_overnight_gw), fuel_delta_overnight_gw: r.fuel_delta_overnight_gw || null, demand: r.demand || null, cf_inherited_from_ba: r.cf_inherited_from_ba, data_flags: r.data_flags || [], lat: r.lat ?? m?.lat ?? rc?.lat, lng: r.lng ?? m?.lng ?? rc?.lng, grid_label: rc?.label || region_id }
  }).sort((a, b) => a.rank - b.rank)
  return { request: req, candidates, method: raw.method || raw.ranking_key || 'Ranked on clean share at night, whether it is improving, and clean power relative to demand.', unmapped: raw.unmapped_metros || [], caveats: raw.caveats || [], _provisional: raw._provisional }
}
const sameRequest = (a, b) => a && b && Number(a.mw) === Number(b.mw) && a.metros.length === b.metros.length && a.metros.every(m => b.metros.some(x => metroFor(x)?.metro === metroFor(m)?.metro || slug(x) === slug(m)))
export async function loadSite(request) {
  const req = { mw: Number(request?.mw) || 300, metros: request?.metros || [], flat_247: true }
  if (api) return normalizeSite(await getJSON(`${api}/api/site`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req) }), req)
  const raw = await tryEach([() => staticExport(`site/${req.mw}mw-${req.metros.map(slug).join('-')}`), () => fixture('site')])
  const norm = normalizeSite(raw, req)
  if (sameRequest(req, norm.request) || !req.metros.length) return norm
  // Different request than the baked answer: rank client-side from the regions list, same frozen score.
  const regs = await loadRegions()
  const unmapped = [], cands = []
  for (const name of req.metros) {
    const m = metroFor(name); const r = m && regs.regions.find(x => x.id === m.region_id)
    if (!m || !r) { unmapped.push(name); continue }
    let detail = null; try { detail = await loadRegion(m.region_id) } catch { /* no detail in this source */ }
    const gen = detail && detail.type === 'zone' && detail.parent ? detail.parent : detail
    cands.push({ metro: m.metro, region_id: m.region_id, siting: r.siting || gen?.siting, detector: r.detection, operator: r.operator || (detail?.operators_manual || [])[0] || null, name: m.serving_utility, fuel_delta_overnight_gw: gen?.fuel_delta_overnight_gw, demand: detail?.demand?.['2025'] || null, cf_inherited_from_ba: r.cf_inherited_from_ba, data_flags: r.data_flags || [], lat: m.lat, lng: m.lng })
  }
  cands.sort((a, b) => (b.siting?.siting_score ?? -1) - (a.siting?.siting_score ?? -1)).forEach((c, i) => { c.rank = i + 1 })
  return normalizeSite({ request: req, candidates: cands, method: norm.method, unmapped_metros: unmapped, caveats: norm.caveats, _provisional: true, _computed_client_side: true }, req)
}

export async function loadAlerts() {
  return tryEach([...(api ? [() => getJSON(`${api}/api/alerts`)] : []), () => staticExport('alerts'), () => fixture('alerts')])
}

// Tiny async hook: { loading, error, data, reload }.
export function useAsync(fn, deps = []) {
  const [s, setS] = useState({ loading: true, error: null, data: null })
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick(t => t + 1), [])
  useEffect(() => {
    let alive = true
    setS(p => ({ ...p, loading: true, error: null }))
    Promise.resolve().then(fn).then(data => alive && setS({ loading: false, error: null, data }), error => alive && setS({ loading: false, error, data: null }))
    return () => { alive = false }
  }, [...deps, tick])   // eslint-disable-line react-hooks/exhaustive-deps
  return { ...s, reload }
}
