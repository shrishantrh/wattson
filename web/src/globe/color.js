// Small CSS colour helpers shared by the globe modules. three's Color.setStyle warns on an
// rgba() alpha and drops it, so every colour that carries alpha is parsed here instead.
import * as THREE from 'three'

/**
 * Parse '#rgb', '#rrggbb', '#rrggbbaa', 'rgb()' or 'rgba()' into 0-255 channels plus alpha.
 * @param {string} color
 * @returns {{ r: number, g: number, b: number, a: number }|null} null for anything else (named colours)
 */
export function parseCss(color) {
  if (typeof color !== 'string') return null
  const s = color.trim()
  if (s[0] === '#') {
    let h = s.slice(1)
    if (h.length === 3 || h.length === 4) h = h.split('').map((ch) => ch + ch).join('')
    if (h.length !== 6 && h.length !== 8) return null
    const n = parseInt(h, 16)
    if (Number.isNaN(n)) return null
    if (h.length === 8) return { r: (n >>> 24) & 255, g: (n >>> 16) & 255, b: (n >>> 8) & 255, a: (n & 255) / 255 }
    return { r: (n >>> 16) & 255, g: (n >>> 8) & 255, b: n & 255, a: 1 }
  }
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(s)
  if (!m) return null
  let a = 1
  if (m[4] != null) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
  return { r: +m[1], g: +m[2], b: +m[3], a }
}

/** Multiply a colour's alpha by `alpha` and return it as an rgba() string. */
export function withAlpha(color, alpha) {
  const c = parseCss(color)
  if (!c) return color // named colours etc.: no fade, but still valid
  return `rgba(${c.r},${c.g},${c.b},${(c.a * alpha).toFixed(3)})`
}

/** `{ hex, alpha }` for a CSS colour, for three materials that take a hex plus an opacity. */
export function toThreeColor(color) {
  const c = parseCss(color)
  if (c) return { hex: (c.r << 16) | (c.g << 8) | c.b, alpha: c.a }
  return { hex: new THREE.Color(color).getHex(), alpha: 1 }
}

/**
 * Scale a colour's brightness by k (times its own alpha) and return it as opaque '#rrggbb'.
 * three-globe's atmosphere takes its colour through THREE.Color, which drops alpha, so the
 * only way to get a fainter rim is a darker colour: over a dark background the glow
 * (colour * intensity, normal-blended) reads the same as white at k opacity.
 */
export function dimHex(color, k) {
  const c = parseCss(color) || (() => {
    const t = new THREE.Color(color)
    return { r: Math.round(t.r * 255), g: Math.round(t.g * 255), b: Math.round(t.b * 255), a: 1 }
  })()
  const s = Math.max(0, Math.min(1, k)) * c.a
  const ch = (v) => Math.round(v * s).toString(16).padStart(2, '0')
  return `#${ch(c.r)}${ch(c.g)}${ch(c.b)}`
}

/**
 * Composite `color` (with its own alpha) over the opaque `base` and return linear 0..1 RGB,
 * optionally scaling the layer's alpha by `k`. Used to bake a dot's alpha into its instance
 * colour: InstancedMesh carries one colour per instance but no per-instance alpha.
 * @returns {{ r: number, g: number, b: number }} sRGB 0..1
 */
export function over(color, base, k = 1) {
  const c = parseCss(color) || { r: 255, g: 255, b: 255, a: 1 }
  const b = parseCss(base) || { r: 0, g: 0, b: 0, a: 1 }
  const a = Math.max(0, Math.min(1, c.a * k))
  return {
    r: (b.r + (c.r - b.r) * a) / 255,
    g: (b.g + (c.g - b.g) * a) / 255,
    b: (b.b + (c.b - b.b) * a) / 255,
  }
}

/**
 * Read a CSS custom property off the document root, e.g. `cssVar('--clean', '#4fd8c8')`.
 * Returns the fallback on the server, before styles load, or when the variable is unset.
 */
export function cssVar(name, fallback) {
  if (typeof document === 'undefined' || !document.documentElement) return fallback
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name)
    const s = v && v.trim()
    return s || fallback
  } catch {
    return fallback
  }
}
