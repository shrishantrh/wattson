import { useEffect } from 'react'
import { useHash, parseHash } from './router.js'
import Topbar from './components/Topbar.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { useDemoMode, DemoHud } from './demo/DemoMode.jsx'
import Opening from './pages/Opening.jsx'
import Verify from './pages/Verify.jsx'
import Site from './pages/Site.jsx'
import Region from './pages/Region.jsx'
import Method from './pages/Method.jsx'

const PAGES = { opening: Opening, verify: Verify, site: Site, region: Region, method: Method }

export default function App() {
  const hash = useHash()
  const route = parseHash(hash)
  const demo = useDemoMode(hash)
  const pageKey = `${route.page}:${route.id || route.ticker || ''}`
  useEffect(() => { if (route.page !== 'opening') window.scrollTo(0, 0) }, [pageKey, route.page])
  const Page = PAGES[route.page] || Opening
  return (
    <ErrorBoundary>
      <Topbar page={PAGES[route.page] ? route.page : 'opening'} />
      <ErrorBoundary key={pageKey}><Page route={route} demo={demo.on} /></ErrorBoundary>
      <DemoHud on={demo.on} idx={demo.idx} />
    </ErrorBoundary>
  )
}
