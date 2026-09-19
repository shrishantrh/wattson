import { useHash, parseHash } from './router.js'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { StageProvider } from './console/Console.jsx'
import { useDemoMode, DemoHud } from './demo/DemoMode.jsx'
import Landing from './pages/Landing.jsx'
import Check from './pages/Check.jsx'
import Compare from './pages/Compare.jsx'
import Found from './pages/Found.jsx'
import Region from './pages/Region.jsx'
import Method from './pages/Method.jsx'

const PAGES = { landing: Landing, check: Check, compare: Compare, found: Found, region: Region, method: Method }

export default function App() {
  const hash = useHash()
  const route = parseHash(hash)
  const demo = useDemoMode(hash)
  const Page = PAGES[route.page] || Landing
  const pageKey = `${PAGES[route.page] ? route.page : 'landing'}:${route.id || route.ticker || (route.metros || []).join('|')}`
  return (
    <ErrorBoundary>
      <StageProvider>
        <ErrorBoundary key={pageKey}><Page route={route} demo={demo.on} /></ErrorBoundary>
        <DemoHud on={demo.on} idx={demo.idx} />
      </StageProvider>
    </ErrorBoundary>
  )
}
