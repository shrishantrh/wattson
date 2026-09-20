/* oxlint-disable react/only-export-components -- correctionsOf is a pure selector the registry imports */
import { Mod, Lead, Empty, Fold } from './Shell.jsx'

// Published vs corrected, side by side. Showing the published figure next to our correction is
// the point: the engine found a reporting error (AZPS 2019 counted SRP's nuclear) and says so.
const fmtOne = (v, path) => (/cf_share/.test(path) ? `${(v * 100).toFixed(1)}%` : typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : String(v))
// A corrected figure can be a whole monthly series; print its ends and its length, never the dump.
const fmtVal = (v, path) => {
  if (v == null) return ', '
  if (Array.isArray(v)) return v.length ? `${fmtOne(v[0], path)} … ${fmtOne(v[v.length - 1], path)} (${v.length})` : ', '
  return fmtOne(v, path)
}
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

// One corrected figure: what changed, every key published against corrected, and the evidence.
function Block({ x }) {
  if (!x) return null
  return (
    <div className="mod-corr-block">
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
  )
}

export default function CorrectionsModule({ detail }) {
  const c = correctionsOf(detail)
  if (!c) return <Empty>Nothing was corrected for this region.</Empty>
  const h = headline(c)
  return (
    <Mod
      className="mod-corr"
      caption={(typeof c.summary === 'string' ? c.summary.replace(/\b0\.(\d{1,3})\b/g, (_, d) => `${(Number(`0.${d}`) * 100).toFixed(1)}%`) : c.summary) || 'What the export says, and what the engine reads instead.'}
      lead={h
        ? <Lead value={<><s>{h.published}</s><span className="arrow"> → </span>{h.corrected}</>} t="warn" label={`${pretty(h.path)} ${h.key}, corrected`} />
        : <Lead value={String((c.corrections || []).length)} label="figures corrected on this region" t="warn" />}
      foot="Published = the EIA-930 export. Corrected = recomputed on a consistent basis."
    >
      <Block x={c.corrections[0]} />
      {c.corrections.length > 1 && (
        <Fold summary={`${c.corrections.length - 1} more corrected ${c.corrections.length === 2 ? 'figure' : 'figures'}`}>
          {c.corrections.slice(1).map((x, i) => <Block key={i} x={x} />)}
        </Fold>
      )}
    </Mod>
  )
}
