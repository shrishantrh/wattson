// Metrics for the Explore page: every number a quant user might plot across the scored regions,
// each with a plain-English name, a display unit and a formatter, plus the pure statistics the
// page needs (Pearson r, least squares, quantiles, nice axis ticks) and the interconnection
// ("sector") a region belongs to. No React, no DOM: test/metrics.test.mjs imports this under
// plain Node.
//
// `get(region)` returns the value in DISPLAY units. Shares and share changes come out of the
// export as 0-1 fractions (the project rule) and are multiplied by 100 here so '%' and 'pts'
// axes read directly; growth, overnight excess and neighbour divergence are already percentages
// in the export. Pearson r is unaffected by the scaling; the slope is reported in display units.
import { signed } from './format.js'

const isNum = v => typeof v === 'number' && Number.isFinite(v)
const num = v => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v))
const pc = v => { const n = num(v); return n == null ? null : Math.round(n * 1000) / 10 }   // fraction -> percent, 1 dp

const fmtPct = v => (isNum(v) ? `${v.toFixed(1)}%` : '—')
const fmtSignedPct = v => (isNum(v) ? `${signed(v, 1)}%` : '—')
const fmtPts = v => (isNum(v) ? `${signed(v, 1)} pts` : '—')
const fmtPtsYr = v => (isNum(v) ? `${signed(v, 2)} pts/yr` : '—')
const fmtX = v => (isNum(v) ? `${v.toFixed(2)}×` : '—')
const fmtScore = d => v => (isNum(v) ? v.toFixed(d) : '—')
const fmtRank = v => (isNum(v) ? `#${Math.round(v)}` : '—')

const night = r => r?.siting?.overnight_cf_share_2025 ?? r?.cf_share_2025?.overnight ?? r?.overnight_cf_share_2025 ?? null
const day = r => r?.cf_share_2025?.daytime ?? null

// Ordered as they appear in the axis pickers. `phrase` is the lower-case noun used in sentences.
// Metrics that come from a grid's generation. Zones report demand only and inherit these from their grid,
// so statistics over them must use one point per grid, not one per zone.
export const GENERATION_SIDE = new Set(['night_cf', 'day_cf', 'day_night_gap', 'change_since_2019', 'ratio_slope_per_year', 'clean_over_demand', 'siting_score', 'siting_rank'])

export const METRICS = [
  { key: 'growth_pct', label: 'Demand growth since 2019', short: 'Growth', phrase: 'demand growth', unit: '%', get: r => num(r?.detection?.growth_pct), format: fmtSignedPct },
  { key: 'overnight_growth_pct', label: 'Overnight demand growth since 2019', short: 'Night growth', phrase: 'overnight growth', unit: '%', get: r => num(r?.detection?.overnight_growth_pct), format: fmtSignedPct },
  { key: 'overnight_excess', label: 'Overnight excess (night growth minus average)', short: 'Night excess', phrase: 'overnight excess', unit: 'pts', get: r => num(r?.detection?.overnight_excess), format: fmtPts },
  { key: 'neighbor_divergence', label: 'Neighbour divergence', short: 'Divergence', phrase: 'neighbour divergence', unit: 'pts', get: r => num(r?.detection?.neighbor_divergence), format: fmtPts },
  { key: 'score', label: 'Detector score', short: 'Score', phrase: 'detector score', unit: 'score', get: r => num(r?.detection?.score), format: fmtScore(2) },
  { key: 'rank', label: 'Detector rank', short: 'Rank', phrase: 'detector rank', unit: 'rank', get: r => num(r?.detection?.rank), format: fmtRank },
  { key: 'night_cf', label: 'Clean at night, 2025', short: 'Clean at night', phrase: 'clean share at night', unit: '%', get: r => pc(night(r)), format: fmtPct },
  { key: 'day_cf', label: 'Clean by day, 2025', short: 'Clean by day', phrase: 'clean share by day', unit: '%', get: r => pc(day(r)), format: fmtPct },
  { key: 'day_night_gap', label: 'Day-minus-night gap, 2025', short: 'Day − night', phrase: 'the day-night gap', unit: 'pts', get: r => { const d = num(day(r)), n = num(night(r)); return d == null || n == null ? null : Math.round((d - n) * 1000) / 10 }, format: fmtPts },
  { key: 'change_since_2019', label: 'Change in clean at night since 2019', short: 'Since 2019', phrase: 'the change in clean share at night since 2019', unit: 'pts', get: r => pc(r?.siting?.change_since_2019), format: fmtPts },
  { key: 'ratio_slope_per_year', label: 'Trend per year (clean ÷ night demand)', short: 'Trend / yr', phrase: 'the yearly trend', unit: 'pts/yr', get: r => { const v = num(r?.siting?.ratio_slope_per_year); return v == null ? null : Math.round(v * 10000) / 100 }, format: fmtPtsYr },
  { key: 'clean_over_demand', label: 'Clean power vs night demand', short: 'Clean ÷ demand', phrase: 'clean power relative to night demand', unit: '×', get: r => num(r?.siting?.overnight_clean_mw_over_demand), format: fmtX },
  { key: 'siting_score', label: 'Siting score', short: 'Siting', phrase: 'siting score', unit: 'score', get: r => num(r?.siting?.siting_score), format: fmtScore(3) },
  { key: 'siting_rank', label: 'Siting rank', short: 'Siting rank', phrase: 'siting rank', unit: 'rank', get: r => num(r?.siting?.siting_rank), format: fmtRank },
]
const BY_KEY = Object.fromEntries(METRICS.map(m => [m.key, m]))
export const metric = key => BY_KEY[key] || null

// Compact tick-label formatter for an axis in this metric's unit.
export function tickFormat(m) {
  const u = m?.unit
  const s = v => String(Number(Number(v).toPrecision(10)))
  if (u === '%') return v => `${s(v)}%`
  if (u === '×') return v => `${s(v)}×`
  if (u === 'rank') return v => `#${s(v)}`
  return s
}

// Named x/y pairs. `reading` is the clause after "correlate r = …:" by the sign of r;
// `note` says what the outliers mean; `quadrants` turns on the median cross.
export const PRESETS = [
  { key: 'fingerprint', label: 'Flat-load fingerprint', x: 'growth_pct', y: 'overnight_excess', quadrants: true, quadrantLabel: 'grew fast, faster at night',
    question: 'Which places grew fast and grew faster at night? That is the fingerprint of flat 24/7 load.',
    note: 'Top-right of the median cross is the fingerprint. The four validation clusters were named before the ranking was seen.',
    reading: { pos: 'places that grew fast also grew faster at night', neg: 'places that grew fast grew more slowly at night', none: 'growing fast says little about growing at night' } },
  { key: 'gas', label: 'Does growth run on gas?', x: 'growth_pct', y: 'change_since_2019',
    question: 'Did the grids that grew most get less clean at night?',
    note: 'Points below zero got dirtier at night while they grew, consistent with new load being served by gas. Zones inherit their grid\'s generation figures.',
    reading: { pos: 'the fastest-growing grids got cleaner at night, not dirtier', neg: 'the fastest-growing grids got less clean at night, consistent with new load being served by gas', none: 'how fast a grid grew says little about whether its nights got cleaner or dirtier' } },
  { key: 'solar', label: 'Where solar hides the night', x: 'day_cf', y: 'night_cf',
    question: 'Which grids look clean by day but not at night?',
    note: 'Points far below the fit are grids whose daytime clean share comes from solar that is gone by midnight.',
    reading: { pos: 'grids that are clean by day are mostly clean at night too', neg: 'grids that are clean by day are dirtier at night', none: 'a clean day says little about the night' } },
  { key: 'improving', label: 'Cleanest and improving', x: 'night_cf', y: 'ratio_slope_per_year',
    question: 'Which grids are clean at night and getting cleaner?',
    note: 'Top-right is where new flat load would be served cleanly and stay that way. The trend is the 2019–2025 slope of clean MW over night demand.',
    reading: { pos: 'the cleanest grids at night are also the ones getting cleaner', neg: 'the cleanest grids at night are slipping while dirtier ones catch up', none: 'how clean a grid is at night says little about which way it is moving' } },
  { key: 'score_vs_siting', label: 'Score vs siting', x: 'score', y: 'siting_score',
    question: 'Is new flat load landing where it would be served cleanly?',
    note: 'The detector reads demand only; the siting score reads generation. High score with low siting is load landing on a grid that serves it with fossil fuel.',
    reading: { pos: 'flat load is landing where it would be served cleanly', neg: 'flat load is landing where the grid is least able to serve it cleanly', none: 'where flat load is landing is unrelated to where it would be served cleanly' } },
]
export const DEFAULT_PRESET = PRESETS[0]

// ---------- statistics (pure) ----------
// Pairs where both values are finite numbers; everything else is dropped pairwise.
export function pairs(xs, ys) {
  const out = [], n = Math.min(xs?.length || 0, ys?.length || 0)
  for (let i = 0; i < n; i++) if (isNum(xs[i]) && isNum(ys[i])) out.push([xs[i], ys[i]])
  return out
}
function moments(p) {
  const n = p.length
  let mx = 0, my = 0
  for (const [x, y] of p) { mx += x; my += y }
  mx /= n; my /= n
  let sxy = 0, sxx = 0, syy = 0
  for (const [x, y] of p) { const dx = x - mx, dy = y - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy }
  return { n, mx, my, sxy, sxx, syy }
}
// Pearson correlation, or null with fewer than 3 pairs or a constant series.
export function pearson(xs, ys) {
  const p = pairs(xs, ys)
  if (p.length < 3) return null
  const { sxy, sxx, syy } = moments(p)
  if (sxx === 0 || syy === 0) return null
  return sxy / Math.sqrt(sxx * syy)
}
// Ordinary least squares y = intercept + slope * x. slope/intercept are null with fewer than
// 2 pairs or a constant x.
export function linfit(xs, ys) {
  const p = pairs(xs, ys)
  if (p.length < 2) return { slope: null, intercept: null, n: p.length }
  const { n, mx, my, sxy, sxx } = moments(p)
  if (sxx === 0) return { slope: null, intercept: null, n }
  const slope = sxy / sxx
  return { slope, intercept: my - slope * mx, n }
}
// Linear-interpolation quantiles (R type 7, numpy default). Non-numbers are ignored; an empty
// series gives nulls.
export function quantiles(values, ps = [0.25, 0.5, 0.75]) {
  const v = (values || []).filter(isNum).sort((a, b) => a - b), n = v.length
  return ps.map(p => {
    if (!n) return null
    const h = (n - 1) * Math.min(1, Math.max(0, p)), lo = Math.floor(h), hi = Math.ceil(h)
    return v[lo] + (v[hi] - v[lo]) * (h - lo)
  })
}
export const median = values => quantiles(values, [0.5])[0]
// Residual of each point from a fit: y minus the line. Points keep their other fields.
export function residuals(points, fit) {
  const ok = fit && isNum(fit.slope) && isNum(fit.intercept)
  return (points || []).map(p => ({ ...p, resid: ok && isNum(p.x) && isNum(p.y) ? p.y - (fit.intercept + fit.slope * p.x) : null }))
}
// The k points farthest from the fit, largest |residual| first.
export function outliers(points, fit, k = 5) {
  return residuals(points, fit).filter(p => isNum(p.resid)).sort((a, b) => Math.abs(b.resid) - Math.abs(a.resid)).slice(0, k)
}
// Round tick values covering [lo, hi] at a 1/2/5 step, about `count` of them.
export function niceTicks(lo, hi, count = 5) {
  if (!isNum(lo) || !isNum(hi)) return []
  if (lo > hi) [lo, hi] = [hi, lo]
  if (lo === hi) return [Number(lo.toPrecision(12))]
  const raw = (hi - lo) / Math.max(1, count)
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = (norm < Math.SQRT2 ? 1 : norm < Math.sqrt(10) ? 2 : norm < Math.sqrt(50) ? 5 : 10) * mag   // d3's tickStep thresholds
  const out = []
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(Number(v.toPrecision(12)) || 0)
  return out
}

// ---------- interconnections ----------
// contracts/ba_codes.txt lists codes but not interconnections, so this is the mapping.
// WACM (WAPA Rocky Mountain) is in the Western Interconnection even though SWPP sits east of it.
const TEXAS = new Set(['ERCO'])
const EASTERN = new Set(['PJM', 'MISO', 'NYIS', 'ISNE', 'SOCO', 'TVA', 'DUK', 'CPLE', 'CPLW', 'SC', 'SCEG', 'FPL', 'FPC', 'TEC', 'JEA', 'SEC', 'AECI', 'LGEE', 'EEI', 'SWPP', 'SWPW', 'SPA', 'FMPP', 'AEC', 'GVL', 'HST', 'TAL', 'OVEC'])
const WESTERN = new Set(['CISO', 'BPAT', 'PACW', 'PACE', 'AZPS', 'TEPC', 'SRP', 'NEVP', 'PSCO', 'WACM', 'WALC', 'LDWP', 'IPCO', 'NWMT', 'AVA', 'PSEI', 'TPWR', 'SCL', 'PGE', 'CHPD', 'DOPD', 'GCPD', 'BANC', 'TIDC', 'IID', 'PNM', 'EPE', 'WAUW'])
export const SECTORS = ['Eastern', 'Texas', 'Western']
// Accepts a region object ({ ba } or { id }) or an id string like 'PJM/DOM'.
export function sectorOf(region) {
  const ba = String(typeof region === 'string' ? region : region?.ba || region?.id || '').split('/')[0].toUpperCase()
  if (TEXAS.has(ba)) return 'Texas'
  if (EASTERN.has(ba)) return 'Eastern'
  if (WESTERN.has(ba)) return 'Western'
  return 'Other'
}
