import { useState } from 'react'
import { Section } from '../console/widgets.jsx'
import { DASH, isNum } from './WxControls.jsx'
import { VARIANTS } from './MxDetector.js'
import { href } from '../router.js'
import './Mx.css'

// The falsification harness. Every variant is the published score with one decision changed, and
// each one is recomputed here, in the browser, over all scored regions at once, from the
// components the export publishes. The reader picks the change and watches the ranking answer.
//
// The "from" column is always the published rank, so the movements match the figures quoted in
// the write-up. `fidelity` says what recomputing the shipped score from the export's rounded
// components costs, which is how a reader tells a real movement from a rounding artefact.
const BIG = 5
const rho3 = v => (isNum(v) ? v.toFixed(3) : DASH)

export default function MxRobustness({ analysis, watch }) {
  const offered = VARIANTS.filter(x => analysis.ranks[x.id])
  const [pick, setPick] = useState('no_div')
  const v = offered.find(x => x.id === pick) || offered[0] || VARIANTS[0]
  const ranks = analysis.ranks[v.id] || {}
  const moved = watch.filter(w => isNum(analysis.published[w.id]) && isNum(ranks[w.id]) && Math.abs(ranks[w.id] - analysis.published[w.id]) > BIG)

  return (
    <Section title="Change the score and watch the ranking" right={<span className="mono muted" style={{ fontSize: 'var(--t-micro)', whiteSpace: 'nowrap' }}>{analysis.n} regions</span>}>
      <p className="note">
        Each option below is the published score with one decision changed, recomputed here over all {analysis.n} regions from the components in the export. The ranks on the left are the ones we shipped.
      </p>
      <div className="mx-chips" role="group" aria-label="Scoring variant">
        {offered.map(x => (
          <button key={x.id} type="button" className="mx-chip" aria-pressed={x.id === v.id} onClick={() => setPick(x.id)}>{x.label}</button>
        ))}
      </div>
      <code className="mt-formula" style={{ marginTop: 12 }}>score = {v.terms}</code>
      <div className="mx-rho">
        <span className="v">{rho3(analysis.rho[v.id])}</span>
        <span className="l">Spearman against the shipped ranking{v.id === 'shipped' ? ', which is itself' : ''}. {v.note}</span>
      </div>
      <ul className="mx-moves">
        {watch.map(w => {
          const a = analysis.published[w.id], b = ranks[w.id]
          const d = isNum(a) && isNum(b) ? b - a : null
          const cls = d == null ? '' : Math.abs(d) > BIG ? 'big' : 'held'
          return (
            <li key={w.id}>
              <a className="who" href={href.region(w.id)}>{w.label}<i>{w.id}</i></a>
              <span className="nums">
                <span className="a">{isNum(a) ? a : DASH}</span>
                <span className="arrow" aria-hidden="true">&rarr;</span>
                <span className="b">{isNum(b) ? b : DASH}</span>
                <span className={`d ${cls}`}>{d == null ? DASH : d === 0 ? 'held' : `${d > 0 ? '+' : '−'}${Math.abs(d)}`}</span>
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mx-cap">
        {v.id === 'shipped'
          ? `The reference. Everything else on this panel is measured against these ${analysis.n} ranks.`
          : moved.length === 0
            ? `Every region on this list stays within ${BIG} places of where we published it.`
            : `${moved.length} of ${watch.length} move more than ${BIG} places: ${moved.map(w => `${w.label} ${analysis.published[w.id]} to ${ranks[w.id]}`).join(', ')}.`}
        {isNum(analysis.fidelity.exact) && <> Recomputing the shipped score here from the export&rsquo;s rounded components returns {analysis.fidelity.exact} of {analysis.fidelity.n} regions to their exact published rank and the rest to within {analysis.fidelity.max} {analysis.fidelity.max === 1 ? 'place' : 'places'}, so a movement larger than that is the variant rather than the rounding.</>}
        {!analysis.hasLoadFactor && <> The source serving this region list publishes two of the three components, so the variants that turn on load_factor_delta are held back rather than computed with the term silently zeroed.</>}
      </p>
    </Section>
  )
}
