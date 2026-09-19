import { Fragment, useMemo } from 'react'
import Shell from '../console/Console.jsx'
import { Card, Num, Ticks } from '../console/widgets.jsx'
import { CopyButton } from '../components/CopyButton.jsx'
import coords from '../data/region_coords.json'
import { loadAlerts, useAsync } from '../lib/data.js'
import { readTokens } from '../lib/tokens.js'
import { n0, pct1 } from '../lib/findings.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { href } from '../router.js'
import '../styles/pages.css'

const SHORT = { demand_up_20pct: 'night demand up 20%+ vs 2019', demand_record_high: 'night demand at a record', cf_share_down_3pts: 'clean at night down 3+ pts', gas_share_up_3pts_yoy: 'gas at night up 3+ pts in a year', clean_mw_below_2019: 'clean power at night below 2019', detector_top10: 'new flat load, detector top 10' }
const month = m => (m ? new Date(m + '-01T00:00:00').toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—')

// What changed this month: the engine's ranked alerts, one per region, severity = magnitude × persistence × recency.
export default function Alerts() {
  const { loading, error, data, reload } = useAsync(loadAlerts, [])
  const tk = useMemo(readTokens, [])
  const rows = useMemo(() => (data?.alerts || []).map(a => ({ ...a, c: coords.regions[a.region], label: coords.regions[a.region]?.label || a.name || a.region })).sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0)), [data])
  const maxSev = Math.max(...rows.map(r => r.severity ?? 0), 0.0001)
  const globe = useMemo(() => ({ view: { lat: 38.5, lng: -97, altitude: 1.5 }, interactive: true, points: rows.filter(r => r.c).map(r => ({ id: r.region, lat: r.c.lat, lng: r.c.lng, r: 0.14 + 0.2 * ((r.severity ?? 0) / maxSev), color: tk.accent })), markers: rows.filter(r => r.c).slice(0, 8).map((r, i) => ({ id: r.region, lat: r.c.lat, lng: r.c.lng, label: `${i + 1}  ${r.label}`, tip: SHORT[r.rule] || r.rule, href: href.region(r.region), color: i === 0 ? tk.accent : tk.ink2, lead: i === 0 })) }), [rows, maxSev, tk])
  const back = () => { window.location.hash = href.landing() }
  const byRule = rows.reduce((m, r) => ({ ...m, [r.rule]: (m[r.rule] || 0) + 1 }), {})
  const top = Object.entries(byRule).sort((a, b) => b[1] - a[1])[0]
  const primary = rows.filter(r => r.tier === 'primary')
  const sentence = rows.length ? `${primary.length || rows.length} places are the story this month${primary.length && rows.length > primary.length ? ` (${rows.length - primary.length} more supporting or chronic)` : ''}, through ${month(data?.latest_month)}. The most common signal is ${SHORT[top[0]] || top[0]} (${top[1]}); ${rows[0].label} ranks first.` : 'No active alerts.'
  let column
  if (loading) column = <Card title={<b>What changed</b>} onClose={back}><Loading what="alerts" /></Card>
  else if (error) column = <Card title={<b>What changed</b>} onClose={back}><ErrorState error={error} onRetry={reload} /></Card>
  else column = (
    <>
      <Card title={<><b>What changed this month</b> · trailing 12 months to {month(data.latest_month)}</>} right={<CopyButton text={() => window.location.href} label="Copy link" />} onClose={back}>
        <h1 className="verdict">{sentence}</h1>
        <div className="nums"><Num value={String(rows.length)} label="alerts, one per place" sub={data.count_before_ranking && data.count_before_ranking !== rows.length ? `from ${data.count_before_ranking} raw` : null} /><Num value={String(rows.filter(r => r.rule === 'detector_top10').length)} label="new flat load" accent /><Num value={String(rows.filter(r => /cf_share_down|clean_mw_below|gas_share/.test(r.rule)).length)} label="nights getting dirtier" /></div>
        <p className="note" style={{ marginTop: 12 }}>Severity = how far past the threshold × how many months it has held × how recent. The dashed line marks the drop from the primary tier to supporting and chronic alerts. {data.excluded_regions?.length ? `Excluded: ${data.excluded_regions.join(', ')} (data flag).` : ''}</p>
      </Card>
      <Card>
        <div className="rows al-rows">
          {rows.map((r, i) => (
            <Fragment key={r.region + r.rule}>
              {i > 0 && rows[i - 1].tier === 'primary' && r.tier !== 'primary' && <div className="al-tier">supporting and chronic</div>}
            <a className={`row${r.tier && r.tier !== 'primary' ? ' supporting' : ''}`} href={href.region(r.region)}>
              <span className="rk">{i + 1}</span>
              <div><div className="t">{r.label} <span className="muted">· {SHORT[r.rule] || r.rule}</span>{r.tier && r.tier !== 'primary' && <span className="chip sm al-chip">{r.tier}</span>}</div><div className="d">{r.first_crossed ? `since ${month(r.first_crossed)}` : 'this year'}{r.months_active_streak ? ` · ${r.months_active_streak} months` : ''}{r.unit === 'MW' && r.current_value != null ? ` · ${n0(r.current_value)} MW vs ${n0(r.baseline_2019)} in 2019` : r.unit === 'share' && r.current_value != null ? ` · ${pct1(r.current_value)} vs ${pct1(r.baseline_2019)} in 2019` : r.score != null ? ` · score ${r.score.toFixed(1)}` : ''}</div></div>
              <Ticks value={(r.severity ?? 0) / maxSev * 100} max={100} n={12} accent={i === 0} />
              <span className="n">{r.severity != null ? r.severity.toFixed(2) : '—'}</span>
            </a>
            </Fragment>
          ))}
        </div>
      </Card>
    </>
  )
  return <Shell page="alerts" globe={globe} column={column} columnWidth={520} />
}
