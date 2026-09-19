// Warm the browser for what the next route will ask for: static-export JSON under public/api,
// fixtures under public/fixtures, and the globe's land data. Nothing is stored here. The bytes
// live in the HTTP cache (JSON) or the module graph (land chunks), so the real loaders in
// lib/data.js and globe/land.js find them already local. Every call is fire-and-forget: it
// returns a promise that never rejects, and a prefetch that fails costs nothing.
//
// Usage (wired by the integrator, not here):
//   <Chip {...hoverPrefetch('region', r.id)}>                 spreads onMouseEnter / onFocus / onTouchStart
//   onMouseEnter={() => onHoverPrefetch('company', ticker)}   imperative form
//   warmGlobe()                                               before the globe mounts, or on the route before the landing
const base = import.meta.env.BASE_URL
const warmed = new Set()   // URLs already requested this session, so re-hovering a chip does not re-fetch. Not a data cache.
const noop = () => {}
const done = Promise.resolve()
const saveData = () => { try { return !!navigator.connection?.saveData } catch { return false } }
const clean = s => String(s ?? '').trim().replace(/^\/+/, '')

function warm(url) {
  if (typeof fetch !== 'function' || warmed.has(url) || saveData()) return done
  warmed.add(url)
  // `priority: 'low'` is the fetch priority hint (Chromium); browsers that do not know the field ignore it.
  // The body is read to the end so the cache entry is complete, then dropped. A failed request is
  // forgotten so the next hover can try again.
  return fetch(url, { priority: 'low' })
    .then(r => { if (!r.ok) warmed.delete(url); return r.arrayBuffer() })
    .then(noop, () => { warmed.delete(url) })
}

/** Warm one static-export file: `prefetchApi('regions')`, `prefetchApi('region/PJM%252FDOM')`, `prefetchApi('company/META')`. */
export function prefetchApi(path) {
  const p = clean(path).replace(/^api\//, '')
  return p ? warm(`${base}api/${p}${/\.json$/i.test(p) ? '' : '.json'}`) : done
}

/** Warm one fixture: `prefetchFixture('opening')`. */
export function prefetchFixture(name) {
  const n = clean(name).replace(/^fixtures\//, '').replace(/\.json$/i, '')
  return n ? warm(`${base}fixtures/${n}.json`) : done
}

// Region files are named like PJM%2FDOM.json, so the id is encoded twice (same as data.js).
export const prefetchRegion = id => (id ? prefetchApi(`region/${encodeURIComponent(encodeURIComponent(String(id)))}`) : done)
export const prefetchCompany = ticker => { const t = String(ticker ?? '').trim().toUpperCase(); return t ? prefetchApi(`company/${encodeURIComponent(t)}`) : done }

/**
 * Pull the globe's land chunks (world-atlas countries, us-atlas states) into the module graph.
 * Same specifiers as globe/land.js, so both resolve to the same chunks and one module instance;
 * the topojson work still happens once, inside land.js, when the globe first asks for it.
 */
export function warmGlobe() {
  return Promise.allSettled([import('world-atlas/countries-110m.json'), import('us-atlas/states-10m.json')]).then(noop)
}

const KINDS = {
  region: prefetchRegion,
  company: prefetchCompany,
  check: prefetchCompany,
  fixture: prefetchFixture,
  api: prefetchApi,
  globe: warmGlobe,
  regions: () => prefetchApi('regions'),
  companies: () => prefetchApi('companies'),
  facilities: () => prefetchApi('facilities'),
  alerts: () => prefetchApi('alerts'),
}

/** Prefetch for a chip by kind: 'region' | 'company' | 'check' | 'fixture' | 'api' | 'globe' | 'regions' | 'companies' | 'facilities' | 'alerts'. Unknown kinds are a no-op. */
export function onHoverPrefetch(kind, key) {
  const f = KINDS[kind]
  return f ? f(key) : done
}

/** Event props to spread on a chip or link: `{...hoverPrefetch('region', id)}`. */
export function hoverPrefetch(kind, key) {
  const go = () => { onHoverPrefetch(kind, key) }
  return { onMouseEnter: go, onFocus: go, onTouchStart: go }
}
