import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Globe, FlatMap, detectGlobeCapability } from '../globe'
import { href } from '../router.js'
import QuickSearch from '../components/QuickSearch.jsx'

// The shell: ONE persistent night globe (mounted once, in StageProvider at the app root) with,
// at most, a top bar, a left column of cards and a centred overlay. Pages render <Shell> to
// describe what floats over the globe; the globe itself never remounts between routes.
const US = { lat: 38.5, lng: -97, altitude: 1.7 }
const NONE = []
const StageCtx = createContext({ setSpec: () => {} })

export function StageProvider({ children }) {
  const [spec, setSpec] = useState({})
  const [cap, setCap] = useState(() => detectGlobeCapability())
  useEffect(() => { if (cap !== 'webgl') { const id = setTimeout(() => setCap(detectGlobeCapability()), 1500); return () => clearTimeout(id) } }, [cap])
  const [flatPref, setFlat] = useState(false)
  const [style, setStyle] = useState(() => { try { return localStorage.getItem('wattson.globe.style') || 'dots' } catch { return 'dots' } })
  const [zoom, setZoom] = useState(0)
  useEffect(() => { try { localStorage.setItem('wattson.globe.style', style) } catch { /* private mode */ } }, [style])
  // View toggles from the command palette and anywhere else: window.dispatchEvent(new CustomEvent('wattson:toggle', { detail: { key } }))
  useEffect(() => {
    const on = e => { const k = e.detail?.key; if (k === '2d') setFlat(v => !v); else if (k === 'night' || k === 'style') setStyle(v => (v === 'night' ? 'dots' : 'night')) }
    window.addEventListener('wattson:toggle', on); return () => window.removeEventListener('wattson:toggle', on)
  }, [])
  const flat = flatPref || cap !== 'webgl'
  const g = spec.globe || {}
  const baseView = g.view || US
  useEffect(() => { setZoom(0) }, [baseView.lat, baseView.lng, baseView.altitude])
  const view = useMemo(() => ({ ...baseView, altitude: Math.min(3, Math.max(0.45, baseView.altitude * Math.pow(0.8, zoom))) }), [baseView, zoom])
  const terminator = useMemo(() => (style === 'night' ? { enabled: true, sunLng: 60, sunLat: 0, dayDim: 0.3, ...(g.terminator || {}) } : { enabled: false }), [style, g.terminator])
  const colWidth = spec.column ? spec.columnWidth || 420 : 0
  const GlobeC = flat ? FlatMap : Globe
  const ctx = useMemo(() => ({ setSpec }), [])
  return (
    <StageCtx.Provider value={ctx}>
      <div className="app">
        <div className="stage" aria-hidden="true">
          <div className={`globe-host ${flat ? 'flat' : ''} ${spec.column ? 'with-column' : ''}`} style={spec.column ? { left: colWidth + (flat ? 60 : 0) } : undefined}>
            <GlobeC view={view} points={g.points || NONE} rings={g.rings || NONE} labels={NONE} markers={g.markers || NONE} terminator={terminator} interactive={g.interactive ?? !!spec.column} autoRotate={0} atmosphere={style === 'night' ? { color: '#ffffff', altitude: 0.1 } : { color: '#ffffff', altitude: 0.08 }} quality="auto" style={style} landColors={g.landColors} />
          </div>
        </div>
        <header className="topbar">
          <a className="brand" href="#/"><span className="wordmark">Wattson</span><span className="tagline">It follows the power, not the press release.</span></a>
          {spec.page !== 'landing' && <QuickSearch />}
          <nav className="toplinks"><a href={href.found()} className={spec.page === 'found' ? 'on' : ''}>What we found</a><a href={href.method()} className={spec.page === 'method' ? 'on' : ''}>Method</a></nav>
        </header>
        <div className="stage-ctl">
          <button type="button" onClick={() => setZoom(z => Math.min(6, z + 1))} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => setZoom(z => Math.max(-4, z - 1))} aria-label="Zoom out">−</button>
          <span className="gap" />
          <button type="button" className={flat ? 'on' : ''} onClick={() => setFlat(v => !v)} disabled={cap !== 'webgl'} aria-label="Toggle 2D">{flat ? '3D' : '2D'}</button>
          <button type="button" className={style === 'night' ? 'on' : ''} onClick={() => setStyle(v => (v === 'night' ? 'dots' : 'night'))} aria-label="Toggle night lights" data-tip="Night lights">☾</button>
        </div>
        {spec.column && <div className="column" style={spec.columnWidth ? { width: spec.columnWidth } : undefined}>{spec.column}</div>}
        {spec.overlay && <div className="overlay">{spec.overlay}</div>}
        {spec.foot && <div className="foot">{spec.foot}</div>}
        {children}
      </div>
    </StageCtx.Provider>
  )
}

// Pages describe what to show; the provider renders it.
export default function Shell(props) {
  const { setSpec } = useContext(StageCtx)
  useLayoutEffect(() => { setSpec(props) })   // every render: column/overlay contain live state
  useEffect(() => () => setSpec(s => (s === props ? {} : s)), [])   // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// Camera that fits a set of lat/lng points.
export function fitView(pts, fallback = US) {
  const p = (pts || []).filter(x => x && x.lat != null && x.lng != null)
  if (!p.length) return fallback
  const lat = p.reduce((a, x) => a + x.lat, 0) / p.length, lng = p.reduce((a, x) => a + x.lng, 0) / p.length
  const spread = Math.max(...p.map(x => Math.max(Math.abs(x.lat - lat), Math.abs(x.lng - lng) * Math.cos(lat * Math.PI / 180))))
  return { lat, lng, altitude: p.length === 1 ? 0.9 : Math.min(2.2, Math.max(0.7, 0.45 + spread / 22)) }
}
