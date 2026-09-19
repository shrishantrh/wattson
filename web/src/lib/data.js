import { useCallback, useEffect, useState } from 'react'

// Data access. Reads provisional fixtures from public/fixtures (copied from ../fixtures by
// sync-fixtures.mjs). When VITE_API_BASE is set, the same calls hit the engine's endpoints:
//   GET /api/opening, GET /api/region/{id}, GET /api/company/{ticker}, POST /api/site
// The static export never needs the server: leave VITE_API_BASE unset.
const base = import.meta.env.BASE_URL
const api = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

export class NotFound extends Error { constructor(what) { super(`${what} is not in the data`); this.name = 'NotFound' } }

async function getJSON(url, init) {
  const res = await fetch(url, init)
  if (res.status === 404) throw new NotFound(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('json')) throw new Error(`${url}: not JSON (${ct || 'no content type'})`)   // dev server returns index.html for missing files
  return res.json()
}

const fixture = name => getJSON(`${base}fixtures/${name}.json`)

export const loadOpening = () => (api ? getJSON(`${api}/api/opening`) : fixture('opening'))

export async function loadRegion(id) {
  if (api) return getJSON(`${api}/api/region/${encodeURIComponent(id)}`)
  const f = await fixture('region')
  const r = f.regions?.[id]
  if (!r) throw new NotFound(`Region ${id}`)
  return { ...r, _provisional: f._provisional, _available: Object.keys(f.regions || {}) }
}

export async function loadCompany(ticker) {
  const t = String(ticker || '').trim().toUpperCase()
  if (!t) throw new NotFound('An empty ticker')
  if (api) return getJSON(`${api}/api/company/${encodeURIComponent(t)}`)
  const f = await fixture('company')
  const c = f.companies?.[t]
  if (!c) throw new NotFound(`Company ${t}`)
  return { ...c, _provisional: f._provisional, _available: Object.keys(f.companies || {}) }
}

export async function loadSite(request) {
  if (api) return getJSON(`${api}/api/site`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) })
  const f = await fixture('site')
  return f
}

// Tiny async hook: { loading, error, data, reload }. `deps` re-run the loader.
export function useAsync(fn, deps = []) {
  const [s, setS] = useState({ loading: true, error: null, data: null })
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick(t => t + 1), [])
  useEffect(() => {
    let alive = true
    setS(p => ({ ...p, loading: true, error: null }))
    Promise.resolve().then(fn).then(
      data => alive && setS({ loading: false, error: null, data }),
      error => alive && setS({ loading: false, error, data: null }),
    )
    return () => { alive = false }
  }, [...deps, tick])   // eslint-disable-line react-hooks/exhaustive-deps
  return { ...s, reload }
}
