import { useId, useMemo, useState } from 'react'
import { linfit, niceTicks, quantiles } from '../lib/metrics.js'
import '../styles/explore.css'
import '../styles/dataviz.css'

// <Scatter points={[{ id, x, y, r, label, sector, flagged, named }]} xLabel yLabel xFormat yFormat
//   width height selectedId onSelect onHover quadrants fitLine rLabel />
// Plain SVG. Dots are coloured by sector (Eastern --ink-2, Western --muted, Texas --ink, see
// explore.css), flagged regions are hollow, regions named in advance carry a ring and a label
// pulled off the dot on a leader line, and only the selected point uses the accent. An optional
// third dimension `r` on a point sizes the dot (area-true: radius goes as the square root).
// Hovering raises a dot to the top, grows it, and drops its coordinates onto both axes, so the
// value is read where the scale is rather than in a floating box. `fitLine` draws the
// least-squares line (dashed); `quadrants` marks the two medians with a faint 1px baseline and
// lightly fills the top-right quadrant. Lays out from `width`/`height` and scales down with its
// container. No animation except the 150 ms hover transition in the stylesheet.
const M = { top: 16, right: 20, bottom: 42, left: 58 }
const R_MIN = 2.2, R_MAX = 6
const num = v => (typeof v === 'number' && Number.isFinite(v) ? String(Number(v.toPrecision(10))) : '—')
const isNum = v => typeof v === 'number' && Number.isFinite(v)
const sectorClass = s => (s === 'Texas' ? 'texas' : s === 'Western' ? 'west' : s === 'Eastern' ? 'east' : 'other')
const textW = (s, px) => String(s ?? '').length * px * 0.62

function extent(vs, padFrac = 0.06) {
  let lo = Infinity, hi = -Infinity
  for (const v of vs) { if (v < lo) lo = v; if (v > hi) hi = v }
  if (!Number.isFinite(lo)) return [0, 1]
  if (lo === hi) { const d = Math.abs(lo) * 0.1 || 1; return [lo - d, hi + d] }
  const pad = (hi - lo) * padFrac
  return [lo - pad, hi + pad]
}

export default function Scatter({ points = [], xLabel = '', yLabel = '', xFormat = num, yFormat = num, xTick = num, yTick = num, width = 700, height = 420, selectedId = null, onSelect, onHover, quadrants = false, quadrantLabel = '', fitLine = false, rLabel = '' }) {
  const [hoverId, setHoverId] = useState(null)
  const clipId = useId()
  const pts = useMemo(() => points.filter(p => isNum(p.x) && isNum(p.y)), [points])
  const w = Math.max(40, width - M.left - M.right), h = Math.max(40, height - M.top - M.bottom)
  const { xd, yd, xt, yt, fit, xm, ym } = useMemo(() => {
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
    const xd = extent(xs), yd = extent(ys)
    return { xd, yd, xt: niceTicks(xd[0], xd[1], 5).filter(v => v >= xd[0] && v <= xd[1]), yt: niceTicks(yd[0], yd[1], 5).filter(v => v >= yd[0] && v <= yd[1]), fit: fitLine ? linfit(xs, ys) : null, xm: quantiles(xs, [0.5])[0], ym: quantiles(ys, [0.5])[0] }
  }, [pts, fitLine])
  // third dimension -> radius, area-true. Without it every dot keeps the old 2.5px.
  const rdom = useMemo(() => {
    const rs = pts.map(p => p.r).filter(isNum)
    if (rs.length < 2) return null
    const lo = Math.min(...rs), hi = Math.max(...rs)
    return hi > lo ? { lo, hi } : null
  }, [pts])
  const rad = p => {
    if (!rdom) return 2.5
    return isNum(p.r) ? R_MIN + Math.sqrt((p.r - rdom.lo) / (rdom.hi - rdom.lo)) * (R_MAX - R_MIN) : R_MIN
  }
  const sx = v => M.left + ((v - xd[0]) / (xd[1] - xd[0])) * w
  const sy = v => M.top + h - ((v - yd[0]) / (yd[1] - yd[0])) * h
  const right = M.left + w, bottom = M.top + h

  const enter = p => { setHoverId(p.id); onHover?.(p.id) }
  const leave = () => { setHoverId(null); onHover?.(null) }
  // draw order: plain dots, then named, then selected, then whatever is hovered (raised to the top)
  const ordered = useMemo(() => [...pts].sort((a, b) => (!!a.named - !!b.named) || ((a.id === selectedId) - (b.id === selectedId)) || ((a.id === hoverId) - (b.id === hoverId))), [pts, selectedId, hoverId])
  const hover = hoverId != null ? pts.find(p => p.id === hoverId) : null

  let readout = null
  if (hover) {
    const cx = sx(hover.x), cy = sy(hover.y)
    const xv = xFormat(hover.x), yv = yFormat(hover.y)
    readout = (
      <g className="xp-readout" aria-hidden="true">
        <line className="xp-guide" x1={cx} x2={cx} y1={cy} y2={bottom} />
        <line className="xp-guide" x1={M.left} x2={cx} y1={cy} y2={cy} />
        <text className="xp-gval" x={Math.min(Math.max(M.left + textW(xv, 10) / 2, cx), right)} y={bottom + 15} textAnchor="middle">{xv}</text>
        <text className="xp-gval" x={M.left - 8} y={Math.min(Math.max(M.top + 4, cy + 3), bottom)} textAnchor="end">{yv}</text>
      </g>
    )
  }

  let tip = null
  if (hover && !hover.named) {
    const l1 = hover.label || hover.id
    const tw = textW(l1, 11) + 18, th = 22
    const cx = sx(hover.x), cy = sy(hover.y)
    const tx = Math.min(Math.max(M.left, cx - tw / 2), right - tw)
    const above = cy - 12 - th >= 0
    const ty = above ? cy - 12 - th : cy + 12
    tip = <g className="xp-tip" transform={`translate(${tx.toFixed(1)} ${ty.toFixed(1)})`}><rect width={tw.toFixed(1)} height={th} rx="6" /><text x="9" y="15">{l1}</text></g>
  }

  return (
    <svg className="xp-chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ maxWidth: width }} role="img" aria-label={`${yLabel} against ${xLabel}, ${pts.length} regions${rLabel ? `, dot size is ${rLabel}` : ''}`} onMouseLeave={leave}>
      <defs><clipPath id={clipId}><rect x={M.left} y={M.top} width={w} height={h} /></clipPath></defs>
      {quadrants && isNum(xm) && isNum(ym) && (
        <g className="xp-quadrants">
          <rect className="xp-quad" x={sx(xm)} y={M.top} width={Math.max(0, right - sx(xm))} height={Math.max(0, sy(ym) - M.top)} />
          <line className="xp-median" x1={sx(xm)} x2={sx(xm)} y1={M.top} y2={bottom} />
          <line className="xp-median" x1={M.left} x2={right} y1={sy(ym)} y2={sy(ym)} />
          {quadrantLabel && <text className="xp-quad-label" x={right - 6} y={M.top + 12} textAnchor="end">{quadrantLabel}</text>}
        </g>
      )}
      <g className="xp-axis">
        <line x1={M.left} x2={right} y1={bottom} y2={bottom} />
        <line x1={M.left} x2={M.left} y1={M.top} y2={bottom} />
        {xt.map(v => <g key={`x${v}`} transform={`translate(${sx(v).toFixed(1)} ${bottom})`}><line y2="4" /><text y="15" textAnchor="middle">{xTick(v)}</text></g>)}
        {yt.map(v => <g key={`y${v}`} transform={`translate(${M.left} ${sy(v).toFixed(1)})`}><line x2="-4" /><text x="-8" dy="3" textAnchor="end">{yTick(v)}</text></g>)}
        {xLabel && <text className="xp-axis-label" x={M.left + w / 2} y={height - 6} textAnchor="middle">{xLabel}</text>}
        {yLabel && <text className="xp-axis-label" transform={`translate(12 ${M.top + h / 2}) rotate(-90)`} textAnchor="middle">{yLabel}</text>}
      </g>
      {fit && isNum(fit.slope) && <line className="xp-fit" clipPath={`url(#${clipId})`} x1={sx(xd[0])} y1={sy(fit.intercept + fit.slope * xd[0])} x2={sx(xd[1])} y2={sy(fit.intercept + fit.slope * xd[1])} />}
      {pts.length < 2 && <text className="xp-empty" x={M.left + w / 2} y={M.top + h / 2} textAnchor="middle">Not enough points to plot</text>}
      {readout}
      <g className="xp-points">
        {ordered.map(p => {
          const cx = sx(p.x), cy = sy(p.y), sel = p.id === selectedId, rr = rad(p)
          const lw = textW(p.label || p.id, 11), flip = cx + 18 + lw > right
          const s = flip ? -1 : 1
          // leader: off the dot at 45 degrees, then a short horizontal run to the label
          const lx = cx + s * (rr + 3), ly = cy - (rr + 3)
          const ex = cx + s * 13, ey = cy - 13
          const tx = ex + s * 5
          return (
            <g key={p.id} className={`xp-pt ${sectorClass(p.sector)}${p.flagged ? ' hollow' : ''}${p.named ? ' named' : ''}${sel ? ' sel' : ''}${hoverId === p.id ? ' hov' : ''}`} style={{ '--xp-r': `${rr.toFixed(2)}px`, '--xp-rh': `${(rr + 1.6).toFixed(2)}px` }} onMouseEnter={() => enter(p)} onMouseLeave={leave} onClick={() => onSelect?.(p.id)}>
              <circle className="xp-hit" cx={cx} cy={cy} r={Math.max(9, rr + 5)} />
              {hoverId === p.id && <circle className="xp-halo" cx={cx} cy={cy} r={rr + 5} />}
              {p.named && <circle className="xp-ring" cx={cx} cy={cy} r={rr + 4} />}
              <circle className="xp-dot" cx={cx} cy={cy} r={rr} />
              {p.named && <>
                <path className="xp-lead" d={`M${lx.toFixed(1)} ${ly.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}L${(ex + s * 4).toFixed(1)} ${ey.toFixed(1)}`} />
                <text className="xp-name" x={tx.toFixed(1)} y={ey} dy="3.5" textAnchor={flip ? 'end' : 'start'}>{p.label || p.id}</text>
              </>}
            </g>
          )
        })}
      </g>
      {tip}
    </svg>
  )
}
