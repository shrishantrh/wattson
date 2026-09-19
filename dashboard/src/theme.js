// Validated palette (light surface). Colors follow the entity everywhere:
// overnight is always blue, daytime always orange, each fuel keeps one hue.
export const C = { blue: '#2a78d6', orange: '#eb6834', aqua: '#1baf7a', yellow: '#eda100', magenta: '#e87ba4', green: '#008300', violet: '#4a3aa7', red: '#e34948',
  surface: '#fcfcfb', page: '#f9f9f7', ink: '#0b0b0b', ink2: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7' }
export const FUEL_COLORS = { nuclear: C.violet, hydro: C.blue, wind: C.aqua, solar: C.yellow, geothermal: C.green, gas: C.orange, coal: '#52514e', oil: C.magenta, other: C.muted }
// stack order: clean group, neutral "other", fossil group (adjacent pairs validated with the palette script)
export const FUEL_ORDER = ['nuclear', 'hydro', 'wind', 'solar', 'geothermal', 'other', 'gas', 'coal', 'oil']
export const SEQ = [[0, '#cde2fb'], [0.25, '#9ec5f4'], [0.5, '#5598e7'], [0.75, '#256abf'], [1, '#0d366b']]
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'
const axis = (o = {}) => ({ gridcolor: C.grid, zerolinecolor: C.axis, linecolor: C.axis, tickfont: { color: C.muted, size: 11 }, title: { font: { color: C.muted, size: 11 } }, ...o })
export function layout({ xaxis = {}, yaxis = {}, ...rest } = {}) {
  return { paper_bgcolor: C.surface, plot_bgcolor: C.surface, font: { family: FONT, color: C.ink2, size: 12 },
    margin: { t: 28, r: 14, l: 56, b: 44 }, hovermode: 'x unified',
    hoverlabel: { bgcolor: '#ffffff', bordercolor: C.axis, font: { color: C.ink, size: 12, family: FONT } },
    legend: { orientation: 'h', y: 1.14, x: 0, font: { color: C.ink2, size: 11 } }, xaxis: axis(xaxis), yaxis: axis(yaxis), ...rest }
}
export function line(name, x, y, color, extra = {}) {
  const t = { type: 'scatter', mode: 'lines+markers', name, x, y, line: { color, width: 2 }, marker: { color, size: 8, line: { color: C.surface, width: 2 } }, connectgaps: false }
  for (const [k, v] of Object.entries(extra)) { if (v === undefined) delete t[k]; else t[k] = v }   // Plotly rejects explicit undefined
  return t
}
export const bars = (name, x, y, color, extra = {}) => ({ type: 'bar', name, x, y, marker: { color, line: { color: C.surface, width: 2 } }, ...extra })
