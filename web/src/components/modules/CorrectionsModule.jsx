import { KV } from '../../console/widgets.jsx'

// Published vs corrected, side by side. Showing the published figure next to our correction is
// the point: the engine found a reporting error (AZPS 2019 counted SRP's nuclear) and says so.
const fmtVal = (v, path) => (v == null ? '—' : /cf_share/.test(path) ? `${(v * 100).toFixed(1)}%` : typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : String(v))
const pretty = path => path.replace('cf_share.', 'clean share ').replace('cf_avg_mw.', 'clean MW ').replace('total_avg_mw.', 'total MW ').replace('siting.', 'siting ').replace(/_/g, ' ')

export function correctionsOf(detail) {
  const c = detail?.corrections || detail?.parent?.corrections
  return c && (c.corrections || []).length ? c : null
}

export default function CorrectionsModule({ detail }) {
  const c = correctionsOf(detail)
  if (!c) return null
  return (
    <div className="mod-corr">
      {c.summary && <p className="note" style={{ color: 'var(--ink)', marginBottom: 10 }}>{c.summary}</p>}
      {c.corrections.map((x, i) => {
        const keys = Object.keys(x.published || {})
        return (
          <div key={i} style={{ marginBottom: 10 }}>
            <div className="section-title" style={{ marginBottom: 6 }}><span>{pretty(x.path)}</span><span className="chip sm" style={{ marginRight: 0 }}>{x.confidence || 'corrected'}</span></div>
            <KV rows={keys.map(k => [k, <span key={k}><s className="muted">{fmtVal(x.published[k], x.path)}</s> <span style={{ margin: '0 6px', color: 'var(--muted)' }}>→</span> <b style={{ fontWeight: 500 }}>{fmtVal(x.corrected?.[k], x.path)}</b></span>])} />
            {x.evidence && <p className="note" style={{ marginTop: 6 }}>{x.evidence}</p>}
          </div>
        )
      })}
      <p className="note">Published = what the EIA-930 export says. Corrected = recomputed on a consistent basis by the engine. Both are shown on purpose.</p>
    </div>
  )
}
