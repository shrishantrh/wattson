/* oxlint-disable react/only-export-components -- sideBySideOf is a pure selector that Check.jsx imports */
import { useEffect, useState } from 'react'
import '../../styles/companies.css'
// Source pages, when rendered: public/evidence/index.json maps a claim id to
// { says: { src, page, boxes: [[x,y,w,h] in 0..1] }, discloses: { src, page, boxes } }. Boxes are drawn as highlights.
function useEvidenceIndex() {
  const [idx, setIdx] = useState(null)
  useEffect(() => { let alive = true; fetch(`${import.meta.env.BASE_URL}evidence/index.json`).then(r => (r.ok && (r.headers.get('content-type') || '').includes('json') ? r.json() : null)).then(j => alive && setIdx(j || {})).catch(() => alive && setIdx({})); return () => { alive = false } }, [])
  return idx || {}
}
function PageCrop({ item, caption }) {
  if (!item?.src) return null
  return (
    <figure className="sbs-page" style={{ margin: 0 }}>
      <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
        <img src={`${import.meta.env.BASE_URL}${item.src.replace(/^\//, '')}`} alt={caption} style={{ display: 'block', width: '100%' }} />
        {(item.boxes || []).map((b, i) => <span key={i} style={{ position: 'absolute', left: `${b[0] * 100}%`, top: `${b[1] * 100}%`, width: `${b[2] * 100}%`, height: `${b[3] * 100}%`, border: '2px solid var(--accent)', borderRadius: 3, boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)', pointerEvents: 'none' }} />)}
      </div>
      <figcaption className="note" style={{ marginTop: 6 }}>{caption}{item.page ? ` · p. ${item.page}` : ''}</figcaption>
    </figure>
  )
}
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

// The page cite as a mono chip; dashed when the source has no page (raw SEC HTML). `title` names the document.
function PageChip({ page, title }) {
  return <span className={`sbs-chip${page == null ? ' dim' : ''}`} title={title || undefined}>{page == null ? 'no page' : `p. ${page}`}</span>
}

export default function SideBySideModule({ company }) {
  const pairs = sideBySideOf(company)
  const idx = useEvidenceIndex()
  if (!pairs.length) return null
  return (
    <div className="mod-sbs sbs-wrap">
      {pairs.map(({ claim, evidence, series }, i) => {
        const years = evidence.years || evidence.labels || series.map(() => '')
        const unit = evidence.unit || '%'
        const max = Math.max(...series, 100)
        const pages = idx[claim.claim_id]
        const saysDoc = claim.source_doc || null, discDoc = evidence.source_doc || saysDoc
        const sameDoc = !saysDoc || !discDoc || saysDoc === discDoc
        const quote = String(claim.verbatim || '').replace(/^[“"]+/, '').replace(/[”"]+$/, '')
        return (
          <div key={claim.claim_id || i} className="sbs">
            {(pages?.says || pages?.discloses) && (
              <div className="sbs-crops">
                {pages?.says && <PageCrop item={pages.says} caption="The claim, on the company's own page" />}
                {pages?.discloses && <PageCrop item={pages.discloses} caption="The disclosure, same report" />}
              </div>
            )}
            <div className="sbs-pair">
              <div className="sbs-col">
                <div className="sbs-head"><b>Says</b><PageChip page={claim.page} title={saysDoc} /></div>
                <blockquote className="sbs-quote">{quote}”</blockquote>
              </div>
              <div className="sbs-col">
                <div className="sbs-head"><b>Discloses</b><PageChip page={evidence.page} title={discDoc} /></div>
                {evidence.label && <div className="sbs-head-l">{evidence.label}</div>}
                <div className="sbs-bars" role="img" aria-label={`${evidence.label || 'Disclosed series'}: ${series.map((v, j) => `${years[j] ? `${years[j]} ` : ''}${v}${unit}`).join(', ')}`}>
                  {series.map((v, j) => {
                    const pctH = Math.max(0, Math.min(100, (v / max) * 100))
                    return (
                      <div className="sbs-bar" key={j} title={`${years[j] ? `${years[j]} · ` : ''}${v}${unit}`}>
                        <div className="sbs-bar-t">
                          <span className="sbs-bar-v" style={{ bottom: `calc(${pctH}% + 5px)` }}>{v}{unit}</span>
                          <i className="sbs-bar-i" style={{ height: `${pctH}%` }} />
                        </div>
                        <span className="sbs-bar-y">{years[j] ?? ''}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <p className="sbs-foot">{sameDoc ? 'Same report, both pages, no other source.' : 'Two filings by the same company, no other source.'}</p>
          </div>
        )
      })}
    </div>
  )
}
