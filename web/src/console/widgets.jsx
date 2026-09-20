// Small presentational pieces. No chart library on primary screens.
// Colour semantics (see styles/dataviz.css): clean power is the cool token, fossil is the
// ember, everything else is the neutral ramp. A share in 0..1 is coloured by mixing
// fossil -> clean in oklab, so the same value always reads the same way on every screen.
import NumberTicker from '../components/NumberTicker.jsx'
import '../styles/dataviz.css'

const clamp01 = v => Math.min(1, Math.max(0, Number(v) || 0))
// fossil at 0, clean at 1. The only place a data colour is made.
const cleanMix = v => `color-mix(in oklab, var(--dv-clean) ${Math.round(clamp01(v) * 100)}%, var(--dv-fossil))`
// a value-driven step on the neutral ramp, for quantities that are not clean power
const greyMix = v => `color-mix(in oklab, var(--ink) ${Math.round(clamp01(v) * 80)}%, var(--muted))`
const pct = v => `${(clamp01(v) * 100).toFixed(1)}%`

export function Card({ title, right, children, className = '', style, onClose }) {
  return (
    <section className={`card ${className}`} style={style}>
      {(title || right || onClose) && <header className="card-head"><span className="eyebrow">{title}</span><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{right}{onClose && <button type="button" className="close" onClick={onClose} aria-label="Back to start">×</button>}</span></header>}
      {children}
    </section>
  )
}

// `num` + `format` animates the figure when it appears or changes; `value` renders a string as-is.
export function Num({ value, num, format, label, sub, accent = false }) {
  return <div className="num"><div className={`v ${accent ? 'accent' : ''}`}>{num != null ? <NumberTicker value={num} format={format} /> : value}</div><div className="l">{label}{sub && <div className="s">{sub}</div>}</div></div>
}

// A donut. The arc is coloured by the value itself (fossil -> clean), the track is neutral.
// `sub` puts one micro label under the figure; `text` still overrides the figure.
export function Ring({ value, text, size = 56, sub, title }) {
  const r = 26, c = 2 * Math.PI * r, v = clamp01(value)
  const label = text ?? `${Math.round(v * 100)}%`
  return (
    <svg className={`dv-ring${sub ? ' has-sub' : ''}`} viewBox="0 0 64 64" width={size} height={size} role="img" aria-label={title || `${label}${sub ? ` ${sub}` : ''}`}>
      <circle className="dv-ring-track" cx="32" cy="32" r={r} />
      {v > 0.004 && <circle className="dv-ring-val" cx="32" cy="32" r={r} stroke={cleanMix(v)} strokeDasharray={`${(c * v).toFixed(2)} ${c.toFixed(2)}`} />}
      <text className="dv-ring-v" x="32" y={sub ? 29 : 32}>{label}</text>
      {sub && <text className="dv-ring-sub" x="32" y="42">{sub}</text>}
    </svg>
  )
}

// A 20-step scale. Filled steps are coloured by the value; `mark` drops a 1px rule at a
// reference value (the median, say) in the same units as `value`, so one component answers
// "how much" and "compared with what". `tone="clean"` uses the clean/fossil ramp; the
// default stays on the neutral ramp, because not every quantity is clean power.
export function Ticks({ value, max = 100, n = 20, accent = false, mark = null, tone = 'neutral', label }) {
  const v = max ? Math.min(1, Math.max(0, (value ?? 0) / max)) : 0
  const k = value == null ? 0 : Math.round(v * n)
  const fill = accent ? 'var(--dv-fossil)' : tone === 'clean' ? cleanMix(v) : greyMix(v)
  const m = mark == null || !max ? null : Math.min(1, Math.max(0, mark / max))
  return (
    <span className="dv-ticks" style={{ '--dv-fill': fill }} role="img" aria-label={label || `${Math.round(v * 100)} of 100`}>
      <span className="dv-ticks-row" aria-hidden="true">{Array.from({ length: n }, (_, i) => <i key={i} className={i < k ? 'on' : ''} />)}</span>
      {m != null && <span className="dv-ticks-mark" style={{ left: `${(m * 100).toFixed(2)}%` }} />}
    </span>
  )
}

// rows: [label, value] or [label, value, { wide }]. `wide` puts the value on its own line, for
// values that are a sentence rather than a figure.
export function KV({ rows }) {
  return (
    <ul className="kvrows">
      {rows.filter(Boolean).map(([k, v, opt]) => {
        const long = opt?.wide ?? (typeof v === 'string' && v.length > 28)
        return <li key={String(k)} className={long ? 'wide' : ''}><span>{k}</span><span>{v}</span></li>
      })}
    </ul>
  )
}

const hours24 = values => (Array.isArray(values)
  ? Array.from({ length: 24 }, (_, h) => (typeof values[h] === 'number' ? values[h] : null))
  : values ? Array.from({ length: 24 }, (_, h) => { const x = values[h] ?? values[String(h)]; return typeof x === 'number' ? x : null }) : null)

// 24 bars, one per hour. Height AND colour carry the clean share, so a low bar is also an
// ember bar. The overnight window is marked by a rule under the first six hours, never by
// recolouring them. `compare` is an optional second series (2019, say) drawn as a thin
// outline over the bars so the change in shape reads, not only the change in level.
// `values`/`compare` are arrays of 24 numbers in 0..1 or objects keyed by hour.
export function HourBars({ values, night = [0, 5], day = [10, 15], caption, compare, compareLabel = '2019', height = 54 }) {
  const arr = hours24(values)
  if (!arr) return null
  const cmp = compare ? hours24(compare) : null
  const seen = [...arr, ...(cmp || [])].filter(x => x != null)
  const peak = seen.length ? Math.max(...seen) : 0
  // round the top of the scale up to a quarter so small shares still have shape, and say so
  const top = Math.min(1, Math.max(0.25, Math.ceil(peak * 4 - 1e-9) / 4))
  const nightW = ((night[1] - night[0] + 1) / 24) * 100
  const y = v => 100 - (clamp01(v) / top) * 100
  let d = '', open = false
  if (cmp) cmp.forEach((v, h) => { if (v == null) { open = false; return } const yy = y(v).toFixed(2); d += `${open ? 'L' : 'M'}${h} ${yy}L${h + 1} ${yy}`; open = true })
  return (
    <div className="dv-hours dv-enter" key={`${arr.join()}|${cmp ? cmp.join() : ''}`}>
      {caption && <div className="section-title">{caption}</div>}
      <div className="dv-hours-plot" style={{ height }}>
        <div className="dv-hours-bars">
          {arr.map((v, h) => (
            <i
              key={h}
              style={{ height: `${v == null ? 0 : Math.max(3, (clamp01(v) / top) * 100)}%`, background: v == null ? 'var(--dv-n2)' : cleanMix(v), animationDelay: `${h * 6}ms` }}
              title={`${String(h).padStart(2, '0')}:00 · ${v == null ? '—' : `${pct(v)} clean`}${cmp && cmp[h] != null ? ` · ${compareLabel} ${pct(cmp[h])}` : ''}${h >= night[0] && h <= night[1] ? ' · overnight' : h >= day[0] && h <= day[1] ? ' · daytime' : ''}`}
            />
          ))}
        </div>
        {d && <svg className="dv-hours-cmp" viewBox="0 0 24 100" preserveAspectRatio="none" aria-hidden="true"><path d={d} /></svg>}
      </div>
      <div className="dv-hours-mark">
        <span className="rule" style={{ width: `${nightW.toFixed(2)}%` }} />
        <span className="dv-micro">midnight to 6am</span>
        <span className="dv-micro scale">max {Math.round(top * 100)}%</span>
      </div>
      <div className="dv-hours-axis"><span className="dv-micro">midnight</span><span className="dv-micro">noon</span><span className="dv-micro">midnight</span></div>
      {d && <div className="dv-hours-legend"><span className="dv-micro"><i className="sw" />{compareLabel}, same hours</span></div>}
    </div>
  )
}

export function Chip({ children, href, onClick, active, dim, small, accent, onRemove }) {
  const cls = `chip ${active ? 'on' : ''} ${dim ? 'dim' : ''} ${small ? 'sm' : ''} ${accent ? 'accent' : ''}`
  const inner = <>{children}{onRemove && <span className="x" role="button" aria-label="Remove" onClick={e => { e.preventDefault(); e.stopPropagation(); onRemove() }}>×</span>}</>
  return href ? <a className={cls} href={href}>{inner}</a> : <button type="button" className={cls} onClick={onClick}>{inner}</button>
}

// Collapsible evidence: closed by default, one control, plain label.
export function Evidence({ open, onToggle, label = 'Show the evidence', children }) {
  return (
    <>
      <button type="button" className="toggle" onClick={onToggle} aria-expanded={open}><b>{open ? 'Hide' : label}</b><span>{open ? '▴' : '▾'}</span></button>
      {open && children}
    </>
  )
}

export function Section({ title, right, children }) {
  return <Card><div className="section-title"><span>{title}</span>{right}</div>{children}</Card>
}
