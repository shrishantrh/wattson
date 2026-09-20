/* oxlint-disable react/only-export-components -- formatValue is pure and shared with the page */
import { useMemo } from 'react'
import Table from './Table.jsx'
import { Num } from '../console/widgets.jsx'
import '../styles/ask.css'

// The answer as something you can read, not a paragraph you have to parse.
//
// The server returns {headline, summary, kind, columns, rows, chart, caveats, sources} and
// promises one thing about it: every figure in `rows` and `chart` came from a tool result in
// the same conversation, checked against the numbers those tools actually returned. This file
// draws that and nothing else. It computes no value, derives no total and rescales nothing:
// if a number is not in the view, it is not on the screen.
//
//   comparison / ranking -> a real table, sortable, with a CSV of exactly these rows
//   single               -> a stat block
//   (kind "prose" never reaches here; the paragraph is served instead)

const isNum = v => typeof v === 'number' && Number.isFinite(v)
const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '')

// Units the cell carries itself; anything else goes in the column header instead, so a column
// of megawatts does not repeat "MW" down twenty rows.
const CELL_UNITS = new Set(['%', 'rank', 'score', ''])

export function formatValue(v, unit = '') {
  if (v == null || v === '') return ', '
  if (!isNum(v)) return String(v)
  if (unit === '%') return `${v.toFixed(1)}%`
  if (unit === 'pp' || unit === 'pts') return `${sign(v)}${nf.format(Math.abs(v))}`
  if (unit === 'rank') return `#${Math.round(v)}`
  if (unit === 'score') return v.toFixed(2)
  return nf.format(v)
}

const headerLabel = c => (c.unit && !CELL_UNITS.has(c.unit) ? `${c.label} (${c.unit})` : c.label)
const cellUnit = c => (CELL_UNITS.has(c.unit) ? c.unit : '')
// Off the table, a figure carries its own unit: "35,619 MW", not a bare 35,619.
const withUnit = (v, unit) => (!isNum(v) || CELL_UNITS.has(unit) ? formatValue(v, unit) : `${formatValue(v, unit)} ${unit}`)
const regionId = href => { const m = /^#\/region\/(.+)$/.exec(href || ''); return m ? decodeURIComponent(m[1]) : null }

// ---------------------------------------------------------------- chart
// Plain SVG, one colour ramp, no library. Bars compare a value across the rows; lines follow a
// value over years. Both start their scale at zero when the data is all positive, because a
// truncated baseline makes a 4-point move look like a collapse.

function Bars({ series, unit }) {
  const pts = series.flatMap(s => s.points.map((p, i) => ({
    key: `${s.label}-${p.x}-${i}`,
    label: series.length > 1 ? `${s.label} · ${p.x}` : String(p.x),
    y: p.y,
  })))
  const max = Math.max(...pts.map(p => Math.abs(p.y)), 0) || 1
  return (
    <ul className="ask-bars">
      {pts.map(p => (
        <li key={p.key}>
          <span className="ask-bar-k">{p.label}</span>
          <span className="ask-bar-t"><i className={p.y < 0 ? 'neg' : ''} style={{ width: `${(Math.abs(p.y) / max) * 100}%` }} /></span>
          <span className="ask-bar-v">{withUnit(p.y, unit)}</span>
        </li>
      ))}
    </ul>
  )
}

const W = 700, H = 250, M = { top: 14, right: 96, bottom: 28, left: 54 }

function Lines({ series, unit }) {
  const { cats, lo, hi } = useMemo(() => {
    const cats = []
    for (const s of series) for (const p of s.points) { const x = String(p.x); if (!cats.includes(x)) cats.push(x) }
    const ys = series.flatMap(s => s.points.map(p => p.y))
    const min = Math.min(...ys), max = Math.max(...ys)
    const lo = min >= 0 ? 0 : min - (max - min) * 0.08
    const hi = max === lo ? lo + 1 : max + (max - lo) * 0.08
    return { cats, lo, hi }
  }, [series])
  const w = W - M.left - M.right, h = H - M.top - M.bottom
  const sx = i => M.left + (cats.length < 2 ? w / 2 : (i / (cats.length - 1)) * w)
  const sy = v => M.top + h - ((v - lo) / (hi - lo)) * h
  const ticks = [0, 0.5, 1].map(f => lo + (hi - lo) * f)
  return (
    <svg className="ask-lines" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${series.map(s => s.label).join(', ')} over ${cats.join(', ')}`}>
      {ticks.map(t => (
        <g key={t}>
          <line className="ask-grid" x1={M.left} x2={M.left + w} y1={sy(t)} y2={sy(t)} />
          <text className="ask-axis" x={M.left - 8} y={sy(t) + 3.5} textAnchor="end">{withUnit(t, unit)}</text>
        </g>
      ))}
      {cats.map((c, i) => <text key={c} className="ask-axis" x={sx(i)} y={H - 9} textAnchor="middle">{c}</text>)}
      {series.map((s, si) => {
        const pts = s.points.map(p => ({ x: sx(cats.indexOf(String(p.x))), y: sy(p.y) })).filter(p => Number.isFinite(p.x))
        const last = pts[pts.length - 1]
        return (
          <g key={s.label} className={`ask-s${si % 5}`}>
            {pts.length > 1 && <polyline className="ask-line" points={pts.map(p => `${p.x},${p.y}`).join(' ')} />}
            {pts.map((p, i) => <circle key={i} className="ask-dot" cx={p.x} cy={p.y} r="3" />)}
            {last && <text className="ask-slabel" x={last.x + 8} y={last.y + 3.5}>{s.label}</text>}
          </g>
        )
      })}
    </svg>
  )
}

function AskChart({ chart, unit }) {
  if (!chart?.series?.length) return null
  return <div className="ask-chart">{chart.type === 'bars' ? <Bars series={chart.series} unit={unit} /> : <Lines series={chart.series} unit={unit} />}</div>
}

// ---------------------------------------------------------------- the view

export default function AskView({ view }) {
  const columns = useMemo(() => [
    { key: '_label', label: view.kind === 'ranking' ? 'Place' : 'What', raw: r => r.label, width: '34%' },
    ...view.columns.map(c => ({
      key: c.key, label: headerLabel(c), num: true,
      raw: r => r.values?.[c.key],
      format: v => formatValue(v, cellUnit(c)),
    })),
  ], [view])
  const rows = view.rows
  // Which column is the chart drawing? Whichever one its values came from. Taking the first
  // unit on the view labelled a growth chart in ranks.
  const chartUnit = useMemo(() => {
    const ys = (view.chart?.series || []).flatMap(s => s.points.map(p => p.y))
    if (!ys.length) return ''
    const hit = view.columns.find(c => rows.some(r => {
      const v = r.values?.[c.key]
      return isNum(v) && ys.some(y => Math.abs(y - v) <= Math.max(1e-9, Math.abs(v) * 1e-3))
    }))
    return hit?.unit || ''
  }, [view, rows])
  const unverified = view.unverified_value_count || 0

  return (
    <>
      {view.kind === 'single' ? (
        <div className="nums ask-stats">
          {view.columns.map(c => <Num key={c.key} value={formatValue(rows[0].values?.[c.key], c.unit)} label={c.label} sub={CELL_UNITS.has(c.unit) ? null : c.unit} />)}
        </div>
      ) : (
        <Table columns={columns} rows={rows} rowKey={r => r.label} rowHref={r => r.href || null}
          csvName="wattson-ask" dense className="ask-tbl" emptyText="Nothing to put in a table" />
      )}

      <AskChart chart={view.chart} unit={chartUnit} />

      {view.kind === 'single' && rows[0]?.href && (
        <p className="ask-open"><a href={rows[0].href}>Open {rows[0].label} →</a></p>
      )}

      {!!view.caveats?.length && (
        <ul className="ans-list ask-caveats">
          {view.caveats.map(c => <li key={c}>{c}</li>)}
        </ul>
      )}

      <p className="note ask-prov">
        {view.sources?.length ? `Every figure here came from ${view.sources.join(', ')} over the published EIA-930 index. ` : ''}
        {view.values_checked
          ? unverified
            ? `${unverified} of ${view.values_checked} figures could not be matched back to a tool result, read those with suspicion.`
            : `All ${view.values_checked} figures match numbers those tools returned.`
          : ''}
      </p>
    </>
  )
}

// Rows that point at a region, for the globe behind the column.
// oxlint-disable-next-line react/only-export-components
export const viewRegionIds = view => (view?.rows || []).map(r => regionId(r.href)).filter(Boolean)
