import Shell from '../console/Console.jsx'
import { Chip } from '../console/widgets.jsx'
import { COMPANIES, DEMO_COMPARE } from '../lib/query.js'
import { CommandInline } from '../components/CommandPalette.jsx'
import { href } from '../router.js'

// Landing: the globe, the wordmark, one box, two rows of examples. Nothing else.
// Camera high over the US so the headline sits over open ocean; dots a step dimmer than in answers.
const LANDING_GLOBE = { view: { lat: 44, lng: -100, altitude: 1.75 }, interactive: false, autoRotate: 0.5 }   // one slow turn on the landing only
export default function Landing() {
  const overlay = (
    <>
      <h1 className="hero-q">What's really powering it?</h1>
      <p className="hero-sub">Check a company's clean-energy claim against its grid, or compare places to build on the cleanest power.</p>
      <CommandInline autoFocus limit={5} placeholder="Check a company or compare locations" />
      <div className="examples">
        <div className="ex-row"><span className="ex-label">Check a company</span>{COMPANIES.map(c => <Chip key={c.ticker} href={href.check(c.ticker)}>{c.name}</Chip>)}</div>
        <div className="ex-row"><span className="ex-label">Compare locations</span><Chip href={href.compare(DEMO_COMPARE)}>{DEMO_COMPARE.mw} MW: {DEMO_COMPARE.metros.join(' vs ')}</Chip></div>
      </div>
      <ol className="howto" aria-label="How it works">
        <li><b>1</b> Type a company or a place, or click an example.</li>
        <li><b>2</b> Get one sentence and three numbers from hourly grid data.</li>
        <li><b>3</b> Open the evidence: the company's own pages, the grid, the caveats.</li>
      </ol>
      <a className="found-link" href={href.found()}>What we found in the grid data →</a>
    </>
  )
  return <Shell page="landing" globe={LANDING_GLOBE} overlay={overlay} foot="Grid-only. Excludes contracted power. Average mix, not marginal. Hourly EIA-930 data via PUDL, through 2026-09-05." />
}
