import { useMemo } from 'react'
import { useRegionDetails } from '../lib/data.js'
import { caveatFor } from '../lib/findings.js'
import { href } from '../router.js'
import { CmpHero, CmpTable } from './CmpTable.jsx'
import { baOf, fGrowth, fMw, fPct1, fRank, isNum, labelOfId, mwAt, NONE, siteFlag, siteId, siteName } from '../lib/cmpData.js'

// Two individual datacenters: who runs them, which utility serves them, and what the grid
// underneath each one actually generated.
//
// The grid rows come from the balancing authority the site sits in, so two sites in the same
// authority carry identical grid figures by construction. That is said on the screen rather
// than left to read as a coincidence. Where the site sits in a zone, the zone reports demand
// only and the generation rows are its parent authority's, tagged with the parent's name.

export default function CmpSite({ aId, bId, facilities, regionsById, mw = 300, idOf = siteId }) {
  const A = facilities.find(f => idOf(f) === aId) || null
  const B = facilities.find(f => idOf(f) === bId) || null
  const ids = useMemo(() => [...new Set([A?.region_id, B?.region_id, A && baOf(A.region_id), B && baOf(B.region_id)].filter(Boolean))], [A, B])
  const details = useRegionDetails(ids)

  if (!A || !B) return <p className="cmp-empty">Pick a datacenter on each side. Type an operator, a city, a state, a utility or a grid id to find one.</p>

  const load = Number(mw) || 300
  const side = f => {
    const r = regionsById[f.region_id] || null
    const ba = baOf(f.region_id)
    const gen = mwAt(details[ba])              // generation always belongs to the balancing authority
    const own = mwAt(details[f.region_id])     // demand belongs to the region named on the row
    return {
      f, r, ba, gen, own,
      night: r?.cf_share_2025?.overnight ?? null,
      allHours: r?.cf_share_2025?.all ?? f.cf_share_2025 ?? null,
      isZone: f.region_id !== ba,
      fossil: isNum(r?.cf_share_2025?.overnight) ? load * (1 - r.cf_share_2025.overnight) : null,
    }
  }
  const a = side(A), b = side(B)
  const sameRegion = A.region_id === B.region_id
  const sameBa = a.ba === b.ba
  // A zone inherits its parent authority's generation and its siting score, so two sites in
  // one authority agree on every clean-power row by definition. A zero printed there would
  // read as a finding, so it is withheld and the reason is given above the table.
  const byDef = 'Both sites draw from one balancing authority, which reports this figure for both. The difference is zero by construction, not by measurement.'

  const gridWords = s => `${labelOfId(s.f.region_id)}${s.isZone ? `, a zone of ${s.ba}` : ''}`
  const opWords = f => `${f.company || f.operator_key}${f.ticker ? `, ${f.ticker}` : ', private'}`
  const genTag = s => s.ba
  const rows = [
    { k: 'Operator', aText: <a href={href.check(A.operator_key)}>{opWords(A)}</a>, bText: <a href={href.check(B.operator_key)}>{opWords(B)}</a>, noDiff: true },
    { k: 'Where it is', aText: siteName(A), bText: siteName(B), noDiff: true },
    { k: 'Utility that serves it', aText: A.serving_utility || 'utility not resolved', bText: B.serving_utility || 'utility not resolved', noDiff: true },
    { k: 'That utility’s parent', aText: A.utility_parent || NONE, bText: B.utility_parent || NONE, noDiff: true },
    { k: 'Parent ticker', hint: 'hand-mapped, and unverified for some', aText: A.utility_ticker || 'not listed', bText: B.utility_ticker || 'not listed', noDiff: true },
    { k: 'Grid it draws from', aText: <a href={href.region(A.region_id)}>{gridWords(a)}</a>, bText: <a href={href.region(B.region_id)}>{gridWords(b)}</a>, noDiff: true },
    { k: 'Clean share of that grid, 2025, all hours', a: a.allHours, b: b.allHours, fmt: fPct1, diff: 'pts', good: 'high', noDiff: sameBa, noDiffWhy: byDef },
    { k: 'Clean generation in that grid, 2025 average', hint: 'all hours', a: a.gen.cleanAll, b: b.gen.cleanAll, fmt: fMw, diff: 'mw', aTag: genTag(a), bTag: genTag(b), noDiff: sameBa },
    { k: 'All generation in that grid, 2025 average', hint: 'all hours', a: a.gen.totalAll, b: b.gen.totalAll, fmt: fMw, diff: 'mw', aTag: genTag(a), bTag: genTag(b), noDiff: sameBa },
    { k: 'Clean share of that grid at night, 2025', hint: '00:00 to 05:59 local', a: a.night, b: b.night, fmt: fPct1, diff: 'pts', good: 'high', hero: true, noDiff: sameBa, noDiffWhy: byDef },
    { k: 'Clean generation in that grid at night, 2025 average', a: a.gen.cleanNight, b: b.gen.cleanNight, fmt: fMw, diff: 'mw', aTag: genTag(a), bTag: genTag(b), noDiff: sameBa },
    { k: 'All generation in that grid at night, 2025 average', a: a.gen.totalNight, b: b.gen.totalNight, fmt: fMw, diff: 'mw', aTag: genTag(a), bTag: genTag(b), noDiff: sameBa },
    { k: 'Demand where the site sits, at night, 2025 average', hint: 'the region’s own meter, never the parent’s', a: a.own.demandNight, b: b.own.demandNight, fmt: fMw, diff: 'mw', aTag: A.region_id, bTag: B.region_id, noDiff: sameRegion },
    { k: 'Flat-load rank of 111', hint: '1 is the grid where 24/7 load is landing hardest', a: a.r?.detection?.rank ?? A.detector_rank, b: b.r?.detection?.rank ?? B.detector_rank, fmt: fRank, diff: 'places', noDiff: sameRegion },
    { k: 'Demand growth since 2019', a: a.r?.detection?.growth_pct ?? A.growth_pct, b: b.r?.detection?.growth_pct ?? B.growth_pct, fmt: fGrowth, diff: 'pct', noDiff: sameRegion },
    { k: 'Siting rank, 1 is best', a: a.r?.siting?.siting_rank, b: b.r?.siting?.siting_rank, fmt: fRank, diff: 'places', good: 'low', noDiff: sameBa, noDiffWhy: byDef },
    { k: 'What the demand shape looks like', hint: 'descriptive, never part of any score', aText: a.r?.detection?.pattern || NONE, bText: b.r?.detection?.pattern || NONE, noDiff: true },
    { k: `Of ${fMw(load)} of flat load, run at night on generation that is not carbon-free`, a: a.fossil, b: b.fossil, fmt: fMw, diff: 'mw', good: 'low', hero: true, noDiff: sameBa, noDiffWhy: byDef },
  ]

  const gap = isNum(a.night) && isNum(b.night) ? a.night - b.night : null
  const cleaner = gap == null || gap === 0 ? null : gap > 0 ? a : b
  const verdict = sameRegion
    ? `Both sites sit in ${labelOfId(A.region_id)}. Every grid row is the same figure twice, by construction: the two datacenters draw from one balancing authority, so the comparison here is the operator and the utility, not the power.`
    : sameBa
      ? `Both sites sit inside ${a.ba}, in different zones. A zone reports demand only and inherits ${a.ba}'s generation, so the generation rows are identical by construction; the demand rows are each zone's own.`
      : cleaner
        ? `${siteName(cleaner.f)} sits on a grid that ran ${Math.abs(gap * 100).toFixed(1)} points cleaner at night in 2025. At ${fMw(load)} of flat load, that is ${fMw(Math.abs(a.fossil - b.fossil))} less drawn from generation that is not carbon-free, in every night hour of the year.`
        : 'The two grids ran the same clean share at night in 2025, so the choice between these sites turns on the rows below.'

  const caveats = [...new Set([a.ba, b.ba, A.region_id, B.region_id])].map(id => [id, caveatFor(id)]).filter(([, c]) => c)
  const flagged = [A, B].filter(f => siteFlag(f.note))

  return (
    <>
      <CmpHero
        a={{ name: siteName(A), href: href.region(A.region_id), meta: `${A.company || A.operator_key} · ${labelOfId(A.region_id)}`, value: fPct1(a.night), label: 'clean at night on the grid it draws from, 2025', mw: `${fMw(a.gen.cleanNight)} clean of ${fMw(a.gen.totalNight)} at night in ${a.ba}`, tone: isNum(a.night) && a.night >= 0.5 ? 'clean' : 'fossil' }}
        b={{ name: siteName(B), href: href.region(B.region_id), meta: `${B.company || B.operator_key} · ${labelOfId(B.region_id)}`, value: fPct1(b.night), label: 'clean at night on the grid it draws from, 2025', mw: `${fMw(b.gen.cleanNight)} clean of ${fMw(b.gen.totalNight)} at night in ${b.ba}`, tone: isNum(b.night) && b.night >= 0.5 ? 'clean' : 'fossil' }}
        verdict={verdict}
      />
      <CmpTable rows={rows} aLabel={siteName(A)} bLabel={siteName(B)} />
      <div className="cmp-notes">
        {(a.isZone || b.isZone) && (
          <p>
            {[a.isZone && `${siteName(A)} sits in ${A.region_id}`, b.isZone && `${siteName(B)} sits in ${B.region_id}`].filter(Boolean).join(', and ')}. A zone reports demand only, so the generation rows above carry the parent balancing authority&rsquo;s name and the demand row carries the zone&rsquo;s.
          </p>
        )}
        <p>Sites are located through the utility that serves them, hand-curated from filings and company disclosures, never inferred from the state. Generation is measured inside each grid&rsquo;s footprint, not consumption: imports are not allocated, and on-site generation that never reaches the meter is outside this data.</p>
        {flagged.map(f => <p key={f.metro} className="cmp-warn"><b>{siteName(f)}:</b> {f.note}</p>)}
        {caveats.map(([id, c]) => <p key={id} className="cmp-warn"><b>{labelOfId(id)}:</b> {c} The 2025 levels above stand; only figures measured against 2019 are affected.</p>)}
      </div>
    </>
  )
}
