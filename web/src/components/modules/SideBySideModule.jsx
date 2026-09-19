// A claim and a disclosure from the same company, side by side, and nothing else.
// Left: the quote with its page. Right: a numeric series the same document discloses
// (for example Google's hourly carbon-free energy by year on p. 94 against "matched 100%" on p. 4).
// Renders only when a claim's evidence carries a numeric series: { type: 'disclosure'|'internal_contradiction',
// page, label?, values: [..], years?: [..], unit? } or the same under `series`.
const pickSeries = e => { const s = e.series || e.values || e.data; return Array.isArray(s) && s.length >= 2 && s.every(v => typeof v === 'number') ? s : null }

export function sideBySideOf(company) {
  const out = []
  for (const k of company?.claims || []) for (const e of k.evidence || []) { const s = pickSeries(e); if (s) out.push({ claim: k, evidence: e, series: s }) }
  return out
}

export default function SideBySideModule({ company }) {
  const pairs = sideBySideOf(company)
  if (!pairs.length) return null
  return (
    <div className="mod-sbs">
      {pairs.map(({ claim, evidence, series }, i) => {
        const years = evidence.years || evidence.labels || series.map((_, j) => '')
        const max = Math.max(...series, 100)
        return (
          <div key={i} className="sbs" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
            <div><div className="section-title"><span>Says · p. {claim.page ?? '—'}</span></div><p className="q" style={{ fontSize: 13 }}>“{claim.verbatim}”</p></div>
            <div>
              <div className="section-title"><span>{evidence.label || 'Discloses'} · p. {evidence.page ?? '—'}</span></div>
              <div className="hourbars" style={{ height: 48 }}>{series.map((v, j) => <i key={j} style={{ height: `${(v / max) * 100}%`, background: 'var(--ink-2)' }} title={`${years[j] || ''} ${v}${evidence.unit || '%'}`} />)}</div>
              <div className="hourbars-axis">{series.map((v, j) => <span key={j}>{years[j] ? `${years[j]} ` : ''}{v}{evidence.unit || '%'}</span>)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
