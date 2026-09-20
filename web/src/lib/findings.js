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
  const parts = []
  if (tot != null) parts.push(tot > 0 ? `The grid made ${gw1(tot)} more power in those hours anyway.` : `The grid made ${gw1(tot)} less power in those hours.`)
  const coal = pjm.fuel_delta_overnight_gw?.coal
  if (gas != null) parts.push(`${b - a <= 0 ? 'None of that growth was clean. ' : ''}Gas rose ${signedGw(gas).replace('+', '')}${coal != null && coal < 0 ? `, more than the growth itself, because it also replaced ${signedGw(coal).replace('−', '')} of retired coal` : ''}.`)
  if (ex0 != null && ex1 != null) parts.push(ex1 < ex0 ? `It was not for the neighbors either: net exports fell from ${gw1(ex0)} to ${gw1(ex1)}, so the extra power stayed inside PJM.` : `Net exports rose from ${gw1(ex0)} to ${gw1(ex1)}, so some of the extra power left PJM.`)
  return { title: `PJM's clean power at night ${verb} since ${baseline}.`, sub: parts.join(' ') }
}

// Opening: the national day/night split.
export function nationalTitle(cf, baseline = '2019', latest = '2025') {
  const d = cf?.[latest]?.daytime - cf?.[baseline]?.daytime, o = cf?.[latest]?.overnight - cf?.[baseline]?.overnight
  if (!Number.isFinite(d) || !Number.isFinite(o)) return { title: 'Daytime and overnight clean share since 2019', sub: '' }
  const nightVerb = Math.abs(o) < 0.01 ? 'stood still' : o < 0 ? `fell ${pts1(o).replace('−', '')}` : `rose ${pts1(o).replace('+', '')}`
  return { title: `Since ${baseline} the grid cleaned up by day and ${nightVerb} at night.`, sub: `The day gained ${pts1(d).replace('+', '')} since ${baseline}: ${pct1(cf[baseline].daytime)} to ${pct1(cf[latest].daytime)}. The night ${nightVerb}: ${pct1(cf[baseline].overnight)} to ${pct1(cf[latest].overnight)}${o < 0 ? ' — a smaller slice of a bigger night, not less clean power' : ''}. A datacenter draws the same power at 3am as at noon, so the load the AI buildout adds runs on the hours that never improved.` }
}

// Opening: the detector map.
export function detectorTitle(det) {
  const n = det?.n_scored, leads = det?.new_leads?.length ?? 0
  const v = (det?.regions || []).filter(r => r.validation).sort((a, b) => a.rank - b.rank)
  const ranks = v.map(r => `${r.known_cluster_label || r.id} ${ordinal(r.rank)}`).join(', ')
  const hits = v.filter(r => r.rank <= 20), miss = v.filter(r => r.rank > 20)
  return { title: `The demand data finds the datacenters by itself: ${n} regions ranked with no company list, and ${leads} of the top ten ${leads === 1 ? 'is a place' : 'are places'} nobody has called a datacenter cluster.`, sub: `Flat 24/7 load lifts a region's night-time floor faster than its average, and that is the only thing the detector reads. We named ${v.length} known clusters before we saw the ranking, so the test could fail: ${ranks}. ${hits.length} landed in the top 20${miss.length ? `; ${miss.map(r => r.known_cluster_label || r.id).join(', ')} did not, and the miss stands` : ''}.` }
}

// The engine's corrected 2019 overnight clean share, when it published one.
export const correctedBaseline = region => { const c = (region?.corrections?.corrections || region?.parent?.corrections?.corrections || []).find(x => x.path === 'cf_share.2019'); return c?.corrected?.overnight ?? null }

// Region page.
export function regionTitle(region, label) {
  const d = region?.demand || {}, cf = region?.cf_share || {}
  const g = d['2025']?.overnight_avg_mw / d['2019']?.overnight_avg_mw - 1
  // When the engine has corrected the 2019 baseline (AZPS counted SRP's nuclear), the change is
  // measured from the corrected figure, and the sentence says so.
  const corr = correctedBaseline(region)
  const sitingChange = region?.siting?.change_since_2019 ?? region?.parent?.siting?.change_since_2019
  const o = corr != null ? (cf['2025']?.overnight ?? region?.siting?.overnight_cf_share_2025) - corr : (sitingChange ?? (cf['2025']?.overnight - cf['2019']?.overnight))
  const name = label || region?.name || region?.id
  if (!Number.isFinite(g)) return { title: `${name}`, sub: '' }
  const grew = g >= 0 ? `grew ${pct0(g)}` : `fell ${pct0(-g)}`
  const grid = region?.cf_inherited_from_ba ? `The grid serving it (${region.ba})` : 'Its grid'
  const clean = !Number.isFinite(o) ? '' : Math.abs(o) < 0.01 ? `${grid} got no cleaner after dark over the same years — its night clean share is where it was in 2019.` : o < 0 ? `${grid} got no cleaner after dark over the same years — its night clean share is ${pts1(o).replace('−', '')} lower than in 2019.` : `${grid} did get cleaner after dark — its night clean share is ${pts1(o).replace('+', '')} higher than in 2019.`
  return { title: `${name}'s overnight demand ${grew} since 2019. ${clean}${corr != null ? ' (from the corrected 2019 figure)' : ''}`, sub: `Average demand ${n0(d['2019']?.avg_mw)} MW to ${n0(d['2025']?.avg_mw)} MW; overnight ${n0(d['2019']?.overnight_avg_mw)} MW to ${n0(d['2025']?.overnight_avg_mw)} MW.` }
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

// ---------- plain-English answers for the two questions ----------
import caveats from '../data/data_caveats.json'
export const caveatFor = id => caveats[id] || (id && id.includes('/') ? caveats[id.split('/')[0]] : null) || null
// Direction from the change since 2019 (points); the per-year slope only when that is missing.
const trendWord = (chg, slope) => (chg != null ? (chg > 0.01 ? 'improving' : chg < -0.01 ? 'getting worse' : 'holding steady') : slope == null ? 'with no trend data' : slope > 0.005 ? 'improving' : slope < -0.005 ? 'getting worse' : 'holding steady')

// What we hold on an operator, in its own words. Three values, set by the engine, never
// inferred here from an empty array: an operator with no claims is a statement about OUR
// document coverage, and the screen has to say which of the two it is looking at.
export const COVERAGE_LINE = {
  sites_only: 'We have read no documents from this operator. Its sites and their grids are measured; there is no claim of its own to hold against them.',
  no_site_resolved: 'We could not tie a single site to the utility that serves it, so there is no grid to check. Recorded as an unmapped operator rather than given a grid it may not draw from.',
}

export function checkAnswer(c) {
  const claims = c?.claims || [], sites = c?.sites || []
  const primary = claims.find(k => k.magnitude != null && ['true_on_paper', 'contradicted'].includes(k.verdict)) || claims.find(k => k.magnitude != null) || claims[0]
  const cv = c?.cannot_verify_count ?? 0
  // No claim read. Say so as a coverage fact and show the grid figures we do have, which
  // for a mapped operator is most of the screen: sites, serving utilities, clean shares.
  if (!primary) {
    const status = c?.coverage_status || (sites.length ? 'sites_only' : 'no_site_resolved')
    const shares = sites.map(s => s.cf_share_2025).filter(v => v != null)
    const lo = shares.length ? Math.min(...shares) : null, hi = shares.length ? Math.max(...shares) : null
    const range = lo == null ? null : Math.round(lo * 100) === Math.round(hi * 100) ? `${Math.round(lo * 100)}%` : `${Math.round(lo * 100)}–${Math.round(hi * 100)}%`
    const name = c?.company || 'This operator'
    if (status === 'no_site_resolved' || !sites.length) {
      return {
        sentence: `We have not mapped a single ${name} site to the utility that serves it, so there is nothing here to check. That is a gap in our coverage, not a finding about them.`,
        verdict: null, primary: null, coverage_status: 'no_site_resolved', claims_absent_reason: c?.claims_absent_reason || 'no_site_resolved',
        numbers: [
          { value: '0', label: 'sites mapped', sub: 'no site tied to a named serving utility' },
          { value: '0', label: 'claims read', sub: 'nothing to hold against a grid' },
        ],
      }
    }
    const traced = sites.filter(x => x.serving_utility).length
    const where = sites.length === 1 ? 'The grid under its one mapped site' : `The grids under its ${sites.length} mapped sites`
    return {
      sentence: `We have read no documents from ${name}, so there is no claim of its own to check. What we can measure is where it draws power. ${where} generated ${range} carbon-free power in 2025.`,
      verdict: null, primary: null, coverage_status: 'sites_only', claims_absent_reason: c?.claims_absent_reason || 'no_documents_ingested',
      numbers: [
        { value: c?.walk_score != null ? pct0(c.walk_score) : range || '—', label: sites.length === 1 ? 'its site\u2019s grid' : 'its sites\u2019 grids', sub: 'carbon-free share of 2025 generation, all hours', accent: true },
        // Only say 'traced from the serving utility' about sites where we actually named one.
        // Cipher's Wink and the Ellendale campus have no established serving utility: their BA is
        // the operator's own attribution, and the stat must not launder that into a trace.
        { value: String(sites.length), label: sites.length === 1 ? 'site mapped' : 'sites mapped', sub: traced === sites.length ? 'traced from the serving utility, never the state' : traced ? `${traced} traced from the serving utility, ${sites.length - traced} with none established` : 'grid is the operator\u2019s own attribution; no serving utility established' },
        { value: '0', label: 'claims read', sub: 'no documents ingested from this operator' },
      ],
    }
  }
  const claimed = primary.metric === 'renewable_electricity_share' && primary.unit === 'fraction' ? `${Math.round(primary.magnitude * 100)}% renewable` : primary.metric === 'contracted_capacity_mw' ? `${n0(primary.magnitude)} MW of contracted clean power` : primary.magnitude != null ? `${primary.magnitude} ${primary.unit || ''}`.trim() : (primary.metric || 'a clean-energy claim').replace(/_/g, ' ')
  const verdictText = { true_on_paper: 'True on paper.', contradicted: 'Contradicted by its own filings.', unfalsifiable: 'Too vague to check.', cannot_verify: "Can't be checked from grid data." }[primary.verdict] || ''
  const lo = primary.physical_min, hi = primary.physical_max
  const range = lo != null && hi != null ? (Math.round(lo * 100) === Math.round(hi * 100) ? `${Math.round(lo * 100)}%` : `${Math.round(lo * 100)}–${Math.round(hi * 100)}%`) : null
  const phys = range ? (sites.length === 1 ? ` The grid under its one mapped site generated ${range} clean power.` : ` Physically, its sites run on ${range} clean power.`) : ''
  return {
    sentence: `${c.company} says ${claimed}. ${verdictText}${phys}`,
    verdict: primary.verdict, primary,
    numbers: [
      { value: primary.metric === 'renewable_electricity_share' ? pct0(primary.magnitude) : claimed, label: 'claimed', sub: primary.scope ? primary.scope.replace(/_/g, ' ') : null },
      // A claim we cannot verify has no physical range, but the company's sites still have
      // a measured grid share. Show it, and label it so it never reads as a verification
      // of the claim it sits beside.
      range
        ? { value: range, label: sites.length === 1 ? 'actually clean at the site' : 'actually clean, by site', sub: 'grid average, all hours', accent: true }
        : { value: c.walk_score != null ? pct0(c.walk_score) : '—', label: sites.length === 1 ? 'its site\u2019s grid' : 'its sites\u2019 grids', sub: c.walk_score != null ? 'grid average, all hours \u2014 not a check of this claim' : 'no mapped site with grid data', accent: true },
      { value: String(sites.length), label: sites.length === 1 ? 'site checked' : 'sites checked', sub: cv ? `${cv} claim${cv === 1 ? '' : 's'} can't be verified` : null },
    ],
  }
}

export function compareAnswer(res, { shapeLabel } = {}) {
  const cs = res?.candidates || []
  if (!cs.length) return { sentence: 'No known locations to compare.', numbers: [] }
  const share = c => c.siting?.overnight_cf_share_2025, s = c => c.siting?.ratio_slope_per_year, chg = c => c.siting?.change_since_2019
  const best = cs[0]
  // In rank order, so the words match the numbers. The frozen score ranks on level, direction and
  // headroom, so a place whose corrected history rises from a very low base can rank above a cleaner
  // one; when that happens the sentence says so instead of hiding it.
  let sentence = shapeLabel
    ? `For a ${shapeLabel} load, ${best.metro} is your cleanest option: ${pct0(share(best))} clean power over the hours it would use.`
    : `${best.metro} is your cleanest option: ${pct0(share(best))} clean power at night and ${trendWord(chg(best), s(best))}.`
  cs.slice(1).forEach((c, i) => {
    const cav = caveatFor(c.region_id)
    const cleanerBelow = cs.slice(i + 2).some(o => (share(o) ?? -1) > (share(c) ?? -1))
    if (shapeLabel) sentence += ` ${c.metro} is ${pct0(share(c))}.`
    else if (cav && cleanerBelow) sentence += ` ${c.metro} ranks ${ordinal(c.rank)} on the score because its corrected history is rising from a very low base, but it runs on ${pct0(share(c))} clean at night today.`
    else if (cav) sentence += ` ${c.metro} is ${pct0(share(c))}; its published history is corrected here, so read its trend with care.`
    else sentence += ` ${c.metro} is ${pct0(share(c))} and ${trendWord(chg(c), s(c))}.`
  })
  return { sentence, best, numbers: cs.map(c => ({ value: pct0(share(c)), raw: share(c), label: `${c.rank}. ${c.metro}`, sub: caveatFor(c.region_id) ? 'history corrected' : trendWord(chg(c), s(c)), accent: c === best })) }
}
