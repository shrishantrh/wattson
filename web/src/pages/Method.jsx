import { useMemo, useState } from 'react'
import Shell from '../console/Console.jsx'
import { Card, Section } from '../console/widgets.jsx'
import { loadOpening, loadRegions, useAsync } from '../lib/data.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { WxReadout, isNum, DASH } from '../components/WxControls.jsx'
import { ordinal } from '../lib/findings.js'
import { href, useHash } from '../router.js'
import '../styles/pages.css'
import '../styles/wx.css'
import Breadcrumbs, { useCrumbs } from '../components/Breadcrumbs.jsx'

// Method reads as: what we measure, how the detector works, what we hold to, the labels, the
// flags, the company rule. The wording of the caveats is deliberate and unchanged; only its
// structure is set here. The one thing added is a way to check the method rather than read it:
// pick any region and the pattern rule is evaluated in front of you against that region's own
// published numbers, and its answer is compared with the label we shipped.
const splitTerm = t => { const m = /^(.*?)[;:]\s+(.*)$/s.exec(String(t)); return m ? [m[1], m[2]] : [String(t), null] }
const Defs = ({ rows, className = '' }) => (
  <dl className={`mt-dl ${className}`}>
    {rows.map(([term, def], i) => <div key={`${term}-${i}`}><dt>{term}</dt>{def && <dd>{def}</dd>}</div>)}
  </dl>
)
const num1 = (v, unit = '') => (isNum(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}${unit}` : DASH)
const labelOf = r => r?.c?.label || r?.name || r?.id || ''

// The published rules, applied to a region's own published figures. Growth and overnight
// excess come out of the export already in percent and percentage points.
function patternTest(growth, excess) {
  const flat = isNum(growth) && isNum(excess) && growth >= 10 && excess > 0
  const solar = isNum(growth) && isNum(excess) && growth < 5 && excess >= 5
  return { flat, solar, label: flat ? 'flat-load growth' : solar ? 'possible midday solar suppression' : 'mixed' }
}

export default function Method() {
  const { loading, error, data, reload } = useAsync(loadOpening, [])
  const regs = useAsync(loadRegions, [])
  const crumbs = useCrumbs(useHash())
  const back = () => { window.location.hash = href.landing() }
  const list = useMemo(() => [...(regs.data?.regions || [])].sort((a, b) => (a.detection?.rank ?? 999) - (b.detection?.rank ?? 999)), [regs.data])
  const [pick, setPick] = useState('')
  const sel = list.find(r => r.id === pick) || list[0] || null

  if (loading || error) return <Shell page="method" globe={{ view: { lat: 30, lng: -96, altitude: 2.2 }, interactive: false }} column={<><Breadcrumbs trail={crumbs} onBack={back} /><Card title={<b>Method</b>} onClose={back}>{loading ? <Loading what="method" /> : <ErrorState error={error} onRetry={reload} />}</Card></>} />

  const det = data.detector || {}
  const val = (det.regions || []).filter(r => r.validation).sort((a, b) => a.rank - b.rank)
  const hits = val.filter(r => r.rank <= 20).length
  const d = sel?.detection || {}
  const test = patternTest(d.growth_pct, d.overnight_excess)
  const agrees = !!d.pattern && test.label === d.pattern

  const column = (
    <>
      <Breadcrumbs trail={crumbs} onBack={back} />
      <Card title={<b>Method</b>} onClose={back}>
        <h1 className="verdict">We measure what each grid physically generated, hour by hour — not what was bought on paper.</h1>
        {/* the definitions as a grid, not a paragraph: each one is looked up, not read through.
            The lede under it carries the one thing a lookup table cannot: why the split matters. */}
        <dl className="pg-defs">
          <div><dt>Source</dt><dd>EIA-930 via PUDL</dd></div>
          <div><dt>Coverage</dt><dd>Every US balancing authority</dd></div>
          <div><dt>Clean</dt><dd>Nuclear, hydro, wind, solar, geothermal — storage excluded, other and unknown counted in the denominator only</dd></div>
          <div><dt>Night</dt><dd>{data.overnight_hours_local || '00:00–05:59'} local — no solar, a datacenter still at full draw</dd></div>
          <div><dt>Day</dt><dd>{data.daytime_hours_local || '10:00–15:59'} local — the window solar output is largest in</dd></div>
          <div><dt>Baseline</dt><dd>{data.baseline_year || 2019}, before the buildout</dd></div>
          <div><dt>Through</dt><dd>{data.data_snapshot_end || '2026-09-05'}</dd></div>
        </dl>
        <p className="pg-lede">Splitting night from day is the whole method: an annual average hides the fact that the hours a 24/7 load is stuck with are the hours that did not improve.</p>
      </Card>

      <Section title="The flat-load detector — weights set before we saw the ranking">
        <code className="mt-formula">{det.method}</code>
        <p className="note">The score reads demand and nothing else, so it cannot be influenced by what a grid generates or by any company telling us where its sites are. Robust z means median and MAD rather than mean and standard deviation, so one runaway region does not rescale everyone else.</p>
        <div className="section-title" style={{ marginTop: 16 }}><span>Clusters named before the run, so the test could fail: {hits} of {val.length} landed in the top twenty and the miss stands instead of a re-tune</span><span className="mono muted" style={{ whiteSpace: 'nowrap', marginLeft: 12, alignSelf: 'flex-start' }}>rank of {det.n_scored}</span></div>
        <div className="rows pg-ranked">
          {val.map(r => (
            <a className="row" key={r.id} href={href.region(r.id)}>
              <span className="rk">{r.rank}</span>
              <div><div className="t">{r.known_cluster_label || r.name || r.id}</div><div className="d">{r.rank <= 20 ? 'inside the top twenty' : 'outside the top twenty — reported as a miss'}{r.pattern ? ` · ${r.pattern}` : ''}</div></div>
              <div className="n">{ordinal(r.rank)}</div>
            </a>
          ))}
        </div>
      </Section>

      <Section title="Check the rule on any region, not just ours">
        {list.length === 0 ? <p className="note">The region list has not loaded, so there is nothing to test against yet.</p> : (
          <>
            <p className="note">Pattern labels are descriptive and never touch the score. They are two arithmetic tests on figures that are in the export — so pick a region and watch them run against its own numbers.</p>
            <label className="wx-group" style={{ marginTop: 12 }}>
              <span className="wx-k">region</span>
              <select className="field" value={sel?.id || ''} onChange={e => setPick(e.target.value)} aria-label="Region to test" style={{ width: '100%', maxWidth: 'none', fontFamily: 'var(--font-ui)' }}>
                {list.map(r => <option key={r.id} value={r.id}>#{r.detection?.rank ?? '—'} · {labelOf(r)}</option>)}
              </select>
            </label>
            <WxReadout items={[
              { value: num1(d.growth_pct, '%'), label: 'demand growth since 2019' },
              { value: num1(d.overnight_excess, ' pts'), label: 'overnight growth minus average growth', tone: 'fossil' },
              { value: num1(d.neighbor_divergence, ' pts'), label: 'divergence from its neighbors' },
              { value: isNum(d.score) ? d.score.toFixed(2) : DASH, label: `score · rank #${d.rank ?? DASH} of ${det.n_scored}` },
            ]} />
            <ul className="wx-test">
              <li><span className={`mk ${test.flat ? 'yes' : 'no'}`}>{test.flat ? '✓' : '·'}</span><span>flat-load growth needs growth <b>&ge; 10%</b> and overnight excess <b>&gt; 0</b>. Here: {num1(d.growth_pct, '%')} and {num1(d.overnight_excess, ' pts')}.</span></li>
              <li><span className={`mk ${test.solar ? 'yes' : 'no'}`}>{test.solar ? '✓' : '·'}</span><span>possible midday solar suppression needs growth <b>&lt; 5%</b> and overnight excess <b>&ge; 5 pts</b>. Here: {num1(d.growth_pct, '%')} and {num1(d.overnight_excess, ' pts')}.</span></li>
              <li><span className={`mk ${!test.flat && !test.solar ? 'yes' : 'no'}`}>{!test.flat && !test.solar ? '✓' : '·'}</span><span>mixed is everything else.</span></li>
            </ul>
            <div className={`wx-verdict ${agrees ? 'agree' : ''}`}>
              The rule returns <b>{test.label}</b>. The label we published for {labelOf(sel)} is <b>{d.pattern || DASH}</b>{agrees ? ' — the same answer.' : '. They differ, which would be a bug worth reporting.'}
              {' '}The score beside it is not recomputed here: its robust z is taken across all {det.n_scored} regions at once, so it is the engine&rsquo;s figure, printed as published.
            </div>
            {sel?.cf_inherited_from_ba && <p className="note" style={{ marginTop: 10 }}>{labelOf(sel)} is a zone: it reports demand only, which is exactly what the detector reads, so its rank is its own even though its generation figures would be the parent grid&rsquo;s.</p>}
          </>
        )}
      </Section>

      <Section title="Where this can be wrong"><Defs rows={(data.caveats || []).map(splitTerm)} /></Section>
      <Section title="Pattern labels — a read of the shape, never part of the score"><Defs className="mt-keys" rows={Object.entries(data.pattern_labels || {})} /></Section>
      <Section title="Where we suspect the data, not the grid"><Defs className="mt-flags" rows={Object.entries(data.data_flags || {})} /></Section>
      <Section title="Company verdicts"><p className="note">&ldquo;True on paper, X physically&rdquo; is not an accusation: an annual clean-energy claim can be true under the accounting rules while the grid under the site still burns gas at 3am. We report only the second — grid-only, average mix, contracted clean power excluded. cannot_verify is explicit, with a reason; the site lookup is hand-curated from the serving utility outward. Until the extraction lands, Meta runs on mock claims with real grid numbers.</p></Section>
    </>
  )
  return <Shell page="method" globe={{ view: { lat: 30, lng: -96, altitude: 2.2 }, interactive: false }} column={column} />
}
