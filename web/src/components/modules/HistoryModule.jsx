import { fmt, pct } from '../../lib/format.js'

const YEARS = ['2019', '2020', '2021', '2022', '2023', '2024', '2025']   // 2026 is Jan-Aug only, so it stays out
const num = x => (x == null || x === '' || Number.isNaN(Number(x)) ? null : Number(x))
const series = (block, key) => YEARS.map(year => ({ year, v: num(block?.[year]?.[key]) }))
const maxOf = (...rows) => Math.max(...rows.flat().map(x => x.v ?? 0), 0) || 1
const ends = vals => { const have = vals.filter(x => x.v != null); return [have[0]?.v ?? null, have[have.length - 1]?.v ?? null] }

// One row: seven small bars, years under, first and last value on the right.
// The last bar turns accent only when it is lower than the first (the grid got less clean).
function BarRow({ label, values, max, format, accentIfLower }) {
  const [first, last] = ends(values)
  const down = accentIfLower && first != null && last != null && last < first
  return (
    <div className="mod-hist-row">
      <div className="mod-hist-l">{label}</div>
      <div className="mod-hist-mid">
        <div className="mod-hist-bars">{values.map((x, i) => <i key={x.year} className={i === values.length - 1 ? `last${down ? ' down' : ''}` : ''} style={{ height: x.v == null ? 0 : `${Math.max(3, (x.v / max) * 100)}%` }} title={`${x.year}: ${format(x.v)}`} />)}</div>
        <div className="mod-hist-years" aria-hidden="true">{values.map(x => <span key={x.year}>{`’${x.year.slice(2)}`}</span>)}</div>
      </div>
      <div className={`mod-hist-v${down ? ' accent' : ''}`}><span className="from">{format(first)}</span> → {format(last)}</div>
    </div>
  )
}

// Carbon-free share at night and by day, 2019 to 2025, plus this region's own night demand.
// cf_share is the grid's (a zone inherits its parent's); demand is the region's own.
export default function HistoryView({ cf_share, demand, grid, inherited }) {
  const night = series(cf_share, 'overnight'), day = series(cf_share, 'daytime')
  const dem = demand ? series(demand, 'overnight_avg_mw') : null
  const shareMax = maxOf(night, day)
  if (!night.some(x => x.v != null) && !day.some(x => x.v != null)) return <p className="mod-empty">No yearly clean-share series for this grid.</p>
  return (
    <div className="mod-hist">
      <BarRow label="Clean at night" values={night} max={shareMax} format={v => pct(v, 1)} accentIfLower />
      <BarRow label="Clean by day" values={day} max={shareMax} format={v => pct(v, 1)} accentIfLower />
      {dem && dem.some(x => x.v != null) && <BarRow label="Night demand, MW" values={dem} max={maxOf(dem)} format={v => fmt(v)} />}
      <p className="mod-foot">Night is 00:00–05:59 local, day 10:00–15:59; 2026 is partial and left out.{inherited && grid ? ` Shares are the whole ${grid} grid's; demand is this region's own.` : ''}</p>
    </div>
  )
}
