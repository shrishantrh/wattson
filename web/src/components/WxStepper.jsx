import { useCallback, useEffect } from 'react'
import '../styles/wx.css'

// Step controls: a dot per step, previous/next, and a counter. Left and right arrows move it
// while nothing else has the keyboard. Used for walking an argument one figure at a time
// instead of scrolling past all of them at once.
//
// The component owns no state: the page holds the index, so a step can be in the URL, be reset
// by a route change, or be driven by something else on the page.

export default function WxStepper({ steps, index, onIndex, label = 'step', keys = true, prevLabel = 'Back', nextLabel = 'Next' }) {
  const n = steps.length
  const go = useCallback(i => onIndex(Math.max(0, Math.min(n - 1, i))), [n, onIndex])
  useEffect(() => {
    if (!keys) return undefined
    const on = e => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1) }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [keys, index, go])

  return (
    <div className="wx-step">
      <button type="button" className="btn" onClick={() => go(index - 1)} disabled={index <= 0}>{prevLabel}</button>
      <span className="wx-dots" role="tablist" aria-label={`${label}s`}>
        {steps.map((s, i) => (
          <button key={s.key || i} type="button" role="tab" aria-selected={i === index} aria-label={`${label} ${i + 1}: ${s.title || ''}`} title={s.title} className={`wx-dot ${i === index ? 'on' : i < index ? 'done' : ''}`} onClick={() => go(i)} />
        ))}
      </span>
      <span className="wx-n">{label} {index + 1} of {n}</span>
      <button type="button" className="btn" onClick={() => go(index + 1)} disabled={index >= n - 1}>{nextLabel}</button>
    </div>
  )
}
