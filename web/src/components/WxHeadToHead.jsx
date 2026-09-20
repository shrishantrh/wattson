import { useMemo, useState } from 'react'
import { useRegionDetails } from '../lib/data.js'
import { caveatFor } from '../lib/findings.js'
import { href } from '../router.js'
import { CmpHero, CmpTable } from './CmpTable.jsx'
import CmpPicker from './CmpPicker.jsx'
import { baOf, fGrowth, fMw, fPct1, fPts, fPtsYr, fRank, fTimes, isNum, mwAt, placeOfId, regionName } from '../lib/cmpData.js'
import '../styles/wx.css'
import '../styles/compare.css'

// Any two of the scored grids, side by side, with the difference spelled out.
//
// The ranked list on the compare page answers "of the places I named, which is cleanest".
// This answers the other question a site selector actually asks: "how much worse is the site
// I already have than the one I am being sold". Both columns are read off the same export,
// so the third column is arithmetic, not a judgement.
//
// Every share row is printed with the megawatts behind it. A share falling is not clean
// generation shrinking: PJM's clean output at night held within 100 MW while its share slid,
// because everything around it grew. The share alone would have said the opposite.
//
// A zone reports demand only and inherits its parent authority's generation, so each
// generation figure carries the id of the grid it actually describes, and the demand row
// carries the zone's own.

export default function WxHeadToHead({ regions = [], mw = 300, initial = [], value, onChange, chrome = true }) {
  const sorted = useMemo(() => [...regions].sort((x, y) => regionName(x).localeCompare(regionName(y))), [regions])
  const [own, setOwn] = useState(() => [
    initial[0] || sorted[0]?.id || '',
    initial[1] || sorted.find(r => r.id !== (initial[0] || sorted[0]?.id))?.id || '',
  ])
  const pair = value && value[0] ? value : own
  const set = next => { if (onChange) onChange(next); else setOwn(next) }
  const [aId, bId] = pair
  const ids = useMemo(() => [...new Set([aId, bId, baOf(aId), baOf(bId)].filter(Boolean))], [aId, bId])
  const details = useRegionDetails(ids)
  const items = useMemo(() => sorted.map(r => ({ id: r.id, label: regionName(r), sub: placeOfId(r.id) || r.ba_name || r.name, keywords: `${r.id} ${regionName(r)} ${placeOfId(r.id)} ${r.name} ${r.ba_name}` })), [sorted])

  if (!sorted.length) return null

  const load = Number(mw) || 300
  const side = id => {
    const r = sorted.find(x => x.id === id) || null
    const ba = baOf(id)
    const night = r?.siting?.overnight_cf_share_2025 ?? r?.cf_share_2025?.overnight ?? null
    return {
      id, r, ba, night,
      name: r ? regionName(r) : id,
      isZone: !!r && (r.cf_inherited_from_ba || id !== ba),
      gen: mwAt(details[ba]),
      own: mwAt(details[id]),
      allHours: r?.cf_share_2025?.all ?? null,
      fossil: isNum(night) ? load * (1 - night) : null,
    }
  }
  const a = side(aId), b = side(bId)
  const same = aId === bId

  // A grid whose published history the engine has corrected (Phoenix counted a plant SRP also
  // reported) carries a caveat. Its 2025 level is sound; anything measured against 2019 is not
  // on the same basis as the other column, so those differences are withheld rather than printed.
  const cavA = caveatFor(aId), cavB = caveatFor(bId)
  const suspect = !!(cavA || cavB)
  // Every clean-power figure a zone carries is its parent authority's, and so is its siting
  // score. Two regions inside one authority therefore agree on all of them by construction,
  // and a "0.0 pts" difference there would read as a finding when it is a definition. Those
  // differences are withheld and the reason is said above the table, not buried under it.
  const sameGrid = same || a.ba === b.ba
  const byDef = 'Both sit inside one balancing authority, which reports this figure for both. The difference is zero by construction, not by measurement.'

  const rows = [
    { k: 'Clean at night, 2025', hint: '00:00 to 05:59 local', a: a.night, b: b.night, fmt: fPct1, diff: 'pts', good: 'high', hero: true, noDiff: sameGrid, noDiffWhy: byDef },
    { k: 'Clean generation at night, 2025 average', a: a.gen.cleanNight, b: b.gen.cleanNight, fmt: fMw, diff: 'mw', aTag: a.ba, bTag: b.ba, noDiff: sameGrid, noDiffWhy: byDef },
    { k: 'All generation at night, 2025 average', a: a.gen.totalNight, b: b.gen.totalNight, fmt: fMw, diff: 'mw', aTag: a.ba, bTag: b.ba, noDiff: sameGrid, noDiffWhy: byDef },
    { k: 'Clean share, 2025, all hours', a: a.allHours, b: b.allHours, fmt: fPct1, diff: 'pts', good: 'high', noDiff: sameGrid, noDiffWhy: byDef },
    { k: 'Clean generation, 2025 average, all hours', a: a.gen.cleanAll, b: b.gen.cleanAll, fmt: fMw, diff: 'mw', aTag: a.ba, bTag: b.ba, noDiff: sameGrid, noDiffWhy: byDef },
    { k: 'All generation, 2025 average, all hours', a: a.gen.totalAll, b: b.gen.totalAll, fmt: fMw, diff: 'mw', aTag: a.ba, bTag: b.ba, noDiff: sameGrid, noDiffWhy: byDef },
    { k: 'Change in clean at night since 2019', a: a.r?.siting?.change_since_2019, b: b.r?.siting?.change_since_2019, fmt: fPts, diff: 'pts', good: 'high', noDiff: sameGrid || suspect, aWarn: !!cavA, bWarn: !!cavB, aTitle: cavA || undefined, bTitle: cavB || undefined, noDiffWhy: suspect ? 'One side’s published history is corrected, so the two are not on the same basis.' : byDef },
    { k: 'Trend per year, clean power against night demand', a: a.r?.siting?.ratio_slope_per_year, b: b.r?.siting?.ratio_slope_per_year, fmt: fPtsYr, diff: 'ptsyr', good: 'high', noDiff: sameGrid || suspect, aWarn: !!cavA, bWarn: !!cavB, noDiffWhy: suspect ? 'One side’s published history is corrected, so the two are not on the same basis.' : byDef },
    { k: 'Clean power against its own night demand', a: a.r?.siting?.overnight_clean_mw_over_demand, b: b.r?.siting?.overnight_clean_mw_over_demand, fmt: fTimes, diff: 'x', good: 'high', noDiff: sameGrid, noDiffWhy: byDef },
    { k: 'Siting rank, 1 is best', a: a.r?.siting?.siting_rank, b: b.r?.siting?.siting_rank, fmt: fRank, diff: 'places', good: 'low', noDiff: sameGrid, noDiffWhy: byDef },
    { k: 'Flat-load rank of 111', hint: '1 is where 24/7 load is landing hardest', a: a.r?.detection?.rank, b: b.r?.detection?.rank, fmt: fRank, diff: 'places', noDiff: same },
    { k: 'Demand growth since 2019', a: a.r?.detection?.growth_pct, b: b.r?.detection?.growth_pct, fmt: fGrowth, diff: 'pct', noDiff: same },
    { k: 'Its own demand at night, 2025 average', hint: 'the region’s own meter, never the parent’s', a: a.own.demandNight, b: b.own.demandNight, fmt: fMw, diff: 'mw', aTag: a.id, bTag: b.id, noDiff: same },
    { k: `Of ${fMw(load)} of flat load, run at night on generation that is not carbon-free`, a: a.fossil, b: b.fossil, fmt: fMw, diff: 'mw', good: 'low', hero: true, noDiff: sameGrid, noDiffWhy: byDef },
  ]

  const gap = isNum(a.night) && isNum(b.night) ? a.night - b.night : null
  const cleaner = gap == null || gap === 0 ? null : gap > 0 ? a : b
  const verdict = same
    ? `Both sides are ${a.name}, so every row is the same figure twice. Pick a second grid and the difference appears in the third column.`
    : sameGrid
      ? `${a.name} and ${b.name} both sit inside ${a.ba}, which reports the generation for both of them. Every clean-power row here is the same figure twice by construction. What differs is the demand each one meters, how fast that grew, and where the detector ranks it.`
      : cleaner
      ? `${cleaner.name} runs ${Math.abs(gap * 100).toFixed(1)} points cleaner at night on the 2025 mix. Siting ${fMw(load)} there instead takes ${fMw(Math.abs(a.fossil - b.fossil))} of that load off generation that is not carbon-free, in every night hour of the year.`
      : isNum(a.night) && isNum(b.night)
        ? 'The two run on the same clean share at night, so the choice between them turns on the rows below.'
        : 'Both columns are read off the same export, so the third column is arithmetic.'

  const zones = [a, b].filter(s => s.isZone)

  return (
    <div className="cmp-h2h">
      {chrome && (
        <div className="cmp-sides">
          <CmpPicker side="left" label="left" items={items} value={aId} onChange={id => set([id, bId])} disabledId={bId} />
          <button type="button" className="cmp-swap" onClick={() => set([bId, aId])} aria-label="Swap the two grids" title="Swap sides">&#8646;</button>
          <CmpPicker side="right" label="right" items={items} value={bId} onChange={id => set([aId, id])} disabledId={aId} />
        </div>
      )}

      <CmpHero
        a={{ name: a.name, href: href.region(aId), meta: aId, value: fPct1(a.night), label: 'clean at night, 2025', mw: `${fMw(a.gen.cleanNight)} clean of ${fMw(a.gen.totalNight)} at night in ${a.ba}`, tone: isNum(a.night) && a.night >= 0.5 ? 'clean' : 'fossil' }}
        b={{ name: b.name, href: href.region(bId), meta: bId, value: fPct1(b.night), label: 'clean at night, 2025', mw: `${fMw(b.gen.cleanNight)} clean of ${fMw(b.gen.totalNight)} at night in ${b.ba}`, tone: isNum(b.night) && b.night >= 0.5 ? 'clean' : 'fossil' }}
        verdict={verdict}
      />
      <CmpTable rows={rows} aLabel={a.name} bLabel={b.name} />
      <div className="cmp-notes">
        <p>Cyan marks a row where the left-hand grid is the better of the two for a flat load, ember where it is worse. A row with no direction, such as which grid grew faster, is left uncolored.</p>
        {sameGrid && !same && (
          <p>Both grids sit inside {a.ba}, so the generation rows are the same figure twice by construction. What differs is the demand each one meters and where it ranks.</p>
        )}
        {zones.length > 0 && (
          <p>
            {zones.map(z => `${z.name} (${z.id})`).join(' and ')} {zones.length === 1 ? 'reports' : 'report'} demand only, so the generation rows above carry the parent authority&rsquo;s name
            {' '}({[...new Set(zones.map(z => z.ba))].join(', ')}), and the demand row carries the zone&rsquo;s own.
          </p>
        )}
        <p>Average mix inside each grid&rsquo;s footprint, not marginal emissions and not consumption: imports are not allocated.</p>
        {(cavA || cavB) && (
          <p className="cmp-warn">
            <b>{[cavA && a.name, cavB && b.name].filter(Boolean).join(' and ')}:</b> {cavA || cavB} Rows measured against 2019 are marked in amber and their difference is withheld. The 2025 level, and the megawatts derived from it, stand.
          </p>
        )}
        <p className="cmp-links">
          <a className="chip sm" href={href.region(aId)}>Open {a.name}</a>
          <a className="chip sm" href={href.region(bId)}>Open {b.name}</a>
        </p>
      </div>
    </div>
  )
}
