import Shell from '../console/Console.jsx'
import { Card, Section, KV } from '../console/widgets.jsx'
import { loadOpening, useAsync } from '../lib/data.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { ordinal } from '../lib/findings.js'
import { href, useHash } from '../router.js'
import '../styles/pages.css'
import Breadcrumbs, { useCrumbs } from '../components/Breadcrumbs.jsx'

// Method reads as: what we measure, how the detector works, what we hold to, the labels,
// the flags, the company rule. The wording is deliberate and unchanged; only its structure
// is set here — each caveat becomes a term and its qualifier.
const splitTerm = t => { const m = /^(.*?)[;:]\s+(.*)$/s.exec(String(t)); return m ? [m[1], m[2]] : [String(t), null] }
const Defs = ({ rows, className = '' }) => (
  <dl className={`mt-dl ${className}`}>
    {rows.map(([term, def], i) => <div key={`${term}-${i}`}><dt>{term}</dt>{def && <dd>{def}</dd>}</div>)}
  </dl>
)

export default function Method() {
  const { loading, error, data, reload } = useAsync(loadOpening, [])
  const crumbs = useCrumbs(useHash())
  const back = () => { window.location.hash = href.landing() }
  if (loading || error) return <Shell page="method" globe={{ view: { lat: 30, lng: -96, altitude: 2.2 }, interactive: false }} column={<><Breadcrumbs trail={crumbs} onBack={back} /><Card title={<b>Method</b>} onClose={back}>{loading ? <Loading what="method" /> : <ErrorState error={error} onRetry={reload} />}</Card></>} />
  const det = data.detector || {}
  const val = (det.regions || []).filter(r => r.validation).sort((a, b) => a.rank - b.rank)
  const column = (
    <>
      <Breadcrumbs trail={crumbs} onBack={back} />
      <Card title={<b>Method</b>} onClose={back}>
        <p className="pg-top">We measure what each grid physically generated, hour by hour.</p>
        {/* the definitions as a grid, not a paragraph: each one is looked up, not read through */}
        <dl className="pg-defs">
          <div><dt>Source</dt><dd>EIA-930 via PUDL</dd></div>
          <div><dt>Coverage</dt><dd>Every US balancing authority</dd></div>
          <div><dt>Clean</dt><dd>Nuclear, hydro, wind, solar, geothermal</dd></div>
          <div><dt>Night</dt><dd>{data.overnight_hours_local || '00:00–05:59'} local</dd></div>
          <div><dt>Day</dt><dd>{data.daytime_hours_local || '10:00–15:59'} local</dd></div>
          <div><dt>Baseline</dt><dd>{data.baseline_year || 2019}</dd></div>
          <div><dt>Through</dt><dd>{data.data_snapshot_end || '2026-09-05'}</dd></div>
        </dl>
      </Card>
      <Section title="The flat-load detector (frozen before results)">
        <code className="mt-formula">{det.method}</code>
        <div className="section-title"><span>Named in advance</span><span className="mono muted">rank of {det.n_scored}</span></div>
        <KV rows={val.map(r => [r.known_cluster_label || r.id, `${ordinal(r.rank)} of ${det.n_scored}`])} />
      </Section>
      <Section title="What we hold to"><Defs rows={(data.caveats || []).map(splitTerm)} /></Section>
      <Section title="Pattern labels (descriptive only)"><Defs className="mt-keys" rows={Object.entries(data.pattern_labels || {})} /></Section>
      <Section title="Data flags"><Defs className="mt-flags" rows={Object.entries(data.data_flags || {})} /></Section>
      <Section title="Company verdicts"><p className="note">"True on paper, X physically": grid-only, average mix, contracted clean power excluded. cannot_verify is explicit, with a reason. The site lookup is hand-curated from the serving utility outward. Until the extraction lands, Meta runs on mock claims with real grid numbers.</p></Section>
    </>
  )
  return <Shell page="method" globe={{ view: { lat: 30, lng: -96, altitude: 2.2 }, interactive: false }} column={column} />
}
