import { useEffect, useMemo, useRef, useState } from 'react'
import { Globe, FlatMap, useGlobeCapability } from '../globe'
import coords from '../data/region_coords.json'
import { loadOpening, useAsync } from '../lib/data.js'
import { readTokens } from '../lib/tokens.js'
import { openingTitle, nationalTitle, detectorTitle, n0, pct1, pct0, gw1, signedGw, interpYears } from '../lib/findings.js'
import { Loading, ErrorState, Provisional } from '../components/States.jsx'
import { href } from '../router.js'

// The opening: one globe, four moments. The text column scrolls; the globe reacts to which
// moment is in view. Motion is driven by scroll position (or the scripted demo), never idle.
const SCENES = ['headline', 'night', 'sweep', 'detector']
const VIEWS = {
  headline: { lat: 24, lng: -98, altitude: 2.0 },
  night: { lat: 38.5, lng: -97, altitude: 1.5 },
  sweep: { lat: 38.5, lng: -97, altitude: 1.5 },
  detector: { lat: 38.5, lng: -97, altitude: 1.3 },
}
const SUN_NIGHT = 60           // sun over the Indian Ocean: the Americas in darkness
const SUN_SWEEP = [15, -45]    // dawn line moves from the Atlantic coast to past the Pacific coast
const SWEEP_MS = 7000          // scripted sweep duration
const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025]

// Segmented tick bar (from the reference boards): 16 segments, filled in proportion to value/max.
function Ticks({ value, max = 100, n = 16, accent = false }) {
  const k = value == null ? 0 : Math.round(Math.min(1, Math.max(0, value / max)) * n)
  return <span className={`ticks ${accent ? 'accent' : ''}`} aria-hidden="true">{Array.from({ length: n }, (_, i) => <i key={i} className={i < k ? 'on' : value != null && value < 0 ? 'neg' : ''} />)}</span>
}

function StatusLine({ data }) {
  const det = data?.detector || {}
  return <div className="statusline"><span><b>Wattson</b> // EIA-930 via PUDL</span><span>snapshot <b>{data?.data_snapshot_end || '—'}</b></span><span>baseline <b>{data?.baseline_year || 2019}</b></span><span><b>{det.n_scored ?? '—'}</b> regions scored</span><span>overnight <b>{data?.overnight_hours_local || '00:00–05:59'}</b> local</span>{data?._provisional && <span><i>provisional fixture</i></span>}</div>
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

// Which section sits at the viewport centre, and progress through the sweep section.
function useScrollScenes(refs) {
  const [st, setSt] = useState({ scene: 'headline', p: 0 })
  useEffect(() => {
    let raf = 0
    const calc = () => {
      raf = 0
      const vh = window.innerHeight, mid = vh / 2
      let scene = 'headline', p = 0
      for (const s of SCENES) {
        const el = refs.current[s]; if (!el) continue
        const r = el.getBoundingClientRect()
        if (r.top <= mid && r.bottom > mid) scene = s
        if (s === 'sweep') { const span = Math.max(1, r.height - vh); p = Math.min(1, Math.max(0, -r.top / span)) }
      }
      setSt(prev => (prev.scene === scene && Math.abs(prev.p - p) < 0.0015 ? prev : { scene, p }))
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(calc) }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    calc()
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf) }
  }, [refs])
  return st
}

// Scripted scenes (#/?s=night etc.): scroll the section into view; for the sweep, drive the
// scroll from the top of the section to its end over SWEEP_MS so the numbers follow the years.
function useScriptedScene(scene, refs) {
  useEffect(() => {
    if (!scene) return
    const el = refs.current[scene]; if (!el) return
    const top = window.scrollY + el.getBoundingClientRect().top
    let raf = 0, cancelled = false
    const stop = () => { cancelled = true; cancelAnimationFrame(raf) }
    if (scene !== 'sweep') { window.scrollTo({ top, behavior: 'smooth' }); return }
    window.scrollTo({ top, behavior: 'auto' })
    const span = el.getBoundingClientRect().height - window.innerHeight
    const t0 = performance.now() + 400
    const step = now => {
      if (cancelled) return
      const k = Math.min(1, Math.max(0, (now - t0) / SWEEP_MS))
      window.scrollTo({ top: top + span * k, behavior: 'auto' })
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    const onUser = e => { if (e.type === 'keydown' && !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(e.key)) return; stop() }
    window.addEventListener('wheel', onUser, { passive: true }); window.addEventListener('touchmove', onUser, { passive: true }); window.addEventListener('keydown', onUser)
    return () => { stop(); window.removeEventListener('wheel', onUser); window.removeEventListener('touchmove', onUser); window.removeEventListener('keydown', onUser) }
  }, [scene, refs])
}

export default function Opening({ route }) {
  const { loading, error, data, reload } = useAsync(loadOpening, [])
  const refs = useRef({})
  const { scene, p } = useScrollScenes(refs)
  useScriptedScene(route.params?.s, refs)
  const cap = useGlobeCapability()
  const tk = useMemo(readTokens, [])

  const det = data?.detector
  const scored = useMemo(() => (det?.regions || []).map(r => ({ ...r, c: coords.regions[r.id] })).filter(r => r.c), [det])
  const top = useMemo(() => scored.filter(r => r.rank <= 10), [scored])
  const pulses = useMemo(() => top.filter(r => !r.data_flagged && r.pattern === 'flat-load growth'), [top])
  const leads = useMemo(() => new Set(det?.new_leads || []), [det])

  const points = useMemo(() => {
    if (scene === 'detector') return scored.map(r => ({ id: r.id, lat: r.c.lat, lng: r.c.lng, r: r.score > 0 ? 0.16 + 0.22 * Math.min(1, r.score / 10) : 0.11, color: r.data_flagged ? tk.ink2 : r.score > 0 ? tk.accent : tk.muted, hollow: !!r.data_flagged }))
    if (scene === 'night' || scene === 'sweep') return pulses.map(r => ({ id: r.id, lat: r.c.lat, lng: r.c.lng, r: 0.18, color: tk.accent, hollow: false }))
    return []
  }, [scene, scored, pulses, tk])
  const rings = useMemo(() => (scene === 'night' || scene === 'detector' ? pulses.map(r => ({ id: r.id, lat: r.c.lat, lng: r.c.lng, color: tk.accent, maxR: 2.4, speed: 0.7, period: 1500 })) : []), [scene, pulses, tk])
  const labels = useMemo(() => (scene === 'detector' ? scored.filter(r => r.validation || leads.has(r.id)).map(r => ({ id: r.id, lat: r.c.lat, lng: r.c.lng, text: r.c.label, size: 0.45, color: r.validation ? tk.ink : tk.accent, dot: false })) : []), [scene, scored, leads, tk])

  const sunTarget = scene === 'sweep' ? SUN_SWEEP[0] + (SUN_SWEEP[1] - SUN_SWEEP[0]) * p : SUN_NIGHT
  const sunLng = useTween(sunTarget, scene === 'sweep' ? 0 : 1100)
  const view = VIEWS[scene] || VIEWS.headline
  const terminator = useMemo(() => ({ enabled: true, sunLng, sunLat: 0, dayDim: 0.32 }), [sunLng])

  if (loading) return <div className="page"><Loading what="the opening" /></div>
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>

  const pjm = data.pjm, nat = data.national?.cf_share || {}
  const head = openingTitle(pjm), natT = nationalTitle(nat), detT = detectorTitle(det)
  const live = interpYears(nat, scene === 'sweep' ? p : scene === 'detector' ? 1 : 0)
  const GlobeC = cap === 'webgl' ? Globe : FlatMap
  const set = s => el => { refs.current[s] = el }

  return (
    <>
      <div className={`globe-stage ${cap === 'flat' ? 'flat' : ''}`} aria-hidden="true">
        <GlobeC view={view} points={points} rings={rings} labels={labels} terminator={terminator} interactive={false} autoRotate={0} atmosphere={{ color: '#ffffff', altitude: 0.1 }} quality="auto" />
      </div>
      <main className="opening">
        <section className="scene headline" ref={set('headline')}>
          <div className="scene-inner">
            <Provisional data={data} />
            <p className="eyebrow">PJM Interconnection · overnight {data.overnight_hours_local || '00:00–05:59'} local · {data.baseline_year || 2019} to 2025</p>
            <h1 className="finding">{head.title}</h1>
            <div className="hero-num">{n0(pjm.overnight_clean_mw?.['2019'])}<span className="arrow">→</span>{n0(pjm.overnight_clean_mw?.['2025'])}<span className="unit">MW</span></div>
            <p className="hero-caption">clean generation, overnight average</p>
            <p className="sub">{head.sub}</p>
            <div className="stat-row">
              <div><b>{n0(pjm.overnight_clean_mw?.['2025'])}<span className="den">/ {n0(pjm.overnight_total_mw?.['2025'])} MW</span></b>clean of overnight generation, 2025</div>
              <div><b>{signedGw((pjm.overnight_total_mw?.['2025'] - pjm.overnight_total_mw?.['2019']) / 1000)}<span className="den">gas {signedGw(pjm.fuel_delta_overnight_gw?.gas)}</span></b>overnight generation since 2019</div>
              <div><b>{gw1(pjm.overnight_net_export_mw?.['2019'])}<span className="den">→ {gw1(pjm.overnight_net_export_mw?.['2025'])}</span></b>net exports</div>
            </div>
          </div>
        </section>

        <section className="scene night" ref={set('night')}>
          <div className="scene-inner">
            <p className="eyebrow">Flat-load detector · top {top.length} of {det?.n_scored} regions</p>
            <h2 className="finding">Overnight demand is rising faster than the day in {pulses.length} regions.</h2>
            <p className="sub">A datacenter draws the same power at 3am in January as at noon in June. That raises a region's overnight floor faster than its average, and it shows in the demand data alone. Rings mark the top-ranked regions with that fingerprint.</p>
            <ol className="ranked">
              {top.map(r => (
                <li key={r.id} className={leads.has(r.id) ? 'lead' : r.data_flagged ? 'flag' : ''}>
                  <span>{r.rank}</span>
                  <a href={href.region(r.id)}><span className="lab">{r.c.label}{r.data_flagged ? ' (flagged)' : ''}</span></a>
                  <Ticks value={r.growth_pct} max={120} accent={leads.has(r.id)} />
                  <span className="r">{r.growth_pct != null ? `${r.growth_pct > 0 ? '+' : ''}${r.growth_pct.toFixed(0)}%` : '—'}</span>
                  <span className="r">{r.score?.toFixed(1)}</span>
                </li>
              ))}
            </ol>
            <div className="legend"><span>rank · region · demand growth since 2019 · score</span></div>
          </div>
        </section>

        <section className="scene sweep" ref={set('sweep')}>
          <div className="scene-inner">
            <p className="eyebrow">United States · carbon-free share of generation</p>
            <h2 className="finding">{natT.title}</h2>
            <div className="pair">
              <div><div className="label">Daytime 10:00–15:59</div><div className="val">{pct1(live.daytime)}</div><div className="delta">2019 {pct1(nat['2019']?.daytime)} → 2025 {pct1(nat['2025']?.daytime)}</div></div>
              <div><div className="label">Overnight 00:00–05:59</div><div className="val accent">{pct1(live.overnight)}</div><div className="delta">2019 {pct1(nat['2019']?.overnight)} → 2025 {pct1(nat['2025']?.overnight)}</div></div>
            </div>
            <div className="yearline"><span className="year">{live.year}</span><span className="ruler"><i style={{ width: `${Math.round(p * 100)}%` }} />{YEARS.map(yr => <span key={yr} className={yr === live.year ? 'on' : ''}>{yr}</span>)}</span></div>
            <p className="sub">{natT.sub}</p>
          </div>
        </section>

        <section className="scene detector" ref={set('detector')}>
          <div className="scene-inner">
            <p className="eyebrow">Flat-load detector · method frozen before the ranking was seen</p>
            <h2 className="finding">{detT.title}</h2>
            <p className="sub">{detT.sub}</p>
            <div className="legend">
              <span><i /> score above zero</span>
              <span><i className="dim" /> below zero</span>
              <span><i className="hollow" /> data flagged, kept in ranking</span>
              <span><i className="ink" /> named in advance</span>
            </div>
            <ol className="ranked">
              {scored.filter(r => r.validation || leads.has(r.id)).sort((a, b) => a.rank - b.rank).map(r => (
                <li key={r.id} className={leads.has(r.id) ? 'lead' : ''}>
                  <span>{r.rank}</span>
                  <a href={href.region(r.id)}><span className="lab">{r.known_cluster_label || r.c.label}{r.validation ? '' : ' · new'}</span></a>
                  <Ticks value={r.growth_pct} max={120} accent={leads.has(r.id)} />
                  <span className="r">{r.growth_pct != null ? `${r.growth_pct > 0 ? '+' : ''}${r.growth_pct.toFixed(0)}%` : '—'}</span>
                  <span className="r">{r.score?.toFixed(1)}</span>
                </li>
              ))}
            </ol>
            <div className="cta-row">
              <a className="cta primary" href={href.site()}>Site a load →</a>
              <a className="cta" href={href.verify('META')}>Verify a claim →</a>
              <a className="cta" href={href.method()}>Method</a>
            </div>
            <p className="hero-caption" style={{ marginTop: 22 }}>Consistent with flat 24/7 load served by gas: datacenters, crypto, oilfield electrification. Never "caused by". {pct0(nat['2025']?.overnight)} overnight clean nationally.</p>
          </div>
        </section>
      </main>
      <StatusLine data={data} />
    </>
  )
}
