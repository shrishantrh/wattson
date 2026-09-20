import { useEffect, useState } from 'react'
import Shell from '../console/Console.jsx'
import { Chip } from '../console/widgets.jsx'
import { COMPANIES, DEMO_COMPARE } from '../lib/query.js'
import { CommandInline } from '../components/CommandPalette.jsx'
import { loadRegions } from '../lib/data.js'
import { href } from '../router.js'
import '../styles/landing.css'

// Landing: the globe, one question, one box, the two things you can do. Nothing else.
// Everything that was explanatory text lives on the screens it explains.
const LANDING_GLOBE = {
  view: { lat: 30, lng: -96, altitude: 1.65 }, interactive: false, autoRotate: 0.4,
}

const pct = v => `${Math.round(v * 100)}%`

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
      const base = years.includes('2019') ? '2019' : years[0]
      setN({ year, base,
             day: cf[year].daytime, night: cf[year].overnight,
             dayWas: cf[base]?.daytime, nightWas: cf[base]?.overnight })
    }, () => { /* no number rather than a wrong one */ })
    return () => { alive = false }
  }, [])
  return n
}

function LiveShare() {
  const n = useNational()
  if (!n) return null
  const dayPts = n.dayWas != null ? Math.round((n.day - n.dayWas) * 1000) / 10 : null
  const nightPts = n.nightWas != null ? Math.round((n.night - n.nightWas) * 1000) / 10 : null
  return (
    <p className="lx-live">
      Since {n.base} US grids gained <b className="lx-v clean">{dayPts != null ? `${dayPts > 0 ? '+' : ''}${dayPts} pts` : pct(n.day)}</b> of clean power by day
      and <b className="lx-v fossil">{nightPts != null ? `${nightPts > 0 ? '+' : ''}${nightPts} pts` : pct(n.night)}</b> at night.
      <span className="lx-live-so"> A datacenter runs both.</span>
    </p>
  )
}

export default function Landing() {
  const overlay = (
    <div className="landing">
      <h1 className="hero-q">What&apos;s really powering it?</h1>
      <p className="hero-sub">Every AI datacenter operator says it runs clean. Nobody checked against the meter. We did &mdash; hour by hour, for every grid in the country.</p>

      <div className="lx-box">
        <CommandInline autoFocus limit={5} placeholder="Try: Google  ·  or  300 MW: Phoenix vs Omaha" />
      </div>

      <div className="lx-chips">
        {COMPANIES.map(c => <Chip key={c.ticker} href={href.check(c.ticker)}>{c.name}</Chip>)}
        <Chip href={href.compare(DEMO_COMPARE)}>{DEMO_COMPARE.mw} MW: {DEMO_COMPARE.metros.join(' vs ')} &rarr;</Chip>
      </div>

      <LiveShare />
      <nav className="lx-links" aria-label="More">
        <a className="found-link lx-found" href={href.found()}>What we found in the grid data &rarr;</a>
        <a className="lx-link2" href={href.alpha()}>Generating Alpha &rarr;</a>
        <a className="lx-link2" href={href.irradiance()}>Day vs night &rarr;</a>
      </nav>
    </div>
  )
  return <Shell page="landing" globe={LANDING_GLOBE} overlay={overlay} foot="Grid-only. Excludes contracted power. Hourly EIA-930 data via PUDL, through 2026-09-05." />
}
