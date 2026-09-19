import { useMemo } from 'react'
import Console, { StatusLine } from '../console/Console.jsx'
import { Panel, Ring, BigNum, KV, HourBars, Stat } from '../console/widgets.jsx'
import coords from '../data/region_coords.json'
import { loadRegion, useAsync } from '../lib/data.js'
import { readTokens } from '../lib/tokens.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { regionTitle, pct1, pts1, ordinal, n0, signedGw } from '../lib/findings.js'
import { href } from '../router.js'

// U4 region evidence view. Console shell, finding and instruments now; heatmap and fuel
// mix charts follow the opening review.
export default function Region({ route }) {
  const id = route.id
  const { loading, error, data, reload } = useAsync(() => loadRegion(id), [id])
  const tk = useMemo(readTokens, [])
  const c = coords.regions[id]
  const globe = useMemo(() => (c ? { view: { lat: c.lat, lng: c.lng, altitude: 1.0 }, points: [{ id, lat: c.lat, lng: c.lng, r: 0.25, color: tk.accent }], rings: [{ id, lat: c.lat, lng: c.lng, color: tk.accent, maxR: 3, speed: 0.8, period: 1600 }], labels: [{ id, lat: c.lat, lng: c.lng, text: c.label, size: 0.8, color: tk.ink, dot: false }] } : {}), [c, id, tk])
  if (loading || error) return <Console page="region" crumb={id} globe={globe} center={<div className="center-panel"><Panel>{loading ? <Loading what={id} /> : <><ErrorState error={error} onRetry={reload} />{error.name === 'NotFound' && <p className="ink2" style={{ fontSize: 12 }}>The provisional fixture carries 13 regions: PJM/DOM, PJM, PJM/AEP, AZPS, SWPP/OPPD, SWPP, ERCO/NRTH, ERCO/FWES, ERCO/NCEN, TEPC, SC, WACM, NYIS.</p>}</>}</Panel></div>} />
  const t = regionTitle(data, c?.label || data.name)
  const det = data.detection || {}, sit = (data.type === 'zone' ? data.parent?.siting : data.siting) || data.siting || {}
  const gen = data.type === 'zone' && data.parent ? data.parent : data
  const share25 = gen.cf_share?.['2025']?.overnight
  const profile = gen.profile_24h?.['2025'] || gen.profile_24h
  const fd = gen.fuel_delta_overnight_gw || {}
  const center = (
    <div className="center-panel">
      <Panel title={<><b>{data.ba_name || data.ba}</b> · {data.type} {data.zone || data.ba} · {c?.place}</>}>
        <h1 className="finding">{t.title}</h1>
        <p className="sub">{t.sub}</p>
        <div style={{ marginTop: 12 }}>
          {det.rank && <span className="chip accent">detector {ordinal(det.rank)} of 111</span>}
          {det.pattern && <span className="chip">{det.pattern}</span>}
          {data.cf_inherited_from_ba && <span className="chip">generation inherited from {data.ba}</span>}
          {(data.data_flags || []).length > 0 && data.type !== 'zone' && <span className="chip">flagged</span>}
        </div>
        <div className="panel-actions"><a className="cta primary" href={href.site()}>Site a load here →</a><a className="cta" href="#/">Opening</a></div>
      </Panel>
    </div>
  )
  const right = (
    <>
      <Panel title={<>Overnight <b>2025</b> · {gen.ba || data.ba}</>}>
        <div className="instrument"><Ring value={share25} /><div><BigNum num={n0(gen.cf_avg_mw?.['2025']?.overnight)} den={n0(gen.total_avg_mw?.['2025']?.overnight)} unit="MW" /><div className="label">clean of overnight generation</div></div></div>
        <KV rows={[['share 2019 → 2025', `${pct1(gen.cf_share?.['2019']?.overnight)} → ${pct1(share25)}`], ['change', pts1(sit.change_since_2019)], ['clean MW / demand', sit.overnight_clean_mw_over_demand != null ? sit.overnight_clean_mw_over_demand.toFixed(2) : '—'], ['slope / yr', sit.ratio_slope_per_year != null ? (sit.ratio_slope_per_year > 0 ? '+' : '') + sit.ratio_slope_per_year.toFixed(3) : '—'], ['siting rank', sit.siting_rank ? `${sit.siting_rank} of ${sit.n_ranked || 52}` : '—']]} />
      </Panel>
      <Panel title={<>Detector · <b>components</b></>}>
        <KV rows={[['score', det.score?.toFixed(2)], ['overnight excess', det.overnight_excess != null ? `${det.overnight_excess.toFixed(1)} pts` : '—'], ['neighbor divergence', det.neighbor_divergence != null ? `${det.neighbor_divergence.toFixed(1)} pts` : '—'], ['load factor Δ', det.load_factor_delta != null ? det.load_factor_delta.toFixed(3) : '—'], ['growth since 2019', det.growth_pct != null ? `${det.growth_pct > 0 ? '+' : ''}${det.growth_pct.toFixed(1)}%` : '—']]} />
      </Panel>
      {(data.operators_manual || []).length > 0 && (
        <Panel title={<>Who serves the load · <b>hand-mapped</b></>}>
          <KV rows={data.operators_manual.map(o => [o.utility, o.ticker ? `${o.parent} · ${o.ticker}` : o.parent || '—'])} />
        </Panel>
      )}
      <div className="pending-cell">U4 charts: 365×24 heatmap, night vs day trend, overnight fuel mix · after the opening review</div>
    </>
  )
  const bottom = (
    <>
      <div className="stats" style={{ gridTemplateColumns: 'repeat(2, minmax(140px, 1fr))' }}>
        <Stat num={signedGw(fd.gas)} label="gas overnight since 2019" value={fd.gas} max={12} accent />
        <Stat num={signedGw((fd.nuclear || 0) + (fd.hydro || 0) + (fd.wind || 0) + (fd.solar || 0))} label="clean overnight since 2019" value={(fd.nuclear || 0) + (fd.hydro || 0) + (fd.wind || 0) + (fd.solar || 0)} max={12} />
      </div>
      <div><HourBars values={profile} caption={<>{gen.ba || data.ba} · <b>clean share by hour</b> · 2025</>} /></div>
      <div className="stats" style={{ gridTemplateColumns: 'repeat(2, minmax(140px, 1fr))' }}>
        <Stat num={n0(data.demand?.['2019']?.overnight_avg_mw)} den={n0(data.demand?.['2025']?.overnight_avg_mw)} unit="MW" label="overnight demand 2019 / 2025" value={data.demand?.['2025']?.overnight_avg_mw} max={data.demand?.['2025']?.overnight_avg_mw} />
        <Stat num={n0(data.demand?.['2025']?.peak_mw)} unit="MW" label="peak demand 2025 (p99.5)" />
      </div>
    </>
  )
  return <Console page="region" crumb={<><b>{id}</b><i>/</i>{c?.place}</>} globe={globe} center={center} right={right} bottom={bottom} status={<StatusLine data={{ _provisional: data._provisional, data_snapshot_end: '2026-09-05', baseline_year: 2019, detector: { n_scored: 111 } }} />} />
}
