// The ask layer's client. It is an ENHANCEMENT, never a dependency.
//
// The demo runs off a static export with no server. When no API base is configured, or
// the server has no OPENAI_API_KEY, askAvailable() resolves false and the UI keeps its
// existing deterministic behaviour: the command palette still navigates, every screen
// still renders. Nothing that matters is behind this.
const api = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

let _status = null
export async function askAvailable() {
  if (_status !== null) return _status
  if (!api) { _status = false; return false }
  try {
    const r = await fetch(`${api}/api/ask/status`, { signal: AbortSignal.timeout(2500) })
    _status = r.ok ? !!(await r.json()).available : false
  } catch { _status = false }
  return _status
}

async function post(path, body) {
  const r = await fetch(`${api}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  })
  if (!r.ok) throw new Error(`ask: HTTP ${r.status}`)
  return r.json()
}

/** Answer a question. `page` tells the model what the user is looking at; it is a pointer
 *  for resolving "this" and "here", not a source — the server re-fetches every figure. */
export const ask = (q, page) => post('/api/ask', { q, page })

/** Plain-English summary of the current screen. */
export const summarize = page => post('/api/ask/summarize', { q: page?.route || 'this screen', page })
