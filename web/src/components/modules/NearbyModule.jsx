import { useMemo, useState } from 'react'
import '../../styles/nearby.css'
import { nearbyCleaner, describeNearby, milesToKm, canAnswer } from '../../lib/nearby.js'
import { Num, Chip, Ticks } from '../../console/widgets.jsx'
import { href } from '../../router.js'
import { n0, pct0, pts1, caveatFor } from '../../lib/findings.js'
import { Mod, Say, Empty } from './Shell.jsx'

const RADII_MILES = [300, 500, 1000]
const mwFmt = n => `${n0(n)} MW`
const byDistance = (a, b) => (a.miles ?? Infinity) - (b.miles ?? Infinity)

// One candidate: the whole row links to the region page. `mark` is a small label after the name
// ("data flagged" for an excluded grid, "beyond N mi" for the nearest one outside the radius).
// The clean share reads twice: as a bar you can scan down the column, and as the exact figure.
function Row({ c, mark, dim }) {
  return (
    <a className={`nb-row${dim ? ' nb-flagged' : ''}`} href={href.region(c.id)} title={`${c.label}: ${pct0(c.share)} clean at night, ${n0(c.miles)} miles away${mark ? ` (${mark})` : ''}`}>
      <div className="nb-cell"><div className="nb-t">{c.label}{mark && <span className="nb-mark">{mark}</span>}</div><div className="nb-d">{c.place || c.id} · {pts1(c.change_since_2019)} since 2019{c.rank ? ` · flat-load rank #${c.rank}` : ''}</div></div>
      <span className="nb-n">{n0(c.miles)}<small> mi</small></span>
      <span className="mod-tk nb-tk"><Ticks value={c.share == null ? 0 : c.share} max={1} n={10} tone={dim ? 'neutral' : 'clean'} label={`${pct0(c.share)} clean at night`} /></span>
      <span className="nb-n">{pct0(c.share)}</span>
      <span className="nb-n">{n0(c.fossilMW)}<small> MW</small></span>
    </a>
  )
}

// Is there a cleaner grid nearby? The k cleanest grids within a radius of this place that run cleaner
// at night, and what each would change for a flat load of `loadMW`. The list is shown nearest first;
// which grids qualify is unchanged.
//   regions   the scored-regions list from lib/data.js loadRegions() (the array or the { meta, regions } wrapper)
//   regionId  "PJM" or "PJM/DOM"; a zone keeps its own load centre and inherits its grid's share
//   loadMW    the load, for the fossil MW figures
export default function NearbyModule({ regions, regionId, loadMW = 300, k = 3 }) {
  const [radius, setRadius] = useState(500)
  const load = Number(loadMW) > 0 ? Number(loadMW) : 300
  const res = useMemo(() => nearbyCleaner(regions, regionId, { radiusKm: milesToKm(radius), k, loadMW: load }), [regions, regionId, radius, k, load])
  if (!res.from || !res.from.hasCoords || res.from.share == null) return <Empty>{describeNearby(res)}</Empty>
  const { from, candidates, excluded, nearest_outside: outside } = res
  const best = candidates[0] || null
  const caveat = from.flagged ? caveatFor(regionId) || from.flags[0] || 'The data for this region is flagged; read its share with care.' : null
  const compareTo = best ? href.compare({ mw: load, metros: [regionId, ...candidates.map(c => c.id)] }) : null
  const listed = [...candidates].sort(byDistance), flagged = [...excluded].sort(byDistance)

  return (
    <Mod
      className="mod-nearby"
      caption={`Cleaner grids within ${n0(radius)} miles of this load centre, nearest first.`}
      lead={<Say>{describeNearby(res)}</Say>}
      foot={`EIA-930 hourly via PUDL, 2025; clean is the carbon-free share of generation 00:00–05:59 local and fossil MW is ${n0(load)} MW × (1 − that share). Distance is between load centres, a proxy for staying in the same market, not a check of transmission or land. Generation within each footprint, not consumption; a zone inherits its whole grid's share, so grids are listed once. Grids whose data is corrected or flagged are marked and not recommended.`}
    >
      <div className="nb">
        <div className="nb-head">
          <div className="seg nb-seg" role="radiogroup" aria-label="Search radius in miles">
            {RADII_MILES.map(r => <button key={r} type="button" role="radio" aria-checked={r === radius} className={r === radius ? 'on' : ''} onClick={() => setRadius(r)}>{n0(r)} mi</button>)}
          </div>
          <span className="nb-from">from <b>{from.label}</b>{from.zone ? `, on the ${from.grid} grid` : ''}</span>
        </div>
        {caveat && <div className="nb-caveat">{caveat}</div>}
        <div className="nb-nums">
          <Num num={from.fossilMW != null ? Math.round(from.fossilMW) : undefined} value="—" format={mwFmt} label={`fossil MW of a ${n0(load)} MW load here`} sub={`${pct0(from.share)} clean at night, 2025`} accent />
          {best
            ? <Num num={Math.round(best.fossilMW)} format={mwFmt} label={`fossil MW at ${best.label}`} sub={`${pct0(best.share)} clean, ${n0(best.miles)} miles away`} />
            : <Num value={outside ? `${n0(outside.miles)} mi` : '—'} label={outside ? `to the nearest cleaner grid, ${outside.label}` : 'no cleaner grid in the data'} sub={outside ? `${pct0(outside.share)} clean at night` : null} />}
        </div>
        {listed.length > 0 || flagged.length > 0 || outside ? (
          <div className="nb-rows">
            <div className="nb-row nb-hdr" aria-hidden="true"><span>{listed.length ? 'cleaner grids in range' : 'nearest cleaner grid'}</span><span>distance</span><span /><span>clean</span><span>fossil MW</span></div>
            {listed.map(c => <Row key={c.id} c={c} />)}
            {flagged.map(c => <Row key={c.id} c={c} mark="data flagged" dim />)}
            {!listed.length && outside && <Row c={outside} mark={`beyond ${n0(radius)} mi`} />}
          </div>
        ) : <p className="mod-empty">No other scored grid sits within {n0(radius)} miles.</p>}
        {compareTo && <div className="nb-actions"><Chip small href={compareTo}>Compare these {n0(candidates.length + 1)} places at {n0(load)} MW</Chip></div>}
      </div>
    </Mod>
  )
}

// Registry entry, same shape as the modules in ./index.js (the integrator registers it on the compare
// and region pages). ctx = { regions (from loadRegions), region_id, load_mw? }.
// oxlint-disable-next-line react/only-export-components -- a registry entry, not a component
export const nearbyModule = {
  id: 'nearby', title: 'Is there a cleaner grid nearby?',
  applies: ctx => !!ctx?.regions && !!ctx?.region_id && canAnswer(ctx.regions, ctx.region_id),
  render: ctx => <NearbyModule regions={ctx.regions} regionId={ctx.region_id} loadMW={ctx.load_mw} />,
}
