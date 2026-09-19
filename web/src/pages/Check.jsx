import { useMemo } from 'react'
import Shell, { fitView } from '../console/Console.jsx'
import { Card, Num, Evidence, Chip, KV, Ticks } from '../console/widgets.jsx'
import Workspace from '../components/Workspace.jsx'
import Sparkline from '../components/Sparkline.jsx'
import { CopyButton } from '../components/CopyButton.jsx'
import { loadCompany, useAsync, useRegionDetails, nightSeries } from '../lib/data.js'
import { readTokens } from '../lib/tokens.js'
import { checkAnswer, pct0, caveatFor } from '../lib/findings.js'
import { COMPANIES } from '../lib/query.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { href } from '../router.js'
import ingest from '../data/ingest_status.json'
import SideBySideModule, { sideBySideOf } from '../components/modules/SideBySideModule.jsx'
import { relocateModule } from '../components/modules/RelocateModule.jsx'
import { innovLadderModule } from '../components/modules/InnovLadderModule.jsx'

// A grid that generates far less than it uses is mostly imports; its footprint share is not what the site consumes.
const importerNote = d => { const g = d && d.type === 'zone' && d.parent ? d.parent : d; const gen = g?.total_avg_mw?.['2025']?.all, dem = d?.demand?.['2025']?.avg_mw; return gen && dem && gen / dem < 0.5 ? `generates ${Math.round(gen / dem * 100)}% of what it uses, the rest is imported` : null }

const VERDICT = { true_on_paper: 'true on paper', contradicted: 'contradicted', unfalsifiable: 'too vague to check', cannot_verify: "can't verify" }
const PATTERN = { hidden_tradeoff: 'hidden trade-off: a true number that hides the cost next to it', vague_wording: 'vague wording: nothing measurable', no_proof: 'no proof offered', irrelevant: 'irrelevant to the impact', lesser_of_two_evils: 'lesser of two evils', worshiping_false_labels: 'a label that sounds like a standard', fibbing: 'contradicted by its own filing' }
// Claimed vs physical, drawn: a full-width claimed bar and the physical range under it.
function GapBar({ claim }) {
  if (claim.magnitude == null || claim.unit !== 'fraction' || claim.physical_min == null) return null
  const c = Math.min(1, claim.magnitude), lo = claim.physical_min, hi = claim.physical_max ?? claim.physical_min
  return (
    <div className="gapbar" aria-label={`claimed ${Math.round(c * 100)}%, physically ${Math.round(lo * 100)} to ${Math.round(hi * 100)}%`}>
      <div className="gapbar-row"><span className="gapbar-l">claims</span><span className="gapbar-t"><i style={{ width: `${c * 100}%`, background: 'var(--ink-2)' }} /></span><span className="gapbar-v">{Math.round(c * 100)}%</span></div>
      <div className="gapbar-row"><span className="gapbar-l">its grids</span><span className="gapbar-t"><i style={{ left: `${lo * 100}%`, width: `${Math.max(1.5, (hi - lo) * 100)}%`, background: 'var(--accent)' }} /></span><span className="gapbar-v accent">{Math.round(lo * 100) === Math.round(hi * 100) ? `${Math.round(lo * 100)}%` : `${Math.round(lo * 100)}–${Math.round(hi * 100)}%`}</span></div>
    </div>
  )
}
const REASON = { no_falsifiable_content: 'nothing measurable in the claim', no_site_mapping: 'no site could be mapped to a grid', ba_out_of_coverage: 'its grid is outside our coverage', year_out_of_range: 'the year is outside the data' }
const pctFmt = n => `${Math.round(n)}%`

// Question 1: "This company says it's clean. What's actually powering its sites?"
export default function Check({ route }) {
  const ticker = route.ticker
  const evidence = route.params?.evidence === '1'
  const { loading, error, data, reload } = useAsync(() => loadCompany(ticker), [ticker])
  const tk = useMemo(readTokens, [])
  const known = COMPANIES.find(c => c.ticker === ticker)
  const sites = data?.sites || []
  const details = useRegionDetails(evidence ? sites.map(s => s.region_id) : [])
  const bySite = useMemo(() => Object.fromEntries((data?.claims || []).flatMap(k => (k.evidence || []).filter(e => e.type === 'grid').map(e => [e.ba, e]))), [data])
  const globe = useMemo(() => {
    const pts = sites.filter(s => s.lat != null)
    return { view: fitView(pts), points: pts.map(s => ({ id: s.metro, lat: s.lat, lng: s.lng, r: 0.2, color: tk.accent })), rings: pts.map(s => ({ id: s.metro, lat: s.lat, lng: s.lng, color: tk.accent, maxR: 2, speed: 0.6, period: 1800 })),
      markers: pts.map(s => { const e = bySite[s.ba]; return { id: s.metro, lat: s.lat, lng: s.lng, label: `${s.metro.split(',')[0]}${e?.cf_share != null ? ` · ${pct0(e.cf_share)} clean` : ''}`, tip: `${s.metro} · ${s.serving_utility || 'utility unknown'} · ${s.grid_label}`, href: href.region(s.region_id), color: tk.accent } }) }
  }, [sites, bySite, tk])
  const back = () => { window.location.hash = href.landing() }
  const toggle = () => { window.location.hash = href.check(ticker, !evidence) }

  let column
  if (loading) column = <Card title={<b>{known?.name || ticker}</b>} onClose={back}><Loading what={known?.name || ticker} /></Card>
  else if (error) {
    const others = COMPANIES.filter(c => (error.available || []).includes(c.ticker))
    column = (
      <Card title={<b>{known?.name || ticker}</b>} onClose={back}>
        {error.name === 'NotFound' ? (
          <>
            <h1 className="verdict">{known ? `${known.name} isn't verified yet.` : `We don't have ${ticker}.`}</h1>
            {known && ingest.companies?.[known.ticker] && <p className="note" style={{ marginTop: 10 }}>Read so far: {ingest.companies[known.ticker].documents.map(d => `${d.kind.toUpperCase()} ${d.pages} pages`).join(', ')} · {ingest.companies[known.ticker].chunks} passages · claim extraction {ingest.companies[known.ticker].extracted ? 'done' : 'pending'}.</p>}
            <p className="note" style={{ marginTop: 10 }}>{others.length ? <>Verified so far: {others.map(c => <Chip key={c.ticker} small href={href.check(c.ticker)}>{c.name}</Chip>)}</> : 'No company has been verified yet.'}</p>
          </>
        ) : <ErrorState error={error} onRetry={reload} />}
      </Card>
    )
  } else {
    const a = checkAnswer(data)
    const modules = [
      ...(sideBySideOf(data).length ? [{ id: 'sbs', title: 'Says, and discloses, in the same report', render: () => <SideBySideModule company={data} /> }] : []),
      ...(innovLadderModule.applies({ company: data }) ? [{ id: innovLadderModule.id, title: innovLadderModule.title, render: () => innovLadderModule.render({ company: data }) }] : []),
      { id: 'sites', title: 'Where its sites draw power', render: () => (
        <>
          <div className="rows">
            {sites.map(s => { const e = bySite[s.ba]; const cav = caveatFor(s.region_id); const series = nightSeries(details[s.region_id]); return (
              <a className="row" key={s.metro} href={href.region(s.region_id)}>
                <div><div className="t">{s.metro}</div><div className="d">{s.serving_utility || 'utility unknown'} · {s.grid_label}{s.source_type ? ` · ${s.source_type.replace(/_/g, ' ')}` : ''}{cav ? ' · history corrected' : ''}{importerNote(details[s.region_id]) ? ` · ${importerNote(details[s.region_id])}` : ''}</div></div>
                <div className="n" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{series && <Sparkline values={series} width={64} height={18} accentLast baseline title="clean at night, 2019 to 2025" />}<span>{e?.cf_share != null ? pct0(e.cf_share) : '—'}{(e?.overnight_cf_share ?? series?.[6]) != null && <small> · {pct0(e?.overnight_cf_share ?? series[6])} at night</small>}</span></div>
              </a>) })}
          </div>
          <p className="note" style={{ marginTop: 10 }}>Clean share of the electricity generated on each site's grid in {a.primary?.year || 2024}, all hours; the line is clean-at-night 2019 to 2025. The site lookup is hand-curated from the serving utility outward, never from the state.</p>
        </>
      ) },
      { id: 'claims', title: 'What it claims, and the verdict', render: () => (
        <>
          {(data.claims || []).map(k => {
            const contra = (k.evidence || []).find(e => e.type === 'internal_contradiction' || e.type === 'cross_document_contradiction')
            const reason = (k.evidence || []).find(e => e.type === 'note' && /cannot_verify/.test(e.note || ''))
            return (
              <div className="claim" key={k.claim_id}>
                <div className="q">“{k.verbatim}”</div>
                <div className="m"><span>{k.source_doc}{k.page ? `, p. ${k.page}` : ''}{k.year ? ` · ${k.year}` : ''}</span><Chip small accent={k.verdict === 'contradicted'}>{VERDICT[k.verdict] || k.verdict}</Chip>{k.cannot_verify_reason && <span>{REASON[k.cannot_verify_reason] || k.cannot_verify_reason.replace(/_/g, ' ')}</span>}{(k.greenwash_patterns || []).map(g => <span key={g} className="chip sm" data-tip={PATTERN[g] || g}>{g.replace(/_/g, ' ')}</span>)}</div>
                <GapBar claim={k} />
                {k.falsifiability != null && <div className="m" style={{ alignItems: 'center' }}><span style={{ width: 84 }}>checkable</span><span style={{ width: 90 }}><Ticks value={k.falsifiability * 100} max={100} n={10} /></span><span>{Math.round(k.falsifiability * 100)}%{k.scope ? ` · ${k.scope.replace(/_/g, ' ')}` : ''}</span></div>}
                {contra && <div className="why">Contradicted in {contra.source_doc}{contra.page ? `, p. ${contra.page}` : ''}: {contra.note}</div>}
                {!contra && reason && <div className="why">{reason.note.replace(/^cannot_verify:\s*/, '')}</div>}
              </div>
            )
          })}
        </>
      ) },
      { id: 'talkwalk', title: 'Talk vs walk', render: () => (
        <>
          <div className="nums" style={{ marginTop: 0 }}><Num num={(data.talk_score ?? 0) * 100} format={pctFmt} label="talk" sub="how bold the claims are" accent /><Num num={(data.walk_score ?? 0) * 100} format={pctFmt} label="walk" sub="clean share across its sites" /><Num num={(data.coverage ?? 0) * 100} format={pctFmt} label="coverage" sub="claims we could check" /></div>
          <KV rows={[['talk', data.talk_score_method || 'boldness × specificity, 0–1'], ['walk', data.walk_score_method || 'mean physical clean share across mapped sites, grid-only, unweighted']]} />
          <p className="note" style={{ marginTop: 10 }}>Grid-only and average mix: contracted clean power (PPAs, RECs) is not counted, which is why an annual "100% renewable" claim can be true on paper while its sites physically run on much less.</p>
        </>
      ) },
      { id: 'caveats', title: 'What this number does not mean', render: () => (
        <ul className="note" style={{ margin: 0, paddingLeft: 18 }}>
          {(data.notes || []).map((n, i) => <li key={i} style={{ marginBottom: 6 }}>{n}</li>)}
        </ul>
      ) },
      ...(relocateModule.applies({ company: data }) ? [{ id: relocateModule.id, title: relocateModule.title, render: () => relocateModule.render({ company: data }) }] : []),
      { id: 'night', title: 'Why night matters', default: false, render: () => <p className="note">Since 2019 the US grid got cleaner during the day and stood still at night. A datacenter draws the same power at 3am as at noon, so half of its electricity lands in the hours that did not improve. <a href={href.found('sweep')} className="ink2">See the numbers →</a></p> },
    ]
    column = (
      <>
        <Card title={<><b>{data.company}</b> · {data.ticker}{data.is_mock && <> · <span className="accent">mock claims</span></>}</>} right={<CopyButton text={() => window.location.href} label="Copy link" />} onClose={back}>
          <h1 className="verdict">{a.sentence}</h1>
          {a.numbers.length > 0 && <div className="nums">{a.numbers.map((n, i) => <Num key={i} {...n} />)}</div>}
          {(() => {
            // A gap is only headlined when it rests on more than one site and no site's grid carries a footprint note.
            const siteNote = (data.notes || []).find(n => sites.some(st => n.includes(st.ba) || (st.serving_utility && n.includes(st.serving_utility.split(' ')[0])) || n.includes(st.grid_label || '\u0000')))
            const ok = a.primary?.magnitude != null && a.primary.unit === 'fraction' && a.primary.physical_mean_unweighted != null
            if (!ok) return null
            const importer = sites.map(st => importerNote(details[st.region_id])).find(Boolean)
            if (sites.length >= 2 && !siteNote && !importer) return <p className="note" style={{ marginTop: 12 }}>The gap: <b style={{ color: 'var(--ink)' }}>{Math.round((a.primary.magnitude - a.primary.physical_mean_unweighted) * 100)} points</b> between what is claimed on paper and what its grids physically generated, averaged across {sites.length} sites.</p>
            return <p className="note" style={{ marginTop: 12 }}>{sites.length === 1 ? 'One mapped site, so this is that grid, not the company: ' : ''}{siteNote || (importer ? `One of its grids ${importer}, so its footprint share is not what the site consumes.` : 'the physical figure is the average of its mapped sites\' grids.')} Grid-only, average mix; contracted clean power is not counted.</p>
          })()}
          <Evidence open={evidence} onToggle={toggle} />
        </Card>
        {evidence && <Workspace id="check" modules={modules} />}
      </>
    )
  }
  return <Shell page="check" globe={globe} column={column} />
}
