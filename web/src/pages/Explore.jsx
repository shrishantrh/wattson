import { useCallback, useEffect, useMemo, useState } from 'react'
import Shell, { fitView } from '../console/Console.jsx'
import { Card, Chip } from '../console/widgets.jsx'
import Scatter from '../components/Scatter.jsx'
import { WxSeg, WxRange, WxReadout, useKeyList } from '../components/WxControls.jsx'
import { loadRegions, useAsync } from '../lib/data.js'
import { readTokens } from '../lib/tokens.js'
import { METRICS, PRESETS, DEFAULT_PRESET, metric, tickFormat, pearson, linfit, quantiles, outliers, sectorOf, GENERATION_SIDE } from '../lib/metrics.js'
import { signed } from '../lib/format.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { href, useHash } from '../router.js'
import '../styles/explore.css'
import '../styles/pages.css'
import '../styles/wx.css'
import Breadcrumbs, { useCrumbs } from '../components/Breadcrumbs.jsx'

// Explore: any two metrics across the scored regions as a scatter, with the correlation, the
// fit and the outliers. The flat-load detector's own view is the first preset (growth vs
// overnight excess) drawn as a quadrant chart. URL state lives in the hash:
//   #/explore?x=growth_pct&y=overnight_excess&sel=PJM%2FDOM&sector=Texas   (?preset=key also accepted)
const US = { lat: 38.5, lng: -97, altitude: 1.5 }
const SECTORS = ['All', 'Eastern', 'Texas', 'Western']
const NAMED_FALLBACK = ['PJM/DOM', 'PJM/AEP', 'SWPP/OPPD', 'ERCO/NCEN']
const exploreHref = ({ x, y, sel, sector }) => href.explore({ x, y, ...(sel ? { sel } : {}), ...(sector && sector !== 'All' ? { sector } : {}) })
const axisLabel = m => (['%', '×', 'rank'].includes(m.unit) ? m.label : `${m.label} (${m.unit})`)   // tick labels already carry %, × and #
const medianOf = xs => { const v = xs.filter(Number.isFinite).sort((a, b) => a - b); return v.length ? v[Math.floor((v.length - 1) / 2)] : null }

// "Across 111 regions, demand growth and overnight excess correlate r = 0.61: places that grew
// fast also grew faster at night." Generated from the numbers; presets supply the reading.
function sentence({ n, unit = 'regions', enough = true, mx, my, r, preset, sector }) {
  const where = sector === 'All' ? `Across ${n} ${unit}` : `Across ${n} ${sector} ${unit}`
  const basisNote = unit === 'grids' ? ' (one point per grid, since zones inherit their grid\'s generation figures; flagged and corrected grids left out)' : ' (flagged and corrected regions left out)'
  if (!enough) return { text: `${where}${basisNote}, too few independent points to quote a correlation; the chart shows the pattern.`, strength: '' }
  if (r == null) return { text: `${where}, ${mx.phrase} and ${my.phrase} cannot be correlated: no spread.`, strength: '' }
  const a = Math.abs(r), dir = a < 0.1 ? 'none' : r > 0 ? 'pos' : 'neg'
  const strength = a < 0.1 ? 'no correlation' : a < 0.3 ? `weak ${r > 0 ? 'positive' : 'negative'} correlation` : a < 0.6 ? `moderate ${r > 0 ? 'positive' : 'negative'} correlation` : `strong ${r > 0 ? 'positive' : 'negative'} correlation`
  const verb = a < 0.1 ? 'barely correlate' : a < 0.3 ? 'correlate only weakly' : a < 0.6 ? 'correlate' : 'correlate strongly'
  const generic = { pos: `higher ${mx.phrase} goes with higher ${my.phrase}`, neg: `higher ${mx.phrase} goes with lower ${my.phrase}`, none: `${mx.phrase} says little about ${my.phrase}` }
  const reading = preset?.reading?.[dir] || generic[dir]
  return { text: `${where}${basisNote}, ${mx.phrase} and ${my.phrase} ${verb}, r = ${r.toFixed(2)}: ${reading}${a < 0.3 && dir !== 'none' ? ', but only a little' : ''}.`, strength }
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
  const crumbs = useCrumbs(useHash())
  const back = () => { window.location.hash = href.landing() }

  const all = useMemo(() => {
    const flags = data?.meta?.data_flags || {}
    const named = new Set(data?.meta?.validation_named_in_advance || NAMED_FALLBACK)
    // Hollow = data-flagged (WACM) or carrying a correction overlay (AZPS's generation break); the values plotted are the published ones.
    return (data?.regions || []).map(r => ({ id: r.id, x: mx.get(r), y: my.get(r), label: r.c?.label || r.name || r.id, sector: sectorOf(r), flagged: !!flags[r.id] || !!r.exclude_from_alerts || !!r.has_corrections, named: named.has(r.id), lat: r.c?.lat, lng: r.c?.lng, region: r }))
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
  }, [data, mx, my])
  const visible = useMemo(() => (sector === 'All' ? all : all.filter(p => p.sector === sector)), [all, sector])
  // Statistics run on independent points only: flagged or corrected regions are drawn but left out, and when
  // both axes are generation-side, zones (which inherit their grid's figures) collapse to one point per grid.
  const basis = useMemo(() => {
    const clean = visible.filter(p => !p.flagged)
    if (!(GENERATION_SIDE.has(mx.key) && GENERATION_SIDE.has(my.key))) return { pts: clean, unit: 'regions' }
    const seen = new Map()
    for (const p of clean) { const g = p.id.includes('/') ? p.id.split('/')[0] : p.id; if (!seen.has(g) || !p.id.includes('/')) seen.set(g, p) }
    return { pts: [...seen.values()], unit: 'grids' }
  }, [visible, mx, my])
  const stats = useMemo(() => {
    const xs = basis.pts.map(p => p.x), ys = basis.pts.map(p => p.y)
    const fit = linfit(xs, ys)
    const enough = basis.pts.length >= 40
    return { r: enough ? pearson(xs, ys) : null, n: basis.pts.length, unit: basis.unit, enough, fit, outs: outliers(basis.pts, fit, 5), xm: quantiles(xs, [0.5])[0], ym: quantiles(ys, [0.5])[0] }
  }, [basis])
  const selected = visible.find(p => p.id === sel) || null
  const inSector = (s, id) => !id || s === 'All' || all.some(p => p.id === id && p.sector === s)

  // A threshold the reader sets on the y metric. The domain and the step are read off the
  // plotted points, so the handle always spans real values and never lands outside them.
  const dom = useMemo(() => {
    const ys = visible.map(p => p.y).filter(Number.isFinite)
    if (!ys.length) return { lo: 0, hi: 1, step: 0.1 }
    const lo = Math.min(...ys), hi = Math.max(...ys)
    const step = Number(((hi - lo || 1) / 100).toPrecision(1))
    return { lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step, step }
  }, [visible])
  const [dir, setDir] = useState('gte')
  const [cut, setCut] = useState(null)
  useEffect(() => { setCut(null) }, [yKey, sector])
  const cutAt = cut == null ? (dir === 'gte' ? dom.lo : dom.hi) : Math.min(dom.hi, Math.max(dom.lo, cut))
  const passing = useMemo(() => visible.filter(p => (dir === 'gte' ? p.y >= cutAt : p.y <= cutAt)).sort((a, b) => (dir === 'gte' ? b.y - a.y : a.y - b.y)), [visible, dir, cutAt])
  const cutNav = useKeyList(passing.length, { onOpen: i => passing[i] && go({ sel: passing[i].id }), onEscape: () => go({ sel: null }) })

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

  const s = data ? sentence({ n: stats.n, unit: stats.unit, enough: stats.enough, mx, my, r: stats.r, preset, sector }) : null
  const slopeText = stats.fit.slope == null ? ', ' : `${signed(stats.fit.slope, Math.abs(stats.fit.slope) < 0.1 ? 3 : 2)} ${my.unit} per ${mx.unit === '%' ? '1%' : mx.unit === 'pts' ? 'pt' : mx.unit}`
  const pick = (axis, key) => go(axis === 'x' ? { x: key } : { y: key })

  const column = (
    <>
      <Breadcrumbs trail={crumbs} onBack={back} />
      <Card title={<><b>Explore</b> · {data ? `${all.length} regions` : 'regions'}</>} onClose={back}>
        <p className="pg-top">Plot any two metrics against each other. <span className="q">{preset ? preset.question : `${mx.label} against ${my.label}.`}</span></p>
        {loading ? <Loading what="the regions" /> : error ? <ErrorState error={error} onRetry={reload} /> : null}
        {/* one control block: the question to ask, the two axes, and which part of the country */}
        <div className="xp-panel">
          <div className="xp-panel-row"><span className="xp-rowlabel">Ask</span><span className="pg-chips">{PRESETS.map(p => <Chip key={p.key} small active={preset?.key === p.key} href={exploreHref({ x: p.x, y: p.y, sel, sector })}>{p.label}</Chip>)}</span></div>
          <div className="xp-panel-row">
            <div className="xp-axes">
              <label className="xp-pick"><span>x axis</span><span className="xp-field"><select className="field" value={xKey} onChange={e => pick('x', e.target.value)} aria-label="x axis metric">{METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select></span></label>
              <button type="button" className="btn xp-swap" onClick={() => go({ x: yKey, y: xKey })} aria-label="Swap axes" data-tip="Swap axes">⇄</button>
              <label className="xp-pick"><span>y axis</span><span className="xp-field"><select className="field" value={yKey} onChange={e => pick('y', e.target.value)} aria-label="y axis metric">{METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select></span></label>
            </div>
          </div>
          <div className="xp-panel-row xp-legendrow"><span className="xp-rowlabel">Where</span>{SECTORS.map(x => <Chip key={x} small active={x === sector} onClick={() => go({ sector: x, sel: inSector(x, sel) ? sel : null })}>{x}</Chip>)}</div>
        </div>
        {data && (
          <>
            <Scatter points={visible} xLabel={axisLabel(mx)} yLabel={axisLabel(my)} xFormat={mx.format} yFormat={my.format} xTick={tickFormat(mx)} yTick={tickFormat(my)} width={700} height={420} selectedId={sel} onSelect={id => go({ sel: id === sel ? null : id })} quadrants={!!preset?.quadrants} quadrantLabel={preset?.quadrantLabel || ''} fitLine />
            <div className="legend xp-legend"><span><i className="ink2" />Eastern</span><span><i className="ink" />Texas</span><span><i className="dim" />Western</span><span><i className="hollow" />data-flagged or corrected</span><span><i className="ring" />named in advance</span><span><i className="line" />least-squares fit</span>{preset?.quadrants && <span><i className="cross" />medians</span>}<span className="xp-legend-hint">click a point to pin it</span></div>
          </>
        )}
      </Card>
      {data && (
        <Card title={<><b>The fit</b> · {my.short} on {mx.short}</>}>
          {/* result: the correlation first and large, then what it was measured on, then the sentence */}
          <div className="xp-result">
            <div className="xp-r">
              <div className="v">{stats.r == null ? ', ' : stats.r.toFixed(2)}</div>
              <div className="k">Pearson r</div>
              {s.strength && <span className="xp-strength">{s.strength}</span>}
            </div>
            <dl className="xp-basis">
              <div><dt>n</dt><dd>{stats.n} {stats.unit}</dd></div>
              <div><dt>Basis</dt><dd>{stats.unit === 'grids' ? 'one per grid' : 'all regions'}</dd></div>
              <div><dt>Slope</dt><dd>{slopeText}</dd></div>
              {preset?.quadrants && <div><dt>Median {mx.short}</dt><dd>{mx.format(stats.xm)}</dd></div>}
              {preset?.quadrants && <div><dt>Median {my.short}</dt><dd>{my.format(stats.ym)}</dd></div>}
            </dl>
          </div>
          <p className="xp-say">{s.text}{preset?.note ? ` ${preset.note}` : ''}</p>
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
          <p className="note pg-fine">Generation is measured within a footprint, not consumption, and a zone's generation figures are its parent grid's, a zone reports demand only. A correlation across regions is not a cause: the detector reads demand and nothing else, so a tight fit here says two measurements move together, not that one produced the other.</p>
        </Card>
      )}
      {data && (
        <Card title={<><b>Cut the field</b> · a threshold on {my.short}</>}>
          <p className="note">Drag the line and the list below is whatever survives it. Click a region to pin it on the chart and the globe.</p>
          <div className="wx-bar">
            <WxSeg label="keep regions where" value={dir} onChange={d => { setDir(d); setCut(null) }} options={[['gte', `${my.short} ≥`], ['lte', `${my.short} ≤`]]} />
            <WxRange label="the line" value={cutAt} min={dom.lo} max={dom.hi} step={dom.step} onChange={setCut} format={v => my.format(v)} />
          </div>
          <WxReadout items={[
            { value: String(passing.length), label: `of ${visible.length} plotted regions survive`, tone: passing.length ? '' : 'warn' },
            { value: my.format(medianOf(passing.map(p => p.y))), label: `median ${my.short} among them`, tone: 'clean' },
            { value: mx.format(medianOf(passing.map(p => p.x))), label: `median ${mx.short} among them` },
            { value: mx.format(medianOf(visible.filter(p => !passing.includes(p)).map(p => p.x))), label: `median ${mx.short} among the rest` },
          ]} />
          {passing.length === 0
            ? <p className="wx-none">Nothing is {dir === 'gte' ? 'at or above' : 'at or below'} <b>{my.format(cutAt)}</b>. Drag the line back the other way.</p>
            : (
              <>
                <div {...cutNav.listProps} className="wx-list" role="list" aria-label={`Regions ${dir === 'gte' ? 'above' : 'below'} the line`} style={{ maxHeight: 260, overflowY: 'auto' }}>
                  {passing.slice(0, 40).map((p, i) => (
                    <div
                      key={p.id}
                      data-wx-item
                      className={`wx-li${i === cutNav.index ? ' on' : ''}${p.id === sel ? ' sel' : ''}`}
                      role="listitem"
                      onClick={() => go({ sel: p.id === sel ? null : p.id })}
                    >
                      <span className="rk">{i + 1}</span>
                      <span><span className="t">{p.label}</span><span className="d">{mx.short} {mx.format(p.x)}{p.flagged ? ' · data-flagged or corrected' : ''}{p.named ? ' · named in advance' : ''} · <a href={href.region(p.id)} onClick={e => e.stopPropagation()}>open</a></span></span>
                      <span className="n">{my.format(p.y)}</span>
                    </div>
                  ))}
                </div>
                <p className="wx-hint" style={{ marginTop: 8 }}>{passing.length > 40 ? `First 40 of ${passing.length}. ` : ''}Click the list, then <span className="wx-kbd">&uarr;</span> <span className="wx-kbd">&darr;</span> to walk it and <span className="wx-kbd">&crarr;</span> to pin. <span className="wx-kbd">Esc</span> unpins.</p>
              </>
            )}
        </Card>
      )}
    </>
  )
  return <Shell page="explore" globe={globe} column={column} columnWidth={760} />
}
