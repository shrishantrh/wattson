import { useMemo, useState } from 'react'
import DataTable from '../DataTable.jsx'
import { downloadCSV } from '../csv.js'
import { fmt, pct, regionHref } from '../util.jsx'

const PRIORITY = ['detector_top10', 'demand_up_20pct', 'cf_share_down_3pts', 'gas_share_up_3pts_yoy', 'clean_mw_below_2019', 'demand_record_high']
const value = a => (a.unit === 'share' ? pct(a.current_value) : a.unit === 'rank' ? `rank ${a.current_value}` : `${fmt(a.current_value)} MW`)
const threshold = a => (a.threshold == null ? '—' : a.unit === 'share' ? (a.rule === 'gas_share_up_3pts_yoy' ? '+3.0 pts YoY' : pct(a.threshold)) : a.unit === 'rank' ? `≤ ${a.threshold}` : `${fmt(a.threshold)} MW`)

export default function Alerts({ alerts, regions }) {
  const [rule, setRule] = useState('all'); const [onlyActive, setOnlyActive] = useState(true); const [q, setQ] = useState('')
  const flagged = new Set(regions.filter(r => r.exclude_from_alerts).map(r => r.id))
  const rows = useMemo(() => alerts.alerts
    .filter(a => (!onlyActive || a.active) && (rule === 'all' || a.rule === rule) && (!q || `${a.region} ${a.name}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => PRIORITY.indexOf(a.rule) - PRIORITY.indexOf(b.rule) || (b.months_active_streak || 0) - (a.months_active_streak || 0)), [alerts, rule, onlyActive, q])
  const counts = PRIORITY.map(k => [k, alerts.alerts.filter(a => a.active && a.rule === k).length])
  const columns = [
    { key: 'region', label: 'Region', render: a => <a href={regionHref(a.region)}>{a.region}</a>, raw: a => a.region },
    { key: 'name', label: 'Name', render: a => <span className="ink2">{a.name}</span>, raw: a => a.name },
    { key: 'description', label: 'Rule' },
    { key: 'first_crossed', label: 'First crossed', render: a => a.first_crossed || '—', raw: a => a.first_crossed },
    { key: 'months_active_streak', label: 'Months running', num: true, render: a => a.months_active_streak ?? '—' },
    { key: 'current_value', label: 'Now', num: true, render: value, raw: a => a.current_value },
    { key: 'threshold', label: 'Threshold', num: true, render: threshold, raw: a => a.threshold },
    { key: 'baseline_2019', label: '2019 baseline', num: true, render: a => (a.baseline_2019 == null ? '—' : a.unit === 'share' ? pct(a.baseline_2019) : `${fmt(a.baseline_2019)} MW`), raw: a => a.baseline_2019 },
    { key: 'active', label: 'Status', render: a => (a.active ? <><span className="dot" style={{ background: 'var(--critical)' }} />active</> : <span className="muted">cleared</span>), raw: a => (a.active ? 'active' : 'cleared') },
  ]
  return (
    <>
      <section className="hero">
        <h1>Alerts</h1>
        <p>Threshold rules evaluated on trailing-12-month series (windows end {alerts.latest_month}; partial months dropped). "First crossed" is the first window in which the rule held; for record highs it is the month the current run of new highs began. Only regions the detector scored are evaluated. Excluded by data flag: {alerts.excluded_regions.join(', ') || 'none'}.</p>
        <div className="tiles">{counts.map(([k, n]) => <div className="tile" key={k}><div className="label">{alerts.rules[k]}</div><div className="value">{n}</div><div className="sub">active</div></div>)}</div>
      </section>
      <section className="card">
        <header className="card-head"><div><h3>{rows.length} alerts</h3></div><div className="card-actions"><button className="btn" onClick={() => downloadCSV('alerts', columns, rows)}>CSV</button></div></header>
        <div className="filters">
          <label>rule</label>
          <select value={rule} onChange={e => setRule(e.target.value)}><option value="all">all</option>{PRIORITY.map(k => <option key={k} value={k}>{alerts.rules[k]}</option>)}</select>
          <label><input type="checkbox" checked={onlyActive} onChange={e => setOnlyActive(e.target.checked)} /> active only</label>
          <input placeholder="search region" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <DataTable columns={columns} rows={rows} rowKey={a => `${a.region}-${a.rule}`} />
        {flagged.size > 0 && <p className="note">Flagged regions ({[...flagged].join(', ')}) stay in the ranking but do not raise alerts.</p>}
      </section>
    </>
  )
}
