// Number and label formatting. No JSX here; Badge lives in charts/DataTable.jsx.
export const YEARS = ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026']

const bad = x => x == null || Number.isNaN(Number(x))

// fmt(1234.5) -> "1,235"; fmt(x, 2) -> two fixed decimals; null -> em dash.
export const fmt = (x, d = 0) => (bad(x) ? ', ' : Number(x).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }))
// pct(0.433) -> "43.3%". All shares in this project are 0-1 fractions.
export const pct = (x, d = 1) => (bad(x) ? ', ' : `${(Number(x) * 100).toFixed(d)}%`)
// pts(0.042) -> "+4.2 pts" (a change in a share, in percentage points).
export const pts = (x, d = 1) => (bad(x) ? ', ' : `${Number(x) > 0 ? '+' : ''}${(Number(x) * 100).toFixed(d)} pts`)
// signed(8.7) -> "+8.7"; signed(-2.5) -> "-2.5".
export const signed = (x, d = 1) => (bad(x) ? ', ' : `${Number(x) > 0 ? '+' : ''}${Number(x).toFixed(d)}`)
// gw(8700) -> "8.7 GW". Input is MW.
export const gw = (x, d = 1) => (bad(x) ? ', ' : `${(Number(x) / 1000).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })} GW`)
// mw(35619) -> "35,619 MW".
export const mw = x => (bad(x) ? ', ' : `${Math.round(Number(x)).toLocaleString('en-US')} MW`)

export const regionHref = id => `#/region/${encodeURIComponent(id)}`
export const patternClass = p => (p === 'flat-load growth' ? 'flat' : p === 'possible midday solar suppression' ? 'solar' : '')
