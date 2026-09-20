import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Command } from 'cmdk'
import { askItem, matchGroups, useCommands } from '../lib/commands.js'
import { askAvailable, summarize } from '../lib/ask.js'
import { renderable, runAsk as runAskServer } from '../lib/askStore.js'
import { pageContext } from '../lib/pageContext.js'
import { accept, completion, suggestions, SUMMARIZE } from '../lib/suggest.js'
import { href } from '../router.js'
import '../styles/palette.css'

// The command palette. <CommandPalette /> is the dialog: ⌘K / Ctrl+K toggles it, "/" opens it
// when nothing is focused for typing, Esc closes it, and window 'wattson:palette' events
// (openPalette() in lib/commands.js) open it from anywhere. Mount it as many times as is
// convenient: only the earliest-mounted living instance renders and binds the hotkeys.
// <CommandInline /> is the same list under a plain input, for the landing page.

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

// The list itself: cmdk root, our own matching (shouldFilter=false) so each group is capped and
// the free-text "Ask" fallback is offered only when nothing matches (or the query is composed).
function Palette({ groups, loading, limit, emptyLimit, autoFocus, placeholder, onDone, footer, className = '' }) {
  const [q, setQ] = useState('')
  const shown = useMemo(() => matchGroups(groups, q, { limit, emptyLimit }), [groups, q, limit, emptyLimit])
  const ask = useMemo(() => askItem(q), [q])
  // The ask layer answers what the deterministic parser cannot. It is optional: when no
  // server is configured the palette behaves exactly as before.
  const [aiOn, setAiOn] = useState(false)
  const [answer, setAnswer] = useState(null)   // {state:'loading'|'done'|'error', text, tools}
  useEffect(() => { askAvailable().then(setAiOn) }, [])
  // Prewritten prompts for whatever screen this is. Recomputed on navigation, because the
  // useful question on a company page is not the useful question on the landing page.
  const [sugg, setSugg] = useState(() => suggestions(pageContext()))
  useEffect(() => {
    const f = () => setSugg(suggestions(pageContext()))
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  // The grey tail under the caret. '' whenever more than one prompt still matches, so we
  // never put a question under the caret that Tab would not actually run.
  const ghost = useMemo(() => (aiOn ? completion(q, sugg) : ''), [aiOn, q, sugg])
  // Suggestions ride in the list as a normal group, so the arrow keys and Enter that already
  // work for commands work for them too. Capped, and only the ones that still match.
  const suggGroup = useMemo(() => {
    if (!aiOn) return null
    const b = q.trim().toLowerCase()
    const hits = sugg.filter(t => !b || t.toLowerCase().startsWith(b))
    if (!hits.length) return null
    return { id: 'suggest', label: 'Ask the data', total: hits.length,
             items: hits.slice(0, 4).map((t, i) => ({ id: `sug-${i}`, label: t, hint: 'ask',
               action: () => runAsk(t, t === SUMMARIZE ? 'summary' : 'ask') })) }
  }, [aiOn, q, sugg]) // eslint-disable-line react-hooks/exhaustive-deps
  const list = useMemo(() => {
    if (!ask) return suggGroup ? [...shown, suggGroup] : shown
    const askG = { id: 'ask', label: 'Ask', items: [ask], total: 1 }
    if (!shown.length) return suggGroup ? [askG, suggGroup] : [askG]
    if (ask.href && ask.composed) return suggGroup ? [askG, ...shown, suggGroup] : [askG, ...shown]
    return suggGroup ? [...shown, suggGroup] : shown
  }, [ask, shown, suggGroup])
  // Two different things share one input. "Summarise this screen" is prose about the screen
  // you are on, and it stays in the dropdown over that screen. A free-text question can come
  // back with a shape — places side by side, a ranking, one subject and its figures — and a
  // table does not belong in a dropdown, so that goes to #/ask, which reads the answer the
  // store is already holding rather than asking again. An answer that is genuinely a sentence
  // renders here exactly as it always did.
  const runAsk = async (question, kind = 'ask') => {
    setAnswer({ state: 'loading', q: question })
    try {
      const ctx = pageContext()
      if (kind === 'summary') {
        const r = await summarize(ctx)
        setAnswer({ state: 'done', q: question, text: r.answer || '', tools: r.tools_used || [] })
        return
      }
      const r = await runAskServer(question, ctx)
      if (r.state === 'error') { setAnswer({ state: 'error', q: question, text: r.error }); return }
      if (renderable(r.view)) {
        setAnswer(null); setQ('')
        onDone?.()
        window.location.assign(href.ask(question))
        return
      }
      setAnswer({ state: 'done', q: question, text: r.answer || '', tools: r.tools || [] })
    } catch (e) {
      setAnswer({ state: 'error', q: question, text: String(e.message || e) })
    }
  }
  // `partial` items parsed, but only by discarding most of what was typed; with the ask layer
  // up they are questions, not commands.
  const toAsk = it => !!it.unknown || (!!it.partial && aiOn)
  const run = it => {
    if (toAsk(it)) { if (aiOn) runAsk(q); return }
    if (it.action) it.action(); else if (it.href) window.location.assign(it.href)
    setQ('')
    onDone?.()
  }
  const hasQuery = q.trim().length > 0
  const canAsk = aiOn && hasQuery
  const showList = hasQuery || emptyLimit > 0
  return (
    <Command shouldFilter={false} loop label="Wattson commands" className={`pal ${className}`}
      onKeyDown={e => {
        if (e.key === 'Tab' && aiOn && !e.shiftKey) {
          const full = accept(q, sugg)
          if (full && full !== q.trim()) { e.preventDefault(); setQ(full); return }
        }
        if (e.key === 'Escape' && emptyLimit === 0 && hasQuery) { e.preventDefault(); e.stopPropagation(); setQ('') }
      }}>
      <div className="pal-inputwrap">
        {/* The completion is drawn behind the input: the typed half is transparent so the
            grey tail lands exactly under the caret, and the layer never takes a click. */}
        {!!ghost && <div className="pal-ghost" aria-hidden="true"><span className="pal-ghost-typed">{q}</span><span className="pal-ghost-rest">{ghost}</span></div>}
        <Command.Input className="pal-input" value={q} onValueChange={setQ} placeholder={placeholder} autoFocus={autoFocus} autoComplete="off" spellCheck={false} aria-label={placeholder} />
        {!!ghost && <span className="pal-tab" aria-hidden="true">tab</span>}
      </div>
      {answer && (
        <div className={`pal-answer ${answer.state}`}>
          {answer.state === 'loading' && <p className="muted">Reading the data…</p>}
          {answer.state === 'error' && <p className="muted">The ask layer is unavailable. Everything else still works.</p>}
          {answer.state === 'done' && <>
            <p>{answer.text}</p>
            {!!answer.tools?.length && <p className="pal-answer-tools">from {answer.tools.map(t => t.tool).join(', ')}</p>}
          </>}
        </div>
      )}
      {showList && (
        <Command.List className="pal-list">
          {list.map(g => (
            <Command.Group key={g.id} className="pal-group" heading={<span className="pal-heading"><span>{g.label}</span>{g.total > g.items.length && <span className="pal-count">{g.items.length} of {g.total}</span>}</span>}>
              {g.items.map(it => (
                /* A question the deterministic parser cannot route is still answerable: with the
                   ask layer up, Enter sends it to the model and the answer opens as a view. Only
                   with no ask layer is it a dead row. */
                <Command.Item key={it.id} value={it.id} className={`pal-item${it.unknown ? ' unknown' : ''}${it.id === 'ask' ? ' ask' : ''}`} disabled={!!it.unknown && !aiOn} onSelect={() => run(it)}>
                  <span className="pal-label">{it.label}</span>
                  {it.hint && <span className={`pal-hint${it.mono ? ' mono' : ''}`}>{toAsk(it) && aiOn ? 'ask the data' : it.hint}</span>}
                  {(!it.unknown || aiOn) && <span className="pal-go" aria-hidden="true">↵</span>}
                </Command.Item>
              ))}
            </Command.Group>
          ))}
          {!list.length && <div className="pal-empty">{loading ? 'Loading regions…' : 'Nothing here yet.'}</div>}
          {loading && list.length > 0 && hasQuery && <div className="pal-empty small">Regions still loading…</div>}
        </Command.List>
      )}
      {footer && showList && <div className="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> {emptyLimit > 0 ? 'close' : 'clear'}</span></div>}
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
      if (e.key === 'Escape' && openRef.current) { e.preventDefault(); e.stopPropagation(); setOpen(false) }
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
        <Palette groups={groups} loading={loading} limit={limit} emptyLimit={emptyLimit} autoFocus placeholder={placeholder} onDone={() => setOpen(false)} footer />
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
