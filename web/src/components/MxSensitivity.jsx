import { Section } from '../console/widgets.jsx'
import { useRegionDetails } from '../lib/data.js'
import { DASH, isNum, fmtNum } from './WxControls.jsx'
import { ptsPerGw } from './MxDetector.js'
import { ordinal } from '../lib/findings.js'
import { href } from '../router.js'
import './Mx.css'

// What the instrument responds to, stated by someone who knows it rather than apologised for.
// Every figure is computed here from the export: the size response from each region's own 2019
// demand, the coverage counts from the scored set, the correlation from the components.
//
// The three worked sizes are the smallest named region, the zone the headline rests on, and the
// whole of PJM: a 12,000 MW to 91,000 MW span, which is the point.
const SIZES = ['SWPP/OPPD', 'PJM/DOM', 'PJM']
// The largest single-territory grids, each scored as one number because that is what each one
// reports. Named here, looked up in the scored set, skipped if absent.
const LUMPS = ['TVA', 'SOCO', 'DUK', 'SC']

export default function MxSensitivity({ analysis, rows }) {
  const details = useRegionDetails(SIZES)
  const byId = Object.fromEntries(rows.map(r => [r.id, r]))
  const labelOf = r => r?.c?.label || r?.name || r?.id || ''

  const sizes = SIZES.map(id => {
    const d = details[id]?.demand?.['2019']
    return { id, label: labelOf(details[id] || byId[id]), avg: d?.avg_mw, pts: ptsPerGw(d?.avg_mw, d?.overnight_avg_mw) }
  })
  const top = Math.max(...sizes.map(s => (isNum(s.pts) ? s.pts : 0)), 1)

  const bas = rows.filter(r => !r.zone)
  const zones = rows.filter(r => r.zone)
  const withZones = new Set(zones.map(r => r.ba))
  const lumped = bas.filter(r => !withZones.has(r.id))
  const named = LUMPS.map(id => byId[id]).filter(Boolean)

  const r93 = analysis.divergenceVsGrowth
  const noDiv = analysis.rho.no_div

  return (
    <Section title="What the detector is sensitive to">
      <div className="mx-facts">
        <div className="mx-fact">
          <h4>Sensitivity scales with the size of the region</h4>
          <p>
            A gigawatt of perfectly flat load lands on a small territory as a landslide and on a large one as a rounding error. Read off each region&rsquo;s own 2019 demand, one gigawatt moves overnight excess by:
          </p>
          <div className="mx-bars">
            {sizes.map(s => (
              <div className="mx-bar" key={s.id}>
                <a className="n" href={href.region(s.id)}>{s.label || s.id}</a>
                <span className="t"><i style={{ width: `${Math.max(2, ((isNum(s.pts) ? s.pts : 0) / top) * 100).toFixed(1)}%` }} /></span>
                <span className="v">{isNum(s.pts) ? `${s.pts.toFixed(2)} pts` : DASH}</span>
              </div>
            ))}
          </div>
          <p>
            {sizes.every(s => isNum(s.avg)) && <>Average demand runs {fmtNum(sizes[0].avg)} MW to {fmtNum(sizes[sizes.length - 1].avg)} MW across those three. </>}
            That span is why the floor is 500 MW, and why a grid that publishes zones is scored zone by zone as well as whole: the smaller the box the load can be put in, the louder it reads.
          </p>
        </div>

        <div className="mx-fact">
          <h4>Scored at the finest grain each grid publishes</h4>
          <p>
            The {analysis.n} regions are {bas.length} balancing authorities and {zones.length} subregions. {withZones.size} of those balancing authorities file subregion demand with EIA and are scored zone by zone as well as whole; the other {lumped.length} file one number for the entire footprint, and that one number is what they are scored on.
            {named.length > 0 && <> {named.map(r => `${labelOf(r)} is ${isNum(r.detection?.rank) ? ordinal(r.detection.rank) : DASH}`).join(', ')}, each as a single territory, and every region page says which it is.</>}
          </p>
        </div>

        <div className="mx-fact">
          <h4>Two of the terms move together</h4>
          <p>
            Neighbor divergence tracks plain demand growth at <b>r = {isNum(r93) ? r93.toFixed(2) : DASH}</b> across the {analysis.n} regions, so the score is not three independent readings.
            {isNum(noDiv) && <> Removing the term outright still returns a ranking that agrees with the published one at <b>Spearman {noDiv.toFixed(3)}</b>: the flat-load core holds its place and the pure growth stories fall away. The panel above runs that removal live.</>}
          </p>
        </div>

        <div className="mx-fact">
          <h4>It reads the shape of the load, which is what makes it hard to game</h4>
          <p>
            A flat 24/7 draw is an electrical fingerprint, and a datacenter is not the only thing that has one. Crypto mining has it. Electrified oilfields have it. That is why every verdict reads <b>consistent with</b>, why the region page names the serving utility, and why the score never asks a company where its sites are.
          </p>
        </div>
      </div>
    </Section>
  )
}
