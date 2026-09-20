import { useEffect, useMemo, useRef, useState } from 'react'
import Shell from '../console/Console.jsx'
import { Card } from '../console/widgets.jsx'
import AskBlob from '../components/AskBlob.jsx'
import AskView, { viewRegionIds } from '../components/AskView.jsx'
import Breadcrumbs, { useCrumbs } from '../components/Breadcrumbs.jsx'
import { CopyButton } from '../components/CopyButton.jsx'
import { Loading, ErrorState } from '../components/States.jsx'
import coords from '../data/region_coords.json'
import { readTokens } from '../lib/tokens.js'
import { askAvailable } from '../lib/ask.js'
import { getAsk, renderable, runAsk, useAskResult } from '../lib/askStore.js'
import { href, useHash } from '../router.js'
import '../styles/pages.css'
import '../styles/answer.css'
import '../styles/ask.css'

// #/ask?q=..., the page a typed question builds.
//
// Ask anything in the palette and, when the answer has a shape (several places side by side,
// a ranking, one subject with figures), it lands here as a table with units, a chart and links
// back into the app, instead of a paragraph in a dropdown. When the answer is genuinely a
// sentence the sentence is what you get: the page never invents a table to look busy.
//
// The palette has usually already run the ask and left the result in lib/askStore. Arriving
// here by link or reload finds an empty store, so the page asks for itself.

const EXAMPLES = [
  'compare ERCOT, PJM and CAISO on clean power at night',
  'which regions look most like new 24/7 load',
  'show me Microsoft against the grids its sites sit on',
  'where would 300 MW of flat load be served cleanest',
]

export default function Ask({ route }) {
  const q = (route?.params?.q || '').trim()
  const res = useAskResult()
  const crumbs = useCrumbs(useHash())
  const tk = useMemo(() => readTokens(), [])
  const [aiOn, setAiOn] = useState(true)
  const inputRef = useRef(null)
  // Typing, for the blob beside the box. A count, not a string: it is only ever used to
  // replay a one-shot CSS ring, so the question itself stays uncontrolled.
  const [beat, setBeat] = useState(0)
  const [typing, setTyping] = useState(false)
  const settle = useRef(null)
  const onInput = () => {
    setBeat(b => b + 1)
    setTyping(true)
    clearTimeout(settle.current)
    settle.current = setTimeout(() => setTyping(false), 1100)
  }
  useEffect(() => () => clearTimeout(settle.current), [])

  useEffect(() => { askAvailable().then(setAiOn) }, [])
  // Ask once per question. A question that failed is not retried on its own; the retry is a
  // button, so a broken server cannot become a loop.
  useEffect(() => { if (q && getAsk().q !== q) runAsk(q, { route: 'ask' }) }, [q, res.q])

  const view = res.state === 'done' && res.q === q ? res.view : null
  const shown = renderable(view) ? view : null
  const rows = shown?.rows || []

  const globe = useMemo(() => {
    const ids = shown ? viewRegionIds(shown).filter(id => coords.regions[id]) : []
    if (!ids.length) return { view: { lat: 38.5, lng: -97, altitude: 1.7 }, interactive: true }
    const pts = ids.map(id => ({ id, ...coords.regions[id] }))
    return {
      view: { lat: 38.5, lng: -97, altitude: 1.6 },
      interactive: true,
      points: pts.map(p => ({ id: p.id, lat: p.lat, lng: p.lng, r: 0.22, color: tk.accent })),
      markers: pts.slice(0, 6).map((p, i) => ({ id: p.id, lat: p.lat, lng: p.lng, label: p.label || p.id, href: href.region(p.id), color: i === 0 ? tk.accent : tk.ink2, lead: i === 0 })),
    }
  }, [shown, tk])

  const submit = e => {
    e.preventDefault()
    const next = (inputRef.current?.value || '').trim()
    if (!next) return
    // Same question, same page: re-ask rather than no-op, because the hash would not change.
    if (next === q) runAsk(next, { route: 'ask' })
    else window.location.hash = href.ask(next)
    inputRef.current?.blur()
  }

  // Uncontrolled, keyed on the question, so navigating to a new question reseeds the box
  // without a state mirror of the URL.
  const form = (
    <form className="ask-form" onSubmit={submit}>
      <input ref={inputRef} key={q} defaultValue={q} className="field ask-input"
        onInput={onInput} placeholder="Ask anything: compare, rank, or check a company" aria-label="Ask a question" autoComplete="off" spellCheck={false} />
      <button type="submit" className="btn">Ask</button>
    </form>
  )

  // What the blob is doing, read off the one real state the ask layer has. A question in hand
  // is thinking even when the status probe said no, for the same reason body() attempts it.
  const phase =
    res.q === q && res.state === 'error' ? (aiOn ? 'failed' : 'unavailable')
      : q && (res.q !== q || res.state === 'loading') ? 'thinking'
        : res.q === q && res.state === 'done' ? 'answering'
          : !aiOn ? 'unavailable'
            : typing ? 'listening' : 'idle'

  const body = () => {
    // A question in hand is always attempted, even if the status probe came back negative:
    // that probe has a 2.5s timeout and a busy server fails it. If the ask really is down the
    // error state below says so, with a retry. Only an empty page takes the probe's word.
    if (!q) return (
      <>
        <p className="pg-lede">Type a question and get the numbers, not an essay. Every figure comes from a tool over the published EIA-930 index; nothing is recalled or estimated.</p>
        {!aiOn && <p className="note">The ask layer needs the API running with a key. Every other screen works without it, try the <a href={href.screen()}>screener</a> or <a href={href.data()}>the data</a>.</p>}
        <ul className="ask-egs">{EXAMPLES.map(e => <li key={e}><a href={href.ask(e)}>{e}</a></li>)}</ul>
      </>
    )
    if (res.q === q && res.state === 'error') return aiOn
      ? <ErrorState error={res.error} onRetry={() => runAsk(q, { route: 'ask' })} />
      // No ask layer and the attempt failed: say that, rather than showing a reader a raw
      // HTTP code for a server this copy of the site never had.
      : <p className="note">This copy of the site is running without the ask layer, so a typed question cannot be answered here. Everything else works: try the <a href={href.screen()}>screener</a> or <a href={href.data()}>the data</a>.</p>
    if (res.q !== q || res.state === 'loading') return <Loading what="the answer" />
    if (!shown) return (
      <>
        <p className="ask-prose">{res.answer}</p>
        <p className="note ask-prov">That answer has no table in it. {res.tools?.length ? `From ${res.tools.map(t => t.tool).join(', ')}.` : ''}</p>
      </>
    )
    return (
      <>
        <h1 className="verdict ask-headline">{shown.headline || res.answer}</h1>
        {shown.summary && <p className="ans-rest">{shown.summary}</p>}
        <AskView view={shown} />
        <details className="ans-why">
          <summary>The same answer in words</summary>
          <p className="note">{res.answer}</p>
        </details>
      </>
    )
  }

  const column = (
    <>
      <Breadcrumbs trail={crumbs} />
      <Card
        title={<><b>Ask</b>{q ? <> · {rows.length ? `${rows.length} row${rows.length === 1 ? '' : 's'}` : 'your question'}</> : ' · anything'}</>}
        right={q ? <CopyButton text={() => window.location.href} label="Copy link" /> : null}
        onClose={() => { window.location.hash = href.landing() }}>
        {form}
        <AskBlob phase={phase} tools={res.q === q ? res.tools : null} beat={beat} />
        {body()}
      </Card>
    </>
  )
  return <Shell page="ask" globe={globe} column={column} columnWidth={760} />
}
