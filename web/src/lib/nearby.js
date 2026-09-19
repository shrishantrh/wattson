// Is there a cleaner grid nearby? Pure arithmetic over the scored-regions list (public/api/regions.json
// with `c: { lat, lng, label, place }` attached by lib/data.js loadRegions()). No React, no JSON imports,
// so test/nearby.test.mjs can load it under node:test.
//
// The question: from one place, which grids within a radius run cleaner at night, and what would each
// change for a flat load of `loadMW`? Distance is the great-circle distance between load centres (a
// zone's metro, a grid's service-territory centre) and stands in for "still in the same market"; it
// says nothing about transmission or land. Zones inherit their grid's generation share, so the pool
// is one entry per grid (id without '/'); only the query itself may be a zone, and it keeps its own
// coordinates. A candidate's fossil MW is load × (1 − share): other and unknown fuels count as not clean.
//
// Flagged: `has_corrections`, a real `data_flags` entry, or an id in meta.data_flags. Every zone carries
// the note "Generation numbers are the parent BA's", which is inheritance, not a data problem, so it
// does not flag. Flagged grids are marked (`excluded`) and never recommended (`candidates`).

const EARTH_RADIUS_KM = 6371.0088
const KM_PER_MILE = 1.609344
const INHERIT_NOTE = /parent BA|zones report demand only/i

export const milesToKm = mi => Number(mi) * KM_PER_MILE
export const kmToMiles = km => Number(km) / KM_PER_MILE

const num = x => (x == null || x === '' ? null : Number.isFinite(Number(x)) ? Number(x) : null)
const n0 = x => (x == null || !Number.isFinite(Number(x)) ? '—' : Math.round(Number(x)).toLocaleString('en-US'))
const pct0 = x => (x == null ? '—' : `${Math.round(x * 100)}%`)
const pct1 = x => (x == null ? '—' : `${(x * 100).toFixed(1)}%`)
// Two shares that round to the same whole percent are shown with one decimal, so "39% against 39%" cannot happen.
const sharePair = (a, b) => (pct0(a) === pct0(b) ? [pct1(a), pct1(b)] : [pct0(a), pct0(b)])

// Great-circle distance in km between { lat, lng } in degrees; null when either point is missing.
export function haversineKm(a, b) {
  const la1 = num(a?.lat), lo1 = num(a?.lng), la2 = num(b?.lat), lo2 = num(b?.lng)
  if (la1 == null || lo1 == null || la2 == null || lo2 == null) return null
  const rad = d => (d * Math.PI) / 180
  const dLat = rad(la2 - la1), dLng = rad(lo2 - lo1)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

// The rows, whether given the array or the { meta, regions } wrapper that loadRegions() returns.
export const regionList = regions => (Array.isArray(regions) ? regions : Array.isArray(regions?.regions) ? regions.regions : [])
const flagMapOf = regions => (regions && !Array.isArray(regions) && regions.meta?.data_flags) || {}

export const coordsOf = r => {
  const c = r?.c
  if (c && num(c.lat) != null && num(c.lng) != null) return { lat: num(c.lat), lng: num(c.lng) }
  if (num(r?.lat) != null && num(r?.lng) != null) return { lat: num(r.lat), lng: num(r.lng) }
  return null
}
export const shareOf = r => { const s = num(r?.siting?.overnight_cf_share_2025) ?? num(r?.cf_share_2025?.overnight); return s == null ? null : Math.min(1, Math.max(0, s)) }
export const labelOf = r => r?.c?.label || r?.name || r?.id || '—'
export const placeOf = r => r?.c?.place || r?.name || r?.ba_name || null
export const gridIdOf = id => String(id || '').split('/')[0]
export const realFlags = r => (Array.isArray(r?.data_flags) ? r.data_flags.filter(f => !INHERIT_NOTE.test(String(f))) : [])
export const isFlagged = (r, flagMap = {}) => !!r?.has_corrections || realFlags(r).length > 0 || Object.prototype.hasOwnProperty.call(flagMap, r?.id)

// MW of a load that is not carbon-free at the grid's overnight share.
export const fossilMW = (loadMW, share) => (share == null || !Number.isFinite(Number(loadMW)) ? null : Number(loadMW) * (1 - share))

const findRegion = (list, id) => list.find(r => r.id === id) || null
// True when the module can say something: the region is in the list with coordinates and a share.
export const canAnswer = (regions, id) => { const r = findRegion(regionList(regions), id); return !!r && !!coordsOf(r) && shareOf(r) != null }

// One entry per grid. The grid-level row when present, else the zone of that grid nearest to `from`
// (the share is the same either way; only the distance differs).
function gridPool(list, fromC) {
  const byGrid = new Map()
  for (const r of list) {
    if (!r?.id || shareOf(r) == null || !coordsOf(r)) continue
    const g = gridIdOf(r.id), isGrid = !r.id.includes('/')
    const cur = byGrid.get(g)
    if (!cur) { byGrid.set(g, r); continue }
    const curIsGrid = !cur.id.includes('/')
    if (isGrid && !curIsGrid) byGrid.set(g, r)
    else if (!isGrid && !curIsGrid && (haversineKm(fromC, coordsOf(r)) ?? Infinity) < (haversineKm(fromC, coordsOf(cur)) ?? Infinity)) byGrid.set(g, r)
  }
  return [...byGrid.values()]
}

const byShareThenDistance = (a, b) => b.share - a.share || a.km - b.km || String(a.id).localeCompare(String(b.id))

// nearbyCleaner(regions, 'PJM/DOM', { radiusKm: 500, k: 3, loadMW: 300 }) ->
//   { from: { id, label, place, share, fossilMW, flagged, flags, zone, grid },
//     candidates: [{ id, label, place, km, miles, share, fossilMW, saving, change_since_2019, slope, rank, flagged, flags }],
//     excluded:   the same shape for cleaner in-range grids whose data is flagged (marked, not recommended),
//     nearest_outside: the nearest unflagged cleaner grid beyond the radius, only when `candidates` is empty,
//     n_cleaner: unflagged cleaner grids in range before the cut to k, radiusKm, radiusMiles, k, loadMW }
export function nearbyCleaner(regions, fromId, { radiusKm = 500, k = 3, loadMW = 300 } = {}) {
  const list = regionList(regions), flagMap = flagMapOf(regions)
  const load = Number(loadMW) > 0 ? Number(loadMW) : 300
  const R = Number(radiusKm) > 0 ? Number(radiusKm) : 500
  const kk = Math.max(0, Math.floor(Number(k))) || 0
  const base = { candidates: [], excluded: [], nearest_outside: null, n_cleaner: 0, radiusKm: R, radiusMiles: kmToMiles(R), k: kk, loadMW: load }
  const src = findRegion(list, fromId)
  if (!src) return { from: null, ...base }
  const fromC = coordsOf(src), fromShare = shareOf(src)
  const from = { id: src.id, label: labelOf(src), place: placeOf(src), share: fromShare, fossilMW: fossilMW(load, fromShare), flagged: isFlagged(src, flagMap), flags: realFlags(src), zone: src.id.includes('/'), grid: gridIdOf(src.id), hasCoords: !!fromC }
  if (!fromC || fromShare == null) return { from, ...base }

  const myGrid = gridIdOf(src.id)
  const rows = gridPool(list, fromC).filter(r => r.id !== src.id && gridIdOf(r.id) !== myGrid).map(r => {
    const share = shareOf(r), km = haversineKm(fromC, coordsOf(r)), f = fossilMW(load, share)
    return { id: r.id, label: labelOf(r), place: placeOf(r), km, miles: kmToMiles(km), share, fossilMW: f, saving: from.fossilMW - f, change_since_2019: num(r.siting?.change_since_2019), slope: num(r.siting?.ratio_slope_per_year), rank: num(r.detection?.rank), flagged: isFlagged(r, flagMap), flags: realFlags(r) }
  }).filter(x => x.km != null && x.share > fromShare)
  const inRange = rows.filter(x => x.km <= R)
  const clean = inRange.filter(x => !x.flagged).sort(byShareThenDistance)
  const excluded = inRange.filter(x => x.flagged).sort(byShareThenDistance)
  const candidates = clean.slice(0, kk)
  const nearest_outside = candidates.length ? null : rows.filter(x => !x.flagged && x.km > R).sort((a, b) => a.km - b.km)[0] || null
  return { from, ...base, candidates, excluded, nearest_outside, n_cleaner: clean.length }
}

// One plain-English sentence for a nearbyCleaner() result. Miles, whole numbers, no jargon.
export function describeNearby(result) {
  const from = result?.from
  if (!from) return 'That place is not in the scored regions, so there is nothing to compare.'
  const R = n0(result.radiusMiles), load = n0(result.loadMW)
  if (!from.hasCoords) return `${from.label} has no load-centre coordinates in the data, so nearby grids cannot be measured.`
  if (from.share == null) return `${from.label} has no overnight clean share in the data, so there is nothing to compare.`
  const best = result.candidates?.[0]
  if (best) {
    const [here, there] = sharePair(from.share, best.share)
    const more = result.n_cleaner > 1 ? ` ${n0(result.n_cleaner)} grids in range are cleaner than ${from.label}${result.n_cleaner > result.candidates.length ? `; the ${n0(result.candidates.length)} cleanest are listed` : ''}.` : ''
    return `Within ${R} miles of ${from.label}, the cleanest grid at night is ${best.label}, ${n0(best.miles)} miles away at ${there} clean against ${here} here; moving a ${load} MW load there would cut its fossil MW from ${n0(from.fossilMW)} to ${n0(best.fossilMW)}.${more}`
  }
  const ex = result.excluded?.[0], out = result.nearest_outside
  const flaggedNote = ex ? ` ${ex.label} (${pct0(ex.share)}, ${n0(ex.miles)} miles) reads cleaner, but its data is flagged, so it is not recommended.` : ''
  if (out) return `No grid within ${R} miles of ${from.label} is cleaner at night than its ${pct0(from.share)}; the nearest that is, ${out.label} at ${pct0(out.share)}, is ${n0(out.miles)} miles away.${flaggedNote}`
  return `No grid within ${R} miles of ${from.label} is cleaner at night than its ${pct0(from.share)}.${flaggedNote}`
}
