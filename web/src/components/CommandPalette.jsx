import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Command } from 'cmdk'
import { askItem, matchGroups, useCommands, openPalette, toggleView, GROUP } from '../lib/commands.js'
import { parseQuery, resolvePlace, DEMO_COMPARE } from '../lib/query.js'
import { askAvailable, summarize } from '../lib/ask.js'
import { renderable, runAsk as runAskServer } from '../lib/askStore.js'
import { pageContext } from '../lib/pageContext.js'
import { accept, completion, suggestions, SUMMARIZE } from '../lib/suggest.js'
import { SHORTCUTS, openShortcuts } from './Shortcuts.jsx'
import { href } from '../router.js'
import '../styles/palette.css'

// The command palette: the app's front door. <CommandPalette /> is the dialog, ⌘K / Ctrl+K
// toggles it, "/" opens it when nothing is focused for typing, Esc dismisses then clears then
// closes, and window 'wattson:palette' events (openPalette() in lib/commands.js) open it from
// anywhere. Mount it as many times as is convenient: only the earliest-mounted living instance
// renders and binds the hotkeys. <CommandInline /> is the same list under a plain input, for the
// landing page.
//
// Everything below the input is shared between the two frames: grouped results with a section
// label and a count, the best match preselected, the typed substring marked in every row, a
// footer that names what ↵ will do to the row you are on, a preview of a composed compare query
// before you run it, and an empty state that offers four ways out instead of "nothing found".
//
// THE ASK LAYER (lib/ask.js, lib/askStore.js) is an enhancement layered on top of all of that,
// never a dependency. askAvailable() resolves false whenever no API base is configured, which is
// how the static export runs, and in that case every line below behaves exactly as it does
// without it: no ask bar, no ghost completion, no suggestions, no answer panel, no error, and the
// deterministic empty state owns an unreadable query.
//
// When the ask layer IS up it brings three things: prewritten prompts for this screen (grey ghost
// tail under the caret, Tab to accept, and the same prompts as real rows in the list), an answer
// that renders in place when it is a sentence, and a hand-off to #/ask when the answer has a shape
//, a table, a ranking, places side by side, because a table does not belong in a dropdown.

// oxlint-disable-next-line react/only-export-components
export { useCommands } from '../lib/commands.js'

const typing = e => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || !!e.target?.isContentEditable

// One dialog per page. Instances register in mount order; the first living one is the host.
const hosts = new Set(), subs = new Set()
const ping = () => { for (const f of subs) f() }
function useHost() {
  const [id] = useState(() => ({}))
  const [isHost, setIsHost] = useState(false)
  useEffect(() => {
    const f = () => setIsHost(hosts.values().next().value === id)
    hosts.add(id); subs.add(f); ping()
    return () => { hosts.delete(id); subs.delete(f); ping() }
  }, [id])
  return isHost
}

/* ---- the Keyboard group ------------------------------------------------------------------
   Built from the one table in Shortcuts.jsx, so every key the app binds is reachable from the
   palette. Rows that can also be clicked carry an `act`; the rest are listed and skipped by the
   arrow keys rather than pretending to be buttons. */

const press = key => () => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
const ACTS = { palette: () => openPalette(true), sheet: () => openShortcuts(true), insight: press('i'), demo: () => toggleView('demo'), tour: press('t') }
const KEY_WORDS = ['key', 'keys', 'keyboard', 'shortcut', 'shortcuts', 'hotkey', 'press']

const keyboardGroup = () => ({
  id: 'keys',
  label: 'Keyboard',
  items: SHORTCUTS.flatMap(g => g.rows.map((r, i) => ({
    id: `key:${g.id}:${i}`,
    group: 'Keyboard',
    label: r.label,
    hint: r.keys.join(r.sep ? ` ${r.sep} ` : ' '),
    mono: true,
    sub: r.where || null,
    keys: r.keys,
    sep: r.sep,
    keywords: [...KEY_WORDS, ...r.keys, g.title, r.where || ''].filter(Boolean),
    action: r.act ? ACTS[r.act] : undefined,
    doing: r.act ? 'run it' : null,
    static: !r.act,
  }))),
})

/* ---- matched-substring marking ---------------------------------------------------------- */

// Mark every place the query (whole, then token by token) occurs in `text`. Case-insensitive,
// overlapping hits merged, so "n virginia" marks both halves of "N. Virginia" once each.
function marks(text, query) {
  const q = String(query || '').trim()
  if (!q || !text) return null
  // A long composed query ("300 MW: Phoenix vs Omaha") marked token by token leaves a row that is
  // more marked than not, which stops being a hint; past three words only the whole phrase marks.
  const words = q.split(/\s+/).filter(Boolean)
  const toks = [...new Set(words.length > 3 ? [q] : [q, ...words])].map(t => t.toLowerCase()).filter(t => t.length >= 2).sort((a, b) => b.length - a.length)
  if (!toks.length) return null
  const lower = String(text).toLowerCase()
  const hit = new Array(text.length).fill(false)
  let any = false
  for (const t of toks) {
    for (let i = lower.indexOf(t); i !== -1; i = lower.indexOf(t, i + t.length)) {
      any = true
      for (let k = i; k < i + t.length; k++) hit[k] = true
    }
  }
  if (!any) return null
  const out = []
  let start = 0
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || hit[i] !== hit[start]) { out.push({ on: hit[start], s: text.slice(start, i) }); start = i }
  }
  return out
}

function Marked({ text, query }) {
  const parts = useMemo(() => marks(text, query), [text, query])
  if (!parts) return text
  return parts.map((p, i) => (p.on ? <mark key={i} className="pal-mark">{p.s}</mark> : <span key={i}>{p.s}</span>))
}

/* ---- what ↵ will do --------------------------------------------------------------------- */

const DOING = [
  [/^check:/, 'open the company check'],
  [/^compare:/, 'run the comparison'],
  [/^metro:/, 'compare 300 MW here'],
  [/^region:/, 'open the region'],
  [/^found:/, 'open the finding'],
  [/^method$/, 'open the method'],
  [/^screen:/, 'open the screener'],
  [/^toggle:/, 'toggle it'],
  [/^sug-/, 'ask the data'],
  [/^ask$/, 'run this query'],
]
const doingOf = it => it?.doing || (it ? (DOING.find(([re]) => re.test(it.id))?.[1] || 'open it') : null)

// Group headings, said as the thing they do rather than as a category. A row in "Regions" did
// not tell you what pressing it would do; a row under "Open a region" does, and it does it for
// every row in the group at once, without a verb on each line. Display only, lib/commands.js
// keeps its own GROUP names, which are what the items are tagged with.
const HEADING = {
  [GROUP.company]: 'Check a company',
  [GROUP.compare]: 'Run a comparison',
  [GROUP.places]: 'Compare 300 MW at a place',
  [GROUP.regions]: 'Open a region',
  [GROUP.found]: 'Open a finding',
  [GROUP.screen]: 'Open the screener',
  [GROUP.view]: 'Toggle a view',
}
const headingOf = g => HEADING[g.label] || g.label

/* ---- the empty state -------------------------------------------------------------------- */

// Four concrete ways on, as real rows: the arrow keys reach them and ↵ runs them.
const TRY = [
  { id: 'try:googl', group: 'Try', label: 'Check Google', hint: 'a company claim against its grids', href: href.check('GOOGL') },
  { id: 'try:compare', group: 'Try', label: `${DEMO_COMPARE.mw} MW: ${DEMO_COMPARE.metros.join(' vs ')}`, hint: 'where 300 MW would run cleanest', href: href.compare(DEMO_COMPARE) },
  { id: 'try:found', group: 'Try', label: 'What we found in the grid data', hint: 'the finding, in four scenes', href: href.found() },
  { id: 'try:screen', group: 'Try', label: 'Screen all 111 regions', hint: 'rank by what is rising', href: href.screen('rising') },
]
const tryGroup = { id: 'try', label: 'Try one of these', items: TRY, total: TRY.length }

/* ---- the compare preview ---------------------------------------------------------------- */

// A composed query ("300 MW: Phoenix vs Omaha") says what it resolved to before you press ↵:
// the load, the places as the app knows them, and anything it could not place.
function usePreview(q) {
  return useMemo(() => {
    const text = String(q || '').trim()
    if (!text || !/\d\s*(mw|gw|megawatt)|\bvs\.?\b|\bversus\b/i.test(text)) return null
    const r = parseQuery(text)
    if (r.kind !== 'compare') return null
    const places = r.metros.map(m => { const p = resolvePlace(m); return { name: m, utility: p?.serving_utility || null, id: p?.region_id || null } })
    return { mw: r.mw, places, unknown: r.unknown || [] }
  }, [q])
}

function Preview({ preview }) {
  if (!preview) return null
  return (
    <div className="pal-preview" aria-live="polite">
      <span className="pal-preview-k">Will run</span>
      <div className="pal-preview-b">
        <p className="pal-preview-t">
          Compare <b>{preview.mw.toLocaleString()} MW</b> of flat load across {preview.places.length} place{preview.places.length === 1 ? '' : 's'}
        </p>
        <ul className="pal-preview-list">
          {preview.places.map(p => (
            <li key={p.name}><span className="pal-preview-n">{p.name}</span>{p.utility && <span className="pal-preview-u">{p.utility}</span>}</li>
          ))}
        </ul>
        {!!preview.unknown.length && <p className="pal-preview-x">Not a place we have mapped: {preview.unknown.join(', ')}</p>}
      </div>
    </div>
  )
}

/* ---- the list --------------------------------------------------------------------------- */

// cmdk root with shouldFilter=false: lib/commands.js does the matching, so each group is capped
// and the free-text "Ask" fallback is offered only when nothing matches (or the query is composed).
function Palette({ groups, loading, limit, emptyLimit, autoFocus, placeholder, onDone, footer, className = '', onEscape, modal = false }) {
  const [q, setQ] = useState('')
  const [value, setValue] = useState('')
  const inputRef = useRef(null)
  const all = useMemo(() => [...groups, keyboardGroup()], [groups])
  const shown = useMemo(() => matchGroups(all, q, { limit, emptyLimit }), [all, q, limit, emptyLimit])
  const ask = useMemo(() => askItem(q), [q])
  const preview = usePreview(q)
  const hasQuery = q.trim().length > 0

  // ---- the ask layer -----------------------------------------------------------------------
  // Optional. askAvailable() is cached at module level and resolves false with no API base, so
  // with no server this is one settled `false` and nothing below it ever renders.
  const [aiOn, setAiOn] = useState(false)
  const [answer, setAnswer] = useState(null)   // { state: 'loading'|'done'|'error', asked, q, text, tools }
  useEffect(() => { let alive = true; askAvailable().then(v => { if (alive) setAiOn(v) }); return () => { alive = false } }, [])
  // An answer belongs to the box it was asked from; the next keystroke retires it rather than
  // leaving a stale answer sitting under a new question.
  useEffect(() => { setAnswer(a => (a && a.asked !== q ? null : a)) }, [q])

  // Two different things share one input. "Summarize this screen" is prose about the screen you
  // are on, and it stays in the dropdown over that screen. A free-text question can come back
  // with a shape, places side by side, a ranking, one subject and its figures, and a table does
  // not belong in a dropdown, so that goes to #/ask, which reads the answer the store is already
  // holding rather than asking again. An answer that is genuinely a sentence renders here exactly
  // as it always did.
  const runAsk = async (question, kind = 'ask') => {
    const asked = q
    setAnswer({ state: 'loading', asked, q: question })
    try {
      const ctx = pageContext()
      if (kind === 'summary') {
        const r = await summarize(ctx)
        setAnswer({ state: 'done', asked, q: question, text: r.answer || '', tools: r.tools_used || [] })
        return
      }
      const r = await runAskServer(question, ctx)
      if (r.state === 'error') { setAnswer({ state: 'error', asked, q: question, text: r.error }); return }
      if (renderable(r.view)) {
        setAnswer(null); setQ('')
        onDone?.()
        window.location.assign(href.ask(question))
        return
      }
      setAnswer({ state: 'done', asked, q: question, text: r.answer || '', tools: r.tools || [] })
    } catch (e) {
      setAnswer({ state: 'error', asked, q: question, text: String(e.message || e) })
    }
  }

  // ---- prewritten prompts ------------------------------------------------------------------
  // Ranked for whatever screen this is, and recomputed on navigation, because the useful question
  // on a company page is not the useful question on the landing page.
  const [sugg, setSugg] = useState(() => suggestions(pageContext()))
  useEffect(() => {
    const f = () => setSugg(suggestions(pageContext()))
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  // The grey tail under the caret. '' whenever more than one prompt still matches, so we never
  // put a question under the caret that Tab would not actually run.
  const ghost = useMemo(() => (aiOn ? completion(q, sugg) : ''), [aiOn, q, sugg])
  // The same prompts ride in the list as a normal group, so the arrow keys and ↵ that already
  // work for commands work for them too. Capped, and only the ones that still match.
  const suggGroup = useMemo(() => {
    if (!aiOn) return null
    const b = q.trim().toLowerCase()
    const hits = sugg.filter(t => !b || t.toLowerCase().startsWith(b))
    if (!hits.length) return null
    return { id: 'suggest', label: 'Ask the data', total: hits.length,
             items: hits.slice(0, 4).map((t, i) => ({ id: `sug-${i}`, group: 'Ask the data', label: t, hint: 'ask', doing: 'ask the data',
               action: () => runAsk(t, t === SUMMARIZE ? 'summary' : 'ask') })) }
  }, [aiOn, q, sugg]) // eslint-disable-line react-hooks/exhaustive-deps

  // The ask layer and the empty state are two answers to the same moment, a query the parser
  // cannot read, so exactly one of them owns it, and which one is decided here.
  //
  // With a server configured the ask layer wins: that query is no longer a dead end, and saying
  // "nothing matches" while a model is standing by to answer it would be false. The Ask row stops
  // being inert, becomes the pinned best match, and ↵ sends it. With no server the empty state
  // owns it exactly as before, the Ask row stays disabled and the Try group carries the way on.
  // The Try group also returns underneath a failed answer, so a dead ask is never a dead end.
  const canAsk = aiOn && hasQuery

  // `partial` items parsed, but only by discarding most of what was typed ("compare ERCOT, PJM and
  // CAISO on clean power at night" keeps PJM and throws the question away). With the ask layer up
  // those are questions, not commands; with no ask layer they keep their deterministic route.
  const askRow = useMemo(() => {
    if (!ask) return null
    if (!canAsk || !(ask.unknown || ask.partial)) return ask
    return { ...ask, unknown: false, partial: false, askable: true, hint: 'answered from the grid data', mono: false, doing: 'ask the data' }
  }, [ask, canAsk])

  const showTry = !shown.length && (!canAsk || answer?.state === 'error')

  const list = useMemo(() => {
    const base = suggGroup ? [...shown, suggGroup] : shown
    if (!askRow) return base
    const askGroup = { id: 'ask', label: GROUP.ask, items: [askRow], total: 1 }
    const tail = suggGroup ? [suggGroup] : []
    if (!shown.length) return showTry ? [askGroup, ...tail, tryGroup] : [askGroup, ...tail]
    if (askRow.href && askRow.composed) return [askGroup, ...base]
    return base
  }, [askRow, shown, showTry, suggGroup])

  // The best match is the first row of the first group; keep the selection pinned there whenever
  // the result set changes, so ↵ straight after typing always runs the obvious thing.
  const firstId = list.find(g => g.items.some(i => !i.static))?.items.find(i => !i.static)?.id || ''
  const ids = useMemo(() => list.flatMap(g => g.items.map(i => i.id)), [list])
  useEffect(() => { setValue(v => (v && ids.includes(v) ? v : firstId)) }, [ids, firstId])

  const flat = useMemo(() => Object.fromEntries(list.flatMap(g => g.items.map(i => [i.id, i]))), [list])
  const current = flat[value] || null

  // A row that is really a question: the free-text Ask row the parser could not route, and a
  // partial parse while the ask layer is up.
  const toAsk = it => !!it?.askable || !!it?.unknown || (!!it?.partial && aiOn)

  // An askable row sends the query to the server and stays put: a sentence renders in place, so
  // the box keeps its text and the dialog does not close under the reader. An answer with a shape
  // opens at #/ask instead.
  const run = it => {
    if (!it || it.static) return
    if (toAsk(it)) { if (aiOn) runAsk(q); return }
    if (it.action) it.action(); else if (it.href) window.location.assign(it.href)
    setQ('')
    onDone?.()
  }

  // Tab completes the highlighted row into the box, so a long region name can be narrowed by hand
  // before running it. On a row that is already typed out in full, Tab runs it.
  //
  // This only holds inside the ⌘K dialog, which is modal and where Tab has nowhere else to go.
  // The inline box on the landing is not modal: it sits above the example chips and the rest of
  // the page, so Tab there has to move focus on like any other field. Swallowing it would strand
  // a keyboard user on the app's front door.
  const complete = () => {
    const it = current
    if (!it || it.static) return false
    const text = it.id === 'ask' ? q : String(it.label)
    if (text.trim().toLowerCase() === q.trim().toLowerCase()) run(it)
    else { setQ(text); requestAnimationFrame(() => inputRef.current?.focus()) }
    return true
  }

  const onKeyDown = e => {
    if (e.key === 'Tab') {
      // A ghost tail is showing and the box says "tab": that promise is kept in both frames.
      // With no ghost, Tab is the dialog's completion key and the inline box's way out, as before.
      if (!e.shiftKey && ghost) {
        const full = accept(q, sugg)
        if (full && full !== q.trim()) {
          e.preventDefault()
          setQ(full)
          requestAnimationFrame(() => inputRef.current?.focus())
          return
        }
      }
      if (!modal) return                                                            // let focus leave the box
      e.preventDefault()
      if (e.shiftKey || !complete()) inputRef.current?.focus()                      // the dialog's one tab stop
      return
    }
    if (e.key !== 'Escape') return
    // dismiss the answer, then clear the box, then close: one step back per press
    if (answer) { e.preventDefault(); e.stopPropagation(); setAnswer(null) }
    else if (hasQuery) { e.preventDefault(); e.stopPropagation(); setQ('') }
    else if (onEscape) { e.preventDefault(); e.stopPropagation(); onEscape() }
  }

  const showList = hasQuery || emptyLimit > 0
  // the deterministic empty state, suppressed wherever the ask layer has taken the moment over
  // Only a genuine dead end. A query the parser could not match as a whole but resolved by
  // scanning it for a known name, "whats the outlook on IREN", has a route and must not be
  // told it matched nothing.
  const nothing = hasQuery && !shown.length && !canAsk && !!ask?.unknown
  return (
    <Command shouldFilter={false} loop label="Wattson commands" className={`pal ${className}`} value={value} onValueChange={setValue} onKeyDown={onKeyDown}>
      <div className="pal-inputwrap">
        {/* The completion is drawn behind the input: the typed half is transparent so the
            grey tail lands exactly under the caret, and the layer never takes a click. */}
        {!!ghost && <div className="pal-ghost" aria-hidden="true"><span className="pal-ghost-typed">{q}</span><span className="pal-ghost-rest">{ghost}</span></div>}
        <Command.Input ref={inputRef} className="pal-input" value={q} onValueChange={setQ} placeholder={placeholder} autoFocus={autoFocus} autoComplete="off" spellCheck={false} aria-label={placeholder} />
        {!!ghost && <span className="pal-tab" aria-hidden="true">tab</span>}
      </div>
      {/* the ask bar waits for the list, so the landing box keeps its resting shape until you type */}
      {aiOn && showList && (
        <div className="pal-askbar">
          {canAsk && <button type="button" className="pal-askbtn" onClick={() => runAsk(q)}>Ask: {q.trim()}</button>}
          <button type="button" className="pal-askbtn" onClick={() => runAsk(SUMMARIZE, 'summary')}>{SUMMARIZE}</button>
        </div>
      )}
      {answer && (
        <div className={`pal-answer ${answer.state}`} aria-live="polite">
          {answer.state === 'loading' && <p className="pal-answer-note">Reading the data…</p>}
          {answer.state === 'error' && <p className="pal-answer-note">The ask layer is unavailable. Everything else still works.</p>}
          {answer.state === 'done' && <>
            <p className="pal-answer-t">{answer.text}</p>
            {!!answer.tools?.length && <p className="pal-answer-tools">from {answer.tools.map(t => t.tool).join(', ')}</p>}
          </>}
        </div>
      )}
      {/* one strip at a time between the box and the list */}
      {!answer && <Preview preview={preview} />}
      {showList && (
        <Command.List className="pal-list">
          {nothing && (
            <div className="pal-none">
              <p className="pal-none-t">Nothing matches “{q.trim()}”.</p>
              <p className="pal-none-h">{ask?.unknown ? ask.hint : 'Companies, metros, the 111 regions and every view are all searchable from here.'}</p>
            </div>
          )}
          {list.map(g => (
            <Command.Group key={g.id} className="pal-group" heading={<span className="pal-heading"><span>{headingOf(g)}</span>{g.total > g.items.length && <span className="pal-count">{g.items.length} of {g.total}</span>}</span>}>
              {g.items.map(it => (
                /* A question the deterministic parser cannot route is still answerable: with the
                   ask layer up, ↵ sends it to the model. Only with no ask layer is it a dead row. */
                <Command.Item key={it.id} value={it.id} className={`pal-item${it.unknown ? ' unknown' : ''}${it.static ? ' static' : ''}${it.id === 'ask' ? ' ask' : ''}`} disabled={(!!it.unknown && !aiOn) || !!it.static} onSelect={() => run(it)}>
                  <span className="pal-label">
                    {it.id === 'ask' ? it.label : <Marked text={it.label} query={q} />}
                    {it.sub && <span className="pal-sub">{it.sub}</span>}
                  </span>
                  {it.hint && (it.keys
                    ? <span className="pal-keys">{it.keys.map((k, j) => <span key={j}>{j > 0 && <i className="pal-keysep">{it.sep || ''}</i>}<kbd>{k}</kbd></span>)}</span>
                    : <span className={`pal-hint${it.mono ? ' mono' : ''}`}>{toAsk(it) && aiOn ? 'ask the data' : <Marked text={it.hint} query={q} />}</span>)}
                  {(!it.unknown || aiOn) && !it.static && <span className="pal-go" aria-hidden="true">↵</span>}
                </Command.Item>
              ))}
            </Command.Group>
          ))}
          {loading && hasQuery && <div className="pal-note">Regions are still loading; they will appear here.</div>}
        </Command.List>
      )}
      {footer && showList && (
        <div className="pal-foot">
          <span className="pal-foot-do">{current && !current.static ? <><kbd>↵</kbd>{doingOf(current)}</> : <><kbd>↵</kbd>run the highlighted row</>}</span>
          <span className="pal-foot-keys">
            <span><kbd>↑</kbd><kbd>↓</kbd>move</span>
            {ghost ? <span><kbd>tab</kbd>complete the question</span> : modal && <span><kbd>tab</kbd>complete</span>}
            <span><kbd>esc</kbd>{answer ? 'dismiss' : hasQuery ? 'clear' : emptyLimit > 0 ? 'close' : 'clear'}</span>
          </span>
        </div>
      )}
    </Command>
  )
}

export function CommandPalette({ open: openProp, onOpenChange, limit = 6, emptyLimit = 5, placeholder = 'Search a company, a place, a region, or ask…' }) {
  const host = useHost()
  const controlled = openProp != null
  const [openState, setOpenState] = useState(false)
  const open = controlled ? !!openProp : openState
  // Refs are written in effects and read only from handlers, so the hotkey listener binds once.
  const openRef = useRef(false), changeRef = useRef(null)
  useEffect(() => { openRef.current = open }, [open])
  useEffect(() => { changeRef.current = onOpenChange })
  const setOpen = useCallback(v => { if (!controlled) setOpenState(v); changeRef.current?.(v) }, [controlled])
  const { groups, loading } = useCommands()

  useEffect(() => {
    if (!host) return
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(!openRef.current); return }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !openRef.current && !typing(e)) { e.preventDefault(); setOpen(true); return }
      // Escape inside the panel is the panel's own: it dismisses the answer, then clears the box,
      // and closes on the last press by calling back into setOpen. Escape anywhere else closes
      // straight away.
      if (e.key === 'Escape' && openRef.current) {
        if (e.target?.closest?.('.pal-panel')) return
        e.preventDefault(); e.stopPropagation(); setOpen(false)
      }
    }
    const onEvt = e => setOpen(e.detail?.open ?? true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('wattson:palette', onEvt)
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('wattson:palette', onEvt) }
  }, [host, setOpen])

  // Give focus back to wherever it was when the dialog closes.
  const prevFocus = useRef(null)
  useEffect(() => {
    if (!open) return
    prevFocus.current = document.activeElement
    return () => { const el = prevFocus.current; if (el && typeof el.focus === 'function' && document.contains(el)) el.focus() }
  }, [open])

  if (!host || !open) return null
  return createPortal(
    <div className="pal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}>
      <div className="pal-panel" role="dialog" aria-modal="true" aria-label="Command palette">
        <Palette groups={groups} loading={loading} limit={limit} emptyLimit={emptyLimit} autoFocus placeholder={placeholder} onDone={() => setOpen(false)} onEscape={() => setOpen(false)} footer modal />
      </div>
    </div>,
    document.body,
  )
}

// Inline: nothing under the input until the user has typed at least one character. The ⌘K badge
// sits in the input row and steps aside as soon as the box has focus.
export function CommandInline({ autoFocus = false, placeholder = 'Try: Google  ·  or  300 MW: Phoenix vs Omaha', limit = 5, className = '' }) {
  const { groups, loading } = useCommands()
  return (
    <div className={`pal-inline ${className}`}>
      <kbd className="pal-inline-k" aria-hidden="true">⌘K</kbd>
      <Palette groups={groups} loading={loading} limit={limit} emptyLimit={0} autoFocus={autoFocus} placeholder={placeholder} footer />
    </div>
  )
}
