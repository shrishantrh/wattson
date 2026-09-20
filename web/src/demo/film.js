// The film: an ordered shot list Film.jsx runs on top of the live app (open any route with ?film=1).
// One story in five sections: PROBLEM (the missing watchdog, and the hours nobody separated),
// EVIDENCE (PJM), PRODUCT (the company check and its page cites, the detector, the OpenAI Stargate
// beat, the ask layer), REFUSALS (what it will not say), CLOSE. The PRODUCT order matches the deck's
// live section: check, detector, OpenAI plus the El Paso blind spot, then the ask layer and Quincy.
// A shot is either a slide Film.jsx draws itself (`slide`) or an app screen (`route`) with actions
// run in order by the fake cursor.
//
// `say` is the narration (scripts/narrate.mjs renders it and writes film.timing.json); a shot holds
// for max(holdMs, narration + 600 ms) after its actions, then 400 ms of silence. `expect` is checked
// at the end of the hold: the selector must exist, be inside the viewport, and contain the text (a
// string or a list; `notText` means the element's text must have moved on from that value). Failures
// land in window.__film.errors; the recorder prints the PASS/FAIL table and tiles one frame per check
// into docs/wattson-demo-shots.png. title is big (six words or fewer), sub one line; transitional
// shots have neither.
//
// A slide shot must name one of Film.jsx's own slide kinds (flat, night, two, found, sources, end).
// `title` and `sub` are NOT passed to a slide, so an invented slide id draws the wordmark, not the
// title — that is why the opening is the `flat` slide rather than a card of its own.
//
// Timing. 375 spoken words over 18 shots, budgeted at words / 2.3 + 0.6 s = 173.8 s of narration.
// That is NOT the running time. Route changes, the caption fade and the 400 ms gap sit outside the
// hold (the hold subtracts action time, because narration starts before the actions run), and the
// `type` shot's keystrokes and the ask layer's live model call are not covered by any narration at
// all. Measured against Film.jsx's constants that overhead is about 37 s: ~12 s waiting on the model
// call in `ask`, ~4 s of typing in `type`, 2.6 s of title card, and ~0.6-1.5 s per shot of veil,
// caption and gap. REALISTIC RUNNING TIME IS ABOUT 210 s (3:30) against a 2:30 target.
// To get it down, the levers in order are: pre-warm the ask answer in the recording browser before
// starting the film (saves ~12 s), then cut words from `jupiter`, `detector` and `askhow`.
// holdMs is a floor only; cut words, never raise holdMs.
//
// Every number here is one the screen renders itself, or one verified in docs/pitch/numbers-v2.md
// (the 52-operator merge) or docs/pitch/numbers.md (everything older). docs/narration.md is the
// readable copy, with a source for every figure spoken.
//
// Every selector and every expect string below was read off the running app at 1440x900 on
// 2026-09-20, AFTER the 52-operator data merge. RECORD AT 1440x900: several of these elements sit
// below the fold on a short viewport and the expect check requires the element to be in it.
// What changed since the last shot list: Google now has 10 mapped sites and reads "6–91% ... 54
// points apart, across 10 sites", not one site at 6%; the Found page is a four-step stepper
// (.wx-stepfig / .wx-stepbody / .wx-step .btn "Next"), so the old .fd-fig and .fd-nums selectors are
// gone; a company's evidence drawer opens on `.ans-next` and the site table is
// `[data-module="sites"] .rows`, whose children are `.row.site-row` plus one
// `<details class="site-note">` for a site carrying a material caveat.
//
// Action: { type: 'move' | 'click' | 'type' | 'wait' | 'scroll', selector?, text?, ms?, fallback? }
//   move    cursor to the element's centre (measured at that moment)   click   move, ripple, el.click()
//   type    set the input's value key by key, then a keydown Enter (fallback: a selector to click
//           when the hash has not changed 1.2 s later)
//   scroll  scroll the element's scrolling ancestor so it sits near the top, then move to it
//   wait    ms
// `text` on click/move picks, among the selector's matches, the one whose text is exactly `text`.

// The ask layer is an enhancement, not a dependency: with no VITE_API_BASE the #/ask route says so
// instead of answering, and the two ask shots fail. Record with
// VITE_API_BASE=https://wattson-api-ivory-seastar-408.fly.dev.
//
// The corpus figure is PASSAGES, not documents: 354 extracted passages from 8 source documents
// (4 sustainability reports, 4 annual filings, 4 companies) — claims/raw/*.jsonl, 118+74+66+51 ESG
// and 19+11+9+6 10-K, matching the live /api/search/status. Never say "354 filings".
// The tool count is ELEVEN, from the live /api/ask/status. server/ai.py in this repo is stale at
// ten; the demo runs against the service, so trust the service.
//
// This question was run against the live layer three times on 2026-09-20. It is an LLM answer, so
// the wording moves; what did not move is that it lands on Google's Santee Cooper site, returns
// kind "single" (so `.ask-headline` renders), and volunteers the V.C. Summer caveat itself. The
// expect therefore looks only for "Google". It answers from the numeric tools, NOT from retrieval —
// do not say this particular answer stands on the corpus.
export const ASK_Q = 'Which company claims 100% renewable but sits on the dirtiest grid at night?'
const ASK_ROUTE = `#/ask?q=${encodeURIComponent(ASK_Q)}`

// Figures the slides draw. National: regions.json meta.national — the clean SHARE of generation,
// which is what the night slide's bars and big numbers are. The megawatts behind them (178,129 ->
// 239,533 by day, 159,031 -> 173,380 at night) are spoken, never drawn, so the falling night share
// is never shown without the rising absolute beside it. Detector: the ranks the Found page prints.
export const NATIONAL = { day: { 2019: 0.372, 2025: 0.465 }, night: { 2019: 0.405, 2025: 0.397 } }
export const DETECTOR = {
  scored: 111,
  named: [['Northern Virginia', 6], ['Omaha', 7], ['Central Ohio', 19], ['Dallas', 91]],
  leads: [['N. Texas', 1], ['Permian', 2], ['Phoenix', 3], ['Tucson', 4], ['Santee Cooper', 9]],
}
export const SOURCES = ['52 operators · 134 sites', '111 regions scored', 'p. 4 · matched 100%', 'p. 94 · 65% hourly CFE', 'EIA-930 hourly, via PUDL', 'through 2026-09-05']

export const FILM = [
  // PROBLEM — the watchdog that does not exist, and the hours nobody separated.
  { id: 'open', section: 'problem', slide: 'flat', holdMs: 8000, title: 'Nobody audits the datacenters.',
    say: 'There’s a greenwashing watchdog for fast fashion. For airlines. For oil majors. There isn’t one for datacenters.',
    expect: { selector: '.film-slide.show', text: '3am' } },

  { id: 'night', section: 'problem', slide: 'night', holdMs: 9000, title: 'The night never got cleaner.',
    say: 'Since twenty nineteen America added sixty-five gigawatts of clean power to the average daytime hour, eighteen overnight. Nearly four times more.',
    expect: { selector: '.film-slide.show', text: ['46.5%', '39.7%'] } },

  // EVIDENCE — PJM, the grid under Data Center Alley.
  { id: 'pjm', section: 'evidence', route: '#/found', holdMs: 6000, title: 'Flat since 2019',
    sub: 'PJM clean generation between midnight and 6am: 35,700 MW then, 35,619 MW now.',
    say: 'In PJM — the grid operator for the largest datacenter cluster on earth — clean night generation hasn’t moved since twenty nineteen.',
    waitFor: '.wx-stepfig', actions: [{ type: 'wait', ms: 400 }, { type: 'move', selector: '.wx-stepfig' }],
    expect: { selector: '.wx-stepfig', text: '35,700 → 35,619' } },

  { id: 'gas', section: 'evidence', route: '#/found', holdMs: 6000, title: '8.7 GW more at night',
    sub: '10.7 GW of it gas, while exports to neighbours fell.',
    say: 'Overnight generation rose eight point seven gigawatts, ten point seven gas. Consistent with round-the-clock load served by gas, not caused by it.',
    waitFor: '.wx-step .btn', actions: [
      { type: 'click', selector: '.wx-step .btn', text: 'Next' },
      { type: 'wait', ms: 700 },
      { type: 'click', selector: '.wx-step .btn', text: 'Next' },
      { type: 'wait', ms: 700 },
    ],
    expect: { selector: '.wx-stepbody', text: ['+10.7 GW', 'Consistent with'] } },

  // PRODUCT 1 — the company check, and the page it came off.
  { id: 'type', section: 'product', route: '#/', holdMs: 400, title: null, sub: null, say: null,
    waitFor: '.pal-inline input', actions: [
      { type: 'click', selector: '.pal-inline input' },
      { type: 'type', selector: '.pal-inline input', text: 'Google', fallback: 'a.chip[href="#/check/GOOGL"]' },
    ],
    expect: { selector: '.ans-sticky', text: 'Alphabet (Google)' } },

  { id: 'google', section: 'product', route: '#/check/GOOGL', holdMs: 8000, title: 'True on paper. 6–91% physically.',
    sub: 'Says 100%. Its ten mapped sites sit on grids that generated 6–91% clean power in 2025.',
    say: 'True on paper — genuinely true under the GHG Protocol’s market-based method. Physically its ten sites run six to ninety-one percent.',
    waitFor: '.ans-gap', actions: [{ type: 'wait', ms: 400 }, { type: 'move', selector: '.ans-gap' }],
    expect: { selector: '.ans-gap', text: ['100%', '6–91%', '54 points apart, across 10 sites.'] } },

  { id: 'claims', section: 'product', route: '#/check/GOOGL', holdMs: 9000, title: 'Page 4 vs page 94',
    sub: 'Their own report, both numbers, one document, each quoted with its page.',
    say: 'Every claim is quoted from their own PDF with its page: page four, a hundred percent matched; page ninety-four, sixty-five percent.',
    waitFor: '.ans-next', actions: [
      { type: 'click', selector: '.ans-next' },
      { type: 'wait', ms: 900 },
      { type: 'scroll', selector: '[data-module="sbs"]' },
    ],
    expect: { selector: '[data-module="sbs"]', text: ['p. 4', 'p. 94', '65%'] } },

  // PRODUCT 2 — the detector: the signal pulled out of demand data alone.
  { id: 'detector', section: 'product', route: '#/found?s=detector', holdMs: 10000,
    title: '111 regions, demand only', sub: 'Method frozen and four regions named before any ranking was seen.',
    say: 'Signal out of noise: one hundred eleven regions from demand alone, frozen before we looked. We print the Dallas miss, and the error that corrected our own headline.',
    waitFor: '.ys-play', actions: [{ type: 'wait', ms: 300 }, { type: 'click', selector: '.ys-play' }],
    expect: { selector: '.fd-scene .note', text: ['Northern Virginia 6th', 'Dallas 91st'] } },

  // The one methods line. Everything in it is in regions.json meta.detector_method, on the Method
  // page and in CLAUDE.md's frozen decisions. No model is claimed, because none is in the repo.
  { id: 'method', section: 'product', route: '#/found?s=detector', holdMs: 7000,
    title: 'Frozen before we looked', sub: 'Robust z on median and MAD, a 500 MW cut, peak at the 99.5th percentile hour.',
    say: 'Robust statistics throughout — median and absolute deviation, not mean and standard deviation, so a few huge regions cannot swamp the score.',
    waitFor: '.fd-say', actions: [{ type: 'move', selector: '.fd-say' }],
    expect: { selector: '.fd-say', text: '111 regions' } },

  // PRODUCT 3 — OpenAI: six Stargate sites, then the one nobody can meter.
  { id: 'openai', section: 'product', route: '#/check/OPENAI', holdMs: 7000, title: 'Six Stargate sites',
    sub: 'No document of theirs read, so no claim to check — only the grids under the buildings.',
    say: 'We built the ask layer on OpenAI’s models, so let’s point it at OpenAI. Six Stargate sites, thirty-seven percent clean.',
    waitFor: '.ans-sticky', actions: [{ type: 'wait', ms: 400 }, { type: 'move', selector: '.ans-sticky' }],
    expect: { selector: '.ans-sticky', text: ['OpenAI', '37% on its grids'] } },

  { id: 'sites', section: 'product', route: '#/check/OPENAI', holdMs: 7000, title: 'Every site, its own grid',
    sub: 'Shackelford, Santa Teresa, Milam, Lordstown, Port Washington, Pike — mapped from the serving utility.',
    say: 'Six sites, six grids. Three traced to a named utility; three not, and the row says so.',
    waitFor: '.ans-next', actions: [
      { type: 'click', selector: '.ans-next' },
      { type: 'wait', ms: 900 },
      { type: 'scroll', selector: '[data-module="sites"] .rows' },
    ],
    expect: { selector: '[data-module="sites"] .rows', text: ['Shackelford County', 'AEP Ohio', 'utility unknown'] } },

  { id: 'epe', section: 'product', route: '#/check/OPENAI?evidence=1', holdMs: 8000,
    title: 'The argument in one utility', sub: 'El Paso Electric: 34.1% carbon-free by day, 1 MW of 655 at night.',
    say: 'El Paso Electric: thirty-four percent carbon-free at midday, one clean megawatt of six hundred fifty-five at night.',
    waitFor: '[data-module="sites"] .site-note', actions: [
      { type: 'scroll', selector: '[data-module="sites"] .site-note' },
    ],
    expect: { selector: '[data-module="sites"] .site-note', text: 'material caveat' } },

  { id: 'jupiter', section: 'product', route: '#/check/OPENAI?evidence=1', holdMs: 11000,
    title: 'And this one we cannot see.', sub: 'Reported, not measured: a gas microgrid that never touches the utility.',
    say: 'And this one we cannot see. Reporting says a gas microgrid that never connects to El Paso Electric, so that load never reaches federal data. Ten sites are behind the meter.',
    waitFor: '[data-module="sites"] .site-note summary', actions: [
      { type: 'click', selector: '[data-module="sites"] .site-note summary' },
      { type: 'wait', ms: 600 },
    ],
    expect: { selector: '[data-module="sites"] .site-note .note', text: ['700-900 MW gas microgrid', 'does NOT connect', 'will not appear in EPE demand'] } },

  // PRODUCT 4 — the ask layer, run as a real question. Two shots: the answer, then what it stands on.
  { id: 'ask', section: 'product', route: ASK_ROUTE, holdMs: 12000, title: 'Just ask it.',
    sub: 'Typed in plain English, answered off the published index.',
    say: 'Ask which hundred-percent-renewable claimant sits on the dirtiest grid at night. Google: Moncks Corner, Santee Cooper, zero point seven percent clean overnight.',
    // The answer is a live model call: allow for the round trip before the headline exists.
    waitFor: '.ask-headline', actions: [{ type: 'wait', ms: 800 }, { type: 'move', selector: '.ask-headline' }],
    expect: { selector: '.ask-headline', text: 'Google' } },

  { id: 'askhow', section: 'product', route: ASK_ROUTE, holdMs: 10000, title: 'It shows its working.',
    sub: '354 passages from 8 documents, 4 companies. Every figure checked against what the tools returned.',
    say: 'An OpenAI tool-calling loop over eleven typed tools, including Elasticsearch retrieval across three hundred fifty-four passages from their own reports and filings — the layer Codex wrote. It flags its own caveat.',
    waitFor: '.ask-prov', actions: [
      { type: 'scroll', selector: '.ask-caveats' },
      { type: 'wait', ms: 500 },
      { type: 'move', selector: '.ask-prov' },
    ],
    expect: { selector: '.ask-prov', text: 'over the published EIA-930 index' } },

  // REFUSALS — what it will not say, and the grid it clears.
  { id: 'refuse', section: 'refusals', route: '#/check/CRUSOE', holdMs: 11000,
    title: 'What it refuses to say', sub: 'No serving utility established, and the record says that instead of a guess.',
    say: 'We’re proudest of what it refuses to say. Crusoe: no site tied to a named utility. Forty-eight of fifty-two have no documents read.',
    waitFor: '.ans-figs', actions: [{ type: 'wait', ms: 400 }, { type: 'move', selector: '.ans-figs' }],
    expect: { selector: '.ans-figs', text: 'no serving utility established' } },

  { id: 'clean', section: 'refusals', route: '#/check/VANTAGE?evidence=1', holdMs: 7000,
    title: '100% carbon-free at 3am', sub: 'Quincy, Washington, on Grant County PUD. Columbia River hydro.',
    say: 'Vantage’s Quincy, Washington site sits on a grid a hundred percent carbon-free at 3am. Columbia River hydro. The method distinguishes.',
    waitFor: '[data-module="sites"] .rows', actions: [
      { type: 'wait', ms: 600 },
      { type: 'scroll', selector: '[data-module="sites"] .rows' },
    ],
    expect: { selector: '[data-module="sites"] .rows', text: ['Quincy', 'Grant County PUD', '100% at night'] } },

  // CLOSE
  { id: 'end', section: 'close', slide: 'end', holdMs: 8000, title: 'Wattson',
    say: 'A claim, the grid under the site, and the hour that decides it. It follows the power, not the press release.',
    expect: { selector: '.film-slide.show', text: 'HackMIT 2026' } },
]
