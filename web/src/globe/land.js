// Land geometry for the globe's "dots" style: world countries (Natural Earth 110m via
// world-atlas) for the dot matrix and US state borders (Census 10m via us-atlas) for the
// thin border lines. Both TopoJSON files are imported lazily so they land in their own
// chunk and only load when the dots style is used; the converted GeoJSON is cached at
// module level so every caller shares one copy.
import { feature, mesh } from 'topojson-client'

const US_ID = '840'
const US_NAME = 'United States of America'
const NEIGHBOR_IDS = new Set(['124', '484']) // Canada, Mexico
// Antarctica is never in a US-centred view, its polygon touches the pole (a known weak spot
// for H3 polygon filling) and it would cost ~1,100 dots, so it is left out.
const SKIP_IDS = new Set(['010'])

let countriesPromise = null
let statesPromise = null

// world-atlas 110m quantises Natural Earth to a 10k x 10k grid, which collapses a few tiny
// polygons to a single repeated vertex (North Korea's second polygon is one). h3-js's
// polygonToCells throws E_FAILED on such a ring, and an exception inside three-globe's
// digest loop leaves every later country without geometry, so degenerate rings are dropped
// here, before the data reaches the layer.
function ringIsValid(ring) {
  if (!ring || ring.length < 4) return false
  const seen = new Set()
  let area2 = 0
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i]
    const [x1, y1] = ring[(i + 1) % ring.length]
    seen.add(`${x0},${y0}`)
    area2 += x0 * y1 - x1 * y0
  }
  return seen.size >= 3 && area2 !== 0
}

function cleanPolygon(rings) {
  if (!ringIsValid(rings[0])) return null // outer ring gone: the polygon is gone
  return rings.filter(ringIsValid)
}

function cleanGeometry(geometry) {
  if (!geometry) return null
  if (geometry.type === 'Polygon') {
    const rings = cleanPolygon(geometry.coordinates)
    return rings ? { type: 'Polygon', coordinates: rings } : null
  }
  if (geometry.type === 'MultiPolygon') {
    const polys = geometry.coordinates.map(cleanPolygon).filter(Boolean)
    return polys.length ? { type: 'MultiPolygon', coordinates: polys } : null
  }
  return null
}

/**
 * Whether a world-atlas country feature is the United States.
 * @param {{ id?: string, properties?: { name?: string } }} feature
 * @returns {boolean}
 */
export function isUS(feature) {
  if (!feature) return false
  return feature.id === US_ID || (feature.properties != null && feature.properties.name === US_NAME)
}

/**
 * Whether a world-atlas country feature is Canada or Mexico.
 * @param {{ id?: string, properties?: { name?: string } }} feature
 * @returns {boolean}
 */
export function isUSNeighbor(feature) {
  if (!feature) return false
  if (NEIGHBOR_IDS.has(feature.id)) return true
  const name = feature.properties && feature.properties.name
  return name === 'Canada' || name === 'Mexico'
}

/**
 * World countries as GeoJSON features (`{ type: 'Feature', id, properties: { name }, geometry }`),
 * 177 Polygon/MultiPolygon features from world-atlas countries-110m.json. The promise is
 * cached; a failed load clears the cache so the next call retries.
 * @returns {Promise<Array<object>>}
 */
export function loadCountries() {
  if (!countriesPromise) {
    countriesPromise = import('world-atlas/countries-110m.json')
      .then((mod) => {
        const topo = mod.default || mod
        const out = []
        feature(topo, topo.objects.countries).features.forEach((f) => {
          if (SKIP_IDS.has(f.id)) return
          const geometry = cleanGeometry(f.geometry)
          if (geometry) out.push({ ...f, geometry })
        })
        return out
      })
      .catch((err) => {
        countriesPromise = null
        throw err
      })
  }
  return countriesPromise
}

/**
 * US state borders (interior borders and coastlines) as line strings of `[lat, lng]` pairs,
 * from us-atlas states-10m.json meshed with topojson-client so shared borders are emitted
 * once. About 300 line strings, 11.7k points. Cached like `loadCountries()`.
 * @returns {Promise<Array<{ id: number, points: Array<[number, number]> }>>}
 */
export function loadStateMesh() {
  if (!statesPromise) {
    statesPromise = import('us-atlas/states-10m.json')
      .then((mod) => {
        const topo = mod.default || mod
        const lines = mesh(topo, topo.objects.states) // GeoJSON MultiLineString, [lng, lat]
        return lines.coordinates.map((line, i) => ({ id: i, points: line.map(([lng, lat]) => [lat, lng]) }))
      })
      .catch((err) => {
        statesPromise = null
        throw err
      })
  }
  return statesPromise
}

// ---------- dot field: one H3 cell per land dot, built once per page ----------

const US_RES = 4 // ~26 km cells over the US: the country we actually talk about reads detailed
const WORLD_RES = 3 // ~68 km cells everywhere else: context, and the cost the old layer already paid
const EARTH_KM = 6371

let fieldPromise = null

// Yield to the event loop between chunks. Deliberately NOT requestAnimationFrame: a globe
// mounted in a background tab gets no frames, and the build would never finish. A MessageChannel
// task is not clamped the way a background setTimeout is, so the field still completes.
const yieldToLoop = () =>
  new Promise((resolve) => {
    if (typeof MessageChannel === 'function') {
      const ch = new MessageChannel()
      ch.port1.onmessage = () => {
        ch.port1.close()
        resolve()
      }
      ch.port2.postMessage(0)
    } else {
      setTimeout(resolve, 0)
    }
  })

/**
 * Land as an H3 cell field: one dot per cell, at resolution 4 over the United States and 3
 * over the rest of the world, with each cell's true area (so a dot can be sized by the cell
 * it stands for) and a flag for cells on the edge of the land mass (coastlines and borders).
 *
 * Built once per page and cached, off the countries GeoJSON. The work is chunked across
 * animation frames so the ~0.8 s of h3 polygon filling never lands as one long task.
 *
 * @returns {Promise<{ count: number, lat: Float32Array, lng: Float32Array, radiusKm: Float32Array, cls: Uint8Array, edge: Uint8Array }>}
 * `cls` is 2 for the US, 1 for Canada/Mexico, 0 for the rest; `edge` is 1 when the cell has a
 * missing neighbour; `radiusKm` is the radius of a disc with the cell's area.
 */
export function loadDotField() {
  if (!fieldPromise) {
    fieldPromise = buildDotField().catch((err) => {
      fieldPromise = null
      throw err
    })
  }
  return fieldPromise
}

async function buildDotField() {
  const { cellToLatLng, cellArea, gridDisk, polygonToCells } = await import('h3-js')
  const countries = await loadCountries()
  const cells = new Map() // h3 index -> class (2 US, 1 neighbour, 0 rest)

  let since = performance.now()
  for (const f of countries) {
    const us = isUS(f)
    const cls = us ? 2 : isUSNeighbor(f) ? 1 : 0
    const res = us ? US_RES : WORLD_RES
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    for (const rings of polys) {
      let out
      try {
        out = polygonToCells(rings, res, true)
      } catch {
        continue // a ring h3 cannot fill: that polygon simply gets no dots
      }
      for (const c of out) {
        const prev = cells.get(c)
        if (prev === undefined || prev < cls) cells.set(c, cls)
      }
    }
    if (performance.now() - since > 12) {
      await yieldToLoop()
      since = performance.now()
    }
  }

  const count = cells.size
  const lat = new Float32Array(count)
  const lng = new Float32Array(count)
  const radiusKm = new Float32Array(count)
  const cls = new Uint8Array(count)
  const edge = new Uint8Array(count)
  let i = 0
  since = performance.now()
  for (const [cell, klass] of cells) {
    const ll = cellToLatLng(cell)
    lat[i] = ll[0]
    lng[i] = ll[1]
    radiusKm[i] = Math.sqrt(cellArea(cell, 'km2') / Math.PI)
    cls[i] = klass
    // A cell missing any of its six neighbours sits on a coast or a land border.
    const disk = gridDisk(cell, 1)
    let n = 0
    for (const d of disk) if (cells.has(d)) n++
    edge[i] = n < disk.length ? 1 : 0
    i++
    if ((i & 1023) === 0 && performance.now() - since > 12) {
      await yieldToLoop()
      since = performance.now()
    }
  }
  return { count, lat, lng, radiusKm, cls, edge, earthKm: EARTH_KM }
}
