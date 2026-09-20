import { useMemo, useState } from 'react'
import Shell from '../console/Console.jsx'
import { Card, Chip, Ticks } from '../console/widgets.jsx'
import { Loading, ErrorState } from '../components/States.jsx'
import { useAsync } from '../lib/data.js'
import { href } from '../router.js'

// Generating Alpha: a market board, not an essay.
//
// Every region we flag has instruments where the same physical fact is priced by someone
// else. The job of this page is to put the measurement and the market side by side and
// let the reader see the link in one glance. The caveats are real and they are one line,
// not five paragraphs -- a page that spends more words denying itself than showing its
// work is not honest, it is just anxious.

const base = import.meta.env.BASE_URL
const api = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const load = async () => {
  const urls = [...(api ? [`${api}/api/alpha`] : []), `${base}api/alpha.json`]
  for (const u of urls) { try { const r = await fetch(u); if (r.ok) return r.json() } catch { /* next */ } }
  throw new Error('alpha data unavailable')
}

const cents = v => (v == null ? null : Math.round(Number(v) * 100))
const CLASS_LABEL = { equity: 'Equity', commodity: 'Commodity', event: 'Event market' }

/** A Kalshi contract as a price bar: the strike, where yes trades, and when it closes. */
function Contract({ m }) {
  const bid = cents(m.yes_bid), ask = cents(m.yes_ask)
  const mid = bid != null && ask != null ? (bid + ask) / 2 : (bid ?? ask)
  const close = m.close_time ? new Date(m.close_time).toISOString().slice(0, 10) : null
  return (
    <div className="kx-row" title={m.title || ''}>
      <div className="kx-strike">{m.strike || m.ticker}</div>
      <div className="kx-track" aria-hidden="true">
        {mid != null && <div className="kx-fill" style={{ width: `${Math.max(2, Math.min(100, mid))}%` }} />}
      </div>
      <div className="kx-px">{bid != null ? `${bid}¢` : '—'}<span className="kx-sep">/</span>{ask != null ? `${ask}¢` : '—'}</div>
      <div className="kx-close">{close || ''}</div>
    </div>
  )
}

function Instrument({ i }) {
  const isEvent = i.class === 'event'
  const markets = (i.markets || []).slice(0, 4)
  return (
    <div className={`inst inst-${i.class}`}>
      <div className="inst-head">
        <span className="inst-sym">{i.symbol || i.series}</span>
        <span className="inst-name">{i.name}</span>
        <span className="inst-tag">{CLASS_LABEL[i.class] || i.class}{i.venue ? ` · ${i.venue}` : ''}{i.exchange ? ` · ${i.exchange}` : ''}</span>
      </div>
      <p className="inst-why">{i.why}</p>
      {isEvent && !!markets.length && <div className="kx">{markets.map(m => <Contract key={m.ticker} m={m} />)}</div>}
      {isEvent && (i.markets || []).length > markets.length &&
        <p className="inst-more">+{i.markets.length - markets.length} more contracts in this series</p>}
    </div>
  )
}

function Chain({ c, open, onToggle }) {
  const byClass = useMemo(() => {
    const g = { event: [], equity: [], commodity: [] }
    for (const i of c.instruments || []) (g[i.class] ||= []).push(i)
    return g
  }, [c])
  const fuel = Object.entries(c.fuel_delta_gw || {})
    .filter(([, v]) => typeof v === 'number')
    .sort((a, b) => b[1] - a[1])[0]
  return (
    <section className={`chain${open ? ' open' : ''}`}>
      <button type="button" className="chain-head" onClick={onToggle} aria-expanded={open}>
        <span className="chain-rank">#{c.rank}</span>
        <span className="chain-name">
          <a href={href.region(c.region)} onClick={e => e.stopPropagation()}>{c.name || c.region}</a>
        </span>
        <span className="chain-growth">{c.growth_pct > 0 ? '+' : ''}{c.growth_pct?.toFixed?.(1)}%<small>demand since 2019</small></span>
        {fuel && <span className="chain-fuel"><b>{fuel[0]}</b> filled it<small>{fuel[1] > 0 ? '+' : ''}{fuel[1].toFixed(2)} GW</small></span>}
        <span className="chain-count">{(c.instruments || []).length} instruments</span>
        <span className="chain-caret" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="chain-body">
          {c.fuel_inherited_from &&
            <p className="chain-inherit">Fuel figures are {c.fuel_inherited_from}&rsquo;s. {c.region} reports demand only and inherits its parent grid&rsquo;s generation.</p>}
          {['event', 'equity', 'commodity'].map(k => byClass[k]?.length ? (
            <div key={k} className="inst-group">
              <h4 className="inst-group-t">{CLASS_LABEL[k]}{byClass[k].length > 1 ? 's' : ''}</h4>
              {byClass[k].map(i => <Instrument key={i.symbol || i.series} i={i} />)}
            </div>
          ) : null)}
        </div>
      )}
    </section>
  )
}

export default function Alpha() {
  const { loading, error, data, reload } = useAsync(load, [])
  const [open, setOpen] = useState(0)
  const [showLimits, setShowLimits] = useState(false)

  const back = () => window.history.back()
  const globe = { view: { lat: 38, lng: -96, altitude: 1.7 }, interactive: false }
  if (loading || error) return <Shell page="alpha" globe={globe} columnWidth={760} column={
    <Card title={<b>Generating Alpha</b>} onClose={back}>
      {loading ? <Loading what="the market board" /> : <ErrorState error={error} onRetry={reload} />}
    </Card>} />

  const chains = data.chains || []
  const em = data.event_markets || {}
  const nContracts = chains.reduce((n, c) => n + (c.instruments || [])
    .filter(i => i.class === 'event').reduce((m, i) => m + (i.markets || []).length, 0), 0)
  const nEquity = chains.reduce((n, c) => n + (c.instruments || []).filter(i => i.class === 'equity').length, 0)
  const asOf = em.fetched_at ? new Date(em.fetched_at).toISOString().slice(0, 16).replace('T', ' ') : null

  const column = (
      <Card title={<><b>Generating Alpha</b> · where the grid meets the tape</>} onClose={back}>
        <p className="alpha-lead">
          We measure which grids tighten first, from federal metered data, months before it reaches a 10-Q.
          These are the instruments where someone else is already pricing the same physical fact.
        </p>

        <div className="alpha-stats">
          <div><b>{chains.length}</b><span>regions flagged</span></div>
          <div><b>{nContracts}</b><span>live contracts</span></div>
          <div><b>{nEquity}</b><span>listed names</span></div>
          <div><b>{data.no_listed_equity?.count ?? 5}</b><span>sites with no equity</span></div>
        </div>

        {asOf && <p className="alpha-asof">Kalshi prices cached {asOf} UTC at build time — stale by construction, never fetched from your browser.</p>}

        {!!em.series_with_no_open_contracts?.length && (
          <div className="alpha-dead">
            <b>Nobody is trading this.</b>{' '}
            {em.series_with_no_open_contracts.map(s => <code key={s}>{s}</code>).reduce((a, b) => [a, ' ', b])}
            {' '}exist on Kalshi with zero open contracts — including PJM West power, the single most on-point
            market for our headline finding. A market nobody trades is information about liquidity.
          </div>
        )}

        {!!(data.thesis_markets || []).length && (
          <section className="thesis">
            <h3 className="thesis-t">Markets on the thesis itself</h3>
            <p className="thesis-s">Whether the buildout happens, what it costs, and who pays. These price what we measured nationally, not any one grid.</p>
            {data.thesis_markets.map(i => <Instrument key={i.series} i={i} />)}
          </section>
        )}

        <h3 className="chains-t">Region by region</h3>
        <p className="chains-s">Each grid we flag, and the instruments tied to that grid specifically.</p>
        <div className="chains">
          {chains.map((c, n) => <Chain key={c.region} c={c} open={open === n} onToggle={() => setOpen(open === n ? -1 : n)} />)}
        </div>

        <button type="button" className="alpha-limits-btn" onClick={() => setShowLimits(v => !v)}>
          {showLimits ? 'Hide' : 'What this is not'}
        </button>
        {showLimits && (
          <ul className="alpha-limits">
            {(data.limits || []).map((l, i) => <li key={i}>{typeof l === 'string' ? l : l.text || l.limit}</li>)}
          </ul>
        )}
      </Card>
  )
  return <Shell page="alpha" globe={globe} column={column} columnWidth={760} />
}
