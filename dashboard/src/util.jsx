export const YEARS = ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026']
export const fmt = (x, d = 0) => (x == null || Number.isNaN(Number(x)) ? '—' : Number(x).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }))
export const pct = (x, d = 1) => (x == null ? '—' : `${(x * 100).toFixed(d)}%`)
export const pts = (x, d = 1) => (x == null ? '—' : `${x > 0 ? '+' : ''}${(x * 100).toFixed(d)} pts`)
export const signed = (x, d = 1) => (x == null ? '—' : `${x > 0 ? '+' : ''}${Number(x).toFixed(d)}`)
export const regionHref = id => `#/region/${encodeURIComponent(id)}`
export const patternClass = p => (p === 'flat-load growth' ? 'flat' : p === 'possible midday solar suppression' ? 'solar' : '')
export function Badge({ p }) { return <span className={`badge ${patternClass(p)}`}>{p}</span> }
