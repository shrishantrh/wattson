import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Globe, FlatMap, detectGlobeCapability } from '../globe'
import coords from '../data/region_coords.json'
import { href } from '../router.js'
import { KV } from './widgets.jsx'

// The console: one persistent globe stage with the UI floating over it. Every mode renders
// inside this frame and only changes what floats where (and what the globe shows).
const MODES = [['opening', 'Opening', '#/'], ['site', 'Site', '#/site'], ['verify', 'Verify', '#/verify'], ['region', 'Region', '#/region/PJM%2FDOM'], ['method', 'Method', '#/method']]
const RX = ['A', 'B', 'C', 'D', 'E', 'F'], RY = ['1', '2', '3', '4']
const US = { lat: 38.5, lng: -97, altitude: 1.55 }
const NONE = []

const StageCtx = createContext({ flat: false, canWebgl: true, setFlat: () => {}, termOn: true, setTermOn: () => {} })
export const useStage = () => useContext(StageCtx)

function useClock() {
  const [t, setT] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setT(new Date()), 30000); return () => clearInterval(id) }, [])
  return t
}

function findRegion(q) {
  const s = q.trim().toLowerCase()
  if (!s) return null
  const ids = Object.keys(coords.regions)
  return ids.find(id => id.toLowerCase() === s) || ids.find(id => coords.regions[id].label.toLowerCase() === s) || ids.find(id => coords.regions[id].label.toLowerCase().startsWith(s) || coords.regions[id].place.toLowerCase().includes(s)) || null
}

export function Search() {
  const [q, setQ] = useState('')
  const submit = e => {
    e.preventDefault()
    const id = findRegion(q)
    window.location.hash = id ? href.region(id) : href.verify(q.trim().toUpperCase())
    setQ('')
  }
  useEffect(() => {
    const onKey = e => { if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) { e.preventDefault(); document.getElementById('console-search')?.focus() } }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [])
  return <form className="search" onSubmit={submit}><input id="console-search" value={q} onChange={e => setQ(e.target.value)} placeholder="region or ticker" aria-label="Search region or ticker" /><span className="k">/</span></form>
}

function Toggles() {
  const st = useStage()
  return (
    <div className="toggles">
      <span className="seg" role="group" aria-label="Globe mode"><button type="button" className={!st.flat ? 'on' : ''} onClick={() => st.setFlat(false)} disabled={!st.canWebgl}>3D</button><button type="button" className={st.flat ? 'on' : ''} onClick={() => st.setFlat(true)}>2D</button></span>
      <span className="seg" role="group" aria-label="Day/night terminator"><button type="button" className={st.termOn ? 'on' : ''} onClick={() => st.setTermOn(true)}>Day/night</button><button type="button" className={!st.termOn ? 'on' : ''} onClick={() => st.setTermOn(false)}>Night</button></span>
    </div>
  )
}

export default function Console({ page, crumb, scenes, kv, globe, center, right, bottom, status, toolbar }) {
  // WebGL availability only. The frame-time probe in useGlobeCapability trips on HMR reloads
  // and busy first seconds, so 2D stays a manual toggle (top bar) rather than an automatic verdict.
  const [cap, setCap] = useState(() => detectGlobeCapability())
  useEffect(() => { if (cap !== 'webgl') { const id = setTimeout(() => setCap(detectGlobeCapability()), 1200); return () => clearTimeout(id) } }, [cap])
  const [flatPref, setFlat] = useState(false)
  const [termOn, setTermOn] = useState(true)
  const stage = useMemo(() => ({ flat: flatPref || cap === 'flat', canWebgl: cap === 'webgl', setFlat, termOn, setTermOn }), [flatPref, cap, termOn])
  const clock = useClock()
  const g = globe || {}
  const terminator = useMemo(() => (termOn ? { enabled: true, sunLng: 60, sunLat: 0, dayDim: 0.32, ...(g.terminator || {}) } : { enabled: false }), [termOn, g.terminator])
  const GlobeC = stage.flat ? FlatMap : Globe
  return (
    <StageCtx.Provider value={stage}>
      <div className="console">
        <div className="stage" aria-hidden="true">
          <div className={`globe-host ${stage.flat ? 'flat' : ''}`}>
            <GlobeC view={g.view || US} points={g.points || NONE} rings={g.rings || NONE} labels={g.labels || NONE} markers={g.markers || NONE} terminator={terminator} interactive={g.interactive ?? false} autoRotate={0} atmosphere={{ color: '#ffffff', altitude: 0.1 }} quality="auto" onPointClick={g.onPointClick} onPointHover={g.onPointHover} />
          </div>
        </div>
        <div className="frame"><div className="gridlines" /><div className="rx">{RX.map(x => <span key={x}>{x}</span>)}</div><div className="ry">{RY.map(y => <span key={y}>{y}</span>)}</div></div>

        <aside className="rail rail-left">
          <a href="#/" className="tile" aria-label="Wattson">W</a>
          <div className="brandblock"><span className="wordmark">Wattson</span><span className="tagline">It follows the power, not the press release.</span></div>
          <ul className="modes">
            {MODES.map(([k, l, h]) => (
              <li key={k} className={page === k ? 'on' : ''}>
                <a href={h}>{l}</a>
                {page === k && scenes && <ul className="scenes">{scenes.map(s => <li key={s.id} className={s.active ? 'on' : ''}><a href={s.href}>{s.label}</a></li>)}</ul>}
              </li>
            ))}
          </ul>
          <div className="spacer" />
          {kv && <KV rows={kv} />}
          <KV rows={[['demo', 'press D · ← →'], ['search', 'press /']]} />
        </aside>

        <header className="cbar cbar-top">
          <div className="crumb">{crumb}</div>
          <Toggles />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Search /><span className="clock">{clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
        </header>

        <section className="center">{center}{toolbar}</section>
        <aside className="rail rail-right">{right}</aside>
        <footer className="cbar cbar-bottom">
          <div className="bottom-inner">{bottom}</div>
          <div className="statusline">{status}</div>
        </footer>
      </div>
    </StageCtx.Provider>
  )
}

export function StatusLine({ data, extra }) {
  const det = data?.detector || {}
  return <><span><b>Wattson</b> // EIA-930 via PUDL</span><span>snapshot <b>{data?.data_snapshot_end || '—'}</b></span><span>baseline <b>{data?.baseline_year || 2019}</b></span><span><b>{det.n_scored ?? '—'}</b> regions scored</span><span>overnight <b>{data?.overnight_hours_local || '00:00–05:59'}</b> local</span>{extra}{data?._provisional && <span><i>provisional fixture</i></span>}</>
}
