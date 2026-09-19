// Load-shape arithmetic. Pure: no React, no JSON, no DOM.
//
// A region's `profile_24h` is the carbon-free share of generation by local hour (24 numbers,
// 0..1). A load has a shape: 24 weights that say what fraction of its energy lands in each
// hour. The clean share the load "runs on" is the weight-averaged profile, so the same place
// answers differently for a flat datacenter, a business-hours office park, an overnight fleet
// charger, or a load that can move a fifth of its energy into the cleanest hours.
//
// Everything here measures generation within a footprint, not consumption; interchange is
// not allocated. Other/unknown fuel counts as not clean.

const H = 24
const num = x => (typeof x === 'number' && Number.isFinite(x) ? x : x != null && x !== '' && Number.isFinite(Number(x)) ? Number(x) : null)
const sum = a => a.reduce((s, x) => s + x, 0)
const normalise = w => { const s = sum(w); return s > 0 ? w.map(x => x / s) : w.map(() => 1 / H) }
const byHour = f => normalise(Array.from({ length: H }, (_, h) => f(h)))
const isArr24 = p => Array.isArray(p) && p.length >= H

// ---- the shapes -------------------------------------------------------------------------
// Weights sum to 1. Hours are local, index h covers h:00 to h:59.
export const SHAPES = [
  { id: 'flat', label: '24/7 flat', hint: 'A datacenter: every hour the same.', weights: byHour(() => 1) },
  { id: 'business', label: 'business hours', hint: '8am to 6pm at full, a quarter of that the rest of the day.', weights: byHour(h => (h >= 8 && h < 18 ? 1 : 0.25)) },
  { id: 'overnight', label: 'overnight-heavy', hint: '10pm to 6am at full, about a third otherwise: fleet charging, batch jobs.', weights: byHour(h => (h >= 22 || h < 6 ? 1 : 0.35)) },
  { id: 'solar', label: 'daytime-following', hint: 'A bell centred on 1pm, three hours wide, never below 0.15.', weights: byHour(h => Math.max(0.15, Math.exp(-((h - 13) ** 2) / (2 * 3 ** 2)))) },
]
export const shapeById = id => SHAPES.find(s => s.id === id) || null
export const FLEX_FRACTION = 0.2
export const FLEX_LABEL = 'flexible 20%'

// ---- the arithmetic ---------------------------------------------------------------------
// Weighted clean share: sum(w_h * p_h) / sum(w_h) over hours where both are numbers.
// Null hours are skipped and the weights renormalised; fewer than 12 usable hours -> null.
export function cleanShareFor(profile24, weights) {
  if (!isArr24(profile24) || !isArr24(weights)) return null
  let n = 0, den = 0, acc = 0
  for (let h = 0; h < H; h++) {
    const p = num(profile24[h]), w = num(weights[h])
    if (p == null || w == null || w < 0) continue
    acc += w * p; den += w; n++
  }
  return n < 12 || den <= 0 ? null : acc / den
}

const ranked = (profile24, dir) => {
  if (!isArr24(profile24)) return []
  const rows = []
  for (let h = 0; h < H; h++) { const p = num(profile24[h]); if (p != null) rows.push({ h, p }) }
  return rows.sort((a, b) => (dir * (b.p - a.p)) || a.h - b.h)
}
const pick = (profile24, n, dir) => {
  const top = ranked(profile24, dir).slice(0, Math.max(0, n))
  return { hours: top.map(r => r.h).sort((a, b) => a - b), mean: top.length ? sum(top.map(r => r.p)) / top.length : null }
}
// The n cleanest hours (indices, ascending) and their mean share. Null hours never qualify.
export const bestHours = (profile24, n = 6) => pick(profile24, n, 1)
// The n dirtiest hours, likewise.
export const worstHours = (profile24, n = 6) => pick(profile24, n, -1)

// Move `fraction` (0..1) of the load's energy out of the dirtiest hours it uses and into the
// cleanest hours. The rule, greedy:
//   * sources are the hours with weight > 0, taken from the lowest clean share upward;
//   * destinations are taken from the highest clean share downward;
//   * energy moves from the current source to the current destination until the budget is
//     spent, the source is empty, or the destination is full;
//   * a destination is full at 2x its original weight (a flat load can at most double an
//     hour), so a 20% shift of a flat load lands in the best ~5 hours, not all in the best one;
//   * moving stops early when the next source is no dirtier than the next destination, so the
//     share never falls; hours with no share number are neither source nor destination.
// Returns { share, moved (fraction actually moved), from, to, weights (the shifted weights) }.
export function shiftable(profile24, weights, fraction = FLEX_FRACTION) {
  const base = cleanShareFor(profile24, weights)
  if (base == null) return { share: null, moved: 0, from: [], to: [], weights: isArr24(weights) ? weights.slice(0, H) : null }
  const w = Array.from({ length: H }, (_, h) => Math.max(0, num(weights[h]) ?? 0))
  const total = sum(w)
  const f = Math.min(1, Math.max(0, num(fraction) ?? 0))
  let budget = f * total
  const eps = 1e-12
  const src = ranked(profile24, -1).map(r => r.h).filter(h => w[h] > eps)   // dirtiest first
  const dst = ranked(profile24, 1).map(r => r.h)                             // cleanest first
  const room = w.slice()                                                     // extra each hour may take (cap 2x)
  const out = w.slice(), from = new Set(), to = new Set()
  let moved = 0, i = 0, j = 0
  while (budget > eps && i < src.length && j < dst.length) {
    const s = src[i], d = dst[j]
    if (s === d || num(profile24[s]) >= num(profile24[d])) break   // no cleaner hour left to move into
    if (room[d] <= eps) { j++; continue }
    if (out[s] <= eps) { i++; continue }
    const amt = Math.min(budget, out[s], room[d])
    out[s] -= amt; out[d] += amt; room[d] -= amt; budget -= amt; moved += amt
    from.add(s); to.add(d)
    if (out[s] <= eps) i++
    if (room[d] <= eps) j++
  }
  return { share: cleanShareFor(profile24, out), moved: total > 0 ? moved / total : 0, from: [...from].sort((a, b) => a - b), to: [...to].sort((a, b) => a - b), weights: out }
}

// Every shape's share on this profile, plus `flexible20` (a flat load with a fifth shifted).
// { shapes: [{ id, label, share }], flexible20: { id, label, share, moved, from, to }, byId, best }
export function compareShapes(profile24) {
  const shapes = SHAPES.map(s => ({ id: s.id, label: s.label, share: cleanShareFor(profile24, s.weights) }))
  const flat = shapeById('flat')
  const fx = shiftable(profile24, flat.weights, FLEX_FRACTION)
  const flexible20 = { id: 'flexible20', label: FLEX_LABEL, share: fx.share, moved: fx.moved, from: fx.from, to: fx.to }
  const byId = Object.fromEntries([...shapes, flexible20].map(s => [s.id, s]))
  const scored = [...shapes, flexible20].filter(s => s.share != null)
  const best = scored.length ? scored.reduce((a, b) => (b.share > a.share ? b : a)).id : null
  return { shapes, flexible20, byId, best }
}

// MW of the load that is not carbon-free: load x (1 - share). Other/unknown counts as not clean.
export const fossilMW = (loadMW, share) => { const l = num(loadMW), s = num(share); return l == null || s == null ? null : l * (1 - s) }

// ---- reading a region detail ------------------------------------------------------------
// The hourly profile is generation-side, so a zone's is its parent grid's (the export already
// copies it onto the zone with cf_inherited_from_ba: true; fixtures also carry `parent`).
const yearMap = p => (p != null && typeof p === 'object' && !Array.isArray(p) ? p : null)
const latestYear = m => Object.keys(m).filter(k => /^\d{4}$/.test(k) && isArr24(m[k])).sort().pop() || null
// The year map ({ "2019": [...], "2025": [...] }) for a detail, or null.
export function profilesOf(detail) {
  const raw = detail?.profile_24h ?? detail?.parent?.profile_24h ?? null
  const m = yearMap(raw)
  return m && latestYear(m) ? m : null
}
// The 24-hour profile for `year` (default 2025), falling back to the latest year in the map.
export function profileOf(detail, year = '2025') {
  const raw = detail?.profile_24h ?? detail?.parent?.profile_24h ?? null
  if (isArr24(raw)) return raw
  const m = yearMap(raw)
  if (!m) return null
  const y = isArr24(m[year]) ? year : latestYear(m)
  return y ? m[y] : null
}

// ---- words ------------------------------------------------------------------------------
// 12-hour clock words: 0 -> midnight, 12 -> noon, 9 -> 9am, 16 -> 4pm.
export const hourWord = h => { const x = ((Math.round(h) % H) + H) % H; return x === 0 ? 'midnight' : x === 12 ? 'noon' : x < 12 ? `${x}am` : `${x - 12}pm` }
// "10am to 4pm" for hours 10..15; wraps midnight ("10pm to 4am"); several runs join with "and".
export function hourSpanWords(hours) {
  const hs = [...new Set((hours || []).map(h => num(h)).filter(h => h != null && h >= 0 && h < H))].sort((a, b) => a - b)
  if (!hs.length) return ''
  if (hs.length === H) return 'all day'
  const runs = []
  for (const h of hs) { const r = runs[runs.length - 1]; if (r && r.end === h - 1) r.end = h; else runs.push({ start: h, end: h }) }
  if (runs.length > 1 && runs[0].start === 0 && runs[runs.length - 1].end === H - 1) { const last = runs.pop(); runs[0].start = last.start }   // wrap past midnight
  const words = runs.map(r => (r.start === r.end ? hourWord(r.start) : `${hourWord(r.start)} to ${hourWord(r.end + 1)}`))
  return words.length <= 2 ? words.join(' and ') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

const mwWords = x => { const v = num(x); return v == null ? 'load' : `${Math.round(v).toLocaleString('en-US')} MW` }
const PHRASE = { business: 'on business hours', overnight: 'run overnight-heavy', solar: 'following the daylight' }

// One plain sentence from the numbers, e.g. "In Northern Virginia a flat 300 MW runs on 39%
// clean power; the same load on business hours gets 41%, and shifting a fifth of it into the
// cleanest six hours (10am to 4pm) gets 41%." Whole percents unless two of the figures would
// collide, then one decimal. Always returns a string.
export function describeShape(regionLabel, profile24, loadMW = 300) {
  const where = regionLabel ? `In ${regionLabel}` : 'Here'
  const cmp = compareShapes(profile24)
  const flat = cmp.byId.flat?.share
  if (flat == null) return `${where} there is no hourly clean-share profile, so a load shape cannot be scored.`
  const alt = cmp.shapes.filter(s => s.id !== 'flat' && s.share != null).sort((a, b) => b.share - a.share)[0] || null
  const flex = cmp.flexible20.share
  const figures = [flat, alt?.share, flex].filter(x => x != null)
  const whole = new Set(figures.map(x => Math.round(x * 100))).size === figures.length
  const pc = x => `${whole ? Math.round(x * 100) : (x * 100).toFixed(1)}%`
  let s = `${where} a flat ${mwWords(loadMW)} runs on ${pc(flat)} clean power`
  if (alt) s += `; the same load ${PHRASE[alt.id] || `as ${alt.label}`} ${alt.share >= flat ? 'gets' : 'falls to'} ${pc(alt.share)}`
  if (flex != null) {
    const six = bestHours(profile24, 6)
    const span = hourSpanWords(six.hours)
    s += `${alt ? ',' : ';'} and shifting a fifth of it into the cleanest six hours${span ? ` (${span})` : ''} ${flex >= flat ? 'gets' : 'leaves it at'} ${pc(flex)}`
  }
  return `${s}.`
}
