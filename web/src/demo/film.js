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
// (the 52-operator merge) or docs/pitch/numbers.md (everything older). docs/narration-annex.md is
// the canonical record: a file and a field for every figure spoken, plus the correction notes and
// the recording conditions. docs/narration.md is only the reading copy and is REGENERATED from this
// file by web/scripts/narrate.mjs, so never put sourcing there.
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
  // ---- WHAT IT IS ------------------------------------------------------------------------------
  { id: 'open', section: 'what', slide: 'flat', holdMs: 6000, title: 'Nobody audits the datacenters.',
    say: 'Fast fashion has a greenwashing watchdog. Airlines have one. Datacenters don’t.',
    expect: { selector: '.film-slide.show', text: '3am' } },

  // The spine of the whole film: the four steps, once, in the order the software does them. Every
  // later screen is then an instance of a process the viewer already has in their head.
  { id: 'what', section: 'what', route: '#/', holdMs: 8000, title: 'How it works',
    sub: 'A claim. The buildings behind it. The grid under each one. The hours it actually generated.',
    say: 'Here’s how it works. A company publishes a claim. We find the buildings it operates. Each sits on a grid we can name. We read what that grid generated hour by hour. Then we compare.',
    waitFor: '.hero-q', actions: [{ type: 'wait', ms: 400 }, { type: 'move', selector: '.hero-sub' }],
    expect: { selector: '.hero-q', text: "What's really powering it?" } },

  { id: 'why', section: 'what', slide: 'night', holdMs: 8000, title: 'Why the hour matters',
    say: 'Why hours? Since twenty nineteen America added sixty-five gigawatts of clean power to the average daytime hour. Overnight it added eighteen. Datacenters run on both.',
    expect: { selector: '.film-slide.show', text: ['46.5%', '39.7%'] } },

  // ---- WALK IT: the four steps, on one company -------------------------------------------------
  { id: 'type', section: 'walk', route: '#/', holdMs: 400, title: null, sub: null, say: null,
    waitFor: '.pal-inline input', actions: [
      { type: 'click', selector: '.pal-inline input' },
      { type: 'type', selector: '.pal-inline input', text: 'Google', fallback: 'a.chip[href="#/check/GOOGL"]' },
    ],
    expect: { selector: '.ans-sticky', text: 'Alphabet (Google)' } },

  { id: 'google', section: 'walk', route: '#/check/GOOGL', holdMs: 6000, title: 'Step one and two',
    sub: 'The claim it publishes, and the ten buildings we have mapped to a serving utility.',
    say: 'Start with Google. First the claim. Google says a hundred percent renewable. Then the buildings. We’ve mapped ten.',
    waitFor: '.ans-rest', actions: [{ type: 'wait', ms: 400 }, { type: 'move', selector: '.ans-rest' }],
    expect: { selector: '.ans-rest', text: 'True on paper' } },

  { id: 'grids', section: 'walk', route: '#/check/GOOGL', holdMs: 8000, title: 'Step three and four',
    sub: 'The grid under each building, and what it generated in 2025.',
    say: 'Now the grids. They ran six to ninety-one percent clean last year. That averages forty-six. So the claim is true on paper under the GHG Protocol. Not a lie. A contract against a meter.',
    waitFor: '.ans-gap', actions: [{ type: 'wait', ms: 300 }, { type: 'move', selector: '.ans-gap' }],
    expect: { selector: '.ans-gap', text: ['100%', '6–91%', '54 points apart, across 10 sites.'] } },

  { id: 'claims', section: 'walk', route: '#/check/GOOGL', holdMs: 7000, title: 'Where the claim came from',
    sub: 'Page 4 makes the claim. Page 94 of the same report discloses the hourly figure.',
    say: 'Here’s the claim we read. Page four of their own report. Their page ninety-four discloses the hourly figure. Sixty-five percent.',
    // The drawer animates open, and until it has finished the column is not yet taller than its
    // own viewport — so scrollParent() finds nothing and the scroll silently does nothing. Wait for
    // the drawer, then scroll twice: the second pass re-lands it after any late reflow.
    waitFor: '.ans-next', actions: [
      { type: 'click', selector: '.ans-next' },
      { type: 'wait', ms: 2000 },
      { type: 'scroll', selector: '[data-module="sbs"]' },
      { type: 'wait', ms: 500 },
      { type: 'scroll', selector: '[data-module="sbs"]' },
    ],
    expect: { selector: '[data-module="sbs"]', text: ['p. 4', 'p. 94', '65%'] } },

  // ---- WALK IT: the same reading with no company list ------------------------------------------
  { id: 'detector', section: 'walk', route: '#/found?s=detector', holdMs: 8000,
    title: 'The same reading, no list', sub: 'Demand data only. It never reads a press release.',
    say: 'That works when we know the company. This answers a harder question. Where is new round-the-clock load landing when nobody tells us? It reads demand alone. No company list.',
    waitFor: '.fd-say', actions: [{ type: 'wait', ms: 400 }, { type: 'move', selector: '.fd-say' }],
    expect: { selector: '.fd-say', text: '111 regions' } },

  { id: 'method', section: 'walk', route: '#/found?s=detector', holdMs: 9000,
    title: 'Frozen before we looked', sub: 'Robust z on median and MAD, a 500 MW cut, four test regions named in advance.',
    say: 'A hundred and eleven regions get a score. The scoring uses medians instead of means. One big region can’t swamp it. It was frozen before we looked. Dallas came ninety-first. We print the miss.',
    waitFor: '.ys-play', actions: [{ type: 'wait', ms: 300 }, { type: 'click', selector: '.ys-play' }],
    expect: { selector: '.fd-scene .note', text: ['Northern Virginia 6th', 'Dallas 91st'] } },

  // ---- ONE FINDING -----------------------------------------------------------------------------
  { id: 'pjm', section: 'finding', route: '#/found', holdMs: 6000, title: 'Flat since 2019',
    sub: 'PJM clean generation between midnight and 6am: 35,700 MW then, 35,619 MW now.',
    say: 'Now run that reading on PJM. That’s the grid operator for the biggest datacenter cluster on earth. Clean power at night hasn’t moved since twenty nineteen.',
    waitFor: '.wx-stepfig', actions: [{ type: 'wait', ms: 400 }, { type: 'move', selector: '.wx-stepfig' }],
    expect: { selector: '.wx-stepfig', text: '35,700 → 35,619' } },

  { id: 'gas', section: 'finding', route: '#/found', holdMs: 6000, title: '8.7 GW more at night',
    sub: '10.7 GW of it gas, while exports to neighbours fell.',
    say: 'The night got eight point seven gigawatts bigger. Gas supplied ten point seven. Consistent with round-the-clock load served by gas. Not caused by it.',
    waitFor: '.wx-step .btn', actions: [
      { type: 'click', selector: '.wx-step .btn', text: 'Next' },
      { type: 'wait', ms: 700 },
      { type: 'click', selector: '.wx-step .btn', text: 'Next' },
      { type: 'wait', ms: 700 },
    ],
    expect: { selector: '.wx-stepbody', text: ['+10.7 GW', 'Consistent with'] } },

  // ---- WHAT THE METHOD CANNOT SEE, AND THE ASK LAYER -------------------------------------------
  // One shot, not three: the cursor walks the six mapped sites while the narration names them, then
  // opens the caveat on the one site the method is blind to.
  { id: 'stargate', section: 'walk', route: '#/check/OPENAI', holdMs: 10000,
    title: 'Six sites, one we can’t see', sub: 'Three sites trace to a named utility, three do not, and one runs on its own gas plant.',
    say: 'We built the ask layer on OpenAI’s models. So point it at OpenAI. Six Stargate sites. Each mapped to a grid. Only three to a named utility. One we can’t see at all. Reporting says it runs on its own gas plant.',
    // Same drawer-animation trap as `claims`: scroll too early and scrollParent() finds nothing.
    waitFor: '.ans-next', actions: [
      { type: 'click', selector: '.ans-next' },
      { type: 'wait', ms: 2000 },
      { type: 'scroll', selector: '[data-module="sites"] .site-note' },
      { type: 'click', selector: '[data-module="sites"] .site-note summary' },
      { type: 'wait', ms: 700 },
      // Opening the disclosure pushes its body below the fold, and the expect needs it in view.
      { type: 'scroll', selector: '[data-module="sites"] .site-note .note' },
      { type: 'wait', ms: 500 },
      { type: 'scroll', selector: '[data-module="sites"] .site-note .note' },
    ],
    expect: { selector: '[data-module="sites"] .site-note .note', text: ['700-900 MW gas microgrid', 'does NOT connect'] } },

  // The specific case generalises into the limitation. "Ten" is the count of site notes that say
  // "behind the meter" across company/*.json, verified by hand: ten say it, fifteen describe on-site
  // generation of any kind. Not eleven — that figure is not reproducible from anything in the repo.
  { id: 'blind', section: 'walk', route: '#/check/OPENAI?evidence=1', holdMs: 6000,
    title: 'Our own blind spot', sub: 'Ten mapped sites make their own power, so federal demand data never sees them.',
    say: 'Ten of our mapped sites are behind the meter. A demand-only detector can’t see them.',
    waitFor: '[data-module="sites"] .site-note .note', actions: [
      { type: 'move', selector: '[data-module="sites"] .site-note .note' },
    ],
    expect: { selector: '[data-module="sites"] .site-note .note', text: 'will not appear in EPE demand' } },

  { id: 'ask', section: 'walk', route: ASK_ROUTE, holdMs: 9000, title: 'Or just ask it',
    sub: 'Typed in plain English, answered off the published index.',
    say: 'You can also just ask it. Which claimant sits on the dirtiest grid at night? It answers Google. Moncks Corner. Zero point seven percent clean overnight.',
    waitFor: '.ask-headline', actions: [{ type: 'wait', ms: 800 }, { type: 'move', selector: '.ask-headline' }],
    expect: { selector: '.ask-headline', text: 'Google' } },

  { id: 'askhow', section: 'walk', route: ASK_ROUTE, holdMs: 9000, title: 'It shows its working.',
    sub: 'Eleven typed tools. Every figure named against the tool that returned it.',
    say: 'That’s an OpenAI tool-calling loop over eleven typed tools. One searches three hundred fifty-four passages in Elasticsearch. They come from the companies’ own reports and filings. Codex wrote that retrieval layer.',
    waitFor: '.ask-prov', actions: [
      { type: 'scroll', selector: '.ask-caveats' },
      { type: 'wait', ms: 500 },
      { type: 'move', selector: '.ask-prov' },
    ],
    expect: { selector: '.ask-prov', text: 'over the published EIA-930 index' } },

  // ---- ONE REFUSAL -----------------------------------------------------------------------------
  { id: 'refuse', section: 'refusal', route: '#/check/CRUSOE', holdMs: 8000,
    title: 'What it refuses to say', sub: 'No serving utility established, and the record says that instead of a guess.',
    say: 'Last thing. Watch what it won’t say. We couldn’t tie a single Crusoe building to a named utility. So the record says that.',
    waitFor: '.ans-figs', actions: [{ type: 'wait', ms: 400 }, { type: 'move', selector: '.ans-figs' }],
    expect: { selector: '.ans-figs', text: 'no serving utility established' } },

  // The counterweight. Without a place that comes out well on screen, the film reads as an
  // accusation rather than an instrument: a grid that is carbon-free at 3am is as much a finding
  // as one that is not.
  { id: 'clean', section: 'refusal', route: '#/check/VANTAGE?evidence=1', holdMs: 7000,
    title: '100% carbon-free at 3am', sub: 'Quincy, Washington, on Grant County PUD. Columbia River hydro.',
    say: 'Vantage’s Quincy, Washington site sits on a grid a hundred percent carbon-free at 3am. Columbia River hydro. The method distinguishes.',
    // The night-time sparkline and its "100% at night" caption render a few seconds after the
    // module mounts, once the per-region series loads. Wait for it rather than race it.
    waitFor: '[data-module="sites"] .rows', actions: [
      { type: 'wait', ms: 2200 },
      { type: 'scroll', selector: '[data-module="sites"] .rows' },
      { type: 'wait', ms: 600 },
      // The sparkline caption arrives late and grows the column; scroll again once it has.
      { type: 'scroll', selector: '[data-module="sites"] .rows' },
    ],
    expect: { selector: '[data-module="sites"] .rows', text: ['Quincy', 'Grant County PUD', '100% at night'] } },

  // ---- CLOSE: the four steps again, as a list --------------------------------------------------
  { id: 'end', section: 'close', slide: 'end', holdMs: 8000, title: 'Wattson',
    say: 'A claim. The buildings behind it. The grid under each one. The hour that decides it. It follows the power, not the press release.',
    expect: { selector: '.film-slide.show', text: 'HackMIT 2026' } },
]
