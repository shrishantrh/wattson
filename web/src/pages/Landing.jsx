import Shell from '../console/Console.jsx'
import { Chip } from '../console/widgets.jsx'
import { COMPANIES, DEMO_COMPARE } from '../lib/query.js'
import { CommandInline } from '../components/CommandPalette.jsx'
import { href } from '../router.js'

// Landing: the globe, the wordmark, one box, two rows of examples. Nothing else.
// Camera high over the US so the headline sits over open ocean; dots a step dimmer than in answers.
const LANDING_GLOBE = { view: { lat: 44, lng: -100, altitude: 1.75 }, interactive: false }
export default function Landing() {
  const overlay = (
    <>
      <h1 className="hero-q">What's really powering it?</h1>
      <p className="hero-sub">Check a company's clean-energy claim against its grid, or compare places to build on the cleanest power.</p>
      <CommandInline autoFocus limit={5} placeholder="Check a company or compare locations" />
      <div className="examples">
        <div className="ex-row"><span className="ex-label">Check a company</span>{COMPANIES.map(c => <Chip key={c.ticker} href={href.check(c.ticker)}>{c.name}</Chip>)}</div>
        <div className="ex-row"><span className="ex-label">Compare locations</span><Chip href={href.compare(DEMO_COMPARE)}>{DEMO_COMPARE.mw} MW: {DEMO_COMPARE.metros.join(' vs ')}</Chip></div>
        <div className="ex-row"><span className="ex-label">Explore</span><Chip href={href.screen('rising')}>Where new load is landing</Chip><Chip href={href.screen('cleanest')}>Cleanest grids at night</Chip><Chip href={href.screen('worsening')}>Getting worse fastest</Chip></div>
      </div>
      <a className="found-link" href={href.found()}>What we found in the grid data →</a>
    </>
  )
  return <Shell page="landing" globe={LANDING_GLOBE} overlay={overlay} foot="Grid-only. Excludes contracted power. Average mix, not marginal. Hourly EIA-930 data via PUDL, through 2026-09-05." />
}
