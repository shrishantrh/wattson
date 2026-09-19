import { useEffect, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { FILM } from '../demo/film.js'
import '../styles/film.css'

// The film: runs demo/film.js as an overlay on whatever page the hash shows. It is not a page: the
// App mounts <Film /> at its root when isFilm(hash) is true (any route with ?film=1), and the
// component drives window.location.hash itself, shot by shot. It renders through a portal onto
// document.body: a fake cursor, a click ripple, a caption plate and a progress line; the page under
// it is the real app receiving real clicks (el.click()) and real input events. The recorder
// (web/scripts/film.mjs) polls window.__film.done. StrictMode mounts effects twice in dev, so the
// run is a module-level singleton: whichever instance is mounted shows its state.

const FLAG = /[?&]film=1(?:&|$)/
let armed = false
// True once any hash or search string has carried film=1; in-app navigation drops the query, so the
// flag is sticky for the life of the page.
// oxlint-disable-next-line react/only-export-components
export function isFilm(hash = window.location.hash) {
  if (!armed && (FLAG.test(hash) || FLAG.test(window.location.search))) armed = true
  return armed
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
const stripFilm = h => h.replace(/([?&])film=1(&|$)/, (m, a, b) => (b ? a : '')).replace(/\?$/, '')
const withFilm = h => (FLAG.test(h) ? h : h.includes('?') ? `${h}&film=1` : `${h}?film=1`)
const sameRoute = (a, b) => stripFilm(a || '#/') === stripFilm(b || '#/')

function find(selector, text) {
  if (!selector) return null
  if (text == null) return document.querySelector(selector)
  return Array.from(document.querySelectorAll(selector)).find(el => el.textContent.trim() === text) || null
}
async function waitFor(selector, text, timeout = 6000) {
  const t0 = performance.now()
  for (;;) {
    const el = find(selector, text)
    if (el && (el.getBoundingClientRect().width || el.getBoundingClientRect().height)) return el
    if (performance.now() - t0 > timeout) return null
    await sleep(100)
  }
}
const centre = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }
const scrollParent = el => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p } return null }

// The input's value goes through the native setter so React's onChange sees each keystroke.
function setNative(input, value) {
  const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
const key = (el, k, code = k, keyCode = 13) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, code, keyCode, which: keyCode, bubbles: true, cancelable: true }))

// One run for the page; every mounted Film instance subscribes to its state.
const run = { started: false, subs: new Set(), state: { shot: -1, title: null, sub: null, end: false, show: false, cursor: null, pressed: false, ripple: null, progress: 0, holdMs: 0 } }
const subscribe = f => { run.subs.add(f); return () => run.subs.delete(f) }
const emit = patch => { run.state = { ...run.state, ...patch }; for (const f of run.subs) f() }
window.__film = { done: false, shot: -1, total: FILM.length }

async function moveTo(el, settle = 700) {
  const c = centre(el)
  emit({ cursor: c })
  await sleep(settle)
  return c
}
async function act(a) {
  if (a.type === 'wait') { await sleep(a.ms ?? 500); return }
  const el = await waitFor(a.selector, a.text)
  if (!el) { console.warn('[film] not found:', a.selector, a.text ?? ''); return }
  if (a.type === 'move') { await moveTo(el); return }
  if (a.type === 'scroll') {
    const sp = scrollParent(el)
    if (sp) { const top = el.getBoundingClientRect().top - sp.getBoundingClientRect().top + sp.scrollTop - 12; sp.scrollTo({ top: Math.max(0, top), behavior: 'smooth' }) } else el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    await sleep(700)
    await moveTo(el, 500)
    return
  }
  if (a.type === 'click') {
    const c = await moveTo(el)
    emit({ pressed: true, ripple: { ...c, k: Date.now() } })
    await sleep(90)
    el.click()
    emit({ pressed: false })
    await sleep(a.ms ?? 350)
    return
  }
  if (a.type === 'type') {
    const c = await moveTo(el, 500)
    emit({ ripple: { ...c, k: Date.now() } })
    el.focus()
    const text = a.text || ''
    for (let i = 1; i <= text.length; i++) { setNative(el, text.slice(0, i)); await sleep(70 + Math.random() * 60) }
    await sleep(650)
    const before = window.location.hash
    key(el, 'Enter', 'Enter', 13)
    await sleep(1200)
    if (a.fallback && window.location.hash === before) { const fb = find(a.fallback); if (fb) { await moveTo(fb, 500); emit({ ripple: { ...centre(fb), k: Date.now() } }); fb.click() } }
    await sleep(300)
  }
}

async function play() {
  document.body.dataset.film = '1'
  const n = FILM.length
  await sleep(400)
  for (let i = 0; i < n; i++) {
    const s = FILM[i]
    window.__film.shot = i
    emit({ shot: i, progress: i / n, holdMs: 0 })
    if (!sameRoute(window.location.hash, s.route)) { window.location.hash = withFilm(s.route); await sleep(150) }
    if (s.waitFor) await waitFor(s.waitFor)
    await sleep(120)
    if (s.title) emit({ title: s.title, sub: s.sub, end: !!s.end, show: true })
    for (const a of s.actions || []) await act(a)
    emit({ progress: (i + 1) / n, holdMs: s.holdMs })
    await sleep(s.holdMs)
    if (s.title) { emit({ show: false }); await sleep(260) }
  }
  window.__film.done = true
}

export default function Film() {
  const st = useSyncExternalStore(subscribe, () => run.state)
  useEffect(() => {
    if (!run.started) { run.started = true; play().catch(e => { console.error('[film]', e); window.__film.done = true }) }
  }, [])
  const cur = st.cursor
  return createPortal(
    <>
      <div className="film-progress" aria-hidden="true" style={{ width: `${st.progress * 100}%`, transitionDuration: `${st.holdMs || 250}ms` }} />
      <div className={`film-cursor ${st.pressed ? 'pressed' : ''}`} aria-hidden="true" style={{ transform: cur ? `translate(${cur.x}px, ${cur.y}px)` : undefined, opacity: cur ? 1 : 0 }}>
        <svg viewBox="0 0 22 22"><path d="M3 2 L3 17 L7.2 13.4 L10 20 L12.6 18.9 L9.9 12.4 L15.5 12.2 Z" fill="#fff" stroke="rgba(0,0,0,0.75)" strokeWidth="1.4" strokeLinejoin="round" /></svg>
      </div>
      {st.ripple && <div key={st.ripple.k} className="film-ripple" aria-hidden="true" style={{ left: st.ripple.x, top: st.ripple.y }} />}
      <aside className={`film-caption ${st.show ? 'show' : ''} ${st.end ? 'end' : ''}`} aria-live="polite">
        {st.title && <h2 className="film-title">{st.title}</h2>}
        {st.sub && <p className="film-sub">{st.sub}</p>}
      </aside>
    </>,
    document.body,
  )
}
