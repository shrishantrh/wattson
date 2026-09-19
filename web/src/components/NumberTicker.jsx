import { useEffect, useState } from 'react'
import '../styles/workspace.css'

// <NumberTicker value={number|string|null} format={(n, target) => string} duration={600} className />
// A number animates from the previously rendered value with an ease-out; a string renders as-is;
// null, undefined and NaN render an em dash. prefers-reduced-motion jumps straight to the value.

const REDUCE = '(prefers-reduced-motion: reduce)'
const canQuery = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

function useReducedMotion() {
  const [r, setR] = useState(() => canQuery() && window.matchMedia(REDUCE).matches)
  useEffect(() => {
    if (!canQuery()) return
    const mq = window.matchMedia(REDUCE)
    const f = e => setR(e.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  return r
}

const isNum = x => typeof x === 'number' && Number.isFinite(x)
const easeOut = t => 1 - Math.pow(1 - t, 3)
// Decimals of the target value, so the width stays put while the number ticks.
const decimalsOf = x => { const s = String(x); if (/e/i.test(s)) return 0; const i = s.indexOf('.'); return i < 0 ? 0 : Math.min(3, s.length - i - 1) }
const defaultFormat = (n, target) => { const d = decimalsOf(target); return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) }

export default function NumberTicker({ value, format, duration = 600, className = '' }) {
  const reduce = useReducedMotion()
  // Numbers tick, strings render as-is, null/NaN show a dash; anything else is stringified once so
  // the render-time comparison below cannot loop on a fresh object.
  const target = isNum(value) ? value : value == null || Number.isNaN(value) ? null : typeof value === 'string' ? value : String(value)
  const animate = isNum(target) && !reduce && duration > 0
  const [s, setS] = useState(() => ({ target, animate, from: target, shown: target }))
  // A new target (or a motion-preference flip) arrived: adjust during render. If the old shown
  // value is a number and we may animate, start from it; otherwise jump.
  if (!Object.is(s.target, target) || s.animate !== animate) {
    const from = animate && isNum(s.shown) ? s.shown : target
    setS({ target, animate, from, shown: from })
  }
  const { from } = s
  useEffect(() => {
    if (!animate || !isNum(from) || !isNum(target) || from === target) return
    const t0 = performance.now()
    let raf = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - t0) / duration)
      const v = t >= 1 ? target : from + (target - from) * easeOut(t)
      setS(p => (Object.is(p.target, target) ? { ...p, shown: v } : p))
      if (t < 1) raf = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(raf)
  }, [target, from, animate, duration])
  const shown = s.shown
  const fmt = format || defaultFormat
  const text = shown == null ? '—' : typeof shown === 'string' ? shown : isNum(shown) ? fmt(shown, target) : String(shown)
  return <span className={`ticker ${className}`} data-ticking={isNum(shown) && shown !== target ? 'true' : undefined}>{text}</span>
}
