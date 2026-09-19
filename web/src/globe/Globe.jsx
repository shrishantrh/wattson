import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import GlobeGL from 'react-globe.gl'
import * as THREE from 'three'
import { tweenPov, rampAutoRotate, easeOutCubic } from './camera.js'
import { cssVar, dimHex, toThreeColor, withAlpha } from './color.js'
import { loadDayNightTextures, makeDayNightMaterial, makeNightMaterial, setDayNightUniforms } from './dayNight.js'
import { buildDotMesh, disposeDotMesh, paintDotMesh } from './dots.js'
import { loadDotField, loadStateMesh } from './land.js'
import { subsolarPoint } from './sun.js'
import { makeSphereMaterial, setSphereColor } from './surface.js'
import '../styles/globe.css'

const DEG = Math.PI / 180
const EMPTY = []
const NOOP = () => {}
const DEFAULT_VIEW = { lat: 38, lng: -97, altitude: 1.6 }
const DEFAULT_TERMINATOR = { enabled: true, dayDim: 0.35 }
const DEFAULT_ATMOSPHERE = { color: '#ffffff', altitude: 0.12, opacity: 1 } // night style
const DEFAULT_ATMOSPHERE_DOTS = { color: '#ffffff', altitude: 0.08, opacity: 0.35 } // dots style: faint rim
// Dots style palette. Land is one grey at three alphas so the US reads first, its neighbours
// second and the rest of the world as context; state borders sit between the US and neighbours.
// `clean` and `fossil` are only used by the `heat` prop and default to the page's own tokens.
const DEFAULT_LAND = {
  sphere: '#141817', // a step above the page background (#0a0c0b) so the disc reads where there is no land
  us: 'rgba(233,236,233,0.62)',
  neighbors: 'rgba(233,236,233,0.30)',
  other: 'rgba(233,236,233,0.14)',
  states: 'rgba(233,236,233,0.22)',
}
const LAND_ALT = 0.002 // dot matrix, globe-radius units above the surface
const STATES_ALT = 0.003 // state border lines, above the dots
const DEFAULT_DOT = 'rgba(255,255,255,0.85)'
const DEFAULT_RING = '#ffffff'
const DEFAULT_LABEL = 'rgba(255,255,255,0.7)'
const POV_MS = 1000 // eased camera move on a `view` change
const FOCUS_MS = 1100 // ... and on a `focus` change, which is a deliberate "look here"
const INTRO_MS = 1400
const INTRO_PULL = 1.45 // the intro starts this much further out than the target altitude
const POINT_ALT = 0.003 // globe-radius units above the surface, enough to clear the depth buffer
const QUALITY = {
  high: { dpr: 2, antialias: true },
  auto: { dpr: 1.5, antialias: true },
  low: { dpr: 1, antialias: false },
}
// Pin stems: short when the camera is close (pins are far apart on screen) and long when it
// pulls back and the pins crowd together. Every other pin gets the longer stem so neighbouring
// labels sit at two heights instead of overlapping.
const STEM_MIN = 14
const STEM_MAX = 44
const STEM_STAGGER = 13
const STEM_FROM = 6 // start staggering once there are this many pins

// ---------- scene lights ----------

// globe.gl's defaults (ambient 0xcccccc plus a directional light from above) shade any Lambert
// surface, so a lit dot matrix would brighten at the top of the globe. Everything in the dots
// style is unlit (MeshBasicMaterial and our own shaders), so one ambient light is enough; the
// sphere's own falloff supplies the depth instead of a light.
function makeDotsLights() {
  return [new THREE.AmbientLight(0xffffff, Math.PI)]
}
function makeDefaultLights() {
  return [new THREE.AmbientLight(0xcccccc, Math.PI), new THREE.DirectionalLight(0xffffff, 0.6 * Math.PI)]
}

// ---------- data identity: keep datum objects stable so react-globe.gl's data joins are no-ops ----------

function shallowEqual(a, b) {
  if (a === b) return true
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  for (const k of ka) if (!Object.is(a[k], b[k])) return false
  return true
}

// Reuse the previous datum object for every id whose fields are unchanged, and return the
// previous array itself when nothing changed, so react-globe.gl's identity-based data joins
// only touch what moved.
function mergeStable(prev, items) {
  const list = Array.isArray(items) ? items : EMPTY
  const byId = new Map()
  prev.forEach((o, i) => byId.set(o.id ?? i, o))
  const out = []
  list.forEach((it, i) => {
    if (!it) return
    const old = byId.get(it.id ?? i)
    out.push(old && shallowEqual(old, it) ? old : it)
  })
  const same = out.length === prev.length && out.every((o, i) => o === prev[i])
  return same ? prev : out
}

// React's "storing information from previous renders" pattern: when the incoming array is a
// new reference, merge against the last output during render and re-render once with it.
function useStableList(items) {
  const [snap, setSnap] = useState({ items: EMPTY, out: EMPTY })
  if (snap.items !== items) {
    const out = mergeStable(snap.out, items)
    setSnap({ items, out })
    return out
  }
  return snap.out
}

// ---------- point objects (custom layer): filled disc or thin ring, unlit so colours are exact ----------

// Same convention as three-globe's polar2Cartesian, so this matches getCoords().
function polarToCartesian(lat, lng, R, alt) {
  const phi = (90 - lat) * DEG
  const theta = (90 - lng) * DEG
  const r = R * (1 + alt)
  return new THREE.Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta))
}

function pointSignature(d) {
  return `${d.hollow ? 'h' : 'f'}|${d.r ?? 0.25}|${d.color || DEFAULT_DOT}`
}

function buildPointLook(d, R) {
  const pxPerDeg = (2 * Math.PI * R) / 360 // three-globe's own degree-to-unit factor
  const r = Math.max(0.02, d.r ?? 0.25) * pxPerDeg
  const geometry = d.hollow ? new THREE.RingGeometry(r * 0.62, r, 32) : new THREE.CircleGeometry(r, 24)
  const { hex, alpha } = toThreeColor(d.color || DEFAULT_DOT)
  const material = new THREE.MeshBasicMaterial({
    color: hex,
    side: THREE.DoubleSide,
    transparent: alpha < 1,
    opacity: alpha,
    depthWrite: alpha >= 1,
  })
  return { geometry, material }
}

function makePointObject(d, R) {
  const { geometry, material } = buildPointLook(d, R)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.userData.sig = pointSignature(d)
  return mesh
}

function updatePointObject(obj, d, R) {
  const sig = pointSignature(d)
  if (obj.userData.sig !== sig) {
    obj.geometry.dispose()
    obj.material.dispose()
    const look = buildPointLook(d, R)
    obj.geometry = look.geometry
    obj.material = look.material
    obj.userData.sig = sig
  }
  obj.position.copy(polarToCartesian(d.lat, d.lng, R, POINT_ALT))
  // Lay the disc flat on the surface: face the globe centre (DoubleSide keeps it visible).
  const centre = obj.parent ? obj.parent.localToWorld(new THREE.Vector3()) : new THREE.Vector3()
  obj.lookAt(centre)
}

// ---------- accessors (module level so react-kapsule sees the same reference every render) ----------

const ringColorAccessor = (d) => {
  const c = d.color || DEFAULT_RING
  return (t) => withAlpha(c, 1 - t) // fade out as the ring propagates
}
const ringMaxRadius = (d) => d.maxR ?? 3
const ringSpeed = (d) => d.speed ?? 1
const ringPeriod = (d) => d.period ?? 1200
const labelText = (d) => d.text ?? ''
const labelSize = (d) => d.size ?? 0.6
const labelColor = (d) => d.color || DEFAULT_LABEL
const labelIncludeDot = (d) => d.dot !== false
const labelDotRadius = (d) => d.dotR ?? 0.12
// Only the point objects respond to the pointer. Without this, a label's invisible hit-box
// (three-globe raycasts labels via a bounding box at labelAltitude) sits above a dot at the
// same location and swallows its hover and click.
const pointerEventsFilter = (obj) => obj.__globeObjType === 'custom'

// ---------- HTML pin markers ----------

// A square tile on a stem with a label beside it (the reference boards' status pins). Datum:
// { id, lat, lng, label, tip, rank, color, hollow, muted, lead, side, href }. `.gpin*` is styled
// in base.css; the stem length and the rank numeral are ours and live in styles/globe.css.
function makeMarkerElement(d) {
  const el = document.createElement(d.href ? 'a' : 'div')
  if (d.href) el.href = d.href
  el.className =
    'gpin gpin-dyn' +
    (d.hollow ? ' hollow' : '') +
    (d.muted ? ' muted' : '') +
    (d.lead ? ' lead' : '') +
    (d.side === 'left' ? ' left' : '') +
    (d.rank != null ? ' has-rank' : '')
  if (d.color) el.style.setProperty('--pin', d.color)
  el.innerHTML =
    '<span class="gpin-tile">' +
    (d.rank != null ? '<i class="gpin-rank"></i>' : '') +
    '</span><span class="gpin-stem"></span>' +
    (d.label ? '<span class="gpin-label"></span>' : '')
  if (d.rank != null) el.querySelector('.gpin-rank').textContent = String(d.rank)
  if (d.label) el.querySelector('.gpin-label').textContent = d.label
  if (d.label && d.tip) el.querySelector('.gpin-label').setAttribute('data-tip', d.tip)
  el.style.pointerEvents = d.href ? 'auto' : 'none'
  return el
}
function markerVisibility(el, isVisible) {
  el.style.opacity = isVisible ? '1' : '0'
}

/**
 * 3D Earth turned to the US with land drawn as a dot matrix, small points, propagating pulse
 * rings, text labels and HTML pin markers. Fills its parent element. Dark theme only. Two
 * surface styles:
 *
 * - `'dots'` (default): a dark sphere with a view-dependent falloff (the limb darkens below the
 *   page background, the centre lifts, a thin white rim marks the horizon) and land drawn as an
 *   instanced dot field: one dot per H3 cell, resolution 4 over the US and 3 elsewhere, each dot
 *   sized by its cell's true area, brighter on coastlines and borders, dimmer inland, with a
 *   small deterministic per-dot jitter so the pattern has texture. Thin US state border lines
 *   sit on top. The TopoJSON (about 220 KB raw) is loaded lazily and the field is built once per
 *   page, chunked across frames.
 * - `'night'`: the NASA night-lights texture with the day/night terminator shader.
 *
 * Props:
 * @param {object} props
 * @param {'dots'|'night'} [props.style='dots'] surface style; switching at runtime disposes the previous sphere material and textures
 * @param {{ sphere?: string, us?: string, neighbors?: string, other?: string, states?: string, clean?: string, fossil?: string }} [props.landColors] dots style colours: `sphere` '#141817', `us` 'rgba(233,236,233,0.62)', `neighbors` (Canada, Mexico) 'rgba(233,236,233,0.30)', `other` 'rgba(233,236,233,0.14)', `states` (border lines) 'rgba(233,236,233,0.22)'; `clean`/`fossil` are the two ends of the `heat` ramp and default to the `--clean` and `--fossil` tokens; ignored in night style
 * @param {{ lat: number, lng: number, altitude: number }} [props.view] camera target; a change eases pointOfView over 1000 ms (cubic in-out; first application is instant unless `intro` is set)
 * @param {{ lat: number, lng: number, altitude?: number }} [props.focus] "look here": overrides `view` while set and eases over 1100 ms; clearing it hands control back to `view`
 * @param {boolean|{ ms?: number, pull?: number }} [props.intro=false] on first mount only, start `pull` (1.45) times further out and settle to the target over `ms` (1400)
 * @param {Array<{ lat: number, lng: number, value: number }>} [props.heat] dots style: tints land dots near each point towards `fossil` (value 0) or `clean` (value 1), fading out over about 9 degrees of great-circle distance. Off by default; repaints instance colours only, no new geometry
 * @param {Array<{ id: string|number, lat: number, lng: number, r?: number, color?: string, hollow?: boolean }>} [props.points] dots; `r` in angular degrees (react-globe.gl's pointRadius unit, default 0.25); `hollow` renders a thin ring outline
 * @param {Array<{ id: string|number, lat: number, lng: number, color?: string, maxR?: number, speed?: number, period?: number }>} [props.rings] pulse rings; `maxR` degrees (3), `speed` degrees/second (1), `period` ms between rings (1200), react-globe.gl units
 * @param {Array<{ id: string|number, lat: number, lng: number, text: string, size?: number, color?: string, dot?: boolean, dotR?: number }>} [props.labels] text labels; `size` degrees (0.6); `dot: false` hides the marker dot
 * @param {{ enabled?: boolean, sunLng?: number, sunLat?: number, dayDim?: number }} [props.terminator] night style only: day/night shader; sunLng/sunLat default to the real subsolar point; dayDim 0.35; `enabled: false` shows the plain night texture. A no-op in dots style (there is no texture to shade)
 * @param {boolean} [props.interactive=true] orbit controls on/off (off also disables zoom and pan)
 * @param {number} [props.autoRotate=0] degrees per second, 0 = off; the speed eases in over 600 ms and any pointer press or wheel on the canvas stops it for good
 * @param {{ color?: string, altitude?: number, opacity?: number }|null} [props.atmosphere] rim glow; null hides it. Default depends on style: night `{ color: '#ffffff', altitude: 0.12, opacity: 1 }`, dots `{ color: '#ffffff', altitude: 0.08, opacity: 0.35 }`. `opacity` scales the glow's brightness (three-globe's glow has no alpha; the colour is darkened instead, which reads the same over a dark page)
 * @param {string} [props.background='rgba(0,0,0,0)'] renderer clear colour; transparent by default so the page background shows
 * @param {'auto'|'high'|'low'} [props.quality='auto'] auto: pixel ratio capped at 1.5, antialias on; low: 1, antialias off; high: 2, antialias on
 * @param {() => void} [props.onReady] called once the globe is initialised and the first view is applied
 * @param {(point: object, event: MouseEvent, coords: { lat: number, lng: number, altitude: number }) => void} [props.onPointClick]
 * @param {(point: object|null) => void} [props.onPointHover]
 * @param {Array<{ id: string|number, lat: number, lng: number, label?: string, tip?: string, rank?: number|string, color?: string, hollow?: boolean, muted?: boolean, lead?: boolean, href?: string }>} [props.markers] HTML pin markers (tile + stem + label) anchored to the surface; `rank` draws a small numeral in the dot
 */
export default function Globe({
  style = 'dots',
  landColors,
  view = DEFAULT_VIEW,
  focus,
  intro = false,
  heat,
  points = EMPTY,
  rings = EMPTY,
  labels = EMPTY,
  terminator = DEFAULT_TERMINATOR,
  interactive = true,
  autoRotate = 0,
  atmosphere,
  background = 'rgba(0,0,0,0)',
  quality = 'auto',
  onReady,
  onPointClick,
  onPointHover,
  markers = EMPTY,
}) {
  const wrapRef = useRef(null)
  const globeRef = useRef(null)
  const matRef = useRef(null)
  const viewRef = useRef(view)
  const appliedViewRef = useRef(null)
  const onReadyRef = useRef(onReady)
  const onClickRef = useRef(onPointClick)
  const onHoverRef = useRef(onPointHover)
  const lightsOverriddenRef = useRef(false)
  const povTweenRef = useRef(null)
  const rotTweenRef = useRef(null)
  const takenOverRef = useRef(false) // the pointer touched the globe: stop auto-rotating
  const introRef = useRef(intro) // `intro` applies on first mount only, so it never re-runs
  const dotMeshRef = useRef(null)
  const pinsRef = useRef([])
  const stemAltRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [mat, setMat] = useState(null)
  const [land, setLand] = useState(null) // dots style: { field, states } once the TopoJSON is in
  const [readyTick, setReadyTick] = useState(0)
  const [dotTick, setDotTick] = useState(0) // bumped when the dot mesh is (re)attached
  // Stabilised so an inline `heat={[...]}` does not repaint 15k instance colours every render.
  const stableHeat = useStableList(heat)

  const q = QUALITY[quality] || QUALITY.auto
  const isDots = style !== 'night'
  const lc = landColors || DEFAULT_LAND
  const sphereColor = lc.sphere || DEFAULT_LAND.sphere
  const usColor = lc.us || DEFAULT_LAND.us
  const neighborColor = lc.neighbors || DEFAULT_LAND.neighbors
  const otherColor = lc.other || DEFAULT_LAND.other
  const statesColor = lc.states || DEFAULT_LAND.states
  const cleanColor = lc.clean
  const fossilColor = lc.fossil
  // The terminator only exists in night style; in dots style there is no texture to shade.
  const terminatorEnabled = !isDots && (terminator ? terminator.enabled !== false : false)
  const sunLat = terminator ? terminator.sunLat : undefined
  const sunLng = terminator ? terminator.sunLng : undefined
  const dayDim = terminator && terminator.dayDim != null ? terminator.dayDim : DEFAULT_TERMINATOR.dayDim
  const viewLat = view ? view.lat : DEFAULT_VIEW.lat
  const viewLng = view ? view.lng : DEFAULT_VIEW.lng
  const viewAlt = view ? view.altitude : DEFAULT_VIEW.altitude
  // `focus` wins while it is set; clearing it falls back to `view`.
  const target = focus
    ? { lat: focus.lat, lng: focus.lng, altitude: focus.altitude != null ? focus.altitude : viewAlt, ms: FOCUS_MS }
    : { lat: viewLat, lng: viewLng, altitude: viewAlt, ms: POV_MS }

  useLayoutEffect(() => {
    viewRef.current = { lat: target.lat, lng: target.lng, altitude: target.altitude }
    onReadyRef.current = onReady
    onClickRef.current = onPointClick
    onHoverRef.current = onPointHover
  })

  // 1. Size: measure the parent, fall back to a square when the parent has no height yet.
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined
    const target2 = el.parentElement || el
    const measure = () => {
      const rect = target2.getBoundingClientRect()
      const w = Math.round(rect.width)
      const h = Math.round(rect.height) || w
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(target2)
    return () => ro.disconnect()
  }, [])

  // 2. Globe material. The globe is not mounted until this resolves, so there is never a
  //    frame with globe.gl's default (white, lit) sphere. Night style loads the textures;
  //    dots style gets the depth shader, resolved through the same path so both styles are
  //    handled by one subscription. The dots material is created in the default colour and
  //    recoloured in place by the layout effect below, so a colour change never rebuilds it.
  useEffect(() => {
    let alive = true
    const load = isDots
      ? Promise.resolve({ material: makeSphereMaterial(toThreeColor(DEFAULT_LAND.sphere).hex), textures: [], kind: 'dots' })
      : loadDayNightTextures(terminatorEnabled).then(({ day, night }) => {
          let material
          if (terminatorEnabled) {
            const sun = subsolarPoint()
            const g = globeRef.current
            const pov = (g && g.pointOfView && g.pointOfView()) || viewRef.current
            material = makeDayNightMaterial({
              dayTexture: day,
              nightTexture: night,
              sunLat: sun.lat,
              sunLng: sun.lng,
              dayDim: DEFAULT_TERMINATOR.dayDim,
              globeLat: pov.lat,
              globeLng: pov.lng,
            })
          } else {
            material = makeNightMaterial(night)
          }
          return { material, textures: day ? [day, night] : [night], kind: 'night' }
        })
    load
      .then((next) => {
        if (!alive) {
          // Style changed while loading: nothing rendered this, so free it here.
          next.material.dispose()
          next.textures.forEach((t) => t.dispose())
          return
        }
        setMat(next)
      })
      .catch((err) => {
        console.warn('[Globe] texture load failed, using a plain dark sphere', err)
        if (alive) setMat({ material: new THREE.MeshBasicMaterial({ color: 0x0b0d12 }), textures: [], kind: 'night' })
      })
    return () => {
      alive = false
    }
  }, [isDots, terminatorEnabled])

  // Dispose the previous material and its textures when replaced, and on unmount.
  useEffect(() => {
    matRef.current = mat ? mat.material : null
    return () => {
      if (!mat) return
      mat.material.dispose()
      mat.textures.forEach((t) => t.dispose())
    }
  }, [mat])

  // Dots style: recolour the sphere in place rather than rebuilding the material. Layout
  // effect so the colour is set before the frame in which the new material first paints.
  useLayoutEffect(() => {
    if (mat && mat.kind === 'dots') setSphereColor(mat.material, toThreeColor(sphereColor).hex)
  }, [mat, sphereColor])

  // 3. Dots style: the land. The dot field (H3 cells over every country) and the state border
  //    lines are both built once per page and cached in land.js; the field build is chunked
  //    across frames so it never lands as one long task. The state lines are copied per mount
  //    because three-globe's data join writes its bookkeeping onto the datum objects.
  useEffect(() => {
    if (!isDots) return undefined
    let alive = true
    Promise.all([loadDotField(), loadStateMesh()])
      .then(([field, states]) => {
        if (!alive) return
        setLand({ field, states: states.map((s) => ({ ...s })) })
      })
      .catch((err) => {
        console.warn('[Globe] land data failed to load, rendering a bare sphere', err)
        if (alive) setLand({ field: null, states: EMPTY })
      })
    return () => {
      alive = false
    }
  }, [isDots])

  // 4. Sun position and day dimming: layout effect so a caller animating sunLng per frame sees
  //    the uniform change before that frame paints.
  useLayoutEffect(() => {
    if (!mat) return
    let lat = sunLat
    let lng = sunLng
    if (lat == null || lng == null) {
      const s = subsolarPoint()
      if (lat == null) lat = s.lat
      if (lng == null) lng = s.lng
    }
    setDayNightUniforms(mat.material, { sunLat: lat, sunLng: lng, dayDim })
  }, [mat, sunLat, sunLng, dayDim])

  // 5. Globe ready: apply the first view (instantly, or as the intro pull-in) and seed the
  //    shader's camera rotation.
  const handleReady = useCallback(() => {
    let tries = 0
    const apply = () => {
      const g = globeRef.current
      if (!g) {
        if (tries++ < 60) requestAnimationFrame(apply)
        return
      }
      const v = viewRef.current
      const intro2 = introRef.current
      if (intro2) {
        const pull = (intro2 !== true && intro2.pull) || INTRO_PULL
        const ms = (intro2 !== true && intro2.ms) || INTRO_MS
        g.pointOfView({ ...v, altitude: v.altitude * pull }, 0)
        povTweenRef.current = tweenPov(g, v, ms, { ease: easeOutCubic })
      } else {
        g.pointOfView(v, 0)
      }
      appliedViewRef.current = v
        setDayNightUniforms(matRef.current, { globeLat: v.lat, globeLng: v.lng })
      setReadyTick((t) => t + 1)
    }
    apply()
  }, [])

  useEffect(() => {
    if (readyTick > 0 && onReadyRef.current) onReadyRef.current()
  }, [readyTick])

  // 6. View and focus changes ease the camera (cubic in-out, altitude interpolated in log
  //    space). Any in-flight tween is cancelled first, so a fast sequence of targets does not
  //    fight itself.
  useEffect(() => {
    const g = globeRef.current
    if (!readyTick || !g) return undefined
    const v = { lat: target.lat, lng: target.lng, altitude: target.altitude }
    const a = appliedViewRef.current
    if (a && a.lat === v.lat && a.lng === v.lng && a.altitude === v.altitude) return undefined
    appliedViewRef.current = v
    if (povTweenRef.current) povTweenRef.current()
    povTweenRef.current = tweenPov(g, v, target.ms)
    return undefined
  }, [readyTick, target.lat, target.lng, target.altitude, target.ms])

  useEffect(
    () => () => {
      if (povTweenRef.current) povTweenRef.current()
      if (rotTweenRef.current) rotTweenRef.current()
    },
    [],
  )

  // 7. Orbit controls, auto-rotate ramp, and "the pointer takes over".
  useEffect(() => {
    const g = globeRef.current
    if (!readyTick || !g) return undefined
    const c = g.controls()
    if (!c) return undefined
    const on = !!interactive
    // `enabled` stays true even when the globe is not interactive: three 0.186's OrbitControls
    // returns from update() when it is false, which also stops auto-rotate and, on a fresh
    // mount, leaves the camera unrotated (it never looks at the globe). Interaction is turned
    // off per gesture instead.
    c.enabled = true
    c.enableRotate = on
    c.enableZoom = on
    c.enablePan = false
    if (rotTweenRef.current) rotTweenRef.current()
    rotTweenRef.current = rampAutoRotate(c, takenOverRef.current ? 0 : autoRotate)

    const canvas = g.renderer && g.renderer() && g.renderer().domElement
    if (!canvas || !autoRotate) return undefined
    const stop = () => {
      takenOverRef.current = true
      if (rotTweenRef.current) rotTweenRef.current()
      c.autoRotate = false
      if (povTweenRef.current) povTweenRef.current() // the user is driving now
    }
    canvas.addEventListener('pointerdown', stop, { passive: true })
    canvas.addEventListener('wheel', stop, { passive: true })
    return () => {
      canvas.removeEventListener('pointerdown', stop)
      canvas.removeEventListener('wheel', stop)
    }
  }, [readyTick, interactive, autoRotate])

  // 8. Lights: flat ambient in dots style so nothing is shaded by light position; the night
  //    style keeps globe.gl's defaults (restored only if we had overridden them).
  useEffect(() => {
    const g = globeRef.current
    if (!readyTick || !g || !g.lights) return
    if (isDots) {
      g.lights(makeDotsLights())
      lightsOverriddenRef.current = true
    } else if (lightsOverriddenRef.current) {
      g.lights(makeDefaultLights())
      lightsOverriddenRef.current = false
    }
  }, [readyTick, isDots])

  // 9. The dot field: one InstancedMesh added straight to the ThreeGlobe group (the same frame
  //    of reference three-globe's own layers use), rebuilt only when the field itself changes.
  //    The group is not in the scene on the frame the globe reports ready, so the attach retries
  //    on a timer (a timer, not a frame: a globe mounted in a background tab gets no frames).
  useEffect(() => {
    const g = globeRef.current
    if (!readyTick || !g || !isDots || !land || !land.field) return undefined
    let mesh = null
    let timer = 0
    let tries = 0
    const attach = () => {
      const scene = g.scene && g.scene()
      const globeObj = scene && scene.children.find((o) => typeof o.getGlobeRadius === 'function')
      if (!globeObj) {
        if (tries++ < 120) timer = setTimeout(attach, 16)
        return
      }
      mesh = buildDotMesh(land.field, g.getGlobeRadius(), LAND_ALT)
      globeObj.add(mesh)
      dotMeshRef.current = mesh
      setDotTick((t) => t + 1) // the colours are written by the effect below
    }
    attach()
    return () => {
      clearTimeout(timer)
      tries = Infinity
      dotMeshRef.current = null
      disposeDotMesh(mesh)
    }
  }, [readyTick, isDots, land])

  // 9b. Colours: write every instance colour on attach, and repaint in place on a palette or
  //     `heat` change. No geometry is touched, so a page can recolour the whole map by grid
  //     cleanliness for the price of one pass over the instance colour buffer.
  useEffect(() => {
    const mesh = dotMeshRef.current
    if (!mesh || !land || !land.field) return
    paintDotMesh(
      mesh,
      land.field,
      {
        sphere: sphereColor,
        us: usColor,
        neighbors: neighborColor,
        other: otherColor,
        clean: cleanColor || cssVar('--clean', '#5fd3c2'),
        fossil: fossilColor || cssVar('--fossil', cssVar('--accent', '#ff7a4a')),
      },
      stableHeat.length ? stableHeat : null,
    )
  }, [land, dotTick, stableHeat, sphereColor, usColor, neighborColor, otherColor, cleanColor, fossilColor])

  // 10. Take the state border lines out of the pointer raycast. globe.gl raycasts every scene
  //     object and applies pointerEventsFilter afterwards, so without this each hover would
  //     test the ray against 11k border segments. (The dot mesh opts out in dots.js.)
  //     three-globe's data join builds the objects on a 1 ms debounce; a short timer runs after
  //     that. Purely a performance measure: if it ever misses, hover still works, just slower.
  useEffect(() => {
    const g = globeRef.current
    if (!readyTick || !g || !isDots || !land) return undefined
    const t = setTimeout(() => {
      const scene = g.scene && g.scene()
      if (!scene) return
      scene.traverse((o) => {
        if (o.__globeObjType === 'path') o.traverse((c) => { c.raycast = NOOP })
      })
    }, 60)
    return () => clearTimeout(t)
  }, [readyTick, isDots, land])

  // 11. Pixel ratio cap (three-render-objects sets min(2, dpr) at init; re-cap after any resize).
  useEffect(() => {
    const g = globeRef.current
    if (!readyTick || !g) return
    const r = g.renderer()
    if (!r) return
    const dpr = Math.min(window.devicePixelRatio || 1, q.dpr)
    if (r.getPixelRatio() !== dpr) r.setPixelRatio(dpr)
  }, [readyTick, q.dpr, size.w, size.h])

  // 12. Pin stems follow the camera: long when the globe is far away and the pins crowd
  //     together, short when it is close. Every other pin is raised further so two neighbouring
  //     labels do not sit on the same line.
  const layoutPins = useCallback((altitude) => {
    const list = pinsRef.current.filter((el) => el.isConnected)
    pinsRef.current = list
    if (!list.length) return
    const base = Math.max(STEM_MIN, Math.min(STEM_MAX, 12 + 12 * (altitude ?? 1.6)))
    const stagger = list.length >= STEM_FROM
    list.forEach((el, i) => {
      const h = Math.round(base + (stagger && i % 2 ? STEM_STAGGER : 0))
      el.style.setProperty('--gstem', `${h}px`)
    })
  }, [])

  const makeMarker = useCallback(
    (d) => {
      const el = makeMarkerElement(d)
      pinsRef.current.push(el)
      const g = globeRef.current
      const alt = stemAltRef.current ?? (g && g.pointOfView ? g.pointOfView().altitude : null)
      el.style.setProperty('--gstem', `${Math.round(Math.max(STEM_MIN, Math.min(STEM_MAX, 12 + 12 * (alt ?? 1.6))))}px`)
      // The new pin joins its neighbours on the next frame, once the whole set is in the DOM.
      requestAnimationFrame(() => layoutPins(stemAltRef.current))
      return el
    },
    [layoutPins],
  )

  // 13. Camera moves feed the shader (the example's onZoom -> globeRotation wiring) and the pins.
  const handleZoom = useCallback(
    (pov) => {
      setDayNightUniforms(matRef.current, { globeLat: pov.lat, globeLng: pov.lng })
      const prev = stemAltRef.current
      if (prev == null || Math.abs(prev - pov.altitude) > 0.02) {
        stemAltRef.current = pov.altitude
        layoutPins(pov.altitude)
      }
    },
    [layoutPins],
  )

  const handleHover = useCallback((d) => {
    if (onHoverRef.current) onHoverRef.current(d || null)
  }, [])
  const handleClick = useCallback((d, event, coords) => {
    if (onClickRef.current) onClickRef.current(d, event, coords)
  }, [])

  const stablePoints = useStableList(points)
  const stableRings = useStableList(rings)
  const stableLabels = useStableList(labels)
  const stableMarkers = useStableList(markers)
  const rendererConfig = useMemo(
    () => ({ antialias: q.antialias, alpha: true, powerPreference: 'high-performance' }),
    [q.antialias],
  )

  const pathColor = useCallback(() => statesColor, [statesColor])
  const stateLines = isDots && land ? land.states : EMPTY

  // Atmosphere: the default depends on the style; an explicit prop (or null) wins.
  const atmo = atmosphere === undefined ? (isDots ? DEFAULT_ATMOSPHERE_DOTS : DEFAULT_ATMOSPHERE) : atmosphere
  const atmoDefaults = isDots ? DEFAULT_ATMOSPHERE_DOTS : DEFAULT_ATMOSPHERE
  const atmoColor = dimHex((atmo && atmo.color) || atmoDefaults.color, atmo && atmo.opacity != null ? atmo.opacity : atmoDefaults.opacity)
  const atmoAltitude = atmo && atmo.altitude != null ? atmo.altitude : atmoDefaults.altitude

  // Dots style also waits for the land data so the sphere and its dots appear together.
  const showGlobe = size.w > 0 && size.h > 0 && !!mat && (!isDots || !!land)

  return (
    <div ref={wrapRef} className="wglobe">
      {showGlobe && (
        <GlobeGL
          key={q.antialias ? 'aa' : 'noaa'}
          ref={globeRef}
          width={size.w}
          height={size.h}
          backgroundColor={background}
          rendererConfig={rendererConfig}
          animateIn={false}
          waitForGlobeReady={true}
          globeMaterial={mat.material}
          showAtmosphere={!!atmo}
          atmosphereColor={atmoColor}
          atmosphereAltitude={atmoAltitude}
          pathsData={stateLines}
          pathPoints="points"
          pathPointAlt={STATES_ALT}
          pathResolution={2}
          pathColor={pathColor}
          pathDashLength={1}
          pathDashGap={0}
          pathTransitionDuration={0}
          onGlobeReady={handleReady}
          onZoom={handleZoom}
          enablePointerInteraction={!!(onPointClick || onPointHover)}
          pointerEventsFilter={pointerEventsFilter}
          customLayerData={stablePoints}
          customThreeObject={makePointObject}
          customThreeObjectUpdate={updatePointObject}
          onCustomLayerClick={handleClick}
          onCustomLayerHover={handleHover}
          ringsData={stableRings}
          ringLat="lat"
          ringLng="lng"
          ringAltitude={0.0025}
          ringColor={ringColorAccessor}
          ringMaxRadius={ringMaxRadius}
          ringPropagationSpeed={ringSpeed}
          ringRepeatPeriod={ringPeriod}
          ringResolution={48}
          labelsData={stableLabels}
          labelLat="lat"
          labelLng="lng"
          labelText={labelText}
          labelSize={labelSize}
          labelColor={labelColor}
          labelIncludeDot={labelIncludeDot}
          labelDotRadius={labelDotRadius}
          labelAltitude={0.005}
          labelResolution={2}
          labelsTransitionDuration={0}
          htmlElementsData={stableMarkers}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={0.012}
          htmlElement={makeMarker}
          htmlElementVisibilityModifier={markerVisibility}
          htmlTransitionDuration={0}
        />
      )}
    </div>
  )
}
