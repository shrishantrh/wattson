/* oxlint-disable react/only-export-components -- the hook and its handle share this file on purpose */
import { useEffect, useRef, useState } from 'react'
import '../styles/workspace.css'

// const [width, handleProps] = useColumnWidth('column', 420, 320, 720)
// <ResizeHandle {...handleProps} />  sits on the right edge of a position: relative host.
// Width persists in localStorage under `wattson.col.<key>`. Drag sets it live (pointer capture);
// arrows nudge 16px (64 with shift), Home/End go to min/max, double-click resets.

const storeKey = key => `wattson.col.${key}`
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const read = (key, fallback, lo, hi) => { try { const v = Number(window.localStorage.getItem(storeKey(key))); return Number.isFinite(v) && v > 0 ? clamp(v, lo, hi) : fallback } catch { return fallback } }
const write = (key, v) => { try { window.localStorage.setItem(storeKey(key), String(Math.round(v))) } catch { /* storage unavailable: width lives for the session only */ } }

export function useColumnWidth(key, defaultPx = 420, min = 320, max = 720) {
  const [width, setWidth] = useState(() => read(key, clamp(defaultPx, min, max), min, max))
  const [dragging, setDragging] = useState(false)
  const drag = useRef(null)
  useEffect(() => { if (!dragging) write(key, width) }, [key, width, dragging])
  useEffect(() => {
    if (!dragging) return
    document.body.classList.add('is-resizing')
    return () => document.body.classList.remove('is-resizing')
  }, [dragging])
  const onPointerDown = e => {
    if (e.button != null && e.button !== 0) return
    e.preventDefault()
    drag.current = { x0: e.clientX, w0: width }
    if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }
  const onPointerMove = e => { const d = drag.current; if (d) setWidth(clamp(Math.round(d.w0 + e.clientX - d.x0), min, max)) }
  const end = e => {
    if (!drag.current) return
    drag.current = null
    if (e.currentTarget.releasePointerCapture) { try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* already released */ } }
    setDragging(false)
  }
  const onKeyDown = e => {
    const step = e.shiftKey ? 64 : 16
    let w = null
    if (e.key === 'ArrowLeft') w = width - step
    else if (e.key === 'ArrowRight') w = width + step
    else if (e.key === 'Home') w = min
    else if (e.key === 'End') w = max
    if (w == null) return
    e.preventDefault()
    setWidth(clamp(w, min, max))
  }
  const reset = () => setWidth(clamp(defaultPx, min, max))
  const handleProps = {
    role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Resize column', 'aria-valuenow': width, 'aria-valuemin': min, 'aria-valuemax': max, tabIndex: 0,
    'data-dragging': dragging ? 'true' : undefined, title: 'Drag to resize. Double-click to reset',
    onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end, onKeyDown, onDoubleClick: reset,
  }
  return [width, handleProps, { dragging, reset, set: v => setWidth(clamp(v, min, max)) }]
}

export function ResizeHandle({ className = '', ...props }) {
  return <div className={`resize-handle ${className}`} {...props}><i aria-hidden="true" /></div>
}
