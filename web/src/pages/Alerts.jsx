import { Fragment, useMemo } from 'react'
import Shell from '../console/Console.jsx'
import { Card, Num, Ticks } from '../console/widgets.jsx'
import { CopyButton } from '../components/CopyButton.jsx'
import coords from '../data/region_coords.json'
import { loadAlerts, useAsync } from '../lib/data.js'
import { readTokens } from '../lib/tokens.js'
import { n0, pct1 } from '../lib/findings.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { href, useHash } from '../router.js'
import '../styles/pages.css'
import Breadcrumbs, { useCrumbs } from '../components/Breadcrumbs.jsx'

const SHORT = { demand_up_20pct: 'pulling 20%+ more power at night than in 2019', demand_record_high: 'its busiest nights on record', cf_share_down_3pts: 'clean covers less of the night than in 2019', gas_share_up_3pts_yoy: 'gas took a bigger slice of the night this year', clean_mw_below_2019: 'fewer megawatts of clean power at night than in 2019', detector_top10: 'demand shape consistent with new 24/7 load' }
const month = m => (m ? new Date(m + '-01T00:00:00').toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—')

// What changed this month: the engine's ranked alerts, one per region, severity = magnitude × persistence × recency.
export default function Alerts() {
  const { loading, error, data, reload } = useAsync(loadAlerts, [])
  const tk = useMemo(readTokens, [])
  const rows = useMemo(() => (data?.alerts || []).map(a => ({ ...a, c: coords.regions[a.region], label: coords.regions[a.region]?.label || a.name || a.region })).sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0)), [data])
  const maxSev = Math.max(...rows.map(r => r.severity ?? 0), 0.0001)
  const globe = useMemo(() => ({ view: { lat: 38.5, lng: -97, altitude: 1.5 }, interactive: true, points: rows.filter(r => r.c).map(r => ({ id: r.region, lat: r.c.lat, lng: r.c.lng, r: 0.14 + 0.2 * ((r.severity ?? 0) / maxSev), color: tk.accent })), markers: rows.filter(r => r.c).slice(0, 8).map((r, i) => ({ id: r.region, lat: r.c.lat, lng: r.c.lng, label: `${i + 1}  ${r.label}`, tip: SHORT[r.rule] || r.rule, href: href.region(r.region), color: i === 0 ? tk.accent : tk.ink2, lead: i === 0 })) }), [rows, maxSev, tk])
  const crumbs = useCrumbs(useHash())
  const back = () => { window.location.hash = href.landing() }
  const byRule = rows.reduce((m, r) => ({ ...m, [r.rule]: (m[r.rule] || 0) + 1 }), {})
  const top = Object.entries(byRule).sort((a, b) => b[1] - a[1])[0]
  const primary = rows.filter(r => r.tier === 'primary')
  const sentence = rows.length ? `${primary.length || rows.length} places got busier or dirtier at night this month${primary.length && rows.length > primary.length ? ` (${rows.length - primary.length} more drifting the same way)` : ''} — the hours the grid never cleaned up. Through ${month(data?.latest_month)}: ${rows[0].label} leads, and ${top[1]} of ${rows.length} are here for the same reason, ${SHORT[top[0]] || top[0]}.` : 'No active alerts.'
  let column
  const crumb = <Breadcrumbs trail={crumbs} onBack={back} />
  if (loading) column = <>{crumb}<Card title={<b>What changed</b>} onClose={back}><Loading what="alerts" /></Card></>
  else if (error) column = <>{crumb}<Card title={<b>What changed</b>} onClose={back}><ErrorState error={error} onRetry={reload} /></Card></>
  else column = (
    <>
      {crumb}
      <Card title={<><b>What changed this month</b> · trailing 12 months to {month(data.latest_month)}</>} right={<CopyButton text={() => window.location.href} label="Copy link" />} onClose={back}>
        <h1 className="verdict">{sentence}</h1>
        <div className="nums"><Num value={String(rows.length)} label="places changing at night" sub={data.count_before_ranking && data.count_before_ranking !== rows.length ? `from ${data.count_before_ranking} raw` : null} /><Num value={String(rows.filter(r => r.rule === 'detector_top10').length)} label="look like new 24/7 load" accent /><Num value={String(rows.filter(r => /cf_share_down|clean_mw_below|gas_share/.test(r.rule)).length)} label="nights getting dirtier" /></div>
        <p className="note" style={{ marginTop: 12 }}>Severity is how far past the threshold, times how many months it has held, times how recent — so a slow drift that has run for years never outranks a change that is big and still moving. Above the divider is where to look first; below it the signal is real but smaller or older. {data.excluded_regions?.length ? `${data.excluded_regions.join(', ')} sit outside these alerts: their reported numbers move in a way the data does not explain.` : ''}</p>
      </Card>
      <Card>
        <div className="rows al-rows">
          {rows.map((r, i) => (
            <Fragment key={r.region + r.rule}>
              {i > 0 && rows[i - 1].tier === 'primary' && r.tier !== 'primary' && <div className="al-tier">supporting and chronic</div>}
            <a className={`row${r.tier && r.tier !== 'primary' ? ' supporting' : ''}`} href={href.region(r.region)}>
              <span className="rk">{i + 1}</span>
              <div><div className="t">{r.label} <span className="muted">· {SHORT[r.rule] || r.rule}</span>{r.tier && r.tier !== 'primary' && <span className="chip sm al-chip">{r.tier}</span>}</div><div className="d">{r.first_crossed ? `over the line since ${month(r.first_crossed)}` : 'flagged by demand shape, not a monthly threshold'}{r.months_active_streak ? ` · ${r.months_active_streak} months without a break` : ''}{r.unit === 'MW' && r.current_value != null ? (r.rule === 'clean_mw_below_2019' ? ` · ${n0(r.current_value)} MW of clean power overnight, was ${n0(r.baseline_2019)} MW in 2019` : ` · drawing ${n0(r.current_value)} MW through the night, was ${n0(r.baseline_2019)} MW in 2019`) : r.unit === 'share' && r.current_value != null ? ` · clean covers ${pct1(r.current_value)} of the night, was ${pct1(r.baseline_2019)} in 2019 — a share, not output` : r.unit === 'rank' && r.current_value != null ? ` · #${n0(r.current_value)} of every region scored${r.growth_pct != null ? `, demand up ${r.growth_pct}% since 2019` : ''}` : r.score != null ? ` · score ${r.score.toFixed(1)}` : ''}</div></div>
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
