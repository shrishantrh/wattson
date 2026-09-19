import { fmt, signed } from '../../lib/format.js'

const num = x => (x == null || x === '' || Number.isNaN(Number(x)) ? null : Number(x))
const sgn = (x, d) => signed(x, d).replace(/^-/, '−')   // true minus, like the GW figures elsewhere

// The frozen demand-only detector, one component per row, each in plain words with its sign.
// detection = { rank, n_scored, score, growth_pct, overnight_excess, neighbor_divergence, load_factor_delta, pattern }
export default function DetectorView({ detection: d }) {
  if (!d) return <p className="mod-empty">Not scored: regions under 500 MW of average demand are left out.</p>
  const n = num(d.n_scored) ?? 111
  const ex = num(d.overnight_excess), nd = num(d.neighbor_divergence), lf = num(d.load_factor_delta), g = num(d.growth_pct)
  const rank = num(d.rank), score = num(d.score)
  const rows = [
    ex != null && { key: 'excess', t: `Night demand grew ${ex >= 0 ? 'faster' : 'slower'} than average demand`, d: 'overnight excess, percentage points', n: `${sgn(ex, 1)} pts` },
    nd != null && { key: 'neighbors', t: `Grew ${nd >= 0 ? 'faster' : 'slower'} than its neighbours`, d: 'neighbour divergence, percentage points', n: `${sgn(nd, 1)} pts` },
    lf != null && { key: 'lf', t: `Load got ${lf >= 0 ? 'flatter' : 'peakier'}`, d: 'load factor change, 2019 to 2025', n: sgn(lf, 3) },
    { key: 'rank', t: 'Detector rank', d: score != null ? `score ${fmt(score, 2).replace(/^-/, '−')}` : 'no score', n: rank != null ? <>#{fmt(rank)} <small>of {fmt(n)}</small></> : '—' },
    g != null && { key: 'growth', t: 'Demand growth since 2019', d: 'average MW, all hours', n: `${sgn(g, 1)}%` },
  ].filter(Boolean)
  return (
    <div className="mod-detector">
      {d.pattern && <div className="mod-head"><span className="mod-chip">{d.pattern}</span><span className="mod-note">a label, not part of the score</span></div>}
      <ul className="mod-rows">
        {rows.map(r => (
          <li key={r.key} className="mod-row">
            <div className="mod-cell"><div className="mod-t">{r.t}</div><div className="mod-d">{r.d}</div></div>
            <span className="mod-n">{r.n}</span>
          </li>
        ))}
      </ul>
      <p className="mod-foot">Score = z(night excess) + z(neighbour divergence) + 0.5 z(load factor change), frozen before results.</p>
    </div>
  )
}
