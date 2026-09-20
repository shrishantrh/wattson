import { useMemo } from 'react'
import Shell from '../console/Console.jsx'
import { Card, Section } from '../console/widgets.jsx'
import { loadOpening, loadRegions, useAsync } from '../lib/data.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { WxReadout, DASH } from '../components/WxControls.jsx'
import { ordinal } from '../lib/findings.js'
import { href, useHash } from '../router.js'
import '../styles/pages.css'
import '../styles/wx.css'
import Breadcrumbs, { useCrumbs } from '../components/Breadcrumbs.jsx'
import { analyze } from '../components/MxDetector.js'
import MxValidation from '../components/MxValidation.jsx'
import MxFreeze from '../components/MxFreeze.jsx'
import MxRobustness from '../components/MxRobustness.jsx'
import MxScore from '../components/MxScore.jsx'
import MxSensitivity from '../components/MxSensitivity.jsx'
import MxInspector from '../components/MxInspector.jsx'
import '../components/Mx.css'

// Method argues, in this order:
//   1. the pre-registration and what it returned, including the region that came back 91st
//   2. the commit record behind claim 1, stated as narrowly as git states it
//   3. a panel that recomputes the ranking under a changed score, live, so it can be attacked
//   4. how the score is built, with each term's robust scale measured across the scored set
//   5. what the instrument responds to: region size, reporting grain, the correlated terms
//   6. the rule run against any region the reader picks
//   7. what each number is measured on, the labels, the flagged data, the company rule
// Every figure on the screen is either out of the export or recomputed here from it. The
// pre-registration claim is exactly the commit graph and is never dressed up as more.
const splitTerm = t => { const m = /^(.*?)[;:]\s+(.*)$/s.exec(String(t)); return m ? [m[1], m[2]] : [String(t), null] }
const Defs = ({ rows, className = '' }) => (
  <dl className={`mt-dl ${className}`}>
    {rows.map(([term, def], i) => <div key={`${term}-${i}`}><dt>{term}</dt>{def && <dd>{def}</dd>}</div>)}
  </dl>
)
const labelOf = r => r?.c?.label || r?.name || r?.id || ''
const HIT = 20
// Two regions carried alongside the named four in the robustness panel: the top-ranked grid that
// was not named in advance, and the one whose rank is carried by growth. Both are in the export.
const EXTRA_WATCH = ['AZPS', 'ERCO/FWES']

export default function Method() {
  const { loading, error, data, reload } = useAsync(loadOpening, [])
  const regs = useAsync(loadRegions, [])
  const crumbs = useCrumbs(useHash())
  const back = () => { window.location.hash = href.landing() }
  const list = useMemo(() => [...(regs.data?.regions || [])].sort((a, b) => (a.detection?.rank ?? 999) - (b.detection?.rank ?? 999)), [regs.data])
  const analysis = useMemo(() => analyze(list), [list])

  if (loading || error) return <Shell page="method" globe={{ view: { lat: 30, lng: -96, altitude: 2.2 }, interactive: false }} column={<><Breadcrumbs trail={crumbs} onBack={back} /><Card title={<b>Method</b>}>{loading ? <Loading what="method" /> : <ErrorState error={error} onRetry={reload} />}</Card></>} />

  const det = data.detector || {}
  const nScored = det.n_scored ?? analysis.n
  const val = (det.regions || []).filter(r => r.validation).sort((a, b) => a.rank - b.rank)
  const hits = val.filter(r => r.rank <= HIT)
  const miss = val.find(r => r.rank > HIT) || null
  const byId = Object.fromEntries(list.map(r => [r.id, r]))
  const watch = [
    ...val.map(r => ({ id: r.id, label: r.known_cluster_label || labelOf(byId[r.id]) || r.id })),
    ...EXTRA_WATCH.filter(id => byId[id]).map(id => ({ id, label: labelOf(byId[id]) })),
  ]
  const ready = analysis.n > 0
  const nights = data.overnight_hours_local || '00:00-05:59'
  const days = data.daytime_hours_local || '10:00-15:59'

  const column = (
    <>
      <Breadcrumbs trail={crumbs} onBack={back} />

      <Card title={<b>Method</b>}>
        <h1 className="verdict">Four regions were named in the same commit as the code that first ranked all {nScored}. Three came back inside the top twenty.</h1>
        <WxReadout items={[
          { value: String(val.length), label: 'named before the ranking existed' },
          { value: String(hits.length), label: `inside the top ${HIT}` },
          { value: miss ? ordinal(miss.rank) : DASH, label: 'where the fourth landed', tone: 'fossil' },
          { value: String(nScored), label: 'regions scored, on demand alone' },
        ]} />
        <MxValidation
          rows={val}
          nScored={nScored}
          missNoDivRank={miss ? analysis.ranks.no_div?.[miss.id] : null}
          missGrowthRank={miss ? analysis.ranks.growth?.[miss.id] : null}
        />
      </Card>

      {/* Every formula in the project, in one place, so nobody has to remember them. */}
      <Section title="Every formula, in one place">
        <div className="mt-forms">
          <div className="mt-form">
            <b>Detector score</b>
            <code className="mt-formula">score = z(overnight excess) + z(neighbor divergence) + 0.5 x z(load factor change)</code>
            <p className="note">
              <b>overnight excess</b>: points by which night demand grew faster than average demand, 2019 to 2025.
              <b> neighbor divergence</b>: this region's demand growth minus the median growth of the other zones on its own grid.
              <b> load factor change</b>: change in (average demand / peak demand). A 24/7 load flattens the curve, so this rises.
            </p>
            <p className="note">
              <b>z</b> is a robust z-score, <code>(x - median) / (MAD x 1.4826)</code>, not mean and standard deviation.
              ERCOT's two zones grew +94.6% and +116.1%; with a normal z those two would inflate the spread and crush
              every other region's score toward zero. Load factor takes half weight because it hangs on a single peak hour.
            </p>
            <p className="note">Cuts: regions under 500 MW average demand are excluded, and peak is the 99.5th percentile hour, not the maximum.</p>
          </div>

          <div className="mt-form">
            <b>Carbon-free share</b>
            <code className="mt-formula">cf_share = (nuclear + hydro + wind + solar + geothermal) / total generation</code>
            <p className="note">Per region, per hour, then averaged inside a window. Storage is excluded because it is not generation. Unknown fuel stays in the denominator so a grid is never flattered by what we cannot classify.</p>
          </div>

          <div className="mt-form">
            <b>Walk score</b>
            <code className="mt-formula">walk = mean(cf_share_2025 of every grid the company's mapped sites sit on)</code>
            <p className="note">Plain average, unweighted by site size. Grid only: purchases and certificates are excluded, because the walk score is what the wires carried.</p>
          </div>

          <div className="mt-form">
            <b>Talk score</b>
            <code className="mt-formula">talk = magnitude x specificity x scope_breadth</code>
            <p className="note">How big the claimed number is, how precisely it is stated, and how little it is hedged. Each narrowing qualifier cuts scope: <b>annual</b> costs the most (0.30), then <b>market-based</b> and <b>owned-and-operated</b> (0.20), <b>certificates</b> and <b>matched</b> (0.15), <b>purchases</b> and <b>REC</b> (0.10).</p>
          </div>

          <div className="mt-form">
            <b>Siting score</b>
            <code className="mt-formula">siting = level (overnight cf share, 2025) + direction (2019 to 2025 slope) + headroom (overnight clean MW / overnight demand)</code>
            <p className="note">Where a new 24/7 load would be served cleanly. All three read at 3am, because that is the hour that decides whether new load meets existing clean capacity or new gas.</p>
          </div>
        </div>
      </Section>

      <MxFreeze />

      {ready
        ? <MxRobustness analysis={analysis} watch={watch} />
        : <Section title="Change the score and watch the ranking"><p className="note">The scored set is still loading.</p></Section>}

      {ready
        ? <MxScore method={det.method} nScored={nScored} analysis={analysis} rows={list} />
        : <Section title="How the score is built"><code className="mt-formula">{det.method}</code></Section>}

      {ready && <MxSensitivity analysis={analysis} rows={list} />}

      <MxInspector list={list} nScored={nScored} />

      <Section title="What each number is measured on">
        <p className="pg-lede" style={{ marginTop: 0 }}>We measure what each grid physically generated, hour by hour, not what was bought on paper. Splitting night from day is the rest of it: an annual average hides the fact that the hours a 24/7 load is stuck with are the hours that did not improve.</p>
        <dl className="pg-defs">
          <div><dt>Source</dt><dd>EIA-930 via PUDL</dd></div>
          <div><dt>Coverage</dt><dd>Every US balancing authority</dd></div>
          <div><dt>Clean</dt><dd>Nuclear, hydro, wind, solar, geothermal. Storage excluded; other and unknown counted in the denominator only</dd></div>
          <div><dt>Night</dt><dd>{nights} local, when there is no solar and a datacenter is still at full draw</dd></div>
          <div><dt>Day</dt><dd>{days} local, the window solar output is largest in</dd></div>
          <div><dt>Baseline</dt><dd>{data.baseline_year || 2019}, before the buildout</dd></div>
          <div><dt>Through</dt><dd>{data.data_snapshot_end || '2026-09-05'}</dd></div>
        </dl>
        <Defs rows={(data.caveats || []).map(splitTerm)} />
      </Section>

      <Section title="Pattern labels, a read of the shape and never part of the score"><Defs className="mt-keys" rows={Object.entries(data.pattern_labels || {})} /></Section>
      <Section title="Where we suspect the data rather than the grid"><Defs className="mt-flags" rows={Object.entries(data.data_flags || {})} /></Section>
      <Section title="Company verdicts">
        <p className="note">&ldquo;True on paper, X physically&rdquo; is a measurement, not an accusation. An annual clean-energy claim can be true under the accounting rules while the grid under the site still burns gas at 3am, and the second is what we report: grid-only, average mix, contracted clean power held out of it. Every claim that grid data cannot settle is marked cannot_verify with a reason and counted on screen. The site lookup is hand-curated from the serving utility outward. Until the extraction lands, Meta runs on mock claims with real grid numbers.</p>
      </Section>
    </>
  )
  return <Shell page="method" globe={{ view: { lat: 30, lng: -96, altitude: 2.2 }, interactive: false }} column={column} />
}
