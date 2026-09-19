import ChartCard from '../ChartCard.jsx'
import DataTable from '../DataTable.jsx'
import { C, layout } from '../theme.js'
import { fmt, pct, regionHref } from '../util.jsx'

const VERDICT = { true_on_paper: 'true on paper', contradicted: 'contradicted', unfalsifiable: 'unfalsifiable', cannot_verify: 'cannot verify' }

export default function Companies({ companies, mock, regions }) {
  const cfLookup = (ba, year) => regions.find(r => r.id === ba)?.cf_share?.[String(year)]?.all
  const withScores = companies.filter(c => c.talk_score != null && c.walk_score != null)
  const scatter = { data: [{ type: 'scatter', mode: 'markers+text', x: withScores.map(c => c.walk_score), y: withScores.map(c => c.talk_score), text: withScores.map(c => c.ticker || c.company), textposition: 'top center', textfont: { color: C.ink2, size: 11 },
      marker: { color: C.blue, size: 12, line: { color: C.surface, width: 2 } }, hovertemplate: '%{text}<br>walk %{x:.2f} · talk %{y:.2f}<extra></extra>' }],
    layout: layout({ hovermode: 'closest', showlegend: false, xaxis: { title: { text: 'walk: physical carbon-free share of the grids its sites use (grid-only)' }, range: [0, 1.05] }, yaxis: { title: { text: 'talk: boldness and specificity of the language' }, range: [0, 1.05] },
      shapes: [{ type: 'line', x0: 0, y0: 0, x1: 1, y1: 1, line: { color: C.axis, width: 1 } }] }),
    table: { columns: [{ key: 'company', label: 'Company' }, { key: 'walk_score', label: 'Walk', num: true, render: c => fmt(c.walk_score, 2) }, { key: 'talk_score', label: 'Talk', num: true, render: c => fmt(c.talk_score, 2) }], rows: withScores } }
  return (
    <>
      {mock && <div className="banner mock">MOCK DATA: claims/companies.json has not landed. Showing claims/companies.mock.json; claim text and scores are illustrative. Grid evidence numbers are real.</div>}
      <section className="hero">
        <h1>Company watchlist</h1>
        <p>Claims extracted from filings and ESG reports, joined to the grid index through a hand-curated facility lookup. Verdicts are "true on paper, X physically": annual matched renewable claims are true as stated under the market-based method. Every figure is grid-only and excludes contracted clean power (PPAs). "Cannot verify" is explicit.</p>
      </section>
      {companies.length === 0 && <p className="muted">No company file found.</p>}
      {withScores.length > 0 && <ChartCard title="Talk vs Walk" note="One point per company. Above the line: language ahead of physics." data={scatter.data} layout={scatter.layout} height={320} table={scatter.table} csvName="talk_vs_walk" />}
      {companies.map(c => {
        const cannot = c.claims.filter(k => k.verdict === 'cannot_verify').length
        return (
          <section className="card" key={c.company}>
            <header className="card-head"><div><h3>{c.company} {c.ticker && <span className="muted">({c.ticker})</span>} {c._mock && <span className="badge solar">mock</span>}</h3>
              <p className="note">talk {fmt(c.talk_score, 2)} · walk {fmt(c.walk_score, 2)} · coverage {pct(c.coverage, 0)} · unverifiable share {pct(c.unverifiable_share, 0)} · cannot verify: {cannot} of {c.claims.length} claims</p></div></header>
            <h4 className="small muted" style={{ margin: '8px 0 4px' }}>Sites</h4>
            <DataTable columns={[{ key: 'metro', label: 'Metro' }, { key: 'ba', label: 'BA', render: s => <a href={regionHref(s.pjm_zone ? `${s.ba}/${s.pjm_zone}` : s.ba)}>{s.ba}{s.pjm_zone ? ` / ${s.pjm_zone}` : ''}</a> }, { key: 'serving_utility', label: 'Serving utility' },
              { key: 'cf', label: 'Grid CF 2025 (all hours)', num: true, render: s => pct(cfLookup(s.ba, 2025)) }, { key: 'cfn', label: 'Overnight CF 2025', num: true, render: s => pct(regions.find(r => r.id === s.ba)?.cf_share?.['2025']?.overnight) },
              { key: 'source_type', label: 'Source', render: s => <>{s.source_type}{s.source_url && <> · <a href={s.source_url} target="_blank" rel="noreferrer">link</a></>}</> }]} rows={c.sites} />
            <h4 className="small muted" style={{ margin: '12px 0 4px' }}>Claims</h4>
            <DataTable columns={[
              { key: 'claim_id', label: 'ID', render: k => <span className="small">{k.claim_id}</span> }, { key: 'year', label: 'Year', num: true },
              { key: 'verbatim', label: 'Verbatim', render: k => <><span className="verbatim">“{k.verbatim}”</span><div className="small muted">{k.source_doc}{k.page ? `, p. ${k.page}` : ''}</div>
                {k.evidence?.length > 0 && <details><summary>{k.evidence.length} evidence item{k.evidence.length > 1 ? 's' : ''}</summary><ul className="plain small">{k.evidence.map((e, i) => <li key={i}>{e.type === 'grid' ? <>grid: <a href={regionHref(e.ba)}>{e.ba}</a> {e.year} carbon-free {pct(e.cf_share)}</> : <>{e.type}: {e.note}{e.source_doc ? ` (${e.source_doc}${e.page ? `, p. ${e.page}` : ''})` : ''}</>}</li>)}</ul></details>}</> },
              { key: 'metric', label: 'Claimed', render: k => (k.metric ? <>{k.metric}<br /><b>{k.unit === 'fraction' ? pct(k.magnitude, 0) : `${fmt(k.magnitude)} ${k.unit || ''}`}</b> <span className="muted small">{k.scope}</span></> : <span className="muted">—</span>) },
              { key: 'phys', label: 'Physical (grid-only)', num: true, render: k => (k.physical_mean_unweighted == null ? <span className="muted">—</span> : <>{pct(k.physical_min, 0)} – {pct(k.physical_max, 0)}<br /><span className="muted small">mean {pct(k.physical_mean_unweighted, 0)}</span></>) },
              { key: 'verdict', label: 'Verdict', render: k => <><span className="badge">{VERDICT[k.verdict] || k.verdict}</span><div className="small muted">{k.confidence} confidence · falsifiability {fmt(k.falsifiability, 1)}</div></> },
              { key: 'greenwash_patterns', label: 'Patterns', render: k => (k.greenwash_patterns?.length ? k.greenwash_patterns.join(', ') : <span className="muted">—</span>) },
            ]} rows={c.claims} rowKey={k => k.claim_id} />
            {c.notes?.length > 0 && <ul className="plain small muted">{c.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
          </section>
        )
      })}
    </>
  )
}
