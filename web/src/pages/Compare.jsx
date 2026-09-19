import { useMemo, useState } from 'react'
import Shell, { fitView } from '../console/Console.jsx'
import { Card, Num, Evidence, Section, Chip, KV, Ring, HourBars } from '../console/widgets.jsx'
import { loadSite, loadOpening, useAsync, useRegionDetails, hourProfile, nightSeries } from '../lib/data.js'
import { readTokens } from '../lib/tokens.js'
import { compareAnswer, caveatFor, pct0, pct1, n0, signedGw } from '../lib/findings.js'
import { matchMetro } from '../lib/query.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { href } from '../router.js'

const trend = s => (s == null ? '—' : `${s > 0 ? '+' : ''}${(s * 100).toFixed(1)} pts / yr`)

// Question 2: "Where should I put a datacenter so it runs on the cleanest power?"
export default function Compare({ route }) {
  const evidence = route.params?.evidence === '1'
  const request = useMemo(() => ({ mw: route.mw, metros: route.metros }), [route.mw, route.metros])
  const { loading, error, data, reload } = useAsync(() => loadSite(request), [request.mw, request.metros.join('|')])
  const found = useAsync(loadOpening, [])
  const tk = useMemo(readTokens, [])
  const [mw, setMw] = useState(request.mw)
  const [add, setAdd] = useState('')
  const cands = data?.candidates || []
  const answer = data ? compareAnswer(data) : null
  const details = useRegionDetails(evidence ? cands.map(c => c.region_id) : [])
  const globe = useMemo(() => {
    const pts = cands.filter(c => c.lat != null)
    return { view: fitView(pts), points: pts.map(c => ({ id: c.region_id, lat: c.lat, lng: c.lng, r: 0.2, color: c === answer?.best ? tk.accent : tk.ink2 })), rings: pts.filter(c => c === answer?.best).map(c => ({ id: c.region_id, lat: c.lat, lng: c.lng, color: tk.accent, maxR: 3, speed: 0.8, period: 1600 })),
      markers: pts.map(c => ({ id: c.region_id, lat: c.lat, lng: c.lng, label: `${c.rank}  ${c.metro} · ${pct0(c.siting?.overnight_cf_share_2025)}`, href: href.region(c.region_id), color: c === answer?.best ? tk.accent : tk.ink2, lead: c === answer?.best })) }
  }, [cands, answer, tk])
  const go = (m = request.metros, load = mw) => { window.location.hash = href.compare({ mw: Number(load) || 300, metros: m, evidence }) }
  const addMetro = e => { e.preventDefault(); const m = matchMetro(add); if (m && !request.metros.some(x => matchMetro(x)?.metro === m.metro)) go([...request.metros, m.metro]); setAdd('') }
  const back = () => { window.location.hash = href.landing() }
  const toggle = () => { window.location.hash = href.compare({ ...request, evidence: !evidence }) }
  const nat = found.data?.national?.cf_share, top = (found.data?.detector?.regions || []).filter(r => r.rank <= 5)

  const form = (
    <form className="formline" onSubmit={e => { e.preventDefault(); go() }}>
      <input className="field" type="number" min="1" value={mw} onChange={e => setMw(e.target.value)} style={{ width: 74 }} aria-label="Load in MW" /><span className="muted" style={{ fontSize: 12 }}>MW, 24/7</span>
      {request.metros.map(m => <Chip key={m} small onRemove={request.metros.length > 1 ? () => go(request.metros.filter(x => x !== m)) : undefined}>{m}</Chip>)}
      <input className="field" value={add} onChange={e => setAdd(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addMetro(e) }} placeholder="+ add a place" style={{ width: 132 }} aria-label="Add a place" />
      <button className="btn primary" type="submit">Rank</button>
    </form>
  )

  let column
  if (loading) column = <Card title={<><b>Compare</b> · {request.mw} MW</>} onClose={back}>{form}<Loading what="the ranking" /></Card>
  else if (error) column = <Card title={<><b>Compare</b></>} onClose={back}>{form}<ErrorState error={error} onRetry={reload} /></Card>
  else column = (
    <>
      <Card title={<><b>Compare</b> · {n0(data.request.mw)} MW of flat load{data._computed_client_side && ' · ranked here from the frozen score'}</>} onClose={back}>
        {form}
        {data.unmapped.length > 0 && <div className="banner">Not in our map yet: {data.unmapped.join(', ')}. Try a nearby major city.</div>}
        <h1 className="verdict">{answer.sentence}</h1>
        <div className="nums" style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(3, cands.length))}, 1fr)` }}>{answer.numbers.map((n, i) => <Num key={i} {...n} />)}</div>
        <p className="note" style={{ marginTop: 12 }}>Ranked on clean power at night, whether it is improving, and clean power relative to demand. Equal weight, frozen before any result was seen.</p>
        <Evidence open={evidence} onToggle={toggle} label="Show why" />
      </Card>
      {evidence && cands.map(c => {
        const cf = c.siting?.overnight_cf_share_2025, dem = c.demand?.overnight_avg_mw, load = Number(data.request.mw), cav = caveatFor(c.region_id)
        return (
          <Section key={c.region_id} title={<><b style={{ color: c === answer.best ? 'var(--accent)' : 'inherit' }}>{c.rank}. {c.metro}</b> · {c.grid_label}</>} right={<a href={href.region(c.region_id)}>Detail →</a>}>
            <div className="instrument"><Ring value={cf} /><div><div className="num"><div className="v">{pct1(cf)}</div><div className="l">clean power at night, 2025 · {trend(c.siting?.ratio_slope_per_year)}</div></div></div></div>
            <KV rows={[
              ['since 2019', c.siting?.change_since_2019 != null ? `${c.siting.change_since_2019 > 0 ? '+' : ''}${(c.siting.change_since_2019 * 100).toFixed(1)} pts` : '—'],
              ['clean power vs demand at night', c.siting?.overnight_clean_mw_over_demand != null ? `${c.siting.overnight_clean_mw_over_demand.toFixed(2)}×` : '—'],
              c.filled_by && ['what filled the last growth', <span key="f" className={c.filled_by.fuel === 'gas' ? 'accent' : ''}>{c.filled_by.fuel} {signedGw(c.filled_by.gw)}</span>],
              ['who serves the load', c.operator ? `${c.operator.utility}${c.operator.ticker ? ` · ${c.operator.ticker}` : ''}` : c.serving_utility || '—'],
              dem && ['your load', `${(load / dem * 100).toFixed(1)}% of night demand`],
              cf != null && ['from fossil at the 2025 mix', `${n0(load * (1 - cf))} of ${n0(load)} MW`],
              c.detector?.rank && ['new flat load already showing up', `#${c.detector.rank} of 111 · ${c.detector.growth_pct > 0 ? '+' : ''}${Math.round(c.detector.growth_pct)}% since 2019`],
              ['siting rank', c.siting?.siting_rank ? `${c.siting.siting_rank} of ${c.siting.n_ranked}` : '—'],
            ]} />
            {hourProfile(details[c.region_id]) && <div style={{ marginTop: 12 }}><HourBars values={hourProfile(details[c.region_id])} caption="Clean share by hour, 2025 (night in ember)" /></div>}
            {nightSeries(details[c.region_id]) && <p className="note" style={{ marginTop: 8 }}>Clean at night by year: {nightSeries(details[c.region_id]).map((v, i) => `${2019 + i} ${v == null ? '—' : Math.round(v * 100) + '%'}`).join(' · ')}</p>}
            {cav && <div className="banner banner-error" style={{ marginTop: 10 }}>{cav}</div>}
            {c.cf_inherited_from_ba && <p className="note" style={{ marginTop: 8 }}>Generation figures are for the whole grid this place sits on; demand is local. Operator is hand-mapped.</p>}
          </Section>
        )
      })}
      {evidence && (
        <>
          <Section title="How we rank"><p className="note">{data.method}</p></Section>
          <Section title="Why night matters" right={<a href={href.found('sweep')}>See it →</a>}>
            {nat ? <div className="nums" style={{ marginTop: 0 }}><Num value={pct0(nat['2025']?.daytime)} label="clean during the day, 2025" sub={`${pct0(nat['2019']?.daytime)} in 2019`} /><Num value={pct0(nat['2025']?.overnight)} label="clean at night, 2025" sub={`${pct0(nat['2019']?.overnight)} in 2019`} accent /><Num value="½" label="of a datacenter's power is used at night" /></div> : <p className="note">National series not available from this data source.</p>}
            <p className="note" style={{ marginTop: 10 }}>Solar cleaned up the middle of the day and did nothing for the middle of the night. Flat load lands half of itself in the hours that have not improved since 2019.</p>
          </Section>
          <Section title="Where new flat load is already showing up" right={<a href={href.found('detector')}>All 111 →</a>}>
            <div className="rows">{top.map(r => <a className="row" key={r.id} href={href.region(r.id)}><div><div className="t">{r.known_cluster_label || r.name}</div><div className="d">{r.pattern}{r.data_flagged ? ' · data flagged' : ''}</div></div><div className="n">#{r.rank} <small>+{Math.round(r.growth_pct)}%</small></div></a>)}</div>
          </Section>
        </>
      )}
    </>
  )
  return <Shell page="compare" globe={globe} column={column} />
}
