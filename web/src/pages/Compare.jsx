import { useMemo, useState } from 'react'
import Shell, { fitView } from '../console/Console.jsx'
import { Card, Num, Evidence, Chip, KV, Ring, HourBars } from '../console/widgets.jsx'
import Workspace from '../components/Workspace.jsx'
import Sparkline from '../components/Sparkline.jsx'
import { CopyButton } from '../components/CopyButton.jsx'
import { loadSite, loadOpening, loadRegions, useAsync, useRegionDetails, hourProfile, nightSeries } from '../lib/data.js'
import { nearbyModule } from '../components/modules/NearbyModule.jsx'
import { readTokens } from '../lib/tokens.js'
import { compareAnswer, caveatFor, pct0, pct1, pts1, gw1, n0, signedGw } from '../lib/findings.js'
import { resolvePlace, DEMO_COMPARE } from '../lib/query.js'
import { SHAPES, FLEX_FRACTION, cleanShareFor, shiftable, profileOf } from '../lib/shape.js'
import ShapePicker from '../components/ShapePicker.jsx'
import WxHeadToHead from '../components/WxHeadToHead.jsx'
import { Loading, ErrorState } from '../components/States.jsx'
import { href } from '../router.js'
import { Bolt, Layers, Info, Place, Pin, Night } from '../components/Icons.jsx'
import Breadcrumbs, { useCrumbs } from '../components/Breadcrumbs.jsx'
import '../styles/answer.css'

const trend = s => (s == null ? '—' : `${s > 0 ? '+' : ''}${(s * 100).toFixed(1)} pts / yr`)
const pctFmt = n => `${Math.round(n)}%`

// Zone label: what kind of thing the next block is.
function Zone({ icon: Icon, children, right }) {
  return <div className="ans-sec"><Icon size={12} /><span>{children}</span>{right && <span className="ans-sec-r">{right}</span>}</div>
}
// The generated answer is one paragraph. The first sentence IS the answer; the rest qualifies it,
// so it is set as body copy under it. Split only after a lowercase letter, digit, % or ) so that
// "N. Virginia" and initials stay whole. The words themselves are never changed.
const leadRest = s => { const m = String(s || '').match(/^([\s\S]*?[a-z0-9%)]\.)\s+([\s\S]+)$/); return m ? [m[1], m[2]] : [s, null] }
const mtitle = (Icon, text) => <span className="ans-mtitle"><Icon size={13} />{text}</span>

// Question 2: "Where should I put a datacenter so it runs on the cleanest power?"
export default function Compare({ route }) {
  const evidence = route.params?.evidence === '1'
  const crumbs = useCrumbs()
  const request = useMemo(() => ({ mw: route.mw, metros: route.metros }), [route.mw, route.metros])
  const { loading, error, data, reload } = useAsync(() => loadSite(request), [request.mw, request.metros.join('|')])
  const found = useAsync(loadOpening, [])
  const regs = useAsync(loadRegions, [])
  const tk = useMemo(readTokens, [])
  const [mw, setMw] = useState(request.mw)
  const [add, setAdd] = useState('')
  const [shape, setShape] = useState('flat')
  const [flexible, setFlexible] = useState(false)
  const baseCands = data?.candidates || []
  const details = useRegionDetails(baseCands.map(c => c.region_id))
  // What-if layer: any shape other than flat 24/7 (or the flexible toggle) re-ranks the candidates on the
  // clean share over the hours that shape uses, from each place's 24-hour profile. Flat keeps the frozen score.
  const whatIf = shape !== 'flat' || flexible
  const shapeDef = SHAPES.find(s => s.id === shape) || SHAPES[0]
  const cands = useMemo(() => {
    if (!whatIf) return baseCands
    const scored = baseCands.map(c => { const prof = profileOf(details[c.region_id]); if (!prof) return null; const base = cleanShareFor(prof, shapeDef.weights); const sh = flexible ? shiftable(prof, shapeDef.weights, FLEX_FRACTION).share : base; return sh == null ? null : { ...c, siting: { ...c.siting, overnight_cf_share_2025: sh }, shapeShare: sh } }).filter(Boolean)
    return scored.sort((a, b) => b.shapeShare - a.shapeShare).map((c, i) => ({ ...c, rank: i + 1 }))
  }, [baseCands, details, whatIf, shapeDef, flexible])
  const shapeLabel = whatIf ? `${shapeDef.label}${flexible ? ', flexible 20%' : ''}` : null
  const answer = data ? compareAnswer({ ...data, candidates: cands }, { shapeLabel }) : null
  const globe = useMemo(() => {
    const pts = cands.filter(c => c.lat != null)
    return { view: fitView(pts), points: pts.map(c => ({ id: c.region_id, lat: c.lat, lng: c.lng, r: 0.2, color: c === answer?.best ? tk.accent : tk.ink2 })), rings: pts.filter(c => c === answer?.best).map(c => ({ id: c.region_id, lat: c.lat, lng: c.lng, color: tk.accent, maxR: 3, speed: 0.8, period: 1600 })),
      markers: pts.map(c => ({ id: c.region_id, lat: c.lat, lng: c.lng, label: `${c.rank}  ${c.metro} · ${pct0(c.siting?.overnight_cf_share_2025)}`, tip: `${c.metro}: ${pct1(c.siting?.overnight_cf_share_2025)} clean at night, ${trend(c.siting?.ratio_slope_per_year)}${c.detector?.rank ? `, flat-load rank #${c.detector.rank}` : ''}`, href: href.region(c.region_id), color: c === answer?.best ? tk.accent : tk.ink2, lead: c === answer?.best })) }
  }, [cands, answer, tk])
  const go = (m = request.metros, load = mw) => { window.location.hash = href.compare({ mw: Number(load) || 300, metros: m, evidence }) }
  const addMetro = e => { e.preventDefault(); const m = resolvePlace(add); if (m && !request.metros.some(x => resolvePlace(x)?.region_id === m.region_id)) go([...request.metros, m.metro]); setAdd('') }
  const back = () => { window.location.hash = href.landing() }
  const toggle = () => { window.location.hash = href.compare({ ...request, evidence: !evidence }) }
  const nat = found.data?.national?.cf_share, natMw = found.data?.national?.cf_avg_mw, top = (found.data?.detector?.regions || []).filter(r => r.rank <= 5)

  const form = (
    <form className="formline" onSubmit={e => { e.preventDefault(); go() }}>
      <input className="field" type="number" min="1" value={mw} onChange={e => setMw(e.target.value)} style={{ width: 74 }} aria-label="Load in MW" /><span className="muted" style={{ fontSize: 12 }}>MW, {whatIf ? shapeDef.label : '24/7'}</span>
      {request.metros.map(m => <Chip key={m} small onRemove={request.metros.length > 1 ? () => go(request.metros.filter(x => x !== m)) : undefined}>{resolvePlace(m)?.metro || m}</Chip>)}
      <input className="field" value={add} onChange={e => setAdd(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addMetro(e) }} placeholder="+ add a place" style={{ width: 132 }} aria-label="Add a place" />
      <button className="btn primary" type="submit">Rank</button>
    </form>
  )
  // One control group: the request (how much, where) with the load shape subordinate to it.
  const controls = (
    <div className="ans-controls">
      {form}
      <div className="ans-controls-sub">
        <span className="ans-controls-k">load shape</span>
        <ShapePicker value={shape} onChange={setShape} flexible={flexible} onFlexible={setFlexible} />
        <p className="note">{whatIf ? `Re-ranked on the clean power available in the hours a ${shapeLabel} load actually runs, instead of the night hours a datacenter is stuck with.` : 'A datacenter runs flat, so it is judged on the night hours. Pick another shape — an office, a charging depot — to re-rank on the hours that load would actually run.'}</p>
      </div>
    </div>
  )

  let column
  if (loading) column = <><Breadcrumbs trail={crumbs} /><Card className="ans-card" title={<><b>Compare</b> · {request.mw} MW</>} onClose={back}><div className="ans-controls">{form}</div><Loading what="the ranking" /></Card></>
  else if (error) column = <><Breadcrumbs trail={crumbs} /><Card className="ans-card" title={<b>Compare</b>} onClose={back}><div className="ans-controls">{form}</div><ErrorState error={error} onRetry={reload} /></Card></>
  else {
    const load = Number(data.request.mw)
    const modules = [
      ...cands.map(c => {
        const cf = c.siting?.overnight_cf_share_2025, dem = c.demand?.overnight_avg_mw, cav = caveatFor(c.region_id), d = details[c.region_id], series = nightSeries(d), prof = hourProfile(d)
        return { id: `cand-${c.region_id}`, title: <><Place size={13} className="ans-micon" /><span style={{ color: c === answer.best ? 'var(--accent)' : 'var(--ink)' }}>{c.rank}. {c.metro}</span> · {c.grid_label} · <a href={href.region(c.region_id)} className="ink2">detail →</a></>, render: () => (
          <>
            <div className="instrument"><Ring value={cf} /><div className="num"><div className="v" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{pct1(cf)}{series && <Sparkline values={series} width={72} height={20} accentLast baseline title="clean at night, 2019 to 2025" />}</div><div className="l">{whatIf ? `clean power in the hours a ${shapeLabel} load runs` : 'clean power at night'}, 2025 · the other {pct0(cf != null ? 1 - cf : null)} was fossil or unclassified</div></div></div>
            <KV rows={[
              ['its nights since 2019', c.siting?.change_since_2019 != null ? `${(c.siting.change_since_2019 * 100).toFixed(1)} pts ${c.siting.change_since_2019 > 0 ? 'cleaner' : c.siting.change_since_2019 < 0 ? 'dirtier' : 'unchanged'}` : '—'],
              ['its own clean power covers', c.siting?.overnight_clean_mw_over_demand != null ? `${Math.round(c.siting.overnight_clean_mw_over_demand * 100)}% of what the grid uses at night` : '—'],
              c.filled_by && ['what served the last growth at night', <span key="f" className={c.filled_by.fuel === 'gas' ? 'accent' : ''}>{c.filled_by.fuel} {signedGw(c.filled_by.gw)}{c.cf_inherited_from_ba ? ' · across the whole grid, not this zone alone' : ''}</span>],
              ['who serves the load', c.operator ? `${c.operator.utility}${c.operator.ticker ? ` · ${c.operator.ticker}` : ''}` : c.serving_utility || '—'],
              dem && ['your load against this whole grid at night', `${(load / dem * 100).toFixed(1)}% of it`],
              cf != null && ['of your load, run on fossil', `${n0(load * (1 - cf))} of ${n0(load)} MW${whatIf ? ', over those hours' : ', at night'}`],
              c.detector?.rank && ['demand here is already growing flat, round the clock', `#${c.detector.rank} of ${c.detector.n_scored || 111} grids on that pattern · demand ${c.detector.growth_pct > 0 ? '+' : ''}${Math.round(c.detector.growth_pct)}% since 2019`],
              ['where it places for new clean load', c.siting?.siting_rank ? `${c.siting.siting_rank} of ${c.siting.n_ranked} grids, 1 is best` : '—'],
            ]} />
            {prof && <div style={{ marginTop: 12 }}><HourBars values={prof} caption="Clean power by hour, 2025 — a flat load buys every one of these hours, including the marked night ones" /></div>}
            {cav && <div className="banner banner-error" style={{ marginTop: 10 }}>{cav}</div>}
            {c.cf_inherited_from_ba && <p className="note" style={{ marginTop: 8 }}>Generation figures are for the whole grid this place sits on; demand is local. Operator is hand-mapped.</p>}
          </>
        ) }
      }),
      ...(answer.best && regs.data && nearbyModule.applies({ regions: regs.data, region_id: answer.best.region_id }) ? [{ id: 'nearby', title: mtitle(Pin, `${nearbyModule.title} · ${answer.best.metro}`), render: () => nearbyModule.render({ regions: regs.data, region_id: answer.best.region_id, load_mw: load }) }] : []),
      { id: 'night', title: mtitle(Night, 'The day got cleaner. The night did not.'), render: () => (
        <>
          {nat ? <div className="nums" style={{ marginTop: 0 }}><Num num={(nat['2025']?.daytime ?? 0) * 100} format={pctFmt} label="clean by day — the half that improved" sub={`${pts1((nat['2025']?.daytime ?? 0) - (nat['2019']?.daytime ?? 0))} since 2019`} /><Num num={(nat['2025']?.overnight ?? 0) * 100} format={pctFmt} label="clean at night — the half that did not" sub={`${pts1((nat['2025']?.overnight ?? 0) - (nat['2019']?.overnight ?? 0))} since 2019`} accent /><Num value="½" label="of a flat load lands in those night hours" sub="it draws the same at 3am as at noon" /></div> : <p className="note">National series not available from this data source.</p>}
          <p className="note" style={{ marginTop: 10 }}>Solar cleaned up the middle of the day and did nothing for the middle of the night.{natMw ? ` Clean output at night did grow, ${gw1(natMw['2019']?.overnight)} to ${gw1(natMw['2025']?.overnight)}; total night generation grew faster, so the share slipped.` : ''} Put a flat load here and half of it buys the hours that never improved. <a href={href.found('sweep')} className="ink2">See it →</a></p>
        </>
      ) },
      { id: 'landing', title: mtitle(Bolt, 'Where new flat load is already showing up'), render: () => <div className="rows">{top.map(r => <a className="row" key={r.id} href={href.region(r.id)}><div><div className="t">{r.known_cluster_label || r.name}</div><div className="d">{r.pattern}{r.data_flagged ? ' · data flagged' : ''}</div></div><div className="n">#{r.rank} <small>demand +{Math.round(r.growth_pct)}%</small></div></a>)}<a className="note" href={href.found('detector')} style={{ display: 'block', marginTop: 8 }}>All 111 grids we scored →</a></div> },
    ]
    const bestShare = answer.best?.siting?.overnight_cf_share_2025
    const bestTone = bestShare != null && bestShare >= 0.5 ? 'clean' : 'fossil'
    const [cmpLead, cmpRest] = leadRest(answer.sentence)
    column = (
      <>
        <Breadcrumbs trail={crumbs} />
        <Zone icon={Bolt} right={<span className="chip sm ans-chip">{whatIf ? shapeLabel : 'flat 24/7'}</span>}>Answer</Zone>
        <div className="ans-sticky">
          <span className="ans-sticky-name"><Place size={13} />{n0(data.request.mw)} MW · {cands.length} place{cands.length === 1 ? '' : 's'}</span>
          {answer.best && <span className="ans-sticky-v"><b>{answer.best.metro}</b> · <b className={bestTone}>{pct0(bestShare)}</b> clean</span>}
        </div>
        <Card className="ans-card" title={<><b>Compare</b> · {n0(data.request.mw)} MW of flat load{data._computed_client_side && ' · this combination was ranked in your browser, same rule'}</>} right={<CopyButton text={() => window.location.href} label="Copy link" />} onClose={back}>
          {controls}
          {data.unmapped.length > 0 && <div className="banner">Not in the data: {data.unmapped.join(', ')}. Try a nearby city or a grid name.</div>}
          {cands.length === 0 && <p className="note" style={{ margin: '8px 0 12px' }}>Nothing to rank yet. Add a place above, or start from the example: <Chip small href={href.compare(DEMO_COMPARE)}>{DEMO_COMPARE.mw} MW: {DEMO_COMPARE.metros.join(' vs ')}</Chip></p>}
          <h1 className="verdict ans-lead">{cmpLead}</h1>
          {cmpRest && <p className="ans-rest">{cmpRest}</p>}
          <ol className="ans-rank">
            {answer.numbers.map((n, i) => (
              <li key={i} className={i === 0 ? 'is-best' : ''}>
                <span className="ans-rank-n">{i + 1}</span>
                <span className="ans-rank-name">{n.label.replace(/^\d+\.\s*/, '')}<small>{whatIf ? shapeDef.label : n.sub}</small></span>
                <span className={`ans-rank-v ${i === 0 ? bestTone : ''}`}>{n.value}</span>
              </li>
            ))}
          </ol>
          <div className="sharebar" aria-hidden="true">{cands.map(c => { const v = c.siting?.overnight_cf_share_2025 ?? 0; return <span key={c.region_id} className={c === answer.best ? 'best' : ''} style={{ width: `${Math.max(2, v * 100) / cands.length}%` }} title={`${c.metro} ${pct0(v)}`} /> })}</div>
          {bestShare != null && <p className="note live" style={{ marginTop: 10 }}>At <b>{n0(Number(mw) || load)} MW</b>, {answer.best.metro} would draw about <b>{n0((Number(mw) || load) * (1 - bestShare))} MW</b> from fossil generation {whatIf ? 'over those hours' : 'at night'} on the 2025 mix{cands[1]?.siting?.overnight_cf_share_2025 != null ? <>, versus <b>{n0((Number(mw) || load) * (1 - cands[1].siting.overnight_cf_share_2025))} MW</b> in {cands[1].metro}</> : null}. That 2025 mix is the grid's yearly average, not the one plant that would actually ramp up to serve you.</p>}
          <details className="ans-why is-method">
            <summary>How this ranking is made</summary>
            <dl className="ans-dl">
              <div><dt>score</dt><dd>Not a ranking of who is cleanest today. Three equal parts: how clean the nights are now, which way that has moved since 2019, and how much clean power the grid makes at night next to its own night demand. So a dirty grid that is climbing can sit above a cleaner one that is sliding — read the percentage beside each name, not just the rank. Weights frozen before any result was seen.</dd></div>
              {whatIf && <div><dt>what-if</dt><dd>The order above is now the clean power available in the hours a {shapeLabel} load actually runs. The evidence below is still measured over the night hours, so the two will not agree; the frozen score only describes a flat 24/7 load.</dd></div>}
            </dl>
          </details>
          <Evidence open={evidence} onToggle={toggle} label="Show why" />
        </Card>
        <Zone icon={Place}>Head to head</Zone>
        <Card className="ans-card" title={<><b>Any two regions</b> · the difference, at {n0(Number(mw) || load)} MW</>}>
          {regs.data
            ? <WxHeadToHead regions={regs.data.regions} mw={Number(mw) || load} initial={[cands[0]?.region_id, cands[1]?.region_id].filter(Boolean)} />
            : <p className="note">Loading the region list.</p>}
        </Card>
        {evidence && (
          <>
            <Workspace id="compare" modules={modules} title={<span className="ans-mtitle"><Layers size={13} />Evidence<em className="ans-count">{modules.length}</em></span>} />
            <Zone icon={Info}>Sources and caveats</Zone>
            <section className="card ans-tail">
              <p className="ans-tail-sum">The ranking rule, word for word from the engine:</p>
              <ul className="ans-list"><li>{data.method}</li><li>Average mix inside each grid's footprint, not marginal emissions and not consumption: imports are not allocated.</li></ul>
            </section>
          </>
        )}
      </>
    )
  }
  return <Shell page="compare" globe={globe} column={column} />
}
