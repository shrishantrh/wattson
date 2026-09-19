import { useEffect, useRef, useState } from 'react'

// Thin Plotly wrapper. Re-plots when data/layout change, reflows on container resize, purges on unmount.
//
// Plotly (plotly.js-dist-min, 4.8 MB minified) is the largest thing in the app and only the heatmap
// uses it, so it is loaded on demand with a dynamic import the first time a <Plot> mounts. The
// module promise is memoised: every later <Plot> resolves synchronously and never shows the
// placeholder. Nothing else in charts/ may import plotly statically; builders.js and theme.js only
// build plain objects.
let plotlyModule = null
let plotlyPromise = null

// Resolve the Plotly module, loading its chunk on first use. A failed load is not memoised, so the next
// mount retries. Kept module-private: exporting it beside the component would turn off Fast Refresh here.
function loadPlotly() {
  if (plotlyModule) return Promise.resolve(plotlyModule)
  if (!plotlyPromise) {
    plotlyPromise = import('plotly.js-dist-min')
      .then(m => { plotlyModule = m.default || m; return plotlyModule })
      .catch(err => { plotlyPromise = null; throw err })
  }
  return plotlyPromise
}

export default function Plot({ data, layout, height = 300, config, className = 'plot' }) {
  const ref = useRef(null)
  const [state, setState] = useState(() => (plotlyModule ? 'ready' : 'loading'))   // 'loading' | 'ready' | 'failed'
  const ready = state === 'ready'

  useEffect(() => {
    if (state !== 'loading') return
    let alive = true
    loadPlotly().then(() => { if (alive) setState('ready') }, () => { if (alive) setState('failed') })
    return () => { alive = false }
  }, [state])

  useEffect(() => {
    const el = ref.current
    if (!ready || !el) return
    plotlyModule.react(el, data, layout, { displayModeBar: false, responsive: true, ...config })
  }, [ready, data, layout, config])

  // Reflow when the layout around the chart changes (panel open/close, column count), not just on window resize.
  useEffect(() => {
    const el = ref.current
    if (!ready || !el || typeof ResizeObserver === 'undefined') return
    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => { if (el._fullLayout) plotlyModule.Plots.resize(el) })   // only once Plotly has drawn into it
    })
    ro.observe(el)
    return () => { ro.disconnect(); cancelAnimationFrame(raf) }
  }, [ready])

  useEffect(() => {
    const el = ref.current
    if (!ready || !el) return
    return () => { plotlyModule.purge(el) }
  }, [ready])

  // One muted line rather than a thrown error: a chart that cannot load (offline, blocked chunk) must not blank the page.
  if (state === 'failed') {
    return <div className={`${className} plot-unavailable`} style={{ width: '100%', height, display: 'flex', alignItems: 'center', color: 'var(--muted)', fontSize: 12 }}>Chart unavailable</div>
  }
  // Placeholder at the requested height while the chunk downloads, so the layout does not jump when the chart appears.
  if (!ready) {
    return <div className="skeleton plot-skeleton" aria-busy="true" style={{ width: '100%', height, background: 'var(--surface)', borderRadius: 4 }} />
  }
  return <div ref={ref} className={className} style={{ width: '100%', height }} />
}
