import { useMemo, useState } from 'react'
import '../../styles/nearby.css'
import { nearbyCleaner, describeNearby, milesToKm, canAnswer } from '../../lib/nearby.js'
import { Num, Chip } from '../../console/widgets.jsx'
import { href } from '../../router.js'
import { n0, pct0, pts1, caveatFor } from '../../lib/findings.js'

const RADII_MILES = [300, 500, 1000]
const mwFmt = n => `${n0(n)} MW`

// One candidate: the whole row links to the region page. `mark` is a small label after the name
// ("data flagged" for an excluded grid, "beyond N mi" for the nearest one outside the radius).
function Row({ c, mark, dim }) {
  return (
    <a className={`nb-row${dim ? ' nb-flagged' : ''}`} href={href.region(c.id)} title={`${c.label}: ${pct0(c.share)} clean at night, ${n0(c.miles)} miles away${mark ? ` (${mark})` : ''}`}>
      <div className="nb-cell"><div className="nb-t">{c.label}{mark && <span className="nb-mark">{mark}</span>}</div><div className="nb-d">{c.place || c.id} · {pts1(c.change_since_2019)} since 2019{c.rank ? ` · flat-load rank #${c.rank}` : ''}</div></div>
      <span className="nb-n">{n0(c.miles)}<small> mi</small></span>
      <span className="nb-n">{pct0(c.share)}</span>
      <span className="nb-n">{n0(c.fossilMW)}<small> MW</small></span>
    </a>
  )
}

// Is there a cleaner grid nearby? The k cleanest grids within a radius of this place that run cleaner
// at night, and what each would change for a flat load of `loadMW`.
//   regions   the scored-regions list from lib/data.js loadRegions() (the array or the { meta, regions } wrapper)
//   regionId  "PJM" or "PJM/DOM"; a zone keeps its own load centre and inherits its grid's share
//   loadMW    the load, for the fossil MW figures
export default function NearbyModule({ regions, regionId, loadMW = 300, k = 3 }) {
  const [radius, setRadius] = useState(500)
  const load = Number(loadMW) > 0 ? Number(loadMW) : 300
  const res = useMemo(() => nearbyCleaner(regions, regionId, { radiusKm: milesToKm(radius), k, loadMW: load }), [regions, regionId, radius, k, load])
  if (!res.from || !res.from.hasCoords || res.from.share == null) return <p className="nb-empty">{describeNearby(res)}</p>
  const { from, candidates, excluded, nearest_outside: outside } = res
  const best = candidates[0] || null
  const caveat = from.flagged ? caveatFor(regionId) || from.flags[0] || 'The data for this region is flagged; read its share with care.' : null
  const compareTo = best ? href.compare({ mw: load, metros: [regionId, ...candidates.map(c => c.id)] }) : null

  return (
    <div className="nb">
      <p className="nb-sentence">{describeNearby(res)}</p>
      <div className="nb-head">
        <div className="seg nb-seg" role="radiogroup" aria-label="Search radius in miles">
          {RADII_MILES.map(r => <button key={r} type="button" role="radio" aria-checked={r === radius} className={r === radius ? 'on' : ''} onClick={() => setRadius(r)}>{n0(r)} mi</button>)}
        </div>
        <span className="nb-from">from <b>{from.label}</b>{from.zone ? `, on the ${from.grid} grid` : ''}</span>
      </div>
      {caveat && <div className="nb-caveat">{caveat}</div>}
      <div className="nb-nums">
        <Num num={from.fossilMW != null ? Math.round(from.fossilMW) : undefined} value="—" format={mwFmt} label={`fossil MW of ${n0(load)} here`} sub={`${pct0(from.share)} clean at night, 2025`} accent />
        {best
          ? <Num num={Math.round(best.fossilMW)} format={mwFmt} label={`fossil MW at ${best.label}`} sub={`${pct0(best.share)} clean, ${n0(best.miles)} miles away`} />
          : <Num value={outside ? `${n0(outside.miles)} mi` : '—'} label={outside ? `to the nearest cleaner grid, ${outside.label}` : 'no cleaner grid in the data'} sub={outside ? `${pct0(outside.share)} clean at night` : null} />}
      </div>
      {(candidates.length > 0 || excluded.length > 0 || outside) && (
        <div className="nb-rows">
          <div className="nb-row nb-hdr" aria-hidden="true"><span>{candidates.length ? `cleaner grids within ${n0(radius)} miles` : 'nearest cleaner grid'}</span><span>distance</span><span>clean at night</span><span>fossil MW of {n0(load)}</span></div>
          {candidates.map(c => <Row key={c.id} c={c} />)}
          {excluded.map(c => <Row key={c.id} c={c} mark="data flagged" dim />)}
          {!candidates.length && outside && <Row c={outside} mark={`beyond ${n0(radius)} mi`} />}
        </div>
      )}
      {compareTo && <div className="nb-actions"><Chip small href={compareTo}>Compare these {n0(candidates.length + 1)} places at {n0(load)} MW</Chip></div>}
      <p className="nb-foot">Distance is between load centres (a zone's metro, a grid's service-territory centre): a proxy for staying in the same market, not a check of transmission or land. Clean at night is the carbon-free share of generation 00:00–05:59 local in 2025; a zone inherits its whole grid's share, so grids are listed once. Fossil MW = {n0(load)} MW × (1 − clean share); other and unknown fuels count as not clean. Generation within each footprint, not consumption. Grids whose data is corrected or flagged are marked and not recommended.</p>
    </div>
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
