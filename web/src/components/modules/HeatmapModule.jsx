import { useMemo } from 'react'
import Plot from '../../charts/Plot.jsx'
import { heatmap } from '../../charts/builders.js'

// Carbon-free share for every hour of one year, 365 x 24.
// hm = { year, timezone, days[365], hours[24], cf_share[365][24] } (the grid's, so a zone shows its parent's).
export default function HeatmapView({ hm, height = 220 }) {
  const built = useMemo(() => heatmap(hm), [hm])
  if (!built || built.empty) return <p className="mod-empty">No hourly data for this grid.</p>
  return (
    <div className="mod-heatmap">
      <Plot data={built.data} layout={built.layout} height={height} />
      <p className="mod-foot">Rows are days of {hm?.year ?? 2025}, columns hours local time. Darker is less clean.</p>
    </div>
  )
}
