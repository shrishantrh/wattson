import { useMemo, useState } from 'react'
import { useRegionDetails } from '../lib/data.js'
import { caveatFor } from '../lib/findings.js'
import { href } from '../router.js'
import { isNum, DASH } from './WxControls.jsx'
import '../styles/wx.css'

// Any two of the scored regions, side by side, with the difference spelled out.
//
// The ranked list above answers "of the places I named, which is cleanest". This answers the
// other question a site selector actually asks: "how much worse is the site I already have
// than the one I am being sold". Both columns are read off the same export, so the difference
// is arithmetic, not a judgement. A row either side of which is missing shows an em dash and
// no difference — a missing figure is never drawn as a zero gap.

const pct1 = v => (isNum(v) ? `${(v * 100).toFixed(1)}%` : DASH)
const pts1 = v => (isNum(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(1)} pts` : DASH)
const ptsYr = v => (isNum(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(2)} pts/yr` : DASH)
const times = v => (isNum(v) ? `${v.toFixed(2)}×` : DASH)
const rank = v => (isNum(v) ? `#${Math.round(v)}` : DASH)
const pctG = v => (isNum(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(0)}%` : DASH)
const mw0 = v => (isNum(v) ? `${Math.round(v).toLocaleString('en-US')} MW` : DASH)
const labelOf = r => r?.c?.label || r?.name || r?.id || ''

export default function WxHeadToHead({ regions = [], mw = 300, initial = [] }) {
  const sorted = useMemo(() => [...regions].sort((x, y) => labelOf(x).localeCompare(labelOf(y))), [regions])
  const [aId, setA] = useState(() => initial[0] || sorted[0]?.id || '')
  const [bId, setB] = useState(() => initial[1] || sorted.find(r => r.id !== (initial[0] || sorted[0]?.id))?.id || '')
  const details = useRegionDetails([aId, bId])
  const A = sorted.find(r => r.id === aId) || null
  const B = sorted.find(r => r.id === bId) || null
  const load = Number(mw) || 300

  if (!sorted.length) return null

  const night = r => r?.siting?.overnight_cf_share_2025 ?? r?.cf_share_2025?.overnight ?? null
  const dem = id => details[id]?.demand?.['2025']?.overnight_avg_mw ?? null
  const fossil = r => (isNum(night(r)) ? load * (1 - night(r)) : null)

  // A region whose published history the engine has corrected (AZPS counted a plant SRP also
  // reported) carries a caveat. Its level for 2025 is sound, but anything measured against 2019
  // is wrong in direction as published, so those rows are marked and their difference withheld
  // rather than printed as if the two sides were measured the same way.
  const cavA = caveatFor(aId), cavB = caveatFor(bId)
  const suspect = row => !!(row.history && (cavA || cavB))

  // good: which direction is better for a datacenter siting decision. null = no direction.
  const ROWS = [
    { k: 'Clean at night, 2025', a: night(A), b: night(B), fmt: pct1, good: 'high', d: 'pts' },
    { k: 'Change in that since 2019', a: A?.siting?.change_since_2019, b: B?.siting?.change_since_2019, fmt: pts1, good: 'high', d: 'pts', history: true },
    { k: 'Trend per year (clean ÷ night demand)', a: A?.siting?.ratio_slope_per_year, b: B?.siting?.ratio_slope_per_year, fmt: ptsYr, good: 'high', d: 'ptsyr', history: true },
    { k: 'Clean power against its own night demand', a: A?.siting?.overnight_clean_mw_over_demand, b: B?.siting?.overnight_clean_mw_over_demand, fmt: times, good: 'high', d: 'x' },
    { k: 'Siting rank (1 is best)', a: A?.siting?.siting_rank, b: B?.siting?.siting_rank, fmt: rank, good: 'low', d: 'places', history: true },
    { k: 'Flat-load rank of 111 (1 = most 24/7 growth)', a: A?.detection?.rank, b: B?.detection?.rank, fmt: rank, good: null, d: 'places' },
    { k: 'Demand growth since 2019', a: A?.detection?.growth_pct, b: B?.detection?.growth_pct, fmt: pctG, good: null, d: 'pts' },
    { k: 'Its own demand at night, 2025', a: dem(aId), b: dem(bId), fmt: mw0, good: null, d: 'mw' },
    { k: `Of ${load.toLocaleString('en-US')} MW, run on non-carbon-free generation at night`, a: fossil(A), b: fossil(B), fmt: mw0, good: 'low', d: 'mw', hero: true },
  ]

  const deltaText = row => {
    if (suspect(row)) return DASH
    if (!isNum(row.a) || !isNum(row.b)) return DASH
    const d = row.a - row.b
    const sign = d > 0 ? '+' : d < 0 ? '−' : ''
    const m = Math.abs(d)
    if (row.d === 'pts') return `${sign}${(row.fmt === pctG ? m : m * 100).toFixed(1)} pts`
    if (row.d === 'ptsyr') return `${sign}${(m * 100).toFixed(2)} pts/yr`
    if (row.d === 'x') return `${sign}${m.toFixed(2)}×`
    if (row.d === 'mw') return `${sign}${Math.round(m).toLocaleString('en-US')} MW`
    return `${sign}${Math.round(m)}`
  }
  const deltaTone = row => {
    if (suspect(row) || !isNum(row.a) || !isNum(row.b) || !row.good || row.a === row.b) return ''
    const aBetter = row.good === 'high' ? row.a > row.b : row.a < row.b
    return aBetter ? 'pos' : 'neg'
  }

  const nA = night(A), nB = night(B)
  const gap = isNum(nA) && isNum(nB) ? Math.abs(nA - nB) : null
  const cleaner = isNum(nA) && isNum(nB) ? (nA > nB ? A : nA < nB ? B : null) : null
  const fossilGap = isNum(fossil(A)) && isNum(fossil(B)) ? Math.abs(fossil(A) - fossil(B)) : null
  const zones = [A, B].filter(r => r?.cf_inherited_from_ba)

  return (
    <div>
      <p className="note">Pick any two of the {regions.length} scored regions. Everything below is read from the same export for both, so the third column is arithmetic.</p>
      <div className="wx-h2h">
        <label className="wx-group"><span className="wx-k">left</span>
          <select className="field" value={aId} onChange={e => setA(e.target.value)} aria-label="First region">
            {sorted.map(r => <option key={r.id} value={r.id}>{labelOf(r)}</option>)}
          </select>
        </label>
        <button type="button" className="btn wx-swap" onClick={() => { setA(bId); setB(aId) }} aria-label="Swap the two regions" title="Swap">&#8646;</button>
        <label className="wx-group"><span className="wx-k">right</span>
          <select className="field" value={bId} onChange={e => setB(e.target.value)} aria-label="Second region">
            {sorted.map(r => <option key={r.id} value={r.id}>{labelOf(r)}</option>)}
          </select>
        </label>
      </div>

      {aId === bId ? (
        <p className="wx-none">That is the same region on both sides. Pick a second one and the difference appears here.</p>
      ) : (
        <>
          <table className="wx-delta">
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col">{labelOf(A)}</th>
                <th scope="col">{labelOf(B)}</th>
                <th scope="col">left &minus; right</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(row => (
                <tr key={row.k} className={row.hero ? 'hero' : ''}>
                  <td>{row.k}</td>
                  <td className={`a ${row.history && cavA ? 'warn' : ''}`} title={row.history && cavA ? cavA : undefined}>{isNum(row.a) ? row.fmt(row.a) : DASH}</td>
                  <td className={`b ${row.history && cavB ? 'warn' : ''}`} title={row.history && cavB ? cavB : undefined}>{isNum(row.b) ? row.fmt(row.b) : DASH}</td>
                  <td className={`d ${deltaTone(row)}`} title={suspect(row) ? 'Withheld: one side’s published history is corrected, so the two are not measured on the same basis.' : undefined}>{deltaText(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="note" style={{ marginTop: 12, color: 'var(--ink-2)' }}>
            {cleaner
              ? <><b style={{ color: 'var(--ink)' }}>{labelOf(cleaner)}</b> runs {(gap * 100).toFixed(1)} points cleaner at night on the 2025 mix. Siting {load.toLocaleString('en-US')} MW there instead takes <b style={{ color: 'var(--ink)' }}>{Math.round(fossilGap).toLocaleString('en-US')} MW</b> of that load off generation that is not carbon-free, in every night hour of the year.</>
              : isNum(nA) && isNum(nB) ? 'The two run on the same clean share at night, so the choice between them turns on the other rows.' : 'One of these regions has no published clean share at night, so the night comparison cannot be made.'}
            {' '}Cyan marks the row where the left-hand grid is the better of the two for a flat load; ember, the worse.
          </p>
          {(cavA || cavB) && (
            <div className="banner" style={{ marginTop: 10 }}>
              <b>{[cavA && labelOf(A), cavB && labelOf(B)].filter(Boolean).join(' and ')}</b>: {cavA || cavB} The rows measured against 2019 are shown in amber and their difference is withheld, because the two sides are not on the same basis. The 2025 level, and the megawatts derived from it, stand.
            </div>
          )}
          {zones.length > 0 && (
            <p className="note" style={{ marginTop: 8 }}>
              {zones.map(z => labelOf(z)).join(' and ')} {zones.length === 1 ? 'reports' : 'report'} demand only, so {zones.length === 1 ? 'its' : 'their'} generation figures above are the whole parent grid&rsquo;s, not the zone&rsquo;s.
            </p>
          )}
          <p className="wx-row" style={{ marginTop: 10 }}>
            <a className="chip sm" href={href.region(aId)}>Open {labelOf(A)}</a>
            <a className="chip sm" href={href.region(bId)}>Open {labelOf(B)}</a>
          </p>
        </>
      )}
    </div>
  )
}
