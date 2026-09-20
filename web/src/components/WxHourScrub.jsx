import { useEffect, useMemo, useState } from 'react'
import { WxSeg, nn, isNum, DASH } from './WxControls.jsx'
import '../styles/wx.css'

// The 24-hour profile you can walk through. A flat load buys every one of these hours, so the
// question the page has to answer is not "what is the average" but "what am I buying at 3am".
// Scrub with the slider or the arrow keys, click a bar, and the readout under the chart is
// recomputed for that hour: the 2025 clean share, the 2019 share for the same hour, the change
// between them, and how much of the load runs on generation that is not carbon-free.
//
// `profile` is { '2019': [24 shares 0..1], '2025': [...] } straight off the region detail. A
// missing hour draws no bar and reads as an em dash; it is never drawn as zero.

const H = 24
const clamp01 = v => Math.min(1, Math.max(0, Number(v) || 0))
const cleanMix = v => `color-mix(in oklab, var(--dv-clean) ${Math.round(clamp01(v) * 100)}%, var(--dv-fossil))`
const hh = h => `${String(h).padStart(2, '0')}:00`
const pct1 = v => (isNum(v) ? `${(v * 100).toFixed(1)}%` : DASH)
const pts = v => (isNum(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(1)} pts` : DASH)
const mw0 = v => (isNum(v) ? Math.round(v).toLocaleString('en-US') : DASH)
const arr24 = src => (Array.isArray(src) ? Array.from({ length: H }, (_, h) => (isNum(src[h]) ? src[h] : null)) : null)

export default function WxHourScrub({ profile, loadMW = 300, baselineYear = 2019, latestYear = 2025, corrected2019 = false }) {
  const now = useMemo(() => arr24(profile?.[String(latestYear)] || (Array.isArray(profile) ? profile : null)), [profile, latestYear])
  const was = useMemo(() => arr24(profile?.[String(baselineYear)]), [profile, baselineYear])
  const [hour, setHour] = useState(3)
  const [mode, setMode] = useState('share')
  const [overlay, setOverlay] = useState(true)
  const hasWas = !!was && was.some(isNum)
  useEffect(() => { if (!hasWas) setOverlay(false) }, [hasWas])

  const stats = useMemo(() => {
    if (!now) return null
    const seen = now.map((v, h) => ({ v, h })).filter(x => isNum(x.v))
    if (!seen.length) return null
    const best = seen.reduce((a, b) => (b.v > a.v ? b : a))
    const worst = seen.reduce((a, b) => (b.v < a.v ? b : a))
    const peak = Math.max(...seen.map(x => x.v), ...(was || []).filter(isNum))
    return { best, worst, top: Math.min(1, Math.max(0.25, Math.ceil(peak * 4 - 1e-9) / 4)) }
  }, [now, was])

  if (!now || !stats) return <p className="note">Hour-by-hour profiles are available for grids that report generation. This one reports demand.</p>

  const v = now[hour], w = hasWas ? was[hour] : null
  const change = isNum(v) && isNum(w) ? v - w : null
  const fossilMW = isNum(v) ? loadMW * (1 - v) : null
  const cleanMW = isNum(v) ? loadMW * v : null
  const height = x => (isNum(x) ? `${Math.max(3, (clamp01(x) / stats.top) * 100)}%` : '0%')

  return (
    <div className="wx-hours">
      <div className="wx-bar">
        <WxSeg label="read the hour as" value={mode} onChange={setMode} options={[['share', 'clean share'], ['mw', `MW of ${mw0(loadMW)}`]]} />
        {hasWas && <WxSeg label={`${baselineYear} overlay`} value={overlay ? 'on' : 'off'} onChange={x => setOverlay(x === 'on')} options={[['on', 'show'], ['off', 'hide']]} />}
        <div className="wx-group wx-range">
          <span className="wx-k">hour, local<b>{hh(hour)}</b></span>
          <input type="range" min={0} max={23} step={1} value={hour} onChange={e => setHour(Number(e.target.value))} aria-label="Hour of day" style={{ '--wx-fill': `${(hour / 23) * 100}%` }} />
          <span className="wx-ends"><span>00:00</span><span>23:00</span></span>
        </div>
      </div>

      <div className="wx-hplot" role="group" aria-label={`Clean share by hour, ${latestYear}`}>
        {now.map((x, h) => (
          <button
            key={h}
            type="button"
            data-wx-item
            className={`wx-hbar ${h === hour ? 'on' : ''}`}
            onClick={() => setHour(h)}
            aria-label={`${hh(h)} ${isNum(x) ? `${(x * 100).toFixed(1)} percent clean` : 'no data'}`}
            title={`${hh(h)} · ${pct1(x)} clean${hasWas && isNum(was[h]) ? ` · ${baselineYear} ${pct1(was[h])}` : ''}${h <= 5 ? ' · overnight' : ''}`}
          >
            <i style={{ height: height(x), background: isNum(x) ? cleanMix(x) : 'var(--dv-n2)' }} />
            {overlay && isNum(was[h]) && <span className="cmp" style={{ bottom: height(was[h]) }} />}
          </button>
        ))}
        <span className="wx-hnight" style={{ width: '25%' }} />
      </div>
      <div className="wx-haxis"><span>midnight</span><span>noon</span><span>23:00</span></div>

      <div className="wx-hread" aria-live="polite">
        <div className="hh">{hh(hour)} local{hour <= 5 ? ' · inside the overnight window' : hour >= 10 && hour <= 15 ? ' · inside the daytime window' : ''}</div>
        {mode === 'share' ? (
          <p className="line">
            In {latestYear} this grid generated <b className={isNum(v) && v >= 0.5 ? 'clean' : 'fossil'}>{pct1(v)}</b> carbon-free power in this hour
            {overlay && hasWas ? <> against <b>{pct1(w)}</b> in {baselineYear}{corrected2019 ? ' (corrected)' : ''}, a change of <b>{pts(change)}</b></> : null}.
            {' '}Cleanest hour: <b>{hh(stats.best.h)}</b> at {pct1(stats.best.v)}; dirtiest: <b>{hh(stats.worst.h)}</b> at {pct1(stats.worst.v)}.
          </p>
        ) : (
          <p className="line">
            A <b>{mw0(loadMW)} MW</b> flat load draws <b className="fossil">{nn(fossilMW, mw0)} MW</b> from generation that is not carbon-free in this hour, and <b className="clean">{nn(cleanMW, mw0)} MW</b> from generation that is
            {isNum(v) ? <> {DASH} the grid&rsquo;s {latestYear} mix here is {pct1(v)} clean</> : null}.
            {' '}At its cleanest hour ({hh(stats.best.h)}) the same load would draw {mw0(loadMW * (1 - stats.best.v))} MW from fossil or unclassified generation.
          </p>
        )}
        <p className="note" style={{ marginTop: 8 }}>
          Share of generation inside this grid&rsquo;s footprint, averaged over the year at this hour {DASH} not the one plant that would ramp to serve a new load, and not consumption.
        </p>
      </div>
    </div>
  )
}
