/* oxlint-disable react/only-export-components -- correctionsOf is a pure selector the registry imports */
import { Mod, Lead, Empty } from './Shell.jsx'

// Published vs corrected, side by side. Showing the published figure next to our correction is
// the point: the engine found a reporting error (AZPS 2019 counted SRP's nuclear) and says so.
const fmtVal = (v, path) => (v == null ? '—' : /cf_share/.test(path) ? `${(v * 100).toFixed(1)}%` : typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : String(v))
const pretty = path => path.replace('cf_share.', 'clean share ').replace('cf_avg_mw.', 'clean MW ').replace('total_avg_mw.', 'total MW ').replace('siting.', 'siting ').replace(/_/g, ' ')

export function correctionsOf(detail) {
  const c = detail?.corrections || detail?.parent?.corrections
  return c && (c.corrections || []).length ? c : null
}

// The headline pair: the first corrected figure, published beside corrected.
const headline = c => {
  for (const x of c.corrections || []) {
    for (const k of Object.keys(x.published || {})) {
      if (x.published[k] != null && x.corrected?.[k] != null) return { path: x.path, key: k, published: fmtVal(x.published[k], x.path), corrected: fmtVal(x.corrected[k], x.path) }
    }
  }
  return null
}

export default function CorrectionsModule({ detail }) {
  const c = correctionsOf(detail)
  if (!c) return <Empty>Nothing was corrected for this region.</Empty>
  const h = headline(c)
  return (
    <Mod
      className="mod-corr"
      caption={c.summary || 'What the export says, and what the engine reads instead.'}
      lead={h
        ? <Lead value={<><s>{h.published}</s><span className="arrow"> → </span>{h.corrected}</>} t="warn" label={`published, then corrected — ${pretty(h.path)} ${h.key}`} />
        : <Lead value={String((c.corrections || []).length)} label="figures corrected on this region" t="warn" />}
      foot="Published = what the EIA-930 export says. Corrected = recomputed on a consistent basis by the engine. Both are shown on purpose."
    >
      {c.corrections.map((x, i) => (
        <div key={i} className="mod-corr-block">
          <div className="mod-corr-head"><span>{pretty(x.path)}</span><span className="mod-chip mono">{x.confidence || 'corrected'}</span></div>
          <ul className="mod-corr-rows">
            {Object.keys(x.published || {}).map(k => (
              <li key={k} className="mod-corr-row">
                <span>{k}</span>
                <span className="mod-corr-v"><s>{fmtVal(x.published[k], x.path)}</s><span className="arrow">→</span><b>{fmtVal(x.corrected?.[k], x.path)}</b></span>
              </li>
            ))}
          </ul>
          {x.evidence && <p className="mod-corr-ev">{x.evidence}</p>}
        </div>
      ))}
    </Mod>
  )
}
