// Region boundaries drawn as great-circle circles on the sphere.
//
// The app knows where a region's load sits (one lat/lng per balancing authority or zone) but
// not what shape it is: there are no shapefiles here. A circle of a stated radius around the
// load centre is the honest approximation of "this is the territory, not a point", and it is
// the caller's job to label it as one. Each outline is a hairline circle plus a very low-alpha
// cap fill, both laid on the sphere surface rather than drawn as a flat disc through it.
import * as THREE from 'three'
import { toThreeColor } from './color.js'

const EARTH_KM = 6371
const SEGMENTS = 128 // at 1440px wide a 500 km circle is well under one pixel per segment
const FILL_ALT = 0.0022 // just over the land dots (0.002) and just under the points (0.003)
const LINE_ALT = 0.0026
const FILL_ALPHA = 0.06
const LINE_ALPHA = 0.5

// An orthonormal pair perpendicular to `dir`, so the circle can be swept around it.
function basis(dir, u, v) {
  const axis = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
  u.copy(axis).cross(dir).normalize()
  v.copy(dir).cross(u).normalize()
}

// three-globe's polar2Cartesian convention, matching dots.js and the point layer.
function direction(lat, lng, out) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (90 - lng) * (Math.PI / 180)
  const sp = Math.sin(phi)
  return out.set(sp * Math.cos(theta), Math.cos(phi), sp * Math.sin(theta))
}

/**
 * Build one Group holding every outline: a triangle-fan cap fill and a closed hairline per
 * entry. Nothing here is a pointer target.
 * @param {Array<{ id?: string|number, lat: number, lng: number, radiusKm?: number, color?: string }>} outlines
 * @param {number} R globe radius in scene units
 * @param {string} fallbackColor colour for entries that do not carry one
 * @returns {THREE.Group}
 */
export function buildOutlineGroup(outlines, R, fallbackColor = '#ffffff') {
  const group = new THREE.Group()
  group.raycast = () => {}
  const dir = new THREE.Vector3()
  const u = new THREE.Vector3()
  const v = new THREE.Vector3()
  const p = new THREE.Vector3()

  for (const o of outlines) {
    if (!o || o.lat == null || o.lng == null) continue
    const radiusKm = Math.max(1, o.radiusKm ?? 200)
    const ang = Math.min(Math.PI / 2, radiusKm / EARTH_KM) // angular radius on the sphere
    const cosA = Math.cos(ang)
    const sinA = Math.sin(ang)
    direction(o.lat, o.lng, dir)
    basis(dir, u, v)
    const { hex, alpha } = toThreeColor(o.color || fallbackColor)

    // Ring vertices, shared in shape by the fill and the line (two radii, so the hairline is
    // never z-fought by its own fill).
    const ring = new Float32Array((SEGMENTS + 1) * 3)
    const fill = new Float32Array((SEGMENTS + 2) * 3)
    const rFill = R * (1 + FILL_ALT)
    const rLine = R * (1 + LINE_ALT)
    p.copy(dir).multiplyScalar(rFill)
    fill[0] = p.x
    fill[1] = p.y
    fill[2] = p.z
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = (i / SEGMENTS) * Math.PI * 2
      const cx = dir.x * cosA + (u.x * Math.cos(t) + v.x * Math.sin(t)) * sinA
      const cy = dir.y * cosA + (u.y * Math.cos(t) + v.y * Math.sin(t)) * sinA
      const cz = dir.z * cosA + (u.z * Math.cos(t) + v.z * Math.sin(t)) * sinA
      ring[i * 3] = cx * rLine
      ring[i * 3 + 1] = cy * rLine
      ring[i * 3 + 2] = cz * rLine
      fill[(i + 1) * 3] = cx * rFill
      fill[(i + 1) * 3 + 1] = cy * rFill
      fill[(i + 1) * 3 + 2] = cz * rFill
    }
    const index = new Uint16Array(SEGMENTS * 3)
    for (let i = 0; i < SEGMENTS; i++) {
      index[i * 3] = 0
      index[i * 3 + 1] = i + 1
      index[i * 3 + 2] = i + 2
    }
    const fillGeo = new THREE.BufferGeometry()
    fillGeo.setAttribute('position', new THREE.BufferAttribute(fill, 3))
    fillGeo.setIndex(new THREE.BufferAttribute(index, 1))
    const fillMesh = new THREE.Mesh(
      fillGeo,
      new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity: FILL_ALPHA * alpha,
        depthWrite: false,
        side: THREE.FrontSide,
        toneMapped: false,
      }),
    )
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.BufferAttribute(ring, 3))
    const line = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({
        color: hex,
        transparent: true,
        opacity: LINE_ALPHA * alpha,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    fillMesh.raycast = () => {}
    line.raycast = () => {}
    fillMesh.userData.id = o.id
    line.userData.id = o.id
    fillMesh.userData.baseOpacity = FILL_ALPHA * alpha
    line.userData.baseOpacity = LINE_ALPHA * alpha
    group.add(fillMesh, line)
  }
  return group
}

/** Fade every outline in a group by `k` (1 = as built). */
export function setOutlineDim(group, k) {
  if (!group) return
  group.children.forEach((o) => {
    if (o.material && o.userData.baseOpacity != null) o.material.opacity = o.userData.baseOpacity * k
  })
}

/** Free a group built here, including every geometry and material in it. */
export function disposeOutlineGroup(group) {
  if (!group) return
  if (group.parent) group.parent.remove(group)
  group.children.forEach((o) => {
    if (o.geometry) o.geometry.dispose()
    if (o.material) o.material.dispose()
  })
  group.clear()
}
