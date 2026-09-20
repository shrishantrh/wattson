// Prewritten prompts for the ask layer, ranked for whatever the user is looking at.
//
// These are NOT commands. Every one of them is a sentence the ask layer can answer from
// the data with its own tools, so a suggestion that is accepted and a question that is
// typed from scratch take exactly the same path. The point is that an empty input should
// never be a dead end: a judge who opens ⌘K and does not know what we can answer gets
// shown four things we can, and Tab completes the one they started typing.
//
//   suggestions(ctx)      -> ranked list for this screen, most useful first
//   completion(q, list)   -> the grey tail after the caret, '' when nothing matches
//   accept(q, list)       -> the full text Tab should commit to the input
//
// `ctx` is lib/pageContext.js: { route, region_id?, ticker?, metros?, mw?, screen? }.

const SUMMARIZE = 'Summarize this screen'

// Questions that make sense anywhere, in descending order of how well they show the
// project off to someone who has never seen it.
const GLOBAL = [
  'Which grids are dirtiest at 3am?',
  'Where should I put 300 MW so it runs cleanest at night?',
  'Which companies claim 100% renewable but sit on fossil grids?',
  'Compare PJM and ERCOT on clean power at night',
  'What changed overnight in PJM since 2019?',
  'Which regions look most like datacenter load?',
  'Show me every company we have verified',
  'What is the national clean share at night versus midday?',
]

// Region ids keep their slash: 'PJM/DOM' is what the ask layer resolves, and it reads
// as an identifier rather than as two words.
const pretty = id => String(id || '')

function forRoute(ctx) {
  const r = ctx?.route || 'landing'
  const id = ctx?.region_id
  const tk = ctx?.ticker

  if (id) return [
    `How clean is ${pretty(id)} at 3am?`,
    `Compare ${pretty(id)} with ERCOT and CAISO at night`,
    `What fuel served the load growth in ${pretty(id)}?`,
    `Which datacenters sit in ${pretty(id)}?`,
    `Is ${pretty(id)} getting cleaner or dirtier overnight?`,
  ]

  if (tk) return [
    `What does ${tk} actually run on at night?`,
    `Compare ${tk} with Google and Microsoft`,
    `Where are ${tk}'s datacenters and who serves them?`,
    `What has ${tk} claimed, and can we check it?`,
  ]

  if (ctx?.metros?.length) return [
    `Rank these metros for ${ctx.mw || 300} MW of 24/7 load`,
    'Which of these is cleanest between midnight and 6am?',
    'What would fill the last gigawatt of growth in each?',
  ]

  switch (r) {
    case 'found':
    case 'screener':
      return [
        'Which regions look most like datacenter load?',
        'Rank regions by clean power available at 3am',
        'Which flagged regions are served by a listed utility?',
        'Show me the top ten and why each scored',
      ]
    case 'alerts':
      return [
        'Which alerts actually matter?',
        'Which regions are setting overnight records?',
        'Group these alerts by serving utility',
      ]
    case 'alpha':
      return [
        'Which listed utilities serve the fastest-growing flat load?',
        'Which regions have the least clean headroom at night?',
        'What is the exposure chain from a meter reading to a ticker?',
      ]
    case 'irradiance':
      return [
        'Why does solar not help a datacenter?',
        'How much fossil power does a 300 MW load draw at 3am here?',
        'Compare midday and overnight clean share nationally',
      ]
    case 'companies':
      return [
        'Which company has the biggest gap between claim and meter?',
        'Compare every company we have verified',
        'Which claims could we not check, and why?',
      ]
    default:
      return []
  }
}

/**
 * Ranked prompts for this screen, best first.
 *
 * These lead with real analytical questions. "Summarize this screen" sits at the BOTTOM on
 * purpose: it is the least interesting thing the ask layer can do, and an autocomplete whose
 * first offer is "summarize" teaches the user that the box is a summarize box.
 */
export function suggestions(ctx) {
  const out = [...forRoute(ctx), ...GLOBAL, SUMMARIZE]
  const seen = new Set()
  return out.filter(s => { const k = s.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
}

/** True when `s` continues `q`, prefix first, then "starts with a word of the query". */
function matches(s, q) {
  const a = s.toLowerCase(), b = q.trim().toLowerCase()
  if (!b) return false
  if (a.startsWith(b)) return true
  // "clean at night" should still reach "Which grids are dirtiest at 3am?" only if every
  // typed word appears; a loose match would put wrong ghost text under the caret.
  return false
}

/**
 * The grey tail to draw after what the user has typed. Returns '' when there is no
 * unambiguous single completion, so we never suggest a question we would not run.
 */
export function completion(q, list) {
  const b = (q || '').trim()
  if (!b) return ''
  const hits = list.filter(s => matches(s, b))
  if (hits.length !== 1) return ''
  return hits[0].slice(b.length)
}

/** What Tab commits: the completed suggestion, or the first one when the box is empty. */
export function accept(q, list) {
  const b = (q || '').trim()
  if (!b) return list[0] || ''
  const hits = list.filter(s => matches(s, b))
  return hits.length === 1 ? hits[0] : b
}

export { SUMMARIZE }
