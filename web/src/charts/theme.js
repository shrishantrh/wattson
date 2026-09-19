// Plotly theme built from the shell's CSS custom properties at call time.
// Nothing here is a constant color: swap a token on :root and every chart follows.
//
// Color semantics, fixed everywhere:
//   overnight = accent, daytime = ink-2, all hours = muted.
//   fuels: gas is the only colored fuel (accent); everything else is a gray ladder.
//   heatmaps: bg -> grays -> accent (SEQ).

const FALLBACK = {
  bg: '#0a0a0b', surface: '#131316', 'surface-2': '#1b1b1f', ink: '#ececea', 'ink-2': '#a6a6a2', muted: '#6f6f6b',
  line: '#26262a', accent: '#f2b34c', 'accent-soft': 'rgba(242,179,76,0.16)',
  'font-ui': 'system-ui, -apple-system, "Segoe UI", sans-serif', 'font-mono': 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
}

let cssCache = null
function readVar(name) {
  if (cssCache === null) {
    cssCache = false
    try { if (typeof document !== 'undefined' && typeof getComputedStyle === 'function') cssCache = getComputedStyle(document.documentElement) } catch { cssCache = false }
  }
  const v = cssCache ? cssCache.getPropertyValue(`--${name}`).trim() : ''
  return v || FALLBACK[name]
}

// Read the live tokens. Cheap enough to call per chart build; not cached so a theme swap is picked up.
export function tokens() {
  cssCache = null
  return {
    bg: readVar('bg'), surface: readVar('surface'), surface2: readVar('surface-2'), ink: readVar('ink'), ink2: readVar('ink-2'), muted: readVar('muted'),
    line: readVar('line'), accent: readVar('accent'), accentSoft: readVar('accent-soft'), fontUI: readVar('font-ui'), fontMono: readVar('font-mono'),
  }
}

// -- tiny color helpers (sRGB; the ladder is grays, so perceptual mixing is not needed) --
const isHex = h => typeof h === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h)
const hex2rgb = h => { const s = h.slice(1); const f = s.length === 3 ? s.split('').map(c => c + c).join('') : s; const n = parseInt(f, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
export const alpha = (hex, a) => (isHex(hex) ? `rgba(${hex2rgb(hex).join(',')},${a})` : `rgba(128,128,128,${a})`)   // non-hex token: neutral translucent gray
export const mix = (a, b, t) => { if (!isHex(a) || !isHex(b)) return t < 0.5 ? a : b; const A = hex2rgb(a), B = hex2rgb(b); return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}` }

// -- series colors --
export const seriesColors = (t = tokens()) => ({ overnight: t.accent, daytime: t.ink2, all: t.muted })

// -- fuels --
// Stack order: clean group (light -> darker), neutral "other", then the fossil group with gas first.
export const FUEL_ORDER = ['nuclear', 'hydro', 'wind', 'solar', 'geothermal', 'other', 'gas', 'coal', 'oil']
export const CLEAN_FUELS = ['nuclear', 'hydro', 'wind', 'solar', 'geothermal']
export const FOSSIL_FUELS = ['gas', 'coal', 'oil']
export const FUEL_COLORS = (t = tokens()) => ({
  // clean ladder: evenly spaced in lightness from ink down to line (about 13 dE per step, the most a gray ladder allows)
  nuclear: t.ink,                    // lightest
  hydro: mix(t.ink, t.ink2, 0.6),
  wind: mix(t.ink2, t.muted, 0.3),
  solar: t.muted,
  geothermal: mix(t.muted, t.line, 0.5),
  other: t.line,
  gas: t.accent,                     // the only colored fuel: the thing being burned
  coal: mix(t.muted, t.line, 0.3),   // mid gray, hatched
  oil: mix(t.muted, t.line, 0.8),    // darker gray, hatched
})
// Coal and oil sit in the same lightness band as solar/geothermal, so they also carry a hatch (secondary encoding).
export const FUEL_PATTERN = { coal: '/', oil: 'x' }

// -- sequential colorscale for heatmaps: bg through grays up to the accent at 1 --
export const SEQ = (t = tokens()) => [[0, t.bg], [0.25, mix(t.bg, t.muted, 0.35)], [0.5, mix(t.bg, t.muted, 0.8)], [0.75, mix(t.muted, t.ink2, 0.7)], [1, t.accent]]

// -- layout --
const axis = (t, o = {}) => ({
  gridcolor: t.line, zerolinecolor: t.line, linecolor: t.line, showline: false,
  tickfont: { family: t.fontMono, color: t.muted, size: 11 }, title: { font: { family: t.fontUI, color: t.muted, size: 11 }, standoff: 8 },
  spikecolor: t.line, spikethickness: 1,
  ...o,
})

export function layout({ xaxis = {}, yaxis = {}, legend = {}, margin = {}, ...rest } = {}, t = tokens()) {
  return {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: t.fontUI, color: t.ink2, size: 12 },
    margin: { t: 28, r: 12, l: 52, b: 40, ...margin },
    hovermode: 'x unified',
    hoverlabel: { bgcolor: t.surface, bordercolor: t.line, font: { family: t.fontUI, color: t.ink, size: 12 }, align: 'left' },
    // no legend box: transparent, borderless, horizontal above the plot
    legend: { orientation: 'h', x: 0, y: 1.14, bgcolor: 'rgba(0,0,0,0)', borderwidth: 0, font: { family: t.fontUI, color: t.ink2, size: 11 }, ...legend },
    xaxis: axis(t, xaxis), yaxis: axis(t, yaxis),
    ...rest,
  }
}

// null out anything Plotly would choke on (undefined, NaN) so gaps render as gaps
const clean = y => (Array.isArray(y) ? y.map(v => (v == null || Number.isNaN(Number(v)) ? null : v)) : y)

export function line(name, x, y, color, extra = {}, t = tokens()) {
  const tr = { type: 'scatter', mode: 'lines+markers', name, x, y: clean(y), line: { color, width: 2 }, marker: { color, size: 8, line: { color: t.surface, width: 2 } }, connectgaps: false }
  for (const [k, v] of Object.entries(extra)) { if (v === undefined) delete tr[k]; else tr[k] = v }   // Plotly rejects explicit undefined
  return tr
}

// a quieter line for reference series ("all hours", totals)
export const thinLine = (name, x, y, color, extra = {}, t = tokens()) => line(name, x, y, color, { line: { color, width: 1.5 }, marker: { color, size: 6, line: { color: t.surface, width: 2 } }, ...extra }, t)

export function bars(name, x, y, color, extra = {}, t = tokens()) {
  const tr = { type: 'bar', name, x, y: clean(y), marker: { color, line: { color: t.surface, width: 2 } } }   // 2px surface gap between fills
  for (const [k, v] of Object.entries(extra)) { if (v === undefined) delete tr[k]; else tr[k] = v }
  return tr
}
