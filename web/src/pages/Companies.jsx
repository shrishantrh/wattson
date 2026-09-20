import { useMemo } from 'react'
import Shell, { fitView } from '../console/Console.jsx'
import { Card, Num } from '../console/widgets.jsx'
import { CopyButton } from '../components/CopyButton.jsx'
import Dumbbell from '../components/Dumbbell.jsx'
import Table from '../components/Table.jsx'
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

// Every operator side by side: what they say (talk) against what their grids do (walk).
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
    // Two different sentences, and which one is true depends on the data, not on us.
    //
    // The named comparison is drawn ONLY from operators whose documents we have read. An
    // operator we hold no claim on has made no claim we can speak to, and naming it in a
    // sentence about what clean-power claims look like would put words in its mouth --
    // which is what happened when this ranged over all 52 and opened on Vantage.
    //
    // With every hyperscaler site mapped, those four converge on ~46%: the spread collapses
    // and "46% against 46%, 1 points apart" is not a finding. So below a 3-point spread the
    // page says the convergence itself, which is the stronger fact anyway. The full range is
    // stated separately and as GRIDS, never as claims.
    const hi = a => [...a].sort((x, y) => y.walk_score - x.walk_score)[0]
    const lo = a => [...a].sort((x, y) => x.walk_score - y.walk_score)[0]
    const claimed = withWalk.filter(c => c.n_claims > 0)
    const best = hi(claimed.length > 1 ? claimed : withWalk), worst = lo(claimed.length > 1 ? claimed : withWalk)
    const gap = best && worst ? Math.round((best.walk_score - worst.walk_score) * 100) : null
    const allHi = hi(withWalk), allLo = lo(withWalk)
    const allLine = allHi && allLo && allHi !== allLo
      ? ` Across all ${withWalk.length} operators we mapped, the grids under their sites run from ${pct0(allLo.walk_score)} to ${pct0(allHi.walk_score)}.` : ''
    const sentence = !best || !worst ? `${list.length} companies, checked against the grids their sites actually draw from.`
      : gap >= 3
        ? `Clean-power claims look alike on paper; the grids underneath them are ${gap} point${gap === 1 ? '' : 's'} apart. The grids under ${best.company}'s sites generated ${pct0(best.walk_score)} carbon-free power in 2025, those under ${worst.company}'s ${pct0(worst.walk_score)}${worst.n_sites === 1 ? ' at its one mapped site' : ''}. An annual certificate shows none of that.${allLine}`
        : `The ${claimed.length} operators whose reports we have read all draw from grids that generated about ${pct0(best.walk_score)} carbon-free power in 2025 — ${gap === 0 ? 'no measurable spread between them' : `${gap} point${gap === 1 ? '' : 's'} between them`}, behind claims that are nothing alike. An annual certificate shows none of that.${allLine}`
    const cv = list.reduce((a, c) => a + (c.cannot_verify_count || 0), 0), n = list.reduce((a, c) => a + (c.n_claims || 0), 0)
    const ordered = [...list].sort((a, b) => gapOf(b) - gapOf(a))
    const rows = ordered.filter(c => c.walk_score != null || c.talk_score != null)
      .map(c => ({ id: keyOf(c), label: c.company, a: to100(c.talk_score), b: to100(c.walk_score), href: href.check(keyOf(c)) }))
    const order = new Map(ordered.map((c, i) => [keyOf(c), i]))
    const withClaims = list.filter(c => c.n_claims > 0)
    const noDocs = list.filter(c => c.coverage_status === 'sites_only')
    const unmapped = list.filter(c => c.coverage_status === 'no_site_resolved')
    // The written lines are the operators whose own documents we have read, in the same
    // order as the dumbbell. The table below carries every operator, and its claims column
    // states why the rest have nothing read — so no operator goes unexplained either way.
    const lines = ordered.filter(c => c.n_claims > 0)
    const siteRows = [...(sites.data || [])].sort((x, y) => ((order.get(x.operator_key || x.ticker) ?? 99) - (order.get(y.operator_key || y.ticker) ?? 99)) || ((x.detector_rank ?? 999) - (y.detector_rank ?? 999)))
    const noEquity = fac.data?.no_listed_equity_count
    // 3 sites have no serving utility established at all. They are not public power and
    // they are not tradable; saying so is the difference between a gap and a finding.
    const noUtility = fac.data?.unresolved_utility_count
    column = (
      <>
        {crumb}
        <Card title={<><b>Companies</b> · talk vs walk{data.is_mock && <> · <span className="accent">mock</span></>}</>} right={<CopyButton text={() => window.location.href} label="Copy link" />} onClose={back}>
          <p className="pg-top">What these operators say about clean power, against what their grids actually ran on — {plural(withClaims.length, 'operator')} with their own documents read, {list.length} measured against the grid either way.</p>
          <p className="verdict" style={{ marginTop: 14 }}>{sentence}</p>
          <div className="nums"><Num value={String(list.length)} label="operators in the data" sub={`${withClaims.length} with their own documents read${noDocs.length ? `, ${noDocs.length} mapped to grids without` : ''}${unmapped.length ? `, ${unmapped.length} we could not map` : ''}`} /><Num value={String(n)} label="claims pulled from filings" sub={`${cv} that grid data cannot settle either way`} /><Num value={String(pts.length)} label="sites located" sub={noEquity != null ? `${noEquity} sit on public power — no stock to trade${noUtility ? `, ${noUtility} with no serving utility established` : ''}` : 'found from the serving utility, never the state'} /></div>
          <p className="note pg-fine">Talk is how big and unhedged the claim is. Walk is what the grids under its sites actually generated — the clean share of generation on those grids, averaged, grid-only, contracted power excluded. No contracts, no certificates, just the power on the wire. When walk sits below talk, the difference was bought somewhere else, not generated where the servers are.</p>
        </Card>
        <Card title={<>What each company <b>claims</b>, against what its grids <b>generate</b></>}>
          <Dumbbell rows={rows} aLabel="talk" bLabel="walk" />
          {lines.length > 0 && (
            <ul className="co-lines">
              {lines.map(c => (
                <li key={keyOf(c)}><a href={href.check(keyOf(c))}><b>{c.ticker || c.id}</b></a> {plural(c.n_claims, 'claim')} read across {plural(c.n_sites, 'site')} · grid data for {pct0(c.coverage)} of those sites{c.cannot_verify_count ? `, ${plural(c.cannot_verify_count, 'claim')} we could not check` : ''}</li>
              ))}
            </ul>
          )}
          <div className="co-tbl">
            <Table
              columns={[
                { key: 'company', label: 'Operator', width: 152, raw: c => `${c.company} · ${c.ticker || c.id}`, title: 'The operator running the servers, and the key its page routes on' },
                { key: 'n_claims', label: 'Claims', width: 124, format: (v, c) => (v ? plural(v, 'claim') : ABSENT[c.claims_absent_reason] || 'no claims read'), sortValue: c => (c.n_claims == null ? -1 : c.n_claims), title: 'Claims read from this operator’s own documents, or why there are none' },
                { key: 'n_sites', label: 'Sites', num: true, width: 56, title: 'Sites we mapped to a grid' },
                { key: 'cannot_verify_count', label: 'No check', num: true, width: 74, format: (v, c) => (c.n_claims ? String(v ?? 0) : '—'), title: 'Claims the grid data cannot speak to' },
                { key: 'coverage', label: 'Cover', num: true, width: 62, format: v => pct0(v), title: 'Share of this operator’s sites with grid data behind them' },
              ]}
              rows={ordered}
              rowKey={c => keyOf(c)}
              rowHref={c => href.check(keyOf(c))}
              filter="Filter operators"
              emptyText="No operators in this data source."
              dense
            />
          </div>
          <p className="note pg-fine">Every operator here is measured against its grid; the lines above are the ones whose own documents we have read, and the table says why the claims column is empty for the rest. The gap between talk and walk is the story, not a verdict on honesty: annual matching is true under the market-based method. A wide line means clean power bought in one place and servers running somewhere else — legal, and not the same electricity. The line turns ember past a 20-point gap.</p>
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
          <p className="note pg-fine">Parent and ticker describe the serving utility's owner, not the operator. Clean 2025 is the share of generation on that grid, all hours, grid-only — which is why it sits below the figures the companies report. Sites are on the globe; click one for its grid.</p>
        </Card>
      </>
    )
  }
  return <Shell page="companies" globe={globe} column={column} columnWidth={480} />
}
