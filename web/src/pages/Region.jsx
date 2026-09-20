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
import Breadcrumbs, { useCrumbs } from '../components/Breadcrumbs.jsx'
import { Bolt, Layers, Info } from '../components/Icons.jsx'
import { href, useHash } from '../router.js'

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
  const prof = data ? hourProfile(data) : null
  const ctx = useMemo(() => ({ detail: data, region_id: id, load_mw: LOAD_MW }), [data, id])
  const modules = useMemo(() => {
    if (!data) return []
    const hours = { id: 'hours', title: 'A 24/7 load takes every hour, good and bad — clean power by hour, 2025', render: () => (prof ? <HourBars values={prof} /> : <p className="note">No hour-by-hour data for this grid, so we cannot show which hours here are clean.</p>) }
    const rest = applicableModules(ctx).map(m => ({ id: m.id, title: m.title, render: () => m.render(ctx), default: m.id !== 'heatmap' }))
    const nb = regs.data && nearbyModule.applies({ regions: regs.data, region_id: id }) ? [{ id: 'nearby', title: nearbyModule.title, render: () => nearbyModule.render({ regions: regs.data, region_id: id, load_mw: 300 }) }] : []
    return orderEvidence([hours, ...rest, ...nb])
  }, [data, prof, ctx, regs.data])

  if (loading || error) {
    const title = <><b>{c?.place || label}</b>{c ? ` · ${id.split('/')[0]} grid` : ''}</>
    const col = <><Breadcrumbs trail={crumbs} onBack={back} /><Card title={title}>{loading ? <Loading what={label} /> : error.name === 'NotFound' ? <NotFoundState label={label} error={error} /> : <ErrorState error={error} onRetry={reload} />}</Card></>
    return <Shell page="region" globe={globe} column={col} columnWidth={COLUMN} />
  }

  const t = regionTitle(data, label)
  const facts = [
    s.inherited && { key: 'inherited', text: `every generation figure below is the whole ${s.grid} grid, not this zone alone` },
    s.corrected && { key: 'corrected', text: 'the published 2019 baseline was wrong; the change above is measured from our corrected one' },
    s.flagged && { key: 'flagged', text: 'this grid’s data is flagged, so it raises no alerts' },
  ].filter(Boolean)
  const eyebrow = <><b>{s.place || s.label}</b>{s.grid ? ` · ${s.grid} grid` : ''}</>
  const column = (
    <>
      <Breadcrumbs trail={crumbs} onBack={back} />
      <SectionLabel icon={Bolt}>Answer</SectionLabel>
      <Card title={eyebrow}>
        <h1 className="verdict">{t.title}</h1>
        <div className="nums" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <Num num={s.night2025 != null ? s.night2025 * 100 : undefined} value="—" format={pctFmt} label="clean at night, 2025" sub={s.night2025 != null ? `${Math.round(100 - s.night2025 * 100)}% not carbon-free` : null} accent />
          <Num value={ptsValue(s.change)} label={`pts since 2019${s.corrected ? ', corrected' : ''}`} sub={s.night2019 != null ? `from ${Math.round(s.night2019 * 100)}%${s.cleanDelta != null ? `; clean output ${s.cleanDelta > 0 ? '+' : s.cleanDelta < 0 ? '−' : ''}${Math.abs(s.cleanDelta).toFixed(1)} GW` : ''}` : null} />
          <Num value={s.rank != null ? `#${s.rank}` : '—'} label={`of ${s.n_scored ?? 111} for round-the-clock load growth`} sub={s.pattern === 'flat-load growth' ? 'demand up in every hour' : s.pattern} />
          <Num num={s.demandNight2025 ?? undefined} value="—" format={mwFmt} label="MW at night, 2025" sub={s.demandNight2019 != null && s.demandNight2025 != null ? `${s.demandNight2025 >= s.demandNight2019 ? '+' : '−'}${n0(Math.abs(s.demandNight2025 - s.demandNight2019))} MW since 2019` : null} />
        </div>
        {s.runsOn && <p className="note" style={{ marginTop: 14, color: 'var(--ink-2)' }}><b style={{ color: 'var(--ink)' }}>Run {LOAD_MW} MW here around the clock:</b> {s.runsOn}</p>}
        {(facts.length > 0 || s.caveat) && (
          <div className="bc-note">
            <Info size={14} />
            <div>
              {facts.length > 0 && <p>{facts.map(f => f.text).join(' · ')}</p>}
              {s.caveat && <p>{s.caveat}</p>}
            </div>
          </div>
        )}
        <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip href={href.compare({ mw: LOAD_MW, metros: [id] })}>Where would this {LOAD_MW} MW be cleaner?</Chip>
          <CopyButton text={() => window.location.href} label="Copy link" />
        </div>
      </Card>
      <SectionLabel icon={Layers} count={modules.length}>Evidence</SectionLabel>
      <Workspace id="region" modules={modules} />
    </>
  )
  return <Shell page="region" globe={globe} column={column} columnWidth={COLUMN} />
}
