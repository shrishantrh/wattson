/* oxlint-disable react/only-export-components -- sparkPath is pure and exported for tests */
import '../styles/workspace.css'
import '../styles/dataviz.css'

// <Sparkline values={[...]} width={96} height={24} stroke="currentColor" accentLast baseline area delta />
// A polyline scaled to min/max, no axes. Nulls break the line. accentLast puts a dot on the last
// value; baseline draws a dashed line at the first value; `area` fills under the line at very low
// alpha; `delta` colours the line --pos or --neg by the direction from the first value to the last.
// A hollow dot marks the first value whenever there is more than one point, so the reader sees
// where the series started as well as where it ended.

const r2 = n => Math.round(n * 100) / 100
const isNum = x => typeof x === 'number' && Number.isFinite(x)

// Pure. Values -> { segments: [[{x,y,v,i}]], points, first, last, min, max, d }. A flat series
// draws mid-height. Single isolated points come back as one-point segments.
export function sparkPath(values, width = 96, height = 24, pad = 2) {
  const arr = Array.isArray(values) ? values : []
  const nums = arr.filter(isNum)
  if (!nums.length) return { segments: [], points: [], first: null, last: null, min: null, max: null, d: '' }
  const n = arr.length
  const min = Math.min(...nums), max = Math.max(...nums)
  const w = width - 2 * pad, h = height - 2 * pad
  const x = i => r2(n === 1 ? width / 2 : pad + (i * w) / (n - 1))
  const y = v => r2(max === min ? height / 2 : pad + ((max - v) / (max - min)) * h)
  const points = arr.map((v, i) => (isNum(v) ? { x: x(i), y: y(v), v, i } : null))
  const segments = []
  let cur = []
  for (const p of points) { if (p) cur.push(p); else if (cur.length) { segments.push(cur); cur = [] } }
  if (cur.length) segments.push(cur)
  const valid = points.filter(Boolean)
  const d = segments.map(seg => seg.map((p, k) => `${k ? 'L' : 'M'}${p.x} ${p.y}`).join('')).join('')
  return { segments, points, first: valid[0], last: valid[valid.length - 1], min, max, d }
}

export default function Sparkline({ values, width = 96, height = 24, stroke = 'currentColor', strokeWidth = 1.25, accentLast = false, baseline = false, area = false, delta = false, pad = 2, className = '', title }) {
  const s = sparkPath(values, width, height, pad)
  const dir = delta && s.first && s.last && s.last.v !== s.first.v ? (s.last.v > s.first.v ? 'up' : 'down') : ''
  const fills = area
    ? s.segments.filter(seg => seg.length > 1).map(seg => `M${seg[0].x} ${height - pad}${seg.map(p => `L${p.x} ${p.y}`).join('')}L${seg[seg.length - 1].x} ${height - pad}Z`)
    : []
  return (
    <svg className={`spark dv-spark ${dir} ${className}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role={title ? 'img' : undefined} aria-hidden={title ? undefined : 'true'}>
      {title && <title>{title}</title>}
      {fills.map((d, k) => <path key={`a${k}`} className="dv-spark-area" d={d} fill={stroke} />)}
      {baseline && s.first && <line className="spark-base" x1={pad} x2={width - pad} y1={s.first.y} y2={s.first.y} stroke={stroke} />}
      {s.segments.map((seg, k) => (seg.length === 1
        ? <circle key={k} className="spark-pt" cx={seg[0].x} cy={seg[0].y} r={strokeWidth} fill={stroke} />
        : <polyline key={k} className="spark-line" points={seg.map(p => `${p.x},${p.y}`).join(' ')} stroke={stroke} strokeWidth={strokeWidth} />))}
      {s.first && s.last && s.first !== s.last && <circle className="dv-spark-first" cx={s.first.x} cy={s.first.y} r={1.9} stroke={stroke} />}
      {accentLast && s.last && <circle className="spark-dot" cx={s.last.x} cy={s.last.y} r={2} />}
    </svg>
  )
}
