import { useState } from 'react'
import Shell from '../console/Console.jsx'
import { Chip } from '../console/widgets.jsx'
import { parseQuery, queryHref, COMPANIES, DEMO_COMPARE } from '../lib/query.js'
import { href } from '../router.js'

// Landing: the globe, the wordmark, one box, two rows of examples. Nothing else.
export default function Landing() {
  const [q, setQ] = useState('')
  const [hint, setHint] = useState('')
  const submit = e => {
    e.preventDefault()
    const r = parseQuery(q)
    if (r.kind === 'unknown') { setHint(r.hint); return }
    window.location.hash = queryHref(r)
  }
  const overlay = (
    <>
      <h1 className="hero-q">What's really powering it? <span className="muted">Check a company, or compare places to build.</span></h1>
      <form className="searchbox" onSubmit={submit}>
        <input value={q} onChange={e => { setQ(e.target.value); setHint('') }} placeholder="Check a company or compare locations" aria-label="Check a company or compare locations" autoFocus />
        <button type="submit">Go</button>
      </form>
      <div className="hint">{hint}</div>
      <div className="examples">
        <div className="ex-row"><span className="ex-label">Check a company</span>{COMPANIES.map(c => <Chip key={c.ticker} href={href.check(c.ticker)}>{c.name}</Chip>)}</div>
        <div className="ex-row"><span className="ex-label">Compare locations</span><Chip href={href.compare(DEMO_COMPARE)}>{DEMO_COMPARE.mw} MW: {DEMO_COMPARE.metros.join(' vs ')}</Chip></div>
      </div>
      <a className="found-link" href={href.found()}>What we found in the grid data →</a>
    </>
  )
  return <Shell page="landing" globe={{ view: { lat: 36, lng: -96, altitude: 1.9 }, interactive: false }} overlay={overlay} foot="Grid-only. Excludes contracted power. Average mix, not marginal. Hourly EIA-930 data via PUDL, through 2026-09-05." />
}
