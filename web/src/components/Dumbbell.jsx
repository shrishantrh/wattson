import { useLayoutEffect, useRef, useState } from 'react'
import '../styles/companies.css'
import '../styles/dataviz.css'

// <Dumbbell rows={[{ id, label, a, b, aLabel?, bLabel?, href? }]} aLabel="talk" bLabel="walk" format={v => `${Math.round(v)}%`} gap={20} />
// One row per item on a 0–100 axis: a hollow neutral dot at `a` (what is said), a filled clean dot
// at `b` (what the grid actually delivers), and a thick round-capped segment between them. The
// segment turns ember only when b trails a by more than `gap` points; everything else stays neutral.
// The 50% gridline is drawn a step stronger and its axis label brightened, so every row is read
// against the same halfway mark.
// Values are 0–100; a null value draws no dot. Rows are links when `href` is given. Pure SVG, measured
// to the container's width so text stays at CSS pixel sizes (13px labels, 12px mono values).
const ROW = 34, AXIS = 22, R = 4
const fmtDefault = v => (v == null || !Number.isFinite(Number(v)) ? '—' : `${Math.round(Number(v))}%`)
const isNum = v => v != null && Number.isFinite(Number(v))
const clamp = v => Math.min(100, Math.max(0, Number(v)))
const short = (s, n = 19) => { const t = String(s ?? ''); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t }

export default function Dumbbell({ rows = [], aLabel = 'talk', bLabel = 'walk', format, gap = 20, labelWidth = 132, valueWidth = 92 }) {
  const fmt = typeof format === 'function' ? format : fmtDefault
  const host = useRef(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = host.current
    if (!el) return undefined
    setW(Math.round(el.getBoundingClientRect().width))
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(entries => { for (const e of entries) setW(Math.round(e.contentRect.width)) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  if (!rows.length) return null
  const n = rows.length, h = n * ROW + AXIS, axisY = n * ROW
  const x0 = labelWidth, x1 = Math.max(x0 + 40, w - valueWidth)
  const px = v => x0 + (clamp(v) / 100) * (x1 - x0)
  const legendB = 11 + aLabel.length * 6.4 + 14
  return (
    <div ref={host} className="co-dumbbell">
      {w > 0 && (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${aLabel} against ${bLabel} for ${n} ${n === 1 ? 'row' : 'rows'}, 0 to 100 percent`}>
          {[0, 25, 50, 75, 100].map(t => <line key={t} className={t === 50 ? 'co-half' : 'co-grid'} x1={px(t)} x2={px(t)} y1={0} y2={axisY + 4} />)}
          {rows.map((r, i) => {
            const y = i * ROW + ROW / 2
            const both = isNum(r.a) && isNum(r.b)
            const gapped = both && Number(r.a) - Number(r.b) > gap
            const la = r.aLabel || aLabel, lb = r.bLabel || bLabel
            const title = `${r.label}: ${la} ${fmt(r.a)}, ${lb} ${fmt(r.b)}${gapped ? ` (${lb} trails ${la} by ${Math.round(Number(r.a) - Number(r.b))} points)` : ''}`
            const body = (
              <g className={`co-row${gapped ? ' gap' : ''}`}>
                <title>{title}</title>
                <rect className="co-hit" x={0} y={i * ROW} width={w} height={ROW} rx={6} />
                {i > 0 && <line className="co-sep" x1={0} x2={w} y1={i * ROW} y2={i * ROW} />}
                <text className="co-label" x={0} y={y} dominantBaseline="middle">{short(r.label)}</text>
                {both && <line className="co-seg" x1={px(r.a)} x2={px(r.b)} y1={y} y2={y} />}
                {isNum(r.a) && <circle className="co-a" cx={px(r.a)} cy={y} r={R} />}
                {isNum(r.b) && <circle className="co-b" cx={px(r.b)} cy={y} r={R} />}
                <text className="co-val" x={w} y={y} textAnchor="end" dominantBaseline="middle"><tspan className="co-va">{fmt(r.a)}</tspan><tspan className="co-vs"> → </tspan><tspan className="co-vb">{fmt(r.b)}</tspan></text>
              </g>
            )
            return r.href ? <a key={r.id ?? i} className="co-link" href={r.href}>{body}</a> : <g key={r.id ?? i}>{body}</g>
          })}
          <line className="co-tick" x1={x0} x2={x1} y1={axisY + 0.5} y2={axisY + 0.5} />
          {[0, 50, 100].map(t => <text key={t} className={`co-axis${t === 50 ? ' mid' : ''}`} x={px(t)} y={axisY + 14} textAnchor={t === 0 ? 'start' : t === 100 ? 'end' : 'middle'}>{t === 100 ? '100%' : t}</text>)}
          <g className="co-legend">
            <circle className="co-a" cx={4} cy={axisY + 10.5} r={3} />
            <text className="co-axis" x={11} y={axisY + 14}>{aLabel}</text>
            <circle className="co-b" cx={legendB} cy={axisY + 10.5} r={3} />
            <text className="co-axis" x={legendB + 7} y={axisY + 14}>{bLabel}</text>
          </g>
        </svg>
      )}
    </div>
  )
}
