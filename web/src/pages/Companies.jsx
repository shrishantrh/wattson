import { useMemo } from 'react'
import Shell, { fitView } from '../console/Console.jsx'
import { Card, Num } from '../console/widgets.jsx'
import { CopyButton } from '../components/CopyButton.jsx'
import Dumbbell from '../components/Dumbbell.jsx'
import { loadCompanies, loadFacilities, useAsync } from '../lib/data.js'
import { readTokens } from '../lib/tokens.js'
import { pct0 } from '../lib/findings.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { href, useHash } from '../router.js'
import '../styles/companies.css'
import '../styles/pages.css'
import Breadcrumbs, { useCrumbs } from '../components/Breadcrumbs.jsx'

const to100 = v => (v == null ? null : Number(v) * 100)
const plural = (n, one, many = `${one}s`) => (n == null ? `— ${many}` : `${n} ${n === 1 ? one : many}`)
// Biggest talk-over-walk gap first; an operator with no claim read has no gap and sits last.
const gapOf = c => (c.talk_score == null || c.walk_score == null ? -Infinity : c.talk_score - c.walk_score)
// The route key. An operator with no listed equity has a null ticker and routes on its id.
const keyOf = c => c.id || c.ticker
// Why an operator's claims column is empty. Never left to the reader to infer.
const ABSENT = { no_documents_ingested: 'no documents read', no_site_resolved: 'no site we could map' }

// Four companies side by side: what they say (talk) against what their grids do (walk).
export default function Companies() {
  const { loading, error, data, reload } = useAsync(loadCompanies, [])
  const tk = useMemo(() => readTokens(), [])
  const list = data?.companies || []
  const fac = useAsync(loadFacilities, [])
  const facilities = fac.data?.facilities
  const sites = { data: facilities || [] }
  const pts = useMemo(() => (facilities || []).filter(s => s.lat != null), [facilities])
  const globe = useMemo(() => ({ view: fitView(pts), points: pts.map(s => ({ id: `${s.operator_key || s.ticker}-${s.metro}`, lat: s.lat, lng: s.lng, r: 0.18, color: tk.ink2 })), markers: pts.map(s => ({ id: `${s.operator_key || s.ticker}-${s.metro}`, lat: s.lat, lng: s.lng, label: `${s.operator_key || s.ticker} · ${(s.metro || s.name || '').split(',')[0]}`, tip: `${s.serving_utility || s.utility || ''} · ${s.grid_label}${s.cf_share_2025 != null ? ` · ${Math.round(s.cf_share_2025 * 100)}% of its 2025 power clean` : ''}${s.ticker_utility ? ` · ${s.ticker_utility}` : s.serving_utility ? ' · no stock to trade' : ' · serving utility not established'}`, href: href.region(s.region_id), color: tk.ink2 })) }), [pts, tk])
  const crumbs = useCrumbs(useHash())
  const back = () => { window.location.hash = href.landing() }
  let column
  const crumb = <Breadcrumbs trail={crumbs} onBack={back} />
  if (loading) column = <>{crumb}<Card title={<b>Companies</b>} onClose={back}><Loading what="the watchlist" /></Card></>
  else if (error) column = <>{crumb}<Card title={<b>Companies</b>} onClose={back}><ErrorState error={error} onRetry={reload} /></Card></>
  else {
    const withWalk = list.filter(c => c.walk_score != null)
    // The spread is drawn ONLY from operators whose documents we have actually read. An
    // operator we hold no claim on has made no claim we can speak to, and naming it in a
    // sentence about what clean-power claims look like would put words in its mouth.
    const claimed = withWalk.filter(c => c.n_claims > 0)
    const spread = claimed.length > 1 ? claimed : withWalk
    const best = [...spread].sort((a, b) => b.walk_score - a.walk_score)[0], worst = [...spread].sort((a, b) => a.walk_score - b.walk_score)[0]
    const sentence = best && worst && best !== worst ? `Clean-power claims look alike on paper; the grids underneath them are ${Math.round((best.walk_score - worst.walk_score) * 100)} points apart. The grids under ${best.company}'s sites generated ${pct0(best.walk_score)} carbon-free power in 2025, those under ${worst.company}'s ${pct0(worst.walk_score)}${worst.n_sites === 1 ? ' at its one mapped site' : ''}. An annual certificate shows none of that.` : `${list.length} companies, checked against the grids their sites actually draw from.`
    const cv = list.reduce((a, c) => a + (c.cannot_verify_count || 0), 0), n = list.reduce((a, c) => a + (c.n_claims || 0), 0)
    const ordered = [...list].sort((a, b) => gapOf(b) - gapOf(a))
    const rows = ordered.filter(c => c.walk_score != null || c.talk_score != null)
      .map(c => ({ id: keyOf(c), label: c.company, a: to100(c.talk_score), b: to100(c.walk_score), href: href.check(keyOf(c)) }))
    const order = new Map(ordered.map((c, i) => [keyOf(c), i]))
    const withClaims = list.filter(c => c.n_claims > 0)
    const noDocs = list.filter(c => c.coverage_status === 'sites_only')
    const unmapped = list.filter(c => c.coverage_status === 'no_site_resolved')
    const siteRows = [...(sites.data || [])].sort((x, y) => ((order.get(x.operator_key || x.ticker) ?? 99) - (order.get(y.operator_key || y.ticker) ?? 99)) || ((x.detector_rank ?? 999) - (y.detector_rank ?? 999)))
    const noEquity = fac.data?.no_listed_equity_count
    // 3 sites have no serving utility established at all. They are not public power and
    // they are not tradable; saying so is the difference between a gap and a finding.
    const noUtility = fac.data?.unresolved_utility_count
    column = (
      <>
        {crumb}
        <Card title={<><b>Companies</b> · what they claim against what their grids generate{data.is_mock && <> · <span className="accent">mock</span></>}</>} right={<CopyButton text={() => window.location.href} label="Copy link" />} onClose={back}>
          <h1 className="verdict">{sentence}</h1>
          <div className="nums"><Num value={String(list.length)} label="operators in the data" sub={`${withClaims.length} with their own documents read${noDocs.length ? `, ${noDocs.length} mapped to grids without` : ''}${unmapped.length ? `, ${unmapped.length} we could not map` : ''}`} /><Num value={String(n)} label="claims pulled from filings" sub={`${cv} that grid data cannot settle either way`} /><Num value={String(pts.length)} label="sites located" sub={noEquity != null ? `${noEquity} sit on public power — no stock to trade${noUtility ? `, ${noUtility} with no serving utility established` : ''}` : 'found from the serving utility, never the state'} /></div>
          <p className="note" style={{ marginTop: 12 }}>Talk is how big and unhedged the claim is. Walk is what the grids under its sites actually generated — no contracts, no certificates, just the power on the wire. When walk sits below talk, the difference was bought somewhere else, not generated where the servers are.</p>
        </Card>
        <Card title={<>What each company <b>claims</b>, against what its grids <b>generate</b></>}>
          <Dumbbell rows={rows} aLabel="talk" bLabel="walk" />
          <ul className="co-lines">
            {ordered.map(c => (
              <li key={keyOf(c)}><a href={href.check(keyOf(c))}><b>{c.ticker || c.id}</b></a> {c.n_claims ? <>{plural(c.n_claims, 'claim')} read across {plural(c.n_sites, 'site')} · grid data for {pct0(c.coverage)} of those sites{c.cannot_verify_count ? `, ${plural(c.cannot_verify_count, 'claim')} we could not check` : ''}</> : <>{ABSENT[c.claims_absent_reason] || 'no claims read'} · {c.n_sites ? <>{plural(c.n_sites, 'site')} on the grid, {pct0(c.walk_score)} of that power carbon-free in 2025</> : 'nothing to measure'}</>}</li>
            ))}
          </ul>
          <p className="note" style={{ marginTop: 12 }}>Operators with no line have no claim of their own read yet; their grid figures are measured all the same, and the reason the claims column is empty is stated on each one's page. A wide line means the company bought clean power in one place and runs its servers somewhere else. That is legal and true under annual market-based accounting, but it is not the same electricity. The line turns ember past a 20-point gap.</p>
        </Card>
        <Card title={<><b>Sites</b> · {sites.data.length} buildings on {new Set(siteRows.map(s => s.region_id)).size} grids · {siteRows.filter(s => s.serving_utility).length} traced to the utility that serves them</>}>
          {fac.loading && <Loading what="the sites" />}
          {!fac.loading && !siteRows.length && <p className="note">No mapped sites in this data source.</p>}
          {siteRows.length > 0 && (
            <div className="rows co-rows">
              {siteRows.map(s => (
                <a className="row co-site" key={`${s.operator_key || s.ticker}-${s.metro}-${s.serving_utility}`} href={href.region(s.region_id)}>
                  <div>
                    <div className="t">{s.metro || s.name}{s.state ? `, ${s.state}` : ''} <span className="muted">{s.ticker || s.operator_key}</span></div>
                    <div className="d">{s.serving_utility || 'utility unknown'} · {s.utility_parent || '—'} · {s.ticker_utility || (s.serving_utility ? 'no stock to trade' : 'no utility to price')}{s.growth_pct != null ? ` · demand ${s.growth_pct >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(s.growth_pct))}% since 2019` : ''}</div>
                  </div>
                  <div className="n">{pct0(s.cf_share_2025)} <small>of this grid's 2025 power</small></div>
                </a>
              ))}
            </div>
          )}
          <p className="note" style={{ marginTop: 10 }}>The ticker is the utility selling the power, not the company running the servers. "Clean" is the share of electricity generated on that grid in 2025, all hours — contracted power excluded, which is why these sit below the figures the companies report. Click a site for its grid.</p>
        </Card>
      </>
    )
  }
  return <Shell page="companies" globe={globe} column={column} columnWidth={480} />
}
