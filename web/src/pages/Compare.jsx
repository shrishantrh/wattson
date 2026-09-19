import { useMemo, useState } from 'react'
import Shell, { fitView } from '../console/Console.jsx'
import { Card, Num, Evidence, Chip, KV, Ring, HourBars } from '../console/widgets.jsx'
import Workspace from '../components/Workspace.jsx'
import Sparkline from '../components/Sparkline.jsx'
import { CopyButton } from '../components/CopyButton.jsx'
import { loadSite, loadOpening, loadRegions, useAsync, useRegionDetails, hourProfile, nightSeries } from '../lib/data.js'
import { nearbyModule } from '../components/modules/NearbyModule.jsx'
import { readTokens } from '../lib/tokens.js'
import { compareAnswer, caveatFor, pct0, pct1, n0, signedGw } from '../lib/findings.js'
import { resolvePlace, DEMO_COMPARE } from '../lib/query.js'
import { SHAPES, FLEX_FRACTION, cleanShareFor, shiftable, profileOf } from '../lib/shape.js'
import ShapePicker from '../components/ShapePicker.jsx'
import { Loading, ErrorState } from '../components/States.jsx'
import { href } from '../router.js'

const trend = s => (s == null ? '—' : `${s > 0 ? '+' : ''}${(s * 100).toFixed(1)} pts / yr`)
const pctFmt = n => `${Math.round(n)}%`

// Question 2: "Where should I put a datacenter so it runs on the cleanest power?"
export default function Compare({ route }) {
  const evidence = route.params?.evidence === '1'
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
  const nat = found.data?.national?.cf_share, top = (found.data?.detector?.regions || []).filter(r => r.rank <= 5)

  const form = (
    <form className="formline" onSubmit={e => { e.preventDefault(); go() }}>
      <input className="field" type="number" min="1" value={mw} onChange={e => setMw(e.target.value)} style={{ width: 74 }} aria-label="Load in MW" /><span className="muted" style={{ fontSize: 12 }}>MW, 24/7</span>
      {request.metros.map(m => <Chip key={m} small onRemove={request.metros.length > 1 ? () => go(request.metros.filter(x => x !== m)) : undefined}>{resolvePlace(m)?.metro || m}</Chip>)}
      <input className="field" value={add} onChange={e => setAdd(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addMetro(e) }} placeholder="+ add a place" style={{ width: 132 }} aria-label="Add a place" />
      <button className="btn primary" type="submit">Rank</button>
    </form>
  )
  const picker = <div style={{ margin: '-4px 0 12px' }}><ShapePicker value={shape} onChange={setShape} flexible={flexible} onFlexible={setFlexible} /><p className="note" style={{ marginTop: 6 }}>{whatIf ? `What-if: ranked on the clean share over the hours a ${shapeLabel} load uses, from each place's 24-hour profile.` : 'Flat 24/7 uses the frozen night score. Pick a shape to see how the ranking moves.'}</p></div>

  let column
  if (loading) column = <Card title={<><b>Compare</b> · {request.mw} MW</>} onClose={back}>{form}<Loading what="the ranking" /></Card>
  else if (error) column = <Card title={<b>Compare</b>} onClose={back}>{form}<ErrorState error={error} onRetry={reload} /></Card>
  else {
    const load = Number(data.request.mw)
    const modules = [
      ...cands.map(c => {
        const cf = c.siting?.overnight_cf_share_2025, dem = c.demand?.overnight_avg_mw, cav = caveatFor(c.region_id), d = details[c.region_id], series = nightSeries(d), prof = hourProfile(d)
        return { id: `cand-${c.region_id}`, title: <><span style={{ color: c === answer.best ? 'var(--accent)' : 'var(--ink)' }}>{c.rank}. {c.metro}</span> · {c.grid_label} · <a href={href.region(c.region_id)} className="ink2">detail →</a></>, render: () => (
          <>
            <div className="instrument"><Ring value={cf} /><div className="num"><div className="v" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{pct1(cf)}{series && <Sparkline values={series} width={72} height={20} accentLast baseline title="clean at night, 2019 to 2025" />}</div><div className="l">clean power at night, 2025 · {trend(c.siting?.ratio_slope_per_year)}</div></div></div>
            <KV rows={[
              ['since 2019', c.siting?.change_since_2019 != null ? `${c.siting.change_since_2019 > 0 ? '+' : ''}${(c.siting.change_since_2019 * 100).toFixed(1)} pts` : '—'],
              ['clean power vs demand at night', c.siting?.overnight_clean_mw_over_demand != null ? `${c.siting.overnight_clean_mw_over_demand.toFixed(2)}×` : '—'],
              c.filled_by && ['what filled the last growth', <span key="f" className={c.filled_by.fuel === 'gas' ? 'accent' : ''}>{c.filled_by.fuel} {signedGw(c.filled_by.gw)}</span>],
              ['who serves the load', c.operator ? `${c.operator.utility}${c.operator.ticker ? ` · ${c.operator.ticker}` : ''}` : c.serving_utility || '—'],
              dem && ['your load', `${(load / dem * 100).toFixed(1)}% of night demand`],
              cf != null && ['from fossil at the 2025 mix', `${n0(load * (1 - cf))} of ${n0(load)} MW`],
              c.detector?.rank && ['new flat load already showing up', `#${c.detector.rank} of ${c.detector.n_scored || 111} · ${c.detector.growth_pct > 0 ? '+' : ''}${Math.round(c.detector.growth_pct)}% since 2019`],
              ['siting rank', c.siting?.siting_rank ? `${c.siting.siting_rank} of ${c.siting.n_ranked}` : '—'],
            ]} />
            {prof && <div style={{ marginTop: 12 }}><HourBars values={prof} caption="Clean share by hour, 2025 (night in ember)" /></div>}
            {cav && <div className="banner banner-error" style={{ marginTop: 10 }}>{cav}</div>}
            {c.cf_inherited_from_ba && <p className="note" style={{ marginTop: 8 }}>Generation figures are for the whole grid this place sits on; demand is local. Operator is hand-mapped.</p>}
          </>
        ) }
      }),
      ...(answer.best && regs.data && nearbyModule.applies({ regions: regs.data, region_id: answer.best.region_id }) ? [{ id: 'nearby', title: `${nearbyModule.title} · ${answer.best.metro}`, render: () => nearbyModule.render({ regions: regs.data, region_id: answer.best.region_id, load_mw: load }) }] : []),
      { id: 'method', title: 'How we rank', render: () => <p className="note">{data.method}</p> },
      { id: 'night', title: 'Why night matters', render: () => (
        <>
          {nat ? <div className="nums" style={{ marginTop: 0 }}><Num num={(nat['2025']?.daytime ?? 0) * 100} format={pctFmt} label="clean during the day, 2025" sub={`${pct1(nat['2019']?.daytime)} in 2019`} /><Num num={(nat['2025']?.overnight ?? 0) * 100} format={pctFmt} label="clean at night, 2025" sub={`${pct1(nat['2019']?.overnight)} in 2019`} accent /><Num value="½" label="of a datacenter's power is used at night" /></div> : <p className="note">National series not available from this data source.</p>}
          <p className="note" style={{ marginTop: 10 }}>Solar cleaned up the middle of the day and did nothing for the middle of the night. Flat load lands half of itself in the hours that have not improved since 2019. <a href={href.found('sweep')} className="ink2">See it →</a></p>
        </>
      ) },
      { id: 'landing', title: 'Where new flat load is already showing up', render: () => <div className="rows">{top.map(r => <a className="row" key={r.id} href={href.region(r.id)}><div><div className="t">{r.known_cluster_label || r.name}</div><div className="d">{r.pattern}{r.data_flagged ? ' · data flagged' : ''}</div></div><div className="n">#{r.rank} <small>+{Math.round(r.growth_pct)}%</small></div></a>)}<a className="note" href={href.found('detector')} style={{ display: 'block', marginTop: 8 }}>All 111 →</a></div> },
    ]
    column = (
      <>
        <Card title={<><b>Compare</b> · {n0(data.request.mw)} MW of flat load{data._computed_client_side && ' · ranked here from the frozen score'}</>} right={<CopyButton text={() => window.location.href} label="Copy link" />} onClose={back}>
          {form}
          {picker}
          {data.unmapped.length > 0 && <div className="banner">Not in the data: {data.unmapped.join(', ')}. Try a nearby city or a grid name.</div>}
        {cands.length === 0 && <p className="note" style={{ margin: '8px 0 12px' }}>Nothing to rank yet. Add a place above, or start from the example: <Chip small href={href.compare(DEMO_COMPARE)}>{DEMO_COMPARE.mw} MW: {DEMO_COMPARE.metros.join(' vs ')}</Chip></p>}
          <h1 className="verdict">{answer.sentence}</h1>
          <div className="nums" style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(3, cands.length))}, 1fr)` }}>{answer.numbers.map((n, i) => <Num key={i} num={n.raw != null ? n.raw * 100 : undefined} format={pctFmt} value={n.value} label={n.label} sub={whatIf ? shapeDef.label : n.sub} accent={n.accent} />)}</div>
          <div className="sharebar" aria-hidden="true">{cands.map(c => { const v = c.siting?.overnight_cf_share_2025 ?? 0; return <span key={c.region_id} className={c === answer.best ? 'best' : ''} style={{ width: `${Math.max(2, v * 100) / cands.length}%` }} title={`${c.metro} ${pct0(v)}`} /> })}</div>
          {answer.best?.siting?.overnight_cf_share_2025 != null && <p className="note live" style={{ marginTop: 10 }}>At <b>{n0(Number(mw) || load)} MW</b>, {answer.best.metro} would draw about <b>{n0((Number(mw) || load) * (1 - answer.best.siting.overnight_cf_share_2025))} MW</b> from fossil generation {whatIf ? 'over those hours' : 'at night'} on the 2025 mix{cands[1]?.siting?.overnight_cf_share_2025 != null ? <>, versus <b>{n0((Number(mw) || load) * (1 - cands[1].siting.overnight_cf_share_2025))} MW</b> in {cands[1].metro}</> : null}. Average mix, not marginal.</p>}
          {!whatIf && <p className="note" style={{ marginTop: 8 }}>Ranked on clean power at night, whether it is improving, and clean power relative to demand. Equal weight, frozen before any result was seen.</p>}
          <Evidence open={evidence} onToggle={toggle} label="Show why" />
        </Card>
        {evidence && <Workspace id="compare" modules={modules} />}
      </>
    )
  }
  return <Shell page="compare" globe={globe} column={column} />
}
