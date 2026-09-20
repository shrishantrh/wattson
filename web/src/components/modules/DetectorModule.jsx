import { fmt, signed } from '../../lib/format.js'
import { Ticks } from '../../console/widgets.jsx'
import { Mod, Lead, Empty } from './Shell.jsx'

const num = x => (x == null || x === '' || Number.isNaN(Number(x)) ? null : Number(x))
const sgn = (x, d) => signed(x, d).replace(/^-/, '−')   // true minus, like the GW figures elsewhere

// Display scales for the bars only. The printed figure is always the exact one; the bar says
// "how big is this, roughly", and the footnote names the scale so the bar cannot mislead.
const SCALE = { excess: 20, neighbours: 40, lf: 0.1, growth: 60 }

// The frozen demand-only detector. The card leads with the rank, then the four components as
// labelled tick bars, each in plain words with its sign.
// detection = { rank, n_scored, score, growth_pct, overnight_excess, neighbor_divergence, load_factor_delta, pattern }
export default function DetectorView({ detection: d }) {
  if (!d) return <Empty>Not scored: regions under 500 MW of average demand are left out.</Empty>
  const n = num(d.n_scored) ?? 111
  const ex = num(d.overnight_excess), nd = num(d.neighbor_divergence), lf = num(d.load_factor_delta), g = num(d.growth_pct)
  const rank = num(d.rank), score = num(d.score)
  const rows = [
    ex != null && { key: 'excess', t: `Night grew ${ex >= 0 ? 'faster' : 'slower'} than average`, n: `${sgn(ex, 1)} pts`, v: Math.abs(ex), max: SCALE.excess, accent: ex >= 0 },
    nd != null && { key: 'neighbours', t: `${nd >= 0 ? 'Faster' : 'Slower'} than its neighbours`, n: `${sgn(nd, 1)} pts`, v: Math.abs(nd), max: SCALE.neighbours, accent: nd >= 0 },
    lf != null && { key: 'lf', t: `Load got ${lf >= 0 ? 'flatter' : 'peakier'}`, d: 'load factor, 2019 to 2025', n: sgn(lf, 3), v: Math.abs(lf), max: SCALE.lf, accent: lf >= 0 },
    g != null && { key: 'growth', t: 'Demand growth since 2019', n: `${sgn(g, 1)}%`, v: Math.abs(g), max: SCALE.growth, accent: false },
  ].filter(Boolean)
  return (
    <Mod
      className="mod-detector"
      caption={d.pattern ? `Pattern: ${d.pattern} \u2014 a label, never part of the score.` : 'A demand-only score: no generation figure goes into it.'}
      lead={<Lead value={rank != null ? `#${fmt(rank)}` : '—'} label={`of ${fmt(n)} regions${score != null ? ` · score ${fmt(score, 2).replace(/^-/, '−')}` : ''}`} />}
      foot="Demand-only score, frozen before the ranking was seen. Bars are scaled; the figures are exact."
    >
      <div className="mod-ticks">
        {rows.map(r => (
          <div key={r.key} className="mod-tickrow">
            <div className="mod-cell"><div className="mod-t">{r.t}</div>{r.d && <div className="mod-d">{r.d}</div>}</div>
            <span className="mod-tk"><Ticks value={r.v} max={r.max} n={10} accent={r.accent} label={`${r.t}: ${r.n}`} /></span>
            <span className="mod-n">{r.n}</span>
          </div>
        ))}
      </div>
    </Mod>
  )
}
