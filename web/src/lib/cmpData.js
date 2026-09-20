// The three things Wattson can put side by side, reduced to one shape.
//
// A region, an operator and a single datacenter site are different records, but a
// comparison of any two of them is the same object: a list of rows, each with a left
// value, a right value, and a difference when both sides are measured on the same basis.
// Everything the comparison screens print passes through here, so two rules are kept in
// one place rather than in three screens:
//
//   1. A share never appears without the megawatts it came from. Every share row names
//      the MW row that carries it, and both are in the same table.
//   2. A null is a middle dot or a short phrase. Never a zero, never an empty bar: a
//      missing talk score drawn as 0% says the company claimed nothing, which is false.
//
// A zone reports demand only and inherits its parent balancing authority's generation, so
// every generation figure carries the id of the grid it actually describes. PJM's output
// is never printed under Dominion's name.
import coords from '../data/region_coords.json'

export const NONE = '·'                      // middle dot: this figure is not published
export const isNum = v => typeof v === 'number' && Number.isFinite(v)
const nn = (v, f) => (isNum(v) ? f(v) : NONE)
const sgn = x => (x > 0 ? '+' : x < 0 ? '−' : '')

export const fPct1 = v => nn(v, x => `${(x * 100).toFixed(1)}%`)
export const fPct0 = v => nn(v, x => `${Math.round(x * 100)}%`)
export const fMw = v => nn(v, x => `${Math.round(x).toLocaleString('en-US')} MW`)
export const fInt = v => nn(v, x => Math.round(x).toLocaleString('en-US'))
export const fPts = v => nn(v, x => `${sgn(x)}${Math.abs(x * 100).toFixed(1)} pts`)
export const fPtsYr = v => nn(v, x => `${sgn(x)}${Math.abs(x * 100).toFixed(2)} pts/yr`)
export const fTimes = v => nn(v, x => `${x.toFixed(2)}×`)
export const fRank = v => nn(v, x => `#${Math.round(x)}`)
export const fGrowth = v => nn(v, x => `${sgn(x)}${Math.abs(x).toFixed(0)}%`)
export const fScore2 = v => nn(v, x => x.toFixed(2))
export const plural = (n, word) => `${fInt(n)} ${word}${n === 1 ? '' : 's'}`

// ---------------------------------------------------------------- regions
export const baOf = id => String(id || '').split('/')[0]
export const isZoneId = id => String(id || '').includes('/')
export const labelOfId = id => coords.regions[id]?.label || id
export const placeOfId = id => coords.regions[id]?.place || ''
// Region label as the app writes it everywhere else: the short place name, then the id.
export const regionName = r => (r?.c?.label || labelOfId(r?.id) || r?.name || r?.id || '')

// The grid a region's generation figures actually describe. For a zone that is its parent.
export const genGridOf = r => (r?.cf_inherited_from_ba || (r?.type === 'zone') ? baOf(r?.id) : r?.id)

// Average MW for one year out of a region detail document. A zone's own document already
// carries the parent's generation, so this reads it straight and the caller labels it.
export function mwAt(detail, year = '2025') {
  const g = detail && detail.type === 'zone' && detail.parent ? detail.parent : detail
  const cf = g?.cf_avg_mw?.[year] || {}, tot = g?.total_avg_mw?.[year] || {}
  return {
    cleanNight: cf.overnight ?? null, totalNight: tot.overnight ?? null,
    cleanAll: cf.all ?? null, totalAll: tot.all ?? null,
    demandNight: detail?.demand?.[year]?.overnight_avg_mw ?? null, demandAll: detail?.demand?.[year]?.avg_mw ?? null,
  }
}

// ---------------------------------------------------------------- sites
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
// Stable, shareable, and unique across all 134: operator key, then metro and state.
export const siteId = f => `${f.operator_key || f.ticker || 'NA'}~${slug(f.metro)}-${slug(f.state || 'xx')}`
export const siteName = f => `${f.metro}${f.state ? `, ${f.state}` : ''}`

// Whoever mapped the site wrote these words in capitals because they change how the figure
// must be read: a naive-geography trap, an on-site gas plant that EIA-930 never sees, load
// that is curtailed rather than served, a serving utility we could not resolve. The same
// pattern the company page uses, so a flag cannot be visible on one screen and not the other.
export const SITE_FLAG = /(TRAP[^:.]*|MATERIAL CAVEAT|COARSE-REGION CAVEAT|DEMAND RESPONSE|UNRESOLVED)/
export const siteFlag = note => { const m = String(note || '').match(SITE_FLAG); return m ? m[1].replace(/,[^]*$/, '').trim().toLowerCase() : null }

// ---------------------------------------------------------------- the URL
export const MODES = [
  { id: 'region', label: 'Regions', one: 'region', blurb: 'any two of the 111 scored grids' },
  { id: 'company', label: 'Operators', one: 'operator', blurb: 'any two of the 52 operators' },
  { id: 'site', label: 'Sites', one: 'site', blurb: 'any two of the 134 mapped datacenters' },
]
export const isMode = m => MODES.some(x => x.id === m)

// vs=<mode>:<left>,<right>. No id in the data holds a comma or a colon, so one split each
// way is enough and the link stays readable: vs=region:PJM/DOM,ERCO/NRTH.
export function parseVs(raw) {
  const s = String(raw || '').trim()
  const i = s.indexOf(':')
  if (i < 0) return null
  const mode = s.slice(0, i).toLowerCase()
  if (!isMode(mode)) return null
  const [a = '', b = ''] = s.slice(i + 1).split(',')
  return { mode, a: a.trim(), b: b.trim() }
}
export const buildVs = ({ mode, a, b }) => `${mode}:${a || ''},${b || ''}`

// ---------------------------------------------------------------- one operator, summarized
// Site shares are unweighted across sites, which is the basis the published walk score uses:
// we do not know each site's load. Generation megawatts count each grid once, so an operator
// with two sites in PJM does not get PJM's output twice.
export function operatorStats(co, regionsById = {}, details = {}) {
  const sites = (co?.sites || []).map(s => {
    const r = regionsById[s.region_id] || null
    return {
      ...s, region: r,
      night: r?.cf_share_2025?.overnight ?? null,
      allHours: r?.cf_share_2025?.all ?? s.cf_share_2025 ?? null,
      rank: r?.detection?.rank ?? s.detector_rank ?? null,
    }
  })
  const nights = sites.map(s => s.night).filter(isNum)
  const alls = sites.map(s => s.allHours).filter(isNum)
  const grids = [...new Set(sites.map(s => s.region_id))]
  const bas = [...new Set(sites.map(s => baOf(s.region_id)))]
  let cleanNight = 0, totalNight = 0, cleanAll = 0, totalAll = 0, priced = 0
  for (const ba of bas) {
    const m = mwAt(details[ba])
    if (isNum(m.cleanNight) && isNum(m.totalNight)) { cleanNight += m.cleanNight; totalNight += m.totalNight; cleanAll += m.cleanAll ?? 0; totalAll += m.totalAll ?? 0; priced++ }
  }
  const byNight = sites.filter(s => isNum(s.night)).sort((a, b) => b.night - a.night)
  const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  return {
    key: co?.id || co?.ticker, name: co?.company || co?.id, ticker: co?.ticker ?? null,
    listed: !!co?.listed_equity, coverageStatus: co?.coverage_status || null,
    talk: isNum(co?.talk_score) ? co.talk_score : null,
    walk: isNum(co?.walk_score) ? co.walk_score : null,
    coverage: isNum(co?.coverage) ? co.coverage : null,
    nSites: sites.length, nClaims: (co?.claims || []).length, cannotVerify: co?.cannot_verify_count ?? null,
    sites, grids, bas,
    meanNight: mean(nights), meanAll: mean(alls),
    cleanest: byNight[0] || null, dirtiest: byNight.length > 1 ? byNight[byNight.length - 1] : null,
    cleanNight: priced ? cleanNight : null, totalNight: priced ? totalNight : null,
    cleanAll: priced ? cleanAll : null, totalAll: priced ? totalAll : null,
    gridsPriced: priced, topDetector: sites.filter(s => isNum(s.rank) && s.rank <= 20).length,
    isMock: !!co?.is_mock,
  }
}

// ---------------------------------------------------------------- the difference column
// A difference is arithmetic on two numbers read off the same export. When either side is
// absent, or the row is marked as not comparable, the cell says so instead of printing a gap
// that was never measured.
export function diffText(row) {
  if (row.noDiff || !isNum(row.a) || !isNum(row.b)) return NONE
  const d = row.a - row.b, m = Math.abs(d), s = sgn(d)
  switch (row.diff) {
    case 'pts': return `${s}${(m * 100).toFixed(1)} pts`
    case 'ptsyr': return `${s}${(m * 100).toFixed(2)} pts/yr`
    case 'x': return `${s}${m.toFixed(2)}×`
    case 'mw': return `${s}${Math.round(m).toLocaleString('en-US')} MW`
    case 'pct': return `${s}${m.toFixed(0)}%`
    case 'places': return m === 0 ? 'same place' : `${s}${Math.round(m)} place${Math.round(m) === 1 ? '' : 's'}`
    default: return `${s}${fInt(m)}`
  }
}
// Cyan when the left side is the better of the two for a flat load, ember when it is worse.
// A row with no direction ("which grid grew faster") gets no color at all.
export function diffTone(row) {
  if (row.noDiff || !isNum(row.a) || !isNum(row.b) || !row.good || row.a === row.b) return ''
  return (row.good === 'high' ? row.a > row.b : row.a < row.b) ? 'pos' : 'neg'
}
