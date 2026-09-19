import { useMemo } from 'react'
import Shell, { fitView } from '../console/Console.jsx'
import { Card, Num, Ticks } from '../console/widgets.jsx'
import { CopyButton } from '../components/CopyButton.jsx'
import { loadCompanies, loadFacilities, useAsync } from '../lib/data.js'
import { readTokens } from '../lib/tokens.js'
import { pct0 } from '../lib/findings.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { href } from '../router.js'

// Four companies side by side: what they say (talk) against what their grids do (walk).
export default function Companies() {
  const { loading, error, data, reload } = useAsync(loadCompanies, [])
  const tk = useMemo(readTokens, [])
  const list = data?.companies || []
  const fac = useAsync(loadFacilities, [])
  const sites = { data: fac.data?.facilities || [] }
  const pts = (sites.data || []).filter(s => s.lat != null)
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
    column = (
      <>
        <Card title={<><b>Companies</b> · talk vs walk{data.is_mock && <> · <span className="accent">mock</span></>}</>} right={<CopyButton text={() => window.location.href} label="Copy link" />} onClose={back}>
          <h1 className="verdict">{sentence}</h1>
          <div className="nums"><Num value={String(list.length)} label="companies read" /><Num value={String(n)} label="claims extracted" sub={`${cv} can't be verified`} /><Num value={String(pts.length)} label="sites mapped" sub={fac.data?.no_listed_equity_count != null ? `${fac.data.no_listed_equity_count} on public power or co-ops, no listed equity` : 'hand-curated, utility outward'} /></div>
          <p className="note" style={{ marginTop: 12 }}>Talk = how bold and specific the claims are, 0–1. Walk = the clean share of generation on the grids its mapped sites use, averaged, grid-only, contracted power excluded.</p>
        </Card>
        <Card>
          <div className="rows">
            {list.map(c => (
              <a className="row" key={c.ticker} href={href.check(c.ticker)} style={{ gridTemplateColumns: '1fr 150px 76px' }}>
                <div><div className="t">{c.company} <span className="muted">{c.ticker}</span></div><div className="d">{c.n_claims ?? '—'} claims · {c.n_sites ?? '—'} sites · {c.cannot_verify_count ?? 0} can't verify · coverage {pct0(c.coverage)}</div></div>
                <div style={{ display: 'grid', gap: 4 }}><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="muted" style={{ fontSize: 10, width: 30 }}>talk</span><Ticks value={(c.talk_score ?? 0) * 100} max={100} n={12} accent /></div><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="muted" style={{ fontSize: 10, width: 30 }}>walk</span><Ticks value={(c.walk_score ?? 0) * 100} max={100} n={12} /></div></div>
                <div className="n">{pct0(c.talk_score)} <small>/</small> {pct0(c.walk_score)}</div>
              </a>
            ))}
          </div>
          <p className="note" style={{ marginTop: 10 }}>Sites are on the globe; click one for its grid. The gap between talk and walk is the story, not a verdict on honesty: annual matching is true under the market-based method.</p>
        </Card>
      </>
    )
  }
  return <Shell page="companies" globe={globe} column={column} columnWidth={480} />
}
