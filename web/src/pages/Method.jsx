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

      {/* What we ran AT our own result. Kept compact: one line per test, the number, and
          what the number means. This is the substance behind "we tried to break it". */}
      <Section title="What we ran against our own result">
        <div className="mt-forms">
          <div className="mt-form">
            <b>Permutation test &middot; is it better than chance?</b>
            <code className="mt-formula">all C(111,4) = 5,989,005 combinations scored &rarr; p = 0.0488</code>
            <p className="note">Wattson named four test regions in advance. Wattson then scored every possible four-region combination out of 111. Only 4.9% do as well as ours. Marginal, and we say so: the out-of-sample result below is the stronger claim.</p>
          </div>

          <div className="mt-form">
            <b>Block bootstrap &middot; how stable is a rank?</b>
            <code className="mt-formula">10,000 rebuilds on 7-day resampled blocks &rarr; Dominion 6th, 95% CI 3rd to 7th</code>
            <p className="note">Resampled in week-long blocks rather than single hours, because demand is heavily autocorrelated and shuffling hours would fake precision we do not have.</p>
          </div>

          <div className="mt-form">
            <b>Out-of-sample holdout &middot; does it survive new data?</b>
            <code className="mt-formula">re-run frozen on 2026 Jan-Aug &rarr; Spearman 0.877, 8 of top 10 unchanged</code>
            <p className="note">Data that did not exist when the weights were fixed. Spearman is 1.0 for identical rankings and 0 for random ones. Top-10 overlap of 8 against 0.91 expected by chance, hypergeometric p = 4.8e-9.</p>
          </div>

          <div className="mt-form">
            <b>Placebo windows &middot; was the signal always there?</b>
            <code className="mt-formula">same frozen method ending 2021 / 22 / 23 / 24 &rarr; p = 0.13, 0.14, 0.21, 0.10</code>
            <p className="note">Nothing before 2025 clears significance, and 2025 does. A method that manufactures signal would manufacture it in every year. This dates the signal to the buildout.</p>
          </div>

          <div className="mt-form">
            <b>Supervised model &middot; can it be found without our formula?</b>
            <code className="mt-formula">gradient boosting on 17 demand-shape features &rarr; AUC 0.727, 0 of 1,000 label shuffles beat it</code>
            <p className="note">Trained on load-shape features only, never shown the detector output, labelled from the 134 sites we mapped from utility filings. It found the same regions. Against us: region size alone scores 0.749, so shape adds information beyond size rather than beating it.</p>
          </div>

          <div className="mt-form">
            <b>Weather control &middot; is it just hotter summers?</b>
            <code className="mt-formula">138 NOAA stations, 9.18M readings &rarr; weather explains 7.8% of overnight growth</code>
            <p className="note">The temperature model itself fits at median R&sup2; 0.733, so this is a working control, not a weak one that found nothing. Northern Virginia was 0.21&deg;C colder overnight in 2025 while its overnight demand rose 3,960 MW.</p>
          </div>

          <div className="mt-form">
            <b>Unsupervised clustering &middot; do datacenter grids group together?</b>
            <code className="mt-formula">k-means + PCA on 24-hour profiles &rarr; no enrichment, 50 tests, nothing survives correction</code>
            <p className="note">A negative result, published as one. Mapped-site regions are depleted in the flattest cluster rather than enriched.</p>
          </div>
        </div>
      </Section>

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
    </>
  )
  return <Shell page="method" globe={{ view: { lat: 30, lng: -96, altitude: 2.2 }, interactive: false }} column={column} />
}
