// Small presentational pieces. No chart library on primary screens.
export function Card({ title, right, children, className = '', style, onClose }) {
  return (
    <section className={`card ${className}`} style={style}>
      {(title || right || onClose) && <header className="card-head"><span className="eyebrow">{title}</span><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{right}{onClose && <button type="button" className="close" onClick={onClose} aria-label="Back to start">×</button>}</span></header>}
      {children}
    </section>
  )
}

export function Num({ value, label, sub, accent = false }) {
  return <div className="num"><div className={`v ${accent ? 'accent' : ''}`}>{value}</div><div className="l">{label}{sub && <div className="s">{sub}</div>}</div></div>
}

export function Ring({ value, text, size = 56 }) {
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
  return <span className={`ticks ${accent ? 'accent' : ''}`} aria-hidden="true">{Array.from({ length: n }, (_, i) => <i key={i} className={i < k ? 'on' : ''} />)}</span>
}

export function KV({ rows }) {
  return <ul className="kvrows">{rows.filter(Boolean).map(([k, v]) => <li key={String(k)}><span>{k}</span><span>{v}</span></li>)}</ul>
}

// 24 bars. `values` is an array of 24 numbers in 0..1 or an object keyed by hour.
export function HourBars({ values, night = [0, 5], day = [10, 15], caption }) {
  const arr = Array.isArray(values) ? values : values ? Array.from({ length: 24 }, (_, h) => values[h] ?? values[String(h)] ?? null) : null
  if (!arr) return null
  const max = Math.max(...arr.filter(x => x != null), 0.0001)
  return (
    <div>
      {caption && <div className="section-title">{caption}</div>}
      <div className="hourbars">{arr.map((v, h) => <i key={h} className={h >= night[0] && h <= night[1] ? 'night' : h >= day[0] && h <= day[1] ? 'day' : ''} style={{ height: `${v == null ? 0 : Math.max(4, (v / max) * 100)}%` }} title={`${h}:00 · ${v == null ? '—' : (v * 100).toFixed(1) + '% clean'}`} />)}</div>
      <div className="hourbars-axis"><span>midnight</span><span>6am</span><span>noon</span><span>6pm</span><span>midnight</span></div>
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
