import Shell from '../console/Console.jsx'
import { Card, Section, Chip } from '../console/widgets.jsx'
import { useAsync } from '../lib/data.js'
import { Loading, ErrorState } from '../components/States.jsx'
import { href } from '../router.js'

// Reads the static export first so the page works with the server dead and no
// network. VITE_API_BASE is a URL, not a secret; nothing else from the
// environment reaches the client, and the Kalshi snapshot was cached at build
// time rather than fetched from the browser.
const base = import.meta.env.BASE_URL
const api = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

async function getJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('json')) throw new Error(`${url}: not JSON`)
  return res.json()
}

async function loadAlpha() {
  if (api) { try { return await getJSON(`${api}/api/alpha`) } catch { /* fall through to the export */ } }
  return getJSON(`${base}api/alpha.json`)
}

const CLASS_LABEL = { equity: 'equity', commodity: 'commodity', event: 'event market' }

function money(v) { return v == null ? '—' : `${Math.round(v * 100)}¢` }

function InstrumentRow({ inst }) {
  const isEvent = inst.class === 'event'
  return (
    <li className="row">
      <div style={{ width: '100%' }}>
        <div className="t" style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <b>{isEvent ? inst.series : inst.symbol}</b>
          <span className="note" style={{ fontSize: 11, opacity: 0.75 }}>{CLASS_LABEL[inst.class]}</span>
          <span style={{ fontSize: 12 }}>{inst.name}</span>
          {inst.exchange ? <span className="note" style={{ fontSize: 11 }}>{inst.exchange}</span> : null}
        </div>
        <div className="d" style={{ marginTop: 3 }}>{inst.why}</div>
        {inst.pending_change
          ? <div className="d" style={{ marginTop: 3, opacity: 0.85 }}><b>Ticker changing:</b> {inst.pending_change}</div>
          : null}
        {isEvent && inst.markets?.length
          ? (
            <ul className="kvrows" style={{ marginTop: 6 }}>
              {inst.markets.map(m => (
                <li key={m.ticker}>
                  <span style={{ fontSize: 12 }}>{m.strike || m.title}</span>
                  <span style={{ fontSize: 12 }}>{money(m.yes_bid)} / {money(m.yes_ask)}</span>
                </li>
              ))}
            </ul>
          )
          : null}
        {inst.source_url
          ? <div style={{ marginTop: 4 }}><a className="note" style={{ fontSize: 11 }} href={inst.source_url} target="_blank" rel="noreferrer">source</a></div>
          : null}
      </div>
    </li>
  )
}

export default function Alpha() {
  const { loading, error, data, reload } = useAsync(loadAlpha, [])
  const back = () => { window.location.hash = href.landing() }

  if (loading || error) {
    return <Shell page="alpha" globe={{ view: { lat: 33, lng: -98, altitude: 2.2 }, interactive: false }}
      column={<Card title={<b>Generating Alpha</b>} onClose={back}>{loading ? <Loading what="the chain" /> : <ErrorState error={error} onRetry={reload} />}</Card>} />
  }

  const ev = data.event_markets || {}
  const ne = data.no_listed_equity || {}

  const column = (
    <>
      <Card title={<b>Generating Alpha</b>} onClose={back}>
        <h1 className="verdict">An input to a trade. Not a trade.</h1>
        <p className="note" style={{ marginTop: 10 }}>{data.frame}</p>
      </Card>

      <Section title="What we cannot tell you">
        <ul className="rows">
          {(data.limits || []).map((l, i) => (
            <li className="row" key={i}><div className="t" style={{ fontSize: 13 }}>{l}</div></li>
          ))}
        </ul>
      </Section>

      <Section title="Where there is nothing to trade">
        <p className="note">{ne.note}</p>
      </Section>

      {ev.available === false
        ? <Section title="Event markets"><p className="note">{ev.message}</p></Section>
        : null}

      {(data.chains || []).map(c => (
        <Section
          key={c.region}
          title={<span>{c.region} <span className="note" style={{ fontSize: 11 }}>rank {c.rank} of 111</span></span>}
          right={<Chip small dim>{c.growth_pct > 0 ? `+${c.growth_pct}%` : `${c.growth_pct}%`} demand</Chip>}
        >
          <p className="note" style={{ marginBottom: 8 }}>{c.fuel_sentence}</p>
          <ul className="rows">
            {c.instruments.map((inst, i) => <InstrumentRow inst={inst} key={`${inst.class}-${inst.symbol || inst.series}-${i}`} />)}
          </ul>
          {!c.instruments.length
            ? <p className="note">No instrument we can evidence for this region.</p>
            : null}
        </Section>
      ))}

      {ev.series_with_no_open_contracts?.length
        ? (
          <Section title="Markets that exist but are not trading">
            <p className="note" style={{ marginBottom: 8 }}>{ev.series_note}</p>
            <ul className="rows">
              {ev.series_with_no_open_contracts.map(s => (
                <li className="row" key={s}><div className="t" style={{ fontSize: 13 }}>{s}</div></li>
              ))}
            </ul>
          </Section>
        )
        : null}

      <Section title="Provenance">
        <p className="note">
          Grid figures from EIA-930 via PUDL, snapshot to {data.generated}. Utility tickers from our
          verified operator table, each row carrying its own source. Event-market prices from Kalshi's
          public read API, cached at build time{ev.fetched_at ? ` on ${String(ev.fetched_at).slice(0, 10)}` : ''} and
          not fetched from your browser. Prices are yes bid / yes ask at that moment and are stale by construction.
        </p>
      </Section>
    </>
  )

  return <Shell page="alpha" globe={{ view: { lat: 33, lng: -98, altitude: 2.2 }, interactive: false }} column={column} />
}
