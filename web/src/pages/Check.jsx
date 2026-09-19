import { useMemo } from 'react'
import Shell, { fitView } from '../console/Console.jsx'
import { Card, Num, Evidence, Chip, KV } from '../console/widgets.jsx'
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

// A grid that generates far less than it uses is mostly imports; its footprint share is not what the site consumes.
const importerNote = d => { const g = d && d.type === 'zone' && d.parent ? d.parent : d; const gen = g?.total_avg_mw?.['2025']?.all, dem = d?.demand?.['2025']?.avg_mw; return gen && dem && gen / dem < 0.5 ? `generates ${Math.round(gen / dem * 100)}% of what it uses, the rest is imported` : null }

const VERDICT = { true_on_paper: 'true on paper', contradicted: 'contradicted', unfalsifiable: 'too vague to check', cannot_verify: "can't verify" }
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
                <div className="m"><span>{k.source_doc}{k.page ? `, p. ${k.page}` : ''}{k.year ? ` · ${k.year}` : ''}</span><Chip small accent={k.verdict === 'contradicted'}>{VERDICT[k.verdict] || k.verdict}</Chip>{k.cannot_verify_reason && <span>{REASON[k.cannot_verify_reason] || k.cannot_verify_reason.replace(/_/g, ' ')}</span>}</div>
                {contra && <div className="why">Contradicted in {contra.source_doc}{contra.page ? `, p. ${contra.page}` : ''}: {contra.note}</div>}
                {!contra && reason && <div className="why">{reason.note.replace(/^cannot_verify:\s*/, '')}</div>}
              </div>
            )
          })}
        </>
      ) },
      { id: 'talkwalk', title: 'Talk vs walk', render: () => (
        <>
          <div className="nums" style={{ marginTop: 0 }}>{data.talk_score == null ? <Num num={null} format={() => '—'} label="talk" sub="no falsifiable claim to score" accent /> : <Num num={data.talk_score * 100} format={pctFmt} label="talk" sub="how bold the claims are" accent />}{data.walk_score == null ? <Num num={null} format={() => '—'} label="walk" sub="no mapped site with grid data" /> : <Num num={data.walk_score * 100} format={pctFmt} label="walk" sub="clean share across its sites" />}{data.coverage == null ? <Num num={null} format={() => '—'} label="coverage" sub="not computed" /> : <Num num={data.coverage * 100} format={pctFmt} label="coverage" sub="claims we could check" />}</div>
          <KV rows={[['talk', data.talk_score_method || 'boldness × specificity, 0–1'], ['walk', data.walk_score_method || 'mean physical clean share across mapped sites, grid-only, unweighted']]} />
          <p className="note" style={{ marginTop: 10 }}>Grid-only and average mix: contracted clean power (PPAs, RECs) is not counted, which is why an annual "100% renewable" claim can be true on paper while its sites physically run on much less.</p>
        </>
      ) },
      { id: 'caveats', title: 'What this number does not mean', render: () => (
        <ul className="note" style={{ margin: 0, paddingLeft: 18 }}>
          {(data.notes || []).map((n, i) => <li key={i} style={{ marginBottom: 6 }}>{n}</li>)}
        </ul>
      ) },
      { id: 'night', title: 'Why night matters', default: false, render: () => <p className="note">Since 2019 the US grid got cleaner during the day and stood still at night. A datacenter draws the same power at 3am as at noon, so half of its electricity lands in the hours that did not improve. <a href={href.found('sweep')} className="ink2">See the numbers →</a></p> },
    ]
    column = (
      <>
        <Card title={<><b>{data.company}</b> · {data.ticker}{data.is_mock && <> · <span className="accent">mock claims</span></>}</>} right={<CopyButton text={() => window.location.href} label="Copy link" />} onClose={back}>
          <h1 className="verdict">{a.sentence}</h1>
          {a.numbers.length > 0 && <div className="nums">{a.numbers.map((n, i) => <Num key={i} {...n} />)}</div>}
          <Evidence open={evidence} onToggle={toggle} />
        </Card>
        {evidence && <Workspace id="check" modules={modules} />}
      </>
    )
  }
  return <Shell page="check" globe={globe} column={column} />
}
