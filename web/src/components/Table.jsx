/* oxlint-disable react/only-export-components -- sortRows, filterRows, nextSort and the cell helpers are pure and exported for tests */
import { useMemo, useState } from 'react'
import { downloadCSV } from '../lib/csv.js'
import '../styles/workspace.css'

// <Table columns rows sortKey defaultSort onRowClick rowHref rowKey filter csvName dense maxHeight />
// columns: [{ key, label, raw?(row) -> value, num?, format?(value, row) -> text, render?(row) -> node,
//            width?, sortable?: false, sortValue?(row), csv?: false, title?, dim? }]
// Sort and filter are pure (exported below); the CSV carries the rows as currently sorted and
// filtered, with `raw` values where a column defines them.

const isNum = x => typeof x === 'number' && Number.isFinite(x)
const isNil = x => x == null || x === '' || (typeof x === 'number' && Number.isNaN(x))
const numFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })
const SEP = ' / '

export const cellValue = (col, row) => (col.raw ? col.raw(row) : row[col.key])

export function cellText(col, row) {
  const v = cellValue(col, row)
  if (col.format) return String(col.format(v, row) ?? '')
  if (isNil(v)) return '—'
  return isNum(v) ? numFmt.format(v) : String(v)
}

export function compareValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b ? 0 : a ? -1 : 1
  return collator.compare(String(a), String(b))
}

// Pure. Nulls sort last in both directions; ties keep input order.
export function sortRows(rows, columns, sort) {
  if (!sort?.key) return rows
  const col = columns.find(c => c.key === sort.key)
  if (!col) return rows
  const get = col.sortValue || (r => cellValue(col, r))
  const dir = sort.dir === 'desc' ? -1 : 1
  return rows.map((r, i) => ({ r, i, v: get(r) })).sort((a, b) => {
    const an = isNil(a.v), bn = isNil(b.v)
    if (an || bn) return an && bn ? a.i - b.i : an ? 1 : -1
    return (compareValues(a.v, b.v) * dir) || a.i - b.i
  }).map(x => x.r)
}

// Pure. Same column: flip. New column: numbers start descending, text ascending.
export function nextSort(sort, key, col) {
  if (sort?.key === key) return { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
  return { key, dir: col?.num ? 'desc' : 'asc' }
}

// Pure. Initial sort from `sortKey` (a key) or `defaultSort` ({ key, dir } | 'key' | '-key').
export function parseSort(sortKey, defaultSort, columns) {
  if (defaultSort && typeof defaultSort === 'object' && defaultSort.key) return { key: defaultSort.key, dir: defaultSort.dir === 'desc' ? 'desc' : 'asc' }
  const s = typeof defaultSort === 'string' ? defaultSort : sortKey
  if (!s) return null
  if (s.startsWith('-')) return { key: s.slice(1), dir: 'desc' }
  if (s.startsWith('+')) return { key: s.slice(1), dir: 'asc' }
  return nextSort(null, s, columns.find(c => c.key === s))
}

export const rowHaystack = (columns, row) => columns.map(c => cellText(c, row)).join(SEP).toLowerCase()

// Pure. Every whitespace-separated term must appear in some cell's display text.
export function filterRows(rows, columns, q) {
  const terms = String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return rows
  return rows.filter(r => { const h = rowHaystack(columns, r); return terms.every(t => h.includes(t)) })
}

const plural = n => `${n} row${n === 1 ? '' : 's'}`
const NONE = []

export default function Table({ columns, rows, sortKey, defaultSort, onSortChange, onRowClick, rowHref, rowKey, filter = false, filterPlaceholder, csvName, dense = false, emptyText = 'No rows', maxHeight, className = '', toolbar }) {
  const [sort, setSort] = useState(() => parseSort(sortKey, defaultSort, columns))
  const [q, setQ] = useState('')
  const filtered = useMemo(() => filterRows(rows || NONE, columns, q), [rows, columns, q])
  const sorted = useMemo(() => sortRows(filtered, columns, sort), [filtered, columns, sort])
  const total = rows ? rows.length : 0
  const clickable = !!(onRowClick || rowHref)
  const showBar = !!(filter || csvName || toolbar)
  const keyOf = (r, i) => (rowKey ? rowKey(r) : r.id ?? r.key ?? r.region_id ?? r.ticker ?? i)
  const onHeader = col => { const n = nextSort(sort, col.key, col); setSort(n); if (onSortChange) onSortChange(n) }
  const go = (r, e) => {
    if (e.defaultPrevented) return
    if (e.target && e.target.closest && e.target.closest('a, button, input, [data-noclick]')) return
    if (onRowClick) { onRowClick(r, e); return }
    const h = rowHref ? rowHref(r) : null
    if (!h) return
    if (e.metaKey || e.ctrlKey || e.shiftKey) { window.open(h, '_blank'); return }
    window.location.assign(h)   // works for '#/...' too and fires hashchange
  }
  return (
    <div className={`tbl ${dense ? 'dense' : ''} ${className}`}>
      {showBar && (
        <div className="tbl-bar">
          {filter && <input className="tbl-filter" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={filterPlaceholder || (typeof filter === 'string' ? filter : 'Filter rows')} aria-label="Filter rows" />}
          {toolbar}
          <span className="tbl-count">{q ? `${sorted.length} of ${plural(total)}` : plural(total)}</span>
          {csvName && <button type="button" className="tbl-csv" onClick={() => downloadCSV(csvName, columns.filter(c => c.csv !== false), sorted)} disabled={!sorted.length} title="Download these rows as CSV">CSV</button>}
        </div>
      )}
      <div className={`tbl-wrap ${maxHeight ? 'scroll' : ''}`} style={maxHeight ? { maxHeight } : undefined}>
        <table>
          <colgroup>{columns.map(c => <col key={c.key} style={c.width ? { width: c.width } : undefined} />)}</colgroup>
          <thead>
            <tr>
              {columns.map(c => {
                const on = sort?.key === c.key
                const text = c.label ?? c.key
                return (
                  <th key={c.key} className={`${c.num ? 'num' : ''} ${on ? 'on' : ''}`} aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined} title={c.title}>
                    {c.sortable === false
                      ? <span className="tbl-th">{text}</span>
                      : <button type="button" onClick={() => onHeader(c)}>{text}<span className="tbl-sort" aria-hidden="true">{on && sort.dir === 'asc' ? '▴' : '▾'}</span></button>}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const h = rowHref ? rowHref(r) : null
              return (
                <tr key={keyOf(r, i)} className={clickable ? 'clickable' : ''} tabIndex={clickable ? 0 : undefined} onClick={clickable ? e => go(r, e) : undefined} onKeyDown={clickable ? e => { if (e.key === 'Enter') go(r, e) } : undefined}>
                  {columns.map((c, ci) => {
                    const node = c.render ? c.render(r) : cellText(c, r)
                    return <td key={c.key} className={`${c.num ? 'num' : ''} ${c.dim ? 'dim' : ''}`}>{ci === 0 && h ? <a className="tbl-link" href={h} tabIndex={-1}>{node}</a> : node}</td>
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
        {sorted.length === 0 && <div className="tbl-empty">{q ? `No rows match “${q}”` : emptyText}</div>}
      </div>
    </div>
  )
}
