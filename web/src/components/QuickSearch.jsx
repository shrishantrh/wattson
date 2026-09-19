import { useState } from 'react'
import { parseQuery, queryHref } from '../lib/query.js'

// The one box, compact form for the top bar.
export default function QuickSearch() {
  const [q, setQ] = useState('')
  const [hint, setHint] = useState('')
  const submit = e => {
    e.preventDefault()
    const r = parseQuery(q)
    if (r.kind === 'unknown') { setHint(r.hint); return }
    setHint(''); setQ(''); window.location.hash = queryHref(r)
  }
  return (
    <form className="quick" onSubmit={submit} title={hint}>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={hint || 'Check a company or compare locations'} aria-label="Check a company or compare locations" />
      <span className="k">↵</span>
    </form>
  )
}
