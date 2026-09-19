import { useMemo } from 'react'
import Shell, { fitView } from '../console/Console.jsx'
import { Card, Num, Evidence, Section, Chip, KV, Ticks } from '../console/widgets.jsx'
import { loadCompany, useAsync, useRegionDetails, nightSeries } from '../lib/data.js'
import { readTokens } from '../lib/tokens.js'
import { checkAnswer, pct0, caveatFor } from '../lib/findings.js'
import { COMPANIES } from '../lib/query.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { href } from '../router.js'

const VERDICT = { true_on_paper: 'true on paper', contradicted: 'contradicted', unfalsifiable: 'too vague to check', cannot_verify: "can't verify" }
const REASON = { no_falsifiable_content: 'nothing measurable in the claim', no_site_mapping: 'no site could be mapped to a grid', ba_out_of_coverage: 'its grid is outside our coverage', year_out_of_range: 'the year is outside the data' }

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
      markers: pts.map(s => { const e = bySite[s.ba]; return { id: s.metro, lat: s.lat, lng: s.lng, label: `${s.metro.split(',')[0]}${e?.cf_share != null ? ` · ${pct0(e.cf_share)} clean` : ''}`, href: href.region(s.region_id), color: tk.accent } }) }
  }, [sites, bySite, tk])
  const back = () => { window.location.hash = href.landing() }
  const toggle = () => { window.location.hash = href.check(ticker, !evidence) }

  let column
  if (loading) column = <Card title={<><b>{known?.name || ticker}</b></>} onClose={back}><Loading what={known?.name || ticker} /></Card>
  else if (error) {
    const others = COMPANIES.filter(c => (error.available || []).includes(c.ticker))
    column = (
      <Card title={<><b>{known?.name || ticker}</b></>} onClose={back}>
        {error.name === 'NotFound' ? (
          <>
            <h1 className="verdict">{known ? `${known.name} isn't verified yet.` : `We don't have ${ticker}.`}</h1>
            <p className="note" style={{ marginTop: 10 }}>{known ? `${known.name}'s reports are being read now. ` : ''}{others.length ? <>Verified so far: {others.map(c => <Chip key={c.ticker} small href={href.check(c.ticker)}>{c.name}</Chip>)}</> : 'No company has been verified yet.'}</p>
          </>
        ) : <ErrorState error={error} onRetry={reload} />}
      </Card>
    )
  } else {
    const a = checkAnswer(data)
    column = (
      <>
        <Card title={<><b>{data.company}</b> · {data.ticker}{data.is_mock && <> · <span className="accent">mock claims</span></>}</>} onClose={back}>
          <h1 className="verdict">{a.sentence}</h1>
          {a.numbers.length > 0 && <div className="nums">{a.numbers.map((n, i) => <Num key={i} {...n} />)}</div>}
          <Evidence open={evidence} onToggle={toggle} />
        </Card>
        {evidence && (
          <>
            <Section title="Where its sites draw power">
              <div className="rows">
                {sites.map(s => { const e = bySite[s.ba]; const cav = caveatFor(s.region_id); return (
                  <a className="row" key={s.metro} href={href.region(s.region_id)}>
                    <div><div className="t">{s.metro}</div><div className="d">{s.serving_utility || 'utility unknown'} · {s.grid_label}{s.source_type ? ` · ${s.source_type.replace(/_/g, ' ')}` : ''}{cav ? ' · data unreliable' : ''}</div></div>
                    <div className="n">{e?.cf_share != null ? pct0(e.cf_share) : '—'}{(e?.overnight_cf_share ?? nightSeries(details[s.region_id])?.[6]) != null && <small> · {pct0(e?.overnight_cf_share ?? nightSeries(details[s.region_id])[6])} at night</small>}</div>
                  </a>) })}
              </div>
              <p className="note" style={{ marginTop: 10 }}>Clean share of the electricity generated on each site's grid in {a.primary?.year || 2024}, all hours. The site lookup is hand-curated from the serving utility outward, never from the state.</p>
            </Section>
            <Section title="What it claims, and the verdict">
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
            </Section>
            <Section title="Talk vs walk">
              <div className="nums" style={{ marginTop: 0 }}><Num value={pct0(data.talk_score)} label="talk" sub="how bold the claims are" accent /><Num value={pct0(data.walk_score)} label="walk" sub="clean share across its sites" /><Num value={pct0(data.coverage)} label="coverage" sub="claims we could check" /></div>
              <KV rows={[['talk', data.talk_score_method || 'boldness × specificity, 0–1'], ['walk', data.walk_score_method || 'mean physical clean share across mapped sites, grid-only, unweighted']]} />
              <p className="note" style={{ marginTop: 10 }}>Grid-only and average mix: contracted clean power (PPAs, RECs) is not counted, which is why an annual "100% renewable" claim can be true on paper while its sites physically run on much less.</p>
            </Section>
            <Section title="How the grid changed where the load is landing" right={<a href={href.found()}>What we found →</a>}>
              <p className="note">Since 2019 the US grid got cleaner during the day and stood still at night. A datacenter draws the same power at 3am as at noon, so half of its electricity lands in the hours that did not improve.</p>
            </Section>
          </>
        )}
      </>
    )
  }
  return <Shell page="check" globe={globe} column={column} />
}
