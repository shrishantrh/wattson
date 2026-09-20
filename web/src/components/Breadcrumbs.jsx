import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Place, Layers, Company, Table, Bolt, Info, Globe as GlobeIcon, Sort, Filter, ArrowLeft, Pin } from './Icons.jsx'
import coords from '../data/region_coords.json'
import { companyByKey } from '../lib/query.js'
import { href, parseHash, useHash } from '../router.js'
import '../styles/breadcrumbs.css'

// Where you are, in one 44px row at the top of the column. The trail is derived from the hash
// alone (no fetch, no state), so it renders on the first frame, before the page's data lands.
// Every segment but the last is a link; the last is where you are.

// Labels the pages own. Kept here as flat maps so the trail never imports a page.
const SCENES = { headline: 'The finding', night: 'At night', sweep: 'Day vs night', detector: 'Where load is landing' }
const SHEETS = { regions: 'Regions (111)', alerts: 'Alerts', companies: 'Companies', claims: 'Claims', facilities: 'Facilities' }
const PRESETS = { rising: 'New flat load rising', cleanest: 'Cleanest at night', dirtiest: 'Dirtiest at night', worsening: 'Getting worse fastest', improving: 'Improving fastest' }

const HOME = { label: 'Home', href: '#/', icon: GlobeIcon }
const companyName = t => companyByKey(t)?.name || t

function regionTrail(id) {
  const c = coords.regions[id]
  const label = c?.label || id
  const ba = id && id.includes('/') ? id.split('/')[0] : null
  const grid = ba ? { label: `${ba} grid`, href: coords.regions[ba] ? href.region(ba) : href.screen(), icon: Layers } : null
  return [{ ...HOME }, { label: 'Places', href: href.screen(), icon: Pin }, grid, { label, icon: Place }].filter(Boolean)
}

// The last segment is where you are, so it never links, whichever route built it.
const here = trail => trail.map((c, i) => (i === trail.length - 1 ? { label: c.label, icon: c.icon } : c))

// useCrumbs(hash) -> [{ label, href?, icon? }]. Pure: same hash, same trail. Landing returns [].
// oxlint-disable-next-line react/only-export-components
export function useCrumbs(hash = typeof window === 'undefined' ? '' : window.location.hash) {
  return here(trailFor(hash))
}

function trailFor(hash) {
  const r = parseHash(hash)
  const p = r.params || {}
  switch (r.page) {
    case 'landing':
      return []
    case 'check':
      return [{ ...HOME }, { label: 'Companies', href: href.companies(), icon: Company }, { label: companyName(r.ticker), icon: Company }]
    case 'compare': {
      const n = (r.metros || []).length
      return [{ ...HOME }, { label: 'Compare places', href: '#/compare', icon: Place }, { label: `${r.mw} MW, ${n} place${n === 1 ? '' : 's'}`, icon: Bolt }]
    }
    case 'region':
      return regionTrail(r.id)
    case 'found': {
      const scene = SCENES[p.s]
      return [{ ...HOME }, { label: 'What we found', href: href.found(), icon: GlobeIcon }, scene && { label: scene, icon: Bolt }].filter(Boolean)
    }
    case 'screen': {
      const preset = PRESETS[p.by]
      return [{ ...HOME }, { label: 'Screener', href: href.screen(), icon: Sort }, preset && { label: preset, icon: Filter }].filter(Boolean)
    }
    case 'data': {
      const sheet = SHEETS[p.t]
      return [{ ...HOME }, { label: 'Data', href: href.data(), icon: Table }, sheet && { label: sheet, icon: Table }].filter(Boolean)
    }
    case 'ask': {
      const q = (p.q || '').trim()
      return [{ ...HOME }, { label: 'Ask', href: href.ask(), icon: Bolt },
        q && { label: q.length > 48 ? `${q.slice(0, 47)}…` : q, icon: Info }].filter(Boolean)
    }
    case 'explore':
      return [{ ...HOME }, { label: 'Explore', icon: Filter }]
    case 'alerts':
      return [{ ...HOME }, { label: 'Alerts', icon: Info }]
    case 'companies':
      return [{ ...HOME }, { label: 'Companies', icon: Company }]
    case 'method':
      return [{ ...HOME }, { label: 'Method', icon: Layers }]
    default:
      return [{ label: 'Home', icon: GlobeIcon }]
  }
}

function Sep() {
  return <svg className="bc-sep" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9.5 5.5 7 6.5-7 6.5" /></svg>
}

// Is the trail scrolled away from the top of its column? The bar is sticky, so it has to say
// whether it is resting on the content or floating over it; a flat bar sitting on a card that is
// cut in half reads as a bug. Walks up to the nearest scrolling ancestor and listens there.
function useStuck(ref) {
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    let el = ref.current?.parentElement
    while (el && el !== document.body && !/auto|scroll/.test(getComputedStyle(el).overflowY)) el = el.parentElement
    const host = el && el !== document.body ? el : window
    const read = () => setStuck((host === window ? window.scrollY : host.scrollTop) > 2)
    read()
    host.addEventListener('scroll', read, { passive: true })
    return () => host.removeEventListener('scroll', read)
  }, [ref])
  return stuck
}

// How many of the middle segments have to give up their text for the trail to fit on one line.
// Grows from the left: the segment nearest Home loses its label first, the one right before where
// you are keeps it longest, and the last segment is never touched. Resets on every resize, so a
// window that gets wider gets its labels back.
function useFold(listRef, count) {
  // `gen` is bumped by the resize observer and by a change of trail; each bump unfolds the trail
  // and lets the measurement below fold it again from scratch. The measurement can only ever add
  // one fold per pass and stops at `middle`, so the chain is bounded by the number of segments.
  const [{ fold, gen }, set] = useState({ fold: 0, gen: 0 })
  const middle = Math.max(0, count - 2)
  const unfold = () => set(s => ({ fold: 0, gen: s.gen + 1 }))
  useLayoutEffect(unfold, [count])   // oxlint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = listRef.current
    if (!el || fold >= middle) return
    if (el.scrollWidth > el.clientWidth + 1) set(s => ({ ...s, fold: s.fold + 1 }))
  }, [listRef, fold, middle, gen])
  useEffect(() => {
    const el = listRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(unfold)
    ro.observe(el)
    return () => ro.disconnect()
  }, [listRef])   // oxlint-disable-line react-hooks/exhaustive-deps
  return fold
}

// Props, all optional: `trail` (from useCrumbs; omitted, the component derives it from the live
// hash itself) and `onBack`, used only by a trail that has no linked ancestor. Whenever the trail
// does have one, the back button goes there and says so on its face: a button reading "Back to
// Companies" that lands somewhere else is worse than no button.
export default function Breadcrumbs({ trail, onBack }) {
  const derived = useCrumbs(useHash())
  const items = trail && trail.length ? trail : trail ? [] : derived
  const navRef = useRef(null), listRef = useRef(null)
  const stuck = useStuck(navRef)
  const fold = useFold(listRef, items.length)
  if (!items.length) return null
  const last = items.length - 1
  const up = items.slice(0, last).reverse().find(c => c.href) || null
  // The button says where it goes, so it has to go there: up one level, not wherever history
  // happens to be. History is only the fallback for a trail with nothing above it.
  const back = () => {
    if (up) window.location.hash = up.href           // the label names this destination
    else if (onBack) onBack()
    else if (window.history.length > 1) window.history.back()
    else window.location.hash = href.landing()
  }
  // Once every middle segment is folded there is nothing left to give but the last label, so the
  // trail says so and lets it ellipsise. Until then the last segment keeps its full width.
  const folded = fold >= Math.max(0, items.length - 2) ? 'max' : undefined
  return (
    <nav className="bc" aria-label="Breadcrumb" ref={navRef} data-stuck={stuck ? 'true' : undefined} data-folded={folded}>
      {/* The one way up, and it says where up is. It used to be an arrow with a tooltip, which
          read as a mystery next to the answer card's ×, so the label is on the button now. */}
      <button type="button" className="bc-back" onClick={back}><ArrowLeft size={15} /><span className="bc-back-text">Back{up && <span className="bc-back-to"> to {up.label}</span>}</span></button>
      <ol className="bc-list" ref={listRef}>
        {items.map((c, i) => {
          const Icon = c.icon
          // folded: the icon carries the segment, the label stays in the accessible name
          const folded = i > 0 && i < last && i <= fold
          const inner = <>{Icon && <Icon size={13} />}<span className="bc-text">{c.label}</span></>
          const props = { className: 'bc-seg', title: folded ? c.label : undefined, 'aria-label': folded ? c.label : undefined }
          return (
            <li className={`bc-item${i === last ? ' bc-here' : ''}${folded ? ' bc-folded' : ''}`} key={`${c.label}-${i}`}>
              {i > 0 && <Sep />}
              {i === last || !c.href
                ? <span {...props} aria-current={i === last ? 'page' : undefined}>{inner}</span>
                : <a {...props} href={c.href}>{inner}</a>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
