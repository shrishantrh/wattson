import Console, { StatusLine } from '../console/Console.jsx'
import { Panel, KV } from '../console/widgets.jsx'
import { loadOpening, useAsync } from '../lib/data.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { ordinal } from '../lib/findings.js'

// U7: the caveats, rendered from the data's own meta block rather than hand-written.
export default function Method() {
  const { loading, error, data, reload } = useAsync(loadOpening, [])
  if (loading || error) return <Console page="method" crumb="Method" center={<div className="center-panel"><Panel>{loading ? <Loading what="method" /> : <ErrorState error={error} onRetry={reload} />}</Panel></div>} />
  const det = data.detector || {}
  const val = (det.regions || []).filter(r => r.validation).sort((a, b) => a.rank - b.rank)
  const center = (
    <div className="center-scroll">
      <Panel title={<>Method · <b>what this measures, and what it does not</b></>}>
        <h1 className="finding">Generation within a footprint, by hour, for every US balancing authority.</h1>
        <p className="sub">EIA-930 via PUDL. Carbon-free = nuclear, hydro, wind, solar, geothermal. Overnight is {data.overnight_hours_local || '00:00–05:59'} local, daytime {data.daytime_hours_local || '10:00–15:59'}. Baseline {data.baseline_year || 2019}; the snapshot ends {data.data_snapshot_end || '2026-09-05'}.</p>
      </Panel>
      <Panel title="Caveats we hold to"><ul className="list">{(data.caveats || []).map((c, i) => <li key={i}><span className="txt">{c}</span></li>)}</ul></Panel>
      <Panel title="Company verdicts"><p className="ink2" style={{ maxWidth: '70ch', fontSize: 13 }}>Verdicts are "true on paper, X physically": grid-only, average mix, excluding contracted clean power. cannot_verify is explicit and counted on screen. The facility lookup is hand-curated. Until the claim extraction lands, the watchlist runs on a mock company whose claim text is illustrative and whose grid numbers are real.</p></Panel>
    </div>
  )
  const right = (
    <>
      <Panel title={<>The detector · <b>frozen</b></>}>
        <p className="ink2" style={{ fontSize: 12, marginBottom: 10 }}>{det.method}</p>
        <KV rows={val.map(r => [r.known_cluster_label || r.id, `${ordinal(r.rank)} of ${det.n_scored}`])} />
      </Panel>
      <Panel title="Pattern labels · descriptive only"><KV rows={Object.entries(data.pattern_labels || {}).map(([k, v]) => [k, v])} /></Panel>
      <Panel title="Data flags"><ul className="list">{Object.entries(data.data_flags || {}).map(([k, v]) => <li key={k}><span className="txt" style={{ fontSize: 12 }}><b>{k}</b>: {v}</span></li>)}</ul></Panel>
    </>
  )
  return <Console page="method" crumb={<><b>Method</b><i>/</i>caveats from the data's meta block</>} center={center} right={right} globe={{ view: { lat: 30, lng: -96, altitude: 2.2 } }} status={<StatusLine data={data} />} />
}
