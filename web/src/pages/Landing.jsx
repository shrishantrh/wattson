import { useEffect, useState } from 'react'
import Shell from '../console/Console.jsx'
import { Chip } from '../console/widgets.jsx'
import { COMPANIES, DEMO_COMPARE } from '../lib/query.js'
import { CommandInline } from '../components/CommandPalette.jsx'
import { loadRegions } from '../lib/data.js'
import { href } from '../router.js'
import '../styles/landing.css'

// Landing: one column of content held left of the stage centre so the globe keeps the right
// half of the screen to itself. Reading order is headline -> box -> provenance -> the one live
// figure -> the two things the product does -> how it works. Nothing is centred over the planet.
const LANDING_GLOBE = { view: { lat: 44, lng: -100, altitude: 1.75 }, interactive: false, autoRotate: 0.5 }   // one slow turn on the landing only

const pct = v => `${(v * 100).toFixed(1)}%`

// The one live number: the national carbon-free share by day and at night, from the same
// regions.json the rest of the app reads. Loaded after paint; if the fetch fails, nothing renders.
function useNational() {
  const [n, setN] = useState(null)
  useEffect(() => {
    let alive = true
    loadRegions().then(d => {
      const cf = d?.meta?.national?.cf_share
      if (!alive || !cf) return
      const years = Object.keys(cf).filter(y => cf[y]?.daytime != null && cf[y]?.overnight != null).sort()
      const year = years.includes('2025') ? '2025' : years[years.length - 1]   // 2026 is a partial year
      if (!year) return
      setN({ year, day: cf[year].daytime, night: cf[year].overnight })
    }, () => { /* no number rather than a wrong one */ })
    return () => { alive = false }
  }, [])
  return n
}

function LiveShare() {
  const n = useNational()
  if (!n) return null
  return (
    <p className="lx-live">
      US grids ran <b className="lx-v clean">{pct(n.day)}</b> carbon-free by day and{' '}
      <b className="lx-v fossil">{pct(n.night)}</b> at night in {n.year}.
      <span className="lx-live-note">The gap is what a 24/7 datacenter actually runs on.</span>
    </p>
  )
}

export default function Landing() {
  const overlay = (
    <div className="landing">
      <h1 className="hero-q">What's really powering it?</h1>
      <p className="hero-sub">Check a company's clean-energy claim against its grid, or compare places to build on the cleanest power.</p>

      <div className="lx-box">
        <CommandInline autoFocus limit={5} placeholder="Try: Google  ·  or  300 MW: Phoenix vs Omaha" />
        <p className="lx-prov">Every US grid, every hour, 2019 to 2026, from EIA-930 via PUDL.</p>
      </div>

      <LiveShare />

      <div className="lx-actions">
        <section className="lx-action">
          <h2 className="lx-act-t">Check a company</h2>
          <p className="lx-act-s">Its own claim against the grid its sites actually use.</p>
          <div className="lx-chips">{COMPANIES.map(c => <Chip key={c.ticker} href={href.check(c.ticker)}>{c.name}</Chip>)}</div>
        </section>
        <section className="lx-action">
          <h2 className="lx-act-t">Compare locations</h2>
          <p className="lx-act-s">Where new flat load would be served cleanest, hour by hour.</p>
          <a className="lx-go" href={href.compare(DEMO_COMPARE)}>
            <span className="lx-go-q">{DEMO_COMPARE.mw} MW: {DEMO_COMPARE.metros.join(' vs ')}</span>
            <span className="lx-go-a" aria-hidden="true">&rarr;</span>
          </a>
        </section>
        <section className="lx-action">
          <h2 className="lx-act-t">Follow the money, and the sun</h2>
          <p className="lx-act-s">Which instruments price the tightening, and why the day got clean while the night did not.</p>
          <div className="lx-chips">
            <Chip href={href.alpha()}>Generating Alpha</Chip>
            <Chip href={href.irradiance()}>Day vs night</Chip>
          </div>
        </section>
      </div>

      <ol className="lx-steps" aria-label="How it works">
        <li><b>1</b><span>Type a company or a place.</span></li>
        <li><b>2</b><span>Get one sentence and three numbers from hourly grid data.</span></li>
        <li><b>3</b><span>Open the evidence: their pages, the grid, the caveats.</span></li>
      </ol>

      <a className="found-link lx-found" href={href.found()}>What we found in the grid data &rarr;</a>
    </div>
  )
  return <Shell page="landing" globe={LANDING_GLOBE} overlay={overlay} foot="Grid-only. Excludes contracted power. Average mix, not marginal. Hourly EIA-930 data via PUDL, through 2026-09-05." />
}
