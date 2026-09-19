import { useMemo } from 'react'
import Shell from '../console/Console.jsx'
import { Card, Num, HourBars, Chip } from '../console/widgets.jsx'
import Workspace from '../components/Workspace.jsx'
import { CopyButton } from '../components/CopyButton.jsx'
import { applicableModules } from '../components/modules/index.js'
import coords from '../data/region_coords.json'
import { loadRegion, loadRegions, useAsync, hourProfile } from '../lib/data.js'
import { nearbyModule } from '../components/modules/NearbyModule.jsx'
import { readTokens } from '../lib/tokens.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { regionTitle, pts1, n0 } from '../lib/findings.js'
import { summarize, orderEvidence } from '../lib/regionSummary.js'
import { href } from '../router.js'

// The dossier for one place: one sentence, four numbers, one line on what 300 MW here would run on,
// then the evidence in order of importance. Nothing shows that the source does not have.
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
      <p className="note" style={{ marginTop: 10 }}>{avail.length ? <>In this data source: {avail.map(r => <Chip key={r} small href={href.region(r)}>{coords.regions[r]?.label || r}</Chip>)}</> : 'This data source lists nothing for it.'}</p>
    </>
  )
}

export default function Region({ route }) {
  const id = route.id
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
  const prof = data ? hourProfile(data) : null
  const ctx = useMemo(() => ({ detail: data, region_id: id, load_mw: LOAD_MW }), [data, id])
  const modules = useMemo(() => {
    if (!data) return []
    const hours = { id: 'hours', title: 'Clean power by hour, 2025 (night hours marked)', render: () => (prof ? <HourBars values={prof} /> : <p className="note">No hourly profile in this data source.</p>) }
    const rest = applicableModules(ctx).map(m => ({ id: m.id, title: m.title, render: () => m.render(ctx), default: m.id !== 'heatmap' }))
    const nb = regs.data && nearbyModule.applies({ regions: regs.data, region_id: id }) ? [{ id: 'nearby', title: nearbyModule.title, render: () => nearbyModule.render({ regions: regs.data, region_id: id, load_mw: 300 }) }] : []
    return orderEvidence([hours, ...rest, ...nb])
  }, [data, prof, ctx, regs.data])

  if (loading || error) {
    const title = <><b>{c?.place || label}</b>{c ? ` · ${id.split('/')[0]} grid` : ''}</>
    return <Shell page="region" globe={globe} column={<Card title={title} onClose={back}>{loading ? <Loading what={label} /> : error.name === 'NotFound' ? <NotFoundState label={label} error={error} /> : <ErrorState error={error} onRetry={reload} />}</Card>} columnWidth={COLUMN} />
  }

  const t = regionTitle(data, label)
  const facts = [
    s.inherited && { key: 'inherited', text: `generation is the whole ${s.grid} grid` },
    s.corrected && { key: 'corrected', text: '2019 corrected' },
    s.flagged && { key: 'flagged', text: 'data flagged' },
  ].filter(Boolean)
  const eyebrow = <><b>{s.place || s.label}</b>{s.grid ? ` · ${s.grid} grid` : ''}</>
  const column = (
    <>
      <Card title={eyebrow} onClose={back}>
        {facts.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>{facts.map(f => <Chip key={f.key} small dim>{f.text}</Chip>)}</div>}
        <h1 className="verdict">{t.title}</h1>
        <div className="nums" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <Num num={s.night2025 != null ? s.night2025 * 100 : undefined} value="—" format={pctFmt} label="clean at night, 2025" accent />
          <Num value={ptsValue(s.change)} label={`pts since 2019${s.corrected ? ', corrected' : ''}`} sub={s.night2019 != null ? `from ${Math.round(s.night2019 * 100)}%` : null} />
          <Num value={s.rank != null ? `#${s.rank}` : '—'} label={`of ${s.n_scored ?? 111} for flat load`} sub={s.pattern} />
          <Num num={s.demandNight2025 ?? undefined} value="—" format={mwFmt} label="MW at night, 2025" sub={s.demandNight2019 != null ? `${n0(s.demandNight2019)} in 2019` : null} />
        </div>
        {s.runsOn && <p className="note" style={{ marginTop: 14, color: 'var(--ink-2)' }}><b style={{ color: 'var(--ink)' }}>What {LOAD_MW} MW here would run on:</b> {s.runsOn}</p>}
        {s.caveat && <div className="banner banner-error" style={{ marginTop: 12, marginBottom: 0 }}>{s.caveat}</div>}
        <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip href={href.compare({ mw: LOAD_MW, metros: [id] })}>Compare {LOAD_MW} MW here</Chip>
          <CopyButton text={() => window.location.href} label="Copy link" />
        </div>
      </Card>
      <Workspace id="region" modules={modules} />
    </>
  )
  return <Shell page="region" globe={globe} column={column} columnWidth={COLUMN} />
}
