import { useEffect, useMemo, useState } from 'react'
import ChartCard from '../ChartCard.jsx'
import DataTable from '../DataTable.jsx'
import { loadHeatmap } from '../data.js'
import { C, FUEL_COLORS, FUEL_ORDER, SEQ, bars, layout, line } from '../theme.js'
import { Badge, YEARS, fmt, pct, pts, regionHref, signed } from '../util.jsx'

const Tile = ({ label, value, sub }) => <div className="tile"><div className="label">{label}</div><div className="value">{value}</div>{sub && <div className="sub">{sub}</div>}</div>

export default function Region({ id, regions, alerts, meta }) {
  const r = regions.find(x => x.id === id)
  const [hm, setHm] = useState(null)
  useEffect(() => {
    let alive = true; setHm(null)
    if (r?.heatmap_uri) loadHeatmap(r.heatmap_uri).then(h => alive && setHm(h)).catch(() => alive && setHm(false))
    return () => { alive = false }
  }, [r?.heatmap_uri])
  const charts = useMemo(() => (r ? build(r) : null), [r])
  const zr = useMemo(() => zrange(hm), [hm])
  if (!r) return <p>Unknown region: {id}. <a href="#/">Back to the ranking.</a></p>
  const d = r.detection, s = r.siting
  const myAlerts = alerts.filter(a => a.region === r.id && a.active)
  const zones = regions.filter(z => z.type === 'zone' && z.ba === r.id && z.detection).sort((a, b) => a.detection.rank - b.detection.rank)
  const hmTable = hm ? { columns: [{ key: 'day', label: 'Day' }, ...hm.hours.map(h => ({ key: `h${h}`, label: `${h}:00`, num: true, render: row => (row[`h${h}`] == null ? '—' : row[`h${h}`].toFixed(2)) }))],
    rows: hm.days.map((day, i) => Object.fromEntries([['day', day], ...hm.hours.map((h, j) => [`h${h}`, hm.cf_share[i][j]])])) } : null

  return (
    <>
      <section className="hero">
        <div className="small muted"><a href="#/">Regions</a> / {r.type === 'zone' ? <><a href={regionHref(r.ba)}>{r.ba}</a> / zone</> : 'balancing authority'}</div>
        <h1>{r.id} <span className="ink2" style={{ fontWeight: 400 }}>{r.name}</span></h1>
        <p>{r.ba_name}{r.region_eia ? `, ${r.region_eia}` : ''} · local time {r.timezone} {d && <>· <Badge p={d.pattern} /></>}</p>
        {r.data_flags.map((f, i) => <div key={i} className={`banner ${r.exclude_from_alerts ? 'flag' : 'info'}`} style={{ marginTop: 10 }}>{f}</div>)}
        <div className="tiles">
          {d && <>
            <Tile label="Detector rank" value={`${d.rank} / ${d.n_scored}`} sub={`score ${fmt(d.score, 2)}; Jan–Aug 2026 basis: ${d.rank_2026_jan_aug ?? '—'}`} />
            <Tile label="Demand growth 2019 → 2025" value={`${signed(d.growth_pct, 1)}%`} sub={`${fmt(d.avg_mw_2019)} → ${fmt(d.avg_mw_2025)} MW average`} />
            <Tile label="Overnight excess" value={`${signed(d.overnight_excess, 1)} pts`} sub={`overnight grew ${signed(d.overnight_growth_pct, 1)}%`} />
            <Tile label="Load factor Δ (mean / p99.5)" value={signed(d.load_factor_delta, 3)} sub={`raw-peak basis ${signed(d.load_factor_max_delta, 3)}`} />
            <Tile label="Neighbor divergence" value={`${signed(d.neighbor_divergence, 1)} pts`} sub="growth minus median peer growth" />
          </>}
          {s && <>
            <Tile label="Overnight carbon-free share 2025" value={pct(s.overnight_cf_share_2025)} sub={`${pts(s.change_since_2019)} since 2019${r.cf_inherited_from_ba ? ' (parent BA)' : ''}`} />
            <Tile label="Overnight clean MW ÷ demand, 2025" value={fmt(s.overnight_clean_mw_over_demand, 2)} sub={`slope ${signed(s.ratio_slope_per_year, 3)} / yr since 2019`} />
            <Tile label="Siting score" value={s.siting_score == null ? '—' : `${fmt(s.siting_score, 2)} · rank ${s.siting_rank} / ${s.n_ranked}`} sub="mean percentile of share, change, ratio" />
          </>}
        </div>
      </section>

      {hm && <ChartCard title="Carbon-free share, every hour of 2025" note={`365 days × 24 hours, local time. ${r.cf_inherited_from_ba ? `Parent BA (${r.ba}) generation. ` : ''}Light = more fossil, dark = more carbon-free. Color scale spans this region's 1st–99th percentile (${pct(zr[0], 0)}–${pct(zr[1], 0)}); hover for exact values.`}
        data={[{ type: 'heatmap', z: hm.cf_share, x: hm.hours, y: hm.days, colorscale: SEQ, zmin: zr[0], zmax: zr[1], hoverongaps: false, colorbar: { title: { text: 'CF share', font: { color: C.muted, size: 11 } }, thickness: 10, tickfont: { color: C.muted, size: 10 }, tickformat: '.0%' }, hovertemplate: '%{y} %{x}:00<br>carbon-free %{z:.0%}<extra></extra>' }]}
        layout={layout({ hovermode: 'closest', margin: { t: 10, r: 10, l: 60, b: 40 }, xaxis: { title: { text: 'hour of day (local)' }, dtick: 2 }, yaxis: { type: 'date', autorange: 'reversed', tickformat: '%b' } })}
        height={520} table={hmTable} csvName={`${r.ba}_heatmap_2025`} />}
      {hm === false && <div className="banner info">No heatmap for this region.</div>}

      <div className="grid2">
        {charts.profile && <ChartCard title="24-hour carbon-free profile, 2019 vs 2025" note="Generation-weighted share by local hour. Shaded: overnight and daytime windows." data={charts.profile.data} layout={charts.profile.layout} table={charts.profile.table} csvName={`${r.ba}_profile_24h`} />}
        {charts.shares && <ChartCard title="Overnight vs daytime carbon-free share by year" note={`2026 runs to ${meta.data_snapshot_end}.`} data={charts.shares.data} layout={charts.shares.layout} table={charts.shares.table} csvName={`${r.ba}_share_by_year`} />}
        {charts.cleanmw && <ChartCard title="Overnight generation, clean vs total (average MW)" note="Clean = nuclear + hydro + wind + solar + geothermal. The share question in absolute terms." data={charts.cleanmw.data} layout={charts.cleanmw.layout} table={charts.cleanmw.table} csvName={`${r.ba}_overnight_mw`} />}
        {charts.fuel && <ChartCard title="Overnight generation by fuel (average MW)" note="Storage excluded; other = biomass, waste, unclassified." data={charts.fuel.data} layout={charts.fuel.layout} table={charts.fuel.table} csvName={`${r.ba}_overnight_fuel`} />}
        {charts.demand && <ChartCard title="Demand by year (average MW)" note="Average, overnight average, and the 99.5th percentile hour used as peak." data={charts.demand.data} layout={charts.demand.layout} table={charts.demand.table} csvName={`${r.id}_demand`} />}
        {charts.lf && <ChartCard title="Load factor (mean ÷ p99.5 demand)" note="Rises where flat load arrives. Supporting evidence only." data={charts.lf.data} layout={charts.lf.layout} height={240} table={charts.lf.table} csvName={`${r.id}_load_factor`} />}
        {charts.t12 && <ChartCard title="Trailing-12-month carbon-free share" note="Window ending each month; partial months dropped. Gray line = 2019 overnight share." data={charts.t12.data} layout={charts.t12.layout} table={charts.t12.table} csvName={`${r.ba}_trailing12`} />}
        {charts.ix && <ChartCard title="Net interchange by year (average MW)" note="Positive = export from this BA. EIA-adjusted net, operations table." data={charts.ix.data} layout={charts.ix.layout} height={240} table={charts.ix.table} csvName={`${r.ba}_interchange`} />}
      </div>

      {zones.length > 0 && <section className="card"><header className="card-head"><div><h3>Zones inside {r.id}: demand growth and load factor</h3><p className="note">Zones report demand only. Ranks are from the same frozen detector.</p></div></header>
        <DataTable columns={[
          { key: 'rank', label: '#', num: true, render: z => z.detection.rank }, { key: 'id', label: 'Zone', render: z => <a href={regionHref(z.id)}>{z.zone}</a> }, { key: 'name', label: 'Name', render: z => <span className="ink2">{z.name}</span> },
          { key: 'g', label: 'Growth 19→25', num: true, render: z => `${signed(z.detection.growth_pct, 1)}%` }, { key: 'og', label: 'Overnight growth', num: true, render: z => `${signed(z.detection.overnight_growth_pct, 1)}%` },
          { key: 'lf19', label: 'LF 2019', num: true, render: z => fmt(z.demand?.['2019']?.load_factor, 3) }, { key: 'lf25', label: 'LF 2025', num: true, render: z => fmt(z.demand?.['2025']?.load_factor, 3) },
          { key: 'p', label: 'Pattern', render: z => <Badge p={z.detection.pattern} /> }]} rows={zones} rowKey={z => z.id} /></section>}

      {r.operators.length > 0 && <section className="card"><header className="card-head"><div><h3>Who serves this load</h3><p className="note">Hand-mapped from public service-territory information. Not derived from the data; not an investment view.</p></div></header>
        <DataTable columns={[{ key: 'utility', label: 'Utility' }, { key: 'role', label: 'Role' }, { key: 'parent', label: 'Parent' }, { key: 'ticker', label: 'Ticker', render: o => o.ticker || <span className="muted">none (public / co-op / federal)</span> }]} rows={r.operators} /></section>}

      <section className="card"><header className="card-head"><div><h3>Active alerts for {r.id}</h3><p className="note">Trailing-12-month rules; see the Alerts page for definitions.</p></div></header>
        {myAlerts.length === 0 ? <p className="muted small">{r.exclude_from_alerts ? 'Excluded from alerts (data flag).' : 'None.'}</p> :
          <ul className="plain">{myAlerts.map((a, i) => <li key={i}><b>{a.description}</b>{a.first_crossed && <> · first crossed <b>{a.first_crossed}</b></>}{a.months_active_streak ? <>, {a.months_active_streak} months running</> : null}{a.unit === 'MW' && <> · now {fmt(a.current_value)} MW</>}{a.unit === 'share' && <> · now {pct(a.current_value)}</>}</li>)}</ul>}
      </section>
    </>
  )
}

function zrange(hm) {
  if (!hm) return [0, 1]
  const v = hm.cf_share.flat().filter(x => x != null).sort((a, b) => a - b)
  if (!v.length) return [0, 1]
  let lo = v[Math.floor(v.length * 0.01)], hi = v[Math.floor(v.length * 0.99)]
  if (hi - lo < 0.15) { const m = (hi + lo) / 2; lo = m - 0.075; hi = m + 0.075 }
  return [Math.max(0, lo), Math.min(1, hi)]
}

function build(r) {
  const out = {}
  const years = YEARS.filter(y => r.cf_share?.[y])
  const p = r.profile_24h
  if (p && p['2019'] && p['2025']) {
    const hours = [...Array(24).keys()]
    out.profile = { data: [line('2019', hours, p['2019'], C.orange), line('2025', hours, p['2025'], C.blue)],
      layout: layout({ yaxis: { tickformat: '.0%', rangemode: 'tozero' }, xaxis: { dtick: 3, title: { text: 'hour of day (local)' } },
        shapes: [[-0.5, 5.5], [9.5, 15.5]].map(([x0, x1]) => ({ type: 'rect', xref: 'x', yref: 'paper', x0, x1, y0: 0, y1: 1, fillcolor: 'rgba(11,11,11,0.05)', line: { width: 0 }, layer: 'below' })),
        annotations: [{ x: 2.5, y: 1.0, yref: 'paper', text: 'overnight', showarrow: false, font: { color: C.muted, size: 11 } }, { x: 12.5, y: 1.0, yref: 'paper', text: 'daytime', showarrow: false, font: { color: C.muted, size: 11 } }] }),
      table: { columns: [{ key: 'hour', label: 'Hour', num: true }, { key: 'y2019', label: '2019', num: true, render: x => pct(x.y2019) }, { key: 'y2025', label: '2025', num: true, render: x => pct(x.y2025) }], rows: hours.map(h => ({ hour: h, y2019: p['2019'][h], y2025: p['2025'][h] })) } }
  }
  if (years.length) {
    const g = (y, k) => r.cf_share[y]?.[k]
    out.shares = { data: [line('overnight', years, years.map(y => g(y, 'overnight')), C.blue), line('daytime', years, years.map(y => g(y, 'daytime')), C.orange), line('all hours', years, years.map(y => g(y, 'all')), C.muted, { marker: { color: C.muted, size: 6 }, line: { color: C.muted, width: 1.5 } })],
      layout: layout({ yaxis: { tickformat: '.0%', rangemode: 'tozero' }, xaxis: { dtick: 1 } }),
      table: { columns: [{ key: 'year', label: 'Year' }, { key: 'overnight', label: 'Overnight', num: true, render: x => pct(x.overnight) }, { key: 'daytime', label: 'Daytime', num: true, render: x => pct(x.daytime) }, { key: 'all', label: 'All hours', num: true, render: x => pct(x.all) }], rows: years.map(y => ({ year: y, ...r.cf_share[y] })) } }
    const cm = y => r.cf_avg_mw?.[y]?.overnight, tm = y => r.total_avg_mw?.[y]?.overnight
    out.cleanmw = { data: [line('overnight clean MW', years, years.map(cm), C.blue), line('overnight total MW', years, years.map(tm), C.muted, { marker: { color: C.muted, size: 6 }, line: { color: C.muted, width: 1.5 } })],
      layout: layout({ yaxis: { rangemode: 'tozero', tickformat: ',.0f' }, xaxis: { dtick: 1 } }),
      table: { columns: [{ key: 'year', label: 'Year' }, { key: 'clean', label: 'Clean MW', num: true, render: x => fmt(x.clean) }, { key: 'total', label: 'Total MW', num: true, render: x => fmt(x.total) }, { key: 'share', label: 'Share', num: true, render: x => pct(x.share) }], rows: years.map(y => ({ year: y, clean: cm(y), total: tm(y), share: r.cf_share[y]?.overnight })) } }
  }
  const fy = YEARS.filter(y => r.overnight_fuel_mw?.[y])
  if (fy.length) {
    const fuels = FUEL_ORDER.filter(f => fy.some(y => (r.overnight_fuel_mw[y][f] || 0) > 0))
    out.fuel = { data: fuels.map(f => bars(f, fy, fy.map(y => r.overnight_fuel_mw[y][f] || 0), FUEL_COLORS[f])),
      layout: layout({ barmode: 'stack', bargap: 0.35, yaxis: { tickformat: ',.0f', rangemode: 'tozero' }, xaxis: { dtick: 1 }, legend: { orientation: 'h', y: 1.16, x: 0, traceorder: 'normal', font: { size: 11, color: C.ink2 } } }),
      table: { columns: [{ key: 'year', label: 'Year' }, ...fuels.map(f => ({ key: f, label: f, num: true, render: x => fmt(x[f]) }))], rows: fy.map(y => ({ year: y, ...r.overnight_fuel_mw[y] })) } }
  }
  const dy = YEARS.filter(y => r.demand?.[y])
  if (dy.length) {
    const g = (y, k) => r.demand[y]?.[k]
    out.demand = { data: [line('overnight average', dy, dy.map(y => g(y, 'overnight_avg_mw')), C.blue), line('average', dy, dy.map(y => g(y, 'avg_mw')), C.muted, { marker: { color: C.muted, size: 6 }, line: { color: C.muted, width: 1.5 } }), line('p99.5 hour (peak)', dy, dy.map(y => g(y, 'p995_mw')), C.violet)],
      layout: layout({ yaxis: { tickformat: ',.0f', rangemode: 'tozero' }, xaxis: { dtick: 1 } }),
      table: { columns: [{ key: 'year', label: 'Year' }, { key: 'avg_mw', label: 'Average MW', num: true, render: x => fmt(x.avg_mw) }, { key: 'overnight_avg_mw', label: 'Overnight MW', num: true, render: x => fmt(x.overnight_avg_mw) }, { key: 'p995_mw', label: 'p99.5 MW', num: true, render: x => fmt(x.p995_mw) }, { key: 'peak_mw', label: 'Max hour MW', num: true, render: x => fmt(x.peak_mw) }, { key: 'load_factor', label: 'Load factor', num: true, render: x => fmt(x.load_factor, 3) }], rows: dy.map(y => ({ year: y, ...r.demand[y] })) } }
    out.lf = { data: [line('load factor', dy, dy.map(y => g(y, 'load_factor')), C.blue)], layout: layout({ yaxis: { tickformat: '.2f' }, xaxis: { dtick: 1 }, showlegend: false }), table: out.demand.table }
  }
  const t = r.trailing12
  if (t && t.month?.length) {
    const x = t.month.map(m => `${m}-01`)
    const base2019 = r.cf_share?.['2019']?.overnight
    out.t12 = { data: [line('overnight', x, t.overnight_share, C.blue, { mode: 'lines', marker: undefined }), line('daytime', x, t.daytime_share, C.orange, { mode: 'lines', marker: undefined })],
      layout: layout({ yaxis: { tickformat: '.0%', rangemode: 'tozero' }, xaxis: { type: 'date', tickformat: '%Y' }, shapes: base2019 == null ? [] : [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: base2019, y1: base2019, line: { color: C.axis, width: 1 } }] }),
      table: { columns: [{ key: 'month', label: 'Window end' }, { key: 'o', label: 'Overnight share', num: true, render: z => pct(z.o) }, { key: 'd', label: 'Daytime share', num: true, render: z => pct(z.d) }, { key: 'cmw', label: 'Overnight clean MW', num: true, render: z => fmt(z.cmw) }, { key: 'tmw', label: 'Overnight total MW', num: true, render: z => fmt(z.tmw) }], rows: t.month.map((m, i) => ({ month: m, o: t.overnight_share[i], d: t.daytime_share[i], cmw: t.overnight_clean_mw[i], tmw: t.overnight_total_mw[i] })) } }
  }
  const iy = YEARS.filter(y => r.interchange?.[y])
  if (iy.length) {
    out.ix = { data: [bars('overnight net export', iy, iy.map(y => r.interchange[y].overnight_net_export_mw), C.blue), bars('all hours net export', iy, iy.map(y => r.interchange[y].all_hours_net_export_mw), C.muted)],
      layout: layout({ barmode: 'group', bargap: 0.3, yaxis: { tickformat: ',.0f', zeroline: true }, xaxis: { dtick: 1 } }),
      table: { columns: [{ key: 'year', label: 'Year' }, { key: 'o', label: 'Overnight net export MW', num: true, render: z => fmt(z.o) }, { key: 'a', label: 'All hours net export MW', num: true, render: z => fmt(z.a) }], rows: iy.map(y => ({ year: y, o: r.interchange[y].overnight_net_export_mw, a: r.interchange[y].all_hours_net_export_mw })) } }
  }
  return out
}
