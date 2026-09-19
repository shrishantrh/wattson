import { patternClass } from '../lib/format.js'

// The table twin of a chart. Columns: { key, label, num?, render?(row), raw?(row) }.
// `num` columns get the `num` class (the shell right-aligns them with tabular figures).
export default function DataTable({ columns, rows, rowKey }) {
  return (
    <div className="tablewrap">
      <table className="data">
        <thead><tr>{columns.map(c => <th key={c.key} className={c.num ? 'num' : ''}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={rowKey ? rowKey(r) : i}>{columns.map(c => <td key={c.key} className={c.num ? 'num' : ''}>{c.render ? c.render(r) : r[c.key]}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}

// Pattern label pill. Descriptive only; never touches the score.
export function Badge({ p }) { return <span className={`badge ${patternClass(p)}`}>{p}</span> }
