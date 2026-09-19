import { useEffect, useMemo, useState } from 'react'
import '../../styles/relocate.css'
import { loadRegions } from '../../lib/data.js'
import { resolvePlace, COMPANIES } from '../../lib/query.js'
import { indexRegions, siteShare, companyPhysical, relocate, bestMoves, regionLabel } from '../../lib/relocate.js'
import { pct } from '../../lib/format.js'
import { Chip, Num } from '../../console/widgets.jsx'
import { href } from '../../router.js'

// Move one of a company's sites to another grid and watch its physical figure (the unweighted
// mean clean share of the grids under its sites) and range move. The claim does not move: it is
// accounting, and this is where the power comes from. No chart; two numbers and a sentence.
const shortName = c => COMPANIES.find(x => x.ticker === c?.ticker)?.name || c?.company || c?.ticker || 'the company'
const shortMetro = m => String(m || '').replace(/\s*\([^)]*\)/g, '').split(',')[0].trim() || 'this site'
const pct1 = n => `${n.toFixed(1)}%`
const range = (s, d = 0) => (s?.n ? (s.min === s.max ? pct(s.min, d) : `${pct(s.min, d)}–${pct(s.max, d)}`) : '—')

export default function RelocateModule({ company }) {
  const sites = useMemo(() => (Array.isArray(company?.sites) ? company.sites : []), [company])
  const [regions, setRegions] = useState(null)   // { byId } once loaded, { error } on failure
  const [siteState, setSiteState] = useState(null)
  const [pick, setPick] = useState(null)          // a suggested grid the user clicked
  const [text, setText] = useState('')            // a place the user typed

  useEffect(() => {
    let alive = true
    loadRegions().then(r => alive && setRegions({ byId: indexRegions(r.regions) }), error => alive && setRegions({ error }))
    return () => { alive = false }
  }, [])

  const byId = regions?.byId || null
  const first = useMemo(() => (byId ? bestMoves(sites, byId, 1)[0] || null : null), [sites, byId])
  const siteIndex = siteState != null && siteState < sites.length ? siteState : first?.siteIndex ?? 0
  const site = sites[siteIndex] || null
  const suggested = useMemo(() => (byId ? bestMoves(sites, byId, 3, { siteIndex }) : []), [sites, byId, siteIndex])
  const typed = useMemo(() => (text.trim() ? resolvePlace(text) : null), [text])
  const typedKnown = !!(typed && byId && byId[typed.region_id])
  const dest = pick ?? (typedKnown ? typed.region_id : null) ?? (text.trim() ? null : suggested[0]?.toRegionId ?? first?.toRegionId ?? null)
  const result = useMemo(() => (byId && dest ? relocate(sites, siteIndex, dest, byId) : null), [sites, siteIndex, dest, byId])
  const physical = useMemo(() => (byId ? companyPhysical(sites, byId) : null), [sites, byId])

  if (regions?.error) return <p className="mod-empty">Could not load the grids: {String(regions.error.message || regions.error)}</p>
  if (!byId) return <p className="mod-empty">Loading the grids…</p>
  if (!sites.length || !physical?.n) return <p className="mod-empty">No grid figures for this company's sites.</p>

  const name = shortName(company)
  // The same grid physically: the same region, or a zone and the BA whose generation it reports.
  const same = result && result.moved.fromRegionId != null && String(result.moved.fromRegionId).split('/')[0] === String(result.moved.toRegionId).split('/')[0]
  const dirtier = result && result.after.mean != null && result.before.mean != null && result.after.mean < result.before.mean - 1e-12
  const chooseSite = i => { setSiteState(i); setPick(null); setText('') }
  const chooseGrid = id => { setPick(id); setText('') }

  return (
    <div className="rl-mod">
      <div className="rl-row" role="group" aria-label="Which site to move">
        <span className="rl-k">Move</span>
        {sites.map((s, i) => { const sh = siteShare(s, byId); return <Chip key={i} small active={i === siteIndex} dim={sh == null} onClick={() => chooseSite(i)}><span className="rl-chip" title={`${s.metro || ''}${s.serving_utility ? ` · ${s.serving_utility}` : ''}`}>{shortMetro(s.metro)} <b>{sh == null ? '—' : pct(sh)}</b></span></Chip> })}
      </div>
      <div className="rl-row" role="group" aria-label="Where to move it">
        <span className="rl-k">to</span>
        <input className="rl-input" type="text" value={text} placeholder="a place or a grid: Omaha, Phoenix, N. Virginia…" aria-label="Destination grid" onChange={e => { setText(e.target.value); setPick(null) }} />
        {suggested.map(m => <Chip key={m.toRegionId} small active={dest === m.toRegionId} onClick={() => chooseGrid(m.toRegionId)}><span className="rl-chip">{regionLabel(byId[m.toRegionId], m.toRegionId)} <b>{pct(m.meanAfter)}</b></span></Chip>)}
        {text.trim() && !typed && <span className="rl-hint bad">Not a place the app knows.</span>}
        {text.trim() && typed && !typedKnown && <span className="rl-hint bad">{typed.metro} sits on {typed.region_id}, which is not among the scored grids.</span>}
        {text.trim() && typedKnown && <span className="rl-hint">{typed.metro !== regionLabel(byId[typed.region_id]) ? `${typed.metro} · ` : ''}{regionLabel(byId[typed.region_id])}</span>}
      </div>

      {result ? (
        <>
          <div className="rl-nums">
            <div className="rl-pair">
              <Num value={pct(result.before.mean)} label="physical figure now" sub={`${result.before.n} site${result.before.n === 1 ? '' : 's'}, all hours 2025`} />
              <span className="rl-arrow" aria-hidden="true">→</span>
              <Num num={result.after.mean * 100} format={pct1} label={`with ${shortMetro(site?.metro)} on ${result.moved.to}`} accent={!!dirtier} />
            </div>
            {result.before.n > 1 && (
              <div className="rl-pair">
                <Num value={range(result.before)} label="range across sites" />
                <span className="rl-arrow" aria-hidden="true">→</span>
                <Num value={range(result.after)} label="after the move" accent={!!dirtier} />
              </div>
            )}
          </div>
          <p className={`rl-say${dirtier ? ' accent' : ''}`}>
            {same
              ? <>{name}'s {shortMetro(site?.metro)} already draws from <a href={href.region(result.moved.toRegionId)}>{result.moved.to}</a>. Pick another grid to see the figure move.</>
              : <>If {name}'s {shortMetro(site?.metro)} drew from <a href={href.region(result.moved.toRegionId)}>{result.moved.to}</a> instead, its physical figure would be <b className="after">{pct(result.after.mean, 0)}</b> instead of <b>{pct(result.before.mean, 0)}</b>. The claim would not change; the physics would.</>}
          </p>
        </>
      ) : (
        <p className="rl-say">Type a place, or pick one of the suggestions, to move {name}'s {shortMetro(site?.metro)} and see the figure change.</p>
      )}
      {site?.note && <details className="rl-caveat"><summary>Caveat on this site's grid figure</summary><p>{site.note}</p></details>}
      <p className="mod-foot">Physical figure = unweighted mean of the all-hours 2025 carbon-free share of generation within each site's grid; a zone inherits its parent grid. Generation within the footprint, not consumption; interchange is not allocated. A what-if on the grid only: contracts and the claim are left as they are.</p>
    </div>
  )
}

// Registry entry, same shape as the modules in ./index.js (the integrator registers it on the
// company page). ctx = { company } with the normalised company from lib/data.js loadCompany().
// oxlint-disable-next-line react/only-export-components -- a registry entry, not a component
export const relocateModule = {
  id: 'relocate', title: 'Move one site and watch the physics move',
  applies: ctx => (ctx?.company?.sites || []).length > 0,
  render: ctx => <RelocateModule company={ctx?.company} />,
}
