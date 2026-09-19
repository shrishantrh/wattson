import { useEffect, useRef } from 'react'
import Plotly from 'plotly.js-dist-min'

// Thin Plotly wrapper. Re-plots when data/layout change, reflows on container resize, purges on unmount.
export default function Plot({ data, layout, height = 300, config, className = 'plot' }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    Plotly.react(el, data, layout, { displayModeBar: false, responsive: true, ...config })
  }, [data, layout, config])

  // Reflow when the layout around the chart changes (panel open/close, column count), not just on window resize.
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => { if (el._fullLayout) Plotly.Plots.resize(el) })   // only once Plotly has drawn into it
    })
    ro.observe(el)
    return () => { ro.disconnect(); cancelAnimationFrame(raf) }
  }, [])

  useEffect(() => {
    const el = ref.current
    return () => { if (el) Plotly.purge(el) }
  }, [])

  return <div ref={ref} className={className} style={{ width: '100%', height }} />
}
