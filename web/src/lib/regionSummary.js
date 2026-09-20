// One region reduced to what the dossier header needs. Pure: no React, no DOM, no fetch.
//
// summarize(detail, id, { loadMW = 300, coords }) reads a region detail from lib/data.js loadRegion()
// and returns a flat object of nulls-where-absent. A zone reports demand only and inherits its parent
// grid's generation, so generation-side figures come from `detail.parent` when it is an object and
// from the zone itself otherwise (the static export copies them onto the zone). When the engine has
// published a correction for a path (AZPS 2019 counted SRP's nuclear), the corrected value is used and
// `corrected` says so; the published figure stays available to the "published vs corrected" module.
import { compareShapes, bestHours, hourSpanWords, fossilMW, profileOf, describeShape } from './shape.js'
import { caveatFor, correctedBaseline, n0, pct0 } from './findings.js'

const CLEAN = ['nuclear', 'hydro', 'wind', 'solar', 'geothermal']
const isObj = x => x != null && typeof x === 'object' && !Array.isArray(x)
const num = x => (x == null || x === '' || Number.isNaN(Number(x)) ? null : Number(x))
const gridOf = d => (d?.type === 'zone' && isObj(d.parent) ? d.parent : d)

// path -> corrected value, for every correction the engine published on this region or its grid.
const correctionMap = d => Object.fromEntries((d?.corrections?.corrections || d?.parent?.corrections?.corrections || []).filter(c => c && c.path).map(c => [c.path, c.corrected]))

const operatorsOf = d => {
  const ops = Array.isArray(d?.operators_manual) && d.operators_manual.length ? d.operators_manual : Array.isArray(d?.operators) ? d.operators : []
  return ops.filter(o => isObj(o) && (o.utility || o.parent || o.ticker)).map(o => ({ utility: o.utility ?? null, parent: o.parent ?? null, ticker: o.ticker ?? null, role: o.role ?? null }))
}

// "183 MW of it would not be carbon-free (the mix after midnight is 39% clean); business hours
// instead would make it 40%, and shifting a fifth into 10am to 4pm, 40%. Moving when it runs is
// worth about 1 point here." Whole percents. Empty string when nothing can be said.
export function runsOnLine({ night2025, fossilMW: fossil, profile }) {
  const head = []
  if (fossil != null) head.push(`${n0(fossil)} MW of it would not be carbon-free`)
  if (night2025 != null) head.push(`${head.length ? '(' : ''}the mix after midnight is ${pct0(night2025)} clean${head.length ? ')' : ''}`)
  const tail = []
  let worth = ''
  if (profile) {
    const cmp = compareShapes(profile)
    const biz = cmp.byId.business?.share, flex = cmp.flexible20?.share
    if (biz != null) tail.push(`business hours instead would make it ${pct0(biz)}`)
    if (flex != null) { const span = hourSpanWords(bestHours(profile, 6).hours); tail.push(`${tail.length ? 'and ' : ''}shifting a fifth into ${span || 'the cleanest six hours'}, ${pct0(flex)}`) }
    const best = Math.max(biz == null ? -1 : biz, flex == null ? -1 : flex)
    if (night2025 != null && best > -1 && tail.length) { const p = Math.round(Math.abs(best - night2025) * 100); worth = ` Moving when it runs is worth about ${p} point${p === 1 ? '' : 's'} here.` }
  }
  if (!head.length && !tail.length) return ''
  return `${head.join(' ')}${head.length && tail.length ? '; ' : ''}${tail.join(', ')}.${worth}`
}

export function summarize(detail, id, { loadMW = 300, coords } = {}) {
  if (!isObj(detail)) return null
  const c = isObj(coords) ? coords : isObj(detail.c) ? detail.c : {}
  const gen = gridOf(detail) || detail
  const sit = isObj(gen.siting) ? gen.siting : isObj(detail.siting) ? detail.siting : {}
  const cf = isObj(gen.cf_share) ? gen.cf_share : isObj(detail.cf_share) ? detail.cf_share : {}
  const det = isObj(detail.detection) ? detail.detection : {}
  const dem = isObj(detail.demand) ? detail.demand : {}
  const corr = correctionMap(detail)
  const ba = detail.ba || (typeof id === 'string' && id.includes('/') ? id.split('/')[0] : id) || null

  const night2025 = num(sit.overnight_cf_share_2025) ?? num(cf['2025']?.overnight)
  const baseline = correctedBaseline(detail)
  const corrected = baseline != null
  const night2019 = corrected ? baseline : num(cf['2019']?.overnight)
  const change = corrected && night2025 != null ? night2025 - baseline : num(sit.change_since_2019) ?? (night2025 != null && night2019 != null ? night2025 - night2019 : null)

  const demandNight2025 = num(dem['2025']?.overnight_avg_mw), demandNight2019 = num(dem['2019']?.overnight_avg_mw)
  const growthNight = demandNight2025 != null && demandNight2019 ? demandNight2025 / demandNight2019 - 1 : null

  const fd = isObj(gen.fuel_delta_overnight_gw) ? gen.fuel_delta_overnight_gw : isObj(detail.fuel_delta_overnight_gw) ? detail.fuel_delta_overnight_gw : {}
  const fuel = f => num(corr[`fuel_delta_overnight_gw.${f}`]) ?? num(fd[f])
  const gasDelta = fuel('gas')
  const cleanParts = CLEAN.map(fuel).filter(x => x != null)
  const cleanDelta = cleanParts.length ? cleanParts.reduce((s, x) => s + x, 0) : null

  const label = c.label || detail.name || id || null
  const place = c.place || detail.ba_name || null
  const profile = profileOf(detail)
  const fossil = fossilMW(loadMW, night2025)
  const alerts = Array.isArray(detail.alerts) ? detail.alerts.filter(a => a && a.active !== false).length : null

  return {
    id: id ?? detail.id ?? null, label, place, grid: ba, loadMW,
    night2025, night2019, change, corrected,
    rank: num(det.rank), n_scored: num(det.n_scored), pattern: det.pattern ?? null, score: num(det.score),
    demandNight2025, demandNight2019, growthNight,
    gasDelta, cleanDelta,
    fossilMW: fossil,
    shapeLine: profile ? describeShape(label, profile, loadMW) : null,
    runsOn: runsOnLine({ night2025, fossilMW: fossil, profile }),
    inherited: !!detail.cf_inherited_from_ba,
    flagged: !!detail.exclude_from_alerts,
    caveat: caveatFor(id) || null,
    operators: operatorsOf(detail).slice(0, 2),
    alerts,
  }
}

// Fixed reading order for the evidence column. Ids not listed sort after every listed one, in the
// order they came. Stable: equal priorities keep their input order.
export const EVIDENCE_ORDER = ['hours', 'fuel-delta', 'corrections', 'operators', 'alerts', 'detector', 'history', 'heatmap']
export function orderEvidence(modules, order = EVIDENCE_ORDER) {
  const rank = new Map(order.map((id, i) => [id, i]))
  return (modules || []).map((m, i) => ({ m, i, p: rank.has(m.id) ? rank.get(m.id) : order.length })).sort((a, b) => a.p - b.p || a.i - b.i).map(x => x.m)
}
