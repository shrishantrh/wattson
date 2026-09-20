import { useState } from 'react'
import { Section } from '../console/widgets.jsx'
import { useRegionDetails } from '../lib/data.js'
import { DASH, isNum, WxReadout, fmtNum } from './WxControls.jsx'
import { fixed, patternTest, ptsPerGw } from './MxDetector.js'
import './Mx.css'

// Pick any region and the published rules run in front of the reader against that region's own
// published figures. Two things are checked here: the pattern label, which is arithmetic anyone
// can do, and the size response, which is computed from the region's own baseline demand.
//
// The score is not recomputed for one region, and the copy says so: its robust z is taken across
// the whole scored set at once, so the figure shown is the engine's, printed as published.
const num1 = (v, unit = '') => (isNum(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}${unit}` : DASH)
const labelOf = r => r?.c?.label || r?.name || r?.id || ''

export default function MxInspector({ list, nScored }) {
  const [pick, setPick] = useState('')
  const sel = list.find(r => r.id === pick) || list[0] || null
  const detail = useRegionDetails(sel ? [sel.id] : [])[sel?.id || '']
  const d = sel?.detection || {}
  const test = patternTest(d.growth_pct, d.overnight_excess)
  const agrees = !!d.pattern && test.label === d.pattern
  const base = detail?.demand?.['2019']
  const pts = ptsPerGw(base?.avg_mw, base?.overnight_avg_mw)

  if (!list.length) {
    return <Section title="Run the rule on any region"><p className="note">The region list is still loading.</p></Section>
  }
  return (
    <Section title="Run the rule on any region" right={<span className="mono muted" style={{ fontSize: 'var(--t-micro)', whiteSpace: 'nowrap' }}>{nScored} to choose from</span>}>
      <p className="note">Pattern labels are descriptive and never touch the score. They are two arithmetic tests on figures that are already in the export, so pick any region and watch them run against its own numbers.</p>
      <label className="wx-group" style={{ marginTop: 12 }}>
        <span className="wx-k">region</span>
        <select className="field" value={sel?.id || ''} onChange={e => setPick(e.target.value)} aria-label="Region to test" style={{ width: '100%', maxWidth: 'none', fontFamily: 'var(--font-ui)' }}>
          {list.map(r => <option key={r.id} value={r.id}>#{r.detection?.rank ?? DASH} · {labelOf(r)}</option>)}
        </select>
      </label>
      <WxReadout items={[
        { value: num1(d.growth_pct, '%'), label: 'demand growth since 2019' },
        { value: num1(d.overnight_excess, ' pts'), label: 'overnight growth minus average growth', tone: 'fossil' },
        { value: num1(d.neighbor_divergence, ' pts'), label: 'divergence from its neighbors' },
        { value: fixed(d.score) ?? DASH, label: `score · rank #${d.rank ?? DASH} of ${nScored}` },
      ]} />
      <ul className="wx-test">
        <li><span className={`mk ${test.flat ? 'yes' : 'no'}`}>{test.flat ? '✓' : '·'}</span><span>flat-load growth needs growth <b>&ge; 10%</b> and overnight excess <b>&gt; 0</b>. Here: {num1(d.growth_pct, '%')} and {num1(d.overnight_excess, ' pts')}.</span></li>
        <li><span className={`mk ${test.solar ? 'yes' : 'no'}`}>{test.solar ? '✓' : '·'}</span><span>possible midday solar suppression needs growth <b>&lt; 5%</b> and overnight excess <b>&ge; 5 pts</b>. Here: {num1(d.growth_pct, '%')} and {num1(d.overnight_excess, ' pts')}.</span></li>
        <li><span className={`mk ${!test.flat && !test.solar ? 'yes' : 'no'}`}>{!test.flat && !test.solar ? '✓' : '·'}</span><span>mixed is everything else.</span></li>
      </ul>
      <div className={`wx-verdict ${agrees ? 'agree' : ''}`}>
        The rule returns <b>{test.label}</b>. The label published for {labelOf(sel)} is <b>{d.pattern || DASH}</b>{agrees ? ', the same answer.' : '. They differ, which would be a bug worth reporting.'}
        {' '}The score beside it is the engine&rsquo;s figure printed as published: its robust z is taken across all {nScored} regions at once, so it is a property of the set rather than of one region.
      </div>
      <p className="mx-cap">
        {isNum(pts)
          ? <>In {labelOf(sel)}, a gigawatt of perfectly flat load would move overnight excess by <b>{pts.toFixed(2)} points</b>, off a 2019 baseline of {fmtNum(base.avg_mw)} MW average and {fmtNum(base.overnight_avg_mw)} MW overnight.</>
          : <>The 2019 demand baseline for {labelOf(sel)} is loading.</>}
        {sel?.cf_inherited_from_ba ? ' This region is a zone: it files demand only, which is exactly what the detector reads, so the rank is its own even though its generation figures are the parent grid’s.' : ''}
      </p>
    </Section>
  )
}
