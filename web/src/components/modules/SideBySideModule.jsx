/* oxlint-disable react/only-export-components -- sideBySideOf is a pure selector that Check.jsx imports */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import '../../styles/companies.css'
import { Mod, Say } from './Shell.jsx'
// Source pages, when rendered: public/evidence/index.json maps a claim id to
// { says: { src, page, boxes: [[x,y,w,h] in 0..1] }, discloses: { src, page, boxes } }. Boxes are drawn as highlights.
function useEvidenceIndex() {
  const [idx, setIdx] = useState(null)
  useEffect(() => { let alive = true; fetch(`${import.meta.env.BASE_URL}evidence/index.json`).then(r => (r.ok && (r.headers.get('content-type') || '').includes('json') ? r.json() : null)).then(j => alive && setIdx(j || {})).catch(() => alive && setIdx({})); return () => { alive = false } }, [])
  return idx || {}
}

// The highlight boxes, in page coordinates (0..1). `big` is the lightbox copy: the same marks, heavier.
function Boxes({ boxes, big }) {
  return (boxes || []).map((b, i) => (
    <span key={i} className={`sbs-mark${big ? ' big' : ''}`} style={{ left: `${b[0] * 100}%`, top: `${b[1] * 100}%`, width: `${b[2] * 100}%`, height: `${b[3] * 100}%` }} />
  ))
}

// One page of the company's own report, with the claimed lines marked. Click (or Enter) opens it
// full size; Escape closes. The page is the evidence, so it gets the card's full width.
function PageCrop({ item, label }) {
  const [open, setOpen] = useState(false)
  useEffect(() => { if (!open) return undefined; const k = e => { if (e.key === 'Escape') setOpen(false) }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [open])
  if (!item?.src) return null
  const src = `${import.meta.env.BASE_URL}${item.src.replace(/^\//, '')}`
  const alt = `${label}${item.page ? `, page ${item.page}` : ''}, with the claimed lines marked`
  return (
    <>
      <button type="button" className="sbs-shot" onClick={() => setOpen(true)} aria-label={`${alt}. Click to enlarge.`}>
        <img src={src} alt="" />
        <Boxes boxes={item.boxes} />
        <span className="sbs-zoom">full page</span>
      </button>
      {open && createPortal((
        <div className="sbs-lb" role="dialog" aria-label={alt} onClick={() => setOpen(false)}>
          <div className="sbs-lb-in">
            <div className="sbs-lb-page">
              <img src={src} alt={alt} />
              <Boxes boxes={item.boxes} big />
            </div>
            <p className="sbs-lb-cap"><b>{label}</b>{item.page ? ` · page ${item.page}` : ''} · click or press Esc to close</p>
          </div>
        </div>
      ), document.body)}
    </>
  )
}
// A claim and a disclosure from the same company, side by side, and nothing else.
// Left: the quote with its page. Right: a numeric series the same document discloses
// (for example Google's hourly carbon-free energy by year on p. 94 against "matched 100%" on p. 4).
// Renders only when a claim's evidence carries a numeric series: { type: 'disclosure'|'internal_contradiction',
// page, label?, values: [..], years?: [..], unit? } or the same under `series`.
const pickSeries = e => { const s = e.series || e.values || e.data; return Array.isArray(s) && s.length >= 2 && s.every(v => typeof v === 'number') ? s : null }

export function sideBySideOf(company, index) {
  const out = []
  for (const k of company?.claims || []) {
    const pages = index?.[k.claim_id]
    const ev = (k.evidence || []).find(e => pickSeries(e))
    if (ev || pages?.says) out.push({ claim: k, evidence: ev || null, series: ev ? pickSeries(ev) : null, pages: pages || null })
  }
  return out
}

// Several claim rows can carry the same sentence off the same page (Google files the page-4 quote
// under four claim ids, Microsoft its page-6 quote under three). They are one exhibit, so the card
// shows it once, keeping the copy that also carries a disclosed series.
const keyOf = ({ claim }) => `${claim.page ?? '?'}|${String(claim.verbatim || '').replace(/[“”"\s]+/g, ' ').trim().toLowerCase()}`
const dedupe = pairs => {
  const by = new Map()
  for (const p of pairs) {
    const k = keyOf(p), had = by.get(k)
    if (!had || (!had.series && p.series) || (!had.pages?.discloses && p.pages?.discloses)) by.set(k, p)
  }
  return [...by.values()]
}

// The page cite as a mono chip; dashed when the source has no page (raw SEC HTML). `title` names the document.
function PageChip({ page, title }) {
  return <span className={`sbs-chip${page == null ? ' dim' : ''}`} title={title || undefined}>{page == null ? 'no page' : `p. ${page}`}</span>
}

// The card's one sentence: which page says it, which page holds the figures.
function leadWords(pairs) {
  const p = pairs[0]
  const says = p?.claim?.page, disc = p?.evidence?.page
  if (says != null && disc != null) return <>Page <b>{says}</b> makes the claim; page <b>{disc}</b> discloses the figures.</>
  if (says != null) return <>Printed on page <b>{says}</b> of the company&apos;s own report.</>
  return <>Printed in the company&apos;s own report.</>
}

export default function SideBySideModule({ company }) {
  const idx = useEvidenceIndex()
  const pairs = dedupe(sideBySideOf(company, idx))
  if (!pairs.length) return null
  const doc = pairs[0]?.claim?.source_doc || pairs[0]?.evidence?.source_doc || null
  const anyDisclosure = pairs.some(p => Array.isArray(p.series) && p.series.length)
  return (
    <Mod
      className="mod-sbs"
      caption={anyDisclosure ? 'Its own words on one page, its own figures on another.' : 'Its own words, on its own page. Nothing here is ours.'}
      lead={<Say>{leadWords(pairs)}</Say>}
      foot={<>{doc ? <b>{doc}</b> : 'The company’s own report'} · click a page to see it full size.</>}
    >
      <div className="sbs-wrap">
        {pairs.map(({ claim, evidence, series, pages }, i) => {
          const hasSeries = Array.isArray(series) && series.length > 0
          const years = evidence?.years || evidence?.labels || (hasSeries ? series.map(() => '') : [])
          const unit = evidence?.unit || '%'
          const max = Math.max(...(series || [100]), 100)
          const saysDoc = claim.source_doc || null, discDoc = evidence?.source_doc || saysDoc
          const quote = String(claim.verbatim || '').replace(/^[“"]+/, '').replace(/[”"]+$/, '')
          return (
            <article key={claim.claim_id || i} className="sbs">
              <section className="sbs-ex">
                <div className="sbs-head"><b>Says</b><PageChip page={claim.page} title={saysDoc} /></div>
                {pages?.says && <PageCrop item={pages.says} label="The claim, on its own page" />}
                <blockquote className="sbs-quote">{quote}”</blockquote>
              </section>
              {(hasSeries || pages?.discloses) && (
                <section className="sbs-ex">
                  <div className="sbs-head"><b>Discloses</b><PageChip page={evidence?.page} title={discDoc} /></div>
                  {pages?.discloses && <PageCrop item={pages.discloses} label="The disclosure, same report" />}
                  {evidence?.label && <div className="sbs-head-l">{evidence.label}</div>}
                  {hasSeries && (
                    <div className="sbs-bars" role="img" aria-label={`${evidence?.label || 'Disclosed series'}: ${series.map((v, j) => `${years[j] ? `${years[j]} ` : ''}${v}${unit}`).join(', ')}`}>
                      {series.map((v, j) => {
                        const pctH = Math.max(0, Math.min(100, (v / max) * 100))
                        return (
                          <div className="sbs-bar" key={j} title={`${years[j] ? `${years[j]} · ` : ''}${v}${unit}`}>
                            <div className="sbs-bar-t">
                              <span className="sbs-bar-v" style={{ bottom: `calc(${pctH}% + 4px)` }}>{v}{unit}</span>
                              <i className="sbs-bar-i" style={{ height: `${pctH}%` }} />
                            </div>
                            <span className="sbs-bar-y">{years[j] ?? ''}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              )}
            </article>
          )
        })}
      </div>
    </Mod>
  )
}
