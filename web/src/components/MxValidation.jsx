import { useRegionDetails } from '../lib/data.js'
import { DASH, isNum, signedPts } from './WxControls.jsx'
import { fixed } from './MxDetector.js'
import { ordinal } from '../lib/findings.js'
import { href } from '../router.js'
import './Mx.css'

// The result of the pre-registration, which is the first thing on the screen because it is the
// strongest thing on it. Four regions, two windows, and the one that came back 91st shown at
// full size rather than tucked into a footnote.
//
// Column 2 is the published rank (2019 against 2025). Column 3 is the second window the same
// commit asked for, 2019 against 2026 January to August, read off each region's own export file
// (detection.rank_2026_jan_aug). A region whose file does not carry it renders as an em dash.
const HIT = 20
const pct1 = v => (isNum(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%` : DASH)

export default function MxValidation({ rows, nScored, missNoDivRank, missGrowthRank }) {
  const ids = rows.map(r => r.id)
  const details = useRegionDetails(ids)
  const hits = rows.filter(r => r.rank <= HIT)
  const miss = rows.find(r => r.rank > HIT) || null
  const negatives = rows.filter(r => isNum(r.neighbor_divergence) && r.neighbor_divergence < 0)

  return (
    <>
      <div className="mx-val">
        <div className="mx-val-head"><span>named in advance</span><span>rank</span><span>re-run</span></div>
        {rows.map(r => {
          const again = details[r.id]?.detection?.rank_2026_jan_aug
          const inTop = r.rank <= HIT
          return (
            <a className="mx-val-row" key={r.id} href={href.region(r.id)}>
              <span className="mx-name">{r.known_cluster_label || r.name || r.id}</span>
              <span className="mx-rk">{isNum(r.rank) ? r.rank : DASH}</span>
              <span className="mx-rk dim">{isNum(again) ? again : DASH}</span>
              <span className="mx-meta">
                <span className="mx-sub">{r.id} · divergence {signedPts(r.neighbor_divergence)}</span>
                <span className={`mx-tag ${inTop ? 'in' : 'out'}`}>{inTop ? `top ${HIT}` : 'missed'}</span>
              </span>
            </a>
          )
        })}
      </div>
      <p className="mx-cap">
        Rank is 2019 against 2025, out of {nScored} scored regions. Re-run is the second window the same commit asked for, 2019 against 2026 January to August: same weights, same cuts, eight months of different weather and different load.
      </p>

      {miss && (
        <div className="mx-miss">
          <h3>{miss.known_cluster_label || miss.name || miss.id} came {ordinal(miss.rank)}, and here is exactly why.</h3>
          <p>
            Neighbor divergence reads a zone against the other zones in its own balancing authority{miss.ba === 'ERCO' ? ', and every ERCOT zone is booming' : ''}. So {miss.known_cluster_label || miss.id} growing {pct1(miss.growth_pct)} beside neighbors growing faster scores as unremarkable, and its divergence is {negatives.length === 1 ? 'the one negative figure among the four' : `${signedPts(miss.neighbor_divergence)}`}.{isNum(missNoDivRank) && <> Take that term out of the score and it moves to {ordinal(missNoDivRank)}.</>}{isNum(missGrowthRank) && <> Score on demand growth alone and it is {ordinal(missGrowthRank)}.</>} The published ranking keeps the {ordinal(miss.rank)}, because the weights were fixed before anyone saw where they would land. <b>A ranking that can be checked against names written down in advance is worth more than one that reports four out of four.</b>
          </p>
          <div className="mx-figs">
            <div><div className="v">{pct1(miss.growth_pct)}</div><div className="l">demand growth since 2019</div></div>
            <div><div className="v">{signedPts(miss.overnight_excess)}</div><div className="l">overnight excess</div></div>
            <div><div className="v neg">{signedPts(miss.neighbor_divergence)}</div><div className="l">neighbor divergence</div></div>
            <div><div className="v">{fixed(miss.score) ?? DASH}</div><div className="l">score, rank {miss.rank} of {nScored}</div></div>
          </div>
        </div>
      )}
      <p className="mx-cap">
        {hits.length} of {rows.length} landed inside the top {HIT}: {hits.map(r => `${r.known_cluster_label || r.id} ${ordinal(r.rank)}`).join(', ')}.
      </p>
    </>
  )
}
