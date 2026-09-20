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
  // Short headers, because a header has to be scannable: the long form is the column's title.
  const columns = [
    { key: 'place', label: 'Place', width: 146 },
    { key: 'grid', label: 'Grid', width: 62 },
    { key: 'night', label: 'Night', num: true, width: 78, format: pct1, title: 'Clean share of generation, overnight hours, 2025' },
    { key: 'change', label: 'Δ 2019', num: true, width: 84, format: pts1, title: 'Change in that share since 2019, in points' },
    { key: 'slope', label: 'Trend', num: true, width: 84, format: v => (v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}`), title: 'Points per year, 2019-2025' },
    { key: 'headroom', label: 'Clean ÷ dem', num: true, width: 96, format: v => (v == null ? '—' : `${v.toFixed(2)}×`), title: 'Overnight clean MW divided by overnight demand' },
    { key: 'rank', label: 'Rank', num: true, width: 66, format: v => (v == null ? '—' : `#${v}`), title: 'Flat-load detector rank, of 111' },
    { key: 'growth', label: 'Growth', num: true, width: 84, format: v => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(0)}%`), title: 'Demand growth since 2019' },
    { key: 'pattern', label: 'Pattern', width: 132 },
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
      <Card title={<><b>Screener</b> · {rows.length} regions</>} onClose={back}>
        <p className="pg-top">Every scored region, sorted any way you like.</p>
        <div className="pg-chips pg-controls">{PRESETS.map(p => <Chip key={p[0]} small active={p[0] === preset[0] && !sort} href={href.screen(p[0])}>{p[1]}</Chip>)}</div>
        <p className="pg-lede">Night is the clean share of what the grid generated between midnight and 6am. Zones inherit their grid's figures. The top 12 of the current sort are pinned on the globe.</p>
      </Card>
      {loading ? <Card><Loading what="the screener" /></Card> : error ? <Card><ErrorState error={error} onRetry={reload} /></Card> : (
        <Card>
          <Table key={preset[0]} columns={columns} rows={rows} defaultSort={{ key: preset[2], dir: preset[3] }} onSortChange={n => setSort(n)} rowHref={r => href.region(r.id)} filter filterPlaceholder="Filter 111 regions" csvName="wattson-screener" maxHeight="min(66vh, 720px)" />
        </Card>
      )}
    </>
  )
  return <Shell page="screen" globe={globe} column={column} columnWidth={760} />
}
