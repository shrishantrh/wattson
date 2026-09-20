import { Section } from '../console/widgets.jsx'
import { DASH, isNum } from './WxControls.jsx'
import './Mx.css'

// The score, term by term, with the scale of each term measured live across the scored set. The
// median and the MAD are not decoration: they are the units the published score is denominated
// in, so printing them next to the standard deviation is the whole argument for robust z.
const TERMS = {
  overnight_excess: 'Overnight demand growth minus average demand growth, in points. A flat 24/7 load adds the same megawatts to every hour, so it lifts the 00:00 to 05:59 mean off a smaller base than the all-hours mean. This is where it shows first.',
  neighbor_divergence: 'The region’s demand growth minus the median growth of its peers: the other zones in the same balancing authority, or the other balancing authorities in the same interconnection.',
  load_factor_delta: 'Mean demand over the 99.5th percentile hour, 2025 against 2019. Flat load raises the floor faster than it raises the peak. Half weight, set in advance, as supporting evidence.',
}
const fmt = (v, unit) => (isNum(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(unit === 'pts' ? 2 : 3)}${unit ? ` ${unit}` : ''}` : DASH)
const abs = (v, unit) => (isNum(v) ? `${v.toFixed(unit === 'pts' ? 2 : 3)}${unit ? ` ${unit}` : ''}` : DASH)
const pts2 = v => (isNum(v) ? v.toFixed(2) : DASH)
const labelOf = r => r?.c?.label || r?.name || r?.id || ''

export default function MxScore({ method, nScored, analysis, rows }) {
  // The two regions that would set the scale under a standard deviation, read off the data.
  const biggest = [...rows].filter(r => isNum(r.detection?.growth_pct)).sort((a, b) => b.detection.growth_pct - a.detection.growth_pct).slice(0, 2)
  const bothTexas = biggest.length === 2 && biggest.every(r => r.ba === 'ERCO')
  const div = analysis.scale.find(s => s.key === 'neighbor_divergence')

  return (
    <Section title="How the score is built" right={<span className="mono muted" style={{ fontSize: 'var(--t-micro)', whiteSpace: 'nowrap' }}>demand only</span>}>
      <code className="mt-formula">{method}</code>
      <p className="note">
        The score reads demand and nothing else: no generation mix, no press release and no company site list can move it. Each component below is measured in the same robust units and added at the weight beside it.
      </p>
      <ul className="mx-terms">
        {analysis.scale.map(s => (
          <li key={s.key}>
            <span className="k"><code>{s.key}</code><span className="w">weight {s.weight.toFixed(1)}</span></span>
            <div className="d">{TERMS[s.key]}</div>
            <div className="s">
              <em>median</em> {fmt(s.median, s.unit)} <em>&nbsp;&middot; one unit =</em> {abs(s.mad, s.unit)} <em>(MAD)</em> <em>&nbsp;&middot; SD</em> {abs(s.sd, s.unit)}
            </div>
          </li>
        ))}
      </ul>
      <p className="note" style={{ marginTop: 16 }}>
        <b>Why median and MAD.</b> {bothTexas ? 'Texas is the reason. ' : ''}
        {biggest.map(r => `${labelOf(r)} grew ${r.detection.growth_pct.toFixed(1)}%`).join(' and ')} since 2019, both of them real. Under a standard deviation those two set the scale for everyone else: one unit of neighbor divergence would be {pts2(div?.sd)} points of growth instead of {pts2(div?.mad)}, and every region outside {bothTexas ? 'Texas' : 'that pair'} would be measured in a unit those two chose. The median and the MAD hold the scale where the other {nScored - biggest.length} regions actually sit.
      </p>
      <p className="note" style={{ marginTop: 12 }}>
        <b>Two cuts, both set in advance.</b> A region needs 500 MW of average demand in both 2019 and 2025 to be scored at all, which keeps the score off the regions where a single facility is the whole signal. Peak is the 99.5th percentile hour rather than the maximum, so one bad hour cannot move a region: PJM&rsquo;s PL zone carries an 11.6 GW spike in 2019 against a 7.6 GW 99.5th percentile.
      </p>
    </Section>
  )
}
