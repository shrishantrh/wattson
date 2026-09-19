import { useEffect, useMemo, useRef, useState } from 'react'
import Console, { StatusLine } from '../console/Console.jsx'
import { Panel, Ring, Ticks, BigNum, KV, HourBars, Pill, Stat } from '../console/widgets.jsx'
import coords from '../data/region_coords.json'
import { loadOpening, useAsync } from '../lib/data.js'
import { readTokens } from '../lib/tokens.js'
import { openingTitle, nationalTitle, detectorTitle, n0, pct0, pct1, pts1, gw1, signedGw, interpYears, ordinal } from '../lib/findings.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { href } from '../router.js'

// The opening: one globe, four scenes, switched by the toolbar, the left rail, or the demo keys.
const SCENES = [['headline', 'The finding'], ['night', 'At night'], ['sweep', 'Day vs night'], ['detector', 'Detector']]
const VIEWS = {
  headline: { lat: 35, lng: -90, altitude: 1.65 },
  night: { lat: 38.5, lng: -96, altitude: 1.45 },
  sweep: { lat: 38.5, lng: -96, altitude: 1.45 },
  detector: { lat: 38.5, lng: -96, altitude: 1.3 },
}
const SUN_NIGHT = 60           // sun over the Indian Ocean: the Americas in darkness
const SUN_SWEEP = [15, -45]    // dawn line moves from the Atlantic coast to past the Pacific coast
const SWEEP_MS = 7000
const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025]

// Pin labels default to the right of the stem. Where two pins sit within a label's width of
// each other, the western one labels to the left so the two never overlap.
function sideLabels(pins, dLng = 7, dLat = 2.6) {
  const out = pins.map(p => ({ ...p }))
  for (const a of out) for (const b of out) {
    if (a === b || a.lng >= b.lng) continue
    if (Math.abs(a.lng - b.lng) < dLng && Math.abs(a.lat - b.lat) < dLat) a.side = 'left'
  }
  return out
}

function useTween(target, ms, enabled = true) {
  const [v, setV] = useState(target)
  const ref = useRef({ raf: 0 })
  useEffect(() => {
    const r = ref.current
    cancelAnimationFrame(r.raf)
    if (!enabled || ms <= 0) { setV(target); return }
    const from = v, t0 = performance.now()
    const step = now => {
      const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3)
      setV(from + (target - from) * e)
      if (k < 1) r.raf = requestAnimationFrame(step)
    }
    r.raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(r.raf)
  }, [target, ms, enabled])   // eslint-disable-line react-hooks/exhaustive-deps
  return v
}

// Sweep progress: plays 0 -> 1 over SWEEP_MS each time the scene is entered or replayed.
function useSweep(active, replayKey) {
  const [p, setP] = useState(0)
  useEffect(() => {
    if (!active) { setP(0); return }
    let raf = 0
    const t0 = performance.now() + 500
    const step = now => { const k = Math.min(1, Math.max(0, (now - t0) / SWEEP_MS)); setP(k); if (k < 1) raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [active, replayKey])
  return p
}

export default function Opening({ route }) {
  const { loading, error, data, reload } = useAsync(loadOpening, [])
  const scene = SCENES.some(([id]) => id === route.params?.s) ? route.params.s : 'headline'
  const [replay, setReplay] = useState(0)
  const p = useSweep(scene === 'sweep', replay)
  const tk = useMemo(readTokens, [])

  const det = data?.detector
  const scored = useMemo(() => (det?.regions || []).map(r => ({ ...r, c: coords.regions[r.id] })).filter(r => r.c), [det])
  const top = useMemo(() => scored.filter(r => r.rank <= 10), [scored])
  const pulses = useMemo(() => top.filter(r => !r.data_flagged && r.pattern === 'flat-load growth'), [top])
  const leads = useMemo(() => new Set(det?.new_leads || []), [det])
  const named = useMemo(() => scored.filter(r => r.validation || leads.has(r.id)).sort((a, b) => a.rank - b.rank), [scored, leads])

  const points = useMemo(() => {
    if (scene === 'detector') return scored.map(r => ({ id: r.id, lat: r.c.lat, lng: r.c.lng, r: r.score > 0 ? 0.16 + 0.22 * Math.min(1, r.score / 10) : 0.11, color: r.data_flagged ? tk.ink2 : r.score > 0 ? tk.accent : tk.muted, hollow: !!r.data_flagged }))
    if (scene !== 'headline') return pulses.map(r => ({ id: r.id, lat: r.c.lat, lng: r.c.lng, r: 0.18, color: tk.accent, hollow: false }))
    return [{ id: 'PJM/DOM', lat: coords.regions['PJM/DOM'].lat, lng: coords.regions['PJM/DOM'].lng, r: 0.22, color: tk.accent, hollow: false }]
  }, [scene, scored, pulses, tk])
  const rings = useMemo(() => {
    if (scene === 'headline') return [{ id: 'PJM/DOM', lat: coords.regions['PJM/DOM'].lat, lng: coords.regions['PJM/DOM'].lng, color: tk.accent, maxR: 3, speed: 0.8, period: 1600 }]
    if (scene === 'night' || scene === 'detector') return pulses.map(r => ({ id: r.id, lat: r.c.lat, lng: r.c.lng, color: tk.accent, maxR: 2.4, speed: 0.7, period: 1500 }))
    return []
  }, [scene, pulses, tk])
  const markers = useMemo(() => {
    const pin = (r, extra = {}) => ({ id: r.id, lat: r.c.lat, lng: r.c.lng, label: r.known_cluster_label || r.c.label, href: href.region(r.id), hollow: !!r.data_flagged, ...extra })
    if (scene === 'detector') return sideLabels(named.map(r => pin(r, { lead: leads.has(r.id), color: r.validation ? tk.ink : tk.accent })))
    if (scene === 'night') return sideLabels(pulses.map(r => pin(r, { lead: leads.has(r.id), color: tk.accent })))
    if (scene === 'headline') { const c = coords.regions['PJM/DOM']; return [{ id: 'PJM/DOM', lat: c.lat, lng: c.lng, label: 'N. Virginia · +39% overnight', href: href.region('PJM/DOM'), color: tk.accent }] }
    return []
  }, [scene, named, pulses, leads, tk])

  const sunTarget = scene === 'sweep' ? SUN_SWEEP[0] + (SUN_SWEEP[1] - SUN_SWEEP[0]) * p : SUN_NIGHT
  const sunLng = useTween(sunTarget, 1100, scene !== 'sweep')
  const terminator = useMemo(() => ({ enabled: true, sunLng, sunLat: 0, dayDim: 0.32 }), [sunLng])

  const scenesNav = SCENES.map(([id, label]) => ({ id, label, active: id === scene, href: href.opening(id) }))
  const toolbar = (
    <div className="toolbar" role="tablist">
      {SCENES.map(([id, label], i) => <button key={id} type="button" role="tab" className={id === scene ? 'on' : ''} onClick={() => { window.location.hash = href.opening(id) }}><i />{label}<span className="key">{i + 1}</span></button>)}
      {scene === 'sweep' && <button type="button" onClick={() => setReplay(k => k + 1)}>Replay</button>}
    </div>
  )
  useEffect(() => {
    const onKey = e => { if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return; const i = Number(e.key) - 1; if (SCENES[i]) window.location.hash = href.opening(SCENES[i][0]) }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (loading || error) {
    return <Console page="opening" crumb="Loading" center={<div className="center-panel"><Panel>{loading ? <Loading what="the opening" /> : <ErrorState error={error} onRetry={reload} />}</Panel></div>} />
  }

  const pjm = data.pjm, nat = data.national?.cf_share || {}
  const head = openingTitle(pjm), natT = nationalTitle(nat), detT = detectorTitle(det)
  const live = interpYears(nat, scene === 'sweep' ? p : 0)
  const clean25 = pjm.overnight_clean_mw?.['2025'], total25 = pjm.overnight_total_mw?.['2025']
  const share25 = pjm.overnight_cf_share?.['2025'] ?? (clean25 && total25 ? clean25 / total25 : null)
  const dGen = (pjm.overnight_total_mw?.['2025'] - pjm.overnight_total_mw?.['2019']) / 1000
  const domG = pjm.dom_overnight_demand_mw ? pjm.dom_overnight_demand_mw['2025'] / pjm.dom_overnight_demand_mw['2019'] - 1 : null
  const profile = pjm.profile_24h?.['2025'] || pjm.profile_24h
  const validation = scored.filter(r => r.validation).sort((a, b) => a.rank - b.rank)

  const crumb = <><b>PJM Interconnection</b><i>/</i>overnight {data.overnight_hours_local || '00:00–05:59'} local<i>/</i>{data.baseline_year || 2019} → 2025<i>/</i><b>{SCENES.find(([id]) => id === scene)?.[1]}</b></>
  const kv = [['snapshot', data.data_snapshot_end], ['baseline', String(data.baseline_year || 2019)], ['window', data.overnight_hours_local || '00:00–05:59'], ['regions', String(det?.n_scored ?? '—')]]

  const rankedList = (rows, showTicks = true) => (
    <ul className="compact">
      {rows.map(r => (
        <li key={r.id} className={leads.has(r.id) ? 'lead' : r.data_flagged ? 'flag' : ''}>
          <span>{r.rank}</span>
          <a href={href.region(r.id)}><span className="lab">{r.known_cluster_label || r.c.label}{r.data_flagged ? ' · flagged' : leads.has(r.id) ? ' · new' : ''}</span></a>
          {showTicks ? <Ticks value={r.growth_pct} max={120} n={12} accent={leads.has(r.id)} /> : <span />}
          <span className="r">{r.growth_pct != null ? `${r.growth_pct > 0 ? '+' : ''}${r.growth_pct.toFixed(0)}%` : '—'}</span>
        </li>
      ))}
    </ul>
  )

  const center = (
    <div className="center-panel">
      {scene === 'headline' && (
        <Panel title={<>PJM <b>overnight clean generation</b> · avg MW</>}>
          <h1 className="finding">{head.title}</h1>
          <div className="hero-num">{n0(pjm.overnight_clean_mw?.['2019'])}<span className="arrow">→</span>{n0(pjm.overnight_clean_mw?.['2025'])}<span className="unit">MW</span></div>
          <p className="hero-caption">2019 → 2025 · clean = nuclear, hydro, wind, solar, geothermal</p>
          <p className="sub">{head.sub}</p>
          <div className="panel-actions"><a className="cta primary" href={href.region('PJM/DOM')}>Northern Virginia →</a><a className="cta" href={href.opening('night')}>What is landing at night →</a></div>
        </Panel>
      )}
      {scene === 'night' && (
        <Panel title={<>Flat-load detector · <b>top {top.length} of {det?.n_scored}</b></>}>
          <h1 className="finding">Overnight demand is rising faster than the day in {pulses.length} regions.</h1>
          <p className="sub">A datacenter draws the same power at 3am in January as at noon in June. That raises a region's overnight floor faster than its average, and it shows in the demand data alone. Rings mark the top-ranked regions with that fingerprint.</p>
          <div className="pin-legend"><span><i /> flat-load growth</span><span><i className="hollow" /> data flagged</span></div>
          <div className="panel-actions"><a className="cta primary" href={href.site()}>Site a load →</a><a className="cta" href={href.opening('sweep')}>Day vs night →</a></div>
        </Panel>
      )}
      {scene === 'sweep' && (
        <Panel title={<>United States · <b>carbon-free share of generation</b></>}>
          <h1 className="finding">{natT.title}</h1>
          <div className="pair">
            <div><div className="label">Daytime {data.daytime_hours_local || '10:00–15:59'}</div><div className="val">{pct1(live.daytime)}</div><div className="delta">{pct1(nat['2019']?.daytime)} → {pct1(nat['2025']?.daytime)}</div></div>
            <div><div className="label">Overnight {data.overnight_hours_local || '00:00–05:59'}</div><div className="val accent">{pct1(live.overnight)}</div><div className="delta">{pct1(nat['2019']?.overnight)} → {pct1(nat['2025']?.overnight)}</div></div>
          </div>
          <div className="yearrow"><span className="year">{live.year}</span><span className="ruler"><i style={{ width: `${Math.round(p * 100)}%` }} />{YEARS.map(yr => <span key={yr} className={yr === live.year ? 'on' : ''}>{yr}</span>)}</span></div>
          <p className="sub">{natT.sub}</p>
        </Panel>
      )}
      {scene === 'detector' && (
        <Panel title={<>Flat-load detector · <b>method frozen before the ranking was seen</b></>}>
          <h1 className="finding">{detT.title}</h1>
          <p className="sub">{detT.sub}</p>
          <div className="pin-legend"><span><i /> score above zero</span><span><i className="dim" /> below zero</span><span><i className="hollow" /> data flagged</span><span><i className="ink" /> named in advance</span></div>
          <div className="panel-actions"><a className="cta primary" href={href.site()}>Site a load →</a><a className="cta" href={href.verify('META')}>Verify a claim →</a><a className="cta" href={href.method()}>Method</a></div>
        </Panel>
      )}
    </div>
  )

  const right = (
    <>
      <Panel title={<>Overnight <b>2025</b> · PJM</>} right={<a className="cta" href={href.region('PJM')}>View →</a>}>
        <div className="instrument"><Ring value={share25} /><div><BigNum num={n0(clean25)} den={n0(total25)} unit="MW" /><div className="label">clean of overnight generation</div></div></div>
        <KV rows={[['share 2019 → 2025', `${pct1(pjm.overnight_cf_share?.['2019'])} → ${pct1(share25)}`], ['gas since 2019', signedGw(pjm.fuel_delta_overnight_gw?.gas)], ['coal', signedGw(pjm.fuel_delta_overnight_gw?.coal)], ['nuclear', signedGw(pjm.fuel_delta_overnight_gw?.nuclear)], ['net exports', `${gw1(pjm.overnight_net_export_mw?.['2019'])} → ${gw1(pjm.overnight_net_export_mw?.['2025'])}`]]} />
      </Panel>
      {scene === 'detector' ? (
        <Panel title={<>Named in advance · <b>and new leads</b></>}>{rankedList(named)}</Panel>
      ) : scene === 'sweep' ? (
        <Panel title={<>Clean generation · <b>avg MW</b> · US</>}>
          <KV rows={[['daytime 2019', `${n0(data.national?.cf_avg_mw?.['2019']?.daytime)} MW`], ['daytime 2025', `${n0(data.national?.cf_avg_mw?.['2025']?.daytime)} MW`], ['overnight 2019', `${n0(data.national?.cf_avg_mw?.['2019']?.overnight)} MW`], ['overnight 2025', `${n0(data.national?.cf_avg_mw?.['2025']?.overnight)} MW`]]} />
        </Panel>
      ) : (
        <Panel title={<>Detector · <b>top {scene === 'night' ? 10 : 5}</b> · growth since 2019</>} right={<a className="cta" href={href.opening('detector')}>All 111 →</a>}>{rankedList(scene === 'night' ? top : top.slice(0, 5))}</Panel>
      )}
      {scene === 'headline' && (
        <Panel title={<>Validation · <b>named before the ranking</b></>}>
          <KV rows={validation.map(r => [r.known_cluster_label || r.id, `${ordinal(r.rank)} of ${det.n_scored}`])} />
        </Panel>
      )}
    </>
  )

  const bottom = (
    <>
      <div>
        <div className="pills"><Pill value="PJM">Region</Pill><Pill value="Overnight">Window</Pill><Pill value="2019–2025">Years</Pill></div>
        <div className="stats" style={{ gridTemplateColumns: 'repeat(2, minmax(150px, 1fr))' }}>
          <Stat num={signedGw(dGen)} label="overnight generation since 2019" value={dGen} max={12} />
          <Stat num={signedGw(pjm.fuel_delta_overnight_gw?.gas)} label="of it gas" value={pjm.fuel_delta_overnight_gw?.gas} max={12} accent />
        </div>
      </div>
      <div><HourBars values={profile} caption={<>PJM · <b>clean share by hour</b> · 2025 · overnight in ember</>} /></div>
      <div className="stats" style={{ gridTemplateColumns: 'repeat(2, minmax(150px, 1fr))' }}>
        <Stat num={gw1(pjm.overnight_net_export_mw?.['2019'])} den={gw1(pjm.overnight_net_export_mw?.['2025'])} label="net exports 2019 / 2025" value={pjm.overnight_net_export_mw?.['2025']} max={pjm.overnight_net_export_mw?.['2019']} />
        <Stat num={domG != null ? `+${Math.round(domG * 100)}%` : '—'} label="Dominion overnight demand" value={domG != null ? domG * 100 : null} max={60} accent />
      </div>
    </>
  )

  return <Console page="opening" crumb={crumb} scenes={scenesNav} kv={kv} globe={{ view: VIEWS[scene], points, rings, markers, terminator }} center={center} right={right} bottom={bottom} toolbar={toolbar} status={<StatusLine data={data} extra={<span>{pct0(nat['2025']?.overnight)} overnight clean nationally</span>} />} />
}
