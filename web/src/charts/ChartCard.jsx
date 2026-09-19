import { Component, useState } from 'react'
import Plot from './Plot.jsx'
import DataTable from './DataTable.jsx'
import { downloadCSV } from '../lib/csv.js'

// One bad chart must never blank the page mid-demo. Clears the error when `resetKey` (the data) changes.
class Boundary extends Component {
  constructor(p) { super(p); this.state = { err: null, resetKey: p.resetKey } }
  static getDerivedStateFromError(err) { return { err } }
  static getDerivedStateFromProps(props, state) { return props.resetKey !== state.resetKey ? { err: null, resetKey: props.resetKey } : null }
  render() {
    return this.state.err
      ? <div className="banner banner-error">Chart failed to render: {String(this.state.err.message || this.state.err)}</div>
      : this.props.children
  }
}

// Every chart ships with a table twin and a CSV button. The table is never the default view;
// it lives behind the toggle (primary screens show charts only).
//
// Usage: <ChartCard title="..." chart={profile24h(region)} /> or pass data/layout/table directly.
export default function ChartCard({ title, note, chart, data, layout, table, height = 300, csvName, actions, children, className = '' }) {
  const [view, setView] = useState('chart')
  const d = chart?.data ?? data ?? []
  const l = chart?.layout ?? layout ?? {}
  const tb = chart?.table ?? table
  const hasTable = !!(tb && tb.columns?.length && tb.rows?.length)
  const empty = chart?.empty || d.length === 0
  return (
    <section className={`card ${className}`.trim()}>
      <header className="card-head">
        <div>
          {title && <h3 className="card-title">{title}</h3>}
          {note && <p className="card-note">{note}</p>}
        </div>
        <div className="card-actions">
          {actions}
          {hasTable && <button type="button" className={`btn ${view === 'table' ? 'active' : ''}`.trim()} onClick={() => setView(v => (v === 'chart' ? 'table' : 'chart'))}>{view === 'chart' ? 'Table' : 'Chart'}</button>}
          {hasTable && <button type="button" className="btn" onClick={() => downloadCSV(csvName || title || 'chart', tb.columns, tb.rows)}>CSV</button>}
        </div>
      </header>
      {view === 'table' && hasTable
        ? <DataTable columns={tb.columns} rows={tb.rows} />
        : empty
          ? <div className="banner">No data for this chart.</div>
          : <Boundary resetKey={d}><Plot data={d} layout={l} height={height} /></Boundary>}
      {children}
    </section>
  )
}
