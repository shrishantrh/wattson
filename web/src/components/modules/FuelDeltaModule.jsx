import { signedGw } from '../../lib/findings.js'
import { Mod, Lead, Empty } from './Shell.jsx'

// Fossil first, then carbon-free, then the neutral remainder. Fossil is the ember, carbon-free the
// cool colour, other and unknown neutral grey; the opacity steps keep gas the loudest fossil bar.
const ORDER = ['gas', 'coal', 'oil', 'nuclear', 'hydro', 'wind', 'solar', 'geothermal', 'other']
const FOSSIL = { gas: 0.92, coal: 0.66, oil: 0.5 }
const CLEAN = new Set(['nuclear', 'hydro', 'wind', 'solar', 'geothermal'])
const num = x => (x == null || x === '' || Number.isNaN(Number(x)) ? null : Number(x))
const fmtGw = gw => signedGw(Math.round(gw * 10) / 10)   // round first so a hair above zero reads "0.0 GW", not "+0.0 GW"
const kindOf = fuel => (fuel in FOSSIL ? 'fossil' : CLEAN.has(fuel) ? 'clean' : 'other')

// Change in average overnight generation by fuel, 2019 to 2025, in GW. The card leads with the one
// fuel that moved most ("gas +10.7 GW"), then the two sums, then every fuel as a signed bar on one
// shared scale: the zero line sits where the most negative bar ends, so lengths are proportional.
export default function FuelDeltaView({ delta, grid, inherited }) {
  const rows = ORDER.map(fuel => ({ fuel, v: num(delta?.[fuel]) })).filter(r => r.v != null)
  if (!rows.length) return <Empty>No fuel breakdown for this grid.</Empty>
  const neg = Math.min(0, ...rows.map(r => r.v)), pos = Math.max(0, ...rows.map(r => r.v))
  const span = pos - neg || 1
  const zero = (-neg / span) * 100
  const sum = pick => rows.filter(r => pick(r.fuel)).reduce((a, r) => a + r.v, 0)
  const fossil = sum(f => f in FOSSIL), clean = sum(f => CLEAN.has(f))
  const biggest = rows.reduce((a, r) => (Math.abs(r.v) > Math.abs(a.v) ? r : a))
  return (
    <Mod
      className="mod-fuel"
      caption="The hours after midnight, 2019 against 2025: which fuels grew to meet them, and which shrank."
      lead={<Lead value={`${biggest.fuel} ${fmtGw(biggest.v)}`} t={kindOf(biggest.fuel)} label={`the fuel that moved most after midnight${biggest.v >= 0 ? ', more of it now' : ', less of it now'} — carbon-free as a whole moved ${fmtGw(clean)}`} />}
      foot={<>EIA-930 hourly via PUDL, overnight 00:00–05:59 local, 2019 against 2025{inherited && grid ? `, for the whole ${grid} grid` : ''}.</>}
    >
      <div className="mod-sums">
        <div className="mod-sum"><span className="mod-sum-v fossil">{fmtGw(fossil)}</span><span className="mod-sum-l">fossil: gas, coal, oil</span></div>
        <div className="mod-sum"><span className="mod-sum-v clean">{fmtGw(clean)}</span><span className="mod-sum-l">carbon-free: nuclear, hydro, wind, solar, geothermal</span></div>
      </div>
      <ul className="mod-bars">
        {rows.map(({ fuel, v }) => {
          const kind = kindOf(fuel)
          const w = `${(Math.abs(v) / span) * 100}%`
          const place = v >= 0 ? { left: `${zero}%`, width: w } : { right: `${100 - zero}%`, width: w }
          return (
            <li key={fuel} className={`mod-bar ${kind}`}>
              <span className="mod-bar-name">{fuel}</span>
              <span className="mod-bar-track" style={{ '--zero': `${zero}%` }} aria-hidden="true"><i className={`mod-bar-fill ${kind}`} style={{ ...place, opacity: FOSSIL[fuel] ?? 1 }} /></span>
              <span className="mod-bar-val">{fmtGw(v)}</span>
            </li>
          )
        })}
      </ul>
    </Mod>
  )
}
