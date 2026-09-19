import { Component, useState } from 'react'
import Plot from './Plot.jsx'
import DataTable from './DataTable.jsx'
import { downloadCSV } from './csv.js'

// One bad chart must never blank the page mid-demo.
class Boundary extends Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  render() { return this.state.err ? <div className="banner flag">Chart failed to render: {String(this.state.err.message || this.state.err)}</div> : this.props.children }
}

// Every chart ships with a table twin and a CSV button.
export default function ChartCard({ title, note, data, layout, height = 300, table, csvName, children }) {
  const [view, setView] = useState('chart')
  return (
    <section className="card">
      <header className="card-head">
        <div><h3>{title}</h3>{note && <p className="note">{note}</p>}</div>
        <div className="card-actions">
          {table && <button className={`btn ${view === 'table' ? 'active' : ''}`} onClick={() => setView(v => (v === 'chart' ? 'table' : 'chart'))}>{view === 'chart' ? 'Table' : 'Chart'}</button>}
          {table && <button className="btn" onClick={() => downloadCSV(csvName || title, table.columns, table.rows)}>CSV</button>}
        </div>
      </header>
      {view === 'chart' ? <Boundary><Plot data={data} layout={layout} height={height} /></Boundary> : <DataTable columns={table.columns} rows={table.rows} />}
      {children}
    </section>
  )
}
