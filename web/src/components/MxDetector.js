// The detector's arithmetic, re-run in the browser against the published components, so the
// ranking on the Method screen is checked in front of the reader rather than asserted at them.
// Nothing here reads a file: every input is a row out of the export
// (detection.overnight_excess / neighbor_divergence / load_factor_delta / growth_pct).
//
// The shipped score is
//   z(overnight_excess) + z(neighbor_divergence) + 0.5 z(load_factor_delta)
// with robust z (median, MAD x 1.4826) taken across all scored regions at once, which is why a
// variant has to be recomputed over the whole set and cannot be done one region at a time.
import { pearson } from '../lib/metrics.js'

export const isNum = v => typeof v === 'number' && Number.isFinite(v)
const nums = values => (values || []).filter(isNum)
// A typographic minus, so a negative score reads like every other figure in the app.
export const fixed = (v, d = 2) => (isNum(v) ? `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}` : null)

export function median(values) {
  const v = nums(values).sort((a, b) => a - b)
  if (!v.length) return null
  const m = v.length >> 1
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

// Median absolute deviation, scaled by 1.4826 so it estimates the same quantity a standard
// deviation does on normal data and the two are directly comparable.
export function mad(values) {
  const m = median(values)
  if (m == null) return null
  const d = median(nums(values).map(x => Math.abs(x - m)))
  return d == null ? null : d * 1.4826
}

export function mean(values) { const v = nums(values); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }
export function sd(values) {
  const v = nums(values), m = mean(v)
  if (v.length < 2 || m == null) return null
  return Math.sqrt(v.reduce((a, x) => a + (x - m) * (x - m), 0) / (v.length - 1))
}

// The scale the shipped score is measured in: one unit is one MAD.
export function robustZ(values) {
  const m = median(values), s = mad(values)
  return (values || []).map(v => (isNum(v) && m != null && s > 0 ? (v - m) / s : 0))
}
// The scale it deliberately is not measured in, kept so the choice can be tested.
export function classicalZ(values) {
  const m = mean(values), s = sd(values)
  return (values || []).map(v => (isNum(v) && m != null && s > 0 ? (v - m) / s : 0))
}

// ids and scores are aligned by index. Highest score is rank 1, as in the pipeline.
export function rankBy(ids, scores) {
  const order = ids.map((_, i) => i).sort((a, b) => scores[b] - scores[a])
  const out = {}
  order.forEach((i, j) => { out[ids[i]] = j + 1 })
  return out
}

// Spearman on two sets of distinct ranks over the same ids. Returns null under 3 regions.
export function spearman(ids, a, b) {
  const n = ids.length
  if (n < 3) return null
  let d2 = 0
  for (const id of ids) {
    if (!isNum(a[id]) || !isNum(b[id])) return null
    d2 += (a[id] - b[id]) ** 2
  }
  return 1 - (6 * d2) / (n * (n * n - 1))
}

export { pearson }

// How far a gigawatt of perfectly flat load would move a region's overnight excess, from that
// region's own baseline year. Flat load adds the same MW to every hour, so it lifts the
// overnight mean off a smaller base than the all-hours mean, and the gap between the two
// growth rates is the excess. Points per 1,000 MW.
export const ptsPerGw = (avgMw, overnightMw) =>
  (isNum(avgMw) && isNum(overnightMw) && avgMw > 0 && overnightMw > 0 ? 1000 * (1 / overnightMw - 1 / avgMw) * 100 : null)

// Every variant is the published score with one decision changed. `terms` is what the score
// reads for that variant; `note` says what the change is testing.
// `lf` marks a variant that cannot be formed without load_factor_delta, which one of the data
// sources in the resolution order does not publish. Those variants are withheld rather than
// quietly computed with the term set to zero, which would be a different score under the same
// label. The shipped row is the published ranking itself and needs no components.
export const VARIANTS = [
  { id: 'shipped', label: 'shipped', terms: 'z(overnight_excess) + z(neighbor_divergence) + 0.5 z(load_factor_delta)', note: 'The published ranking, as the pipeline wrote it.' },
  { id: 'no_div', label: 'no divergence', lf: true, terms: 'z(overnight_excess) + 0.5 z(load_factor_delta)', note: 'Divergence is the term that reads a region against its peers. This is the ranking without it.' },
  { id: 'no_lf', label: 'no load factor', terms: 'z(overnight_excess) + z(neighbor_divergence)', note: 'The half-weighted term carries the least. This is the ranking without it.' },
  { id: 'equal', label: 'equal weights', lf: true, terms: 'z(overnight_excess) + z(neighbor_divergence) + z(load_factor_delta)', note: 'The 0.5 on load factor was set in advance. This is what a 1.0 would have done.' },
  { id: 'classical', label: 'mean and SD', lf: true, terms: 'same three terms, scaled by mean and standard deviation', note: 'Classical z instead of robust z, so the Texas outliers set the scale for everyone.' },
  { id: 'overnight', label: 'overnight only', terms: 'z(overnight_excess)', note: 'One term: overnight demand growth minus average demand growth, and nothing else.' },
  { id: 'growth', label: 'growth only', terms: 'z(growth_pct)', note: 'Plain demand growth, the number anyone can get from a load forecast.' },
]

// The published pattern rules, applied to a region's own published figures. Growth and overnight
// excess come out of the export already in percent and percentage points. Descriptive only: this
// never touches the score or the rank.
export function patternTest(growth, excess) {
  const flat = isNum(growth) && isNum(excess) && growth >= 10 && excess > 0
  const solar = isNum(growth) && isNum(excess) && growth < 5 && excess >= 5
  return { flat, solar, label: flat ? 'flat-load growth' : solar ? 'possible midday solar suppression' : 'mixed' }
}

// cols: { oe, nd, lf, gr } aligned arrays. Returns a score per index for the given variant.
export function variantScore(id, cols) {
  const { oe, nd, lf, gr } = cols
  const R = robustZ, C = classicalZ
  const zo = R(oe), zn = R(nd), zl = R(lf)
  if (id === 'no_div') return zo.map((v, i) => v + 0.5 * zl[i])
  if (id === 'no_lf') return zo.map((v, i) => v + zn[i])
  if (id === 'equal') return zo.map((v, i) => v + zn[i] + zl[i])
  if (id === 'classical') { const co = C(oe), cn = C(nd), cl = C(lf); return co.map((v, i) => v + cn[i] + 0.5 * cl[i]) }
  if (id === 'overnight') return zo
  if (id === 'growth') return R(gr)
  return zo.map((v, i) => v + zn[i] + 0.5 * zl[i])
}

// Everything the robustness panel needs, computed once over the whole scored set.
//   published    the rank the pipeline shipped, by region id
//   ranks        { variantId: { regionId: rank } }, each recomputed over all rows
//   rho          { variantId: Spearman against the published ranking }
//   fidelity     what recomputing the SHIPPED score from the export's rounded components costs,
//                so a reader can tell a real movement from a rounding artefact
//   scale        median, MAD and SD per component, the evidence for robust z
export function analyze(rows) {
  const usable = (rows || []).filter(r => {
    const d = r.detection || {}
    return isNum(d.rank) && isNum(d.overnight_excess) && isNum(d.neighbor_divergence) && isNum(d.growth_pct)
  })
  const ids = usable.map(r => r.id)
  const cols = {
    oe: usable.map(r => r.detection.overnight_excess),
    nd: usable.map(r => r.detection.neighbor_divergence),
    lf: usable.map(r => r.detection.load_factor_delta),
    gr: usable.map(r => r.detection.growth_pct),
  }
  // Not every source in the resolution order publishes the half-weighted term.
  const hasLoadFactor = cols.lf.length > 0 && cols.lf.every(isNum)
  const published = {}
  usable.forEach(r => { published[r.id] = r.detection.rank })

  const ranks = {}, rho = {}
  for (const v of VARIANTS) {
    if (v.lf && !hasLoadFactor) continue
    ranks[v.id] = v.id === 'shipped' ? published : rankBy(ids, variantScore(v.id, cols))
    rho[v.id] = v.id === 'shipped' ? 1 : spearman(ids, published, ranks[v.id])
  }

  // What recomputing the shipped score from the export's rounded components costs. Only
  // meaningful when all three components are present, since otherwise it is a different score.
  let fidelity = { n: ids.length, exact: null, max: null, rho: null }
  if (hasLoadFactor && ids.length) {
    const recomputed = rankBy(ids, variantScore('shipped', cols))
    const shifts = ids.map(id => Math.abs(recomputed[id] - published[id]))
    fidelity = { n: ids.length, exact: shifts.filter(s => s === 0).length, max: Math.max(...shifts), rho: spearman(ids, published, recomputed) }
  }

  const scale = [
    { key: 'overnight_excess', unit: 'pts', weight: 1, values: cols.oe },
    { key: 'neighbor_divergence', unit: 'pts', weight: 1, values: cols.nd },
    ...(hasLoadFactor ? [{ key: 'load_factor_delta', unit: '', weight: 0.5, values: cols.lf }] : []),
  ].map(c => ({ key: c.key, unit: c.unit, weight: c.weight, median: median(c.values), mad: mad(c.values), sd: sd(c.values) }))

  return { ids, cols, n: ids.length, hasLoadFactor, published, ranks, rho, fidelity, scale, divergenceVsGrowth: pearson(cols.nd, cols.gr) }
}
