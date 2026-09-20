import { useMemo } from 'react'
import { loadAlerts, useAsync } from '../../lib/data.js'
import { fmt, pct } from '../../lib/format.js'
import { Ticks } from '../../console/widgets.jsx'
import { Mod, Lead, Empty } from './Shell.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const asList = a => (Array.isArray(a) ? a : Array.isArray(a?.alerts) ? a.alerts : [])
const month = m => { if (typeof m !== 'string') return null; const [y, mo] = m.split('-'); return MONTHS[Number(mo) - 1] ? `${MONTHS[Number(mo) - 1]} ${y}` : m }
const value = (v, unit) => (v == null || Number.isNaN(Number(v)) ? '—' : unit === 'share' ? pct(v, 1) : unit === 'MW' ? `${fmt(v)} MW` : unit === 'rank' ? `#${fmt(v)}` : fmt(v, 1))
const detail = (a, parentLevel, ba) => {
  const parts = []
  if (a.first_crossed) parts.push(`since ${month(a.first_crossed)}${a.months_active_streak ? `, ${fmt(a.months_active_streak)} ${Number(a.months_active_streak) === 1 ? 'month' : 'months'}` : ''}`)
  else if (a.rule === 'detector_top10') parts.push([a.score != null && `score ${fmt(a.score, 2)}`, a.growth_pct != null && `demand ${a.growth_pct > 0 ? '+' : ''}${fmt(a.growth_pct, 1)}%`].filter(Boolean).join(', '))
  if (parentLevel) parts.push(`whole ${ba} grid`)
  return parts.filter(Boolean).join(' · ')
}
const sev = a => (a.severity == null || Number.isNaN(Number(a.severity)) ? null : Number(a.severity))

// Active alerts for one region, plus its parent grid's when the region is a zone. The card leads
// with the count; every row carries its severity as a bar and its exact value on the right.
// `alerts` is the payload the caller already loaded ({ alerts: [...] } or an array); when absent we
// use the alerts embedded in the region detail, and failing that load them here.
export default function AlertsView({ region_id, alerts, detail: region }) {
  const given = alerts ?? (Array.isArray(region?.alerts) ? region.alerts : null)
  const needLoad = given == null
  const { loading, error, data } = useAsync(() => (needLoad ? loadAlerts() : null), [needLoad])
  const ba = typeof region_id === 'string' && region_id.includes('/') ? region_id.split('/')[0] : null
  const mine = useMemo(() => {
    const all = asList(needLoad ? data : given).filter(a => a && a.active !== false)
    const own = all.filter(a => a.region === region_id), parent = ba ? all.filter(a => a.region === ba) : []
    return [...own.map(a => ({ a, parentLevel: false })), ...parent.map(a => ({ a, parentLevel: true }))]
  }, [needLoad, data, given, region_id, ba])
  if (needLoad && loading) return <Empty>Loading alerts…</Empty>
  if (needLoad && error) return <Empty>No alerts available.</Empty>
  if (!mine.length) return <Empty>No active alerts here.{region?.exclude_from_alerts ? ' This region is excluded from alerts because its data is flagged.' : ''}</Empty>
  const latest = mine.map(({ a }) => a.latest_month).filter(Boolean).sort().pop()
  const atParent = mine.filter(x => x.parentLevel).length
  const label = `active alert${mine.length === 1 ? '' : 's'} here${atParent ? `, ${fmt(atParent)} for the whole ${ba} grid` : ''}`
  return (
    <Mod
      className="mod-alerts"
      caption="A rule crosses when a trailing-12-month figure passes 2019 and stays past."
      lead={<Lead value={fmt(mine.length)} label={label} t={mine.length ? 'warn' : undefined} />}
      foot={`EIA-930 via PUDL. Trailing 12 months${latest ? ` to ${month(latest)}` : ''}, against 2019.`}
    >
      <div className="mod-rows">
        {mine.map(({ a, parentLevel }, i) => {
          const s = sev(a)
          return (
            <div key={`${a.region}-${a.rule}-${i}`} className="mod-alert">
              <div className="mod-cell">
                <div className="mod-t">{a.description || a.rule}</div>
                <div className="mod-d">{s != null && a.tier ? `${a.tier} · ` : ''}{detail(a, parentLevel, ba)}</div>
              </div>
              <span className="mod-tk" title={s != null ? `severity ${s.toFixed(2)} of 1` : 'no severity'}><Ticks value={s ?? 0} max={1} n={10} accent label={s != null ? `severity ${s.toFixed(2)} of 1` : 'no severity given'} /></span>
              <span className="mod-n">{value(a.current_value, a.unit)}{a.baseline_2019 != null && <small> vs {value(a.baseline_2019, a.unit)} in 2019</small>}</span>
            </div>
          )
        })}
      </div>
    </Mod>
  )
}
