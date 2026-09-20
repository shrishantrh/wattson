import { useEffect, useRef, useState } from 'react'
import { Blobatar } from '@blobatar/react'
import { happy, idle as calm, sad, sleepy, unsure } from 'blobatar/expression'
import 'blobatar/motion.css'
import '../styles/askblob.css'

// The ask layer, made visible while it works.
//
// WHY THIS EXISTS. A question goes in, a pause happens, an answer appears, and nothing on
// screen says whether that answer came from named functions over the published index or from
// the model's memory. That distinction is the whole feature. So the blob names the tools: the
// reader watches `region`, `rank_regions`, `search_corpus` arrive one at a time and can see
// the answer being assembled from sources, not recalled.
//
// HONESTY ABOUT TIMING. /api/ask is one request; it does not stream. The tool trace comes back
// with the answer, in `tools_used`, in the order the model called them. So the names are real
// and their ORDER is real; only the pacing is ours, and it is a replay after the fact, not a
// live feed. Nothing here is invented: with no trace, no chips.
//
// THE FIGURE is blobatar (blobatar.dev), seeded with the product's own name so it is the same face
// everywhere it appears and never a random one. Its expressions carry the state; our markup carries
// the tool names beside it. Hue is pinned: the library picks a hue from the seed, and --clean and
// --fossil mean carbon-free and burned in this product, so a face that landed on either would read
// as a claim about electricity. 272 is clear of both.

// Phases the page hands in. 'working' is derived here, during the replay.
const PHASES = new Set(['idle', 'listening', 'thinking', 'answering', 'failed', 'unavailable'])

// What each tool is, for the chip's tooltip. The chip itself shows the real function name.
const WHAT = {
  rank_regions: 'all 111 regions, sorted',
  region: 'one region’s full record',
  compare_regions: 'named regions on one metric',
  national: 'the national day-vs-night series',
  company: 'one company’s claims and sites',
  companies: 'every company, talk vs walk',
  alerts: 'ranked alerts',
  facilities: 'datacenter sites mapped to grids',
  irradiance: 'satellite irradiance vs clean share',
  search_corpus: 'full text of the ESG and 10-K filings',
}

const SAY = {
  idle: 'Ask layer ready.',
  listening: 'Listening.',
  thinking: 'Working on the question.',
  working: 'Calling tools.',
  answering: 'Answer ready.',
  failed: 'That question did not come back.',
  unavailable: 'Ask layer not running in this copy.',
}

const STEP = 420   // ms between one tool name and the next, during the replay
const names = tools => (tools || []).map(t => (typeof t === 'string' ? t : t?.tool)).filter(Boolean)

// One expression per state. Absent means the resting face.
const FACE = { idle: calm, listening: calm, thinking: unsure, working: unsure, answering: happy, failed: sad, unavailable: sleepy }
const SEED = 'wattson'
// The product's accent orange, stated rather than derived: the library picks a hue from the seed
// and 'wattson' lands on a periwinkle that matches nothing else on the page. Same values as the
// face in the command bar, so the two are one character and not two.
const PALETTE = { head: '#ff8d52', eye: '#20100a' }

export default function AskBlob({ phase = 'idle', tools, beat = 0, className = '' }) {
  const given = PHASES.has(phase) ? phase : 'idle'
  const list = names(tools)
  const key = list.join('|')
  // The reveal carries the trace it belongs to, so a new question's chips can never start from
  // the last question's count.
  const [rev, setRev] = useState({ key: '', n: 0 })
  const timer = useRef(null)

  // Reveal the trace one name at a time, then settle. Plain timeouts: no frame loop anywhere in
  // this component, so an idle blob off screen costs nothing but a CSS animation.
  useEffect(() => {
    if (given !== 'answering' || !key) return undefined
    const total = key.split('|').length
    let i = 0
    const tick = () => {
      i += 1
      setRev({ key, n: i })
      timer.current = i < total ? setTimeout(tick, STEP) : null
    }
    timer.current = setTimeout(tick, 40)
    return () => { clearTimeout(timer.current); timer.current = null }
  }, [given, key])

  const shown = rev.key === key ? rev.n : 0

  // 'working' is 'answering' with names still arriving.
  const state = given === 'answering' && list.length && shown < list.length ? 'working' : given
  const visible = given === 'answering' ? list.slice(0, shown) : []
  const label = state === 'working'
    ? (shown ? `Calling tools: ${visible[shown - 1]}, ${shown} of ${list.length}.` : SAY.working)
    : state === 'answering' && list.length
      ? `Answer ready, from ${list.join(', ')}.`
      : SAY[state]

  return (
    <div className={`askblob ${className}`.trim()} data-state={state}>
      <div className="askblob-mark">
        {/* A fresh key on each state remounts the figure so its pose animates in rather than
            snapping. The ping rings are ours, one per keystroke and one per tool name. */}
        <Blobatar
          key={state}
          name={SEED}
          size={76}
          palette={PALETTE}
          background={false}
          animate={state === 'idle' || state === 'listening' ? 'always' : 'hover'}
          expression={FACE[state]}
          title=""
        />
        <svg viewBox="0 0 100 100" className="ab-svg" aria-hidden="true" focusable="false">
          {state === 'listening' && <circle key={`b${beat}`} className="ab-ping" cx="50" cy="50" r="34" />}
          {state === 'working' && <circle key={`t${shown}`} className="ab-ping ab-ping-hard" cx="50" cy="50" r="34" />}
        </svg>
      </div>

      <div className="askblob-rail">
        <p className="askblob-say">{SAY[state]}</p>
        {given === 'answering' && !!list.length && (
          <ol className="askblob-tools">
            {visible.map((t, i) => (
              <li key={`${t}-${i}`} className="askblob-tool" title={WHAT[t] || 'a tool over the published index'}>{t}</li>
            ))}
          </ol>
        )}
      </div>

      <p className="askblob-sr" role="status" aria-live="polite">{label}</p>
    </div>
  )
}
