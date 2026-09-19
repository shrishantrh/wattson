import DataTable from '../DataTable.jsx'
import { downloadCSV } from '../csv.js'
import { Badge, regionHref, signed } from '../util.jsx'

export default function Operators({ regions }) {
  const rows = regions.filter(r => r.operators.length).sort((a, b) => (a.detection?.rank ?? 999) - (b.detection?.rank ?? 999))
    .flatMap(r => r.operators.map(o => ({ ...o, region: r.id, name: r.name, rank: r.detection?.rank, growth: r.detection?.growth_pct, pattern: r.detection?.pattern })))
  const columns = [
    { key: 'rank', label: 'Rank', num: true, render: o => o.rank ?? '—' }, { key: 'region', label: 'Region', render: o => <a href={regionHref(o.region)}>{o.region}</a>, raw: o => o.region },
    { key: 'name', label: 'Name', render: o => <span className="ink2">{o.name}</span> }, { key: 'growth', label: 'Growth 19→25', num: true, render: o => (o.growth == null ? '—' : `${signed(o.growth, 1)}%`) },
    { key: 'pattern', label: 'Pattern', render: o => (o.pattern ? <Badge p={o.pattern} /> : '—') },
    { key: 'utility', label: 'Utility' }, { key: 'role', label: 'Role' }, { key: 'parent', label: 'Parent' }, { key: 'ticker', label: 'Ticker', render: o => o.ticker || <span className="muted">none</span>, raw: o => o.ticker || '' },
  ]
  return (
    <>
      <section className="hero"><h1>Who serves the flagged load</h1>
        <p>Zone → serving utility → parent → ticker for the top flagged regions. Hand-mapped from public service-territory information in September 2026, not derived from the data. Public power, cooperatives and federal marketers have no ticker. This is a who-serves-the-load table, not an investment view; we make no claims about prices.</p></section>
      <section className="card"><header className="card-head"><div><h3>{rows.length} operator rows</h3></div><div className="card-actions"><button className="btn" onClick={() => downloadCSV('operators', columns, rows)}>CSV</button></div></header>
        <DataTable columns={columns} rows={rows} /></section>
    </>
  )
}
