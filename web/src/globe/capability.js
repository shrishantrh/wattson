// Decide whether the 3D globe or the 2D fallback should render.
import { useEffect, useState } from 'react'

let cached = null

/**
 * Synchronous capability check. The result is cached for the page's lifetime so repeated
 * calls do not keep creating probe WebGL contexts.
 * @returns {'webgl'|'flat'} 'flat' when WebGL2 is unavailable, when the user prefers reduced
 * motion, or when there is no window (server side).
 */
export function detectGlobeCapability() {
  if (cached) return cached
  cached = probe()
  return cached
}

function probe() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 'flat'
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'flat'
  } catch {
    // matchMedia unavailable: ignore and keep probing
  }
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) return 'flat'
    const lose = gl.getExtension('WEBGL_lose_context')
    if (lose) lose.loseContext() // release the probe context right away
  } catch {
    return 'flat'
  }
  return 'webgl'
}

/**
 * React hook: `detectGlobeCapability()` plus a performance probe after mount. If the first
 * `frames` frames of a requestAnimationFrame loop average worse than `budgetMs` per frame the
 * result switches to 'flat'. Once 'flat' it stays 'flat' for the life of the component.
 * @param {{ frames?: number, budgetMs?: number }} [opts]
 * @returns {'webgl'|'flat'}
 */
export function useGlobeCapability({ frames = 30, budgetMs = 40 } = {}) {
  const [capability, setCapability] = useState(() => detectGlobeCapability())

  useEffect(() => {
    if (capability !== 'webgl') return undefined
    let cancelled = false
    let raf = 0
    let count = 0
    let total = 0
    let last = 0
    const tick = (now) => {
      if (cancelled) return
      total += now - last
      last = now
      count += 1
      if (count >= frames) {
        if (total / count > budgetMs) setCapability('flat')
        return
      }
      raf = requestAnimationFrame(tick)
    }
    // Start timing from the first delivered frame so the mount itself is not counted.
    raf = requestAnimationFrame((now) => {
      last = now
      raf = requestAnimationFrame(tick)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [capability, frames, budgetMs])

  return capability
}
