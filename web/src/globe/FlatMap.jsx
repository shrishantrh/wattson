import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { subsolarPoint } from './sun.js'

const NIGHT_URL = import.meta.env.BASE_URL + 'textures/earth-night.jpg'
const EMPTY = []
const DEFAULT_VIEW = { lat: 38, lng: -97, altitude: 1.6 }
const DEFAULT_BBOX = { lat: [22, 52], lng: [-128, -64] }
const DEFAULT_DOT = 'rgba(255,255,255,0.85)'
const DEFAULT_RING = '#ffffff'
const DEFAULT_LABEL = 'rgba(255,255,255,0.7)'
const DAY_WASH = [150, 165, 190] // faint daylight tint laid over the night texture
const DAY_WASH_ALPHA = 0.16
const MASK_COLS = 128
const MASK_ROWS = 64
const KEYFRAMES = `@keyframes wattson-flat-pulse{from{transform:scale(0.001);opacity:1}to{transform:scale(var(--wattson-r));opacity:0}}`

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))

function bboxFromView(view, bbox) {
  if (bbox) return bbox
  if (!view || (view.lat === DEFAULT_VIEW.lat && view.lng === DEFAULT_VIEW.lng && view.altitude === DEFAULT_VIEW.altitude)) {
    return DEFAULT_BBOX
  }
  const k = clamp((view.altitude ?? DEFAULT_VIEW.altitude) / DEFAULT_VIEW.altitude, 0.4, 3)
  const halfLng = 32 * k
  const halfLat = 15 * k
  return {
    lat: [clamp(view.lat - halfLat, -85, 85), clamp(view.lat + halfLat, -85, 85)],
    lng: [clamp(view.lng - halfLng, -180, 180), clamp(view.lng + halfLng, -180, 180)],
  }
}

// "Contain" fit of the bbox in the element, equirectangular (same px per degree on both axes).
function projection(size, bbox) {
  const [lat0, lat1] = bbox.lat
  const [lng0, lng1] = bbox.lng
  const spanLng = Math.max(1e-6, lng1 - lng0)
  const spanLat = Math.max(1e-6, lat1 - lat0)
  const pxPerDeg = Math.min(size.w / spanLng, size.h / spanLat)
  const dw = spanLng * pxPerDeg
  const dh = spanLat * pxPerDeg
  const dx = (size.w - dw) / 2
  const dy = (size.h - dh) / 2
  return {
    dx,
    dy,
    dw,
    dh,
    pxPerDeg,
    x: (lng) => dx + (lng - lng0) * pxPerDeg,
    y: (lat) => dy + (lat1 - lat) * pxPerDeg,
  }
}

/**
 * 2D fallback for `Globe` with the same props. Draws earth-night.jpg cropped to a bounding box
 * (default lat 22..52, lng -128..-64; `view` shifts and scales it, `bbox` overrides it) on a
 * canvas, lays a faint daylight wash over the day side when `terminator` is enabled, and
 * overlays points, pulse rings and labels as SVG.
 *
 * Accepted but ignored (no meaning in 2D): interactive, autoRotate, atmosphere, quality,
 * terminator.dayDim.
 *
 * @param {object} props
 * @param {{ lat: number, lng: number, altitude: number }} [props.view]
 * @param {{ lat: [number, number], lng: [number, number] }} [props.bbox]
 * @param {Array<{ id, lat, lng, r?, color?, hollow? }>} [props.points] `r` in degrees, as on the globe
 * @param {Array<{ id, lat, lng, color?, maxR?, speed?, period? }>} [props.rings] degrees, degrees/second, milliseconds
 * @param {Array<{ id, lat, lng, text, size?, color?, dot? }>} [props.labels]
 * @param {{ enabled?: boolean, sunLng?: number, sunLat?: number }} [props.terminator]
 * @param {string} [props.background='rgba(0,0,0,0)']
 * @param {() => void} [props.onReady] called after the first draw
 * @param {(point: object) => void} [props.onPointClick]
 * @param {(point: object|null) => void} [props.onPointHover]
 */
export default function FlatMap({
  view = DEFAULT_VIEW,
  bbox: bboxProp,
  points = EMPTY,
  rings = EMPTY,
  labels = EMPTY,
  terminator = { enabled: true },
  background = 'rgba(0,0,0,0)',
  onReady,
  onPointClick,
  onPointHover,
}) {
  const wrapRef = useRef(null)
  const mapCanvasRef = useRef(null)
  const washCanvasRef = useRef(null)
  const maskCanvasRef = useRef(null)
  const onReadyRef = useRef(onReady)
  const readyFiredRef = useRef(false)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [img, setImg] = useState(null)

  useLayoutEffect(() => {
    onReadyRef.current = onReady
  })

  const hasView = !!view
  const viewLat = view ? view.lat : undefined
  const viewLng = view ? view.lng : undefined
  const viewAlt = view ? view.altitude : undefined
  const bbox = useMemo(
    () => bboxFromView(hasView ? { lat: viewLat, lng: viewLng, altitude: viewAlt } : null, bboxProp),
    [hasView, viewLat, viewLng, viewAlt, bboxProp],
  )
  const proj = useMemo(() => projection(size, bbox), [size, bbox])

  const terminatorEnabled = terminator ? terminator.enabled !== false : false
  const sunLatProp = terminator ? terminator.sunLat : undefined
  const sunLngProp = terminator ? terminator.sunLng : undefined
  const sun = useMemo(() => {
    if (sunLatProp != null && sunLngProp != null) return { lat: sunLatProp, lng: sunLngProp }
    const s = subsolarPoint()
    return { lat: sunLatProp ?? s.lat, lng: sunLngProp ?? s.lng }
  }, [sunLatProp, sunLngProp])

  // Size: measure the parent, square fallback when it has no height.
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined
    const target = el.parentElement || el
    const measure = () => {
      const rect = target.getBoundingClientRect()
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
    ro.observe(target)
    return () => ro.disconnect()
  }, [])

  // Load the night texture once.
  useEffect(() => {
    let alive = true
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      if (alive) setImg(image)
    }
    image.onerror = () => {
      if (alive) console.warn('[FlatMap] could not load', NIGHT_URL)
    }
    image.src = NIGHT_URL
    return () => {
      alive = false
      image.onload = null
      image.onerror = null
    }
  }, [])

  // Base layer: the cropped night texture.
  useEffect(() => {
    const canvas = mapCanvasRef.current
    if (!canvas || !img || size.w === 0 || size.h === 0) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(size.w * dpr)
    canvas.height = Math.round(size.h * dpr)
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.w, size.h)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    const [lat0, lat1] = bbox.lat
    const [lng0, lng1] = bbox.lng
    const sx = ((lng0 + 180) / 360) * img.width
    const sy = ((90 - lat1) / 180) * img.height
    const sw = ((lng1 - lng0) / 360) * img.width
    const sh = ((lat1 - lat0) / 180) * img.height
    ctx.drawImage(img, sx, sy, sw, sh, proj.dx, proj.dy, proj.dw, proj.dh)
    if (!readyFiredRef.current) {
      readyFiredRef.current = true
      if (onReadyRef.current) onReadyRef.current()
    }
  }, [img, size, bbox, proj])

  // Daylight wash: a low-resolution alpha mask of sun elevation, scaled up with smoothing so the
  // terminator is a soft edge. Cheap enough to redraw every frame while sunLng animates.
  useEffect(() => {
    const canvas = washCanvasRef.current
    if (!canvas || size.w === 0 || size.h === 0) return
    const ctx = canvas.getContext('2d')
    canvas.width = size.w
    canvas.height = size.h
    ctx.clearRect(0, 0, size.w, size.h)
    if (!terminatorEnabled) return
    if (!maskCanvasRef.current) {
      maskCanvasRef.current = document.createElement('canvas')
      maskCanvasRef.current.width = MASK_COLS
      maskCanvasRef.current.height = MASK_ROWS
    }
    const mask = maskCanvasRef.current
    const mctx = mask.getContext('2d')
    const data = mctx.createImageData(MASK_COLS, MASK_ROWS)
    const [lat0, lat1] = bbox.lat
    const [lng0, lng1] = bbox.lng
    const DEGR = Math.PI / 180
    const sinDecl = Math.sin(sun.lat * DEGR)
    const cosDecl = Math.cos(sun.lat * DEGR)
    for (let row = 0; row < MASK_ROWS; row++) {
      const lat = lat1 - ((row + 0.5) / MASK_ROWS) * (lat1 - lat0)
      const sinLat = Math.sin(lat * DEGR)
      const cosLat = Math.cos(lat * DEGR)
      for (let col = 0; col < MASK_COLS; col++) {
        const lng = lng0 + ((col + 0.5) / MASK_COLS) * (lng1 - lng0)
        const sinEl = sinLat * sinDecl + cosLat * cosDecl * Math.cos((lng - sun.lng) * DEGR)
        const t = clamp((sinEl + 0.1) / 0.2, 0, 1)
        const blend = t * t * (3 - 2 * t) // smoothstep(-0.1, 0.1, sinEl), same width as the shader
        const i = (row * MASK_COLS + col) * 4
        data.data[i] = DAY_WASH[0]
        data.data[i + 1] = DAY_WASH[1]
        data.data[i + 2] = DAY_WASH[2]
        data.data[i + 3] = Math.round(blend * DAY_WASH_ALPHA * 255)
      }
    }
    mctx.putImageData(data, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(mask, proj.dx, proj.dy, proj.dw, proj.dh)
  }, [size, bbox, proj, sun, terminatorEnabled])

  const interactivePoints = !!(onPointClick || onPointHover)
  const pxPerDeg = proj.pxPerDeg

  return (
    <div
      ref={wrapRef}
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background }}
    >
      <style>{KEYFRAMES}</style>
      <canvas
        ref={mapCanvasRef}
        style={{ position: 'absolute', inset: 0, width: size.w, height: size.h, display: 'block' }}
      />
      <canvas
        ref={washCanvasRef}
        style={{ position: 'absolute', inset: 0, width: size.w, height: size.h, display: 'block', pointerEvents: 'none' }}
      />
      {size.w > 0 && size.h > 0 && (
        <svg
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
        >
          <g>
            {rings.map((rg) => {
              if (!rg) return null
              const maxRpx = Math.max(2, (rg.maxR ?? 3) * pxPerDeg)
              const speed = Math.abs(rg.speed ?? 1) || 1
              const life = (rg.maxR ?? 3) / speed // seconds a ring takes to reach maxR
              const period = Math.max(50, rg.period ?? 1200) / 1000 // seconds between rings
              const n = Math.max(1, Math.min(4, Math.ceil(life / period)))
              const color = rg.color || DEFAULT_RING
              return (
                <g key={rg.id} transform={`translate(${proj.x(rg.lng)} ${proj.y(rg.lat)})`}>
                  {Array.from({ length: n }, (_, i) => (
                    <circle
                      key={i}
                      r="1"
                      fill="none"
                      stroke={color}
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                      style={{
                        '--wattson-r': maxRpx,
                        transformOrigin: '0 0',
                        animation: `wattson-flat-pulse ${life}s linear infinite`,
                        animationDelay: `${i * period}s`,
                      }}
                    />
                  ))}
                </g>
              )
            })}
          </g>
          <g>
            {points.map((p) => {
              if (!p) return null
              const r = Math.max(2, (p.r ?? 0.25) * pxPerDeg)
              const color = p.color || DEFAULT_DOT
              return (
                <circle
                  key={p.id}
                  cx={proj.x(p.lng)}
                  cy={proj.y(p.lat)}
                  r={r}
                  fill={p.hollow ? 'none' : color}
                  stroke={p.hollow ? color : 'none'}
                  strokeWidth={p.hollow ? 1.25 : 0}
                  style={{ pointerEvents: interactivePoints ? 'auto' : 'none', cursor: interactivePoints ? 'pointer' : 'default' }}
                  onClick={onPointClick ? () => onPointClick(p) : undefined}
                  onMouseEnter={onPointHover ? () => onPointHover(p) : undefined}
                  onMouseLeave={onPointHover ? () => onPointHover(null) : undefined}
                />
              )
            })}
          </g>
          <g>
            {labels.map((l) => {
              if (!l) return null
              const x = proj.x(l.lng)
              const y = proj.y(l.lat)
              const color = l.color || DEFAULT_LABEL
              const dot = l.dot !== false
              const dotR = Math.max(1.5, (l.dotR ?? 0.12) * pxPerDeg)
              const fontSize = Math.max(11, (l.size ?? 0.6) * pxPerDeg * 1.6)
              return (
                <g key={l.id}>
                  {dot && <circle cx={x} cy={y} r={dotR} fill={color} />}
                  <text
                    x={x + (dot ? dotR + 4 : 0)}
                    y={y}
                    fill={color}
                    fontSize={fontSize}
                    fontFamily="inherit"
                    dominantBaseline="middle"
                  >
                    {l.text}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
      )}
    </div>
  )
}
