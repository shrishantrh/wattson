import { useMemo } from 'react'
import { useRegionDetails } from '../../lib/data.js'
import { caveatFor } from '../../lib/findings.js'
import { companyLadder, regionLadder, gridFacts, fmtRange, fmtPts, biggestDrop } from '../../lib/innovLadder.js'
import '../../styles/innovLadder.css'
import { Mod, Say, Empty, Fold } from './Shell.jsx'

// The accounting ladder: one number, the carbon-free share, read under successively stricter accounting.
// On a company page the rungs run from what it claims (annual, market-based, with the page) through what it
// discloses hourly (its own figure, or an explicit cannot-verify) to what the grids at its mapped sites
// generated, all hours, overnight, and as a share of the generation added at night since 2019. On a region
// page the same without the paper rungs. The sentence is generated from the numbers; the SVG is the ladder.
// Numbers and words come from lib/innovLadder.js (pure, tested); this file only draws.

// One rung is two text lines and then its own full-width bar underneath, so no label can ever
// sit on a mark however long the words or the card get.
const W = 360, ROW = 52, BAR_Y = 35, BAR_H = 9, VAL_X = W, TOP = 2
const VALUE_WORD = { cannot_verify: "can't verify", unreadable: 'not readable', loading: '…', missing: ', ' }
// Rung labels as they are drawn: the lib's wording, shortened to fit one line beside its figure.
const SHORT = { increment: 'added at night since 2019' }
// What changes between two adjacent rungs, for the "biggest step" line.
const STEP_WORDS = {
  'claimed>hourly': 'annual matching gives way to hour-by-hour accounting',
  'claimed>grid_all': 'contracted power stops counting and the physical grid takes over',
  'hourly>grid_all': 'contracted power stops counting',
  'grid_all>grid_night': 'daylight solar drops out',
  'grid_night>increment': 'the six-year average gives way to what was actually added',
  'grid_all>increment': 'the average gives way to what was actually added',
}

function LadderSvg({ rungs, label }) {
  const h = TOP + rungs.length * ROW
  const x = v => Math.min(1, Math.max(0, v ?? 0)) * W
  return (
    <svg className="innov-svg" viewBox={`0 0 ${W} ${h}`} width="100%" preserveAspectRatio="xMinYMin meet" role="img" aria-label={label}>
      {rungs.map((r, i) => {
        const y = TOP + i * ROW, has = r.share != null
        const paper = r.status === 'paper' || r.status === 'disclosed'
        const value = has ? fmtRange(r.lo, r.hi) : VALUE_WORD[r.status] || ', '
        return (
          <g key={r.id}>
            <title>{`${r.label}: ${value} · ${r.basis} · ${r.source}`}</title>
            <text className="lbl" x="0" y={y + 12}>{SHORT[r.id] || r.label}</text>
            <text className="basis" x="0" y={y + 26}>{r.basis}</text>
            <text className={`val${has ? '' : ' dim'}`} x={VAL_X} y={y + 12} textAnchor="end">{value}</text>
            {r.drop != null && <text className={`drop${r.drop < -0.1 ? ' accent' : ''}`} x={VAL_X} y={y + 26} textAnchor="end">{fmtPts(r.drop)}</text>}
            <rect className={`track${has ? '' : ' dashed'}`} x="0.5" y={y + BAR_Y + 0.5} width={W - 1} height={BAR_H - 1} rx="1" />
            {has && <rect className="clean" x="0" y={y + BAR_Y} width={Math.max(1, x(r.lo))} height={BAR_H} />}
            {has && r.hi > r.lo && <rect className="clean range" x={x(r.lo)} y={y + BAR_Y} width={x(r.hi) - x(r.lo)} height={BAR_H} />}
            {has && <rect className={`rest${paper ? ' paper' : ''}`} x={x(r.hi)} y={y + BAR_Y} width={Math.max(0, W - x(r.hi))} height={BAR_H} />}
          </g>
        )
      })}
    </svg>
  )
}

function Ladder({ ladder, aria }) {
  if (!ladder) return <Empty>Nothing measurable to put on the ladder.</Empty>
  const step = biggestDrop(ladder.rungs)
  const c = ladder.counts || {}
  const counted = [c.flagged ? `${c.flagged} flagged` : null, c.corrected ? `${c.corrected} corrected` : null, c.cannot_verify ? `${c.cannot_verify} cannot verify` : null].filter(Boolean)
  const anyPaper = (ladder.rungs || []).some(r => r.status === 'paper' || r.status === 'disclosed')
  const rungWord = r => SHORT[r.id] || r.label
  return (
    <Mod
      className="mod-ladder"
      caption="The same share, read again at each rung under stricter accounting."
      lead={<Say>{ladder.sentence}</Say>}
      foot={<>{counted.length ? <><b>{counted.join(' · ')}</b> on this ladder. </> : null}Grid rungs: EIA-930 via PUDL{anyPaper ? ', paper rungs the company\u2019s own report' : ''}. Generation, not consumption.</>}
    >
      <LadderSvg rungs={ladder.rungs} label={aria} />
      {step && <p className="innov-step">The biggest step is {rungWord(step.from)} to {rungWord(step.to)}: <b>{fmtPts(-step.pts)}</b>{STEP_WORDS[`${step.from.id}>${step.to.id}`] ? `, where ${STEP_WORDS[`${step.from.id}>${step.to.id}`]}` : ''}.</p>}
      <Fold summary="Where each rung comes from">
        <ul className="innov-sources">{ladder.rungs.map(r => <li key={r.id}><span>{rungWord(r)}</span><code>{r.source}</code></li>)}</ul>
      </Fold>
      {(ladder.flags || []).map((f, i) => <p key={i} className="innov-flag">Flagged: {f}</p>)}
    </Mod>
  )
}

function CompanyLadder({ company }) {
  const ids = useMemo(() => [...new Set((company?.sites || []).map(s => s.region_id).filter(Boolean))], [company])
  const details = useRegionDetails(ids)
  const grids = useMemo(() => Object.fromEntries(ids.map(id => [id, details[id] ? gridFacts(details[id], { caveat: caveatFor(id) }) : null]).filter(([, g]) => g)), [ids, details])
  const ladder = useMemo(() => companyLadder(company, { grids }), [company, grids])
  return <Ladder ladder={ladder} aria={`${company?.company || company?.ticker}: carbon-free share under stricter accounting, from the claim down to the grid`} />
}

function RegionLadder({ detail, region_id, load_mw }) {
  const ladder = useMemo(() => regionLadder(detail, { label: detail?.c?.label, caveat: caveatFor(region_id || detail?.id), load_mw: Number(load_mw) || 300 }), [detail, region_id, load_mw])
  return <Ladder ladder={ladder} aria={`${detail?.c?.label || detail?.name || region_id}: carbon-free share, average, overnight and increment`} />
}

// ctx on a company page is { company }; on a region page { detail, region_id, load_mw? }.
export default function InnovLadderView({ company, detail, region_id, load_mw }) {
  return company ? <CompanyLadder company={company} /> : <RegionLadder detail={detail} region_id={region_id} load_mw={load_mw} />
}

// Registry entry, same shape as the modules in ./index.js (the integrator registers it there and, on the
// company page, in Check.jsx's modules array). applies() is false when there is nothing measurable:
// no fraction claim or no mapped site for a company, no 2025 clean share for a region.
// oxlint-disable-next-line react/only-export-components -- a registry entry, not a component
export const innovLadderModule = {
  id: 'ladder', title: 'Under stricter accounting',
  applies: ctx => (ctx?.company ? !!companyLadder(ctx.company) : !!regionLadder(ctx?.detail)),
  render: ctx => <InnovLadderView company={ctx?.company} detail={ctx?.detail} region_id={ctx?.region_id} load_mw={ctx?.load_mw} />,
}
