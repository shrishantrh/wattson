import { lazy, Suspense } from 'react'
import { useHash, parseHash } from './router.js'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { Loading } from './components/States.jsx'
import { StageProvider } from './console/Console.jsx'
import { useDemoMode, DemoHud } from './demo/DemoMode.jsx'
import { CommandPalette } from './components/CommandPalette.jsx'
import { Toaster } from './components/Toast.jsx'
import { ShortcutsSheet } from './components/Shortcuts.jsx'
import Tour from './components/Tour.jsx'
import Landing from './pages/Landing.jsx'
import Check from './pages/Check.jsx'
import Compare from './pages/Compare.jsx'
import Found from './pages/Found.jsx'
import Region from './pages/Region.jsx'
import Method from './pages/Method.jsx'
// Heavier routes load on demand. import.meta.glob keeps the build green while a page file is
// still being written by someone else: a missing page shows a short message instead of failing the bundle.
const pageFiles = import.meta.glob('./pages/*.jsx')
const Missing = ({ name }) => <div className="card" style={{ position: 'fixed', left: 22, top: 66, width: 420, zIndex: 60 }}><p className="note">The {name} page is not built yet.</p><a className="btn" href="#/" style={{ marginTop: 10, display: 'inline-block' }}>Back to start</a></div>
const lazyPage = name => lazy(() => (pageFiles[`./pages/${name}.jsx`] ? pageFiles[`./pages/${name}.jsx`]() : Promise.resolve({ default: () => <Missing name={name} /> })))
const Film = lazyPage('Film')
const Screener = lazyPage('Screener'), Explore = lazyPage('Explore'), Alerts = lazyPage('Alerts'), Companies = lazyPage('Companies'), Data = lazyPage('Data')

const PAGES = { landing: Landing, check: Check, compare: Compare, found: Found, region: Region, method: Method, screen: Screener, screener: Screener, explore: Explore, alerts: Alerts, companies: Companies, data: Data }

export default function App() {
  const hash = useHash()
  const route = parseHash(hash)
  const demo = useDemoMode(hash)
  const Page = PAGES[route.page] || Landing
  const pageKey = `${PAGES[route.page] ? route.page : 'landing'}:${route.id || route.ticker || (route.metros || []).join('|')}`
  return (
    <ErrorBoundary>
      <StageProvider>
        <ErrorBoundary key={pageKey}><Suspense fallback={<div className="card" style={{ position: 'fixed', left: 22, top: 66, width: 420, zIndex: 4 }}><Loading what="the page" /></div>}><Page route={route} demo={demo.on} /></Suspense></ErrorBoundary>
        <DemoHud on={demo.on} idx={demo.idx} />
        <Tour on={demo.on} idx={demo.idx} />
        {/[?&]film=1/.test(hash) && <Suspense fallback={null}><Film route={route} /></Suspense>}
        <CommandPalette />
        <ShortcutsSheet />
        <Toaster />
      </StageProvider>
    </ErrorBoundary>
  )
}
