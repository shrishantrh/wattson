import { useEffect, useRef, useState } from 'react'
import { SCENES } from '../demo/scenes.js'
import { TOUR } from '../demo/tour.js'
import '../styles/tour.css'

// The guided tour. <Tour on idx /> takes demo mode's `on` and `idx` (the current scene) and shows,
// for the TOUR step with that scene's id, a caption card at the bottom centre, a step bar along the
// top edge and, when the step names a `focus` selector and the element exists, a 2px outline around
// it. Keys while the tour shows and nobody is typing: p play/pause, Esc hide (demo mode and its hud
// stay on), t show again. Stepping stays with demo mode (← →); playing presses → for you.
// Props: on, idx, ms (seconds between steps when playing, default 9000), auto (optional: the result
// of useAutoAdvance if the app calls it itself; otherwise the tour runs its own).

const typing = e => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || !!e.target?.isContentEditable
const overlayOpen = () => !!document.querySelector('.sheet-overlay, .pal-overlay')
const pressNext = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
const stepIndex = idx => { const s = SCENES[idx]; return s ? TOUR.findIndex(t => t.sceneId === s.id) : -1 }

// While `playing`, presses → every `ms` (demo mode then moves to the next scene). Stops at the last step.
// oxlint-disable-next-line react/only-export-components
export function useAutoAdvance(on, idx, ms = 9000) {
  const [playing, setPlaying] = useState(false)
  const n = stepIndex(idx)
  const atEnd = idx >= SCENES.length - 1 || (n >= 0 && n >= TOUR.length - 1)
  useEffect(() => { if (!on) setPlaying(false) }, [on])
  useEffect(() => {
    if (!on || !playing) return
    if (atEnd) { setPlaying(false); return }
    const id = setInterval(pressNext, ms)
    return () => clearInterval(id)
  }, [on, playing, atEnd, idx, ms])
  return { playing, setPlaying, toggle: () => setPlaying(v => !v), atEnd }
}

// The viewport box of the first element matching `selector`, or null. The page behind a scene loads
// lazily and then fetches, so the element is looked up again every 250 ms until it exists, then kept
// in step with resize, any scroll, and a slow re-measure for layout shifts (fonts, data arriving).
function useFocusRect(selector, active) {
  const [rect, setRect] = useState(null)
  useEffect(() => {
    if (!active || !selector) { setRect(null); return }
    let timer = 0, misses = 0
    const measure = () => {
      const el = document.querySelector(selector)
      const r = el && el.getBoundingClientRect()
      if (!r || (!r.width && !r.height)) { misses++; setRect(null); return false }
      misses = 0
      setRect(p => (p && p.top === r.top && p.left === r.left && p.width === r.width && p.height === r.height ? p : { top: r.top, left: r.left, width: r.width, height: r.height }))
      return true
    }
    const tick = () => { const found = measure(); timer = setTimeout(tick, found || misses > 24 ? 1000 : 250) }
    tick()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => { clearTimeout(timer); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [selector, active])
  return rect
}

export default function Tour({ on, idx, ms = 9000, auto = null }) {
  const [hidden, setHidden] = useState(false)
  const own = useAutoAdvance(on && !auto, idx, ms)
  const play = auto || own
  const playRef = useRef(play)
  useEffect(() => { playRef.current = play })
  const n = stepIndex(idx)
  const step = n >= 0 ? TOUR[n] : null
  const scene = SCENES[idx] || null
  const show = on && !hidden
  const rect = useFocusRect(step?.focus, show)
  const lastRect = useRef(null)
  if (rect) lastRect.current = rect
  const box = rect || lastRect.current

  // Entering demo mode shows the tour again after an Esc.
  useEffect(() => { if (on) setHidden(false) }, [on])

  useEffect(() => {
    if (!on) return
    const hide = () => { setHidden(true); playRef.current.setPlaying(false) }
    const onKey = e => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') {
        // Capture phase, so demo mode's own Esc (exit demo) does not fire; an open sheet or palette keeps its Esc.
        if (hidden || overlayOpen()) return
        e.preventDefault(); e.stopPropagation(); hide()
      } else if (e.key === 't' || e.key === 'T') { if (hidden) setHidden(false); else hide() }
      else if ((e.key === 'p' || e.key === 'P') && !hidden) playRef.current.toggle()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [on, hidden])

  if (!show) return null
  const press = fn => e => { e.currentTarget.blur(); fn() }   // so a later Space goes to demo mode, not the button
  return (
    <>
      <div className="tour-progress" aria-hidden="true">{TOUR.map((t, i) => <i key={t.sceneId} className={i <= n ? 'done' : ''} />)}</div>
      {box && <div className={`tour-focus ${rect ? 'on' : ''}`} aria-hidden="true" style={{ top: box.top - 4, left: box.left - 4, width: box.width + 8, height: box.height + 8 }} />}
      <aside className="tour-card" role="note" aria-label="Tour caption">
        <header className="tour-head">
          <span className="tour-step">{n >= 0 ? n + 1 : '–'} / {TOUR.length}</span>
          <span className="tour-title">{scene ? scene.title : 'Press → to start'}</span>
          <span className="tour-tools">
            <button type="button" className={`tour-btn ${play.playing ? 'on' : ''}`} onClick={press(play.toggle)} aria-pressed={play.playing} disabled={play.atEnd && !play.playing} data-tip={play.playing ? 'Pause' : `Play, ${Math.round(ms / 1000)} s a step`}>{play.playing ? 'Pause' : 'Play'}</button>
            <button type="button" className="tour-btn" onClick={press(() => { setHidden(true); play.setPlaying(false) })} aria-label="Hide the tour" data-tip="Hide (Esc)">×</button>
          </span>
        </header>
        {step
          ? <><p className="tour-caption">{step.caption}</p><p className="tour-say"><span className="tour-say-k">say</span>{step.say}</p></>
          : <p className="tour-caption">{scene ? 'No caption for this screen.' : 'Press → to start the tour.'}</p>}
        <footer className="tour-hints">
          <span><kbd className="kbd">←</kbd> <kbd className="kbd">→</kbd> step</span>
          <span><kbd className="kbd">p</kbd> {play.playing ? 'pause' : 'play'}</span>
          <span><kbd className="kbd">esc</kbd> hide</span>
          <span><kbd className="kbd">t</kbd> show</span>
          <span><kbd className="kbd">d</kbd> exit demo</span>
        </footer>
      </aside>
    </>
  )
}
