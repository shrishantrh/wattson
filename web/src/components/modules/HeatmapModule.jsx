import { useMemo } from 'react'
import Plot from '../../charts/Plot.jsx'
import { heatmap } from '../../charts/builders.js'
import { Mod, Empty } from './Shell.jsx'

// Carbon-free share for every hour of one year, 365 x 24. The picture is the lead here, so the
// caption above it says how to read it and nothing competes with it.
// hm = { year, timezone, days[365], hours[24], cf_share[365][24] } (the grid's, so a zone shows its parent's).
export default function HeatmapView({ hm, height = 220 }) {
  const built = useMemo(() => heatmap(hm), [hm])
  if (!built || built.empty) return <Empty>No hourly data for this grid.</Empty>
  const year = hm?.year ?? 2025
  return (
    <Mod
      className="mod-heatmap"
      caption={`One row per day of ${year}, one column per hour. Darker is less clean, and a round-the-clock load sits in every column, dark ones included.`}
      foot={`EIA-930 hourly via PUDL, ${year}, local time. Generation within the footprint, not consumption.`}
    >
      <Plot data={built.data} layout={built.layout} height={height} />
    </Mod>
  )
}
