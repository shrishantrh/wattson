import Shell from '../console/Console.jsx'
import { Card, Section, KV } from '../console/widgets.jsx'
import { loadOpening, useAsync } from '../lib/data.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { ordinal } from '../lib/findings.js'
import { href } from '../router.js'

export default function Method() {
  const { loading, error, data, reload } = useAsync(loadOpening, [])
  const back = () => { window.location.hash = href.landing() }
  if (loading || error) return <Shell page="method" globe={{ view: { lat: 30, lng: -96, altitude: 2.2 }, interactive: false }} column={<Card title={<b>Method</b>} onClose={back}>{loading ? <Loading what="method" /> : <ErrorState error={error} onRetry={reload} />}</Card>} />
  const det = data.detector || {}
  const val = (det.regions || []).filter(r => r.validation).sort((a, b) => a.rank - b.rank)
  const column = (
    <>
      <Card title={<b>Method</b>} onClose={back}>
        <h1 className="verdict">We measure what each grid physically generated, hour by hour.</h1>
        <p className="note" style={{ marginTop: 10 }}>Every US balancing authority, from EIA-930 via PUDL. Clean = nuclear, hydro, wind, solar, geothermal. Night is {data.overnight_hours_local || '00:00–05:59'} local, day is {data.daytime_hours_local || '10:00–15:59'}. Baseline {data.baseline_year || 2019}; data through {data.data_snapshot_end || '2026-09-05'}.</p>
      </Card>
      <Section title="What we hold to"><ul className="rows">{(data.caveats || []).map((c, i) => <li className="row" key={i}><div className="t" style={{ fontSize: 13 }}>{c}</div></li>)}</ul></Section>
      <Section title="Company verdicts"><p className="note">"True on paper, X physically": grid-only, average mix, contracted clean power excluded. cannot_verify is explicit, with a reason. The site lookup is hand-curated from the serving utility outward. Until the extraction lands, Meta runs on mock claims with real grid numbers.</p></Section>
      <Section title="The flat-load detector (frozen before results)"><p className="note" style={{ marginBottom: 10 }}>{det.method}</p><KV rows={val.map(r => [r.known_cluster_label || r.id, `${ordinal(r.rank)} of ${det.n_scored}`])} /></Section>
      <Section title="Pattern labels (descriptive only)"><KV rows={Object.entries(data.pattern_labels || {}).map(([k, v]) => [k, v])} /></Section>
      <Section title="Data flags"><ul className="rows">{Object.entries(data.data_flags || {}).map(([k, v]) => <li className="row" key={k}><div><div className="t">{k}</div><div className="d">{v}</div></div></li>)}</ul></Section>
    </>
  )
  return <Shell page="method" globe={{ view: { lat: 30, lng: -96, altitude: 2.2 }, interactive: false }} column={column} />
}
