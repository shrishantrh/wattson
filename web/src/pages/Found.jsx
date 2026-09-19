import { useEffect, useMemo, useRef, useState } from 'react'
import Shell from '../console/Console.jsx'
import { Card, Num, Section, KV, HourBars } from '../console/widgets.jsx'
import YearSlider, { useYearPlayback } from '../components/YearSlider.jsx'
import traj from '../data/trajectory.json'
import coords from '../data/region_coords.json'
import { loadOpening, useAsync } from '../lib/data.js'
import { readTokens } from '../lib/tokens.js'
import { openingTitle, nationalTitle, detectorTitle, n0, pct1, gw1, signedGw, interpYears, ordinal, caveatFor } from '../lib/findings.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { href } from '../router.js'

// "What we found": the evidence behind the answers, one scene at a time.
const SCENES = [['headline', 'The finding'], ['night', 'At night'], ['sweep', 'Day vs night'], ['detector', 'Where load is landing']]
const VIEWS = { headline: { lat: 37, lng: -88, altitude: 1.5 }, night: { lat: 38.5, lng: -96, altitude: 1.45 }, sweep: { lat: 38.5, lng: -96, altitude: 1.45 }, detector: { lat: 38.5, lng: -96, altitude: 1.3 } }
const SUN_NIGHT = 60, SUN_SWEEP = [15, -45], SWEEP_MS = 7000, YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025]

function sideLabels(pins, dLng = 7, dLat = 2.6) {
  const out = pins.map(p => ({ ...p }))
  for (const a of out) for (const b of out) { if (a === b || a.lng >= b.lng) continue; if (Math.abs(a.lng - b.lng) < dLng && Math.abs(a.lat - b.lat) < dLat) a.side = 'left' }
  return out
}
function useTween(target, ms, enabled = true) {
  const [v, setV] = useState(target)
  const ref = useRef({ raf: 0 })
  useEffect(() => {
    const r = ref.current; cancelAnimationFrame(r.raf)
    if (!enabled || ms <= 0) { setV(target); return }
    const from = v, t0 = performance.now()
    const step = now => { const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3); setV(from + (target - from) * e); if (k < 1) r.raf = requestAnimationFrame(step) }
    r.raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(r.raf)
  }, [target, ms, enabled])   // eslint-disable-line react-hooks/exhaustive-deps
  return v
}
function useSweep(active, replayKey) {
  const [p, setP] = useState(0)
  useEffect(() => {
    if (!active) { setP(0); return }
    let raf = 0; const t0 = performance.now() + 500
    const step = now => { const k = Math.min(1, Math.max(0, (now - t0) / SWEEP_MS)); setP(k); if (k < 1) raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [active, replayKey])
  return p
}

export default function Found({ route }) {
  const { loading, error, data, reload } = useAsync(loadOpening, [])
  const scene = SCENES.some(([id]) => id === route.params?.s) ? route.params.s : 'headline'
  const [replay, setReplay] = useState(0)
  const yp = useYearPlayback(traj.years)
  const yi = traj.years.indexOf(yp.year)
  const nightOf = id => traj.regions[id]?.night?.[yi] ?? null
  const p = useSweep(scene === 'sweep', replay)
  const tk = useMemo(readTokens, [])
  const det = data?.detector
  const scored = useMemo(() => (det?.regions || []).map(r => ({ ...r, c: coords.regions[r.id] })).filter(r => r.c), [det])
  const top = useMemo(() => scored.filter(r => r.rank <= 10), [scored])
  const pulses = useMemo(() => top.filter(r => !r.data_flagged && r.pattern === 'flat-load growth'), [top])
  const leads = useMemo(() => new Set(det?.new_leads || []), [det])
  const named = useMemo(() => scored.filter(r => r.validation || leads.has(r.id)).sort((a, b) => a.rank - b.rank), [scored, leads])
  const dom = coords.regions['PJM/DOM']
  const points = useMemo(() => {
    if (scene === 'detector') return scored.map(r => { const n = nightOf(r.id); return { id: r.id, lat: r.c.lat, lng: r.c.lng, r: n == null ? 0.11 : 0.12 + 0.3 * n, color: r.data_flagged ? tk.ink2 : n == null ? tk.muted : n < 0.3 ? tk.accent : n < 0.6 ? tk.ink2 : tk.ink, hollow: !!r.data_flagged || !!traj.regions[r.id]?.corrected } })
    if (scene !== 'headline') return pulses.map(r => ({ id: r.id, lat: r.c.lat, lng: r.c.lng, r: 0.18, color: tk.accent }))
    return [{ id: 'PJM/DOM', lat: dom.lat, lng: dom.lng, r: 0.22, color: tk.accent }]
  }, [scene, scored, pulses, tk, dom, yi])   // eslint-disable-line react-hooks/exhaustive-deps
  const rings = useMemo(() => {
    if (scene === 'headline') return [{ id: 'PJM/DOM', lat: dom.lat, lng: dom.lng, color: tk.accent, maxR: 3, speed: 0.8, period: 1600 }]
    if (scene === 'night' || scene === 'detector') return pulses.map(r => ({ id: r.id, lat: r.c.lat, lng: r.c.lng, color: tk.accent, maxR: 2.4, speed: 0.7, period: 1500 }))
    return []
  }, [scene, pulses, tk, dom])
  const markers = useMemo(() => {
    const pin = (r, extra = {}) => ({ id: r.id, lat: r.c.lat, lng: r.c.lng, label: `${r.known_cluster_label || r.c.label}${caveatFor(r.id) ? ' · data?' : ''}`, tip: caveatFor(r.id) || `#${r.rank} · ${r.pattern}`, href: href.region(r.id), hollow: !!r.data_flagged || !!caveatFor(r.id), ...extra })
    if (scene === 'detector') return sideLabels(named.map(r => pin(r, { lead: leads.has(r.id), color: r.validation ? tk.ink : tk.accent })))
    if (scene === 'night') return sideLabels(pulses.map(r => pin(r, { lead: leads.has(r.id), color: tk.accent })))
    if (scene === 'headline') { const g = data?.pjm?.dom_overnight_demand_mw; const pct = g?.['2019'] ? Math.round((g['2025'] / g['2019'] - 1) * 100) : null; return [{ id: 'PJM/DOM', lat: dom.lat, lng: dom.lng, label: `Northern Virginia${pct != null ? ` · +${pct}% at night` : ''}`, href: href.region('PJM/DOM'), color: tk.accent }] }
    return []
  }, [scene, named, pulses, leads, tk, dom, data])
  const sunTarget = scene === 'sweep' ? SUN_SWEEP[0] + (SUN_SWEEP[1] - SUN_SWEEP[0]) * p : SUN_NIGHT
  const sunLng = useTween(sunTarget, 1100, scene !== 'sweep')
  const terminator = useMemo(() => ({ enabled: true, sunLng, sunLat: 0, dayDim: 0.3 }), [sunLng])
  useEffect(() => {
    const onKey = e => { if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return; const i = Number(e.key) - 1; if (SCENES[i]) window.location.hash = href.found(SCENES[i][0]) }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [])
  const back = () => { window.location.hash = href.landing() }
  const tabs = <div className="seg" role="tablist" style={{ marginBottom: 14 }}>{SCENES.map(([id, label]) => <button key={id} type="button" role="tab" className={id === scene ? 'on' : ''} onClick={() => { window.location.hash = href.found(id) }}>{label}</button>)}</div>

  if (loading || error) return <Shell page="found" globe={{ view: VIEWS.headline }} column={<Card title={<b>What we found</b>} onClose={back}>{loading ? <Loading what="the findings" /> : <ErrorState error={error} onRetry={reload} />}</Card>} />
  const pjm = data.pjm, nat = data.national?.cf_share || {}
  const head = openingTitle(pjm), natT = nationalTitle(nat), detT = detectorTitle(det)
  const live = interpYears(nat, scene === 'sweep' ? p : 0)
  const validation = scored.filter(r => r.validation).sort((a, b) => a.rank - b.rank)
  const rows = list => <div className="rows">{list.map(r => <a className="row" key={r.id} href={href.region(r.id)}><div><div className={`t ${leads.has(r.id) ? 'accent' : ''}`}>{r.known_cluster_label || r.c.label}{r.data_flagged ? ' · data flagged' : leads.has(r.id) ? ' · new' : ''}</div><div className="d">{r.pattern}</div></div><div className="n">#{r.rank} <small>{r.growth_pct != null ? `${r.growth_pct > 0 ? '+' : ''}${r.growth_pct.toFixed(0)}%` : ''}</small></div></a>)}</div>

  const column = (
    <>
      <Card title={<b>What we found</b>} onClose={back}>
        {tabs}
        {scene === 'headline' && <>
          <h1 className="verdict">{head.title.replace("PJM's", "The mid-Atlantic grid's (PJM)")}</h1>
          <div className="hero-num">{n0(pjm.overnight_clean_mw?.['2019'])}<span className="arrow">→</span>{n0(pjm.overnight_clean_mw?.['2025'])}<span className="unit">MW clean at night</span></div>
          <p className="note" style={{ marginTop: 12 }}>{head.sub}</p>
          <div className="nums"><Num value={signedGw((pjm.overnight_total_mw?.['2025'] - pjm.overnight_total_mw?.['2019']) / 1000)} label="more power at night since 2019" /><Num value={signedGw(pjm.fuel_delta_overnight_gw?.gas)} label="of it from gas" accent /><Num value={`${gw1(pjm.overnight_net_export_mw?.['2019'])} → ${gw1(pjm.overnight_net_export_mw?.['2025'])}`} label="exports to neighbours" /></div>
        </>}
        {scene === 'night' && <>
          <h1 className="verdict">Night-time demand is rising faster than daytime demand in {pulses.length} places.</h1>
          <p className="note" style={{ marginTop: 10 }}>A datacenter draws the same power at 3am in January as at noon in June. That lifts a region's night-time floor faster than its average, and the demand data shows it without any company list. Rings mark the top-ranked places with that fingerprint.</p>
        </>}
        {scene === 'sweep' && <>
          <h1 className="verdict">{natT.title}</h1>
          <div className="pair"><div><div className="label">Clean during the day</div><div className="val">{pct1(live.daytime)}</div><div className="delta">{pct1(nat['2019']?.daytime)} → {pct1(nat['2025']?.daytime)}</div></div><div><div className="label">Clean at night</div><div className="val accent">{pct1(live.overnight)}</div><div className="delta">{pct1(nat['2019']?.overnight)} → {pct1(nat['2025']?.overnight)}</div></div></div>
          <div className="yearrow"><span className="year">{live.year}</span><span className="ruler"><i style={{ width: `${Math.round(p * 100)}%` }} />{YEARS.map(yr => <span key={yr} className={yr === live.year ? 'on' : ''}>{yr}</span>)}</span><button type="button" className="btn" onClick={() => setReplay(k => k + 1)}>Replay</button></div>
          <p className="note" style={{ marginTop: 12 }}>{natT.sub}</p>
        </>}
        {scene === 'detector' && <>
          <h1 className="verdict">{detT.title}</h1>
          <p className="note" style={{ marginTop: 10 }}>{detT.sub}</p>
          <YearSlider years={traj.years} value={yp.year} onChange={yp.setYear} playing={yp.playing} onPlay={v => (v ? yp.play() : yp.setPlaying(false))} label="clean power at night, by year" />
          <div className="legend"><span><i /> under 30% clean at night</span><span><i className="dim" /> 30–60%</span><span><i className="ink" /> over 60%</span><span><i className="hollow" /> data flagged or corrected</span></div>
          <p className="note" style={{ marginTop: 10 }}>{(() => { const by = traj.summary?.by_year?.[yi]; const d = traj.summary?.biggest_drop?.[0], u = traj.summary?.biggest_rise?.[0]; return by && d && u ? `In ${yp.year} the median region ran ${Math.round((by.median_night || 0) * 100)}% clean at night. From 2019 to 2025 the biggest fall was ${coords.regions[d.id]?.label || d.id} (${Math.round(d.from * 100)}% to ${Math.round(d.to * 100)}%), the biggest rise ${coords.regions[u.id]?.label || u.id} (${Math.round(u.from * 100)}% to ${Math.round(u.to * 100)}%). Press play.` : '' })()}</p>
        </>}
      </Card>
      {scene === 'headline' && <Section title="Clean share by hour on that grid, 2025 (night in ember)"><HourBars values={pjm.profile_24h?.['2025'] || pjm.profile_24h} /></Section>}
      {scene === 'headline' && <Section title="Named before the ranking was seen"><KV rows={validation.map(r => [r.known_cluster_label || r.id, `${ordinal(r.rank)} of ${det.n_scored}`])} /></Section>}
      {scene === 'night' && <Section title="Top 10 places, growth since 2019">{rows(top)}</Section>}
      {scene === 'detector' && <Section title="Named in advance, and the new leads">{rows(named)}</Section>}
      {scene === 'sweep' && <Section title="Clean power generated, US average MW"><KV rows={[['day, 2019', `${n0(data.national?.cf_avg_mw?.['2019']?.daytime)} MW`], ['day, 2025', `${n0(data.national?.cf_avg_mw?.['2025']?.daytime)} MW`], ['night, 2019', `${n0(data.national?.cf_avg_mw?.['2019']?.overnight)} MW`], ['night, 2025', `${n0(data.national?.cf_avg_mw?.['2025']?.overnight)} MW`]]} /></Section>}
    </>
  )
  return <Shell page="found" globe={{ view: VIEWS[scene], points, rings, markers, terminator, interactive: false }} column={column} />
}
