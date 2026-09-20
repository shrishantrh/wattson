import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Close } from './Icons.jsx'
import { useFirstMounted } from './Toast.jsx'
import '../styles/primitives.css'
import '../styles/console.css'

// Keyboard shortcuts. <ShortcutsSheet /> mounts one global listener: "?" opens the sheet when
// the user is not typing in a field, Esc closes it, and a window 'wattson:shortcuts' event
// (openShortcuts() below) opens it from anywhere, e.g. a "Keyboard" item in the palette.
// useKey(key, handler, { when }) is the same listener as a hook for any component.

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')
const isTyping = e => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || !!e.target?.isContentEditable
const norm = k => (typeof k === 'string' && k.length === 1 ? k.toLowerCase() : k)

// useKey('d', fn) fires on keydown of that key (string, or array of strings; e.key values,
// letters case-insensitive). Ignored while typing in a field unless `typing: true`, and when a
// modifier (meta, ctrl, alt) is held unless `modifiers: true`. `when` (boolean or e => boolean)
// gates the handler; `capture: true` listens in the capture phase. The handler is read from a
// ref, so it can be an inline closure.
// oxlint-disable-next-line react/only-export-components
export function useKey(key, handler, { when = true, typing = false, modifiers = false, capture = false } = {}) {
  const handlerRef = useRef(handler), whenRef = useRef(when)
  useEffect(() => { handlerRef.current = handler; whenRef.current = when })
  const keys = JSON.stringify((Array.isArray(key) ? key : [key]).map(norm))
  const active = typeof when === 'function' || !!when
  useEffect(() => {
    if (!active) return
    const list = JSON.parse(keys)
    if (!list.length) return
    const onKey = e => {
      if (!list.includes(norm(e.key))) return
      if (!modifiers && (e.metaKey || e.ctrlKey || e.altKey)) return
      if (!typing && isTyping(e)) return
      const w = whenRef.current
      if (typeof w === 'function' ? !w(e) : !w) return
      handlerRef.current?.(e)
    }
    window.addEventListener('keydown', onKey, capture)
    return () => window.removeEventListener('keydown', onKey, capture)
  }, [keys, active, typing, modifiers, capture])
}

// oxlint-disable-next-line react/only-export-components
export function openShortcuts(open = true) {
  window.dispatchEvent(new CustomEvent('wattson:shortcuts', { detail: { open } }))
}

// The keyboard map, in one place. Every row here is a key that is really bound somewhere in the
// app; the palette (components/CommandPalette.jsx) renders the same table as its Keyboard group,
// so a shortcut cannot exist in one list and not the other.
//   keys   the key caps, in order · sep the word between them ("or", "–")
//   label  what it does · where the surface it works on, when it is not global
//   act    a name the palette maps to a function, for the rows that can also be clicked
// oxlint-disable-next-line react/only-export-components
export const SHORTCUTS = [
  { id: 'find', title: 'Search', rows: [
    { keys: [isMac ? '⌘K' : 'Ctrl K'], label: 'Search or ask', where: 'anywhere, even while typing', act: 'palette' },
    { keys: ['/'], label: 'Search or ask', where: 'when no text field has focus' },
    { keys: ['↑', '↓'], label: 'Move through the results', where: 'in the palette' },
    { keys: ['↵'], label: 'Run the highlighted row', where: 'in the palette' },
    { keys: ['tab'], label: 'Complete the highlighted row into the box', where: 'in the ⌘K dialog' },
    { keys: ['esc'], label: 'Clear the box, then close', where: 'in the palette' },
  ] },
  { id: 'read', title: 'Reading a screen', rows: [
    { keys: ['i'], label: 'What am I looking at', act: 'insight' },
    { keys: ['?'], label: 'This sheet', act: 'sheet' },
    { keys: ['1', '4'], sep: '–', label: 'Jump to a findings scene', where: 'on What we found' },
    { keys: ['esc'], label: 'Close the panel you are in' },
  ] },
  { id: 'modules', title: 'Evidence modules', rows: [
    { keys: ['tab'], label: 'Reach a card’s reorder handle' },
    { keys: ['space'], label: 'Pick the card up, and drop it', where: 'on the handle' },
    { keys: ['↑', '↓'], label: 'Move the picked-up card', where: 'on the handle' },
    { keys: ['esc'], label: 'Put it back where it was', where: 'while dragging' },
  ] },
  { id: 'present', title: 'Presenting', rows: [
    { keys: ['d'], label: 'Demo mode', act: 'demo' },
    { keys: ['←', '→'], label: 'Step through the demo', where: 'in demo mode' },
    { keys: ['t'], label: 'Show or hide the tour', act: 'tour' },
    { keys: ['p'], label: 'Play or pause the tour', where: 'while the tour is up' },
  ] },
]
const GROUPS = SHORTCUTS

export function ShortcutsSheet({ groups = GROUPS }) {
  const host = useFirstMounted('shortcuts')
  const [open, setOpen] = useState(false)
  const sheetRef = useRef(null)

  useKey('?', e => { e.preventDefault(); setOpen(true) }, { when: host })
  useKey('Escape', e => { e.preventDefault(); e.stopPropagation(); setOpen(false) }, { when: host && open, typing: true, capture: true })

  useEffect(() => {
    if (!host) return
    const onEvt = e => setOpen(e.detail?.open ?? true)
    window.addEventListener('wattson:shortcuts', onEvt)
    return () => window.removeEventListener('wattson:shortcuts', onEvt)
  }, [host])

  // Focus the sheet on open; hand focus back on close.
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    sheetRef.current?.focus()
    return () => { if (prev && typeof prev.focus === 'function' && document.contains(prev)) prev.focus() }
  }, [open])

  if (!host || !open) return null
  return createPortal(
    <div className="sheet-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabIndex={-1} ref={sheetRef}>
        <div className="sheet-head">
          <h2 id="sheet-title">Keyboard shortcuts</h2>
          <button type="button" className="sheet-close" onClick={() => setOpen(false)} aria-label="Close"><Close size={16} /></button>
        </div>
        {groups.map(g => (
          <section className="grp" key={g.id}>
            <h3>{g.title}</h3>
            <ul>
              {g.rows.map((r, i) => (
                <li key={i}>
                  <span>{r.label}{r.where && <em className="where">{r.where}</em>}</span>
                  <span className="keys">
                    {r.keys.map((k, j) => (
                      <span key={j} className="keys">
                        {j > 0 && r.sep && <span className="sep">{r.sep}</span>}
                        <kbd className="kbd">{k}</kbd>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <div className="sheet-foot"><kbd className="kbd">?</kbd> opens this sheet</div>
      </div>
    </div>,
    document.body,
  )
}

export default ShortcutsSheet
