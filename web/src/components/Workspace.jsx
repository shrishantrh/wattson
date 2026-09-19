/* oxlint-disable react/only-export-components -- the state hook and the pure reducer are exported for pages and tests */
import { useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import '../styles/workspace.css'

// Modular evidence column. <Workspace id="check" modules={[{ id, title, render: () => node, default?, right? }]} />
// Order and the enabled set persist in localStorage under `wattson.ws.<id>`. A module the stored
// state has never seen slots in where it sits in the definition; a hidden one comes back from
// Customize. Every storage read/write is wrapped; with storage gone it just runs on defaults.

export const storeKey = id => `wattson.ws.${id}`
export const emptyState = () => ({ order: [], enabled: {} })

export function readStore(key) {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return emptyState()
    const j = JSON.parse(raw)
    return { order: Array.isArray(j.order) ? j.order.filter(x => typeof x === 'string') : [], enabled: j.enabled && typeof j.enabled === 'object' ? j.enabled : {} }
  } catch { return emptyState() }
}

export function writeStore(key, state) {
  try {
    if (state) window.localStorage.setItem(key, JSON.stringify({ v: 1, order: state.order, enabled: state.enabled }))
    else window.localStorage.removeItem(key)
  } catch { /* private mode, quota, no window: the session still works, it just will not remember */ }
}

// Pure. Stored state -> a full { order, enabled } for exactly these modules.
export function resolveWorkspace(modules, state) {
  const ids = modules.map(m => m.id)
  const known = new Set(ids)
  const order = (state?.order || []).filter((id, i, a) => known.has(id) && a.indexOf(id) === i)
  ids.forEach((id, i) => {
    if (order.includes(id)) return
    const prev = ids.slice(0, i).reverse().find(p => order.includes(p))
    order.splice(prev == null ? 0 : order.indexOf(prev) + 1, 0, id)
  })
  const enabled = {}
  modules.forEach(m => { const s = state?.enabled?.[m.id]; enabled[m.id] = typeof s === 'boolean' ? s : m.default !== false })
  return { order, enabled }
}

const moveItem = (arr, from, to) => { const a = arr.slice(); const [x] = a.splice(from, 1); a.splice(to, 0, x); return a }

// Pure. Actions: { type: 'move', from, to } (ids), { type: 'toggle', id, on? }, { type: 'all', on? }, { type: 'reset' }.
export function workspaceReducer(state, action) {
  switch (action.type) {
    case 'move': {
      const from = state.order.indexOf(action.from), to = state.order.indexOf(action.to)
      if (from < 0 || to < 0 || from === to) return state
      return { ...state, order: moveItem(state.order, from, to) }
    }
    case 'toggle': {
      if (!(action.id in state.enabled)) return state
      const on = typeof action.on === 'boolean' ? action.on : !state.enabled[action.id]
      if (on === state.enabled[action.id]) return state
      return { ...state, enabled: { ...state.enabled, [action.id]: on } }
    }
    case 'all': {
      const enabled = {}
      for (const id of state.order) enabled[id] = action.on !== false
      return { ...state, enabled }
    }
    case 'reset': return emptyState()
    default: return state
  }
}

export const sameState = (a, b) => a.order.length === b.order.length && a.order.every((id, i) => id === b.order[i]) && a.order.every(id => a.enabled[id] === b.enabled[id])

// Reads storage once on mount; remount (key={id}) to switch workspaces.
export function useWorkspaceState(id, modules) {
  const key = storeKey(id)
  const [raw, setRaw] = useState(() => readStore(key))
  const touched = useRef(false)
  useEffect(() => { if (touched.current) writeStore(key, raw.order.length ? raw : null) }, [key, raw])
  const dispatch = action => { touched.current = true; setRaw(r => workspaceReducer(resolveWorkspace(modules, r), action)) }
  const state = resolveWorkspace(modules, raw)
  const byId = new Map(modules.map(m => [m.id, m]))
  const ordered = state.order.map(i => byId.get(i)).filter(Boolean)
  const visible = ordered.filter(m => state.enabled[m.id])
  const isDefault = raw.order.length === 0 || sameState(state, resolveWorkspace(modules, null))
  return {
    order: state.order, enabled: state.enabled, modules: ordered, visible, isDefault,
    move: (from, to) => dispatch({ type: 'move', from, to }),
    toggle: (mid, on) => dispatch({ type: 'toggle', id: mid, on }),
    hide: mid => dispatch({ type: 'toggle', id: mid, on: false }),
    show: mid => dispatch({ type: 'toggle', id: mid, on: true }),
    showAll: () => dispatch({ type: 'all', on: true }),
    reset: () => dispatch({ type: 'reset' }),
  }
}

const VERTICAL = [({ transform }) => ({ ...transform, x: 0 })]
const label = m => (typeof m.title === 'string' ? m.title : m.id)

export default function Workspace({ id, modules, title, className = '' }) {
  return <WorkspaceBody key={id} id={id} modules={modules} title={title} className={className} />
}

function WorkspaceBody({ id, modules, title, className }) {
  const ws = useWorkspaceState(id, modules)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const idsKey = JSON.stringify(ws.visible.map(m => m.id))   // stable identity for SortableContext
  const ids = useMemo(() => JSON.parse(idsKey), [idsKey])
  const onDragEnd = ({ active, over }) => { if (over && active.id !== over.id) ws.move(String(active.id), String(over.id)) }
  return (
    <div className={`ws ${className}`} data-workspace={id}>
      <div className="ws-bar">
        {title && <span className="ws-bar-title">{title}</span>}
        <Customize ws={ws} />
      </div>
      <DndContext id={`ws-${id}`} sensors={sensors} collisionDetection={closestCenter} modifiers={VERTICAL} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ws.visible.map(m => <Module key={m.id} module={m} onHide={() => ws.hide(m.id)} />)}
        </SortableContext>
      </DndContext>
      {ws.visible.length === 0 && <div className="ws-empty">Every module is hidden. <button type="button" className="ws-linkbtn" onClick={ws.showAll}>Show all</button></div>}
    </div>
  )
}

function Module({ module: m, onHide }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: m.id })
  const style = { transform: CSS.Translate.toString(transform), transition }
  return (
    <section ref={setNodeRef} style={style} className={`card ws-module ${isDragging ? 'is-dragging' : ''}`} data-module={m.id}>
      <header className="ws-head">
        <span className="ws-title">{m.title}</span>
        <span className="ws-tools">
          {m.right}
          <button type="button" ref={setActivatorNodeRef} className="ws-handle" title="Drag to reorder. Keyboard: Space, arrows, Space" {...attributes} {...listeners} aria-label={`Reorder ${label(m)}`}>⋮⋮</button>
          <button type="button" className="ws-hide" onClick={onHide} title="Hide" aria-label={`Hide ${label(m)}`}>×</button>
        </span>
      </header>
      {typeof m.render === 'function' ? m.render() : m.render ?? null}
    </section>
  )
}

function Customize({ ws }) {
  const [open, setOpen] = useState(false)
  const host = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDown = e => { if (host.current && !host.current.contains(e.target)) setOpen(false) }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  const n = ws.visible.length, total = ws.modules.length
  return (
    <div className="ws-pop-host" ref={host}>
      <button type="button" className="ws-customize" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        Customize{n < total && <span className="ws-customize-n">{n}/{total}</span>}
      </button>
      {open && (
        <div className="ws-pop" role="dialog" aria-label="Customize modules">
          <div className="ws-pop-head">Modules. Drag ⋮⋮ on a card to reorder.</div>
          {ws.modules.map(m => (
            <label key={m.id} className={`ws-pop-row ${ws.enabled[m.id] ? '' : 'off'}`}>
              <input type="checkbox" checked={!!ws.enabled[m.id]} onChange={e => ws.toggle(m.id, e.target.checked)} />
              <span>{m.title}</span>
            </label>
          ))}
          <div className="ws-pop-foot">
            <button type="button" className="ws-linkbtn" onClick={ws.showAll} disabled={n === total}>Show all</button>
            <button type="button" className="ws-linkbtn" onClick={() => { ws.reset(); setOpen(false) }} disabled={ws.isDefault}>Reset</button>
          </div>
        </div>
      )}
    </div>
  )
}
