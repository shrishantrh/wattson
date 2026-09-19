import { useId, useMemo, useState } from 'react'
import { linfit, niceTicks, quantiles } from '../lib/metrics.js'
import '../styles/explore.css'

// <Scatter points={[{ id, x, y, label, sector, flagged, named }]} xLabel yLabel xFormat yFormat
//   width height selectedId onSelect onHover quadrants fitLine />
// Plain SVG. Dots are coloured by sector (Eastern --ink-2, Western --muted, Texas --ink, see
// explore.css), flagged regions are hollow, regions named in advance carry a ring and a label
// that is always visible, and only the selected point uses the accent. Hover shows a label.
// `fitLine` draws the least-squares line (dashed); `quadrants` draws a dashed cross at the
// medians and lightly fills the top-right quadrant. Lays out from `width`/`height` and scales
// down with its container. No animation except the 150 ms hover transition in the stylesheet.
const M = { top: 16, right: 20, bottom: 42, left: 58 }
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

export default function Scatter({ points = [], xLabel = '', yLabel = '', xFormat = num, yFormat = num, xTick = num, yTick = num, width = 700, height = 420, selectedId = null, onSelect, onHover, quadrants = false, quadrantLabel = '', fitLine = false }) {
  const [hoverId, setHoverId] = useState(null)
  const clipId = useId()
  const pts = useMemo(() => points.filter(p => isNum(p.x) && isNum(p.y)), [points])
  const w = Math.max(40, width - M.left - M.right), h = Math.max(40, height - M.top - M.bottom)
  const { xd, yd, xt, yt, fit, xm, ym } = useMemo(() => {
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
    const xd = extent(xs), yd = extent(ys)
    return { xd, yd, xt: niceTicks(xd[0], xd[1], 5).filter(v => v >= xd[0] && v <= xd[1]), yt: niceTicks(yd[0], yd[1], 5).filter(v => v >= yd[0] && v <= yd[1]), fit: fitLine ? linfit(xs, ys) : null, xm: quantiles(xs, [0.5])[0], ym: quantiles(ys, [0.5])[0] }
  }, [pts, fitLine])
  const sx = v => M.left + ((v - xd[0]) / (xd[1] - xd[0])) * w
  const sy = v => M.top + h - ((v - yd[0]) / (yd[1] - yd[0])) * h
  const right = M.left + w, bottom = M.top + h

  const enter = p => { setHoverId(p.id); onHover?.(p.id) }
  const leave = () => { setHoverId(null); onHover?.(null) }
  const ordered = useMemo(() => [...pts].sort((a, b) => (a.id === selectedId) - (b.id === selectedId) || (!!a.named - !!b.named)), [pts, selectedId])
  const hover = hoverId != null ? pts.find(p => p.id === hoverId) : null

  let tip = null
  if (hover) {
    const l1 = hover.label || hover.id, l2 = `${xFormat(hover.x)} · ${yFormat(hover.y)}`
    const tw = Math.max(textW(l1, 11), textW(l2, 10)) + 18, th = 36
    const cx = sx(hover.x), cy = sy(hover.y)
    const tx = Math.min(Math.max(M.left, cx - tw / 2), right - tw)
    const above = cy - 12 - th >= 0
    const ty = above ? cy - 12 - th : cy + 12
    tip = <g className="xp-tip" transform={`translate(${tx.toFixed(1)} ${ty.toFixed(1)})`}><rect width={tw.toFixed(1)} height={th} rx="6" /><text x="9" y="14">{l1}</text><text className="v" x="9" y="28">{l2}</text></g>
  }

  return (
    <svg className="xp-chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ maxWidth: width }} role="img" aria-label={`${yLabel} against ${xLabel}, ${pts.length} regions`} onMouseLeave={leave}>
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
      <g className="xp-points">
        {ordered.map(p => {
          const cx = sx(p.x), cy = sy(p.y), sel = p.id === selectedId
          const lw = textW(p.label || p.id, 11), left = cx + 10 + lw > right
          return (
            <g key={p.id} className={`xp-pt ${sectorClass(p.sector)}${p.flagged ? ' hollow' : ''}${p.named ? ' named' : ''}${sel ? ' sel' : ''}${hoverId === p.id ? ' hov' : ''}`} onMouseEnter={() => enter(p)} onClick={() => onSelect?.(p.id)}>
              <circle className="xp-hit" cx={cx} cy={cy} r="9" />
              {p.named && <circle className="xp-ring" cx={cx} cy={cy} r="7" />}
              <circle className="xp-dot" cx={cx} cy={cy} r={sel ? 4 : 2.5} />
              {p.named && <text className="xp-name" x={left ? cx - 11 : cx + 11} y={cy} dy="3.5" textAnchor={left ? 'end' : 'start'}>{p.label || p.id}</text>}
            </g>
          )
        })}
      </g>
      {tip}
    </svg>
  )
}
