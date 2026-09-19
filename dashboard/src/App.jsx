import { useEffect, useState } from 'react'
import { loadAlerts, loadCompanies, loadRegions } from './data.js'
import Landing from './pages/Landing.jsx'
import Region from './pages/Region.jsx'
import Alerts from './pages/Alerts.jsx'
import Companies from './pages/Companies.jsx'
import Operators from './pages/Operators.jsx'
import About from './pages/About.jsx'

function useHash() {
  const [h, setH] = useState(window.location.hash)
  useEffect(() => { const f = () => setH(window.location.hash); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f) }, [])
  return h
}
function parse(hash) {
  const p = hash.replace(/^#\/?/, '').split('/')
  if (p[0] === 'region' && p[1]) return { page: 'region', id: decodeURIComponent(p.slice(1).join('/')) }
  return { page: p[0] || 'regions' }
}
const NAV = [['regions', 'Regions'], ['alerts', 'Alerts'], ['companies', 'Companies'], ['operators', 'Operators'], ['about', 'Method & caveats']]

export default function App() {
  const hash = useHash()
  const [s, setS] = useState({ loading: true })
  useEffect(() => {
    Promise.all([loadRegions(), loadAlerts(), loadCompanies()])
      .then(([reg, al, co]) => setS({ loading: false, regions: reg.regions, meta: reg.meta, alerts: al, companies: co.companies, mock: co.mock }))
      .catch(e => setS({ loading: false, error: String(e) }))
  }, [])
  useEffect(() => { window.scrollTo(0, 0) }, [hash])
  const route = parse(hash)
  return (
    <>
      <div className="topbar"><div className="topbar-inner">
        <a className="brand" href="#/">Grid Truth<span className="sub">hourly carbon-free monitor, US balancing authorities</span></a>
        <nav className="nav">{NAV.map(([k, l]) => <a key={k} href={`#/${k}`} className={route.page === k ? 'active' : ''}>{l}</a>)}</nav>
      </div></div>
      <main className="page">
        {s.loading && <p className="muted">Loading…</p>}
        {s.error && <div className="banner flag">Could not load data: {s.error}</div>}
        {!s.loading && !s.error && (
          route.page === 'region' ? <Region id={route.id} regions={s.regions} alerts={s.alerts.alerts} meta={s.meta} /> :
          route.page === 'alerts' ? <Alerts alerts={s.alerts} regions={s.regions} /> :
          route.page === 'companies' ? <Companies companies={s.companies} mock={s.mock} regions={s.regions} /> :
          route.page === 'operators' ? <Operators regions={s.regions} /> :
          route.page === 'about' ? <About meta={s.meta} /> :
          <Landing regions={s.regions} meta={s.meta} alerts={s.alerts} />
        )}
      </main>
    </>
  )
}
