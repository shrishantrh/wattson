import { useCallback, useEffect, useMemo } from 'react'
import Shell, { fitView } from '../console/Console.jsx'
import { Card, Chip, KV } from '../console/widgets.jsx'
import Scatter from '../components/Scatter.jsx'
import { loadRegions, useAsync } from '../lib/data.js'
import { readTokens } from '../lib/tokens.js'
import { METRICS, PRESETS, DEFAULT_PRESET, metric, tickFormat, pearson, linfit, quantiles, outliers, sectorOf } from '../lib/metrics.js'
import { signed } from '../lib/format.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { href } from '../router.js'
import '../styles/explore.css'

// Explore: any two metrics across the scored regions as a scatter, with the correlation, the
// fit and the outliers. The flat-load detector's own view is the first preset (growth vs
// overnight excess) drawn as a quadrant chart. URL state lives in the hash:
//   #/explore?x=growth_pct&y=overnight_excess&sel=PJM%2FDOM&sector=Texas   (?preset=key also accepted)
const US = { lat: 38.5, lng: -97, altitude: 1.5 }
const SECTORS = ['All', 'Eastern', 'Texas', 'Western']
const NAMED_FALLBACK = ['PJM/DOM', 'PJM/AEP', 'SWPP/OPPD', 'ERCO/NCEN']
const exploreHref = ({ x, y, sel, sector }) => href.explore({ x, y, ...(sel ? { sel } : {}), ...(sector && sector !== 'All' ? { sector } : {}) })
const axisLabel = m => (['%', '×', 'rank'].includes(m.unit) ? m.label : `${m.label} (${m.unit})`)   // tick labels already carry %, × and #

// "Across 111 regions, demand growth and overnight excess correlate r = 0.61: places that grew
// fast also grew faster at night." Generated from the numbers; presets supply the reading.
function sentence({ n, mx, my, r, preset, sector }) {
  const where = sector === 'All' ? `Across ${n} regions` : `Across ${n} ${sector} regions`
  if (r == null) return { text: `${where}, ${mx.phrase} and ${my.phrase} cannot be correlated: too few points or no spread.`, strength: '' }
  const a = Math.abs(r), dir = a < 0.1 ? 'none' : r > 0 ? 'pos' : 'neg'
  const strength = a < 0.1 ? 'no correlation' : a < 0.3 ? `weak ${r > 0 ? 'positive' : 'negative'} correlation` : a < 0.6 ? `moderate ${r > 0 ? 'positive' : 'negative'} correlation` : `strong ${r > 0 ? 'positive' : 'negative'} correlation`
  const verb = a < 0.1 ? 'barely correlate' : a < 0.3 ? 'correlate only weakly' : a < 0.6 ? 'correlate' : 'correlate strongly'
  const generic = { pos: `higher ${mx.phrase} goes with higher ${my.phrase}`, neg: `higher ${mx.phrase} goes with lower ${my.phrase}`, none: `${mx.phrase} says little about ${my.phrase}` }
  const reading = preset?.reading?.[dir] || generic[dir]
  return { text: `${where}, ${mx.phrase} and ${my.phrase} ${verb}, r = ${r.toFixed(2)}: ${reading}${a < 0.3 && dir !== 'none' ? ', but only a little' : ''}.`, strength }
}

// Pins close together label to opposite sides so they never overlap.
function sideLabels(pins, dLng = 7, dLat = 2.6) {
  const out = pins.map(p => ({ ...p }))
  for (const a of out) for (const b of out) { if (a === b || a.lng >= b.lng) continue; if (Math.abs(a.lng - b.lng) < dLng && Math.abs(a.lat - b.lat) < dLat) a.side = 'left' }
  return out
}

export default function Explore({ route }) {
  const { loading, error, data, reload } = useAsync(loadRegions, [])
  const tk = useMemo(() => readTokens(), [])
  const params = route?.params || {}
  const presetParam = PRESETS.find(p => p.key === params.preset) || DEFAULT_PRESET
  const xKey = metric(params.x) ? params.x : presetParam.x
  const yKey = metric(params.y) ? params.y : presetParam.y
  const mx = metric(xKey), my = metric(yKey)
  const preset = PRESETS.find(p => p.x === xKey && p.y === yKey) || null
  const sector = SECTORS.includes(params.sector) ? params.sector : 'All'
  const sel = params.sel || null

  const go = useCallback(patch => { window.location.hash = exploreHref({ x: xKey, y: yKey, sel, sector, ...patch }) }, [xKey, yKey, sel, sector])
  const back = () => { window.location.hash = href.landing() }

  const all = useMemo(() => {
    const flags = data?.meta?.data_flags || {}
    const named = new Set(data?.meta?.validation_named_in_advance || NAMED_FALLBACK)
    // Hollow = data-flagged (WACM) or carrying a correction overlay (AZPS's generation break); the values plotted are the published ones.
    return (data?.regions || []).map(r => ({ id: r.id, x: mx.get(r), y: my.get(r), label: r.c?.label || r.name || r.id, sector: sectorOf(r), flagged: !!flags[r.id] || !!r.exclude_from_alerts || !!r.has_corrections, named: named.has(r.id), lat: r.c?.lat, lng: r.c?.lng, region: r }))
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
  }, [data, mx, my])
  const visible = useMemo(() => (sector === 'All' ? all : all.filter(p => p.sector === sector)), [all, sector])
  const stats = useMemo(() => {
    const xs = visible.map(p => p.x), ys = visible.map(p => p.y)
    const fit = linfit(xs, ys)
    return { r: pearson(xs, ys), fit, outs: outliers(visible, fit, 5), xm: quantiles(xs, [0.5])[0], ym: quantiles(ys, [0.5])[0] }
  }, [visible])
  const selected = visible.find(p => p.id === sel) || null
  const inSector = (s, id) => !id || s === 'All' || all.some(p => p.id === id && p.sector === s)

  useEffect(() => {
    if (!sel) return
    const on = e => { if (e.key === 'Escape' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) go({ sel: null }) }
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on)
  }, [sel, go])

  const globe = useMemo(() => {
    const col = { Eastern: tk.ink2, Texas: tk.ink, Western: tk.muted, Other: tk.muted }
    const located = visible.filter(p => p.lat != null && p.lng != null)
    return { view: sector === 'All' ? US : fitView(located, US), interactive: true,
      points: located.map(p => ({ id: p.id, lat: p.lat, lng: p.lng, r: p.id === sel ? 0.2 : 0.12, color: p.id === sel ? tk.accent : col[p.sector], hollow: p.flagged })),
      markers: sideLabels(located.filter(p => p.named || p.id === sel).map(p => ({ id: p.id, lat: p.lat, lng: p.lng, label: `${p.label} · ${my.format(p.y)}`, tip: `${mx.short} ${mx.format(p.x)}`, href: href.region(p.id), color: p.id === sel ? tk.accent : tk.ink2, lead: p.id === sel, hollow: p.flagged }))) }
  }, [visible, sel, sector, tk, mx, my])

  const s = data ? sentence({ n: visible.length, mx, my, r: stats.r, preset, sector }) : null
  const slopeText = stats.fit.slope == null ? '—' : `${signed(stats.fit.slope, Math.abs(stats.fit.slope) < 0.1 ? 3 : 2)} ${my.unit} per ${mx.unit === '%' ? '1%' : mx.unit === 'pts' ? 'pt' : mx.unit}`
  const pick = (axis, key) => go(axis === 'x' ? { x: key } : { y: key })

  const column = (
    <>
      <Card title={<><b>Explore</b> · {data ? `${all.length} regions` : 'regions'} · any two metrics</>} onClose={back}>
        {loading ? <Loading what="the regions" /> : error ? <ErrorState error={error} onRetry={reload} /> : (
          <>
            <p className="xp-q">{s.text}</p>
            <p className="xp-sub">{s.strength && <span className="xp-strength">{s.strength}</span>}{preset ? preset.question : `${mx.label} against ${my.label}.`} {preset?.note}</p>
          </>
        )}
        <div className="xp-presets">{PRESETS.map(p => <Chip key={p.key} small active={preset?.key === p.key} href={exploreHref({ x: p.x, y: p.y, sel, sector })}>{p.label}</Chip>)}</div>
        <div className="xp-axes">
          <label>x<select className="field" value={xKey} onChange={e => pick('x', e.target.value)} aria-label="x axis metric">{METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select></label>
          <label>y<select className="field" value={yKey} onChange={e => pick('y', e.target.value)} aria-label="y axis metric">{METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select></label>
          <button type="button" className="btn xp-swap" onClick={() => go({ x: yKey, y: xKey })} aria-label="Swap axes" data-tip="Swap axes">⇄</button>
          <span className="xp-sectors">{SECTORS.map(x => <Chip key={x} small active={x === sector} onClick={() => go({ sector: x, sel: inSector(x, sel) ? sel : null })}>{x}</Chip>)}</span>
        </div>
        {data && (
          <>
            <Scatter points={visible} xLabel={axisLabel(mx)} yLabel={axisLabel(my)} xFormat={mx.format} yFormat={my.format} xTick={tickFormat(mx)} yTick={tickFormat(my)} width={700} height={420} selectedId={sel} onSelect={id => go({ sel: id === sel ? null : id })} quadrants={!!preset?.quadrants} quadrantLabel={preset?.quadrantLabel || ''} fitLine />
            <div className="legend xp-legend"><span><i className="ink2" />Eastern</span><span><i className="ink" />Texas</span><span><i className="dim" />Western</span><span><i className="hollow" />data-flagged or corrected</span><span><i className="ring" />named in advance</span><span><i className="line" />least-squares fit</span>{preset?.quadrants && <span><i className="cross" />medians</span>}<span className="xp-legend-hint">click a point to pin it</span></div>
          </>
        )}
      </Card>
      {data && (
        <Card title={<><b>Fit</b> · {my.short} on {mx.short}</>}>
          <KV rows={[['Pearson r', stats.r == null ? '—' : stats.r.toFixed(3)], ['Slope', slopeText], ['n', String(visible.length)], preset?.quadrants && [`Median ${mx.short}`, mx.format(stats.xm)], preset?.quadrants && [`Median ${my.short}`, my.format(stats.ym)]]} />
          {selected && (
            <div className="xp-sel">
              <span><b>{selected.label}</b> <span className="mono muted">{selected.id}</span></span>
              <span className="mono">{mx.short} {mx.format(selected.x)}</span>
              <span className="mono">{my.short} {my.format(selected.y)}</span>
              {selected.region?.detection?.rank != null && <span className="mono">rank #{selected.region.detection.rank}</span>}
              {selected.region?.detection?.pattern && <span className="muted">{selected.region.detection.pattern}</span>}
              {selected.flagged && <span className="muted">data-flagged</span>}
              <a className="xp-open" href={href.region(selected.id)}>Open region →</a>
              <button type="button" className="close" onClick={() => go({ sel: null })} aria-label="Clear selection">×</button>
            </div>
          )}
          <div className="section-title" style={{ marginTop: 14 }}><span>Farthest from the fit</span><span className="mono muted">residual in {my.unit}</span></div>
          {stats.outs.length ? (
            <div className="rows">
              {stats.outs.map(p => (
                <a key={p.id} className={`row${p.id === sel ? ' lead' : ''}`} href={href.region(p.id)}>
                  <span><div className="t">{p.label} <small className="muted">{p.id}{p.flagged ? ' · flagged' : ''}</small></div><div className="d">{mx.short} {mx.format(p.x)} · {my.short} {my.format(p.y)}</div></span>
                  <span className="n">{signed(p.resid, Math.abs(p.resid) < 0.1 ? 3 : 1)} <small>{my.unit}</small></span>
                </a>
              ))}
            </div>
          ) : <p className="note">No fit: the x axis has no spread.</p>}
          <p className="note" style={{ marginTop: 12 }}>Generation is measured within a footprint, not consumption, and zones inherit their grid's generation figures. Correlation across regions is not causation; the detector reads demand only.</p>
        </Card>
      )}
    </>
  )
  return <Shell page="explore" globe={globe} column={column} columnWidth={760} />
}
