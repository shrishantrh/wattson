import { useEffect, useRef } from 'react'
import Plotly from 'plotly.js-dist-min'

export default function Plot({ data, layout, height = 300 }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) Plotly.react(ref.current, data, layout, { displayModeBar: false, responsive: true }) }, [data, layout])
  useEffect(() => () => { if (ref.current) Plotly.purge(ref.current) }, [])
  return <div ref={ref} style={{ width: '100%', height }} />
}
