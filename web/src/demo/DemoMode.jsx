import { useEffect, useState } from 'react'
import { SCENES } from './scenes.js'

const typing = e => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable

// Demo mode: 'd' toggles, → / space / PageDown next scene, ← / PageUp previous, Esc exits.
export function useDemoMode(hash) {
  const [on, setOn] = useState(() => /[?&]demo=1/.test(window.location.hash))
  const idx = SCENES.findIndex(s => s.match(hash))
  useEffect(() => {
    const go = i => { window.location.hash = SCENES[(i + SCENES.length) % SCENES.length].route }
    const onKey = e => {
      if (typing(e)) return
      if (e.key === 'd' || e.key === 'D') { setOn(v => !v); return }
      if (!on) return
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(idx + 1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(idx - 1) }
      else if (e.key === 'Escape') setOn(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [on, idx])
  return { on, idx, scene: SCENES[idx] || null }
}

export function DemoHud({ on, idx }) {
  if (!on) return null
  const s = SCENES[idx]
  return <div className="demo-hud">demo <b>{idx < 0 ? '–' : idx + 1}</b> / {SCENES.length} · {s ? s.title : 'press → to start'} · ← →</div>
}
