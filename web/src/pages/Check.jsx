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
import { Bolt, Layers, Info, Company as CompanyIcon, Place, Link as LinkIcon, Night, ArrowRight, Check as CheckIcon, Close as CloseIcon, Help } from '../components/Icons.jsx'
import Breadcrumbs, { useCrumbs } from '../components/Breadcrumbs.jsx'
import '../styles/answer.css'

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
// Zone label: what kind of thing the next block is. Icon carries the kind, text carries the word.
function Zone({ icon: Icon, children, right }) {
  return <div className="ans-sec"><Icon size={12} /><span>{children}</span>{right && <span className="ans-sec-r">{right}</span>}</div>
}
// A module header that says what kind of evidence it is.
const mtitle = (Icon, text) => <span className="ans-mtitle"><Icon size={13} />{text}</span>
// The generated answer is one paragraph. The first sentence IS the answer; the rest qualifies it,
// so it is set as body copy under it. Split only after a lowercase letter, digit, % or ) so that
// "N. Virginia" and initials stay whole. The words themselves are never changed.
const leadRest = s => { const m = String(s || '').match(/^([\s\S]*?[a-z0-9%)]\.)\s+([\s\S]+)$/); return m ? [m[1], m[2]] : [s, null] }
const VERDICT_ICON = { true_on_paper: CheckIcon, contradicted: CloseIcon, unfalsifiable: Help, cannot_verify: Info }

// Claimed vs measured on ONE track: a claim is an accounting fact (neutral ink), what the
// grids physically generated is the clean/fossil pair. The difference is said once, below.
function AnsGap({ claimed, lo, hi, claimText, measuredText, note }) {
  const tone = (lo + (hi - lo) / 2) >= 0.5 ? 'clean' : 'fossil'
  const long = measuredText.length > 5
  return (
    <div className="ans-gap">
      <div className="ans-gap-row">
        <span className="ans-gap-k">says</span>
        <span className="ans-gap-t"><i style={{ left: 0, width: `${Math.min(1, claimed) * 100}%` }} /></span>
        <span className={`ans-gap-v${claimText.length > 5 ? ' long' : ''}`}>{claimText}</span>
      </div>
      <div className="ans-gap-row">
        <span className="ans-gap-k">its grids</span>
        <span className="ans-gap-t"><i className={tone} style={{ left: `${lo * 100}%`, width: `${Math.max(2, (hi - lo) * 100)}%` }} /></span>
        <span className={`ans-gap-v ${tone}${long ? ' long' : ''}`}>{measuredText}</span>
      </div>
      {note}
    </div>
  )
}

const REASON = { no_falsifiable_content: 'nothing measurable in the claim', no_site_mapping: 'no site could be mapped to a grid', ba_out_of_coverage: 'its grid is outside our coverage', year_out_of_range: 'the year is outside the data' }
const pctFmt = n => `${Math.round(n)}%`

// Question 1: "This company says it's clean. What's actually powering its sites?"
export default function Check({ route }) {
  const ticker = route.ticker
  const crumbs = useCrumbs()
  const evidence = route.params?.evidence === '1'
  const { loading, error, data, reload } = useAsync(() => loadCompany(ticker), [ticker])
  const tk = useMemo(readTokens, [])
  const known = COMPANIES.find(c => c.ticker === ticker)
  const sites = data?.sites || []
  const details = useRegionDetails(evidence ? sites.map(s => s.region_id) : [])
  const bySite = useMemo(() => {
    // Grid evidence attached to claims, then the site's own cf_share_2025 as a fallback.
    // A company whose only claim is cannot_verify has no evidence array, and its sites
    // would otherwise render an em dash for a share we already have.
    const fromClaims = Object.fromEntries((data?.claims || []).flatMap(k => (k.evidence || []).filter(e => e.type === 'grid').map(e => [e.ba, e])))
    const fromSites = Object.fromEntries((data?.sites || []).filter(s => s.cf_share_2025 != null).map(s => [s.ba, { type: 'grid', ba: s.ba, year: 2025, cf_share: s.cf_share_2025 }]))
    return { ...fromSites, ...fromClaims }
  }, [data])
  const globe = useMemo(() => {
    const pts = sites.filter(s => s.lat != null)
    return { view: fitView(pts), points: pts.map(s => ({ id: s.metro, lat: s.lat, lng: s.lng, r: 0.2, color: tk.accent })), rings: pts.map(s => ({ id: s.metro, lat: s.lat, lng: s.lng, color: tk.accent, maxR: 2, speed: 0.6, period: 1800 })),
      markers: pts.map(s => { const e = bySite[s.ba]; return { id: s.metro, lat: s.lat, lng: s.lng, label: `${s.metro.split(',')[0]}${e?.cf_share != null ? ` · ${pct0(e.cf_share)} clean` : ''}`, tip: `${s.metro} · ${s.serving_utility || 'utility unknown'} · ${s.grid_label}`, href: href.region(s.region_id), color: tk.accent } }) }
  }, [sites, bySite, tk])
  const back = () => { window.location.hash = href.landing() }
  const toggle = () => { window.location.hash = href.check(ticker, !evidence) }

  let column
  if (loading) column = <><Breadcrumbs trail={crumbs} /><Card className="ans-card" title={<b>{known?.name || ticker}</b>} onClose={back}><Loading what={known?.name || ticker} /></Card></>
  else if (error) {
    const others = COMPANIES.filter(c => (error.available || []).includes(c.ticker))
    column = (
      <><Breadcrumbs trail={crumbs} /><Card className="ans-card" title={<b>{known?.name || ticker}</b>} onClose={back}>
        {error.name === 'NotFound' ? (
          <>
            <h1 className="verdict">{known ? `${known.name} isn't verified yet.` : `We don't have ${ticker}.`}</h1>
            {known && ingest.companies?.[known.ticker] && <p className="note" style={{ marginTop: 10 }}>Read so far: {ingest.companies[known.ticker].documents.map(d => `${d.kind.toUpperCase()} ${d.pages} pages`).join(', ')} · {ingest.companies[known.ticker].chunks} passages · claim extraction {ingest.companies[known.ticker].extracted ? 'done' : 'pending'}.</p>}
            <p className="note" style={{ marginTop: 10 }}>{others.length ? <>Verified so far: {others.map(c => <Chip key={c.ticker} small href={href.check(c.ticker)}>{c.name}</Chip>)}</> : 'No company has been verified yet.'}</p>
          </>
        ) : <ErrorState error={error} onRetry={reload} />}
      </Card></>
    )
  } else {
    const a = checkAnswer(data)
    const modules = [
      ...((data.claims || []).some(k => k.page && k.verbatim) ? [{ id: 'sbs', title: mtitle(LinkIcon, 'Says, and discloses, in the same report'), render: () => <SideBySideModule company={data} /> }] : []),
      ...(innovLadderModule.applies({ company: data }) ? [{ id: innovLadderModule.id, title: mtitle(Layers, innovLadderModule.title), render: () => innovLadderModule.render({ company: data }) }] : []),
      { id: 'sites', title: mtitle(Place, 'Where its sites draw power'), render: () => (
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
      { id: 'claims', title: mtitle(CompanyIcon, 'What it claims, and the verdict'), render: () => (
        <>
          {(data.claims || []).map(k => {
            const contra = (k.evidence || []).find(e => e.type === 'internal_contradiction' || e.type === 'cross_document_contradiction')
            const reason = (k.evidence || []).find(e => e.type === 'note' && /cannot_verify/.test(e.note || ''))
            return (
              <div className="claim" key={k.claim_id}>
                {k.verbatim ? <div className="q">“{k.verbatim}”</div>
                  : <div className="q" style={{ fontStyle: 'normal', opacity: 0.85 }}>No quotable claim found in this company's documents.</div>}
                <div className="m"><span>{k.source_doc || 'no source document'}{k.page ? `, p. ${k.page}` : (k.locator?.item ? `, Item ${k.locator.item}` : '')}{k.year ? ` · ${k.year}` : ''}</span><Chip small accent={k.verdict === 'contradicted'}>{VERDICT[k.verdict] || k.verdict}</Chip>{k.cannot_verify_reason && <span>{REASON[k.cannot_verify_reason] || k.cannot_verify_reason.replace(/_/g, ' ')}</span>}</div>
                <GapBar claim={k} />
                {k.falsifiability != null && <div className="m" style={{ alignItems: 'center' }}><span style={{ width: 84 }}>checkable</span><span style={{ width: 90 }}><Ticks value={k.falsifiability * 100} max={100} n={10} /></span><span>{Math.round(k.falsifiability * 100)}%{k.scope ? ` · ${k.scope.replace(/_/g, ' ')}` : ''}</span></div>}
                {contra && <div className="why">Contradicted in {contra.source_doc}{contra.page ? `, p. ${contra.page}` : ''}: {contra.note}</div>}
                {!contra && reason && <div className="why">{reason.note.replace(/^cannot_verify:\s*/, '')}</div>}
                {!contra && !reason && k.note && <div className="why">{k.note}</div>}
              </div>
            )
          })}
        </>
      ) },
      { id: 'talkwalk', title: mtitle(Bolt, 'Talk vs walk'), render: () => (
        <>
          <div className="nums" style={{ marginTop: 0 }}>{data.talk_score == null ? <Num num={null} format={() => '—'} label="talk" sub="no falsifiable claim to score" accent /> : <Num num={data.talk_score * 100} format={pctFmt} label="talk" sub="how bold the claims are" accent />}{data.walk_score == null ? <Num num={null} format={() => '—'} label="walk" sub="no mapped site with grid data" /> : <Num num={data.walk_score * 100} format={pctFmt} label="walk" sub="clean share across its sites" />}{data.coverage == null ? <Num num={null} format={() => '—'} label="coverage" sub="not computed" /> : <Num num={data.coverage * 100} format={pctFmt} label="coverage" sub="claims we could check" />}</div>
          <KV rows={[['talk', data.talk_score_method || 'boldness × specificity, 0–1'], ['walk', data.walk_score_method || 'mean physical clean share across mapped sites, grid-only, unweighted']]} />
          <p className="note" style={{ marginTop: 10 }}>Grid-only and average mix: contracted clean power (PPAs, RECs) is not counted, which is why an annual "100% renewable" claim can be true on paper while its sites physically run on much less.</p>
        </>
      ) },
      ...(relocateModule.applies({ company: data }) ? [{ id: relocateModule.id, title: mtitle(ArrowRight, relocateModule.title), render: () => relocateModule.render({ company: data }) }] : []),
      { id: 'night', title: mtitle(Night, 'Why night matters'), default: false, render: () => <p className="note">Since 2019 the US grid got cleaner during the day and stood still at night. A datacenter draws the same power at 3am as at noon, so half of its electricity lands in the hours that did not improve. <a href={href.found('sweep')} className="ink2">See the numbers →</a></p> },
    ]
    // Claimed vs measured, on one scale. Only a fractional claim with a measured range can be drawn.
    const p = a.primary
    const track = p?.magnitude != null && p.unit === 'fraction' && p.physical_min != null
      ? { claimed: Math.min(1, p.magnitude), lo: p.physical_min, hi: p.physical_max ?? p.physical_min }
      : null
    const claimText = a.numbers[0]?.value ?? '—'
    const measuredText = a.numbers[1]?.value ?? '—'
    const measuredTone = track && (track.lo + (track.hi - track.lo) / 2) >= 0.5 ? 'clean' : 'fossil'
    // A grid whose footprint understates what its sites can draw, or a single site, changes how the
    // figure should be read: the gap is not headlined, and the note that explains it opens by default.
    const siteNote = (data.notes || []).find(n => sites.some(st => n.includes(st.ba) || (st.serving_utility && n.includes(st.serving_utility.split(' ')[0])) || n.includes(st.grid_label || '\u0000')))
    const importer = sites.map(st => importerNote(details[st.region_id])).find(Boolean)
    const headlineGap = !!track && p.physical_mean_unweighted != null && sites.length >= 2 && !siteNote && !importer
    const gapPts = track && p.physical_mean_unweighted != null ? Math.round((p.magnitude - p.physical_mean_unweighted) * 100) : null
    // Two short rows rather than one long paragraph: what the figure covers, then why it is low.
    const scopeLine = headlineGap || !track ? null : sites.length === 1 ? 'One mapped site, so this is that grid, not the company.' : "The physical figure is the average of its mapped sites' grids."
    const whyLine = headlineGap || !track ? null : siteNote || (importer ? `One of its grids ${importer}, so its footprint share is not what the site consumes.` : null)
    const VerdictIcon = VERDICT_ICON[a.verdict] || Info
    const modCount = modules.length
    const [lead, rest] = leadRest(a.sentence)
    column = (
      <>
        <Breadcrumbs trail={crumbs} />
        <Zone icon={Bolt} right={<span className="chip sm ans-chip"><VerdictIcon size={12} />{VERDICT[a.verdict] || 'read'}</span>}>Answer</Zone>
        <div className="ans-sticky">
          <span className="ans-sticky-name"><CompanyIcon size={13} />{data.company}</span>
          <span className="ans-sticky-v"><b>{claimText}</b> claimed · <b className={measuredTone}>{measuredText}</b> measured</span>
        </div>
        <Card className="ans-card" title={<><b>{data.company}</b> · {data.ticker}{data.is_mock && <> · <span className="accent">mock claims</span></>}</>} right={<CopyButton text={() => window.location.href} label="Copy link" />} onClose={back}>
          <h1 className="verdict ans-lead">{lead}</h1>
          {rest && <p className="ans-rest">{rest}</p>}
          {track ? (
            <>
              <AnsGap
                {...track}
                claimText={claimText}
                measuredText={measuredText}
                note={headlineGap ? <p className="ans-gap-say"><b>{gapPts} points</b> between what is claimed on paper and what its grids physically generated, averaged across {sites.length} sites.</p> : null}
              />
              {a.numbers.length > 2 && <div className="nums ans-meta" style={{ gridTemplateColumns: `repeat(${a.numbers.length - 2}, auto)` }}>{a.numbers.slice(2).map((n, i) => <Num key={i} {...n} />)}</div>}
            </>
          ) : a.numbers.length > 0 && <div className="nums">{a.numbers.map((n, i) => <Num key={i} {...n} />)}</div>}
          <details className="ans-why" open={!!whyLine}>
            <summary>Why this number is conservative</summary>
            <dl className="ans-dl">
              {scopeLine && <div><dt>what it covers</dt><dd>{scopeLine}</dd></div>}
              {whyLine && <div><dt>why it reads low</dt><dd>{whyLine}</dd></div>}
              <div><dt>basis</dt><dd>Grid-only, average mix; contracted clean power is not counted.</dd></div>
            </dl>
          </details>
          <Evidence open={evidence} onToggle={toggle} />
        </Card>
        {evidence && (
          <>
            <Workspace id="check" modules={modules} title={<span className="ans-mtitle"><Layers size={13} />Evidence<em className="ans-count">{modCount}</em></span>} />
            <Zone icon={Info}>Sources and caveats</Zone>
            <section className="card ans-tail">
              <p className="ans-tail-sum">What this number does not mean.</p>
              <ul className="ans-list">{(data.notes || []).map((n, i) => <li key={i}>{n}</li>)}</ul>
            </section>
          </>
        )}
      </>
    )
  }
  return <Shell page="check" globe={globe} column={column} />
}
