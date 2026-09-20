import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import GlobeGL from 'react-globe.gl'
import * as THREE from 'three'
import { tweenPov, rampAutoRotate, easeOutCubic } from './camera.js'
import { cssVar, dimHex, parseCss, toThreeColor, withAlpha } from './color.js'
import { loadDayNightTextures, makeDayNightMaterial, makeNightMaterial, setDayNightUniforms } from './dayNight.js'
import { buildDotMesh, disposeDotMesh, paintDotMesh } from './dots.js'
import { hoverCardPosition, placeLabels } from './labels.js'
import { loadDotField, loadStateMesh } from './land.js'
import { buildOutlineGroup, disposeOutlineGroup, setOutlineDim } from './outline.js'
import { subsolarPoint } from './sun.js'
import { makeSphereMaterial, setDotDim, setDotTone, setSphereColor, SURFACE_DEFAULTS } from './surface.js'
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
// The defaults above are the fallback; the live values come from the page's own tokens, so a
// change to --surface or --ink moves the globe with the rest of the UI. Read once per mount
// (the theme is fixed at runtime), and only for the surfaces the caller does not colour itself.
function tokenLand() {
  const ink = parseCss(cssVar('--ink', '#e9ece9')) || { r: 233, g: 236, b: 233 }
  const rgba = (a) => `rgba(${ink.r},${ink.g},${ink.b},${a})`
  return {
    sphere: cssVar('--surface', DEFAULT_LAND.sphere),
    us: rgba(0.62),
    neighbors: rgba(0.3),
    other: rgba(0.14),
    states: rgba(0.22),
  }
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

// Selection: one place is chosen, everything else steps back. The pins are CSS (globe.css owns
// the 150 ms transition); the land dots, the point discs and the outlines are three objects, so
// their step is tweened here over the same 150 ms.
const SELECT_MS = 150
const DOT_DIM = SURFACE_DEFAULTS.dimStep // land dots, while something is selected
const POINT_DIM = 0.4 // ... and the point discs, which are the brightest thing on the map
const OUTLINE_DIM = 0.45
const POINT_SELECT_SCALE = 1.35

// Label placement: with a dozen pins on screen the tags collide, so their boxes are measured
// and placed by priority (selected, then lead, then rank order), trying the pin's preferred
// side first and hiding the tag only when no side is free.
const RELAYOUT_MS = 140

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

/**
 * Apply the selection step to one point disc: the selected id keeps its full colour and grows,
 * everything else fades towards POINT_DIM. `sel01` is the tween's progress, 0 (nothing
 * selected) to 1 (fully stepped back).
 */
function applyPointState(mesh, d, sel01, selectedId) {
  const base = mesh.userData.alpha ?? 1
  const isSel = selectedId != null && String(d.id) === selectedId
  const k = isSel ? 1 : 1 - (1 - POINT_DIM) * sel01
  const opacity = base * k
  mesh.material.opacity = opacity
  mesh.material.transparent = opacity < 1
  mesh.material.depthWrite = opacity >= 1
  const s = isSel ? 1 + (POINT_SELECT_SCALE - 1) * sel01 : 1
  mesh.scale.setScalar(s)
}

function makePointObject(d, R, sel01, selectedId) {
  const { geometry, material } = buildPointLook(d, R)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.userData.sig = pointSignature(d)
  mesh.userData.alpha = material.opacity
  applyPointState(mesh, d, sel01, selectedId)
  return mesh
}

function updatePointObject(obj, d, R, sel01, selectedId) {
  const sig = pointSignature(d)
  if (obj.userData.sig !== sig) {
    obj.geometry.dispose()
    obj.material.dispose()
    const look = buildPointLook(d, R)
    obj.geometry = look.geometry
    obj.material = look.material
    obj.userData.sig = sig
    obj.userData.alpha = look.material.opacity
  }
  applyPointState(obj, d, sel01, selectedId)
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
function makeMarkerElement(d, hooks) {
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
  // A pin with a `hover` payload answers the pointer and the keyboard; one without stays out of
  // the way so the canvas underneath keeps the drag.
  if (d.hover && hooks) {
    el.classList.add('has-hover')
    if (!d.href) {
      el.tabIndex = 0
      el.setAttribute('role', 'button')
    }
    if (d.hover.title) el.setAttribute('aria-label', d.hover.title)
    el.addEventListener('pointerenter', () => hooks.show(d, el))
    el.addEventListener('pointerleave', () => hooks.hide(d))
    el.addEventListener('focus', () => hooks.show(d, el))
    el.addEventListener('blur', () => hooks.hide(d))
  }
  el.style.pointerEvents = d.href || d.hover ? 'auto' : 'none'
  return el
}
function markerVisibility(el, isVisible) {
  el.style.opacity = isVisible ? '1' : '0'
}

// ---------- hover card ----------

function makeHoverCard() {
  const el = document.createElement('div')
  el.className = 'ghover'
  el.setAttribute('role', 'tooltip')
  el.innerHTML = '<div class="ghover-title"></div><div class="ghover-lines"></div>'
  return el
}

function fillHoverCard(el, hover) {
  el.querySelector('.ghover-title').textContent = hover.title || ''
  const box = el.querySelector('.ghover-lines')
  box.textContent = ''
  const lines = Array.isArray(hover.lines) ? hover.lines.filter((t) => t != null && t !== '') : EMPTY
  lines.forEach((t) => {
    const row = document.createElement('div')
    row.className = 'ghover-line'
    row.textContent = String(t)
    box.appendChild(row)
  })
  box.style.display = lines.length ? '' : 'none'
}

/**
 * Put the card beside its pin: to the right when there is room, otherwise to the left, and
 * above or below when neither side fits. Always inside the canvas, never over the pin.
 */
function placeHoverCard(el, anchorEl, wrapEl) {
  const wrap = wrapEl.getBoundingClientRect()
  const a = anchorEl.getBoundingClientRect()
  const { x, y } = hoverCardPosition({
    ax: a.left + a.width / 2 - wrap.left,
    ay: a.top + a.height / 2 - wrap.top,
    cw: el.offsetWidth,
    ch: el.offsetHeight,
    width: wrap.width,
    height: wrap.height,
  })
  el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`
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
 *   small deterministic per-dot jitter so the pattern has texture, and the whole field dimming
 *   and losing contrast as the camera pulls back (quiet behind a landing headline at altitude
 *   1.75, fully up by altitude 0.75). Thin US state border lines sit on top. The TopoJSON (about 220 KB raw) is loaded lazily and the field is built once per
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
 * @param {Array<{ id: string|number, lat: number, lng: number, label?: string, tip?: string, rank?: number|string, color?: string, hollow?: boolean, muted?: boolean, lead?: boolean, side?: 'left'|'right', href?: string, hover?: { title?: string, lines?: string[] } }>} [props.markers] HTML pin markers (tile + stem + label) anchored to the surface; `rank` draws a small numeral in the dot; `hover` opens a small card beside the pin on pointer hover and on keyboard focus (a pin with `hover` and no `href` becomes focusable), anchored so it never leaves the canvas and never covers its own pin; `side` is the tag's preferred side, which the collision pass keeps when it can
 * @param {string|number|null} [props.selected] the marker/point id that is chosen: it reads brighter and larger while every other pin, point, outline and land dot steps back, eased over 150 ms
 * @param {Array<{ id?: string|number, lat: number, lng: number, radiusKm?: number, color?: string }>} [props.outline] soft circular region boundaries drawn on the sphere (one hairline plus a very low-alpha fill). The app has load-centre coordinates rather than shapefiles, so this is a great-circle circle of the stated radius, an approximation the caller is expected to label as one; `radiusKm` defaults to 200
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
  selected = null,
  outline = EMPTY,
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
  const pinsRef = useRef([]) // { el, d } per live pin, in data order
  const stemAltRef = useRef(null)
  const outlineRef = useRef(null)
  const pointObjsRef = useRef([]) // { mesh, d } per live point disc
  const selectedRef = useRef(null)
  const selTweenRef = useRef({ v: 0, from: 0, to: 0, t0: 0, raf: 0 })
  const hoverElRef = useRef(null)
  const hoverAnchorRef = useRef(null)
  const hoverRafRef = useRef(0)
  const hoverHideRef = useRef(0)
  const relayoutRef = useRef({ last: 0, timer: 0 })
  const heatOnRef = useRef(false)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [mat, setMat] = useState(null)
  const [land, setLand] = useState(null) // dots style: { field, states } once the TopoJSON is in
  const [readyTick, setReadyTick] = useState(0)
  const [dotTick, setDotTick] = useState(0) // bumped when the dot mesh is (re)attached
  // The state border lines follow the dots: quiet when the camera is far out. Bucketed with
  // hysteresis, because a colour change rebuilds the 302 line objects and must not happen per
  // frame the way the dots' two uniform writes can.
  const [farLines, setFarLines] = useState(true)
  // Stabilised so an inline `heat={[...]}` does not repaint 15k instance colours every render.
  const stableHeat = useStableList(heat)
  const stableOutline = useStableList(outline)
  const selectedId = selected == null || selected === '' ? null : String(selected)
  const heatOn = stableHeat.length > 0

  const q = QUALITY[quality] || QUALITY.auto
  const isDots = style !== 'night'
  const tokens = useMemo(() => tokenLand(), [])
  const lc = landColors || tokens
  const sphereColor = lc.sphere || tokens.sphere
  const usColor = lc.us || tokens.us
  const neighborColor = lc.neighbors || tokens.neighbors
  const otherColor = lc.other || tokens.other
  const statesColor = lc.states || tokens.states
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
    selectedRef.current = selectedId
    heatOnRef.current = heatOn
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
      ? Promise.resolve({ material: makeSphereMaterial(toThreeColor(tokenLand().sphere).hex), textures: [], kind: 'dots' })
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
      setDotTone(mesh.material, stemAltRef.current ?? (g.pointOfView ? g.pointOfView().altitude : null), heatOnRef.current)
      setDotDim(mesh.material, 1 - (1 - DOT_DIM) * selTweenRef.current.v)
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
        clean: cleanColor || cssVar('--clean', '#4fd4d0'),
        fossil: fossilColor || cssVar('--fossil', cssVar('--accent', '#ff7a4a')),
      },
      stableHeat.length ? stableHeat : null,
    )
  }, [land, dotTick, stableHeat, sphereColor, usColor, neighborColor, otherColor, cleanColor, fossilColor])

  // 9c. The heat overlay holds the land brighter at altitude, so the tint still reads where the
  //     plain dot field is deliberately quiet. Only two uniforms move.
  useEffect(() => {
    const mesh = dotMeshRef.current
    if (!mesh) return
    const g = globeRef.current
    setDotTone(mesh.material, stemAltRef.current ?? (g && g.pointOfView ? g.pointOfView().altitude : null), heatOn)
  }, [dotTick, heatOn])

  // 9e. Outlines: the region's territory as a great-circle circle, in the same group as the dot
  //     field so it shares the globe's frame of reference. Rebuilt only when the array changes,
  //     and the previous group's geometries and materials are freed.
  useEffect(() => {
    const g = globeRef.current
    if (!readyTick || !g || !stableOutline.length) return undefined
    let group = null
    let timer = 0
    let tries = 0
    const attach = () => {
      const scene = g.scene && g.scene()
      const globeObj = scene && scene.children.find((o) => typeof o.getGlobeRadius === 'function')
      if (!globeObj) {
        if (tries++ < 120) timer = setTimeout(attach, 16)
        return
      }
      group = buildOutlineGroup(stableOutline, g.getGlobeRadius(), cssVar('--ink', '#e9ece9'))
      setOutlineDim(group, 1 - (1 - OUTLINE_DIM) * selTweenRef.current.v)
      globeObj.add(group)
      outlineRef.current = group
    }
    attach()
    return () => {
      clearTimeout(timer)
      tries = Infinity
      outlineRef.current = null
      disposeOutlineGroup(group)
    }
  }, [readyTick, stableOutline])

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
  const stemFor = (altitude) => Math.max(STEM_MIN, Math.min(STEM_MAX, 12 + 12 * (altitude ?? 1.6)))

  // 12b. Label collision. Every visible tag's box is computed from one measurement per pin (no
  //      reflow per attempt), then the tags are placed in priority order — the selected pin
  //      first, then `lead` pins, then the rest in data order, which the pages already sort by
  //      rank. Each tag takes the first of its sides that is free and inside the canvas; a tag
  //      with no free side is hidden rather than allowed to overlap. Reads are batched ahead of
  //      writes, and the whole pass is throttled to RELAYOUT_MS.
  const relayoutLabels = useCallback(() => {
    const wrapEl = wrapRef.current
    if (!wrapEl) return
    const list = pinsRef.current.filter((r) => r.el.isConnected)
    pinsRef.current = list
    if (!list.length) return
    const sel = selectedRef.current
    const wrap = wrapEl.getBoundingClientRect()
    // --- reads ---
    const items = []
    for (let i = 0; i < list.length; i++) {
      const { el, d } = list[i]
      const label = el.querySelector('.gpin-label')
      if (!label) continue
      if (el.style.opacity === '0') continue // behind the globe: three-globe already hid it
      const a = el.getBoundingClientRect()
      const ax = a.left + a.width / 2 - wrap.left
      const ay = a.top + a.height / 2 - wrap.top
      if (ax < -60 || ax > wrap.width + 60 || ay < -60 || ay > wrap.height + 60) continue
      const isSel = sel != null && String(d.id) === sel
      items.push({
        el,
        d,
        ax,
        ay,
        w: label.offsetWidth,
        h: label.offsetHeight,
        stem: parseFloat(el.style.getPropertyValue('--gstem')) || 24,
        prio: isSel ? 3 : d.lead ? 2 : 1,
        order: i,
      })
    }
    // --- placement (pure, no DOM) ---
    const out = placeLabels(items, wrap.width)
    // --- writes ---
    for (const { item, side } of out) {
      item.el.classList.toggle('left', side === 'left')
      item.el.classList.toggle('right', side === 'right')
      item.el.classList.toggle('gpin-nolabel', side === null)
    }
  }, [])

  const scheduleRelayout = useCallback(
    (now = false) => {
      const r = relayoutRef.current
      const t = performance.now()
      if (now || t - r.last > RELAYOUT_MS) {
        r.last = t
        relayoutLabels()
        return
      }
      if (!r.timer) {
        r.timer = setTimeout(() => {
          r.timer = 0
          r.last = performance.now()
          relayoutLabels()
        }, RELAYOUT_MS)
      }
    },
    [relayoutLabels],
  )

  const layoutPins = useCallback(
    (altitude) => {
      const list = pinsRef.current.filter((r) => r.el.isConnected)
      pinsRef.current = list
      if (!list.length) return
      const base = stemFor(altitude)
      const stagger = list.length >= STEM_FROM
      list.forEach(({ el }, i) => {
        const h = Math.round(base + (stagger && i % 2 ? STEM_STAGGER : 0))
        el.style.setProperty('--gstem', `${h}px`)
      })
      scheduleRelayout()
    },
    [scheduleRelayout],
  )

  // 12c. The hover card: one element for the whole globe, filled and moved rather than rebuilt.
  //      It follows its pin while the camera moves and disappears as soon as the pin does.
  const hideHover = useCallback(() => {
    const el = hoverElRef.current
    hoverAnchorRef.current = null
    cancelAnimationFrame(hoverRafRef.current)
    hoverRafRef.current = 0
    if (!el) return
    el.classList.remove('on')
    clearTimeout(hoverHideRef.current)
    hoverHideRef.current = setTimeout(() => {
      if (!hoverAnchorRef.current) el.style.visibility = 'hidden'
    }, 180)
  }, [])

  const showHover = useCallback(
    (d, anchor) => {
      const el = hoverElRef.current
      const wrapEl = wrapRef.current
      if (!el || !wrapEl || !d.hover) return
      clearTimeout(hoverHideRef.current)
      hoverAnchorRef.current = anchor
      fillHoverCard(el, d.hover)
      el.style.visibility = 'visible'
      placeHoverCard(el, anchor, wrapEl)
      el.classList.add('on')
      if (!hoverRafRef.current) {
        const follow = () => {
          const a = hoverAnchorRef.current
          if (!a || !a.isConnected || a.style.opacity === '0') {
            hoverRafRef.current = 0
            hideHover()
            return
          }
          placeHoverCard(el, a, wrapEl)
          hoverRafRef.current = requestAnimationFrame(follow)
        }
        hoverRafRef.current = requestAnimationFrame(follow)
      }
    },
    [hideHover],
  )

  // `showHover`/`hideHover` are stable, so every pin ever created shares one hooks object and
  // `makeMarker` never changes identity (which would make react-globe.gl rebuild every pin).
  const hoverHooks = useMemo(() => ({ show: showHover, hide: hideHover }), [showHover, hideHover])

  // A hidden tab gets no frames, so pins created there are placed against stale positions (and
  // the camera never moves to trigger a relayout). Re-place them when the tab comes back.
  useEffect(() => {
    const on = () => {
      if (!document.hidden) requestAnimationFrame(() => scheduleRelayout(true))
    }
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [scheduleRelayout])

  useEffect(() => {
    const wrapEl = wrapRef.current
    if (!wrapEl) return undefined
    const el = makeHoverCard()
    el.style.visibility = 'hidden'
    wrapEl.appendChild(el)
    hoverElRef.current = el
    return () => {
      cancelAnimationFrame(hoverRafRef.current)
      clearTimeout(hoverHideRef.current)
      hoverElRef.current = null
      hoverAnchorRef.current = null
      el.remove()
    }
  }, [])

  const makeMarker = useCallback(
    (d) => {
      const el = makeMarkerElement(d, hoverHooks)
      pinsRef.current.push({ el, d })
      const g = globeRef.current
      const alt = stemAltRef.current ?? (g && g.pointOfView ? g.pointOfView().altitude : null)
      el.style.setProperty('--gstem', `${Math.round(stemFor(alt))}px`)
      const sel = selectedRef.current
      if (sel != null) {
        el.classList.toggle('gsel', String(d.id) === sel)
        el.classList.toggle('gdim', String(d.id) !== sel)
      }
      // The new pin joins its neighbours on the next frame, once the whole set is in the DOM.
      requestAnimationFrame(() => layoutPins(stemAltRef.current))
      return el
    },
    [layoutPins, hoverHooks],
  )

  // 12d. Selection. One id is chosen: its pin and point come forward, everything else steps back.
  //     The pins are CSS classes with their own transition; the three objects are eased here by
  //     one tween over SELECT_MS that writes a single uniform for the 15k land dots, one opacity
  //     per point disc and one per outline. Nothing runs once the tween has settled.
  useEffect(() => {
    const target = selectedId != null ? 1 : 0
    // Pins keep their elements; only their classes change, so no DOM is rebuilt.
    pinsRef.current.forEach(({ el, d }) => {
      const on = selectedId != null && String(d.id) === selectedId
      el.classList.toggle('gsel', on)
      el.classList.toggle('gdim', selectedId != null && !on)
    })
    scheduleRelayout(true)
    const t = selTweenRef.current
    const apply = (v) => {
      t.v = v
      if (dotMeshRef.current) setDotDim(dotMeshRef.current.material, 1 - (1 - DOT_DIM) * v)
      if (outlineRef.current) setOutlineDim(outlineRef.current, 1 - (1 - OUTLINE_DIM) * v)
      const now = performance.now()
      const live = pointObjsRef.current.filter((r) => r.mesh.parent || now - r.t < 1000)
      pointObjsRef.current = live
      live.forEach((r) => applyPointState(r.mesh, r.d, v, selectedId))
    }
    if (t.v === target) {
      apply(target) // a new selection at the same strength: re-target which object is bright
      return undefined
    }
    cancelAnimationFrame(t.raf)
    t.from = t.v
    t.to = target
    t.t0 = performance.now()
    const step = () => {
      const k = Math.min(1, (performance.now() - t.t0) / SELECT_MS)
      const e = k * k * (3 - 2 * k)
      apply(t.from + (t.to - t.from) * e)
      t.raf = k < 1 ? requestAnimationFrame(step) : 0
    }
    t.raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(t.raf)
  }, [selectedId, dotTick, scheduleRelayout])


  // 13. Camera moves feed the shader (the example's onZoom -> globeRotation wiring) and the pins.
  const handleZoom = useCallback(
    (pov) => {
      setDayNightUniforms(matRef.current, { globeLat: pov.lat, globeLng: pov.lng })
      // The land quietens as the camera pulls back: two uniform writes, every camera frame.
      if (dotMeshRef.current) setDotTone(dotMeshRef.current.material, pov.altitude, heatOnRef.current)
      if (pov.altitude > 1.3) setFarLines(true)
      else if (pov.altitude < 1.1) setFarLines(false)
      const prev = stemAltRef.current
      if (prev == null || Math.abs(prev - pov.altitude) > 0.02) {
        stemAltRef.current = pov.altitude
        layoutPins(pov.altitude)
      } else {
        // Rotation moves the tags without changing the stems: re-place them, throttled.
        scheduleRelayout()
      }
    },
    [layoutPins, scheduleRelayout],
  )

  const handleHover = useCallback((d) => {
    if (onHoverRef.current) onHoverRef.current(d || null)
  }, [])
  const handleClick = useCallback((d, event, coords) => {
    if (onClickRef.current) onClickRef.current(d, event, coords)
  }, [])

  // Point discs are created and updated through the component so a disc built while something
  // is selected is born at the right brightness, and so the live set can be dimmed in place.
  // A point disc is created before react-globe.gl adds it to the scene, so an entry is only
  // pruned once it has had a moment to be attached and has then lost its parent.
  const prunePoints = () => {
    const now = performance.now()
    pointObjsRef.current = pointObjsRef.current.filter((r) => r.mesh.parent || now - r.t < 1000)
  }
  const makePoint = useCallback((d, R) => {
    const mesh = makePointObject(d, R, selTweenRef.current.v, selectedRef.current)
    const reg = pointObjsRef.current
    reg.push({ mesh, d, t: performance.now() })
    if (reg.length > 400) prunePoints()
    return mesh
  }, [])
  const updatePoint = useCallback((obj, d, R) => {
    updatePointObject(obj, d, R, selTweenRef.current.v, selectedRef.current)
  }, [])

  useEffect(
    () => () => {
      clearTimeout(relayoutRef.current.timer)
      cancelAnimationFrame(selTweenRef.current.raf)
    },
    [],
  )

  const stablePoints = useStableList(points)
  const stableRings = useStableList(rings)
  const stableLabels = useStableList(labels)
  const stableMarkers = useStableList(markers)
  const rendererConfig = useMemo(
    () => ({ antialias: q.antialias, alpha: true, powerPreference: 'high-performance' }),
    [q.antialias],
  )

  const lineColor = farLines ? withAlpha(statesColor, 0.45) : statesColor
  const pathColor = useCallback(() => lineColor, [lineColor])
  const stateLines = isDots && land ? land.states : EMPTY

  // Atmosphere: the default depends on the style; an explicit prop (or null) wins.
  const atmo = atmosphere === undefined ? (isDots ? DEFAULT_ATMOSPHERE_DOTS : DEFAULT_ATMOSPHERE) : atmosphere
  const atmoDefaults = isDots ? DEFAULT_ATMOSPHERE_DOTS : DEFAULT_ATMOSPHERE
  const atmoColor = dimHex((atmo && atmo.color) || cssVar('--ink', atmoDefaults.color), atmo && atmo.opacity != null ? atmo.opacity : atmoDefaults.opacity)
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
          customThreeObject={makePoint}
          customThreeObjectUpdate={updatePoint}
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
