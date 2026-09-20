import { Mod, Lead, Empty } from './Shell.jsx'

// The utilities serving this region's load. The table is hand-mapped from public service-territory
// information (scripts/operators_manual.json), not derived from the hourly data, and the card says so.
export default function OperatorsView({ operators }) {
  const rows = (operators || []).filter(o => o && (o.utility || o.parent || o.ticker))
  if (!rows.length) return <Empty>No operator mapping for this region.</Empty>
  const lead = String(rows.length)
  const label = rows.length === 1 ? `utility serves the load here: ${rows[0].utility || rows[0].parent}` : 'utilities serve the load here'
  return (
    <Mod
      className="mod-ops"
      caption="Who would build for, and bill, a new flat load here."
      lead={<Lead value={lead} label={label} />}
      foot="Hand-mapped from public service territories, not from the hourly data. Tickers are unverified."
    >
      <div className="mod-rows">
        {rows.map((o, i) => {
          const tag = [o.parent, o.ticker].filter(Boolean).join(' · ')
          return (
            <div key={`${o.utility || o.parent || 'op'}-${i}`} className="mod-row">
              <div className="mod-cell">
                <div className="mod-t">{o.utility || o.parent}</div>
                {o.role && <div className="mod-d">{o.role}</div>}
              </div>
              {tag && <span className="mod-chip mono">{tag}</span>}
            </div>
          )
        })}
      </div>
    </Mod>
  )
}
