import { useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import '../styles/primitives.css'

// Toasts. toast('Link copied') from anywhere (no React needed); <Toaster /> renders the
// queue bottom-centre, at most three at a time, each fading in and out over 150 ms. Mount
// <Toaster /> once near the root; extra mounts are harmless (only the earliest one renders).

const MAX_VISIBLE = 3
const FADE_MS = 150

let seq = 0
let items = []
const subs = new Set()
const emit = () => { for (const f of subs) f() }
const subscribe = f => { subs.add(f); return () => subs.delete(f) }
const snapshot = () => items

// oxlint-disable-next-line react/only-export-components
export function toast(message, { duration = 2000 } = {}) {
  const id = ++seq
  items = [...items, { id, message, duration, leaving: false }]
  // Over the cap: retire the oldest ones right away.
  for (const t of items.slice(0, -MAX_VISIBLE)) dismissToast(t.id)
  emit()
  if (duration > 0) setTimeout(() => dismissToast(id), duration)
  return id
}

// oxlint-disable-next-line react/only-export-components
export function dismissToast(id) {
  const t = items.find(x => x.id === id)
  if (!t || t.leaving) return
  items = items.map(x => (x.id === id ? { ...x, leaving: true } : x))
  emit()
  setTimeout(() => { items = items.filter(x => x.id !== id); emit() }, FADE_MS)
}

// One host per page and per scope: instances register in mount order and only the first
// living one renders. Toaster and ShortcutsSheet each use their own scope.
const scopes = new Map()
// oxlint-disable-next-line react/only-export-components
export function useFirstMounted(scope = 'toast') {
  const [id] = useState(() => ({}))
  const [first, setFirst] = useState(false)
  useEffect(() => {
    let s = scopes.get(scope)
    if (!s) scopes.set(scope, (s = { hosts: new Set(), subs: new Set() }))
    const f = () => setFirst(s.hosts.values().next().value === id)
    const ping = () => { for (const g of s.subs) g() }
    s.hosts.add(id); s.subs.add(f); ping()
    return () => { s.hosts.delete(id); s.subs.delete(f); ping() }
  }, [id, scope])
  return first
}

export function Toaster() {
  const host = useFirstMounted('toast')
  const list = useSyncExternalStore(subscribe, snapshot, snapshot)
  if (!host) return null
  return createPortal(
    <div className="toast-host" role="status" aria-live="polite" aria-atomic="false">
      {list.map(t => (
        <div key={t.id} className={`toast${t.leaving ? ' leaving' : ''}`} onClick={() => dismissToast(t.id)}>{t.message}</div>
      ))}
    </div>,
    document.body,
  )
}
