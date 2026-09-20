import { fmt, signed } from '../../lib/format.js'
import { Ticks } from '../../console/widgets.jsx'
import { Mod, Lead, Empty } from './Shell.jsx'

const num = x => (x == null || x === '' || Number.isNaN(Number(x)) ? null : Number(x))
const sgn = (x, d) => signed(x, d).replace(/^-/, '−')   // true minus, like the GW figures elsewhere

// Display scales for the bars only. The printed figure is always the exact one; the bar says
// "how big is this, roughly", and the footnote names the scale so the bar cannot mislead.
const SCALE = { excess: 20, neighbors: 40, lf: 0.1, growth: 60 }

// The frozen demand-only detector. The card leads with the rank, then the four components as
// labelled tick bars, each in plain words with its sign.
// detection = { rank, n_scored, score, growth_pct, overnight_excess, neighbor_divergence, load_factor_delta, pattern }
export default function DetectorView({ detection: d }) {
  if (!d) return <Empty>Not scored: regions under 500 MW of average demand are left out.</Empty>
  const n = num(d.n_scored) ?? 111
  const ex = num(d.overnight_excess), nd = num(d.neighbor_divergence), lf = num(d.load_factor_delta), g = num(d.growth_pct)
  const rank = num(d.rank)
  const rows = [
    ex != null && { key: 'excess', t: `Night demand grew ${ex >= 0 ? 'faster' : 'slower'} than average demand`, d: 'overnight excess, percentage points', n: `${sgn(ex, 1)} pts`, v: Math.abs(ex), max: SCALE.excess, accent: ex >= 0 },
    nd != null && { key: 'neighbors', t: `Grew ${nd >= 0 ? 'faster' : 'slower'} than its neighbors`, d: 'neighbor divergence, percentage points', n: `${sgn(nd, 1)} pts`, v: Math.abs(nd), max: SCALE.neighbors, accent: nd >= 0 },
    lf != null && { key: 'lf', t: `Load got ${lf >= 0 ? 'flatter' : 'peakier'}`, d: 'load factor change, 2019 to 2025', n: sgn(lf, 3), v: Math.abs(lf), max: SCALE.lf, accent: lf >= 0 },
    g != null && { key: 'growth', t: 'Demand growth since 2019', d: 'average MW, all hours', n: `${sgn(g, 1)}%`, v: Math.abs(g), max: SCALE.growth, accent: false },
  ].filter(Boolean)
  return (
    <Mod
      className="mod-detector"
      caption={d.pattern ? `Pattern: ${d.pattern}. A label, never part of the score.` : 'A demand-only score: no generation figure goes into it.'}
      lead={<Lead value={rank != null ? `#${fmt(rank)}` : '—'} label={`of ${fmt(n)} regions scored on demand alone${rank != null ? ` — ${rank <= 1 ? 'nowhere in the country shows' : rank === 2 ? 'one other region shows' : `${fmt(rank - 1)} regions show`} this pattern more strongly` : ''}`} />}
      foot="Score = z(night excess) + z(neighbor divergence) + 0.5 z(load factor change), robust z, frozen before the ranking was seen. Bars are drawn on a fixed scale (±20 pts, ±40 pts, ±0.10, ±60%); the figures beside them are exact."
    >
      <div className="mod-ticks">
        {rows.map(r => (
          <div key={r.key} className="mod-tickrow">
            <div className="mod-cell"><div className="mod-t">{r.t}</div><div className="mod-d">{r.d}</div></div>
            <span className="mod-tk"><Ticks value={r.v} max={r.max} n={12} accent={r.accent} label={`${r.d}: ${r.n}`} /></span>
            <span className="mod-n">{r.n}</span>
          </div>
        ))}
      </div>
    </Mod>
  )
}
