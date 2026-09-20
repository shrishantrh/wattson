import { useMemo } from 'react'
import Shell from '../console/Console.jsx'
import { Card, Chip } from '../console/widgets.jsx'
import Table from '../components/Table.jsx'
import WxProvenance from '../components/WxProvenance.jsx'
import { useTableKeys } from '../components/WxControls.jsx'
import coords from '../data/region_coords.json'
import { loadRegions, loadAlerts, loadCompanies, loadCompany, loadFacilities, useAsync } from '../lib/data.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { pct1 } from '../lib/findings.js'
import { href, useHash } from '../router.js'
import '../styles/pages.css'
import '../styles/wx.css'
import Breadcrumbs, { useCrumbs } from '../components/Breadcrumbs.jsx'

// The sheets: every dataset the answers are built from, sortable, filterable, exportable.
const SHEETS = [
  ['regions', 'Regions (111)'], ['alerts', 'Alerts'], ['companies', 'Companies'], ['claims', 'Claims'], ['facilities', 'Facilities'],
]
const pct = v => pct1(v)
async function loadSheet(t) {
  if (t === 'regions') { const r = await loadRegions(); return { rows: r.regions.map(x => ({ id: x.id, place: x.c?.label || x.name, ba: x.ba, night: x.siting?.overnight_cf_share_2025 ?? x.cf_share_2025?.overnight, day: x.cf_share_2025?.daytime, change: x.siting?.change_since_2019, slope: x.siting?.ratio_slope_per_year, headroom: x.siting?.overnight_clean_mw_over_demand, siting_score: x.siting?.siting_score, rank: x.detection?.rank, score: x.detection?.score, growth: x.detection?.growth_pct, excess: x.detection?.overnight_excess, pattern: x.detection?.pattern, flags: (x.data_flags || []).length ? 'flagged' : (x.has_corrections ? 'corrected' : '') })), columns: [
    { key: 'place', label: 'Place', width: 140 }, { key: 'id', label: 'Region', width: 110 }, { key: 'night', label: 'Clean at night', num: true, format: pct }, { key: 'day', label: 'Clean by day', num: true, format: pct }, { key: 'change', label: 'Since 2019', num: true, format: v => (v == null ? '—' : `${(v * 100).toFixed(1)} pts`) }, { key: 'slope', label: 'Trend/yr', num: true, format: v => (v == null ? '—' : `${(v * 100).toFixed(2)} pts`) }, { key: 'headroom', label: 'Clean ÷ demand', num: true, format: v => (v == null ? '—' : v.toFixed(2)) }, { key: 'siting_score', label: 'Siting', num: true, format: v => (v == null ? '—' : v.toFixed(3)) }, { key: 'rank', label: 'Load rank', num: true }, { key: 'score', label: 'Score', num: true, format: v => (v == null ? '—' : v.toFixed(2)) }, { key: 'growth', label: 'Growth', num: true, format: v => (v == null ? '—' : `${v.toFixed(1)}%`) }, { key: 'excess', label: 'Night excess', num: true, format: v => (v == null ? '—' : `${v.toFixed(1)} pts`) }, { key: 'pattern', label: 'Pattern', width: 150 }, { key: 'flags', label: 'Flags', width: 80 },
  ], rowHref: r => href.region(r.id), sortKey: 'rank', defaultSort: { key: 'rank', dir: 'asc' } } }
  if (t === 'alerts') { const a = await loadAlerts(); return { rows: (a.alerts || []).map(x => ({ region: x.region, place: coords.regions[x.region]?.label || x.name, rule: x.rule, tier: x.tier, severity: x.severity, since: x.first_crossed, months: x.months_active_streak, value: x.current_value, base: x.baseline_2019, unit: x.unit })), columns: [
    { key: 'place', label: 'Place', width: 130 }, { key: 'region', label: 'Region', width: 90 }, { key: 'rule', label: 'Rule', width: 170 }, { key: 'tier', label: 'Tier', width: 80 }, { key: 'severity', label: 'Severity', num: true, format: v => (v == null ? '—' : v.toFixed(3)) }, { key: 'since', label: 'Since', width: 80 }, { key: 'months', label: 'Months', num: true }, { key: 'value', label: 'Now', num: true, format: (v, r) => (v == null ? '—' : r.unit === 'share' ? pct(v) : Math.round(v).toLocaleString()) }, { key: 'base', label: '2019', num: true, format: (v, r) => (v == null ? '—' : r.unit === 'share' ? pct(v) : Math.round(v).toLocaleString()) },
  ], rowHref: r => href.region(r.region), rowKey: r => `${r.region}-${r.rule}`, sortKey: 'severity' } }
  if (t === 'companies') { const c = await loadCompanies(); return { rows: c.companies, columns: [
    { key: 'company', label: 'Company', width: 160 }, { key: 'ticker', label: 'Ticker', width: 70 }, { key: 'talk_score', label: 'Talk', num: true, format: pct }, { key: 'walk_score', label: 'Walk', num: true, format: pct }, { key: 'coverage', label: 'Coverage', num: true, format: pct }, { key: 'n_claims', label: 'Claims', num: true }, { key: 'n_sites', label: 'Sites', num: true }, { key: 'cannot_verify_count', label: "Can't verify", num: true },
  ], rowHref: r => href.check(r.ticker), sortKey: 'walk_score' } }
  if (t === 'claims') { const c = await loadCompanies(); const rows = []; await Promise.all(c.companies.map(async x => { try { const d = await loadCompany(x.ticker); d.claims.forEach(k => rows.push({ ticker: x.ticker, claim_id: k.claim_id, verbatim: k.verbatim, doc: k.source_doc, page: k.page, year: k.year, metric: k.metric, magnitude: k.magnitude, unit: k.unit, scope: k.scope, verdict: k.verdict, falsifiability: k.falsifiability, patterns: (k.greenwash_patterns || []).join(' '), physical_min: k.physical_min, physical_max: k.physical_max, contradictions: (k.evidence || []).filter(e => /contradiction/.test(e.type || '')).length })) } catch { /* not exported */ } })); return { rows, columns: [
    { key: 'ticker', label: 'Co', width: 60 }, { key: 'verbatim', label: 'Claim', width: 360 }, { key: 'doc', label: 'Source', width: 180 }, { key: 'page', label: 'p.', num: true, format: v => (v == null ? '—' : String(v)) }, { key: 'year', label: 'Year', num: true, format: v => (v == null ? '—' : String(v)) }, { key: 'metric', label: 'Metric', width: 150 }, { key: 'magnitude', label: 'Value', num: true }, { key: 'scope', label: 'Scope', width: 100 }, { key: 'verdict', label: 'Verdict', width: 110 }, { key: 'falsifiability', label: 'Checkable', num: true, format: v => (v == null ? '—' : v.toFixed(2)) }, { key: 'patterns', label: 'Patterns', width: 150 }, { key: 'physical_min', label: 'Phys min', num: true, format: pct }, { key: 'physical_max', label: 'Phys max', num: true, format: pct }, { key: 'contradictions', label: 'Contra.', num: true },
  ], rowHref: r => href.check(r.ticker, true), rowKey: r => r.claim_id || `${r.ticker}-${r.page}-${r.verbatim.slice(0, 20)}`, sortKey: 'ticker' } }
  const f = await loadFacilities(); return { rows: f.facilities, columns: [
    { key: 'company', label: 'Company', width: 90 }, { key: 'metro', label: 'Site', width: 170 }, { key: 'state', label: 'State', width: 50 }, { key: 'serving_utility', label: 'Serving utility', width: 200 }, { key: 'utility_parent', label: 'Parent', width: 180 }, { key: 'ticker_utility', label: 'Ticker', width: 70, format: v => v || 'none' }, { key: 'region_id', label: 'Grid', width: 90 }, { key: 'cf_share_2025', label: 'Clean 2025', num: true, format: pct }, { key: 'detector_rank', label: 'Load rank', num: true }, { key: 'source_type', label: 'Source', width: 90 },
  ], rowHref: r => href.region(r.region_id), rowKey: r => `${r.ticker}-${r.metro}`, sortKey: 'cf_share_2025' }
}

export default function Data({ route }) {
  const t = SHEETS.some(([id]) => id === route.params?.t) ? route.params.t : 'regions'
  const { loading, error, data, reload } = useAsync(() => loadSheet(t), [t])
  const globe = useMemo(() => ({ view: { lat: 38.5, lng: -97, altitude: 1.6 }, interactive: true }), [])
  const crumbs = useCrumbs(useHash())
  const back = () => { window.location.hash = href.landing() }
  const keys = useTableKeys()
  const column = (
    <>
      <Breadcrumbs trail={crumbs} onBack={back} />
      <Card title={<><b>Data</b> · the sheets behind every answer</>} onClose={back}>
        <div className="pg-chips">{SHEETS.map(([id, label]) => <Chip key={id} small active={id === t} href={`#/data?t=${id}`}>{label}</Chip>)}</div>
        <p className="pg-lede">Nothing on this site is a figure you have to take our word for. Every number an answer uses is in one of these sheets, and every column below says which file it was read from, which script produced it, and what it is stored as — shares are 0–1 fractions in the file and percentages only on screen. Sort any column, filter any text, take the CSV.</p>
        {!loading && !error && <WxProvenance sheet={t} columns={data.columns} rows={data.rows} snapshot="Hourly EIA-930 via PUDL, snapshot ending 2026-09-05. Claims are read off the rendered pages of each company's own reports; the site-to-utility-to-grid mapping and the operator table are hand-curated and a human should check them before anyone judges an operator." />}
      </Card>
      {loading ? <Card><Loading what="the sheet" /></Card> : error ? <Card><ErrorState error={error} onRetry={reload} /></Card> : (
        <Card>
          <div ref={keys.ref} onKeyDown={keys.onKeyDown}>
            <Table columns={data.columns} rows={data.rows} sortKey={data.sortKey} defaultSort={data.defaultSort} rowHref={data.rowHref} rowKey={data.rowKey} filter csvName={`wattson-${t}`} dense maxHeight="min(60vh, 660px)" />
            <p className="wx-hint" style={{ marginTop: 8 }}>Tab into the table, then <span className="wx-kbd">&uarr;</span> <span className="wx-kbd">&darr;</span> to move and <span className="wx-kbd">&crarr;</span> to open the row. An em dash is a value the source does not have — it is never a zero.</p>
          </div>
        </Card>
      )}
    </>
  )
  return <Shell page="data" globe={globe} column={column} columnWidth={860} />
}
