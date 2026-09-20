import { useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import NumberTicker from '../components/NumberTicker.jsx'
import { FILM, NATIONAL, DETECTOR, SOURCES } from '../demo/film.js'
import timing from '../demo/film.timing.json'
import '../styles/film.css'

// The film: runs demo/film.js as an overlay on whatever page the hash shows. It is not a page: the
// App mounts <Film /> at its root when the hash carries ?film=1 (or isFilm(hash) is true), and the
// component drives window.location.hash itself, shot by shot. It renders through a portal onto
// document.body: full-screen slides for the story cards, and otherwise a fake cursor, a click ripple,
// a caption plate and a progress line over the real app receiving real clicks (el.click()) and real
// input events. Each shot holds at least as long as its narration clip (demo/film.timing.json, from
// scripts/narrate.mjs) plus 600 ms, is then checked against its `expect`, and is followed by 400 ms
// of silence (a check that fails is retried for 2.5 s, for a page still loading). A slide cross-fades (420 ms) over the next app screen, which is loaded underneath first.
// In-app navigation drops the query, so a hashchange listener puts film=1 back with location.replace
// (which fires hashchange, so a gate on the hash keeps the component mounted).
// The recorder (web/scripts/film.mjs) calls window.__film.start() once its screencast is running
// (the film starts on its own after 1.5 s, for a QuickTime recording), reads window.__film.marks
// (each shot's narration start, epoch ms), window.__film.checks (each expect result, with the time
// it was taken) and window.__film.errors, and polls window.__film.done.
// StrictMode mounts effects twice in dev, so the run is a module-level singleton.
//
// ONE TRANSITION, used everywhere a screen is replaced: a dip through the page background. A slide
// fades to --bg over SLIDE_FADE; a route change at a shot boundary drops a --bg veil for VEIL_IN,
// swaps the hash behind it and lifts it over VEIL_OUT. A navigation the viewer watched the cursor
// cause is left as a cut: the click is the transition. Nothing here depends on hover, on a
// transition having finished, or on prefers-reduced-motion; every duration is well inside its shot.

const FLAG = /[?&]film=1(?:&|$)/
let armed = false
// True once any hash or search string has carried film=1; sticky for the life of the page.
// oxlint-disable-next-line react/only-export-components
export function isFilm(hash = window.location.hash) {
  if (!armed && (FLAG.test(hash) || FLAG.test(window.location.search))) armed = true
  return armed
}

const GAP_MS = 400, TAIL_MS = 600
const SLIDE_FADE = 420, CAPTION_OUT = 200   // the plate's 260 ms entry is CSS only
const VEIL_IN = 180, VEIL_OUT = 220
const CURSOR_SETTLE = 200, FOCUS_LEAD = 140, FOCUS_OUT = 420
const TITLE_CARD_MS = 2600, END_CARD_MS = 3200
const sleep = ms => new Promise(r => setTimeout(r, ms))
const stripFilm = h => h.replace(/([?&])film=1(&|$)/, (m, a, b) => (b ? a : '')).replace(/\?$/, '')
const withFilm = h => (FLAG.test(h) ? h : h.includes('?') ? `${h}&film=1` : `${h}?film=1`)
const sameRoute = (a, b) => stripFilm(a || '#/') === stripFilm(b || '#/')
const narrationMs = id => timing?.shots?.[id]?.durationMs || 0
// The recorder mixes audio from the CLIPS ON DISK while this bundle paces from the timing file
// COMPILED INTO IT. Rebuild after regenerating narration and the two disagree: every clip runs past
// the shot it belongs to and the voice bleeds into the next section. Expose what we compiled so
// scripts/film.mjs can refuse a take where they differ.
const NARRATION_BUILD = { backend: timing?.backend || timing?.voice || null, shots: Object.fromEntries(Object.entries(timing?.shots || {}).map(([k, v]) => [k, v?.durationMs || 0])) }

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

// The expect check: the selector exists, is on screen, contains every text, and has moved past notText.
function check(e) {
  if (!e) return { ok: true }
  const el = e.selector ? document.querySelector(e.selector) : document.body
  if (!el) return { ok: false, missing: `no element for ${e.selector}` }
  const r = el.getBoundingClientRect()
  if (!(r.width && r.height) || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return { ok: false, missing: `${e.selector} is not on screen` }
  const txt = (el.textContent || '').replace(/\s+/g, ' ')
  for (const t of [].concat(e.text || [])) if (!txt.includes(t)) return { ok: false, missing: `text "${t}" not in ${e.selector}` }
  if (e.notText != null && txt.trim() === e.notText) return { ok: false, missing: `${e.selector} still reads "${e.notText}"` }
  return { ok: true }
}

// One run for the page; every mounted Film instance subscribes to its state.
const BLANK = { shot: -1, slide: null, slideOn: false, title: null, sub: null, show: false, place: 'bl', cursor: null, cursorDur: 0, cursorOn: false, pressed: false, ripple: null, focus: null, veil: false, progress: 0, holdMs: 0 }
const run = { started: false, go: false, subs: new Set(), state: { ...BLANK } }
const subscribe = f => { run.subs.add(f); return () => run.subs.delete(f) }
const emit = patch => { run.state = { ...run.state, ...patch }; for (const f of run.subs) f() }
window.__film = { done: false, shot: -1, total: FILM.length, marks: [], checks: [], errors: [], narration: NARRATION_BUILD, start: () => { run.go = true } }

// ---- the cursor -------------------------------------------------------------------------------
// Travel time scales with distance (a nudge is quick, a cross-screen move is not), on a decelerating
// curve with no overshoot. The last 6% of the path is a separate, slower step, so the cursor arrives
// and settles instead of stopping dead. The first appearance is a fade-in at the target, never a
// streak in from off-screen.
let at = null
function travelMs(d) { return Math.round(Math.min(760, 280 + d * 0.42)) }
async function moveTo(el, settle = 700) {
  const c = centre(el)
  let spent = 0
  if (!at) {
    emit({ cursor: c, cursorDur: 0, cursorOn: false })
    await sleep(40)
    emit({ cursorOn: true })
    spent = 40
  } else {
    const d = Math.hypot(c.x - at.x, c.y - at.y)
    if (d > 2) {
      const t = travelMs(d)
      emit({ cursor: { x: at.x + (c.x - at.x) * 0.94, y: at.y + (c.y - at.y) * 0.94 }, cursorDur: t, cursorOn: true })
      await sleep(t)
      emit({ cursor: c, cursorDur: CURSOR_SETTLE })
      await sleep(CURSOR_SETTLE)
      spent = t + CURSOR_SETTLE
    }
  }
  at = c
  if (settle > spent) await sleep(settle - spent)
  return c
}
// The ring drawn on the element about to be clicked, so it is never ambiguous what was hit.
// Skipped for anything large enough that a ring around it says nothing.
function focusOn(el) {
  const r = el.getBoundingClientRect()
  if (r.width * r.height > innerWidth * innerHeight * 0.45) return false
  const rad = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0
  emit({ focus: { x: r.left, y: r.top, w: r.width, h: r.height, r: Math.min(rad, 18) } })
  return true
}

async function act(a) {
  if (a.type === 'wait') { await sleep(a.ms ?? 500); return }
  const el = await waitFor(a.selector, a.type === 'type' ? null : a.text)   // on type, text is what to type
  if (!el) { console.warn('[film] not found:', a.selector, a.text ?? ''); return }
  if (a.type === 'move') { await moveTo(el); return }
  if (a.type === 'scroll') {
    const sp = scrollParent(el)
    if (sp) { const top = el.getBoundingClientRect().top - sp.getBoundingClientRect().top + sp.scrollTop - 12; sp.scrollTo({ top: Math.max(0, top), behavior: 'smooth' }) } else el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    await sleep(750)
    at = null   // the page moved under the cursor; the next move is a fade-in, not a drift
    await moveTo(el, 500)
    return
  }
  if (a.type === 'click') {
    const c = await moveTo(el, 420)
    const ring = focusOn(el)
    await sleep(ring ? FOCUS_LEAD : 60)
    emit({ pressed: true, ripple: { ...c, k: Date.now() } })
    await sleep(90)
    el.click()
    emit({ pressed: false })
    setTimeout(() => emit({ focus: null }), FOCUS_OUT)
    await sleep(a.ms ?? 350)
    return
  }
  if (a.type === 'type') {
    const c = await moveTo(el, 420)
    focusOn(el)
    await sleep(FOCUS_LEAD)
    emit({ pressed: true, ripple: { ...c, k: Date.now() } })
    await sleep(90)
    emit({ pressed: false })
    el.focus()
    const text = a.text || ''
    for (let i = 1; i <= text.length; i++) { setNative(el, text.slice(0, i)); await sleep(70 + Math.random() * 60) }
    await sleep(600)
    const before = window.location.hash
    key(el, 'Enter', 'Enter', 13)
    emit({ focus: null })   // Enter may navigate: the ring must not outlive the field it framed
    await sleep(900)
    if (a.fallback && window.location.hash === before) { const fb = find(a.fallback); if (fb) { await moveTo(fb, 420); focusOn(fb); await sleep(FOCUS_LEAD); emit({ pressed: true, ripple: { ...centre(fb), k: Date.now() } }); await sleep(90); fb.click(); emit({ pressed: false }); setTimeout(() => emit({ focus: null }), FOCUS_OUT) } }
    await sleep(300)
  }
}

// A route change at a shot boundary dips through the page background rather than cutting mid-motion.
// Under a slide there is nothing to hide, so the veil is skipped.
async function goTo(s, veiled = true) {
  if (!s?.route) return
  if (!sameRoute(window.location.hash, s.route)) {
    const veil = veiled && !run.state.slide
    if (veil) { emit({ veil: true }); await sleep(VEIL_IN) }
    at = null
    emit({ cursor: null, cursorOn: false, focus: null })
    window.location.hash = withFilm(s.route)
    await sleep(150)
    if (s.waitFor) await waitFor(s.waitFor)
    if (veil) { emit({ veil: false }); await sleep(VEIL_OUT) }
    await sleep(120)
    return
  }
  if (s.waitFor) await waitFor(s.waitFor)
  await sleep(120)
}

// Where the caption plate sits: the corner that covers least of the element this shot is about.
// Measured from the shot's own `expect`/action selector, so a rewritten shot list still lands clear.
const CAP_W = 720, CAP_H = 210, CAP_M = 32
function placeFor(s) {
  const sel = s.expect?.selector || (s.actions || []).map(a => a.selector).find(Boolean)
  const el = sel ? document.querySelector(sel.split(',')[0].trim()) : null
  if (!el) return 'bl'
  const r = el.getBoundingClientRect()
  if (!(r.width && r.height)) return 'bl'
  const W = innerWidth, H = innerHeight, w = Math.min(CAP_W, W - CAP_M * 2)
  const boxes = { bl: [CAP_M, H - CAP_M - CAP_H], br: [W - CAP_M - w, H - CAP_M - CAP_H], tl: [CAP_M, CAP_M + 24], tr: [W - CAP_M - w, CAP_M + 24] }
  let best = 'bl', bv = Infinity
  for (const k of ['bl', 'br', 'tl', 'tr']) {
    const [x, y] = boxes[k]
    const ox = Math.max(0, Math.min(x + w, r.right) - Math.max(x, r.left))
    const oy = Math.max(0, Math.min(y + CAP_H, r.bottom) - Math.max(y, r.top))
    const v = ox * oy
    if (v < bv - 1) { bv = v; best = k }
  }
  return best
}

const isEndSlide = k => k === 'end' || k === '__end'

async function play() {
  document.body.dataset.film = '1'
  const keepFlag = () => { const h = window.location.hash; if (h && !FLAG.test(h)) window.location.replace(withFilm(h)) }
  window.addEventListener('hashchange', keepFlag)
  keepFlag()
  const n = FILM.length
  for (let w = 0; w < 15 && !run.go; w++) await sleep(100)   // the recorder's start(), or 1.5 s
  // Title card. Always ours, whatever the shot list opens with.
  emit({ slide: '__title', slideOn: false, show: false })
  await sleep(40)
  emit({ slideOn: true })
  await sleep(TITLE_CARD_MS)
  if (FILM[0]?.route) await goTo(FILM[0], false)
  emit({ slideOn: false })
  await sleep(SLIDE_FADE)
  emit({ slide: null })
  let loaded = FILM[0]?.route ? 0 : -1   // index of a shot whose route was loaded under a slide
  let last = null
  for (let i = 0; i < n; i++) {
    const s = FILM[i], next = FILM[i + 1]
    last = s
    window.__film.shot = i
    emit({ shot: i, progress: i / n, holdMs: 0 })
    if (loaded !== i) await goTo(s)
    const t0 = Date.now()
    window.__film.marks.push({ id: s.id, shot: i, t: t0 })
    if (s.slide) { at = null; emit({ slide: s.slide, slideOn: false, show: false, cursor: null, cursorOn: false, focus: null }); await sleep(40); emit({ slideOn: true }) }
    else if (s.title) emit({ slide: null, slideOn: false, focus: null, title: s.title, sub: s.sub, place: placeFor(s), show: true })
    else emit({ slide: null, slideOn: false, focus: null, show: false })
    for (const a of s.actions || []) await act(a)
    // The shot's subject may have moved (a click, a scroll): re-place the plate if it now covers it.
    if (!s.slide && s.title && (s.actions || []).length) {
      const p = placeFor(s)
      if (p !== run.state.place) { emit({ show: false }); await sleep(CAPTION_OUT); emit({ place: p, show: true }) }
    }
    const need = narrationMs(s.id) ? narrationMs(s.id) + TAIL_MS - (Date.now() - t0) : 0
    const hold = Math.max(s.holdMs || 0, need)
    emit({ progress: (i + 1) / n, holdMs: hold })
    await sleep(hold)
    let res = check(s.expect)
    for (let w = 0; !res.ok && w < 25; w++) { await sleep(100); res = check(s.expect) }   // a page still loading gets 2.5 s
    window.__film.checks.push({ id: s.id, shot: i, t: Date.now(), ok: res.ok, missing: res.missing || null })
    if (!res.ok) { window.__film.errors.push({ id: s.id, shot: i, missing: res.missing }); console.warn('[film] expect failed:', s.id, res.missing) }
    if (i === n - 1) break                                  // the last frame is held, never faded to the app
    if (s.slide) {
      if (next?.route) { await goTo(next, false); loaded = i + 1 }   // the next screen loads under the slide, then the slide cross-fades
      emit({ slideOn: false }); await sleep(SLIDE_FADE)
      emit({ slide: null })
    } else if (s.title) { emit({ show: false }); await sleep(CAPTION_OUT) }
    await sleep(GAP_MS)
  }
  // End card: the last shot's own, if it was one, else ours over the closing screen.
  if (last?.slide && isEndSlide(last.slide)) await sleep(1200)
  else {
    at = null
    emit({ show: false, cursor: null, cursorOn: false, focus: null, slide: '__end', slideOn: false })
    await sleep(40)
    emit({ slideOn: true })
    await sleep(END_CARD_MS)
  }
  emit({ progress: 1 })
  window.removeEventListener('hashchange', keepFlag)
  window.__film.done = true
}

// Slides. Motion is CSS only (opacity/translate under .show, per-element delays) plus NumberTicker.
const pct1 = v => `${v.toFixed(1)}%`
const rise = (d, cls = '') => ({ className: `rise ${cls}`, style: { transitionDelay: `${d}ms` } })
function Bar({ label, v19, v25, accent, delay }) {
  const max = 0.6
  return (
    <div className={`film-bar ${accent ? 'accent' : ''}`}>
      <div className="film-bar-head"><span>{label}</span><span className="film-bar-v"><small>{pct1(v19 * 100)} in 2019</small></span></div>
      <div className="film-bar-track"><i className="fill" style={{ '--w': `${(v25 / max) * 100}%`, transitionDelay: `${delay}ms` }} /><i className="tick" style={{ left: `${(v19 / max) * 100}%` }} /></div>
    </div>
  )
}
// Two national numbers: shown at their 2019 values, then ticked to 2025 once the slide is on.
function NightSlide({ on }) {
  const [to25, setTo25] = useState(false)
  useEffect(() => { if (!on) return; const id = setTimeout(() => setTo25(true), 900); return () => clearTimeout(id) }, [on])
  const y = to25 ? 2025 : 2019
  return (
    <div className="film-slide-body wide">
      <p {...rise(0, 'film-eyebrow')}>Clean share of US generation, 2019 to 2025</p>
      <h2 {...rise(80, 'film-h')}>Since 2019 the grid cleaned up by day and stood still at night.</h2>
      <div {...rise(200, 'film-bignums')}>
        <div className="film-bignum day"><div className="v"><NumberTicker value={NATIONAL.day[y] * 100} format={n => pct1(n)} duration={1400} /></div><div className="l">clean by day, {y}</div></div>
        <div className="film-bignum night"><div className="v"><NumberTicker value={NATIONAL.night[y] * 100} format={n => pct1(n)} duration={1400} /></div><div className="l">clean at night, {y}</div></div>
      </div>
      <div {...rise(300, 'film-bars')}>
        <Bar label="By day, 10:00 to 15:59" v19={NATIONAL.day[2019]} v25={NATIONAL.day[2025]} delay={900} />
        <Bar label="At night, 00:00 to 05:59" v19={NATIONAL.night[2019]} v25={NATIONAL.night[2025]} accent delay={900} />
      </div>
      <p {...rise(420, 'film-foot')}>Half of a flat load lands in the hours that did not improve.</p>
    </div>
  )
}
function EndCard({ credit }) {
  return (
    <div className="film-slide-body">
      <div {...rise(0, 'film-wordmark')}>Wattson</div>
      <p {...rise(250, 'film-tagline')}>It follows the power, not the press release.</p>
      {credit && <p {...rise(900, 'film-credit')}>Built at HackMIT 2026 on PUDL EIA-930 data</p>}
    </div>
  )
}
// An unknown slide id (the shot list is edited independently) must never blank the frame: it falls
// back to the shot's own title and sub, and to the wordmark if it has neither.
function Slide({ kind, on, title, sub }) {
  if (kind === '__title') return <EndCard credit={false} />
  if (kind === '__end' || kind === 'end') return <EndCard credit />
  if (kind === 'flat') return (
    <div className="film-slide-body wide">
      <p {...rise(0, 'film-eyebrow')}>The problem</p>
      <h2 {...rise(80, 'film-h')}>AI datacenters draw the same power at 3am as at noon.</h2>
      <div {...rise(200, 'film-strip-wrap')}>
        <div className="film-strip" aria-label="A flat 24/7 load, every hour the same">{Array.from({ length: 24 }, (_, h) => <i key={h} className={h < 6 ? 'night' : ''} style={{ transitionDelay: `${350 + h * 45}ms` }} />)}</div>
        <div className="film-strip-axis"><span>midnight</span><span>6am</span><span>noon</span><span>6pm</span><span>midnight</span></div>
      </div>
      <p {...rise(320, 'film-foot')}>A flat 24/7 load: every hour the same, all night and all day.</p>
    </div>
  )
  if (kind === 'night') return <NightSlide on={on} />
  if (kind === 'two') return (
    <div className="film-slide-body wide">
      <p {...rise(0, 'film-eyebrow')}>The answer</p>
      <h2 {...rise(80, 'film-h')}>Wattson answers two questions.</h2>
      <ol className="film-qs">
        <li {...rise(700)}><b>1</b><span>What is really powering a company&apos;s sites?</span></li>
        <li {...rise(1500)}><b>2</b><span>Where should new load go?</span></li>
      </ol>
      <p {...rise(2100, 'film-foot')}>Hourly generation for every US grid, EIA-930 via PUDL.</p>
    </div>
  )
  if (kind === 'found') return (
    <div className="film-slide-body wide">
      <p {...rise(0, 'film-eyebrow')}>What we found</p>
      <h2 {...rise(80, 'film-h')}><span className="film-count"><NumberTicker value={on ? DETECTOR.scored : 0} format={n => String(Math.round(n))} duration={1200} /></span> regions scored from demand alone.</h2>
      <div className="film-cols">
        <div {...rise(500)}>
          <div className="film-col-h">Named before the ranking was seen</div>
          <ul className="film-list">{DETECTOR.named.map(([name, rank]) => <li key={name}><span>{name}</span><b>#{rank}</b></li>)}</ul>
        </div>
        <div {...rise(1000)}>
          <div className="film-col-h">New leads, not known datacenter clusters</div>
          <div className="film-chips">{DETECTOR.leads.map(([name, rank]) => <span key={name} className="film-chip">{name} <b>#{rank}</b></span>)}</div>
        </div>
      </div>
      <p {...rise(1400, 'film-foot')}>Method frozen before results. The Dallas miss, #91, is reported as is.</p>
    </div>
  )
  if (kind === 'sources') return (
    <div className="film-slide-body wide">
      <p {...rise(0, 'film-eyebrow')}>How to read it</p>
      <h2 {...rise(80, 'film-h')}>Every number cites its source.</h2>
      <div className="film-chips big">{SOURCES.map((s, i) => <span key={s} {...rise(400 + i * 160, 'film-chip')}>{s}</span>)}</div>
      <p {...rise(1500, 'film-foot')}>Grid-only. Average mix, not marginal. Contracted power excluded.</p>
    </div>
  )
  if (title) return (
    <div className="film-slide-body wide">
      <h2 {...rise(0, 'film-h')}>{title}</h2>
      {sub && <p {...rise(160, 'film-foot')}>{sub}</p>}
    </div>
  )
  return <EndCard credit={false} />
}

export default function Film() {
  const st = useSyncExternalStore(subscribe, () => run.state)
  useEffect(() => {
    if (!run.started) { run.started = true; play().catch(e => { console.error('[film]', e); window.__film.done = true }) }
  }, [])
  const cur = st.cursor
  const onSlide = !!st.slide
  const f = st.focus
  return createPortal(
    <>
      <div className="film-progress" aria-hidden="true"><i style={{ width: `${st.progress * 100}%`, transitionDuration: `${st.holdMs || 250}ms` }} /></div>
      <div className={`film-veil ${st.veil ? 'on' : ''}`} aria-hidden="true" />
      <div className={`film-slide ${onSlide && st.slideOn ? 'show' : ''}`} aria-hidden={!onSlide}>{onSlide && <Slide kind={st.slide} on={st.slideOn} title={st.title} sub={st.sub} />}</div>
      {f && !onSlide && <div className="film-focus" aria-hidden="true" style={{ left: f.x, top: f.y, width: f.w, height: f.h, borderRadius: f.r + 3 }} />}
      <div className={`film-cursor ${st.pressed ? 'pressed' : ''}`} aria-hidden="true" style={{ transform: cur ? `translate(${cur.x}px, ${cur.y}px)` : undefined, transitionDuration: `${st.cursorDur}ms, 220ms`, opacity: cur && st.cursorOn && !onSlide ? 1 : 0 }}>
        <svg viewBox="0 0 22 22"><path d="M3 2 L3 17 L7.2 13.4 L10 20 L12.6 18.9 L9.9 12.4 L15.5 12.2 Z" fill="#fff" stroke="rgba(0,0,0,0.75)" strokeWidth="1.4" strokeLinejoin="round" /></svg>
      </div>
      {st.ripple && !onSlide && <div key={st.ripple.k} className="film-ripple" aria-hidden="true" style={{ left: st.ripple.x, top: st.ripple.y }} />}
      <aside className={`film-caption ${!onSlide && st.show && st.title ? 'show' : ''}`} data-place={st.place} aria-live="polite">
        {st.title && <h2 className="film-title">{st.title}</h2>}
        {st.sub && <p className="film-sub">{st.sub}</p>}
      </aside>
    </>,
    document.body,
  )
}
