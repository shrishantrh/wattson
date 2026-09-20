import { useCallback, useEffect, useMemo, useState } from 'react'
import Shell from '../console/Console.jsx'
import { Card, Chip } from '../console/widgets.jsx'
import Table from '../components/Table.jsx'
import { WxRange, WxSeg, WxChips, WxReadout, useTableKeys, useEscape, isNum, DASH } from '../components/WxControls.jsx'
import { loadRegions, useAsync } from '../lib/data.js'
import { readTokens } from '../lib/tokens.js'
import { pct1, pts1 } from '../lib/findings.js'
import { sectorOf } from '../lib/metrics.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { href, useHash } from '../router.js'
import '../styles/pages.css'
import '../styles/wx.css'
import Breadcrumbs, { useCrumbs } from '../components/Breadcrumbs.jsx'

// The screener: every scored region as a table you can cut down yourself. Sorting belongs to
// the table; the filters above it belong to this page, and each one re-counts and re-pins the
// globe in place rather than hiding rows behind a preset we chose for the reader.
const PRESETS = [
  ['rising', 'New flat load rising', 'rank', 'asc'],
  ['cleanest', 'Cleanest at night', 'night', 'desc'],
  ['dirtiest', 'Dirtiest at night', 'night', 'asc'],
  ['worsening', 'Getting worse fastest', 'slope', 'asc'],
  ['improving', 'Improving fastest', 'slope', 'desc'],
]
const SECTORS = ['Eastern', 'Texas', 'Western']
const PATTERNS = ['flat-load growth', 'possible midday solar suppression', 'mixed']
const night = r => r.siting?.overnight_cf_share_2025 ?? r.cf_share_2025?.overnight ?? r.overnight_cf_share_2025 ?? null
const median = xs => { const v = xs.filter(isNum).sort((a, b) => a - b); return v.length ? v[Math.floor((v.length - 1) / 2)] : null }
const pctG = v => (isNum(v) ? `${v > 0 ? '+' : ''}${v.toFixed(0)}%` : DASH)

export default function Screener({ route }) {
  const { loading, error, data, reload } = useAsync(loadRegions, [])
  const tk = useMemo(readTokens, [])
  const preset = PRESETS.find(p => p[0] === route.params?.by) || PRESETS[0]
  // A preset is a starting sort, not a lock: picking one clears whatever column the reader
  // last clicked, and the table remounts on its key so it actually adopts the new order.
  const [sort, setSort] = useState(null)
  useEffect(() => { setSort(null) }, [preset[0]])   // eslint-disable-line react-hooks/exhaustive-deps

  const all = useMemo(() => (data?.regions || []).map(r => ({
    id: r.id, place: r.c?.label || r.name || r.id, grid: r.ba, night: night(r), change: r.siting?.change_since_2019 ?? null, slope: r.siting?.ratio_slope_per_year ?? null, headroom: r.siting?.overnight_clean_mw_over_demand ?? null,
    rank: r.detection?.rank ?? null, score: r.detection?.score ?? null, growth: r.detection?.growth_pct ?? null, excess: r.detection?.overnight_excess ?? null, pattern: r.detection?.pattern || '',
    flagged: (data?.meta?.data_flags || {})[r.id] ? 'flagged' : r.has_corrections ? 'corrected' : '', isZone: !!r.zone, sector: sectorOf(r), lat: r.c?.lat, lng: r.c?.lng,
  })), [data])

  // Slider bounds come from the data, so a handle at its left end filters nothing out.
  const bounds = useMemo(() => {
    const g = all.map(r => r.growth).filter(isNum)
    return { gMin: g.length ? Math.floor(Math.min(...g)) : 0, gMax: g.length ? Math.ceil(Math.max(...g)) : 100 }
  }, [all])
  const [minNight, setMinNight] = useState(0)
  const [minGrowth, setMinGrowth] = useState(null)
  const [scope, setScope] = useState('all')
  const [sectors, setSectors] = useState([])
  const [patterns, setPatterns] = useState([])
  const growthFloor = minGrowth == null ? bounds.gMin : minGrowth

  const reset = useCallback(() => { setMinNight(0); setMinGrowth(bounds.gMin); setScope('all'); setSectors([]); setPatterns([]) }, [bounds.gMin])
  const touched = minNight > 0 || growthFloor > bounds.gMin || scope !== 'all' || sectors.length > 0 || patterns.length > 0
  useEscape(reset, touched)

  const rows = useMemo(() => all.filter(r => {
    if (isNum(r.night) ? r.night * 100 < minNight : minNight > 0) return false
    if (isNum(r.growth) ? r.growth < growthFloor : growthFloor > bounds.gMin) return false
    if (scope === 'grid' && r.isZone) return false
    if (scope === 'zone' && !r.isZone) return false
    if (sectors.length && !sectors.includes(r.sector)) return false
    if (patterns.length && !patterns.includes(r.pattern)) return false
    return true
  }), [all, minNight, growthFloor, bounds.gMin, scope, sectors, patterns])

  // Short headers, because a header has to be scannable: the long form is the column's title.
  const columns = [
    { key: 'place', label: 'Place', width: 146 },
    { key: 'grid', label: 'Grid', width: 62 },
    { key: 'night', label: 'Night', num: true, width: 80, format: pct1, title: 'Carbon-free share of generation, midnight to 6am local, 2025' },
    { key: 'change', label: 'Δ 2019', num: true, width: 86, format: pts1, title: 'Change in that share against 2019, in points. A falling share is not clean output shrinking: open a region to switch the series to megawatts.' },
    { key: 'slope', label: 'Trend', num: true, width: 92, format: v => (v == null ? DASH : `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)} pts`), title: 'Points per year: the 2019-2025 slope of overnight clean MW divided by overnight demand' },
    { key: 'headroom', label: 'Clean ÷ dem', num: true, width: 98, format: v => (v == null ? DASH : `${v.toFixed(2)}×`), title: 'Clean MW generated at night against this footprint’s own demand at night' },
    { key: 'rank', label: 'Rank', num: true, width: 68, format: v => (v == null ? DASH : `#${v}`), title: 'Flat-load detector, of 111: #1 is the strongest round-the-clock demand growth, not the dirtiest grid' },
    { key: 'growth', label: 'Growth', num: true, width: 86, format: pctG, title: 'Average demand in 2025 against 2019' },
    { key: 'excess', label: 'Night excess', num: true, width: 96, format: v => (v == null ? DASH : `${v > 0 ? '+' : ''}${v.toFixed(1)} pts`), title: 'Overnight demand growth minus average demand growth: the detector’s signal' },
    { key: 'pattern', label: 'Pattern', width: 132 },
    { key: 'flagged', label: 'Data', width: 76, format: v => v || DASH, title: 'flagged: the reported numbers move in a way the data does not explain. corrected: the engine publishes a different 2019 figure from the one in the file.' },
  ]
  const sortKey = sort?.key || preset[2], sortDir = sort?.dir || preset[3]
  const visible = useMemo(() => [...rows].filter(r => r[sortKey] != null).sort((a, b) => (a[sortKey] > b[sortKey] ? 1 : -1) * (sortDir === 'asc' ? 1 : -1)).slice(0, 12), [rows, sortKey, sortDir])
  const globe = useMemo(() => ({ view: { lat: 38.5, lng: -97, altitude: 1.5 }, interactive: true,
    points: rows.filter(r => r.lat != null).map(r => ({ id: r.id, lat: r.lat, lng: r.lng, r: 0.12, color: tk.muted })),
    markers: visible.filter(r => r.lat != null).map((r, i) => ({ id: r.id, lat: r.lat, lng: r.lng, label: `${i + 1}  ${r.place} · ${sortKey === 'night' || sortKey === 'slope' ? pct1(r.night) : `#${r.rank}`}`, href: href.region(r.id), color: i === 0 ? tk.accent : tk.ink2, lead: i === 0, hollow: !!r.flagged })) }), [rows, visible, sortKey, tk])
  const crumbs = useCrumbs(useHash())
  const back = () => { window.location.hash = href.landing() }
  const keys = useTableKeys()

  const count = (list, f) => list.filter(f).length
  const readout = [
    { value: String(rows.length), label: `of ${all.length} regions pass these filters`, tone: rows.length ? '' : 'warn' },
    { value: pct1(median(rows.map(r => r.night))), label: 'median clean at night among them', tone: 'clean' },
    { value: pctG(median(rows.map(r => r.growth))), label: 'median demand growth since 2019' },
    { value: String(count(rows, r => r.pattern === 'flat-load growth')), label: 'carry the flat-load growth pattern', tone: 'fossil' },
  ]

  const column = (
    <>
      <Breadcrumbs trail={crumbs} onBack={back} />
      <Card title={<><b>Screener</b> · {all.length} regions · hourly grid data</>} onClose={back}>
        <p className="pg-top">Every scored region, cut down and sorted any way you like.</p>
        <div className="pg-chips pg-controls">{PRESETS.map(p => <Chip key={p[0]} small active={p[0] === preset[0] && !sort} href={href.screen(p[0])}>{p[1]}</Chip>)}</div>
        <p className="pg-lede">A datacenter buys every hour it runs, so the column that decides what gets burned for it is <b>night</b> — the clean share of what the grid generated between midnight and 6am — not the annual headline. <b>Δ 2019</b> and <b>trend</b> say whether the grid you would sign a load onto is moving toward that number or away from it. Cut the 111 down to the ones you would actually consider, sort on any column, then open a row.</p>
        {!loading && !error && (
          <>
            <div className="wx-bar">
              <WxRange label="clean at night, at least" value={minNight} min={0} max={100} step={1} onChange={setMinNight} format={v => `${v}%`} />
              <WxRange label="demand growth, at least" value={growthFloor} min={bounds.gMin} max={bounds.gMax} step={1} onChange={setMinGrowth} format={v => `${v > 0 ? '+' : ''}${v}%`} />
            </div>
            <div className="wx-bar">
              <WxSeg label="footprint" value={scope} onChange={setScope} options={[['all', 'all'], ['grid', 'whole grids'], ['zone', 'zones only']]} />
              <WxChips label="interconnection" value={sectors} onChange={setSectors} options={SECTORS.map(s => [s, s, count(all, r => r.sector === s)])} />
            </div>
            <div className="wx-bar">
              <WxChips label="pattern" value={patterns} onChange={setPatterns} options={PATTERNS.map(p => [p, p === 'possible midday solar suppression' ? 'midday solar suppression' : p, count(all, r => r.pattern === p)])} />
              <span className="wx-spacer" />
              <button type="button" className="btn" onClick={reset} disabled={!touched}>Reset filters</button>
            </div>
            <WxReadout items={readout} />
            <p className="note" style={{ marginTop: 10 }}>Zones report demand only, so a zone&rsquo;s generation columns are its parent grid&rsquo;s — set <b>footprint</b> to whole grids to compare generation like for like. Pattern is a read of the demand shape and never touches the score. Press <span className="wx-kbd">Esc</span> to clear the filters; the twelve at the top of the current sort stay pinned on the globe.</p>
          </>
        )}
      </Card>
      {loading ? <Card><Loading what="the screener" /></Card> : error ? <Card><ErrorState error={error} onRetry={reload} /></Card> : (
        <Card>
          {rows.length === 0 ? (
            <p className="wx-none">No region clears <b>{minNight}% clean at night</b>{growthFloor > bounds.gMin ? <> and <b>{growthFloor > 0 ? '+' : ''}{growthFloor}% demand growth</b></> : null} with these filters. Loosen one, or press Reset.</p>
          ) : (
            <div ref={keys.ref} onKeyDown={keys.onKeyDown}>
              <Table key={preset[0]} columns={columns} rows={rows} defaultSort={{ key: preset[2], dir: preset[3] }} onSortChange={n => setSort(n)} rowHref={r => href.region(r.id)} filter filterPlaceholder="Filter by name, grid or pattern" csvName="wattson-screener" dense maxHeight="min(60vh, 640px)" />
              <p className="wx-hint" style={{ marginTop: 8 }}>Tab into the table, then <span className="wx-kbd">&uarr;</span> <span className="wx-kbd">&darr;</span> to move and <span className="wx-kbd">&crarr;</span> to open a region. The CSV downloads exactly the rows and the order on screen.</p>
            </div>
          )}
        </Card>
      )}
    </>
  )
  return <Shell page="screen" globe={globe} column={column} columnWidth={760} />
}
