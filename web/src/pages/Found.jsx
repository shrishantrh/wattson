import { useEffect, useMemo, useRef, useState } from 'react'
import Shell from '../console/Console.jsx'
import { Card, Num, Section, KV, HourBars } from '../console/widgets.jsx'
import YearSlider, { useYearPlayback } from '../components/YearSlider.jsx'
import WxStepper from '../components/WxStepper.jsx'
import traj from '../data/trajectory.json'
import coords from '../data/region_coords.json'
import { loadOpening, useAsync } from '../lib/data.js'
import { readTokens } from '../lib/tokens.js'
import { openingTitle, nationalTitle, detectorTitle, n0, pct1, gw1, signedGw, interpYears, ordinal, caveatFor } from '../lib/findings.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { useKey } from '../components/Shortcuts.jsx'
import { href, useHash } from '../router.js'
import '../styles/pages.css'
import '../styles/wx.css'
import Breadcrumbs, { useCrumbs } from '../components/Breadcrumbs.jsx'

// "What we found": the evidence behind the answers, one scene at a time.
const SCENES = [['headline', 'The finding'], ['night', 'At night'], ['sweep', 'Day vs night'], ['detector', 'Where load is landing']]
const VIEWS = { headline: { lat: 37, lng: -88, altitude: 1.5 }, night: { lat: 38.5, lng: -96, altitude: 1.45 }, sweep: { lat: 38.5, lng: -96, altitude: 1.45 }, detector: { lat: 38.5, lng: -96, altitude: 1.3 } }
const SCENE_KEYS = SCENES.map((_, i) => String(i + 1))
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
  // 1-4 jump between findings, through the app's one keyboard listener (which knows when the
  // user is typing in a field), never a listener of our own.
  useKey(SCENE_KEYS, e => { const i = Number(e.key) - 1; if (SCENES[i]) window.location.hash = href.found(SCENES[i][0]) })
  const crumbs = useCrumbs(useHash())
  const back = () => { window.location.hash = href.landing() }
  // Numbered sections, not a button bar: the number says there is an order and where you are.
  const tabs = <nav className="fd-nav" aria-label="Findings">{SCENES.map(([id, label], i) => <a key={id} href={href.found(id)} aria-current={id === scene ? 'true' : undefined}><span className="n">{String(i + 1).padStart(2, '0')}</span><span className="l">{label}</span></a>)}</nav>
  const sceneIdx = Math.max(0, SCENES.findIndex(([id]) => id === scene))
  const sceneSteps = useMemo(() => SCENES.map(([id, label]) => ({ key: id, title: label })), [])

  // The finding as four figures rather than one paragraph: each step adds a number and the
  // sentence that number supports, and the ones already walked stay on screen underneath, so
  // the argument accumulates instead of arriving all at once. Every figure is read off the
  // export; a step whose figure is missing is not built at all.
  const [step, setStep] = useState(0)
  useEffect(() => { setStep(0) }, [scene])
  const steps = useMemo(() => {
    const pj = data?.pjm
    if (!pj) return []
    const out = []
    const c19 = pj.overnight_clean_mw?.['2019'], c25 = pj.overnight_clean_mw?.['2025']
    const t19 = pj.overnight_total_mw?.['2019'], t25 = pj.overnight_total_mw?.['2025']
    const gas = pj.fuel_delta_overnight_gw?.gas, coal = pj.fuel_delta_overnight_gw?.coal
    const e19 = pj.overnight_net_export_mw?.['2019'], e25 = pj.overnight_net_export_mw?.['2025']
    if (c19 != null && c25 != null) out.push({
      key: 'clean', title: 'Clean power at night', value: `${n0(c19)} → ${n0(c25)}`, unit: 'MW of clean power at night, 2019 then 2025',
      say: `Six years, and the carbon-free megawatts PJM generates between midnight and 6am are within ${n0(Math.abs(c25 - c19))} MW of where they started. That is output, not a share: nothing about this figure depends on how the rest of the grid moved.`,
    })
    if (t19 != null && t25 != null) out.push({
      key: 'total', title: 'All power at night', value: signedGw((t25 - t19) / 1000), unit: 'more generation in those same hours since 2019',
      say: `Overnight generation went ${n0(t19)} MW to ${n0(t25)} MW. The night got ${gw1(t25 - t19)} bigger while the clean part of it stayed flat — which is the entire reason the overnight clean share falls without a single clean megawatt being lost.`,
    })
    if (gas != null) out.push({
      key: 'gas', title: 'What filled the gap', value: signedGw(gas), unit: 'gas at night, 2019 to 2025', tone: 'fossil',
      // fuel_delta_overnight_gw is already in GW, so it takes signedGw; gw1 divides MW by 1000.
      say: `Gas overnight rose ${signedGw(gas)}${coal != null && coal < 0 ? `, more than the growth itself, because it also had to cover ${signedGw(coal).replace('\u2212', '')} of coal that retired` : ''}. Consistent with new round-the-clock load being served by gas; the demand data does not say whose load it is.`,
    })
    if (e19 != null && e25 != null) out.push({
      key: 'export', title: 'Where it went', value: `${gw1(e19)} → ${gw1(e25)}`, unit: 'net exports at night — positive means PJM sends power out',
      say: e25 < e19
        ? `If the extra power had been for the neighbors, exports would have risen. They fell from ${gw1(e19)} to ${gw1(e25)}, so the new gas generation stayed inside PJM and served load here.`
        : `Net exports rose from ${gw1(e19)} to ${gw1(e25)}, so some of the extra power left PJM rather than serving load inside it.`,
    })
    return out
  }, [data])
  const stepAt = Math.min(step, Math.max(0, steps.length - 1))

  if (loading || error) return <Shell page="found" globe={{ view: VIEWS.headline }} column={<><Breadcrumbs trail={crumbs} onBack={back} /><Card title={<b>What we found</b>} onClose={back}>{loading ? <Loading what="the findings" /> : <ErrorState error={error} onRetry={reload} />}</Card></>} />
  const pjm = data.pjm, nat = data.national?.cf_share || {}
  const head = openingTitle(pjm), natT = nationalTitle(nat), detT = detectorTitle(det)
  const live = interpYears(nat, scene === 'sweep' ? p : 0)
  const validation = scored.filter(r => r.validation).sort((a, b) => a.rank - b.rank)
  const rows = list => <div className="rows pg-ranked">{list.map(r => <a className="row" key={r.id} href={href.region(r.id)}><span className="rk">{r.rank}</span><div><div className={`t ${leads.has(r.id) ? 'accent' : ''}`}>{r.known_cluster_label || r.c.label}{r.data_flagged ? ' · data flagged' : leads.has(r.id) ? ' · new' : ''}</div><div className="d">{r.pattern}</div></div><div className="n">{r.growth_pct != null ? `${r.growth_pct > 0 ? '+' : ''}${r.growth_pct.toFixed(0)}%` : '—'}</div></a>)}</div>

  const column = (
    <>
      <Breadcrumbs trail={crumbs} onBack={back} />
      <Card title={<b>What we found</b>} onClose={back}>
        <p className="pg-top">Four findings from the hourly grid data. <span className="q">Take them in order.</span></p>
        {tabs}
        {scene === 'headline' && <div className="fd-scene">
          <p className="fd-say" style={{ marginTop: 0 }}>{head.title.replace("PJM's", "The mid-Atlantic grid's (PJM)")}</p>
          {steps.length ? (
            <>
              <WxStepper steps={steps} index={stepAt} onIndex={setStep} label="step" keys />
              <div className="wx-stepbody">
                <div className="wx-stepfig"><span className={`v ${steps[stepAt].tone || ''}`}>{steps[stepAt].value}</span><span className="u">{steps[stepAt].unit}</span></div>
                <p className="say">{steps[stepAt].say}</p>
              </div>
              {stepAt > 0 && (
                <div className="wx-priors">
                  {steps.slice(0, stepAt).map(s => <div className="wx-prior" key={s.key}><span>{s.title}</span><span className="pv">{s.value}</span></div>)}
                </div>
              )}
              {stepAt === steps.length - 1 && <p className="note pg-fine">{head.sub}</p>}
              <p className="wx-hint" style={{ marginTop: 12 }}>Walk it with <span className="wx-kbd">&larr;</span> <span className="wx-kbd">&rarr;</span>, or press <span className="wx-kbd">1</span>&ndash;<span className="wx-kbd">4</span> to jump to another finding.</p>
            </>
          ) : (
            <>
              <div className="fd-fig">
                <div className="fd-fig-val">{n0(pjm.overnight_clean_mw?.['2019'])}<span className="arrow">&rarr;</span>{n0(pjm.overnight_clean_mw?.['2025'])}</div>
                <div className="fd-fig-unit">MW clean at night, 2019 &rarr; 2025</div>
              </div>
              <div className="nums fd-nums"><Num value={signedGw((pjm.overnight_total_mw?.['2025'] - pjm.overnight_total_mw?.['2019']) / 1000)} label="more power at night since 2019" /><Num value={signedGw(pjm.fuel_delta_overnight_gw?.gas)} label="of it from gas" accent /><Num value={`${gw1(pjm.overnight_net_export_mw?.['2019'])} → ${gw1(pjm.overnight_net_export_mw?.['2025'])}`} label="exports to neighbors" /></div>
              <p className="note pg-fine">{head.sub}</p>
            </>
          )}
        </div>}
        {scene === 'night' && <div className="fd-scene">
          <div className="fd-fig">
            <div className="fd-fig-val">{pulses.length}</div>
            <div className="fd-fig-unit">places with the flat-load fingerprint</div>
          </div>
          <p className="fd-say">Night-time demand is rising faster than daytime demand in {pulses.length} places.</p>
          <p className="note pg-fine">A datacenter draws the same power at 3am in January as at noon in June. That lifts a region's night-time floor faster than its average, and the demand data shows it without any company list. Rings mark the top-ranked places with that fingerprint.</p>
        </div>}
        {scene === 'sweep' && <div className="fd-scene">
          <p className="fd-say" style={{ marginTop: 0 }}>{natT.title}</p>
          <div className="pair"><div><div className="label">Clean during the day</div><div className="val">{pct1(live.daytime)}</div><div className="delta">{pct1(nat['2019']?.daytime)} → {pct1(nat['2025']?.daytime)}</div></div><div><div className="label">Clean at night</div><div className="val clean">{pct1(live.overnight)}</div><div className="delta">{pct1(nat['2019']?.overnight)} → {pct1(nat['2025']?.overnight)}</div></div></div>
          <div className="fd-years">
            <div className="fd-years-top"><span className="fd-years-year">{live.year}</span><span className="fd-years-label">the gap opening, year by year</span><button type="button" className="btn" onClick={() => setReplay(k => k + 1)}>Replay</button></div>
            <div className="fd-track"><i style={{ width: `${Math.round(p * 100)}%` }} /></div>
            <div className="fd-ticks">{YEARS.map(yr => <span key={yr} className={yr === live.year ? 'on' : ''}>{String(yr).slice(2)}</span>)}</div>
          </div>
          <p className="note pg-fine">{natT.sub}</p>
        </div>}
        {scene === 'detector' && <div className="fd-scene">
          <p className="fd-say" style={{ marginTop: 0 }}>{detT.title}</p>
          <p className="note" style={{ marginTop: 10 }}>{detT.sub}</p>
          <YearSlider years={traj.years} value={yp.year} onChange={yp.setYear} playing={yp.playing} onPlay={v => (v ? yp.play() : yp.setPlaying(false))} label="clean power at night, by year" />
          <div className="legend"><span><i /> under 30% clean at night</span><span><i className="dim" /> 30–60%</span><span><i className="ink" /> over 60%</span><span><i className="hollow" /> data flagged or corrected</span></div>
          <p className="note pg-fine">{(() => { const by = traj.summary?.by_year?.[yi]; const d = traj.summary?.biggest_drop?.[0], u = traj.summary?.biggest_rise?.[0]; const ex = traj.summary?.excluded_step_changes || []; const natY = nat[String(yp.year)]?.overnight; return by && d && u ? `In ${yp.year} the US ran ${natY != null ? pct1(natY) : '—'} clean at night. From 2019 to 2025 the biggest fall among grids was ${coords.regions[d.id]?.label || d.id} (${Math.round(d.from * 100)}% to ${Math.round(d.to * 100)}%), the biggest rise ${coords.regions[u.id]?.label || u.id} (${Math.round(u.from * 100)}% to ${Math.round(u.to * 100)}%) — where a datacenter lands decides what burns for it. Zones are colored with their grid's share, since zones report demand only.${ex.length ? ` ${ex.map(id => coords.regions[id]?.label || id).join(', ')} show a single-year step in the published data and are left out.` : ''} Press play.` : '' })()}</p>
        </div>}
        <WxStepper steps={sceneSteps} index={sceneIdx} onIndex={i => { window.location.hash = href.found(SCENES[i][0]) }} label="finding" keys={false} prevLabel="Previous finding" nextLabel="Next finding" />
      </Card>
      {scene === 'headline' && <Section title="PJM's cleanest hours are the middle of the day; a datacenter runs the marked ones too (2025)"><HourBars values={pjm.profile_24h?.['2025'] || pjm.profile_24h} /></Section>}
      {scene === 'headline' && <Section title="The test we could have failed: clusters named before the ranking was run"><KV rows={validation.map(r => [r.known_cluster_label || r.id, `${ordinal(r.rank)} of ${det.n_scored}`])} /></Section>}
      {scene === 'night' && <Section title="Where flat load is landing hardest — the detector's top ten" right={<span className="mono muted" style={{ fontSize: 11 }}>rank · avg demand growth since 2019</span>}>{rows(top)}</Section>}
      {scene === 'detector' && <Section title="Named in advance, plus the places the detector found that nobody has named" right={<span className="mono muted" style={{ fontSize: 11 }}>avg demand growth since 2019</span>}>{rows(named)}</Section>}
      {scene === 'sweep' && <Section title="The night's share fell while its clean output rose — total demand simply grew faster (US average MW)"><KV rows={[['day, 2019', `${n0(data.national?.cf_avg_mw?.['2019']?.daytime)} MW`], ['day, 2025', `${n0(data.national?.cf_avg_mw?.['2025']?.daytime)} MW`], ['night, 2019', `${n0(data.national?.cf_avg_mw?.['2019']?.overnight)} MW`], ['night, 2025', `${n0(data.national?.cf_avg_mw?.['2025']?.overnight)} MW`]]} /></Section>}
    </>
  )
  return <Shell page="found" globe={{ view: VIEWS[scene], points, rings, markers, terminator, interactive: false }} column={column} />
}
