import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { loadFacilities, loadRegions, useAsync } from '../lib/data.js'
import { COMPANIES } from '../lib/query.js'
import { Close, Company as CompanyIcon, Layers, Place } from './Icons.jsx'
import { CopyButton } from './CopyButton.jsx'
import { Loading, ErrorState } from './States.jsx'
import CmpPicker from './CmpPicker.jsx'
import CmpCompany from './CmpCompany.jsx'
import CmpSite from './CmpSite.jsx'
import WxHeadToHead from './WxHeadToHead.jsx'
import { buildVs, isMode, labelOfId, MODES, placeOfId, plural, regionName, siteId, siteName } from '../lib/cmpData.js'
import '../styles/compare.css'

// The comparison screen. It comes over the page, the globe and the column, because a
// comparison is the whole task while you are doing it, not a note in the margin.
//
// Three things can go on either side: a grid, an operator, or one datacenter. The mode and
// both sides ride in the URL (vs=company:META,GOOGL), so a comparison is a link someone can
// send. Selection changes rewrite that link in place rather than pushing history, so the
// back button still means "the page I came from" and Escape still means "put this away".

const ICON = { region: Place, company: CompanyIcon, site: Layers }
const TITLE = {
  region: 'Two grids, side by side',
  company: 'Two operators, side by side',
  site: 'Two datacenters, side by side',
}
const BLURB = {
  region: 'Both columns are read off the same export, so the third column is arithmetic.',
  company: 'Grid-only, and unweighted across sites: the basis each operator’s published walk score uses.',
  site: 'Each site is placed by the utility that serves it, then settled against the grid underneath it.',
}
// What a search in this mode can match on, so the empty result says what to type next.
const HINT = {
  region: 'Try a shorter word, a state, a place name, or a grid id like PJM/DOM.',
  company: 'Try an operator name, a ticker, or a grid id like PJM/DOM. A utility name finds sites, not operators.',
  site: 'Try an operator, a city, a state, a utility, or a grid id like PJM/DOM.',
}

// The hash, with one parameter changed and nothing else touched.
function hashWith(vs) {
  const [path, query = ''] = String(window.location.hash || '#/').replace(/^#/, '').split('?')
  const p = new URLSearchParams(query)
  if (vs) p.set('vs', vs)
  else p.delete('vs')
  const q = p.toString()
  return `#${path}${q ? `?${q}` : ''}`
}

export default function CmpOverlay({ open, mode: modeIn, a: aIn, b: bIn, seedRegions = [], mw = 300, onClose }) {
  const regs = useAsync(loadRegions, [])
  const facs = useAsync(loadFacilities, [])
  const panelRef = useRef(null)

  const regions = useMemo(() => regs.data?.regions || [], [regs.data])
  const facilities = useMemo(() => facs.data?.facilities || [], [facs.data])
  const regionsById = useMemo(() => Object.fromEntries(regions.map(r => [r.id, r])), [regions])

  // Every pickable thing, in one shape: what it is called, what it is, and every word that
  // should find it. A site is findable by its operator, its city, its state, the utility that
  // serves it and the grid it sits in.
  const items = useMemo(() => ({
    region: [...regions]
      .map(r => ({ id: r.id, label: regionName(r), sub: placeOfId(r.id) || r.ba_name || r.name, keywords: `${r.id} ${regionName(r)} ${placeOfId(r.id)} ${r.name} ${r.ba_name} ${r.operator?.utility || ''} ${r.operator?.parent || ''}` }))
      .sort((x, y) => x.label.localeCompare(y.label)),
    company: [...COMPANIES]
      .map(c => ({ id: c.key, label: c.name, sub: `${c.ticker || 'private'} · ${plural(c.n_sites, 'site')} · ${c.grids.slice(0, 3).join(', ')}${c.grids.length > 3 ? ' and more' : ''}`, keywords: `${c.key} ${c.ticker || 'private'} ${c.name} ${(c.aliases || []).join(' ')} ${c.grids.join(' ')}` }))
      .sort((x, y) => x.label.localeCompare(y.label)),
    site: [...facilities]
      .map(f => ({ id: siteId(f), label: siteName(f), sub: `${f.company || f.operator_key} · ${labelOfId(f.region_id)}${f.serving_utility ? ` · ${f.serving_utility}` : ''}`, keywords: `${f.company} ${f.operator_key} ${f.ticker || ''} ${f.metro} ${f.state} ${f.serving_utility || ''} ${f.utility_parent || ''} ${f.utility_ticker || ''} ${f.region_id} ${f.ba}` }))
      .sort((x, y) => x.label.localeCompare(y.label)),
  }), [regions, facilities])

  // Sensible openings: the places already on the page for grids, the two operators with the
  // most documents read, and two datacenters on different grids.
  const fallback = useMemo(() => {
    const reg = [seedRegions[0], seedRegions[1]].filter(Boolean)
    const regA = reg[0] || (regionsById['PJM/DOM'] ? 'PJM/DOM' : items.region[0]?.id)
    const regB = reg[1] && reg[1] !== regA ? reg[1] : regionsById['ERCO/NRTH'] && regA !== 'ERCO/NRTH' ? 'ERCO/NRTH' : items.region.find(i => i.id !== regA)?.id
    const co = COMPANIES.filter(c => c.coverage_status === 'sites_and_claims')
    const s0 = facilities[0]
    const s1 = facilities.find(f => f.ba !== s0?.ba)
    return {
      region: [regA, regB],
      company: [co[0]?.key || COMPANIES[0]?.key, co[1]?.key || COMPANIES[1]?.key],
      site: [s0 && siteId(s0), s1 && siteId(s1)],
    }
  }, [items, regionsById, facilities, seedRegions])

  const [mode, setMode] = useState(() => (isMode(modeIn) ? modeIn : 'region'))
  const [sel, setSel] = useState({ region: [], company: [], site: [] })
  const seeded = useRef(false)

  // The URL is read once, when the data that can validate it arrives. After that the screen
  // owns the selection and writes it back, so a click never re-runs the route.
  useEffect(() => {
    if (seeded.current || !regions.length || !facilities.length) return
    seeded.current = true
    const has = (m, id) => !!id && items[m].some(i => i.id === id)
    const m = isMode(modeIn) ? modeIn : 'region'
    const next = { region: fallback.region, company: fallback.company, site: fallback.site }
    // An id in the link that this build does not hold falls back to the opening pair rather
    // than to an empty column, so a stale link still lands on a working comparison.
    if (has(m, aIn) || has(m, bIn)) {
      const left = has(m, aIn) ? aIn : next[m][0]
      let right = has(m, bIn) ? bIn : next[m][1]
      if (right === left) right = items[m].find(i => i.id !== left)?.id
      next[m] = [left, right]
    }
    setMode(m)
    setSel(next)
  }, [regions.length, facilities.length, items, fallback, modeIn, aIn, bIn])

  const pair = sel[mode] || []
  const write = useCallback((m, p) => {
    try { window.history.replaceState(null, '', hashWith(buildVs({ mode: m, a: p[0], b: p[1] }))) } catch { /* history is full or blocked */ }
  }, [])
  const put = (which, id) => {
    const p = which === 0 ? [id, pair[1]] : [pair[0], id]
    setSel(s => ({ ...s, [mode]: p }))
    write(mode, p)
  }
  const swap = () => { const p = [pair[1], pair[0]]; setSel(s => ({ ...s, [mode]: p })); write(mode, p) }
  const pickMode = m => { setMode(m); write(m, sel[m] || []) }

  const close = useCallback(() => {
    if (/[?&]vs=/.test(window.location.hash)) window.location.hash = hashWith(null)
    onClose?.()
  }, [onClose])

  useEffect(() => {
    if (!open) return undefined
    const onKey = e => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (document.querySelector('.pal-overlay, .sbs-lb, .sheet-overlay')) return   // a layer above this one owns the press
      e.preventDefault()
      close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  useEffect(() => { if (open) panelRef.current?.focus() }, [open])

  if (!open) return null

  const loading = regs.loading || facs.loading
  const error = regs.error || facs.error
  const Icon = ICON[mode] || Place
  const ready = pair[0] && pair[1]

  let body
  if (loading) body = <Loading what="the comparison" />
  else if (error) body = <ErrorState error={error} onRetry={() => { regs.reload(); facs.reload() }} />
  else if (!ready) body = <p className="cmp-empty">Pick one on each side. Type a name, a city, a state, a utility or a grid id.</p>
  else if (mode === 'region') body = <WxHeadToHead regions={regions} mw={mw} value={pair} onChange={p => { setSel(s => ({ ...s, region: p })); write('region', p) }} chrome={false} />
  else if (mode === 'company') body = <CmpCompany aKey={pair[0]} bKey={pair[1]} regionsById={regionsById} regionsLoading={regs.loading} />
  else body = <CmpSite aId={pair[0]} bId={pair[1]} facilities={facilities} regionsById={regionsById} mw={mw} />

  return createPortal(
    <div className="cmp-scrim" onMouseDown={e => { if (e.target === e.currentTarget) close() }}>
      <section className="cmp-panel" role="dialog" aria-modal="true" aria-label="Compare side by side" ref={panelRef} tabIndex={-1}>
        <header className="cmp-head">
          <div className="cmp-head-t">
            <span className="cmp-eyebrow"><Icon size={12} />Compare</span>
            <h2 className="cmp-title">{TITLE[mode]}</h2>
            <p className="cmp-blurb">{BLURB[mode]}</p>
          </div>
          <div className="cmp-head-a">
            <CopyButton text={() => window.location.href} label="Copy link" toastMessage="Comparison link copied" />
            <button type="button" className="cmp-close" onClick={close}><Close size={14} /><span>Close</span><kbd>Esc</kbd></button>
          </div>
        </header>

        <div className="cmp-modes" role="tablist" aria-label="What to compare">
          {MODES.map(m => (
            <button key={m.id} type="button" role="tab" aria-selected={m.id === mode} className={`cmp-mode${m.id === mode ? ' on' : ''}`} onClick={() => pickMode(m.id)}>
              <span className="t">{m.label}</span><span className="d">{m.blurb}</span>
            </button>
          ))}
        </div>

        <div className="cmp-sides">
          <CmpPicker side="left" label="left" items={items[mode]} value={pair[0]} onChange={id => put(0, id)} disabledId={pair[1]} hint={HINT[mode]} />
          <button type="button" className="cmp-swap" onClick={swap} aria-label="Swap the two sides" title="Swap sides">&#8646;</button>
          <CmpPicker side="right" label="right" items={items[mode]} value={pair[1]} onChange={id => put(1, id)} disabledId={pair[0]} hint={HINT[mode]} />
        </div>

        <div className="cmp-body">{body}</div>
      </section>
    </div>,
    document.body,
  )
}
