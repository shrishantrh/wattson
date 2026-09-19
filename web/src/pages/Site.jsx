import { useState } from 'react'
import { loadSite, useAsync } from '../lib/data.js'
import { Loading, ErrorState, Provisional, Pending } from '../components/States.jsx'
import { siteTitle, pct1, n0 } from '../lib/findings.js'
import { href } from '../router.js'

// U3 SITE. The form and a ranked answer from the fixture now; verdict cards follow the
// opening review.
export default function Site() {
  const [mw, setMw] = useState(300)
  const [flat, setFlat] = useState(true)
  const [submitted, setSubmitted] = useState(null)
  const { loading, error, data, reload } = useAsync(() => loadSite(submitted || { mw: 300, flat_24_7: true }), [submitted])
  const candidates = data?.request?.candidates || []
  return (
    <main className="page">
      <p className="eyebrow">Site · where new flat load would be served cleanly</p>
      <form className="form-row" onSubmit={e => { e.preventDefault(); setSubmitted({ mw: Number(mw), flat_24_7: flat, candidates }) }}>
        <label>Load <input className="field" type="number" min="1" value={mw} onChange={e => setMw(e.target.value)} style={{ width: 90 }} /> MW</label>
        <label><input type="checkbox" checked={flat} onChange={e => setFlat(e.target.checked)} /> 24/7 flat</label>
        <label>Candidates {candidates.map(c => <span key={c} className="chip ink">{c}</span>)}</label>
        <button className="btn primary" type="submit">Rank</button>
      </form>
      {loading ? <Loading what="siting" /> : error ? <ErrorState error={error} onRetry={reload} /> : <Results data={data} />}
    </main>
  )
}

function Results({ data }) {
  const t = siteTitle(data)
  return (
    <>
      <Provisional data={data} />
      <h1 className="page-title">{t.title}</h1>
      <p className="page-sub">{t.sub}</p>
      <ol className="ranked" style={{ maxWidth: 760 }}>
        {(data.results || []).map(r => (
          <li key={r.region_id} className={r.rank === 1 ? 'lead' : ''}>
            <span>{r.rank}</span>
            <a href={href.region(r.region_id)}><span className="lab">{r.metro} · {r.serving_utility || r.region_id}</span></a>
            <span className="r">{pct1(r.siting?.overnight_cf_share_2025)} night</span>
            <span className="r">{r.last_growth_filled_by?.fuel ? `${r.last_growth_filled_by.fuel} +${n0(r.last_growth_filled_by.delta_gw * 1000)} MW` : '—'}</span>
          </li>
        ))}
      </ol>
      <Pending>U3 verdict cards (overnight clean share, slope, what filled the last growth, serving utility) follow the opening review.</Pending>
    </>
  )
}
