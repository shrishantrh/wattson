import { useMemo, useState } from 'react'
import ChartCard from '../ChartCard.jsx'
import DataTable from '../DataTable.jsx'
import { downloadCSV } from '../csv.js'
import { C, layout, line } from '../theme.js'
import { Badge, YEARS, fmt, pct, pts, regionHref, signed } from '../util.jsx'

const gap = r => (r.cf_share?.['2025'] ? r.cf_share['2025'].daytime - r.cf_share['2025'].overnight : null)

export default function Landing({ regions, meta, alerts }) {
  const [pattern, setPattern] = useState('all'); const [type, setType] = useState('all'); const [q, setQ] = useState('')
  const scored = useMemo(() => regions.filter(r => r.detection).sort((a, b) => a.detection.rank - b.detection.rank), [regions])
  const rows = scored.filter(r => (pattern === 'all' || r.detection.pattern === pattern) && (type === 'all' || r.type === type) && (!q || `${r.id} ${r.name}`.toLowerCase().includes(q.toLowerCase())))
  const pjm = regions.find(r => r.id === 'PJM'), dom = regions.find(r => r.id === 'PJM/DOM')
  const nat = meta.national
  const active = alerts.alerts.filter(a => a.active).length

  const columns = [
    { key: 'rank', label: '#', num: true, render: r => <span className="rank">{r.detection.rank}</span>, raw: r => r.detection.rank },
    { key: 'id', label: 'Region', render: r => <a href={regionHref(r.id)}>{r.id}</a>, raw: r => r.id },
    { key: 'name', label: 'Name', render: r => <span className="ink2">{r.name}</span>, raw: r => r.name },
    { key: 'type', label: 'Type', render: r => <span className="badge type">{r.type}</span>, raw: r => r.type },
    { key: 'pattern', label: 'Pattern', render: r => <Badge p={r.detection.pattern} />, raw: r => r.detection.pattern },
    { key: 'growth', label: 'Demand growth 19→25', num: true, render: r => `${signed(r.detection.growth_pct, 1)}%`, raw: r => r.detection.growth_pct },
    { key: 'excess', label: 'Overnight excess', num: true, render: r => signed(r.detection.overnight_excess, 1), raw: r => r.detection.overnight_excess },
    { key: 'lf', label: 'Load factor Δ', num: true, render: r => signed(r.detection.load_factor_delta, 3), raw: r => r.detection.load_factor_delta },
    { key: 'div', label: 'Neighbor div.', num: true, render: r => signed(r.detection.neighbor_divergence, 1), raw: r => r.detection.neighbor_divergence },
    { key: 'score', label: 'Score', num: true, render: r => <b>{fmt(r.detection.score, 2)}</b>, raw: r => r.detection.score },
    { key: 'cf', label: 'Overnight CF 2025', num: true, render: r => <>{pct(r.cf_share?.['2025']?.overnight)}{r.cf_inherited_from_ba && <span className="muted" title="inherited from parent BA"> †</span>}</>, raw: r => r.cf_share?.['2025']?.overnight },
    { key: 'gap', label: 'Day − night 2025', num: true, render: r => pts(gap(r)), raw: r => gap(r) },
    { key: 'r26', label: 'Rank Jan–Aug 26', num: true, render: r => r.detection.rank_2026_jan_aug ?? '—', raw: r => r.detection.rank_2026_jan_aug },
    { key: 'flag', label: 'Flag', render: r => (r.exclude_from_alerts ? <span title={r.data_flags.join(' ')}>⚑ data</span> : ''), raw: r => (r.exclude_from_alerts ? 'data flag' : '') },
  ]

  const natYears = nat ? YEARS.filter(y => nat.cf_share[y]) : []
  const natData = nat ? [
    line('overnight (00–05)', natYears, natYears.map(y => nat.cf_share[y].overnight), C.blue),
    line('daytime (10–15)', natYears, natYears.map(y => nat.cf_share[y].daytime), C.orange),
    line('all hours', natYears, natYears.map(y => nat.cf_share[y].all), C.muted, { marker: { color: C.muted, size: 6 }, line: { color: C.muted, width: 1.5 } }),
  ] : []
  const natTable = nat ? { columns: [{ key: 'year', label: 'Year' }, { key: 'overnight', label: 'Overnight share', num: true, render: r => pct(r.overnight) }, { key: 'daytime', label: 'Daytime share', num: true, render: r => pct(r.daytime) }, { key: 'all', label: 'All hours', num: true, render: r => pct(r.all) }, { key: 'clean_night', label: 'Overnight clean MW', num: true, render: r => fmt(r.clean_night) }, { key: 'clean_day', label: 'Daytime clean MW', num: true, render: r => fmt(r.clean_day) }],
    rows: natYears.map(y => ({ year: y, ...nat.cf_share[y], clean_night: nat.cf_avg_mw[y].overnight, clean_day: nat.cf_avg_mw[y].daytime })) } : null

  const g = (r, blk, y, k) => r?.[blk]?.[y]?.[k]
  return (
    <>
      <section className="hero">
        <h1>{meta.headline}</h1>
        <p>Hourly carbon-free share of generation for every US balancing authority from EIA-930 via PUDL, July 2018 to {meta.data_snapshot_end}. Overnight is {meta.overnight_hours_local} local, daytime {meta.daytime_hours_local}. Baseline year {meta.baseline_year}. Generation within a footprint, not consumption; average mix, not marginal.</p>
        <div className="tiles">
          <div className="tile"><div className="label">PJM overnight clean generation</div><div className="value">{fmt(g(pjm, 'cf_avg_mw', '2019', 'overnight'))} → {fmt(g(pjm, 'cf_avg_mw', '2025', 'overnight'))} MW</div><div className="sub">2019 → 2025, flat within 100 MW</div></div>
          <div className="tile"><div className="label">PJM overnight total generation</div><div className="value">{signed((g(pjm, 'total_avg_mw', '2025', 'overnight') - g(pjm, 'total_avg_mw', '2019', 'overnight')) / 1000, 1)} GW</div><div className="sub">gas {signed(pjm?.fuel_delta_overnight_gw?.gas, 1)} GW, coal {signed(pjm?.fuel_delta_overnight_gw?.coal, 1)}, nuclear {signed(pjm?.fuel_delta_overnight_gw?.nuclear, 1)}, wind {signed(pjm?.fuel_delta_overnight_gw?.wind, 1)}</div></div>
          <div className="tile"><div className="label">PJM overnight net export</div><div className="value">{fmt(pjm?.interchange?.['2019']?.overnight_net_export_mw)} → {fmt(pjm?.interchange?.['2025']?.overnight_net_export_mw)} MW</div><div className="sub">serving its own load, not neighbors</div></div>
          <div className="tile"><div className="label">Dominion zone overnight demand</div><div className="value">{signed((g(dom, 'demand', '2025', 'overnight_avg_mw') / g(dom, 'demand', '2019', 'overnight_avg_mw') - 1) * 100, 0)}%</div><div className="sub">{fmt(g(dom, 'demand', '2019', 'overnight_avg_mw'))} → {fmt(g(dom, 'demand', '2025', 'overnight_avg_mw'))} MW; next fastest PJM zone +9%</div></div>
          <div className="tile"><div className="label">National overnight vs daytime, 2025</div><div className="value">{pct(nat?.cf_share?.['2025']?.overnight, 1)} / {pct(nat?.cf_share?.['2025']?.daytime, 1)}</div><div className="sub">2019: {pct(nat?.cf_share?.['2019']?.overnight, 1)} / {pct(nat?.cf_share?.['2019']?.daytime, 1)}. Overnight has not moved.</div></div>
          <div className="tile"><div className="label">Active alerts</div><div className="value">{active}</div><div className="sub"><a href="#/alerts">trailing-12-month threshold rules</a></div></div>
        </div>
      </section>

      {nat && <ChartCard title="National carbon-free share of generation by year" note={`${nat.note} 2026 runs to ${meta.data_snapshot_end}.`} data={natData} layout={layout({ yaxis: { tickformat: '.0%', rangemode: 'tozero' }, xaxis: { dtick: 1 } })} height={260} table={natTable} csvName="national_cf_share_by_year" />}

      <section className="card">
        <header className="card-head">
          <div><h3>Flat-load detector: {scored.length} regions ranked, 2019 → 2025</h3>
            <p className="note">{meta.detector.method}. Validation regions named in advance: {meta.detector.validation_named_in_advance.join(', ')}. † overnight CF inherited from the parent BA (zones report demand only). The detector flags flat 24/7 load in general; results are consistent with, not proof of, datacenter load.</p></div>
          <div className="card-actions"><button className="btn" onClick={() => downloadCSV('detector_ranking', columns, rows)}>CSV</button></div>
        </header>
        <div className="filters">
          <label>pattern</label>
          <select value={pattern} onChange={e => setPattern(e.target.value)}><option value="all">all</option><option>flat-load growth</option><option>mixed</option><option>possible midday solar suppression</option></select>
          <label>type</label>
          <select value={type} onChange={e => setType(e.target.value)}><option value="all">all</option><option value="zone">zone</option><option value="ba">balancing authority</option></select>
          <input placeholder="search region" value={q} onChange={e => setQ(e.target.value)} />
          <span className="muted small">{rows.length} shown</span>
        </div>
        <DataTable columns={columns} rows={rows} rowKey={r => r.id} />
      </section>
    </>
  )
}
