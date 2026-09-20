// The last free-text ask, held in memory.
//
// WHY A STORE AND NOT PAGE STATE. The question is typed in the command palette, but the
// answer is a view -- a table, a chart, a stat block -- and a table does not fit in a
// dropdown. So the palette runs the ask, stashes the result here, and navigates to
// #/ask?q=..., where the page reads the result that is already in hand. One request, one
// answer, two surfaces. Arriving at #/ask?q=... by link or reload finds an empty store and
// the page asks for itself.
//
// Nothing here is persisted: an answer is a moment, not a record.
import { useSyncExternalStore } from 'react'
import { ask } from './ask.js'

const IDLE = { state: 'idle', q: '' }
let current = IDLE
const subs = new Set()
const emit = next => { current = next; for (const f of subs) f(current) }
const subscribe = f => { subs.add(f); return () => { subs.delete(f) } }

export const getAsk = () => current
export const useAskResult = () => useSyncExternalStore(subscribe, getAsk, () => IDLE)
export const clearAsk = () => emit(IDLE)

// A view is worth a page only when it has rows to draw. "prose" means the model judged the
// answer to be a sentence, and a sentence belongs where it was asked.
export const renderable = v => !!v && v.kind !== 'prose' && Array.isArray(v.rows) && v.rows.length > 0

// Only the newest question may write the store, so a slow answer cannot overwrite a fast one
// asked after it.
let seq = 0

export async function runAsk(q, page) {
  const question = String(q || '').trim()
  if (!question) return current
  const id = ++seq
  emit({ state: 'loading', q: question })
  let next
  try {
    const r = await ask(question, page)
    next = { state: 'done', q: question, answer: r.answer || '', view: r.view || null,
             tools: r.tools_used || [], model: r.model || '' }
  } catch (e) {
    next = { state: 'error', q: question, error: String(e?.message || e) }
  }
  if (id === seq) emit(next)
  return next
}
