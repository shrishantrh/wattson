import { useEffect, useState } from 'react'
import Shell from '../console/Console.jsx'
import { Chip } from '../console/widgets.jsx'
import { VERIFIED, COMPANY_COUNTS } from '../lib/query.js'
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
      const mw = d?.meta?.national?.cf_avg_mw
      if (!alive || !cf || !mw) return
      const years = Object.keys(cf).filter(y => cf[y]?.daytime != null && cf[y]?.overnight != null).sort()
      const year = years.includes('2025') ? '2025' : years[years.length - 1]   // 2026 is a partial year
      if (!year) return
      const base = years.includes('2019') ? '2019' : years[0]
      // The published 2019 national figure carries AZPS's overnight phantom: Palo Verde
      // nuclear counted once under Arizona and once under SRP. Wattson proves that double count in
      // claims/derived/corrections.json and correct it on the region page, so the headline
      // has to use the corrected baseline too. Published 2019 overnight clean reads 159.0 GW;
      // corrected it is 155.7 GW, and the overnight share then holds flat instead of falling.
      const PHANTOM = { daytime: 3736.0 - 402.2, overnight: 3373.0 - 34.7 }
      const gw = (b, y) => (mw[y]?.[b] == null ? null : (mw[y][b] - (y === '2019' ? PHANTOM[b] : 0)) / 1000)
      setN({ year, base,
             dayGw: gw('daytime', year), dayGwWas: gw('daytime', base),
             nightGw: gw('overnight', year), nightGwWas: gw('overnight', base),
             day: cf[year].daytime, night: cf[year].overnight })
    }, () => { /* no number rather than a wrong one */ })
    return () => { alive = false }
  }, [])
  return n
}

function LiveShare() {
  const n = useNational()
  if (!n) return null
  const d = n.dayGw != null && n.dayGwWas != null ? n.dayGw - n.dayGwWas : null
  const g = n.nightGw != null && n.nightGwWas != null ? n.nightGw - n.nightGwWas : null
  const one = v => `${Math.round(v * 10) / 10} GW`
  if (d == null || g == null) return null
  return (
    <p className="lx-live">
      Since {n.base} the US added <b className="lx-v clean">{one(d)}</b> of clean power to the average midday hour
      and <b className="lx-v fossil">{one(g)}</b> to the average hour at 3am.
      <span className="lx-live-so"> A datacenter runs both.</span>
    </p>
  )
}

export default function Landing() {
  const overlay = (
    <div className="landing">
      <h1 className="hero-q">What&apos;s really powering it?</h1>
      <p className="hero-kicker">A greenwashing investigation of datacenter operators</p>
      <p className="hero-sub">Every AI datacenter operator says it runs clean. Nobody checked against the meter. Wattson did. Hour by hour, for every grid in the country.</p>

      <div className="lx-box">
        <CommandInline autoFocus limit={5} placeholder="Try: Google  ·  or  300 MW: Phoenix vs Omaha" />
      </div>

      {/* One row of starting points, not three. The box above is the way in; everything
          here is a shortcut for someone who does not know what to type yet. */}
      <div className="lx-chips">
        {VERIFIED.map(c => <Chip key={c.key} href={href.check(c.key)}>{c.name}</Chip>)}
        <Chip href={href.companies()}>all {COMPANY_COUNTS.total} operators &rarr;</Chip>
      </div>

      <LiveShare />
      <nav className="lx-links" aria-label="More">
        <a className="found-link lx-found" href={href.found()}>What we found in the grid data &rarr;</a>
      </nav>
    </div>
  )
  return <Shell page="landing" globe={LANDING_GLOBE} overlay={overlay} foot="Grid-only. Excludes contracted power. Hourly EIA-930 data via PUDL, through 2026-09-05." />
}
