// Camera moves with intent: an eased point-of-view tween and an eased auto-rotate ramp.
//
// react-globe.gl's own `pointOfView(v, ms)` tweens with a quadratic ease-out, which starts at
// full speed and reads like a snap. These helpers drive `pointOfView(v, 0)` per frame instead,
// so the move can ease in and out, take the short way round the antimeridian, and interpolate
// altitude geometrically (a zoom feels linear in log space, not in radius).

export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

const shortLng = (from, to) => {
  let d = to - from
  while (d > 180) d -= 360
  while (d < -180) d += 360
  return d
}

/**
 * Ease the camera from wherever it is to `to` over `ms`.
 * @param {object} globe react-globe.gl instance
 * @param {{ lat: number, lng: number, altitude: number }} to
 * @param {number} ms
 * @param {{ ease?: (t: number) => number, from?: object, onDone?: () => void }} [opts]
 * @returns {() => void} cancel; calling it stops the tween where it is
 */
export function tweenPov(globe, to, ms, opts = {}) {
  const ease = opts.ease || easeInOutCubic
  const from = opts.from || globe.pointOfView()
  if (!ms || ms <= 0) {
    globe.pointOfView(to, 0)
    if (opts.onDone) opts.onDone()
    return () => {}
  }
  const dLng = shortLng(from.lng, to.lng)
  const a0 = Math.max(0.01, from.altitude)
  const a1 = Math.max(0.01, to.altitude)
  const logA = Math.log(a1 / a0)
  let raf = 0
  let start = 0
  let live = true
  const step = (now) => {
    if (!live) return
    if (!start) start = now
    const t = Math.min(1, (now - start) / ms)
    const e = ease(t)
    globe.pointOfView(
      { lat: from.lat + (to.lat - from.lat) * e, lng: from.lng + dLng * e, altitude: a0 * Math.exp(logA * e) },
      0,
    )
    if (t < 1) raf = requestAnimationFrame(step)
    else if (opts.onDone) opts.onDone()
  }
  raf = requestAnimationFrame(step)
  return () => {
    live = false
    cancelAnimationFrame(raf)
  }
}

/**
 * Ramp OrbitControls' auto-rotate from a standstill to `degPerSec` over `ms`, so the landing
 * globe drifts into motion instead of snapping into it. Passing 0 ramps back down and stops.
 * @param {object} controls OrbitControls
 * @param {number} degPerSec target speed, 0 to stop
 * @param {number} [ms=600]
 * @returns {() => void} cancel
 */
export function rampAutoRotate(controls, degPerSec, ms = 600) {
  if (!controls) return () => {}
  // OrbitControls: autoRotateSpeed 2.0 is one orbit per 30 s at 60 fps, i.e. 12 deg/s.
  const target = (degPerSec || 0) / 6
  const from = controls.autoRotate ? controls.autoRotateSpeed : 0
  if (!target && !from) {
    controls.autoRotate = false
    return () => {}
  }
  controls.autoRotate = true
  controls.autoRotateSpeed = from
  let raf = 0
  let start = 0
  let live = true
  const step = (now) => {
    if (!live) return
    if (!start) start = now
    const t = Math.min(1, (now - start) / ms)
    controls.autoRotateSpeed = from + (target - from) * easeOutCubic(t)
    if (t < 1) raf = requestAnimationFrame(step)
    else if (!target) controls.autoRotate = false
  }
  raf = requestAnimationFrame(step)
  return () => {
    live = false
    cancelAnimationFrame(raf)
  }
}
