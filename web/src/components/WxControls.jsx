/* oxlint-disable react/only-export-components -- fmtNum, nn and useKeyList are pure helpers exported beside the components that use them */
import { useCallback, useEffect, useRef, useState } from 'react'
import '../styles/wx.css'

// Controls the secondary screens share. Every one of them is a real filter or a real
// selector: it changes a figure computed from the loaded data, never a decoration.
//
// The null rule is enforced here so no page has to remember it: `nn` is the only way a
// value reaches the screen, and a null becomes an em dash. A null must never render as 0,
// "null", "NaN", "undefined" or an empty string, a null drawn as a 0% bar is a lie.

export const DASH = '—'
export const isNum = v => typeof v === 'number' && Number.isFinite(v)
// nn(value, format) -> formatted text, or an em dash when the value is absent.
export const nn = (v, format = String) => (v == null || (typeof v === 'number' && !Number.isFinite(v)) ? DASH : format(v))
export const fmtNum = (v, d = 0) => (isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : DASH)
export const signedPts = v => (isNum(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)} pts` : DASH)

// A slider that reports its own value. `format` renders the current value beside the label,
// `ends` the two extremes under the track, so the control says what it is doing at rest.
export function WxRange({ label, value, min, max, step = 1, onChange, format = String, hint }) {
  const span = max - min
  const fill = span > 0 ? ((value - min) / span) * 100 : 0
  return (
    <div className="wx-group wx-range">
      <span className="wx-k">{label}<b>{format(value)}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} aria-label={hint || label} style={{ '--wx-fill': `${Math.max(0, Math.min(100, fill)).toFixed(1)}%` }} />
      <span className="wx-ends"><span>{format(min)}</span><span>{format(max)}</span></span>
    </div>
  )
}

// A segmented control: exactly one option on. options: [value, label] or [value, label, title].
export function WxSeg({ label, options, value, onChange }) {
  const seg = (
    <span className="wx-seg" role="group" aria-label={label || 'options'}>
      {options.map(([v, text, title]) => (
        <button key={String(v)} type="button" aria-pressed={v === value} title={title} onClick={() => onChange(v)}>{text}</button>
      ))}
    </span>
  )
  return label ? <div className="wx-group"><span className="wx-k">{label}</span>{seg}</div> : seg
}

// Multi-select chips. `value` is an array; clicking toggles one. options: [value, label, count].
export function WxChips({ label, options, value, onChange, allLabel = 'all' }) {
  const on = new Set(value)
  const all = on.size === 0 || on.size === options.length
  const toggle = v => onChange(on.has(v) ? value.filter(x => x !== v) : [...value, v])
  return (
    <div className="wx-group">
      {label && <span className="wx-k">{label}<b>{all ? allLabel : `${on.size} of ${options.length}`}</b></span>}
      <span className="wx-row">
        {options.map(([v, text, count]) => (
          <button key={String(v)} type="button" className={`chip sm ${on.has(v) ? 'on' : 'dim'}`} aria-pressed={on.has(v)} onClick={() => toggle(v)}>
            {text}{count != null && <span className="muted"> {count}</span>}
          </button>
        ))}
      </span>
    </div>
  )
}

// One figure that moves when a control moves.
export function WxReadout({ items }) {
  return (
    <div className="wx-readout">
      {items.filter(Boolean).map((it, i) => (
        <div key={it.label || i}><div className={`v ${it.tone || ''}`}>{it.value}</div><div className="l">{it.label}</div></div>
      ))}
    </div>
  )
}

// Arrow keys move a cursor through a list, Enter opens what it is on, Escape lets go.
// Returns { index, setIndex, listProps }, spread listProps on the scrolling container.
export function useKeyList(length, { onOpen, onEscape, onMove } = {}) {
  const [index, setIndex] = useState(-1)
  const ref = useRef(null)
  useEffect(() => { setIndex(i => (i >= length ? length - 1 : i)) }, [length])
  const move = useCallback(next => {
    const i = Math.max(0, Math.min(length - 1, next))
    setIndex(i)
    onMove?.(i)
    const el = ref.current?.querySelectorAll('[data-wx-item]')?.[i]
    if (el?.scrollIntoView) el.scrollIntoView({ block: 'nearest' })
  }, [length, onMove])
  const onKeyDown = useCallback(e => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return
    if (e.key === 'ArrowDown') { e.preventDefault(); move(index < 0 ? 0 : index + 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(index < 0 ? 0 : index - 1) }
    else if (e.key === 'Home') { e.preventDefault(); move(0) }
    else if (e.key === 'End') { e.preventDefault(); move(length - 1) }
    else if (e.key === 'Enter' && index >= 0) { e.preventDefault(); onOpen?.(index) }
    else if (e.key === 'Escape') { setIndex(-1); onEscape?.() }
  }, [index, length, move, onOpen, onEscape])
  // The caller supplies the role and any extra classes; these are only the mechanics.
  return { index, setIndex, listProps: { ref, tabIndex: 0, onKeyDown } }
}

// Arrow keys over a table the page did not build: focus moves row to row, Enter follows the
// row's link. Table rows are already focusable, so this only has to move the focus.
export function useTableKeys() {
  const ref = useRef(null)
  const onKeyDown = useCallback(e => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return
    const rows = [...(ref.current?.querySelectorAll('tbody tr[tabindex]') || [])]
    if (!rows.length) return
    e.preventDefault()
    const at = rows.indexOf(e.target.closest('tr'))
    const next = e.key === 'ArrowDown' ? (at < 0 ? 0 : Math.min(rows.length - 1, at + 1)) : (at < 0 ? 0 : Math.max(0, at - 1))
    rows[next].focus()
    rows[next].scrollIntoView({ block: 'nearest' })
  }, [])
  return { ref, onKeyDown }
}

// Escape anywhere on the page, when no field has focus. Used to clear a filter set.
export function useEscape(handler, active = true) {
  useEffect(() => {
    if (!active) return undefined
    const on = e => { if (e.key === 'Escape' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) handler() }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [handler, active])
}
