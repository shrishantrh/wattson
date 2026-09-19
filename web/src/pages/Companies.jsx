import { useMemo } from 'react'
import Shell, { fitView } from '../console/Console.jsx'
import { Card, Num } from '../console/widgets.jsx'
import { CopyButton } from '../components/CopyButton.jsx'
import Dumbbell from '../components/Dumbbell.jsx'
import { loadCompanies, loadFacilities, useAsync } from '../lib/data.js'
import { readTokens } from '../lib/tokens.js'
import { pct0 } from '../lib/findings.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { href } from '../router.js'
import '../styles/companies.css'
import '../styles/pages.css'

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
  const back = () => { window.location.hash = href.landing() }
  let column
  if (loading) column = <Card title={<b>Companies</b>} onClose={back}><Loading what="the watchlist" /></Card>
  else if (error) column = <Card title={<b>Companies</b>} onClose={back}><ErrorState error={error} onRetry={reload} /></Card>
  else {
    const withWalk = list.filter(c => c.walk_score != null)
    const best = [...withWalk].sort((a, b) => b.walk_score - a.walk_score)[0], worst = [...withWalk].sort((a, b) => a.walk_score - b.walk_score)[0]
    const sentence = best && worst && best !== worst ? `${best.company} walks the most: ${pct0(best.walk_score)} clean across its mapped sites. ${worst.company} walks the least at ${pct0(worst.walk_score)}${worst.talk_score != null ? `, while talking at ${pct0(worst.talk_score)}` : ''}.` : 'Four companies, grid-only, hourly data.'
    const cv = list.reduce((a, c) => a + (c.cannot_verify_count || 0), 0), n = list.reduce((a, c) => a + (c.n_claims || 0), 0)
    const ordered = [...list].sort((a, b) => gapOf(b) - gapOf(a))
    const rows = ordered.map(c => ({ id: c.ticker, label: c.company, a: to100(c.talk_score), b: to100(c.walk_score), href: href.check(c.ticker) }))
    const order = new Map(ordered.map((c, i) => [c.ticker, i]))
    const siteRows = [...(sites.data || [])].sort((x, y) => ((order.get(x.ticker) ?? 99) - (order.get(y.ticker) ?? 99)) || ((x.detector_rank ?? 999) - (y.detector_rank ?? 999)))
    const noEquity = fac.data?.no_listed_equity_count
    column = (
      <>
        <Card title={<><b>Companies</b> · talk vs walk{data.is_mock && <> · <span className="accent">mock</span></>}</>} right={<CopyButton text={() => window.location.href} label="Copy link" />} onClose={back}>
          <h1 className="verdict">{sentence}</h1>
          <div className="nums"><Num value={String(list.length)} label="companies read" /><Num value={String(n)} label="claims extracted" sub={`${cv} can't be verified`} /><Num value={String(pts.length)} label="sites mapped" sub={noEquity != null ? `${noEquity} on public power or co-ops, no listed equity` : 'hand-curated, utility outward'} /></div>
          <p className="note" style={{ marginTop: 12 }}>Talk = how bold and specific the claims are, 0–1. Walk = the clean share of generation on the grids its mapped sites use, averaged, grid-only, contracted power excluded.</p>
        </Card>
        <Card title={<><b>Talk</b> against <b>walk</b>, per company</>}>
          <Dumbbell rows={rows} aLabel="talk" bLabel="walk" />
          <ul className="co-lines">
            {ordered.map(c => (
              <li key={c.ticker}><a href={href.check(c.ticker)}><b>{c.ticker}</b></a> {plural(c.n_claims, 'claim')} · {plural(c.n_sites, 'site')} · {c.cannot_verify_count ?? 0} can't verify · coverage {pct0(c.coverage)}</li>
            ))}
          </ul>
          <p className="note" style={{ marginTop: 12 }}>The gap between talk and walk is the story, not a verdict on honesty: annual matching is true under the market-based method. The line turns ember when walk trails talk by more than 20 points.</p>
        </Card>
        <Card title={<><b>Sites</b> · {sites.data.length} mapped, from the serving utility outward</>}>
          {fac.loading && <Loading what="the sites" />}
          {!fac.loading && !siteRows.length && <p className="note">No mapped sites in this data source.</p>}
          {siteRows.length > 0 && (
            <div className="rows co-rows">
              {siteRows.map(s => (
                <a className="row co-site" key={`${s.ticker}-${s.metro}-${s.serving_utility}`} href={href.region(s.region_id)}>
                  <div>
                    <div className="t">{s.metro || s.name}{s.state ? `, ${s.state}` : ''} <span className="muted">{s.ticker}</span></div>
                    <div className="d">{s.serving_utility || 'utility unknown'} · {s.utility_parent || '—'} · {s.ticker_utility || 'no listed equity'}{s.detector_rank != null ? ` · detector rank ${s.detector_rank}` : ''}</div>
                  </div>
                  <div className="n">{pct0(s.cf_share_2025)} <small>clean 2025</small></div>
                </a>
              ))}
            </div>
          )}
          <p className="note" style={{ marginTop: 10 }}>Parent and ticker describe the serving utility's owner, not the operator. Clean 2025 is the share of generation on that grid, all hours, grid-only. Sites are on the globe; click one for its grid.</p>
        </Card>
      </>
    )
  }
  return <Shell page="companies" globe={globe} column={column} columnWidth={480} />
}
