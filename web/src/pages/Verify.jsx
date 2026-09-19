import { useState } from 'react'
import { loadCompany, useAsync } from '../lib/data.js'
import { Loading, ErrorState, Provisional, Empty, Pending } from '../components/States.jsx'
import { verifyTitle } from '../lib/findings.js'
import { href } from '../router.js'

const VERDICT = { true_on_paper: 'true on paper', contradicted: 'contradicted', unfalsifiable: 'unfalsifiable', cannot_verify: 'cannot verify' }

// U2 VERIFY. Search shell and finding now; the evidence card and Talk-vs-Walk scatter follow
// the opening review.
export default function Verify({ route }) {
  const ticker = route.ticker || ''
  const [q, setQ] = useState(ticker)
  const submit = e => { e.preventDefault(); window.location.hash = href.verify(q.trim().toUpperCase()) }
  return (
    <main className="page">
      <p className="eyebrow">Verify · claims against the grid the sites actually use</p>
      <form className="form-row" onSubmit={submit}>
        <label>Ticker <input className="field" value={q} onChange={e => setQ(e.target.value)} placeholder="META" autoFocus style={{ width: 120 }} /></label>
        <button className="btn primary" type="submit">Check</button>
      </form>
      {ticker ? <Company ticker={ticker} /> : <Empty>Type a ticker. The mock has META.</Empty>}
    </main>
  )
}

function Company({ ticker }) {
  const { loading, error, data, reload } = useAsync(() => loadCompany(ticker), [ticker])
  if (loading) return <Loading what={ticker} />
  if (error) return <ErrorState error={error} onRetry={reload} />
  const t = verifyTitle(data)
  const counts = data.verdict_counts || {}
  const cv = data.cannot_verify_count ?? counts.cannot_verify ?? 0
  return (
    <>
      <Provisional data={data} />
      {data._mock && <div className="banner">MOCK claims: the claim text is illustrative; the grid evidence numbers are real.</div>}
      <h1 className="page-title">{t.title}</h1>
      <p className="page-sub">{t.sub}</p>
      <div>
        {Object.entries(counts).map(([k, v]) => <span key={k} className={`chip ${k === 'contradicted' ? 'accent' : ''}`}>{VERDICT[k] || k} {v}</span>)}
        <span className="chip ink">cannot verify {cv}</span>
      </div>
      <ul className="list" style={{ marginTop: 20 }}>
        {(data.claims || []).map(k => <li key={k.claim_id}><span className="txt">“{k.verbatim}” <span className="muted">{k.source_doc}{k.page ? `, p. ${k.page}` : ''}</span></span><span className={`chip ${k.verdict === 'contradicted' ? 'accent' : ''}`}>{VERDICT[k.verdict] || k.verdict}</span></li>)}
      </ul>
      <Pending>U2 evidence card and Talk-vs-Walk scatter follow the opening review.</Pending>
    </>
  )
}
