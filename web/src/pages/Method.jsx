import { loadOpening, useAsync } from '../lib/data.js'
import { Loading, ErrorState, Provisional } from '../components/States.jsx'
import { ordinal } from '../lib/findings.js'

// U7: the caveats, rendered from the data's own meta block rather than hand-written.
export default function Method() {
  const { loading, error, data, reload } = useAsync(loadOpening, [])
  if (loading) return <div className="page"><Loading what="method" /></div>
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>
  const det = data.detector || {}
  const val = (det.regions || []).filter(r => r.validation).sort((a, b) => a.rank - b.rank)
  return (
    <main className="page">
      <Provisional data={data} />
      <p className="eyebrow">Method and caveats</p>
      <h1 className="page-title">What this measures, and what it does not.</h1>
      <p className="page-sub">Hourly generation by fuel for every US balancing authority, from EIA-930 via PUDL. Carbon-free = nuclear, hydro, wind, solar, geothermal. Overnight is {data.overnight_hours_local || '00:00–05:59'} local, daytime {data.daytime_hours_local || '10:00–15:59'}. Baseline {data.baseline_year || 2019}; the snapshot ends {data.data_snapshot_end || '2026-09-05'}.</p>

      <section className="section">
        <h2>Caveats we hold to</h2>
        <ul className="list">{(data.caveats || []).map((c, i) => <li key={i}><span className="txt">{c}</span></li>)}</ul>
      </section>

      <section className="section">
        <h2>The detector</h2>
        <p className="ink2" style={{ maxWidth: '70ch' }}>{det.method}</p>
        <ul className="list">
          {val.map(r => <li key={r.id}><span className="txt"><b>{r.known_cluster_label || r.id}</b> named in advance, ranked {ordinal(r.rank)} of {det.n_scored}</span><span className="mono ink2">{r.score?.toFixed(1)}</span></li>)}
        </ul>
        <ul className="list">
          {Object.entries(data.pattern_labels || {}).map(([k, v]) => <li key={k}><span className="txt"><b>{k}</b>: {v}. Labels are descriptive and never touch the score.</span></li>)}
        </ul>
      </section>

      <section className="section">
        <h2>Data flags</h2>
        <ul className="list">{Object.entries(data.data_flags || {}).map(([k, v]) => <li key={k}><span className="txt"><b>{k}</b>: {v}</span></li>)}</ul>
      </section>

      <section className="section">
        <h2>Company verdicts</h2>
        <p className="ink2" style={{ maxWidth: '70ch' }}>Verdicts are "true on paper, X physically": grid-only, average mix, excluding contracted clean power. cannot_verify is explicit and counted on screen. The facility lookup is hand-curated. Until the claim extraction lands, the watchlist runs on a mock company whose claim text is illustrative and whose grid numbers are real.</p>
      </section>
    </main>
  )
}
