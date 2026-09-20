import { Place, Layers, Company, Table, Bolt, Info, Globe as GlobeIcon, Sort, Filter, ArrowLeft, Pin } from './Icons.jsx'
import coords from '../data/region_coords.json'
import { COMPANIES } from '../lib/query.js'
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
const companyName = t => COMPANIES.find(c => c.ticker === t)?.name || t

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

// Props, all optional: `trail` (from useCrumbs; omitted, the component derives it from the live
// hash itself) and `onBack` (omitted, the back button walks history, falling back to Home).
export default function Breadcrumbs({ trail, onBack }) {
  const derived = useCrumbs(useHash())
  const items = trail && trail.length ? trail : trail ? [] : derived
  if (!items.length) return null
  const back = onBack || (() => { if (window.history.length > 1) window.history.back(); else window.location.hash = href.landing() })
  const last = items.length - 1
  return (
    <nav className="bc" aria-label="Breadcrumb">
      <button type="button" className="bc-back" onClick={back} aria-label="Back"><ArrowLeft size={15} /></button>
      <ol className="bc-list">
        {items.map((c, i) => {
          const Icon = c.icon
          const inner = <>{Icon && <Icon size={13} />}<span className="bc-text">{c.label}</span></>
          return (
            <li className={`bc-item${i === last ? ' bc-here' : ''}`} key={`${c.label}-${i}`}>
              {i > 0 && <Sep />}
              {i === last || !c.href
                ? <span className="bc-seg" aria-current="page">{inner}</span>
                : <a className="bc-seg" href={c.href}>{inner}</a>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
