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
// Biggest talk-over-walk gap first; a company with no talk score sits last.
const gapOf = c => (c.talk_score == null || c.walk_score == null ? -Infinity : c.talk_score - c.walk_score)

// Four companies side by side: what they say (talk) against what their grids do (walk).
export default function Companies() {
  const { loading, error, data, reload } = useAsync(loadCompanies, [])
  const tk = useMemo(() => readTokens(), [])
  const list = data?.companies || []
  const fac = useAsync(loadFacilities, [])
  const facilities = fac.data?.facilities
  const sites = { data: facilities || [] }
  const pts = useMemo(() => (facilities || []).filter(s => s.lat != null), [facilities])
  const globe = useMemo(() => ({ view: fitView(pts), points: pts.map(s => ({ id: `${s.ticker}-${s.metro}`, lat: s.lat, lng: s.lng, r: 0.18, color: tk.ink2 })), markers: pts.map(s => ({ id: `${s.ticker}-${s.metro}`, lat: s.lat, lng: s.lng, label: `${s.ticker} · ${(s.metro || s.name || '').split(',')[0]}`, tip: `${s.serving_utility || s.utility || ''} · ${s.grid_label}${s.cf_share_2025 != null ? ` · ${Math.round(s.cf_share_2025 * 100)}% clean` : ''}${s.ticker_utility ? ` · ${s.ticker_utility}` : ' · no listed equity'}`, href: href.region(s.region_id), color: tk.ink2 })) }), [pts, tk])
  const crumbs = useCrumbs(useHash())
  const back = () => { window.location.hash = href.landing() }
  let column
  const crumb = <Breadcrumbs trail={crumbs} onBack={back} />
  if (loading) column = <>{crumb}<Card title={<b>Companies</b>} onClose={back}><Loading what="the watchlist" /></Card></>
  else if (error) column = <>{crumb}<Card title={<b>Companies</b>} onClose={back}><ErrorState error={error} onRetry={reload} /></Card></>
  else {
    const withWalk = list.filter(c => c.walk_score != null)
    const best = [...withWalk].sort((a, b) => b.walk_score - a.walk_score)[0], worst = [...withWalk].sort((a, b) => a.walk_score - b.walk_score)[0]
    const sentence = best && worst && best !== worst ? `Clean-power claims look alike on paper; the grids underneath them are ${Math.round((best.walk_score - worst.walk_score) * 100)} points apart. ${best.company}'s sites draw power that was ${pct0(best.walk_score)} carbon-free in 2025, ${worst.company}'s ${pct0(worst.walk_score)}${worst.n_sites === 1 ? ' at its one mapped site' : ''}. An annual certificate shows none of that.` : `${list.length} companies, checked against the grids their sites actually draw from.`
    const cv = list.reduce((a, c) => a + (c.cannot_verify_count || 0), 0), n = list.reduce((a, c) => a + (c.n_claims || 0), 0)
    const ordered = [...list].sort((a, b) => gapOf(b) - gapOf(a))
    const rows = ordered.map(c => ({ id: c.ticker, label: c.company, a: to100(c.talk_score), b: to100(c.walk_score), href: href.check(c.ticker) }))
    const order = new Map(ordered.map((c, i) => [c.ticker, i]))
    const siteRows = [...(sites.data || [])].sort((x, y) => ((order.get(x.ticker) ?? 99) - (order.get(y.ticker) ?? 99)) || ((x.detector_rank ?? 999) - (y.detector_rank ?? 999)))
    const noEquity = fac.data?.no_listed_equity_count
    column = (
      <>
        {crumb}
        <Card title={<><b>Companies</b> · what they claim against what their grids generate{data.is_mock && <> · <span className="accent">mock</span></>}</>} right={<CopyButton text={() => window.location.href} label="Copy link" />} onClose={back}>
          <h1 className="verdict">{sentence}</h1>
          <div className="nums"><Num value={String(list.length)} label="companies with claims read" sub="checked against the grid, not their paperwork" /><Num value={String(n)} label="claims pulled from filings" sub={`${cv} that grid data cannot settle either way`} /><Num value={String(pts.length)} label="sites located" sub={noEquity != null ? `${noEquity} sit on public power — no stock to trade` : 'found from the serving utility, never the state'} /></div>
          <p className="note" style={{ marginTop: 12 }}>Talk is how big and unhedged the claim is. Walk is what the grids under its sites actually generated — no contracts, no certificates, just the power on the wire. When walk sits below talk, the difference was bought somewhere else, not generated where the servers are.</p>
        </Card>
        <Card title={<>What each company <b>claims</b>, against what its grids <b>generate</b></>}>
          <Dumbbell rows={rows} aLabel="talk" bLabel="walk" />
          <ul className="co-lines">
            {ordered.map(c => (
              <li key={c.ticker}><a href={href.check(c.ticker)}><b>{c.ticker}</b></a> {plural(c.n_claims, 'claim')} read across {plural(c.n_sites, 'site')} · grid data settles {pct0(c.coverage)} of them{c.cannot_verify_count ? `, ${c.cannot_verify_count} it cannot` : ''}</li>
            ))}
          </ul>
          <p className="note" style={{ marginTop: 12 }}>A wide line means the company bought clean power in one place and runs its servers somewhere else. That is legal and true under annual market-based accounting, but it is not the same electricity. The line turns ember past a 20-point gap.</p>
        </Card>
        <Card title={<><b>Sites</b> · {sites.data.length} buildings on {new Set(siteRows.map(s => s.region_id)).size} grids, each traced to the utility that actually serves it</>}>
          {fac.loading && <Loading what="the sites" />}
          {!fac.loading && !siteRows.length && <p className="note">No mapped sites in this data source.</p>}
          {siteRows.length > 0 && (
            <div className="rows co-rows">
              {siteRows.map(s => (
                <a className="row co-site" key={`${s.ticker}-${s.metro}-${s.serving_utility}`} href={href.region(s.region_id)}>
                  <div>
                    <div className="t">{s.metro || s.name}{s.state ? `, ${s.state}` : ''} <span className="muted">{s.ticker}</span></div>
                    <div className="d">{s.serving_utility || 'utility unknown'} · {s.utility_parent || '—'} · {s.ticker_utility || 'publicly owned, no stock to trade'}{s.growth_pct != null ? ` · demand ${s.growth_pct >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(s.growth_pct))}% since 2019` : ''}</div>
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
