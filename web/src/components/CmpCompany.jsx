import { useMemo } from 'react'
import { loadCompany, useAsync, useRegionDetails } from '../lib/data.js'
import { caveatFor } from '../lib/findings.js'
import { href } from '../router.js'
import { CmpHero, CmpTable } from './CmpTable.jsx'
import { Loading, ErrorState } from './States.jsx'
import { baOf, fInt, fMw, fPct1, fScore2, isNum, labelOfId, NONE, operatorStats, plural, siteFlag } from '../lib/cmpData.js'

// Two operators, settled against the grids their datacenters actually draw from.
//
// Every figure here is grid-only and unweighted across sites, which is the basis the walk
// score is published on: we do not know each site's load. The share rows are printed with
// the megawatts behind them, and those megawatts count each grid once, so an operator with
// two sites in PJM is not credited with PJM's output twice.

const HOLD = {
  sites_and_claims: 'sites mapped, documents read',
  sites_only: 'sites mapped, no documents read',
  no_site_resolved: 'no site mapped to a grid',
}

const listWords = xs => (xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
// Several grid labels end in a period of their own ("Southern Co."), so the sentence checks
// before adding one rather than printing two.
const dot = s => (/[.!?]$/.test(s) ? s : `${s}.`)

export default function CmpCompany({ aKey, bKey, regionsById, regionsLoading }) {
  const { loading, error, data, reload } = useAsync(async () => {
    const [A, B] = await Promise.all([loadCompany(aKey), loadCompany(bKey)])
    return { A, B }
  }, [aKey, bKey])

  const bas = useMemo(() => {
    if (!data) return []
    return [...new Set([...(data.A.sites || []), ...(data.B.sites || [])].map(s => baOf(s.region_id)))]
  }, [data])
  const details = useRegionDetails(bas)

  if (loading || regionsLoading) return <Loading what="both operators" />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const A = operatorStats(data.A, regionsById, details)
  const B = operatorStats(data.B, regionsById, details)
  const same = aKey === bKey

  const covWords = s => (isNum(s.coverage) && s.nSites ? `${fInt(Math.round(s.coverage * s.nSites))} of ${fInt(s.nSites)}` : NONE)
  const bestWords = s => (s.cleanest ? `${fPct1(s.cleanest.night)} at ${s.cleanest.metro}` : NONE)
  const worstWords = s => (s.dirtiest ? `${fPct1(s.dirtiest.night)} at ${s.dirtiest.metro}` : NONE)
  const equityWords = s => (s.listed ? `listed, ${s.ticker || s.key}` : 'private, no listed equity')
  // Megawatts are summed over parent grids, each counted once, so the tag names that count and
  // not the number of sites or zones, which is larger.
  const gridTag = s => (s.gridsPriced && s.gridsPriced < s.bas.length ? `${s.gridsPriced} of ${s.bas.length} parent grids` : `${plural(s.bas.length, 'parent grid')}`)

  const rows = [
    { k: 'What we hold on it', aText: HOLD[A.coverageStatus] || NONE, bText: HOLD[B.coverageStatus] || NONE, noDiff: true },
    { k: 'Equity', aText: equityWords(A), bText: equityWords(B), noDiff: true },
    { k: 'Datacenter sites mapped to a grid', a: A.nSites, b: B.nSites, fmt: fInt, diff: 'n' },
    { k: 'Sites with grid data behind them', aText: covWords(A), bText: covWords(B), noDiff: true },
    { k: 'Claims read from its own documents', a: A.nClaims, b: B.nClaims, fmt: fInt, diff: 'n' },
    { k: 'Claims Wattson could not verify', a: A.cannotVerify, b: B.cannotVerify, fmt: fInt, diff: 'n' },
    {
      k: 'Talk score', hint: 'how big, how specific and how little hedged its claims are, 0 to 1',
      a: A.talk, b: B.talk, fmt: fScore2, diff: 'n',
      aText: A.talk == null ? 'no claims read' : undefined, bText: B.talk == null ? 'no claims read' : undefined,
      noDiff: A.talk == null || B.talk == null,
    },
    {
      k: 'Walk score', hint: 'clean share of the grids its sites sit on, 2025, all hours, mean across sites',
      a: A.walk, b: B.walk, fmt: fPct1, diff: 'pts', good: 'high', hero: true,
    },
    { k: 'Clean generation in those grids, 2025 average', hint: 'all hours, each grid counted once', a: A.cleanAll, b: B.cleanAll, fmt: fMw, diff: 'mw', aTag: gridTag(A), bTag: gridTag(B) },
    { k: 'All generation in those grids, 2025 average', hint: 'all hours, each grid counted once', a: A.totalAll, b: B.totalAll, fmt: fMw, diff: 'mw', aTag: gridTag(A), bTag: gridTag(B) },
    { k: 'Clean share of those grids at night, mean across sites', a: A.meanNight, b: B.meanNight, fmt: fPct1, diff: 'pts', good: 'high' },
    { k: 'Clean generation in those grids at night, 2025 average', hint: '00:00 to 05:59 local, each grid counted once', a: A.cleanNight, b: B.cleanNight, fmt: fMw, diff: 'mw', aTag: gridTag(A), bTag: gridTag(B), hero: true },
    { k: 'All generation in those grids at night, 2025 average', a: A.totalNight, b: B.totalNight, fmt: fMw, diff: 'mw', aTag: gridTag(A), bTag: gridTag(B) },
    { k: 'Its cleanest site grid at night', aText: bestWords(A), bText: bestWords(B), noDiff: true },
    { k: 'Its least clean site grid at night', aText: worstWords(A), bText: worstWords(B), noDiff: true },
    { k: 'Distinct grids its sites sit in', hint: 'zones counted on their own; the megawatt rows above collapse them to their parents', a: A.grids.length, b: B.grids.length, fmt: fInt, diff: 'n' },
    { k: 'Sites on a grid the detector ranks in the top 20 of 111', hint: 'where flat 24/7 load is landing hardest', a: A.topDetector, b: B.topDetector, fmt: fInt, diff: 'n' },
  ]

  const gap = isNum(A.walk) && isNum(B.walk) ? A.walk - B.walk : null
  const cleaner = gap == null ? null : gap > 0 ? A : gap < 0 ? B : null
  const verdict = same
    ? `Both sides are ${A.name}, so every row is the same figure twice. Pick a second operator and the difference appears in the third column.`
    : cleaner
      ? `${cleaner.name} sits on grids that ran ${Math.abs(gap * 100).toFixed(1)} points cleaner in 2025, across ${plural(cleaner.nSites, 'mapped site')}. Grid-only: power purchase agreements and certificates are excluded on both sides.`
      : isNum(A.walk) && isNum(B.walk)
        ? 'The two sit on grids that ran the same clean share in 2025, so the choice between them turns on the rows below.'
        : `Both are measured the same way: the clean share of the grids their sites sit on, 2025, unweighted across ${plural(A.nSites + B.nSites, 'site')}.`

  const zonesA = A.sites.filter(s => s.cf_inherited_from_ba).length
  const zonesB = B.sites.filter(s => s.cf_inherited_from_ba).length
  const zoneLine = [zonesA > 0 && `${A.name} has ${plural(zonesA, 'site')} in a zone`, zonesB > 0 && (zonesA > 0 ? `${B.name} ${plural(zonesB, 'site')}` : `${B.name} has ${plural(zonesB, 'site')} in a zone`)].filter(Boolean).join(', and ')
  const shared = A.bas.filter(x => B.bas.includes(x))
  const caveats = [...new Set([...A.bas, ...B.bas])].map(id => [id, caveatFor(id)]).filter(([, c]) => c)
  // A site whose mapping carries a flag changes how its column reads, so it is named here
  // rather than left on the company page for someone to find later.
  const flagged = [[A, A.sites], [B, B.sites]].flatMap(([s, list]) => list.filter(x => siteFlag(x.note)).map(x => ({ who: s.name, site: x })))
  const mock = A.isMock || B.isMock

  return (
    <>
      <CmpHero
        a={{ name: A.name, href: href.check(A.key), meta: A.ticker || 'private', value: fPct1(A.walk), label: 'clean share of its site grids, 2025', mw: `${fMw(A.cleanNight)} clean at night across the ${gridTag(A)} behind its sites`, tone: isNum(A.walk) && A.walk >= 0.5 ? 'clean' : 'fossil' }}
        b={{ name: B.name, href: href.check(B.key), meta: B.ticker || 'private', value: fPct1(B.walk), label: 'clean share of its site grids, 2025', mw: `${fMw(B.cleanNight)} clean at night across the ${gridTag(B)} behind its sites`, tone: isNum(B.walk) && B.walk >= 0.5 ? 'clean' : 'fossil' }}
        verdict={verdict}
      />
      {mock && <div className="banner banner-error cmp-banner"><b>Mock claim text.</b> The grid figures on this screen are real; the claim wording on one side is illustrative.</div>}
      <CmpTable rows={rows} aLabel={A.name} bLabel={B.name} />
      <div className="cmp-notes">
        <p><b>{A.name}</b> draws from {dot(listWords(A.grids.map(labelOfId)))} <b>{B.name}</b> draws from {dot(listWords(B.grids.map(labelOfId)))}</p>
        {shared.length > 0 && <p>Both have sites in {listWords(shared)}, so that grid&rsquo;s generation is counted in both columns. It is the same power station fleet on both sides, which is why the megawatt rows can sit close together while the sites are a thousand miles apart.</p>}
        {zoneLine && <p>{zoneLine}. A zone reports demand only, so the generation megawatts above are the parent balancing authority&rsquo;s, each parent counted once.</p>}
        <p>Grid-only. Power purchase agreements and renewable energy certificates are excluded, on both sides. Shares are unweighted across sites because each site&rsquo;s load is not published. Average mix inside each grid&rsquo;s footprint, not marginal emissions and not consumption.</p>
        {flagged.map(({ who, site }) => (
          <p key={`${who}-${site.metro}`} className="cmp-warn"><b>{who}, {site.metro} ({siteFlag(site.note)}):</b> {site.note}</p>
        ))}
        {caveats.map(([id, c]) => (
          <p key={id} className="cmp-warn"><b>{labelOfId(id)}:</b> {c} The 2025 levels above stand; only figures measured against 2019 are affected.</p>
        ))}
      </div>
    </>
  )
}
