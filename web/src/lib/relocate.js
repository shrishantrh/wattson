// Move one site to another grid and watch the company's physical figure move.
//
// A company's "walk" figure is the unweighted mean, across its mapped sites, of the all-hours 2025
// carbon-free share of generation within each site's grid (a zone inherits its parent BA's
// generation). Nothing here touches the claim: the point of the exercise is that the claim is
// accounting while the physics is where you build. All shares are 0-1 fractions. Pure, null-safe.
//
// `regionsById` is a Map or an object keyed by region id (see indexRegions), or the plain array
// from loadRegions().regions. Region rows carry cf_share_2025 { all, overnight, daytime },
// siting.overnight_cf_share_2025 and, from lib/data.js, c: { label }.

export const MIN_DEMAND_MW = 500

const num = x => (x == null || x === '' || Number.isNaN(Number(x)) ? null : Number(x))
const isObj = x => x != null && typeof x === 'object' && !Array.isArray(x)

export function indexRegions(regions) { const out = {}; for (const r of regions || []) if (r?.id) out[r.id] = r; return out }
const lookup = (regionsById, id) => {
  if (!id || regionsById == null) return null
  if (regionsById instanceof Map) return regionsById.get(id) || null
  if (Array.isArray(regionsById)) return regionsById.find(r => r?.id === id) || null
  return isObj(regionsById) && Object.hasOwn(regionsById, id) && isObj(regionsById[id]) ? regionsById[id] : null
}
const entries = regionsById => {
  if (regionsById == null) return []
  if (regionsById instanceof Map) return [...regionsById.entries()]
  if (Array.isArray(regionsById)) return regionsById.filter(r => r?.id).map(r => [r.id, r])
  return isObj(regionsById) ? Object.entries(regionsById) : []
}

// The all-hours 2025 clean share of a region row; the overnight siting share when `all` is absent.
export const regionShare = r => num(r?.cf_share_2025?.all) ?? num(r?.siting?.overnight_cf_share_2025) ?? null
export const regionLabel = (r, id) => r?.c?.label || r?.label || r?.id || id || null
// Average demand in MW from whichever field a source carries; null when it carries none.
const demandMW = r => num(r?.demand_avg_mw) ?? num(r?.avg_demand_mw) ?? num(r?.avg_mw) ?? num(r?.demand?.['2025']?.avg_mw) ?? num(r?.demand?.avg_mw) ?? null
const tooSmall = r => { const d = demandMW(r); return d != null && d < MIN_DEMAND_MW }
const baOf = id => String(id || '').split('/')[0]

// The ids a site could be filed under, most specific first: its region_id, "BA/zone" (a zone that
// already reads "BA/zone" is kept as is), then the BA alone.
export function siteRegionIds(site) {
  if (!isObj(site)) return []
  const zone = site.zone ?? site.pjm_zone ?? null
  const ids = [site.region_id, zone ? (String(zone).includes('/') ? zone : `${site.ba}/${zone}`) : null, site.ba]
  return [...new Set(ids.filter(Boolean).map(String))]
}
export const siteRegionId = site => siteRegionIds(site)[0] || null
export function siteRegion(site, regionsById) {
  for (const id of siteRegionIds(site)) { const r = lookup(regionsById, id); if (r) return r }
  return null
}
// True when a site already draws from this region, or from the BA whose generation it reports.
const sameGrid = (site, id, regionsById) => {
  const r = siteRegion(site, regionsById)
  const own = r?.id || siteRegionId(site)
  return own != null && (own === id || baOf(own) === baOf(id))
}

// The all-hours 2025 clean share of the grid under a site. The site's own cf_share_2025 (the
// engine's figure for the same grid) is used only when the grid is not in the regions list.
export function siteShare(site, regionsById) {
  return regionShare(siteRegion(site, regionsById)) ?? num(site?.cf_share_2025) ?? null
}

const stats = shares => {
  const xs = (shares || []).filter(x => x != null)
  if (!xs.length) return { min: null, max: null, mean: null, n: 0 }
  return { min: Math.min(...xs), max: Math.max(...xs), mean: xs.reduce((a, b) => a + b, 0) / xs.length, n: xs.length }
}

// { min, max, mean, n } over the sites whose grid has a figure.
export function companyPhysical(sites, regionsById) {
  return stats((Array.isArray(sites) ? sites : []).map(s => siteShare(s, regionsById)))
}

// Move sites[fromIndex] to toRegionId. Null when the site or the destination is unknown.
//   { before: { min, max, mean, n }, after: { ... }, moved: { from, to, fromShare, toShare, fromRegionId, toRegionId } }
export function relocate(sites, fromIndex, toRegionId, regionsById) {
  const list = Array.isArray(sites) ? sites : []
  const i = Number(fromIndex)
  const site = Number.isInteger(i) && i >= 0 && i < list.length ? list[i] : null
  const dest = lookup(regionsById, toRegionId)
  const toShare = regionShare(dest)
  if (!site || toShare == null) return null
  const shares = list.map(s => siteShare(s, regionsById))
  const fromRegion = siteRegion(site, regionsById)
  return {
    before: stats(shares),
    after: stats(shares.map((s, j) => (j === i ? toShare : s))),
    moved: { from: regionLabel(fromRegion, site.grid_label || siteRegionId(site)), to: regionLabel(dest, toRegionId), fromShare: shares[i], toShare, fromRegionId: fromRegion?.id || siteRegionId(site), toRegionId: dest.id || toRegionId },
  }
}

// The k single-site moves that raise the company's physical mean most, as { siteIndex, toRegionId,
// meanAfter }, best first. One move per grid: a zone and its parent BA report the same generation,
// and three suggestions should read as three places. Only moves that raise the mean count, and a
// grid under 500 MW average demand is skipped when the source carries demand (the regions export
// already excludes them). opts.siteIndex restricts the search to one site.
export function bestMoves(sites, regionsById, k = 3, opts = {}) {
  const list = Array.isArray(sites) ? sites : []
  const shares = list.map(s => siteShare(s, regionsById))
  const before = stats(shares)
  if (!before.n || !(k > 0)) return []
  const only = opts.siteIndex == null ? null : Number(opts.siteIndex)
  const idxs = only == null ? list.map((_, i) => i) : Number.isInteger(only) && only >= 0 && only < list.length ? [only] : []
  const moves = []
  for (const [id, r] of entries(regionsById)) {
    const to = regionShare(r)
    if (to == null || tooSmall(r)) continue
    for (const i of idxs) {
      if (sameGrid(list[i], id, regionsById)) continue
      const after = stats(shares.map((s, j) => (j === i ? to : s)))
      if (after.mean > before.mean + 1e-12) moves.push({ siteIndex: i, toRegionId: id, meanAfter: after.mean })
    }
  }
  moves.sort((a, b) => b.meanAfter - a.meanAfter || a.siteIndex - b.siteIndex || String(a.toRegionId).localeCompare(String(b.toRegionId)))
  const out = [], seen = new Set()
  for (const m of moves) {
    const ba = baOf(m.toRegionId)
    if (seen.has(ba)) continue
    seen.add(ba); out.push(m)
    if (out.length >= k) break
  }
  return out
}
