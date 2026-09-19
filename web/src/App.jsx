import { useHash, parseHash } from './router.js'
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
  const Page = PAGES[route.page] || Opening
  const pageKey = `${PAGES[route.page] ? route.page : 'opening'}:${route.id || route.ticker || ''}`
  return (
    <ErrorBoundary>
      <ErrorBoundary key={pageKey}><Page route={route} demo={demo.on} /></ErrorBoundary>
      <DemoHud on={demo.on} idx={demo.idx} />
    </ErrorBoundary>
  )
}
