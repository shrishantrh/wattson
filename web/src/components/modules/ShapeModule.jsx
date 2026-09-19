import { useMemo, useState } from 'react'
import '../../styles/shape.css'
import { SHAPES, FLEX_FRACTION, FLEX_LABEL, shapeById, cleanShareFor, bestHours, worstHours, shiftable, compareShapes, fossilMW, profileOf, profilesOf, hourSpanWords, hourWord } from '../../lib/shape.js'
import { pct, mw } from '../../lib/format.js'
import ShapePicker from '../ShapePicker.jsx'
import NumberTicker from '../NumberTicker.jsx'
import { Mod, Lead, Empty } from './Shell.jsx'

const isArr = p => Array.isArray(p) && p.length >= 24
const isYearMap = p => p != null && typeof p === 'object' && !Array.isArray(p)
const yearUsed = (profile, year) => (!isYearMap(profile) ? year : isArr(profile[year]) ? year : Object.keys(profile).filter(k => /^\d{4}$/.test(k) && isArr(profile[k])).sort().pop() || year)

// 24 bars (clean share by hour, the cleanest six a shade brighter) with the load's weights drawn
// over them: a 1px line with 3px dots, both --ink-2. One SVG in hour units stretched to the box;
// strokes are non-scaling so they stay crisp, and the dots are zero-length round-capped segments.
// `base` (the unshifted weights) is drawn dashed behind the line when the load is flexible.
function ShapeChart({ profile, weights, base, best, label }) {
  const max = Math.max(...profile.filter(v => v != null), 0.0001)
  const wmax = Math.max(...weights, ...(base || []), 1e-9)
  const y = w => (94 - (w / wmax) * 88).toFixed(2)
  const line = ws => ws.map((w, h) => `${h ? 'L' : 'M'}${h + 0.5} ${y(w)}`).join('')
  const dots = ws => ws.map((w, h) => `M${h + 0.5} ${y(w)}h0.01`).join('')
  const bright = new Set(best)
  return (
    <div className="shape-chart">
      <svg className="shape-svg" viewBox="0 0 24 100" preserveAspectRatio="none" role="img" aria-label={`Clean share by hour${label ? ` in ${label}` : ''} with the load shape drawn over it`}>
        {profile.map((v, h) => { const hgt = v == null ? 0 : Math.max(4, (v / max) * 100); return <rect key={h} className={`shape-bar${bright.has(h) ? ' best' : ''}`} x={h + 0.1} width={0.8} y={100 - hgt} height={hgt}><title>{`${hourWord(h)} · ${v == null ? '—' : pct(v)} clean`}</title></rect> })}
        {base && <path className="shape-line base" d={line(base)} />}
        <path className="shape-line" d={line(weights)} />
        <path className="shape-dots" d={dots(weights)} />
      </svg>
      <div className="hourbars-axis" aria-hidden="true"><span>midnight</span><span>6am</span><span>noon</span><span>6pm</span><span>midnight</span></div>
    </div>
  )
}

// What a load of this shape would run on, at this place.
//   profile   24 numbers (clean share by local hour, 0..1) or a year map { "2019": [...], "2025": [...] }
//   label     the place, for the chart's accessible name
//   loadMW    the load, for the MW that is not carbon-free
//   year      which year of a year map to score (falls back to the latest present)
//   shape / onShape, flexible / onFlexible   optional control; otherwise the module keeps its own state
//   grid / inherited   for the footnote: whose generation the profile is
export default function ShapeModule({ profile, label, loadMW = 300, year = '2025', shape: shapeProp, onShape, flexible: flexProp, onFlexible, grid, inherited }) {
  const [shapeState, setShapeState] = useState('flat')
  const [flexState, setFlexState] = useState(false)
  const shapeId = shapeProp ?? shapeState
  const flexible = flexProp ?? flexState
  const setShape = id => { setShapeState(id); onShape?.(id) }
  const setFlex = on => { setFlexState(on); onFlexible?.(on) }

  const p = profileOf({ profile_24h: profile }, year)
  const shown = yearUsed(profile, year)
  const shape = shapeById(shapeId) || SHAPES[0]
  const cmp = useMemo(() => compareShapes(p), [p])
  const fx = useMemo(() => (p && flexible ? shiftable(p, shape.weights, FLEX_FRACTION) : null), [p, shape, flexible])
  if (!p) return <Empty>No hourly clean-share profile for this grid.</Empty>

  const share = fx ? fx.share : cleanShareFor(p, shape.weights)
  const eff = fx ? fx.weights : shape.weights
  const fossil = fossilMW(loadMW, share)
  const six = bestHours(p, 6), bad = worstHours(p, 6)
  const years = isYearMap(profile) ? profile : null
  const scoreYear = arr => (isArr(arr) ? (flexible ? shiftable(arr, shape.weights, FLEX_FRACTION).share : cleanShareFor(arr, shape.weights)) : null)
  const s19 = scoreYear(years?.['2019']), s25 = scoreYear(years?.['2025'])
  const shapeWords = `${shape.label}${flexible ? `, ${FLEX_LABEL}` : ''}`

  return (
    <Mod
      className="mod-shape"
      caption="Pick a load shape; the clean share is re-weighted hour by hour to match it."
      lead={<Lead
        value={share == null ? '—' : <NumberTicker value={share * 100} format={n => `${n.toFixed(1)}%`} />}
        t="clean"
        label={`clean power for a ${shapeWords} load, ${shown}`}
        aside={fossil == null ? '—' : <NumberTicker value={Math.round(fossil)} format={n => mw(n)} />}
        asideTone="fossil"
        asideLabel={`of ${mw(loadMW)} not carbon-free`}
      />}
      foot={`EIA-930 hourly via PUDL, ${shown}. Clean share of generation by local hour${grid ? `, for the whole ${grid} grid${inherited ? ' (this zone inherits it)' : ''}` : ''}. Not carbon-free = load × (1 − share); other and unknown fuels count as not clean. Generation within the footprint, not consumption.`}
    >
      <ShapePicker value={shape.id} onChange={setShape} flexible={flexible} onFlexible={setFlex} />
      <ShapeChart profile={p} weights={eff} base={fx ? shape.weights : null} best={six.hours} label={label} />
      <div className="shape-chips" role="list" aria-label="Clean share by load shape">
        {cmp.shapes.map(s => <span key={s.id} role="listitem" className={`shape-chip${s.id === shape.id ? ' on' : ''}`}>{s.label} <b>{pct(s.share)}</b></span>)}
        <span role="listitem" className={`shape-chip${flexible && shape.id === 'flat' ? ' on' : ''}`}>{FLEX_LABEL} <b>{pct(cmp.flexible20.share)}</b></span>
      </div>
      <p className="shape-best">
        The cleanest six hours are <b>{hourSpanWords(six.hours)}</b>, {pct(six.mean)} clean on average; the dirtiest six ({hourSpanWords(bad.hours)}) run {pct(bad.mean)}.
        {fx && fx.to.length > 0 && ` The flexible fifth moves from ${hourSpanWords(fx.from)} into ${hourSpanWords(fx.to)}.`}
      </p>
      {s19 != null && s25 != null && (
        <p className={`shape-years${s25 < s19 ? ' accent' : ''}`}><span className="from">2019 {pct(s19)}</span> → 2025 {pct(s25)}<span className="shape-years-l">for a {shapeWords} load</span></p>
      )}
    </Mod>
  )
}

// Registry entry, same shape as the modules in ./index.js (the integrator registers it there).
// ctx = { detail, region_id, load_mw? }. A zone's profile is its parent grid's.
const labelOf = d => d?.c?.label || d?.name || d?.id || null
// The grid whose generation the profile belongs to: a zone's parent BA (by object or by `ba`), else the region itself.
const gridLabel = d => (d?.type === 'zone' ? d.parent?.id || d.parent?.ba || d.ba || null : d?.id || d?.ba || null)
// oxlint-disable-next-line react/only-export-components -- a registry entry, not a component
export const shapeModule = {
  id: 'shape', title: 'What your load shape would run on',
  applies: ctx => !!profileOf(ctx?.detail),
  render: ctx => <ShapeModule profile={profilesOf(ctx?.detail) || profileOf(ctx?.detail)} label={labelOf(ctx?.detail)} loadMW={Number(ctx?.load_mw) || 300} grid={gridLabel(ctx?.detail)} inherited={!!ctx?.detail?.cf_inherited_from_ba} />,
}
