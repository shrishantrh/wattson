import { useMemo, useState } from 'react'
import Shell from '../console/Console.jsx'
import { Card, Chip } from '../console/widgets.jsx'
import Table from '../components/Table.jsx'
import { loadRegions, useAsync } from '../lib/data.js'
import { readTokens } from '../lib/tokens.js'
import { pct1, pts1 } from '../lib/findings.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { href, useHash } from '../router.js'
import '../styles/pages.css'
import Breadcrumbs, { useCrumbs } from '../components/Breadcrumbs.jsx'

// The screener: every scored region as a sortable table. The quant view.
const PRESETS = [
  ['rising', 'New flat load rising', 'rank', 'asc'],
  ['cleanest', 'Cleanest at night', 'night', 'desc'],
  ['dirtiest', 'Dirtiest at night', 'night', 'asc'],
  ['worsening', 'Getting worse fastest', 'slope', 'asc'],
  ['improving', 'Improving fastest', 'slope', 'desc'],
]
const night = r => r.siting?.overnight_cf_share_2025 ?? r.cf_share_2025?.overnight ?? r.overnight_cf_share_2025 ?? null

export default function Screener({ route }) {
  const { loading, error, data, reload } = useAsync(loadRegions, [])
  const tk = useMemo(readTokens, [])
  const preset = PRESETS.find(p => p[0] === route.params?.by) || PRESETS[0]
  const [sort, setSort] = useState(null)
  const rows = useMemo(() => (data?.regions || []).map(r => ({
    id: r.id, place: r.c?.label || r.name || r.id, grid: r.ba, night: night(r), change: r.siting?.change_since_2019 ?? null, slope: r.siting?.ratio_slope_per_year ?? null, headroom: r.siting?.overnight_clean_mw_over_demand ?? null,
    rank: r.detection?.rank ?? null, score: r.detection?.score ?? null, growth: r.detection?.growth_pct ?? null, pattern: r.detection?.pattern || '', flagged: (data?.meta?.data_flags || {})[r.id] ? 'flagged' : '', lat: r.c?.lat, lng: r.c?.lng,
  })), [data])
  const columns = [
    { key: 'place', label: 'Place', width: 150 },
    { key: 'grid', label: 'Grid', width: 60 },
    { key: 'night', label: 'Clean at night', num: true, format: pct1 },
    { key: 'change', label: 'Since 2019', num: true, format: pts1 },
    { key: 'slope', label: 'Trend / yr', num: true, format: v => (v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)} pts`) },
    { key: 'headroom', label: 'Clean ÷ demand', num: true, format: v => (v == null ? '—' : `${v.toFixed(2)}×`) },
    { key: 'rank', label: 'Load rank', num: true, format: v => (v == null ? '—' : `#${v}`) },
    { key: 'growth', label: 'Demand growth', num: true, format: v => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(0)}%`) },
    { key: 'pattern', label: 'Pattern', width: 140 },
  ]
  const sortKey = sort?.key || preset[2], sortDir = sort?.dir || preset[3]
  const visible = useMemo(() => [...rows].filter(r => r[sortKey] != null).sort((a, b) => (a[sortKey] > b[sortKey] ? 1 : -1) * (sortDir === 'asc' ? 1 : -1)).slice(0, 12), [rows, sortKey, sortDir])
  const globe = useMemo(() => ({ view: { lat: 38.5, lng: -97, altitude: 1.5 }, interactive: true,
    points: rows.filter(r => r.lat != null).map(r => ({ id: r.id, lat: r.lat, lng: r.lng, r: 0.12, color: tk.muted })),
    markers: visible.filter(r => r.lat != null).map((r, i) => ({ id: r.id, lat: r.lat, lng: r.lng, label: `${i + 1}  ${r.place} · ${sortKey === 'night' || sortKey === 'slope' ? pct1(r.night) : `#${r.rank}`}`, href: href.region(r.id), color: i === 0 ? tk.accent : tk.ink2, lead: i === 0, hollow: !!r.flagged })) }), [rows, visible, sortKey, tk])
  const crumbs = useCrumbs(useHash())
  const back = () => { window.location.hash = href.landing() }
  const column = (
    <>
      <Breadcrumbs trail={crumbs} onBack={back} />
      <Card title={<><b>Screener</b> · {rows.length} regions · hourly grid data</>} onClose={back}>
        <div className="pg-chips">{PRESETS.map(p => <Chip key={p[0]} small active={p[0] === preset[0] && !sort} href={href.screen(p[0])}>{p[1]}</Chip>)}</div>
        <p className="pg-lede">Clean share of what each grid generated at night in 2025, how it moved since 2019, its yearly trend, clean power relative to night demand, and the flat-load detector's rank. Zones inherit their grid's generation figures. Top 12 of the current sort are pinned on the globe.</p>
      </Card>
      {loading ? <Card><Loading what="the screener" /></Card> : error ? <Card><ErrorState error={error} onRetry={reload} /></Card> : (
        <Card>
          <Table columns={columns} rows={rows} sortKey={sortKey} sortDir={sortDir} onSort={(key, dir) => setSort({ key, dir })} rowHref={r => href.region(r.id)} filter csvName="wattson-screener" dense maxHeight="min(66vh, 720px)" />
        </Card>
      )}
    </>
  )
  return <Shell page="screen" globe={globe} column={column} columnWidth={760} />
}
