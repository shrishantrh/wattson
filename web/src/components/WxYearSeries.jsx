import { useMemo, useState } from 'react'
import { WxSeg, isNum, DASH } from './WxControls.jsx'
import '../styles/wx.css'

// Share against absolute output, on one switch.
//
// A falling clean SHARE is not clean generation shrinking, and the two are routinely confused:
// nationally the overnight clean share went 40.5% to 39.7% while overnight clean output rose
// 159.0 GW to 173.4 GW. Wherever this app shows a share trend the megawatts have to be one
// click away, and the sentence under the bars is generated from whichever pair the switch is
// on, so it can never contradict what is drawn.
//
// share / clean / total are { '2019': { overnight, daytime, all }, ... } straight off a region
// detail (cf_share, cf_avg_mw, total_avg_mw). `corrections` is the engine's overlay; where it
// has a corrected figure for a year that figure is drawn and the year is marked.

const YEARS = ['2019', '2020', '2021', '2022', '2023', '2024', '2025']
const pct1 = v => (isNum(v) ? `${(v * 100).toFixed(1)}%` : DASH)
const mw0 = v => (isNum(v) ? Math.round(v).toLocaleString('en-US') : DASH)
const num = v => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v))

// The engine publishes corrections as { path: 'cf_share.2019', corrected: { overnight, ... } }.
const correctedAt = (corrections, path, window) => {
  const c = (corrections || []).find(x => x && x.path === path)
  if (!c) return null
  const v = c.corrected
  return num(v && typeof v === 'object' ? v[window] : v)
}

const relWord = (a, b, unit) => {
  if (!isNum(a) || !isNum(b) || a === 0) return null
  const d = b - a, r = d / a
  if (Math.abs(r) < 0.01) return `barely moved (${mw0(a)} to ${mw0(b)} ${unit})`
  return `${d > 0 ? 'rose' : 'fell'} ${mw0(Math.abs(d))} ${unit} (${mw0(a)} to ${mw0(b)}, ${d > 0 ? '+' : '−'}${Math.abs(r * 100).toFixed(1)}%)`
}
const ptsWord = (a, b) => {
  if (!isNum(a) || !isNum(b)) return null
  const d = (b - a) * 100
  if (Math.abs(d) < 0.5) return `held at about ${pct1(b)} (${pct1(a)} in 2019)`
  return `${d > 0 ? 'rose' : 'fell'} ${Math.abs(d).toFixed(1)} pts, ${pct1(a)} to ${pct1(b)}`
}

export default function WxYearSeries({ share, clean, total, corrections, label = 'this grid', defaultWindow = 'overnight' }) {
  const [mode, setMode] = useState('share')
  const [win, setWin] = useState(defaultWindow)

  const rows = useMemo(() => YEARS.map(y => {
    const sRaw = num(share?.[y]?.[win]), cRaw = num(clean?.[y]?.[win]), tRaw = num(total?.[y]?.[win])
    const sFix = correctedAt(corrections, `cf_share.${y}`, win), cFix = correctedAt(corrections, `cf_avg_mw.${y}`, win)
    return { year: y, share: sFix ?? sRaw, clean: cFix ?? cRaw, total: tRaw, corrected: sFix != null || cFix != null }
  }), [share, clean, total, corrections, win])

  const key = mode === 'share' ? 'share' : 'clean'
  const values = rows.map(r => r[key]).filter(isNum)
  const first = rows.find(r => isNum(r[key])), last = [...rows].reverse().find(r => isNum(r[key]))
  const anyCorrected = rows.some(r => r.corrected)

  if (!values.length) return <p className="note">No yearly series for {label} in this data source, so there is nothing to switch between.</p>
  const top = Math.max(...values)

  const a = rows[0], b = rows[rows.length - 1]
  const shareLine = ptsWord(a?.share, b?.share)
  const cleanLine = relWord(a?.clean, b?.clean, 'MW')
  const totalLine = relWord(a?.total, b?.total, 'MW')
  // The reading is the point of the control, so it has to agree with the clause before it:
  // a half-point move in the share and a one-percent move in the megawatts both count as flat,
  // the same thresholds ptsWord and relWord use. Saying "clean output barely moved" and then
  // "both fell" in the same paragraph is the exact confusion this component exists to stop.
  const dShare = isNum(a?.share) && isNum(b?.share) ? b.share - a.share : null
  const dClean = isNum(a?.clean) && isNum(b?.clean) ? b.clean - a.clean : null
  const shareState = dShare == null ? null : Math.abs(dShare) < 0.005 ? 'flat' : dShare > 0 ? 'up' : 'down'
  const cleanRel = dClean != null && isNum(a?.clean) && a.clean !== 0 ? dClean / a.clean : null
  const cleanState = cleanRel == null ? null : Math.abs(cleanRel) < 0.01 ? 'flat' : cleanRel > 0 ? 'up' : 'down'
  const READINGS = {
    'down|up': 'A smaller slice of a bigger set of hours, not less clean power: the clean megawatts grew, and everything else grew faster.',
    'down|flat': 'No clean power was lost here. The share fell because everything else generated in these hours grew around it.',
    'down|down': 'Both fell: less clean generation in these hours, and it covered less of them.',
    'flat|up': 'More clean power, and the rest grew at the same pace, so the slice is where it started.',
    'flat|flat': 'Neither moved: these hours look much as they did in 2019.',
    'flat|down': 'The slice held while the clean megawatts fell, because total generation in these hours fell with them.',
    'up|up': 'Both rose: more clean power in these hours, and it covered more of them.',
    'up|flat': 'The slice grew without any more clean power: total generation in these hours fell.',
    'up|down': 'The slice grew while clean generation fell, because total generation in these hours fell faster still.',
  }
  const reading = shareState && cleanState ? READINGS[`${shareState}|${cleanState}`] : null
  const windowWords = win === 'overnight' ? 'midnight to 6am' : win === 'daytime' ? '10am to 4pm' : 'every hour'

  return (
    <div>
      <div className="wx-bar">
        <WxSeg label="measure" value={mode} onChange={setMode} options={[['share', 'clean share', 'Clean generation as a share of all generation'], ['mw', 'clean MW', 'Average megawatts of carbon-free generation']]} />
        <WxSeg label="hours" value={win} onChange={setWin} options={[['overnight', 'night'], ['daytime', 'day'], ['all', 'all 24']]} />
      </div>

      <div className="wx-years" role="img" aria-label={`${mode === 'share' ? 'Clean share' : 'Clean megawatts'} over ${windowWords}, 2019 to 2025`}>
        {rows.map(r => {
          const v = r[key]
          return (
            <div key={r.year} className={`wx-ycol ${isNum(v) && (r === first || r === last) ? '' : 'dim'}`} title={`${r.year} · ${pct1(r.share)} clean · ${mw0(r.clean)} MW clean of ${mw0(r.total)} MW`}>
              <span className="yv">{isNum(v) ? (mode === 'share' ? `${Math.round(v * 100)}%` : mw0(v)) : DASH}</span>
              <i style={{ height: isNum(v) && top > 0 ? `${Math.max(2, (v / top) * 100)}%` : 0, background: isNum(v) ? (mode === 'share' ? 'var(--clean)' : 'var(--ink-2)') : 'transparent' }} />
            </div>
          )
        })}
      </div>
      <div className="wx-ylabels">{rows.map(r => <span key={r.year} className={r.corrected ? 'corr' : ''}>{r.year.slice(2)}</span>)}</div>

      <p className="note" style={{ marginTop: 12, color: 'var(--ink-2)' }}>
        Over {windowWords}, {label}&rsquo;s clean share {shareLine || DASH}. Its clean output {cleanLine || DASH}
        {totalLine ? <>, while total generation in those hours {totalLine}</> : null}. {reading}
      </p>
      {anyCorrected && <p className="note" style={{ marginTop: 8 }}>Years marked in amber use the engine&rsquo;s corrected figure, not the published one.</p>}
    </div>
  )
}
