// Every screen title is a plain-English sentence generated from the numbers on that screen.
// Nothing here is hand-written per region or company: change the data and the sentence changes.
export const n0 = x => (x == null || Number.isNaN(Number(x)) ? '—' : Math.round(Number(x)).toLocaleString('en-US'))
export const pct0 = x => (x == null ? '—' : `${Math.round(x * 100)}%`)
export const pct1 = x => (x == null ? '—' : `${(x * 100).toFixed(1)}%`)
export const pts1 = x => (x == null ? '—' : `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x * 100).toFixed(1)} pts`)
export const gw1 = mw => (mw == null ? '—' : `${(Math.abs(mw) / 1000).toFixed(1)} GW`)
export const signedGw = gw => (gw == null ? '—' : `${gw > 0 ? '+' : gw < 0 ? '−' : ''}${Math.abs(gw).toFixed(1)} GW`)
const y = (o, k) => (o && o[k] != null ? Number(o[k]) : null)

// Opening: the PJM finding.
export function openingTitle(pjm, baseline = 2019, latest = 2025) {
  const a = y(pjm?.overnight_clean_mw, baseline), b = y(pjm?.overnight_clean_mw, latest)
  if (a == null || b == null) return { title: 'PJM overnight clean generation since 2019', sub: '' }
  const rel = (b - a) / a
  const verb = Math.abs(rel) < 0.01 ? 'has not moved' : rel < 0 ? `fell ${pct1(-rel)}` : `rose ${pct1(rel)}`
  const tot = y(pjm.overnight_total_mw, latest) - y(pjm.overnight_total_mw, baseline)
  const gas = pjm.fuel_delta_overnight_gw?.gas
  const ex0 = y(pjm.overnight_net_export_mw, baseline), ex1 = y(pjm.overnight_net_export_mw, latest)
  const parts = [`${n0(a)} MW then, ${n0(b)} MW now.`]
  if (tot != null) parts.push(`Overnight generation rose ${gw1(tot)}.`)
  if (gas != null) parts.push(`Gas supplied ${signedGw(gas).replace('+', '')} of it.`)
  if (ex0 != null && ex1 != null) parts.push(`Net exports ${ex1 < ex0 ? 'fell' : 'rose'} from ${gw1(ex0)} to ${gw1(ex1)}, so the new generation served PJM's own load.`)
  return { title: `PJM's overnight clean generation ${verb} since ${baseline}.`, sub: parts.join(' ') }
}

// Opening: the national day/night split.
export function nationalTitle(cf, baseline = '2019', latest = '2025') {
  const d = cf?.[latest]?.daytime - cf?.[baseline]?.daytime, o = cf?.[latest]?.overnight - cf?.[baseline]?.overnight
  if (!Number.isFinite(d) || !Number.isFinite(o)) return { title: 'Daytime and overnight clean share since 2019', sub: '' }
  const nightVerb = Math.abs(o) < 0.01 ? 'stood still' : o < 0 ? `fell ${pts1(o).replace('−', '')}` : `rose ${pts1(o).replace('+', '')}`
  return { title: `Since ${baseline} the grid cleaned up by day and ${nightVerb} at night.`, sub: `Daytime clean share ${pct1(cf[baseline].daytime)} to ${pct1(cf[latest].daytime)} (${pts1(d)}). Overnight ${pct1(cf[baseline].overnight)} to ${pct1(cf[latest].overnight)} (${pts1(o)}). A datacenter draws the same power at 3am as at noon, so half its load lands in the hours that did not improve.` }
}

// Opening: the detector map.
export function detectorTitle(det) {
  const n = det?.n_scored, leads = det?.new_leads?.length ?? 0
  const v = (det?.regions || []).filter(r => r.validation).sort((a, b) => a.rank - b.rank)
  const ranks = v.map(r => `${r.known_cluster_label || r.id} ${ordinal(r.rank)}`).join(', ')
  return { title: `${n} regions scored from demand alone. ${leads} flagged ${leads === 1 ? 'region is' : 'regions are'} not known datacenter clusters.`, sub: `Validation named in advance: ${ranks}. Flat 24/7 load raises the overnight floor faster than the mean, and the detector reads that fingerprint without a company list.` }
}

// Region page.
export function regionTitle(region, label) {
  const d = region?.demand || {}, cf = region?.cf_share || {}
  const g = d['2025']?.overnight_avg_mw / d['2019']?.overnight_avg_mw - 1
  const o = cf['2025']?.overnight - cf['2019']?.overnight
  const name = label || region?.name || region?.id
  if (!Number.isFinite(g)) return { title: `${name}`, sub: '' }
  const grew = g >= 0 ? `grew ${pct0(g)}` : `fell ${pct0(-g)}`
  const grid = region?.cf_inherited_from_ba ? `The grid serving it (${region.ba})` : 'Its grid'
  const clean = !Number.isFinite(o) ? '' : Math.abs(o) < 0.01 ? `${grid} is no cleaner at night than in 2019.` : o < 0 ? `${grid} is ${pts1(o).replace('−', '')} less clean at night.` : `${grid} is ${pts1(o).replace('+', '')} cleaner at night.`
  return { title: `${name}'s overnight demand ${grew} since 2019. ${clean}`, sub: `Average demand ${n0(d['2019']?.avg_mw)} MW to ${n0(d['2025']?.avg_mw)} MW; overnight ${n0(d['2019']?.overnight_avg_mw)} MW to ${n0(d['2025']?.overnight_avg_mw)} MW.` }
}

// Site page.
export function siteTitle(res) {
  const r = res?.results?.[0], req = res?.request
  if (!r) return { title: 'Where would new flat load be served cleanly?', sub: '' }
  const n = res.results.length
  const share = r.siting?.overnight_cf_share_2025
  return { title: `Of ${n} candidates, ${r.metro} would serve ${n0(req?.mw)} MW of flat load most cleanly at night.`, sub: `Its grid ran ${pct0(share)} clean overnight in 2025. Grid-only, average mix, no contracted power counted; a slope, not a headroom.` }
}

// Verify page.
export function verifyTitle(c) {
  const claims = c?.claims || []
  const primary = claims.find(k => k.verdict === 'true_on_paper' || k.verdict === 'contradicted') || claims[0]
  if (!primary) return { title: `${c?.company || 'Company'}: no claims extracted yet.`, sub: '' }
  const lo = primary.physical_min, hi = primary.physical_max
  const paper = primary.verdict === 'true_on_paper' ? 'true on paper' : primary.verdict === 'contradicted' ? 'contradicted' : primary.verdict?.replace('_', ' ')
  const phys = lo != null && hi != null ? ` Its sites sit on grids that ran ${pct0(lo)} to ${pct0(hi)} clean.` : ''
  const cv = c.cannot_verify_count ?? claims.filter(k => k.verdict === 'cannot_verify').length
  return { title: `${c.company}'s ${primary.metric ? primary.metric.replace(/_/g, ' ') : ''} claim is ${paper}.${phys}`, sub: `${claims.length} claims read, ${cv} cannot be verified from grid data. Grid-only, excluding contracted clean power. The site lookup is hand-curated.` }
}

export function ordinal(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }

// Interpolate the national series along the real yearly path for a progress p in [0,1].
export function interpYears(cf, p, first = 2019, last = 2025) {
  const span = last - first, x = first + Math.min(1, Math.max(0, p)) * span
  const i = Math.min(last - 1, Math.floor(x)), f = x - i
  const a = cf?.[String(i)], b = cf?.[String(i + 1)]
  const mix = k => (a && b ? a[k] + (b[k] - a[k]) * f : a?.[k] ?? null)
  return { year: Math.round(x), yearExact: x, daytime: mix('daytime'), overnight: mix('overnight') }
}
