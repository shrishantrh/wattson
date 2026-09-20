import { useMemo, useState } from 'react'
import Shell, { fitView } from '../console/Console.jsx'
import { Card, Num, Chip, KV, Ring, HourBars } from '../console/widgets.jsx'
import Workspace from '../components/Workspace.jsx'
import Sparkline from '../components/Sparkline.jsx'
import { CopyButton } from '../components/CopyButton.jsx'
import { loadSite, loadOpening, loadRegions, useAsync, useRegionDetails, hourProfile, nightSeries } from '../lib/data.js'
import { nearbyModule } from '../components/modules/NearbyModule.jsx'
import { readTokens } from '../lib/tokens.js'
import { compareAnswer, caveatFor, pct0, pct1, gw1, n0, signedGw } from '../lib/findings.js'
import { resolvePlace, DEMO_COMPARE } from '../lib/query.js'
import { SHAPES, FLEX_FRACTION, cleanShareFor, shiftable, profileOf } from '../lib/shape.js'
import ShapePicker from '../components/ShapePicker.jsx'
import CmpOverlay from '../components/CmpOverlay.jsx'
import { buildVs, MODES, parseVs } from '../lib/cmpData.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { href } from '../router.js'
import { Bolt, Layers, Info, Place, Pin, Night, ChevronDown, ChevronUp } from '../components/Icons.jsx'
import Breadcrumbs, { useCrumbs } from '../components/Breadcrumbs.jsx'
import '../styles/answer.css'
import '../styles/compare.css'

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
// The one thing to do next, and the only solid control on the screen. Two lines: what the click
// gives you, and that it opens on this page instead of navigating away. Once the evidence is
// open the action is only a way back, so it drops to a quiet outline and says so.
function NextAction({ open, onToggle, label, sub }) {
  return (
    <button type="button" className={`ans-next${open ? ' is-open' : ''}`} aria-expanded={open} onClick={onToggle}>
      <span className="ans-next-t">{open ? 'Hide the evidence' : label}</span>
      <span className="ans-next-d">{open ? 'the ranking stays' : sub}</span>
      {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
    </button>
  )
}
// A disclosure summary that says whether it is open, in words as well as in the caret.
const Disc = ({ children }) => <summary><span>{children}</span><span className="ans-disc" aria-hidden="true" /></summary>

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
  // The side-by-side screen. It rides in the URL so a comparison can be sent to someone, and it
  // opens on its own when you arrive at Compare with nothing named yet: two things side by side
  // is what you came for, and an empty ranking is not an answer to anything.
  const vs = useMemo(() => parseVs(route.params?.vs), [route.params?.vs])
  const [dismissed, setDismissed] = useState(false)
  const overlayOpen = !!vs || (!route.metros.length && !dismissed)
  const openVs = (mode, a = '', b = '') => { window.location.hash = href.compare({ ...request, evidence, vs: buildVs({ mode, a, b }) }) }
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
  // The grids already on this page open the side-by-side screen, so it starts on the comparison
  // the reader was halfway through rather than on a default pair.
  const seedKey = cands.map(c => c.region_id).join('|')
  const seedRegions = useMemo(() => seedKey.split('|').filter(Boolean), [seedKey])
  const globe = useMemo(() => {
    const pts = cands.filter(c => c.lat != null)
    return { view: fitView(pts), points: pts.map(c => ({ id: c.region_id, lat: c.lat, lng: c.lng, r: 0.2, color: c === answer?.best ? tk.accent : tk.ink2 })), rings: pts.filter(c => c === answer?.best).map(c => ({ id: c.region_id, lat: c.lat, lng: c.lng, color: tk.accent, maxR: 3, speed: 0.8, period: 1600 })),
      markers: pts.map(c => ({ id: c.region_id, lat: c.lat, lng: c.lng, label: `${c.rank}  ${c.metro} · ${pct0(c.siting?.overnight_cf_share_2025)}`, tip: `${c.metro}: ${pct1(c.siting?.overnight_cf_share_2025)} clean at night, ${trend(c.siting?.ratio_slope_per_year)}${c.detector?.rank ? `, flat-load rank #${c.detector.rank}` : ''}`, href: href.region(c.region_id), color: c === answer?.best ? tk.accent : tk.ink2, lead: c === answer?.best })) }
  }, [cands, answer, tk])
  const go = (m = request.metros, load = mw) => { window.location.hash = href.compare({ mw: Number(load) || 300, metros: m, evidence }) }
  const addMetro = e => { e.preventDefault(); const m = resolvePlace(add); if (m && !request.metros.some(x => resolvePlace(x)?.region_id === m.region_id)) go([...request.metros, m.metro]); setAdd('') }
  const toggle = () => { window.location.hash = href.compare({ ...request, evidence: !evidence }) }
  const nat = found.data?.national?.cf_share, natMw = found.data?.national?.cf_avg_mw, top = (found.data?.detector?.regions || []).filter(r => r.rank <= 5)

  const form = (
    <form className="formline" onSubmit={e => { e.preventDefault(); go() }}>
      <input className="field" type="number" min="1" value={mw} onChange={e => setMw(e.target.value)} style={{ width: 74 }} aria-label="Load in MW" /><span className="muted" style={{ fontSize: 11 }}>MW</span>
      {request.metros.map(m => <Chip key={m} small onRemove={request.metros.length > 1 ? () => go(request.metros.filter(x => x !== m)) : undefined}>{resolvePlace(m)?.metro || m}</Chip>)}
      <input className="field" value={add} onChange={e => setAdd(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addMetro(e) }} placeholder="+ add a place" style={{ width: 132 }} aria-label="Add a place" />
      <button className="btn" type="submit">Rank</button>
    </form>
  )
  // One control group, below the answer it changes. The two halves behave differently and say so:
  // the request is a form and waits for Rank, the load shape re-ranks the list on the spot.
  const controls = (
    <div className="ans-controls">
      <span className="ans-controls-k">Change the question</span>
      {form}
      <p className="note">How much load, and where. The list re-ranks when you press Rank.</p>
      <div className="ans-controls-sub">
        <span className="ans-controls-k">load shape · re-ranks live</span>
        <ShapePicker value={shape} onChange={setShape} flexible={flexible} onFlexible={setFlexible} />
        <p className="note">{whatIf ? `Ranked on clean share over the hours a ${shapeLabel} load uses.` : 'Pick a shape to re-rank on the hours it uses. No Rank needed.'}</p>
      </div>
    </div>
  )

  let column
  if (loading) column = <><Breadcrumbs trail={crumbs} /><Card className="ans-card" title={<><b>Compare</b> · {request.mw} MW</>}><div className="ans-controls">{form}</div><Loading what="the ranking" /></Card></>
  else if (error) column = <><Breadcrumbs trail={crumbs} /><Card className="ans-card" title={<b>Compare</b>}><div className="ans-controls">{form}</div><ErrorState error={error} onRetry={reload} /></Card></>
  else {
    const load = Number(data.request.mw)
    const modules = [
      ...cands.map(c => {
        const cf = c.siting?.overnight_cf_share_2025, dem = c.demand?.overnight_avg_mw, cav = caveatFor(c.region_id), d = details[c.region_id], series = nightSeries(d), prof = hourProfile(d)
        return { id: `cand-${c.region_id}`, title: <><Place size={13} className="ans-micon" /><span style={{ color: c === answer.best ? 'var(--accent)' : 'var(--ink)' }}>{c.rank}. {c.metro}</span> · {c.grid_label} · <a href={href.region(c.region_id)} className="ink2">detail →</a></>, render: () => (
          <>
            <div className="instrument"><Ring value={cf} /><div className="num"><div className="v" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{pct1(cf)}{series && <Sparkline values={series} width={72} height={20} accentLast baseline title="clean at night, 2019 to 2025" />}</div><div className="l">{whatIf ? `clean power in the hours a ${shapeLabel} load runs` : 'clean power at night'}, 2025 · {trend(c.siting?.ratio_slope_per_year)}</div></div></div>
            <KV rows={[
              ['since 2019', c.siting?.change_since_2019 != null ? `${c.siting.change_since_2019 > 0 ? '+' : ''}${(c.siting.change_since_2019 * 100).toFixed(1)} pts` : '—'],
              ['clean power vs night demand', c.siting?.overnight_clean_mw_over_demand != null ? `${c.siting.overnight_clean_mw_over_demand.toFixed(2)}×` : '—'],
              c.filled_by && ['last growth filled by', <span key="f" className={c.filled_by.fuel === 'gas' ? 'accent' : ''}>{c.filled_by.fuel} {signedGw(c.filled_by.gw)}</span>],
              ['served by', c.operator ? `${c.operator.utility}${c.operator.ticker ? ` · ${c.operator.ticker}` : ''}` : c.serving_utility || '—'],
              dem && ['your load', `${(load / dem * 100).toFixed(1)}% of night demand`],
              cf != null && ['fossil at the 2025 mix', `${n0(load * (1 - cf))} of ${n0(load)} MW`],
              c.detector?.rank && ['flat-load rank', `#${c.detector.rank} of ${c.detector.n_scored || 111} · ${c.detector.growth_pct > 0 ? '+' : ''}${Math.round(c.detector.growth_pct)}% since 2019`],
              ['siting rank', c.siting?.siting_rank ? `${c.siting.siting_rank} of ${c.siting.n_ranked}, 1 is best` : '—'],
            ]} />
            {prof && <div style={{ marginTop: 12 }}><HourBars values={prof} caption="Clean share by hour, 2025 (night hours marked)" /></div>}
            {cav && <div className="banner banner-error" style={{ marginTop: 10 }}>{cav}</div>}
            {c.cf_inherited_from_ba && <p className="note" style={{ marginTop: 8 }}>Generation is for the whole grid; demand is local. Operator hand-mapped.</p>}
          </>
        ) }
      }),
      ...(answer.best && regs.data && nearbyModule.applies({ regions: regs.data, region_id: answer.best.region_id }) ? [{ id: 'nearby', title: mtitle(Pin, `${nearbyModule.title} · ${answer.best.metro}`), render: () => nearbyModule.render({ regions: regs.data, region_id: answer.best.region_id, load_mw: load }) }] : []),
      { id: 'night', title: mtitle(Night, 'Why night matters'), render: () => (
        <>
          {nat ? <div className="nums" style={{ marginTop: 0 }}><Num num={(nat['2025']?.daytime ?? 0) * 100} format={pctFmt} label="clean during the day, 2025" sub={`${pct1(nat['2019']?.daytime)} in 2019`} /><Num num={(nat['2025']?.overnight ?? 0) * 100} format={pctFmt} label="clean at night, 2025" sub={`${pct1(nat['2019']?.overnight)} in 2019`} accent /><Num value="½" label="of a flat load runs at night" /></div> : <p className="note">National series not available from this data source.</p>}
          <p className="note" style={{ marginTop: 10 }}>Solar cleaned up midday and did nothing for the middle of the night, which is where flat load puts half of itself.{natMw ? ` Clean output at night did grow, ${gw1(natMw['2019']?.overnight)} to ${gw1(natMw['2025']?.overnight)}; total night generation grew faster, so the share slipped.` : ''} <a href={href.found('sweep')} className="ink2">See it →</a></p>
        </>
      ) },
      { id: 'landing', title: mtitle(Bolt, 'Where flat load is landing'), render: () => <div className="rows">{top.map(r => <a className="row" key={r.id} href={href.region(r.id)}><div><div className="t">{r.known_cluster_label || r.name}</div><div className="d">{r.pattern}{r.data_flagged ? ' · data flagged' : ''}</div></div><div className="n">#{r.rank} <small>demand +{Math.round(r.growth_pct)}%</small></div></a>)}<a className="note" href={href.found('detector')} style={{ display: 'block', marginTop: 8 }}>All 111 grids →</a></div> },
    ]
    const bestShare = answer.best?.siting?.overnight_cf_share_2025
    const bestTone = bestShare != null && bestShare >= 0.5 ? 'clean' : 'fossil'
    const [cmpLead, cmpRest] = leadRest(answer.sentence)
    // True when rank order and the displayed figure disagree anywhere in the list: some place
    // below outranks a place above it on the number the reader can see.
    const shareOf = c => c.siting?.overnight_cf_share_2025 ?? -1
    const disagree = cands.some((c, i) => cands.slice(i + 1).some(o => shareOf(o) > shareOf(c)))
    column = (
      <>
        <Breadcrumbs trail={crumbs} />
        <Zone icon={Bolt} right={<span className="chip sm ans-chip">{whatIf ? shapeLabel : 'flat 24/7'}</span>}>Answer</Zone>
        <div className="ans-sticky">
          <span className="ans-sticky-name"><Place size={13} />{n0(data.request.mw)} MW · {cands.length} place{cands.length === 1 ? '' : 's'}</span>
          {answer.best && <span className="ans-sticky-v"><b>{answer.best.metro}</b> · <b className={bestTone}>{pct0(bestShare)}</b> clean</span>}
        </div>
        <Card className="ans-card" title={<><b>Compare</b> · {n0(data.request.mw)} MW of flat load{data._computed_client_side && ' · ranked in your browser'}</>} right={<CopyButton text={() => window.location.href} label="Copy link" />}>
          {data.unmapped.length > 0 && <div className="banner">No data for {data.unmapped.join(', ')}. Try a nearby city or a grid name.</div>}
          <h1 className="verdict ans-lead">{cmpLead}</h1>
          {cmpRest && !disagree && <p className="ans-rest">{cmpRest}</p>}
          {cands.length === 0 && <p className="note" style={{ marginTop: 12 }}>Add a place below, or start from the example: <Chip small href={href.compare(DEMO_COMPARE)}>{DEMO_COMPARE.mw} MW: {DEMO_COMPARE.metros.join(' vs ')}</Chip></p>}
          {answer.numbers.length > 0 && (
            <>
              {/* The list is ordered on the score; the figure beside each place is its clean share.
                  When the two disagree the generated sentence that explains it is pulled out of the
                  paragraph and set against the list, so the order cannot be read without it. */}
              {cmpRest && disagree && <p className="ans-rank-note">{cmpRest}</p>}
              <div className="ans-rank-h">
                <span>{cands.length < 2 ? 'the one place you asked' : whatIf ? `ranked on ${shapeDef.label} hours` : 'ranked on the siting score'}</span>
                <span>{whatIf ? 'clean over those hours' : 'clean at night, 2025'}</span>
              </div>
              <ol className="ans-rank">
                {answer.numbers.map((n, i) => (
                  <li key={i} className={i === 0 ? 'is-best' : ''}>
                    <span className="ans-rank-n">{i + 1}</span>
                    <span className="ans-rank-name">{n.label.replace(/^\d+\.\s*/, '')}</span>
                    <span className="ans-rank-t">{whatIf ? shapeDef.label : n.sub}</span>
                    <span className={`ans-rank-v ${i === 0 ? bestTone : ''}`}>{n.value}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
          {cands.length > 1 && <div className="sharebar" aria-hidden="true">{cands.map(c => { const v = c.siting?.overnight_cf_share_2025 ?? 0; return <span key={c.region_id} className={c === answer.best ? 'best' : ''} style={{ width: `${Math.max(2, v * 100) / cands.length}%` }} title={`${c.metro} ${pct0(v)}`} /> })}</div>}
          {bestShare != null && <p className="note live" style={{ marginTop: 12 }}>At <b>{n0(Number(mw) || load)} MW</b>, {answer.best.metro} would draw about <b>{n0((Number(mw) || load) * (1 - bestShare))} MW</b> of fossil {whatIf ? 'over those hours' : 'at night'} on the 2025 mix{cands[1]?.siting?.overnight_cf_share_2025 != null ? <>, versus <b>{n0((Number(mw) || load) * (1 - cands[1].siting.overnight_cf_share_2025))} MW</b> in {cands[1].metro}</> : null}. Average mix, not marginal.</p>}
          <NextAction open={evidence} onToggle={toggle} label="See the evidence" sub={`opens below · ${modules.length} cards`} />
          {controls}
          <details className="ans-why is-method">
            <Disc>How this ranking is made</Disc>
            <dl className="ans-dl">
              <div><dt>score</dt><dd>Clean power at night, its trend, and clean power against demand. Equal weight, frozen before any result was seen.</dd></div>
              {whatIf && <div><dt>what-if</dt><dd>Re-ranked on the clean share over the hours this shape uses; the frozen score is the flat case, and the evidence below is still measured over the night hours.</dd></div>}
            </dl>
          </details>
        </Card>
        <Zone icon={Place}>Head to head</Zone>
        <Card className="ans-card" title={<><b>Any two, side by side</b> · the difference, at {n0(Number(mw) || load)} MW</>}>
          <p className="note">Opens over this page. Two grids, two operators, or two individual datacenters, with the megawatts behind every share and the difference worked out in the third column.</p>
          <div className="cmp-launch">
            {MODES.map(m => (
              <button key={m.id} type="button" className="cmp-launch-b" onClick={() => (m.id === 'region' ? openVs('region', cands[0]?.region_id || '', cands[1]?.region_id || '') : openVs(m.id))}>
                <span className="t">{m.label}</span>
                <span className="d">{m.blurb}</span>
              </button>
            ))}
          </div>
        </Card>
        {evidence && (
          <>
            <Workspace id="compare" modules={modules} title={<span className="ans-mtitle"><Layers size={13} />Evidence<em className="ans-count">{modules.length}</em></span>} />
            <Zone icon={Info}>Caveats</Zone>
            <section className="card ans-tail">
              <p className="ans-tail-sum">The ranking rule, and what it does not mean.</p>
              <ul className="ans-list"><li>{data.method}</li><li>Average mix inside each grid's footprint, not marginal emissions and not consumption: imports are not allocated.</li></ul>
            </section>
          </>
        )}
      </>
    )
  }
  return (
    <>
      <Shell page="compare" globe={globe} column={column} />
      {/* Keyed on the link itself: the screen owns its selection once it is open and writes the
          link back in place, so only a real navigation (a shared link, a launcher button, the
          back button) starts it over from the URL. */}
      <CmpOverlay
        key={route.params?.vs || 'auto'}
        open={overlayOpen}
        mode={vs?.mode}
        a={vs?.a}
        b={vs?.b}
        mw={Number(mw) || request.mw}
        seedRegions={seedRegions}
        onClose={() => setDismissed(true)}
      />
    </>
  )
}
