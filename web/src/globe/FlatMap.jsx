import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { hoverCardPosition, placeLabels } from './labels.js'
import { subsolarPoint } from './sun.js'
import '../styles/globe.css'

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
const EARTH_KM = 6371
const KM_PER_DEG = (Math.PI * EARTH_KM) / 180 // 111.2 km: the flat map is equirectangular
const DIM = 0.4 // how far an unselected point or outline drops while something is selected
const STEM = 24 // pin stem in px; the flat map has no camera, so it does not breathe
const STEM_STAGGER = 13
const STEM_FROM = 6 // stagger every other stem once there are this many pins
const OUTLINE_FILL = 0.06
const OUTLINE_LINE = 0.5
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
 * Pin markers, their hover cards, the label collision pass, `selected` and `outline` all work
 * here too, drawn as HTML and SVG rather than as three objects.
 *
 * Accepted but ignored (no meaning in 2D): interactive, autoRotate, intro, heat (the land is a
 * photograph here, not a dot field there is anything to tint — `heatRange` is still exported
 * for the legend), atmosphere, quality, style, landColors, terminator.dayDim.
 *
 * @param {object} props
 * @param {{ lat: number, lng: number, altitude: number }} [props.view]
 * @param {{ lat: number, lng: number, altitude?: number }} [props.focus] overrides `view` while set, as on the globe
 * @param {{ lat: [number, number], lng: [number, number] }} [props.bbox]
 * @param {Array<{ id, lat, lng, r?, color?, hollow? }>} [props.points] `r` in degrees, as on the globe
 * @param {Array<{ id, lat, lng, color?, maxR?, speed?, period? }>} [props.rings] degrees, degrees/second, milliseconds
 * @param {Array<{ id, lat, lng, text, size?, color?, dot? }>} [props.labels]
 * @param {Array<{ id, lat, lng, label?, tip?, rank?, color?, hollow?, muted?, lead?, side?, href?, hover? }>} [props.markers] pin markers, as on the globe; `hover` opens the same anchored card
 * @param {string|number|null} [props.selected] the chosen id: brighter and larger, everything else a step back
 * @param {Array<{ id?, lat, lng, radiusKm?, color? }>} [props.outline] circular region boundaries; a circle of `radiusKm` (200) around the point
 * @param {{ enabled?: boolean, sunLng?: number, sunLat?: number }} [props.terminator]
 * @param {string} [props.background='rgba(0,0,0,0)']
 * @param {() => void} [props.onReady] called after the first draw
 * @param {(point: object) => void} [props.onPointClick]
 * @param {(point: object|null) => void} [props.onPointHover]
 */
export default function FlatMap({
  view = DEFAULT_VIEW,
  focus,
  bbox: bboxProp,
  points = EMPTY,
  rings = EMPTY,
  labels = EMPTY,
  markers = EMPTY,
  selected = null,
  outline = EMPTY,
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

  // `focus` wins over `view` while it is set, as on the globe; there is no camera to ease, so
  // the crop simply moves.
  const cam = focus ? { lat: focus.lat, lng: focus.lng, altitude: focus.altitude != null ? focus.altitude : (view ? view.altitude : undefined) } : view
  const hasView = !!cam
  const viewLat = cam ? cam.lat : undefined
  const viewLng = cam ? cam.lng : undefined
  const viewAlt = cam ? cam.altitude : undefined
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
  const selId = selected == null || selected === '' ? null : String(selected)
  const pins = useMemo(() => (markers || EMPTY).filter(Boolean), [markers])
  const [hoverId, setHoverId] = useState(null)
  const hoverPin = hoverId == null ? null : pins.find((m) => String(m.id) === String(hoverId)) || null
  const pinLayerRef = useRef(null)
  const cardRef = useRef(null)
  const dimOf = useCallback((id) => (selId == null ? 1 : String(id) === selId ? 1 : DIM), [selId])

  // Label collision, the same pass the globe runs: measure each tag once, then place them by
  // priority and hide the ones with no free side. React re-applies its own className on the
  // next render, so this runs after every render that can move a pin.
  useLayoutEffect(() => {
    const layer = pinLayerRef.current
    if (!layer || !pins.length || !size.w) return
    const els = layer.querySelectorAll('.gpin')
    const items = []
    els.forEach((el, i) => {
      const label = el.querySelector('.gpin-label')
      const d = pins[i]
      if (!label || !d) return
      items.push({
        el,
        d,
        ax: proj.x(d.lng),
        ay: proj.y(d.lat),
        w: label.offsetWidth,
        h: label.offsetHeight,
        stem: parseFloat(el.style.getPropertyValue('--gstem')) || STEM,
        prio: selId != null && String(d.id) === selId ? 3 : d.lead ? 2 : 1,
        order: i,
      })
    })
    placeLabels(items, size.w).forEach(({ item, side }) => {
      item.el.classList.toggle('left', side === 'left')
      item.el.classList.toggle('right', side === 'right')
      item.el.classList.toggle('gpin-nolabel', side === null)
    })
  }, [pins, proj, size, selId])

  // The hover card is placed by the same rule as on the globe: beside its pin, inside the map,
  // never over the pin itself.
  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card || !hoverPin) return
    const { x, y } = hoverCardPosition({
      ax: proj.x(hoverPin.lng),
      ay: proj.y(hoverPin.lat),
      cw: card.offsetWidth,
      ch: card.offsetHeight,
      width: size.w,
      height: size.h,
    })
    card.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`
  }, [hoverPin, proj, size])

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
            {outline.map((o, i) => {
              if (!o || o.lat == null || o.lng == null) return null
              // Equirectangular: a circle of radiusKm around the centre, in degrees of latitude.
              const r = Math.max(2, ((o.radiusKm ?? 200) / KM_PER_DEG) * pxPerDeg)
              const color = o.color || DEFAULT_LABEL
              const k = dimOf(o.id)
              return (
                <circle
                  key={o.id ?? i}
                  cx={proj.x(o.lng)}
                  cy={proj.y(o.lat)}
                  r={r}
                  fill={color}
                  fillOpacity={OUTLINE_FILL * k}
                  stroke={color}
                  strokeOpacity={OUTLINE_LINE * k}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                  style={{ transition: 'fill-opacity 150ms ease, stroke-opacity 150ms ease' }}
                />
              )
            })}
          </g>
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
              const isSel = selId != null && String(p.id) === selId
              const r = Math.max(2, (p.r ?? 0.25) * pxPerDeg) * (isSel ? 1.35 : 1)
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
                  opacity={dimOf(p.id)}
                  style={{ pointerEvents: interactivePoints ? 'auto' : 'none', cursor: interactivePoints ? 'pointer' : 'default', transition: 'opacity 150ms ease, r 150ms ease' }}
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
      {size.w > 0 && pins.length > 0 && (
        <div ref={pinLayerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {pins.map((m, i) => {
            const Tag = m.href ? 'a' : 'div'
            const isSel = selId != null && String(m.id) === selId
            const cls =
              'gpin gpin-dyn' +
              (m.hollow ? ' hollow' : '') +
              (m.muted ? ' muted' : '') +
              (m.lead ? ' lead' : '') +
              (m.side === 'left' ? ' left' : m.side === 'right' ? ' right' : '') +
              (m.rank != null ? ' has-rank' : '') +
              (m.hover ? ' has-hover' : '') +
              (isSel ? ' gsel' : selId != null ? ' gdim' : '')
            const on = m.hover
              ? {
                  onPointerEnter: () => setHoverId(m.id),
                  onPointerLeave: () => setHoverId((v) => (v === m.id ? null : v)),
                  onFocus: () => setHoverId(m.id),
                  onBlur: () => setHoverId((v) => (v === m.id ? null : v)),
                }
              : null
            return (
              <Tag
                key={m.id ?? i}
                className={cls}
                href={m.href}
                tabIndex={m.hover && !m.href ? 0 : undefined}
                role={m.hover && !m.href ? 'button' : undefined}
                aria-label={m.hover ? m.hover.title : undefined}
                style={{
                  position: 'absolute',
                  left: proj.x(m.lng),
                  top: proj.y(m.lat),
                  '--gstem': `${STEM + (pins.length >= STEM_FROM && i % 2 ? STEM_STAGGER : 0)}px`,
                  ...(m.color ? { '--pin': m.color } : null),
                  pointerEvents: m.href || m.hover ? 'auto' : 'none',
                }}
                {...on}
              >
                <span className="gpin-tile">{m.rank != null && <i className="gpin-rank">{m.rank}</i>}</span>
                <span className="gpin-stem" />
                {m.label && (
                  <span className="gpin-label" data-tip={m.tip || undefined}>
                    {m.label}
                  </span>
                )}
              </Tag>
            )
          })}
        </div>
      )}
      {hoverPin && hoverPin.hover && (
        <div ref={cardRef} className="ghover on" role="tooltip">
          <div className="ghover-title">{hoverPin.hover.title || ''}</div>
          {!!(hoverPin.hover.lines || EMPTY).length && (
            <div className="ghover-lines">
              {hoverPin.hover.lines.map((t, i) => (
                <div className="ghover-line" key={i}>
                  {t}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
