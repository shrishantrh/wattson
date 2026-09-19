// Instrument widgets shared by every console mode. No chart library; these are the
// six-feet-readable primitives from the reference boards: bracketed panels, ring gauge,
// numerator/denominator numerals, segmented tick bars, key:value rows, hour bars.
import { n0 } from '../lib/findings.js'

export function Panel({ title, right, className = '', children, style }) {
  return (
    <section className={`panel bracket ${className}`} style={style}>
      {(title || right) && <header className="panel-head"><span className="panel-title">{title}</span>{right}</header>}
      {children}
    </section>
  )
}

export function Ring({ value, text, size = 64 }) {
  const r = 26, c = 2 * Math.PI * r, v = Math.min(1, Math.max(0, value ?? 0))
  return (
    <svg className="ring" viewBox="0 0 64 64" width={size} height={size} aria-label={text}>
      <circle className="track" cx="32" cy="32" r={r} />
      <circle className="val" cx="32" cy="32" r={r} strokeDasharray={`${c * v} ${c}`} />
      <text x="32" y="32">{text ?? `${Math.round(v * 100)}%`}</text>
    </svg>
  )
}

export function Ticks({ value, max = 100, n = 16, accent = false }) {
  const k = value == null ? 0 : Math.round(Math.min(1, Math.max(0, value / max)) * n)
  return <span className={`ticks ${accent ? 'accent' : ''}`} aria-hidden="true">{Array.from({ length: n }, (_, i) => <i key={i} className={i < k ? 'on' : value != null && value < 0 ? 'neg' : ''} />)}</span>
}

export function BigNum({ num, den, unit, accent = false, className = '' }) {
  return <div className={`bignum ${accent ? 'accent' : ''} ${className}`}>{num}{den != null && <span className="den">/ {den}{unit ? ` ${unit}` : ''}</span>}{den == null && unit && <span className="den">{unit}</span>}</div>
}

export function KV({ rows }) {
  return <ul className="kvrows">{rows.filter(Boolean).map(([k, v]) => <li key={k}><span>{k}</span><span>{v}</span></li>)}</ul>
}

// 24 bars. `values` is an array of 24 numbers in 0..1 or an object keyed by hour.
export function HourBars({ values, night = [0, 5], day = [10, 15], caption }) {
  const arr = Array.isArray(values) ? values : values ? Array.from({ length: 24 }, (_, h) => values[h] ?? values[String(h)] ?? null) : null
  if (!arr) return null
  const max = Math.max(...arr.filter(x => x != null), 0.0001)
  return (
    <div>
      {caption && <div className="panel-title" style={{ marginBottom: 8 }}>{caption}</div>}
      <div className="hourbars">{arr.map((v, h) => <i key={h} className={h >= night[0] && h <= night[1] ? 'night' : h >= day[0] && h <= day[1] ? 'day' : ''} style={{ height: `${v == null ? 0 : Math.max(4, (v / max) * 100)}%` }} title={`${h}:00 ${v == null ? '—' : (v * 100).toFixed(1) + '%'}`} />)}</div>
      <div className="hourbars-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
    </div>
  )
}

export function Pill({ children, value, active, onClick, href }) {
  const inner = <>{children}{value != null && <span className="v">{value}</span>}{onClick || href ? <span className="caret">▾</span> : null}</>
  return href ? <a className={`pill ${active ? 'on' : ''}`} href={href}>{inner}</a> : <button type="button" className={`pill ${active ? 'on' : ''}`} onClick={onClick}>{inner}</button>
}

export function Stat({ num, den, unit, label, value, max, accent }) {
  return <div className="stat"><BigNum num={num} den={den} unit={unit} accent={accent} /><div className="label">{label}</div>{value != null && <Ticks value={value} max={max} accent={accent} />}</div>
}

export const fmtMW = x => `${n0(x)} MW`
