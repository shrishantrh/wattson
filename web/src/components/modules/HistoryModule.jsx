import { fmt, pct } from '../../lib/format.js'
import Sparkline from '../Sparkline.jsx'
import { Mod, Lead, Empty } from './Shell.jsx'

const YEARS = ['2019', '2020', '2021', '2022', '2023', '2024', '2025']   // 2026 is Jan-Aug only, so it stays out
const num = x => (x == null || x === '' || Number.isNaN(Number(x)) ? null : Number(x))
const series = (block, key) => YEARS.map(year => ({ year, v: num(block?.[year]?.[key]) }))
const ends = vals => { const have = vals.filter(x => x.v != null); return [have[0]?.v ?? null, have[have.length - 1]?.v ?? null] }
const down = vals => { const [a, b] = ends(vals); return a != null && b != null && b < a }

// One row: a sparkline of the seven years and the two end values. The line turns ember only when
// the series ended lower than it started (the grid got less clean).
function Row({ label, sub, values, format, accentIfLower }) {
  const [first, last] = ends(values)
  const fell = accentIfLower && down(values)
  return (
    <div className="mod-hist-row">
      <div className="mod-cell"><div className="mod-hist-l">{label}</div>{sub && <div className="mod-hist-sub">{sub}</div>}</div>
      <Sparkline
        className="mod-hist-spark"
        values={values.map(x => x.v)} width={104} height={26} strokeWidth={1.25} accentLast area delta={!!accentIfLower}
        title={values.filter(x => x.v != null).map(x => `${x.year} ${format(x.v)}`).join(', ')}
      />
      <div className={`mod-hist-v${fell ? ' down' : ''}`}><span className="from">{format(first)}</span><span className="arrow"> → </span>{format(last)}</div>
    </div>
  )
}

// Carbon-free share at night and by day, 2019 to 2025, plus this region's own night demand.
// The card leads with the direction the night series went. cf_share is the grid's (a zone inherits
// its parent's); demand is the region's own.
export default function HistoryView({ cf_share, demand, grid, inherited }) {
  const night = series(cf_share, 'overnight'), day = series(cf_share, 'daytime')
  const dem = demand ? series(demand, 'overnight_avg_mw') : null
  if (!night.some(x => x.v != null) && !day.some(x => x.v != null)) return <Empty>No yearly clean-share series for this grid.</Empty>
  const [n19, n25] = ends(night)
  const [d19, d25] = ends(day)
  const fell = down(night)
  const dayWords = d19 == null || d25 == null ? '' : `, while the day went ${pct(d19, 1)} to ${pct(d25, 1)}`
  const direction = n19 == null || n25 == null ? 'clean at night, 2019 to 2025' : fell ? `less clean at night than in 2019${dayWords}` : n25 > n19 ? `cleaner at night than in 2019${dayWords}` : `no cleaner at night than in 2019${dayWords}`
  return (
    <Mod
      className="mod-history"
      caption="Night and day read separately, an annual average hides the gap between them."
      lead={<Lead value={<><span className="from">{pct(n19, 1)}</span><span className="arrow"> → </span>{pct(n25, 1)}</>} t={fell ? 'fossil' : 'clean'} label={direction} />}
      foot={`EIA-930 via PUDL. Night 00:00–05:59 local, day 10:00–15:59; 2026 left out.${inherited && grid ? ` Shares are the ${grid} grid's.` : ''}`}
    >
      <div className="mod-hist">
        <Row label="Clean at night" sub="00:00–05:59 local" values={night} format={v => pct(v, 1)} accentIfLower />
        <Row label="Clean by day" sub="10:00–15:59 local" values={day} format={v => pct(v, 1)} accentIfLower />
        {dem && dem.some(x => x.v != null) && <Row label="Night demand" sub="average MW, this region" values={dem} format={v => fmt(v)} />}
      </div>
    </Mod>
  )
}
