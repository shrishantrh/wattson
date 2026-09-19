import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Command } from 'cmdk'
import { askItem, matchGroups, useCommands } from '../lib/commands.js'
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
  const list = useMemo(() => {
    if (!ask) return shown
    if (!shown.length) return [{ id: 'ask', label: 'Ask', items: [ask], total: 1 }]
    if (ask.href && ask.composed) return [{ id: 'ask', label: 'Ask', items: [ask], total: 1 }, ...shown]
    return shown
  }, [ask, shown])
  const run = it => {
    if (it.unknown) return
    if (it.action) it.action(); else if (it.href) window.location.assign(it.href)
    setQ('')
    onDone?.()
  }
  const hasQuery = q.trim().length > 0
  const showList = hasQuery || emptyLimit > 0
  return (
    <Command shouldFilter={false} loop label="Wattson commands" className={`pal ${className}`}
      onKeyDown={e => { if (e.key === 'Escape' && emptyLimit === 0 && hasQuery) { e.preventDefault(); e.stopPropagation(); setQ('') } }}>
      <Command.Input className="pal-input" value={q} onValueChange={setQ} placeholder={placeholder} autoFocus={autoFocus} autoComplete="off" spellCheck={false} aria-label={placeholder} />
      {showList && (
        <Command.List className="pal-list">
          {list.map(g => (
            <Command.Group key={g.id} className="pal-group" heading={<span className="pal-heading"><span>{g.label}</span>{g.total > g.items.length && <span className="pal-count">{g.items.length} of {g.total}</span>}</span>}>
              {g.items.map(it => (
                <Command.Item key={it.id} value={it.id} className={`pal-item${it.unknown ? ' unknown' : ''}${it.id === 'ask' ? ' ask' : ''}`} disabled={!!it.unknown} onSelect={() => run(it)}>
                  <span className="pal-label">{it.label}</span>
                  {it.hint && <span className={`pal-hint${it.mono ? ' mono' : ''}`}>{it.hint}</span>}
                  {!it.unknown && <span className="pal-go" aria-hidden="true">↵</span>}
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
