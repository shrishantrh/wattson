import { useMemo } from 'react'
import Shell from '../console/Console.jsx'
import { Card, Num, KV, HourBars, Chip } from '../console/widgets.jsx'
import Workspace from '../components/Workspace.jsx'
import Sparkline from '../components/Sparkline.jsx'
import { CopyButton } from '../components/CopyButton.jsx'
import coords from '../data/region_coords.json'
import { loadRegion, useAsync, nightSeries, hourProfile } from '../lib/data.js'
import { readTokens } from '../lib/tokens.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { regionTitle, pct1, pts1, n0, signedGw, caveatFor } from '../lib/findings.js'
import { href } from '../router.js'

const pctFmt = n => `${n.toFixed(1)}%`

// Detail behind a pin: what the grid at this place does, who serves it, what changed.
export default function Region({ route }) {
  const id = route.id
  const { loading, error, data, reload } = useAsync(() => loadRegion(id), [id])
  const tk = useMemo(readTokens, [])
  const c = coords.regions[id]
  const globe = useMemo(() => (c ? { view: { lat: c.lat, lng: c.lng, altitude: 0.95 }, points: [{ id, lat: c.lat, lng: c.lng, r: 0.22, color: tk.accent }], rings: [{ id, lat: c.lat, lng: c.lng, color: tk.accent, maxR: 3, speed: 0.8, period: 1600 }], markers: [{ id, lat: c.lat, lng: c.lng, label: c.label, color: tk.accent }] } : {}), [c, id, tk])
  const back = () => { window.history.length > 1 ? window.history.back() : (window.location.hash = href.landing()) }
  if (loading || error) return <Shell page="region" globe={globe} column={<Card title={<b>{c?.label || id}</b>} onClose={back}>{loading ? <Loading what={c?.label || id} /> : <><ErrorState error={error} onRetry={reload} />{error.name === 'NotFound' && error.available?.length > 0 && <p className="note" style={{ marginTop: 8 }}>In this data source: {error.available.join(', ')}</p>}</>}</Card>} />
  const t = regionTitle(data, c?.label || data.name)
  const det = data.detection || {}
  const gen = data.type === 'zone' && data.parent ? data.parent : data
  const sit = gen.siting || data.siting || {}
  const share25 = sit.overnight_cf_share_2025 ?? gen.cf_share?.['2025']?.overnight
  const fd = gen.fuel_delta_overnight_gw || {}
  const cav = caveatFor(id)
  const series = nightSeries(data), prof = hourProfile(data)
  const modules = [
    { id: 'hours', title: 'Clean share by hour, 2025 (night in ember)', render: () => (prof ? <HourBars values={prof} /> : <p className="note">No hourly profile in this data source.</p>) },
    { id: 'history', title: 'Clean at night, year by year', render: () => (series ? <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><Sparkline values={series} width={160} height={36} accentLast baseline /><KV rows={series.map((v, i) => [String(2019 + i), pct1(v)])} /></div> : <p className="note">No yearly series in this data source.</p>) },
    { id: 'fuel', title: 'What changed at night since 2019', render: () => <KV rows={[['gas', <span key="g" className="accent">{signedGw(fd.gas)}</span>], ['coal', signedGw(fd.coal)], ['nuclear', signedGw(fd.nuclear)], ['wind', signedGw(fd.wind)], ['solar', signedGw(fd.solar)], ['hydro', signedGw(fd.hydro)], ['clean power vs night demand', sit.overnight_clean_mw_over_demand != null ? `${sit.overnight_clean_mw_over_demand.toFixed(2)}× · ${sit.ratio_slope_per_year > 0 ? '+' : ''}${((sit.ratio_slope_per_year || 0) * 100).toFixed(1)} pts/yr` : '—']]} /> },
    { id: 'operators', title: 'Who serves the load (hand-mapped)', render: () => ((data.operators_manual || []).length ? <KV rows={data.operators_manual.map(o => [o.utility, o.ticker ? `${o.parent} · ${o.ticker}` : o.parent || '—'])} /> : <p className="note">No operator mapping for this region yet.</p>) },
    { id: 'detector', title: 'How the detector scored it', render: () => <KV rows={[['score', det.score?.toFixed(2)], ['night demand grew faster than average by', det.overnight_excess != null ? `${det.overnight_excess.toFixed(1)} pts` : '—'], ['grew faster than neighbours by', det.neighbor_divergence != null ? `${det.neighbor_divergence.toFixed(1)} pts` : '—'], ['load factor change', det.load_factor_delta != null ? det.load_factor_delta.toFixed(3) : '—'], ['demand growth since 2019', det.growth_pct != null ? `${det.growth_pct > 0 ? '+' : ''}${det.growth_pct.toFixed(1)}%` : '—']]} /> },
  ]
  const column = (
    <>
      <Card title={<><b>{c?.label || data.name}</b> · {c?.place || data.ba_name}</>} right={<CopyButton text={() => window.location.href} label="Copy link" />} onClose={back}>
        <h1 className="verdict">{t.title}</h1>
        <div className="nums"><Num num={share25 != null ? share25 * 100 : undefined} value="—" format={pctFmt} label="clean power at night, 2025" sub={`${pts1(sit.change_since_2019)} since 2019`} accent /><Num value={det.rank ? `#${det.rank}` : '—'} label="of 111 for new flat load" sub={det.pattern} /><Num num={data.demand?.['2025']?.overnight_avg_mw} format={n => n0(n)} value="—" label="MW demand at night, 2025" sub={data.demand?.['2019']?.overnight_avg_mw ? `${n0(data.demand['2019'].overnight_avg_mw)} in 2019` : null} /></div>
        {cav && <div className="banner banner-error" style={{ marginTop: 12 }}>{cav}</div>}
        <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>{data.cf_inherited_from_ba && <Chip small>generation figures are the whole {data.ba} grid</Chip>}<Chip small href={href.compare({ mw: 300, metros: [c?.label || data.name] })}>Compare 300 MW here</Chip></div>
      </Card>
      <Workspace id="region" modules={modules} />
    </>
  )
  return <Shell page="region" globe={globe} column={column} />
}
