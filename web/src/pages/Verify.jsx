import { useMemo, useState } from 'react'
import Console, { StatusLine } from '../console/Console.jsx'
import { Panel, KV, BigNum, Ticks } from '../console/widgets.jsx'
import { loadCompany, useAsync } from '../lib/data.js'
import { readTokens } from '../lib/tokens.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { verifyTitle, pct0 } from '../lib/findings.js'
import { href } from '../router.js'

const VERDICT = { true_on_paper: 'true on paper', contradicted: 'contradicted', unfalsifiable: 'unfalsifiable', cannot_verify: 'cannot verify' }

// U2 VERIFY. Console shell, search and finding now; the two-sided evidence card and
// Talk-vs-Walk follow the opening review.
export default function Verify({ route }) {
  const ticker = route.ticker || ''
  const [q, setQ] = useState(ticker)
  const { loading, error, data, reload } = useAsync(() => (ticker ? loadCompany(ticker) : Promise.resolve(null)), [ticker])
  const tk = useMemo(readTokens, [])
  const sites = data?.sites || []
  const globe = useMemo(() => ({ view: { lat: 38, lng: -97, altitude: 1.5 }, points: sites.filter(s => s.lat != null).map(s => ({ id: s.metro, lat: s.lat, lng: s.lng, r: 0.22, color: tk.accent })), rings: sites.filter(s => s.lat != null).map(s => ({ id: s.metro, lat: s.lat, lng: s.lng, color: tk.accent, maxR: 2, speed: 0.6, period: 1800 })), labels: sites.filter(s => s.lat != null).map(s => ({ id: s.metro, lat: s.lat, lng: s.lng, text: `${s.metro} · ${s.ba}`, size: 0.6, color: tk.ink, dot: false })) }), [sites, tk])
  const submit = e => { e.preventDefault(); window.location.hash = href.verify(q.trim().toUpperCase()) }
  const t = data ? verifyTitle(data) : null
  const counts = data?.verdict_counts || {}
  const center = (
    <div className="center-panel">
      <Panel title={<>Verify · <b>claims against the grid the sites actually use</b></>}>
        <form className="form-row" onSubmit={submit} style={{ marginBottom: data ? 16 : 0 }}>
          <label>Ticker <input className="field" value={q} onChange={e => setQ(e.target.value)} placeholder="META" style={{ width: 110 }} /></label>
          <button className="btn primary" type="submit">Check</button>
          {!ticker && <span className="muted" style={{ fontSize: 12 }}>The mock has META.</span>}
        </form>
        {loading && ticker && <Loading what={ticker} />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {data && (
          <>
            {data._mock && <div className="banner">MOCK claims: the claim text is illustrative; the grid evidence numbers are real.</div>}
            <h1 className="finding">{t.title}</h1>
            <p className="sub">{t.sub}</p>
            <ul className="list" style={{ marginTop: 14 }}>
              {(data.claims || []).map(k => <li key={k.claim_id}><span className="txt" style={{ fontSize: 13 }}>“{k.verbatim}” <span className="muted">{k.source_doc}{k.page ? `, p. ${k.page}` : ''}</span></span><span className={`chip ${k.verdict === 'contradicted' ? 'accent' : ''}`}>{VERDICT[k.verdict] || k.verdict}</span></li>)}
            </ul>
          </>
        )}
      </Panel>
    </div>
  )
  const right = data ? (
    <>
      <Panel title={<><b>{data.company}</b> · {data.ticker}</>}>
        <div className="stats" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="stat"><BigNum num={pct0(data.walk_score)} /><div className="label">walk · physical CF</div></div>
          <div className="stat"><BigNum num={pct0(data.talk_score)} accent /><div className="label">talk · boldness</div></div>
        </div>
        <KV rows={[...Object.entries(counts).map(([k, v]) => [VERDICT[k] || k, String(v)]), ['cannot verify', String(data.cannot_verify_count ?? counts.cannot_verify ?? 0)], ['coverage', pct0(data.coverage)]]} />
      </Panel>
      <Panel title={<>Sites · <b>hand-curated lookup</b></>}><KV rows={sites.map(s => [s.metro, `${s.ba}${s.zone ? '/' + s.zone : ''} · ${s.source_type}`])} /></Panel>
      <div className="pending-cell">U2 evidence card and Talk-vs-Walk · after the opening review</div>
    </>
  ) : <div className="pending-cell">Type a ticker</div>
  const evidence = (data?.claims || []).flatMap(k => (k.evidence || []).filter(e => e.type === 'grid'))
  const bottom = evidence.length ? (
    <div className="stats" style={{ gridColumn: '1 / -1', gridTemplateColumns: `repeat(${Math.min(4, evidence.length)}, minmax(150px, 1fr))` }}>
      {evidence.slice(0, 4).map((e, i) => <div className="stat" key={i}><BigNum num={pct0(e.cf_share)} den={e.overnight_cf_share != null ? pct0(e.overnight_cf_share) : undefined} unit={e.overnight_cf_share != null ? 'overnight' : ''} /><div className="label">{e.ba} · {e.year} · clean share, all hours / overnight</div><Ticks value={(e.cf_share || 0) * 100} max={100} /></div>)}
    </div>
  ) : null
  return <Console page="verify" bottom={bottom} crumb={<><b>Verify</b>{ticker && <><i>/</i>{ticker}</>}</>} globe={globe} center={center} right={right} status={<StatusLine data={{ _provisional: data?._provisional, data_snapshot_end: '2026-09-05', baseline_year: 2019, detector: { n_scored: 111 } }} />} />
}
