import { useCallback, useEffect, useMemo, useState } from 'react'
import { useHash } from '../router.js'
import { insightForRoute } from '../lib/insight.js'
import { Info, Close, ArrowRight } from './Icons.jsx'
import '../styles/insight.css'

// "What am I looking at": a small card in the bottom-right corner that explains the screen you
// are on and what to do next. The words come from lib/insight.js — generated from the route and
// from whatever numbers the page chose to publish, never from a model and never from the network.
//
// A page can hand it its own figures without importing anything:
//   window.dispatchEvent(new CustomEvent('wattson:insight', { detail: { company: 'Alphabet' } }))
// The detail is remembered until the hash changes, and only values the text asks for are used.

const KEY = 'wattson.insight.open'
const read = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }
const write = v => { try { localStorage.setItem(KEY, v ? '1' : '0') } catch { /* private mode */ } }
const typing = el => !!el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName))

export default function Insight() {
  const hash = useHash()
  const [open, setOpen] = useState(read)
  // Page-published figures, tagged with the route they were published on, so one screen's
  // numbers can never leak into the next screen's sentences.
  const [pub, setPub] = useState({ hash: '', detail: {} })
  useEffect(() => {
    const on = e => setPub(p => ({ hash: window.location.hash, detail: { ...(p.hash === window.location.hash ? p.detail : {}), ...(e.detail || {}) } }))
    window.addEventListener('wattson:insight', on)
    return () => window.removeEventListener('wattson:insight', on)
  }, [])
  const ctx = useMemo(() => ({ ...(window.__wattsonInsight || {}), ...(pub.hash === hash ? pub.detail : {}) }), [hash, pub])

  const toggle = useCallback(() => setOpen(v => { write(!v); return !v }), [])
  useEffect(() => {
    const on = e => {
      if (e.key !== 'i' || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return
      e.preventDefault(); toggle()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [toggle])

  const it = useMemo(() => insightForRoute(hash, ctx), [hash, ctx])
  if (!it) return null

  if (!open) {
    return (
      <button type="button" className="insight-fab" onClick={toggle} aria-expanded={false}>
        <Info size={16} /><span>Explain this screen</span>
      </button>
    )
  }
  return (
    <aside className="insight" aria-label="Explanation of this screen">
      <div className="insight-head">
        <div className="insight-headings">
          <span className="insight-kicker">What this screen shows</span>
          <h2 className="insight-title">{it.title}</h2>
        </div>
        <button type="button" className="insight-x" onClick={toggle} aria-expanded>Close<Close size={12} /></button>
      </div>
      <ul className="insight-lines">{it.lines.map(l => <li key={l}>{l}</li>)}</ul>
      {it.hint && <p className="insight-hint">{it.hint}</p>}
      {!!it.actions?.length && (
        <div className="insight-acts">
          {it.actions.map(a => <a key={a.href + a.label} className="insight-act" href={a.href}>{a.label}<ArrowRight size={13} /></a>)}
        </div>
      )}
      <p className="insight-foot">Written from this screen's data. Press <span className="kbd">i</span> to hide.</p>
    </aside>
  )
}
