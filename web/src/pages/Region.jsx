import { useMemo } from 'react'
import Shell from '../console/Console.jsx'
import { Card, Num, Chip } from '../console/widgets.jsx'
import Workspace from '../components/Workspace.jsx'
import { CopyButton } from '../components/CopyButton.jsx'
import WxHourScrub from '../components/WxHourScrub.jsx'
import WxYearSeries from '../components/WxYearSeries.jsx'
import { applicableModules } from '../components/modules/index.js'
import coords from '../data/region_coords.json'
import { loadRegion, loadRegions, useAsync } from '../lib/data.js'
import { nearbyModule } from '../components/modules/NearbyModule.jsx'
import { readTokens } from '../lib/tokens.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { regionTitle, pts1, n0 } from '../lib/findings.js'
import { summarize, orderEvidence, EVIDENCE_ORDER } from '../lib/regionSummary.js'
import Breadcrumbs, { useCrumbs } from '../components/Breadcrumbs.jsx'
import { Bolt, Layers, Info } from '../components/Icons.jsx'
import { href, useHash } from '../router.js'
import '../styles/wx.css'

// The dossier for one place: the place and its three defining numbers, any data flag, then the
// sentence and what 300 MW here would run on, then the evidence in order of importance.
const LOAD_MW = 300
const COLUMN = 460
const pctFmt = n => `${n.toFixed(1)}%`
const mwFmt = n => n0(n)
const ptsValue = x => (x == null ? '—' : pts1(x).replace(' pts', ''))

function NotFoundState({ label, error }) {
  const avail = (error?.available || []).filter(Boolean)
  return (
    <>
      <h1 className="verdict">We don't have {label}.</h1>
      <p className="note" style={{ marginTop: 10 }}>{avail.length ? <>Grids we do cover: {avail.map(r => <Chip key={r} small href={href.region(r)}>{coords.regions[r]?.label || r}</Chip>)}</> : 'No grid in the EIA-930 data matches that name.'}</p>
    </>
  )
}

// ANSWER first, then EVIDENCE: the column's information architecture, labelled.
function SectionLabel({ icon: Icon, children, count }) {
  return <div className="bc-sect"><Icon size={13} />{children}{count != null && <span className="bc-count">{count} {count === 1 ? 'module' : 'modules'}</span>}</div>
}

export default function Region({ route }) {
  const id = route.id
  const crumbs = useCrumbs(useHash())
  const { loading, error, data, reload } = useAsync(() => loadRegion(id), [id])
  const regs = useAsync(loadRegions, [])
  const tk = useMemo(() => readTokens(), [])
  const c = coords.regions[id]
  const label = c?.label || data?.name || id
  const globe = useMemo(() => (c ? {
    view: { lat: c.lat, lng: c.lng, altitude: 0.95 }, interactive: true,
    points: [{ id, lat: c.lat, lng: c.lng, r: 0.22, color: tk.accent }],
    rings: [{ id, lat: c.lat, lng: c.lng, color: tk.accent, maxR: 3, speed: 0.8, period: 1600 }],
    markers: [{ id, lat: c.lat, lng: c.lng, label: c.label, color: tk.accent }],
  } : { interactive: true }), [c, id, tk])
  const back = () => { if (window.history.length > 1) window.history.back(); else window.location.hash = href.landing() }

  const s = useMemo(() => (data ? summarize(data, id, { loadMW: LOAD_MW, coords: c }) : null), [data, id, c])
  // A zone reports demand only, so every generation series below is its parent grid's. The
  // engine's correction overlay (AZPS's 2019 counted a plant SRP also reported) is applied
  // here rather than in the components, so what is drawn is what the engine stands behind.
  const gen = data && data.type === 'zone' && data.parent && typeof data.parent === 'object' ? data.parent : data
  const corr = useMemo(() => (data?.corrections?.corrections || gen?.corrections?.corrections || []), [data, gen])
  const prof24 = useMemo(() => {
    const raw = gen?.profile_24h
    if (!raw) return null
    if (Array.isArray(raw)) return { 2025: raw }
    const fixed = corr.find(x => x.path === 'profile_24h.2019')?.corrected
    return fixed ? { ...raw, 2019: fixed } : raw
  }, [gen, corr])
  const ctx = useMemo(() => ({ detail: data, region_id: id, load_mw: LOAD_MW }), [data, id])
  const modules = useMemo(() => {
    if (!data) return []
    const hours = {
      id: 'hours',
      title: 'A flat load buys every one of these hours, walk through them',
      render: () => <WxHourScrub profile={prof24} loadMW={LOAD_MW} corrected2019={corr.some(x => x.path === 'profile_24h.2019')} />,
    }
    const series = {
      id: 'series',
      title: 'Clean share or clean megawatts, the two do not have to move together',
      render: () => <WxYearSeries share={gen?.cf_share} clean={gen?.cf_avg_mw} total={gen?.total_avg_mw} corrections={corr} label={s?.inherited ? `the ${s.grid} grid` : (s?.label || 'this grid')} />,
    }
    const rest = applicableModules(ctx).map(m => ({ id: m.id, title: m.title, render: () => m.render(ctx), default: m.id !== 'heatmap' }))
    const nb = regs.data && nearbyModule.applies({ regions: regs.data, region_id: id }) ? [{ id: 'nearby', title: nearbyModule.title, render: () => nearbyModule.render({ regions: regs.data, region_id: id, load_mw: 300 }) }] : []
    return orderEvidence([hours, series, ...rest, ...nb], ['hours', 'series', ...EVIDENCE_ORDER.slice(1)])
  }, [data, prof24, gen, corr, s, ctx, regs.data, id])

  if (loading || error) {
    const title = <><b>{c?.place || label}</b>{c ? ` · ${id.split('/')[0]} grid` : ''}</>
    const col = <><Breadcrumbs trail={crumbs} onBack={back} /><Card title={title}>{loading ? <Loading what={label} /> : error.name === 'NotFound' ? <NotFoundState label={label} error={error} /> : <ErrorState error={error} onRetry={reload} />}</Card></>
    return <Shell page="region" globe={globe} column={col} columnWidth={COLUMN} />
  }

  const t = regionTitle(data, label)
  const flag = s.flagged ? 'Data flagged' : s.corrected ? '2019 corrected' : null
  // when the note is headed "data flagged" or "2019 corrected", the fact would only repeat it
  const facts = [
    s.inherited && { key: 'inherited', text: `generation below is the whole ${s.grid} grid, not this zone alone` },
    !flag && s.corrected && { key: 'corrected', text: '2019 corrected' },
    !flag && s.flagged && { key: 'flagged', text: 'data flagged' },
  ].filter(Boolean)
  const column = (
    <>
      <Breadcrumbs trail={crumbs} onBack={back} />
      <SectionLabel icon={Bolt}>Answer</SectionLabel>
      <Card>
        {/* the place first, then the three numbers that define it, then the sentence */}
        <div className="rg-head">
          <h1 className="rg-place">{s.place || s.label}</h1>
          <span className="rg-grid">{s.grid ? `${s.grid} grid` : id}</span>
          {s.rank != null && <span className="rg-rank">flat load <b>#{s.rank}</b> of {s.n_scored ?? 111}</span>}
        </div>
        <div className="nums rg-nums">
          <Num num={s.night2025 != null ? s.night2025 * 100 : undefined} value=", " format={pctFmt} label="clean at night, 2025" accent />
          <Num value={ptsValue(s.change)} label={`pts since 2019${s.corrected ? ', corrected' : ''}`} sub={s.night2019 != null ? `from ${Math.round(s.night2019 * 100)}%${s.cleanDelta != null ? `, clean output ${s.cleanDelta > 0 ? '+' : s.cleanDelta < 0 ? '−' : ''}${Math.abs(s.cleanDelta).toFixed(1)} GW` : ''}` : null} />
          <Num num={s.demandNight2025 ?? undefined} value=", " format={mwFmt} label="MW at night, 2025" sub={s.demandNight2019 != null ? `${n0(s.demandNight2019)} in 2019` : null} />
        </div>
        {/* flagged or corrected data comes before anything a reader could take at face value */}
        {(facts.length > 0 || s.caveat) && (
          <div className={flag ? 'rg-flag' : 'bc-note'}>
            <Info size={14} />
            <div className="rg-flag-b">
              {flag && <div className="rg-flag-t">{flag}</div>}
              {facts.length > 0 && <p>{facts.map(f => f.text).join(' · ')}</p>}
              {s.caveat && <p>{s.caveat}</p>}
            </div>
          </div>
        )}
        <p className="rg-verdict">{t.title}</p>
        {s.pattern && <p className="note" style={{ marginTop: 6 }}>Pattern: {s.pattern}</p>}
        {s.runsOn && <p className="rg-say"><b>What {LOAD_MW} MW here would run on:</b> {s.runsOn}</p>}
        <div className="rg-acts">
          <Chip href={href.compare({ mw: LOAD_MW, metros: [id] })}>Compare {LOAD_MW} MW here</Chip>
          <CopyButton text={() => window.location.href} label="Copy link" />
        </div>
      </Card>
      <SectionLabel icon={Layers} count={modules.length}>Evidence</SectionLabel>
      <p className="note" style={{ margin: '-4px 0 10px 2px' }}>The first two are live: scrub the 24 hours to see what a flat load buys at any one of them, and switch the yearly series between the clean share and the megawatts behind it, a falling share is not the same thing as less clean power.</p>
      <Workspace id="region" modules={modules} />
    </>
  )
  return <Shell page="region" globe={globe} column={column} columnWidth={COLUMN} />
}
