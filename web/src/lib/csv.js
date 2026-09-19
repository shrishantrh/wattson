// CSV twin for every chart. Ported unchanged from dashboard/src/csv.js.
const esc = v => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))

export function toCSV(columns, rows) {
  const head = columns.map(c => esc(c.label || c.key)).join(',')
  const body = rows.map(r => columns.map(c => esc(c.raw ? c.raw(r) : r[c.key])).join(','))
  return [head, ...body].join('\n')
}

export function downloadCSV(name, columns, rows) {
  const blob = new Blob([toCSV(columns, rows)], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = `${name.replace(/[^\w.-]+/g, '_')}.csv`
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
