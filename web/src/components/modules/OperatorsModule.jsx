// The utilities serving this region's load. The table is hand-mapped from public service-territory
// information (scripts/operators_manual.json), not derived from the hourly data, and the chip says so.
export default function OperatorsView({ operators }) {
  const rows = (operators || []).filter(o => o && (o.utility || o.parent || o.ticker))
  if (!rows.length) return <p className="mod-empty">No operator mapping for this region.</p>
  return (
    <div className="mod-ops">
      <div className="mod-head mod-head-right">
        <span className="mod-chip dim" tabIndex={0} data-tip="Built from public service-territory information, not from the data. Tickers are unverified." data-tip-side="left">hand-mapped</span>
      </div>
      <ul className="mod-rows">
        {rows.map((o, i) => {
          const tag = [o.parent, o.ticker].filter(Boolean).join(' · ')
          return (
            <li key={`${o.utility || o.parent || 'op'}-${i}`} className="mod-row">
              <div className="mod-cell">
                <div className="mod-t">{o.utility || o.parent}</div>
                {o.role && <div className="mod-d">{o.role}</div>}
              </div>
              {tag && <span className="mod-chip mono">{tag}</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
