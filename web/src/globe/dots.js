// The land dot matrix: one InstancedMesh for every dot on the globe.
//
// This replaces three-globe's hexPolygon layer (`hexPolygonUseDots`), which drew one merged
// mesh per country with every dot the same radius and the same colour. Owning the field
// buys three things that layer cannot do:
//
//  - size by the cell's true area, so the pattern stays even instead of bunching towards the
//    poles, and so the finer US cells draw finer dots,
//  - brightness per dot (country, coastline, a small deterministic jitter), so the map has
//    texture rather than a uniform stipple,
//  - a `heat` tint: repaint instance colours from a handful of lat/lng values without
//    touching geometry.
//
// One draw call for ~15k dots, one shared 8-segment circle, all matrices written once.
import * as THREE from 'three'
import { over } from './color.js'
import { patchDotFalloff } from './surface.js'

const DOT_SEGMENTS = 8 // an 8-gon is indistinguishable from a circle at these radii
const FILL = 0.54 // dot radius as a fraction of its cell's radius: the gap between dots
const EDGE_FILL = 0.86 // coastal dots are smaller, so the outline reads as a crisp line
const JITTER_SIZE = 0.1 // +-10% radius, deterministic per dot
const JITTER_TONE = 0.12 // +-12% brightness
const EDGE_TONE = 1.5 // coastal dots are brighter than the interior they enclose
const INNER_TONE = 0.88
const HEAT_DEG = 9 // great-circle degrees at which a heat point's influence has faded out
const HEAT_MAX = 0.9 // strongest tint a dot can take

// A cheap deterministic hash in [0,1): the dot field must look the same on every load.
function hash(i) {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Build the dot mesh for a field from `loadDotField()`. Colours are not set here; call
 * `paintDotMesh` before adding it to the scene.
 * @param {{ count: number, lat: Float32Array, lng: Float32Array, radiusKm: Float32Array, cls: Uint8Array, edge: Uint8Array, earthKm: number }} field
 * @param {number} R globe radius in scene units
 * @param {number} altitude globe-radius fraction to lift the dots off the surface
 * @returns {THREE.InstancedMesh}
 */
export function buildDotMesh(field, R, altitude) {
  const n = field.count
  const geometry = new THREE.CircleGeometry(1, DOT_SEGMENTS)
  const material = patchDotFalloff(
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.FrontSide, toneMapped: false }),
  )
  const mesh = new THREE.InstancedMesh(geometry, material, n)
  mesh.frustumCulled = false // one mesh wrapping the whole globe: its bounds are always on screen
  mesh.raycast = () => {} // never a pointer target; the point layer owns hit testing

  const kmToUnits = R / field.earthKm
  const dirs = new Float32Array(n * 3)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const pos = new THREE.Vector3()
  const scale = new THREE.Vector3()
  const dir = new THREE.Vector3()
  const Z = new THREE.Vector3(0, 0, 1)
  const r = R * (1 + altitude)

  for (let i = 0; i < n; i++) {
    const phi = (90 - field.lat[i]) * (Math.PI / 180)
    const theta = (90 - field.lng[i]) * (Math.PI / 180) // three-globe's polar2Cartesian convention
    const sp = Math.sin(phi)
    dir.set(sp * Math.cos(theta), Math.cos(phi), sp * Math.sin(theta))
    dirs[i * 3] = dir.x
    dirs[i * 3 + 1] = dir.y
    dirs[i * 3 + 2] = dir.z
    pos.copy(dir).multiplyScalar(r)
    q.setFromUnitVectors(Z, dir) // lay the disc flat on the surface, facing outwards
    const s =
      field.radiusKm[i] * kmToUnits * FILL * (field.edge[i] ? EDGE_FILL : 1) * (1 + (hash(i) - 0.5) * 2 * JITTER_SIZE)
    scale.set(s, s, s)
    m.compose(pos, q, scale)
    mesh.setMatrixAt(i, m)
  }
  mesh.instanceMatrix.needsUpdate = true
  mesh.userData.dirs = dirs
  return mesh
}

/**
 * Write every instance colour: the country ramp, a brighter coastline, a small per-dot
 * brightness jitter, and — when `heat` is given — a tint towards `fossil` (value 0) or
 * `clean` (value 1) that falls off smoothly with distance from each heat point.
 *
 * Each dot's alpha is composited against the sphere colour here: an InstancedMesh carries one
 * RGB per instance and no alpha, and baking the composite keeps the dots exactly as opaque as
 * the old layer's rgba() colours looked.
 *
 * @param {THREE.InstancedMesh} mesh
 * @param {{ count, cls, edge, lat, lng }} field
 * @param {{ sphere: string, us: string, neighbors: string, other: string, clean: string, fossil: string }} palette
 * @param {Array<{ lat: number, lng: number, value: number }>} [heat]
 */
export function paintDotMesh(mesh, field, palette, heat) {
  const n = field.count
  const base = [
    over(palette.other, palette.sphere),
    over(palette.neighbors, palette.sphere),
    over(palette.us, palette.sphere),
  ]
  // Heat colours keep each class's own weight: a dim country stays dim when it is tinted.
  const alphaOf = [palette.other, palette.neighbors, palette.us]
  const clean = alphaOf.map((c) => over(palette.clean, palette.sphere, alphaScale(c)))
  const fossil = alphaOf.map((c) => over(palette.fossil, palette.sphere, alphaScale(c)))

  const dirs = mesh.userData.dirs
  const hot = prepareHeat(heat)
  const cosCut = Math.cos((HEAT_DEG * Math.PI) / 180)
  const col = new THREE.Color()

  for (let i = 0; i < n; i++) {
    const k = field.cls[i]
    const b = base[k]
    let tone = (field.edge[i] ? EDGE_TONE : INNER_TONE) * (1 + (hash(i + 7919) - 0.5) * 2 * JITTER_TONE)
    let r = b.r * tone
    let g = b.g * tone
    let bl = b.b * tone
    if (hot) {
      const x = dirs[i * 3]
      const y = dirs[i * 3 + 1]
      const z = dirs[i * 3 + 2]
      let w = 0
      let acc = 0
      for (let j = 0; j < hot.n; j++) {
        const c = x * hot.x[j] + y * hot.y[j] + z * hot.z[j]
        if (c <= cosCut) continue
        const t = (c - cosCut) / (1 - cosCut) // 0 at the cut-off, 1 at the point itself
        const f = t * t * (3 - 2 * t)
        w += f
        acc += f * hot.v[j]
      }
      if (w > 0) {
        const value = acc / w
        const mixAmt = Math.min(1, w) * HEAT_MAX
        const c0 = fossil[k]
        const c1 = clean[k]
        const hr = (c0.r + (c1.r - c0.r) * value) * tone
        const hg = (c0.g + (c1.g - c0.g) * value) * tone
        const hb = (c0.b + (c1.b - c0.b) * value) * tone
        r += (hr - r) * mixAmt
        g += (hg - g) * mixAmt
        bl += (hb - bl) * mixAmt
      }
    }
    col.setRGB(clamp01(r), clamp01(g), clamp01(bl), THREE.SRGBColorSpace)
    mesh.setColorAt(i, col)
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  return mesh
}

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

// The alpha carried by a class colour, so a heat tint inherits the same weight.
function alphaScale(color) {
  const m = /rgba?\([^)]*[\s,/]([\d.]+)\s*\)/i.exec(color || '')
  return m ? Math.min(1, parseFloat(m[1])) : 1
}

function prepareHeat(heat) {
  if (!Array.isArray(heat) || !heat.length) return null
  const n = heat.length
  const x = new Float32Array(n)
  const y = new Float32Array(n)
  const z = new Float32Array(n)
  const v = new Float32Array(n)
  let k = 0
  for (const h of heat) {
    if (!h || h.lat == null || h.lng == null) continue
    const phi = (90 - h.lat) * (Math.PI / 180)
    const theta = (90 - h.lng) * (Math.PI / 180)
    const sp = Math.sin(phi)
    x[k] = sp * Math.cos(theta)
    y[k] = Math.cos(phi)
    z[k] = sp * Math.sin(theta)
    v[k] = Math.max(0, Math.min(1, h.value ?? 0))
    k++
  }
  return k ? { n: k, x, y, z, v } : null
}

/** Free an InstancedMesh built here, including its geometry and material. */
export function disposeDotMesh(mesh) {
  if (!mesh) return
  if (mesh.parent) mesh.parent.remove(mesh)
  mesh.geometry.dispose()
  mesh.material.dispose()
  mesh.dispose()
}
