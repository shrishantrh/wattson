import { useEffect, useMemo, useRef, useState } from 'react'

// One side of a comparison. Type to narrow, arrow keys to move, Enter to take it.
//
// A native select was fine for three metros and useless for 134 datacenters: the only way
// to reach Council Bluffs was to scroll past everything above it. This filters on every
// word the row carries (a site matches on its operator, its metro, its state, its utility
// and its grid), so "dominion" finds the sites Dominion serves and "PJM" finds the ones
// inside PJM.
//
// items: [{ id, label, sub, keywords }]. `sub` is the second line in the list and under the
// field, so the selected row keeps saying what it is after the list closes.

const norm = s => String(s || '').toLowerCase()
const MAX = 80

function score(item, q) {
  const label = norm(item.label)
  if (label === q) return 0
  if (label.startsWith(q)) return 1
  const hay = norm(item.keywords || `${item.label} ${item.sub || ''}`)
  if (!hay.includes(q)) return -1
  return hay.split(/\s+/).some(w => w.startsWith(q)) ? 2 : 3
}

export default function CmpPicker({ label, items, value, onChange, placeholder = 'Type a name', disabledId, side, hint = 'Try a shorter word, a state, a utility, or a grid id.' }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState(0)
  const boxRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const sel = useMemo(() => items.find(i => i.id === value) || null, [items, value])

  const list = useMemo(() => {
    const t = norm(q).trim()
    if (!t) return items.slice(0, MAX)
    return items
      .map(i => ({ i, s: score(i, t) }))
      .filter(x => x.s >= 0)
      .sort((a, b) => a.s - b.s)
      .slice(0, MAX)
      .map(x => x.i)
  }, [items, q])

  // Clicking outside is a dismissal, not a choice: the field keeps what it had.
  useEffect(() => {
    if (!open) return undefined
    const off = e => { if (boxRef.current && !boxRef.current.contains(e.target)) { setOpen(false); setQ('') } }
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [open])
  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelectorAll('[data-cmp-item]')?.[at]
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [at, open])

  const take = item => {
    if (!item || item.id === disabledId) return
    onChange(item.id)
    setOpen(false)
    setQ('')
    inputRef.current?.blur()
  }

  const onKeyDown = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setAt(i => Math.min(list.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); setAt(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); take(list[at]) }
    else if (e.key === 'Escape') {
      // The list is this field's own layer. It closes first, and the press stops here so the
      // screen behind it stays open.
      if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false); setQ('') }
    }
  }

  const id = `cmp-pick-${side || label}`.replace(/\s+/g, '-').toLowerCase()
  return (
    <div className={`cmp-pick${open ? ' is-open' : ''}`} ref={boxRef}>
      <label className="cmp-pick-k" htmlFor={id}>{label}</label>
      <div className="cmp-pick-field">
        <input
          id={id}
          ref={inputRef}
          className="cmp-pick-in"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          placeholder={sel ? sel.label : placeholder}
          value={open ? q : sel?.label || ''}
          onChange={e => { setQ(e.target.value); setAt(0); setOpen(true) }}
          onFocus={() => { setAt(0); setOpen(true) }}
          onKeyDown={onKeyDown}
        />
        <span className="cmp-pick-caret" aria-hidden="true" />
      </div>
      {sel?.sub && !open && <p className="cmp-pick-sub">{sel.sub}</p>}
      {open && (
        <div className="cmp-pick-pop" id={`${id}-list`} role="listbox" ref={listRef}>
          {list.length === 0
            ? <p className="cmp-pick-none">{hint}</p>
            : list.map((i, n) => (
              <button
                key={i.id}
                type="button"
                data-cmp-item
                role="option"
                aria-selected={i.id === value}
                className={`cmp-pick-row${n === at ? ' on' : ''}${i.id === disabledId ? ' dim' : ''}${i.id === value ? ' sel' : ''}`}
                onMouseDown={e => e.preventDefault()}
                onMouseEnter={() => setAt(n)}
                onClick={() => take(i)}
                title={i.id === disabledId ? 'Already on the other side' : undefined}
              >
                <span className="t">{i.label}</span>
                {i.sub && <span className="d">{i.sub}</span>}
              </button>
            ))}
          {list.length === MAX && <p className="cmp-pick-none">Showing the first {MAX}. Keep typing to narrow it.</p>}
        </div>
      )}
    </div>
  )
}
