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

// One host per page: instances register in mount order and the first living one renders.
const hosts = new Set(), hostSubs = new Set()
const ping = () => { for (const f of hostSubs) f() }
// oxlint-disable-next-line react/only-export-components
export function useFirstMounted() {
  const [id] = useState(() => ({}))
  const [first, setFirst] = useState(false)
  useEffect(() => {
    const f = () => setFirst(hosts.values().next().value === id)
    hosts.add(id); hostSubs.add(f); ping()
    return () => { hosts.delete(id); hostSubs.delete(f); ping() }
  }, [id])
  return first
}

export function Toaster() {
  const host = useFirstMounted()
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
