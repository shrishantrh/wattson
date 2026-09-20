// The accounting ladder. Pure: no React, no JSON, no DOM; test/innovLadder.test.mjs imports this under Node.
//
// One number, the carbon-free share, read under successively stricter accounting. Each rung removes one
// convention and the label says which, so a sceptical reader can see exactly where 100% becomes 0.7%.
//
//   company   claimed (annual, market-based, p. N)  ->  the company's own hourly figure (p. M, or an explicit
//             cannot-verify when it discloses none)  ->  the grid at its mapped sites, all hours, contracted
//             power excluded  ->  the same between midnight and 6am  ->  the share of the generation added
//             at night since 2019 that was clean (average vs increment).
//   region    the same ladder without the paper rungs.
//
// Each ladder also carries one short lead sentence. It is deliberately not a summary of the rungs: every
// figure, basis and source is drawn beside its own rung, so the lead carries only what the rungs cannot --
// the shape of the finding, the page citations that make a paper claim checkable, the grids behind the
// physical rungs, and any caveat the rungs can only abbreviate.
//
// Honesty rules baked in: generation within the footprint, not consumption; average mix; contracted power
// excluded; a zone inherits its grid's generation figures; a corrected or flagged number says so; "consistent
// with", never "caused by"; "true on paper", never "lied". The increment is a six-year difference of averages,
// not a marginal emissions factor, and it is unreadable (said so) when the footprint's generation did not grow.

const CLEAN = ['nuclear', 'hydro', 'wind', 'solar', 'geothermal']
const FOSSIL = ['gas', 'coal', 'oil']
const FUELS = [...CLEAN, ...FOSSIL, 'other']
const MIN_GROWTH = 0.02   // the increment is read only when overnight generation grew by at least 2% of its 2019 level

const num = x => (typeof x === 'number' && Number.isFinite(x) ? x : x != null && x !== '' && Number.isFinite(Number(x)) ? Number(x) : null)
const isObj = x => x != null && typeof x === 'object' && !Array.isArray(x)
const sum = a => a.reduce((s, x) => s + x, 0)
const clamp01 = x => (x == null ? null : Math.min(1, Math.max(0, x)))

// ---- words for numbers ----------------------------------------------------------------------
// Whole percents, one decimal under 10% so 5.6% and 0.7% are not rounded into 6% and 1%.
export const fmtShare = x => { const v = num(x); if (v == null) return '—'; const p = Math.max(0, v) * 100; return p > 0 && p < 10 ? `${p.toFixed(1)}%` : `${Math.round(p)}%` }
// "46–75%": one percent sign, the app's convention for a range across sites.
export const fmtRange = (lo, hi) => { const a = num(lo), b = num(hi); if (a == null && b == null) return '—'; if (a == null || b == null) return fmtShare(a ?? b); return fmtShare(a) === fmtShare(b) ? fmtShare(a) : `${fmtShare(a).replace('%', '')}–${fmtShare(b)}` }
// A change in a share, in points: "−35 pts", "−4.9 pts".
export const fmtPts = d => { const v = num(d); if (v == null) return '—'; const p = Math.abs(v) * 100; const s = p < 10 ? p.toFixed(1) : String(Math.round(p)); return `${v < 0 ? '−' : v > 0 ? '+' : ''}${s} pts` }
export const fmtGw = gw => { const v = num(gw); return v == null ? '—' : `${Math.abs(v).toFixed(1)} GW` }
export const fmtSignedGw = gw => { const v = num(gw); if (v == null) return '—'; const r = Math.round(v * 10) / 10; return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toFixed(1)} GW` }
const listWords = a => (a.length <= 2 ? a.join(' and ') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`)

// ---- the increment: what share of the generation added at night since 2019 was clean ------------
// Deltas come from fuel_delta_overnight_gw (GW, 2019 -> 2025); when that is absent they are derived from
// overnight_fuel_mw. total is the sum over every fuel including other/unknown, the same denominator as
// the index. share = clean / total, raw: below zero when clean output fell while total rose.
export function incrementOf(detail, { baseline = '2019', year = '2025' } = {}) {
  const out = { total_gw: null, clean_gw: null, fossil_gw: null, gas_gw: null, coal_gw: null, base_gw: null, share: null, readable: false, reason: 'no fuel breakdown', top: null }
  const g = detail && detail.type === 'zone' && isObj(detail.parent) ? detail.parent : detail
  if (!g) return out
  let deltas = null
  if (isObj(g.fuel_delta_overnight_gw) && Object.values(g.fuel_delta_overnight_gw).some(v => num(v) != null)) {
    deltas = Object.fromEntries(FUELS.map(f => [f, num(g.fuel_delta_overnight_gw[f])]).filter(([, v]) => v != null))
  } else if (isObj(g.overnight_fuel_mw) && isObj(g.overnight_fuel_mw[baseline]) && isObj(g.overnight_fuel_mw[year])) {
    deltas = {}
    for (const f of FUELS) { const a = num(g.overnight_fuel_mw[baseline][f]), b = num(g.overnight_fuel_mw[year][f]); if (a != null || b != null) deltas[f] = ((b ?? 0) - (a ?? 0)) / 1000 }
  }
  if (!deltas || !Object.keys(deltas).length) return out
  const pick = fs => sum(fs.map(f => deltas[f] ?? 0))
  out.total_gw = pick(FUELS); out.clean_gw = pick(CLEAN); out.fossil_gw = pick(FOSSIL)
  out.gas_gw = deltas.gas ?? null; out.coal_gw = deltas.coal ?? null
  const base = num(g.total_avg_mw?.[baseline]?.overnight)
  out.base_gw = base == null ? null : base / 1000
  // The fuel that moved most in the direction of the total: the one that "filled" the growth.
  const dir = out.total_gw >= 0 ? 1 : -1
  const cands = Object.entries(deltas).filter(([f, v]) => f !== 'other' && v * dir > 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  out.top = cands.length ? { fuel: cands[0][0], gw: cands[0][1] } : null
  if (out.total_gw <= 0) { out.reason = out.total_gw < -0.05 ? 'fell' : 'did not grow'; return out }
  if (out.base_gw != null && out.total_gw < MIN_GROWTH * out.base_gw) { out.reason = 'did not grow'; return out }
  out.share = out.clean_gw / out.total_gw
  out.readable = true; out.reason = null
  return out
}

// ---- one grid's facts, from a region detail -----------------------------------------------------
// Zones carry the parent's generation figures (cf_inherited_from_ba); a fixture may carry `parent` instead.
export function gridFacts(detail, { year = '2025', baseline = '2019', caveat = null } = {}) {
  if (!detail) return null
  const g = detail.type === 'zone' && isObj(detail.parent) ? detail.parent : detail
  const cf = isObj(g.cf_share) ? g.cf_share : null
  const cur = cf?.[year], base = cf?.[baseline]
  if (!isObj(cur) || (num(cur.all) == null && num(cur.overnight) == null)) return null
  const corr = (g.corrections?.corrections || []).find(x => x.path === `cf_share.${baseline}`)
  const d = detail.demand || {}
  const d0 = num(d[baseline]?.overnight_avg_mw), d1 = num(d[year]?.overnight_avg_mw)
  const flags = (detail.data_flags || []).filter(f => typeof f === 'string' && !/parent BA/i.test(f))
  return {
    id: detail.id || g.id || null, ba: detail.ba || g.ba || g.id || null, zone: detail.type === 'zone',
    label: detail.c?.label || detail.name || detail.id || null, inherited: !!detail.cf_inherited_from_ba || (detail.type === 'zone' && isObj(detail.parent)),
    all: num(cur.all), overnight: num(cur.overnight), daytime: num(cur.daytime),
    overnight_baseline: num(corr?.corrected?.overnight) ?? num(base?.overnight), corrected: !!corr,
    demand_delta_gw: d0 != null && d1 != null ? (d1 - d0) / 1000 : null,
    increment: incrementOf(detail, { baseline, year }),
    flags: [...(caveat ? [caveat] : []), ...flags],
  }
}

// ---- company: the claim and what the company itself discloses hourly ------------------------------
export function primaryClaim(company) {
  const claims = company?.claims || []
  const frac = k => num(k.magnitude) != null && (k.unit === 'fraction' || (num(k.magnitude) >= 0 && num(k.magnitude) <= 1))
  return claims.find(k => frac(k) && ['true_on_paper', 'contradicted'].includes(k.verdict)) || claims.find(frac) || null
}
// A numeric series any claim's evidence carries whose label reads as an hourly / CFE figure: the latest year.
export function disclosedHourly(company) {
  let best = null
  for (const k of company?.claims || []) for (const e of k.evidence || []) {
    const vals = Array.isArray(e.values) ? e.values : Array.isArray(e.series) ? e.series : null
    if (!vals || vals.length < 1 || !vals.every(v => num(v) != null)) continue
    const text = `${e.label || ''} ${e.note || ''}`
    if (!/hourly|cfe|carbon-free|24\/7/i.test(text)) continue
    const years = Array.isArray(e.years) && e.years.length === vals.length ? e.years : null
    let i = vals.length - 1
    if (years) { let y = -Infinity; years.forEach((yr, j) => { if (num(yr) != null && num(yr) > y) { y = num(yr); i = j } }) }
    const raw = num(vals[i]), share = raw > 1 ? raw / 100 : raw
    const cand = { share, year: years ? num(years[i]) : num(e.year) ?? null, page: e.page ?? null, source_doc: e.source_doc || k.source_doc || null, label: e.label || 'hourly figure', claim_id: k.claim_id }
    if (!best || (cand.year ?? 0) > (best.year ?? 0)) best = cand
  }
  return best
}
const basisWords = k => [k?.timeframe, k?.scope].filter(Boolean).map(s => String(s).replace(/_/g, '-')).join(', ') || 'as stated'
const metricWord = k => (k?.metric === 'renewable_electricity_share' ? ' renewable' : /carbon/i.test(k?.metric || '') ? ' carbon-free' : '')
const shortDoc = s => (s ? String(s).replace(/\.(pdf|htm|html)$/i, '') : '')

const stat = (vals) => { const v = vals.filter(x => num(x) != null); return v.length ? { lo: Math.min(...v), hi: Math.max(...v), mean: sum(v) / v.length, n: v.length } : null }
const rung = (id, label, basis, s, extra = {}) => ({ id, label, basis, share: s?.mean ?? null, lo: s?.lo ?? null, hi: s?.hi ?? null, status: s ? 'ok' : 'missing', drop: null, source: '', ...extra })
// Points from the previous rung that had a number; the paper-to-physical step is the one that matters most.
function withDrops(rungs) {
  let prev = null
  for (const r of rungs) { if (r.share == null) continue; r.drop = prev == null ? null : r.share - prev; prev = r.share }
  return rungs
}
// Why a footprint's increment is unreadable, in the fewest words that still name the reason.
const whyUnreadable = inc => (inc.reason === 'fell' ? 'fell since 2019' : inc.reason === 'did not grow' ? 'did not grow since 2019' : 'has no fuel breakdown')
// A site's region id, the way lib/data.js normalises it: a zone may already be the full "BA/ZONE" id.
const siteRegionId = s => s.region_id || (s.zone ? (String(s.zone).includes('/') ? String(s.zone) : `${s.ba}/${s.zone}`) : s.ba)

// company: the normalised company (lib/data.js loadCompany). grids: { [region_id]: gridFacts(detail) } for the
// sites whose region detail has loaded; a site without one falls back to the company file's cf_share_2025.
// Returns null when there is no fraction claim or no mapped site (Amazon's "no falsifiable content").
export function companyLadder(company, { grids = {} } = {}) {
  const claim = primaryClaim(company)
  const sites = (company?.sites || []).filter(s => s && (s.region_id || s.ba))
  if (!claim || !sites.length) return null
  const rows = sites.map(s => ({ site: s, id: siteRegionId(s), grid: grids[siteRegionId(s)] || null }))
  const gridLabel = r => r.grid?.label || r.site.grid_label || r.id
  const names = [...new Set(rows.map(gridLabel))]
  const hourly = disclosedHourly(company)
  const claimed = clamp01(num(claim.magnitude))
  const allS = stat(rows.map(r => r.grid?.all ?? num(r.site.cf_share_2025)))
  const nightS = stat(rows.map(r => r.grid?.overnight))
  const incRows = rows.filter(r => r.grid?.increment?.readable)
  const incS = stat(incRows.map(r => r.grid.increment.share))
  const loaded = rows.some(r => r.grid)
  const rungs = withDrops([
    rung('claimed', 'claimed', basisWords(claim), { lo: claimed, hi: claimed, mean: claimed }, { status: 'paper', source: `p. ${claim.page ?? '—'}, ${shortDoc(claim.source_doc)}` }),
    hourly
      ? rung('hourly', 'its own hourly figure', `hourly, ${String(claim.scope || 'market-based').replace(/_/g, '-')}`, { lo: hourly.share, hi: hourly.share, mean: hourly.share }, { status: 'disclosed', source: `p. ${hourly.page ?? '—'}, ${shortDoc(hourly.source_doc)}${hourly.year ? `, ${hourly.year}` : ''}` })
      : rung('hourly', 'its own hourly figure', 'hourly, market-based', null, { status: 'cannot_verify', source: 'no hourly figure in the documents read' }),
    rung('grid_all', `grid at its site${rows.length > 1 ? 's' : ''}, all hours`, 'physical, grid-only, 2025', allS, { status: 'grid', source: 'EIA-930 via PUDL; contracted power excluded' }),
    rung('grid_night', 'same grid, midnight to 6am', 'physical, overnight, 2025', nightS, { status: loaded ? 'grid' : 'loading', source: 'EIA-930 via PUDL; a flat load puts a quarter of its energy here' }),
    rung('increment', 'generation added at night since 2019', 'physical, share of the increment', incS, { status: loaded ? (incS ? 'grid' : 'unreadable') : 'loading', source: incRows.length ? `${incRows.length} of ${rows.length} grid${rows.length > 1 ? 's' : ''} readable` : 'the footprint\'s generation did not grow' }),
  ])
  // The sentence. Every figure and every source is already on a rung underneath, so the lead repeats none
  // of them; it says only what the rungs cannot -- the shape of the finding, true on paper against what the
  // same number reads physically, the pages that make it checkable, and the grids the sites actually draw
  // from. What survives after that is caveat: a missing hourly disclosure, a footprint whose own generation
  // did not grow. The rungs can only abbreviate those ("can't verify", "not readable"), so they are spelled
  // out here. Corrections and data flags are not: the card lists them under the ladder.
  const floor = nightS || allS
  const readings = [`${fmtShare(claimed)}${metricWord(claim)} on paper (p. ${claim.page ?? '—'})`]
  if (hourly) readings.push(`${fmtShare(hourly.share)} hourly by its own report (p. ${hourly.page ?? '—'})`)
  if (floor) readings.push(`${fmtRange(floor.lo, floor.hi)} physically ${nightS ? 'between midnight and 6am' : 'over all hours'} at ${listWords(names)}`)
  const parts = [`${company.company || company.ticker} is ${listWords(readings)}.`]
  if (claim.verdict === 'contradicted') parts.push('The claim is contradicted in its own filings.')
  if (!hourly) parts.push('It discloses no hourly figure of its own in the documents read.')
  const unread = rows.filter(r => r.grid && !r.grid.increment.readable)
  if (loaded && unread.length) parts.push(`${listWords(unread.map(r => `${gridLabel(r)}'s overnight generation ${whyUnreadable(r.grid.increment)}`))}, so ${unread.length > 1 ? 'those increments' : 'that increment'} cannot be read.`)
  // Flags: the company's own notes that name a site's grid, plus each grid's caveats and data flags.
  const flags = []
  for (const n of company.notes || []) if (typeof n === 'string' && rows.some(r => n.includes(`under ${r.site.ba}`) || n.includes(`(${r.site.ba})`) || n.includes(`${r.site.ba} footprint`) || n.includes(`${r.site.ba} balancing`))) flags.push(n)
  for (const r of rows) for (const f of r.grid?.flags || []) if (!flags.includes(f)) flags.push(f)
  const corrected = rows.filter(r => r.grid?.corrected).map(gridLabel)
  const cannot = (hourly ? 0 : 1) + (num(company.cannot_verify_count) || 0)
  return { kind: 'company', rungs, sentence: parts.join(' '), flags, corrected, counts: { flagged: flags.length, corrected: corrected.length, cannot_verify: cannot }, sites: rows.map(r => ({ id: r.id, label: gridLabel(r), loaded: !!r.grid })) }
}

// region: a region detail; label is the place name the page uses; caveat is findings.js caveatFor(id) if any.
// `load_mw` is still accepted (callers pass the page's load) but no longer changes anything: what a flat load
// of that size would run on is the load-shape card's job, and the nearby card prints its fossil MW.
export function regionLadder(detail, { label = null, caveat = null } = {}) {
  const g = gridFacts(detail, { caveat })
  if (!g || g.all == null) return null
  const inc = g.increment
  const rungs = withDrops([
    rung('grid_all', 'annual average, all hours', 'the number an annual report would use', { lo: g.all, hi: g.all, mean: g.all }, { status: 'grid', source: 'EIA-930 via PUDL, 2025, generation within the footprint' }),
    rung('grid_night', 'midnight to 6am', 'a flat load puts a quarter of its energy here', g.overnight == null ? null : { lo: g.overnight, hi: g.overnight, mean: g.overnight }, { status: 'grid', source: 'EIA-930 via PUDL, 2025' }),
    rung('increment', 'generation added at night since 2019', 'average vs increment', inc.readable ? { lo: inc.share, hi: inc.share, mean: inc.share } : null, { status: inc.readable ? 'grid' : 'unreadable', source: inc.readable ? `${fmtSignedGw(inc.total_gw)} overnight generation, 2019 to 2025` : inc.reason === 'fell' ? `overnight generation fell ${fmtGw(inc.total_gw)}` : 'overnight generation did not grow' }),
  ])
  const place = label || g.label || g.id || 'this region'
  // The sentence. The three rungs underneath already carry the annual share, the overnight share, the share
  // of the increment and the GW behind it, so none of that is repeated here. The lead says the shape instead:
  // what filled the growth, and the demand growth it is consistent with -- never "caused by". A zone's
  // inheritance is not restated either; the region page's header chip and the load-shape card both say the
  // generation is the whole grid's. A corrected history and an unreadable increment do stay: they are caveats.
  const dd = g.demand_delta_gw
  const parts = []
  if (inc.readable) {
    const topWords = inc.top ? ` (${inc.top.fuel} ${fmtSignedGw(inc.top.gw)})` : ''
    const gasShare = inc.gas_gw != null ? inc.gas_gw / inc.total_gw : 0
    const served = gasShare >= 0.5 ? 'gas' : inc.share >= 0.5 && inc.top ? inc.top.fuel : null
    const whose = g.zone ? "the zone's" : 'its'
    const tail = dd == null || dd <= 0.05 ? ''
      : served ? `, consistent with ${whose} ${fmtSignedGw(dd)} of overnight demand growth being served by ${served}`
      : `, while overnight demand rose ${fmtGw(dd)}`
    parts.push(`In ${place}, ${fmtShare(inc.share)} of the overnight generation added since 2019 was clean${topWords}${tail}.`)
  } else if (inc.reason === 'no fuel breakdown') {
    parts.push(`In ${place} there is no fuel breakdown for this grid, so the increment cannot be read.`)
  } else {
    // Only when demand actually moved: "demand fell 0.0 GW but" is noise, not a contrast.
    const demandClause = dd == null || Math.abs(dd) < 0.05 ? '' : `overnight demand ${dd > 0 ? 'rose' : 'fell'} ${fmtGw(dd)} but `
    parts.push(`In ${place} ${demandClause}the grid's own overnight generation ${inc.reason === 'fell' ? `fell ${fmtGw(inc.total_gw)}` : 'did not grow'} since 2019, so the increment cannot be read from generation inside the footprint.`)
  }
  if (g.corrected) parts.push('Its published 2019 history is corrected here; read the increment with care.')
  const cannot = rungs.filter(r => r.status === 'unreadable').length
  return { kind: 'region', rungs, sentence: parts.join(' '), flags: g.flags, corrected: g.corrected ? [place] : [], counts: { flagged: g.flags.length, corrected: g.corrected ? 1 : 0, cannot_verify: cannot }, grid: g }
}

// The drop that matters most: the largest fall between adjacent numeric rungs, with the two labels.
export function biggestDrop(rungs) {
  let best = null, prev = null
  for (const r of rungs || []) { if (r.share == null) continue; if (prev && (best == null || prev.share - r.share > best.pts)) best = { from: prev, to: r, pts: prev.share - r.share }; prev = r }
  return best && best.pts > 0 ? best : null
}
