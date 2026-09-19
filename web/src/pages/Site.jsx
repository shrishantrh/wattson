import { useMemo, useState } from 'react'
import Console, { StatusLine } from '../console/Console.jsx'
import { Panel, Ring, BigNum, KV, Ticks, Stat } from '../console/widgets.jsx'
import { loadSite, useAsync } from '../lib/data.js'
import { readTokens } from '../lib/tokens.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { siteTitle, pct1, pct0, n0 } from '../lib/findings.js'
import { href } from '../router.js'

// U3 SITE. Console shell, the form and a ranked answer from the fixture; verdict cards
// follow the opening review.
export default function Site() {
  const [mw, setMw] = useState(300)
  const [flat, setFlat] = useState(true)
  const [submitted, setSubmitted] = useState(null)
  const { loading, error, data, reload } = useAsync(() => loadSite(submitted || { mw: 300, flat_24_7: true }), [submitted])
  const tk = useMemo(readTokens, [])
  const results = data?.results || []
  const globe = useMemo(() => ({ view: { lat: 37, lng: -98, altitude: 1.45 }, points: results.map(r => ({ id: r.region_id, lat: r.lat, lng: r.lng, r: 0.24, color: r.rank === 1 ? tk.accent : tk.ink2 })), rings: results.filter(r => r.rank === 1).map(r => ({ id: r.region_id, lat: r.lat, lng: r.lng, color: tk.accent, maxR: 3, speed: 0.8, period: 1600 })), labels: results.map(r => ({ id: r.region_id, lat: r.lat, lng: r.lng, text: `${r.rank} · ${r.metro}`, size: 0.75, color: r.rank === 1 ? tk.accent : tk.ink, dot: false })) }), [results, tk])
  const t = siteTitle(data)
  const candidates = data?.request?.candidates || []
  const center = (
    <div className="center-panel" style={{ maxWidth: 560 }}>
      <Panel title={<>Site · <b>where new flat load would be served cleanly</b></>}>
        <form className="form-row" onSubmit={e => { e.preventDefault(); setSubmitted({ mw: Number(mw), flat_24_7: flat, candidates }) }}>
          <label>Load <input className="field" type="number" min="1" value={mw} onChange={e => setMw(e.target.value)} style={{ width: 84 }} /> MW</label>
          <label><input type="checkbox" checked={flat} onChange={e => setFlat(e.target.checked)} /> 24/7 flat</label>
          <button className="btn primary" type="submit">Rank</button>
        </form>
        <div style={{ marginBottom: 12 }}>{candidates.map(c => <span key={c} className="chip ink">{c}</span>)}</div>
        {loading ? <Loading what="siting" /> : error ? <ErrorState error={error} onRetry={reload} /> : (
          <>
            <h1 className="finding">{t.title}</h1>
            <p className="sub">{t.sub}</p>
            <ul className="compact" style={{ marginTop: 14 }}>
              {results.map(r => <li key={r.region_id} className={r.rank === 1 ? 'lead' : ''}><span>{r.rank}</span><a href={href.region(r.region_id)}><span className="lab">{r.metro} · {r.serving_utility || r.region_id}</span></a><Ticks value={(r.siting?.overnight_cf_share_2025 || 0) * 100} max={100} n={12} accent={r.rank === 1} /><span className="r">{pct0(r.siting?.overnight_cf_share_2025)}</span></li>)}
            </ul>
          </>
        )}
      </Panel>
    </div>
  )
  const right = results.length ? (
    <>
      {results.map(r => (
        <Panel key={r.region_id} title={<><b>{r.rank}</b> · {r.metro} · {r.region_id}</>} right={<a className="cta" href={href.region(r.region_id)}>View →</a>}>
          <div className="instrument"><Ring value={r.siting?.overnight_cf_share_2025} /><div><BigNum num={pct1(r.siting?.overnight_cf_share_2025)} accent={r.rank === 1} /><div className="label">overnight clean 2025</div></div></div>
          <KV rows={[['slope / yr', r.siting?.ratio_slope_per_year != null ? (r.siting.ratio_slope_per_year > 0 ? '+' : '') + r.siting.ratio_slope_per_year.toFixed(3) : '—'], ['last growth filled by', r.last_growth_filled_by ? `${r.last_growth_filled_by.fuel} +${n0(r.last_growth_filled_by.delta_gw * 1000)} MW` : '—'], ['serving utility', r.serving_utility || '—'], ['siting rank', r.siting?.siting_rank ? `${r.siting.siting_rank} of ${r.siting.n_ranked || 52}` : '—']]} />
        </Panel>
      ))}
      <div className="pending-cell">U3 verdict cards · after the opening review</div>
    </>
  ) : null
  const load = Number(data?.request?.mw || mw) || 0
  const bottom = results.length ? (
    <div className="stats" style={{ gridColumn: '1 / -1', gridTemplateColumns: `repeat(${results.length}, minmax(180px, 1fr))` }}>
      {results.map(r => {
        const dem = r.demand?.overnight_avg_mw, share = dem ? load / dem : null, cf = r.siting?.overnight_cf_share_2025
        return <div className="stat" key={r.region_id}><BigNum num={r.last_growth_filled_by ? `${r.last_growth_filled_by.fuel} +${(r.last_growth_filled_by.delta_gw).toFixed(1)} GW` : '—'} accent={r.last_growth_filled_by?.fuel === 'gas'} /><div className="label">{r.metro} · filled the last overnight growth · {load} MW is {share != null ? `${(share * 100).toFixed(1)}%` : '—'} of overnight demand · at the 2025 mix {cf != null ? `${n0(load * (1 - cf))} MW` : '—'} of it from fossil</div><Ticks value={cf != null ? cf * 100 : null} max={100} accent={r.rank === 1} /></div>
      })}
    </div>
  ) : null
  return <Console page="site" crumb={<><b>Site</b><i>/</i>{n0(data?.request?.mw || mw)} MW · 24/7 · {candidates.length} candidates</>} globe={globe} center={center} right={right} bottom={bottom} status={<StatusLine data={{ _provisional: data?._provisional, data_snapshot_end: '2026-09-05', baseline_year: 2019, detector: { n_scored: 111 } }} />} />
}
