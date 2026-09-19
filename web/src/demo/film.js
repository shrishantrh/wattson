// The film: an ordered shot list Film.jsx runs on top of the live app (open any route with ?film=1).
// One story in five sections: PROBLEM (two slides), SOLUTION (one slide), HOW IT WORKS (the app
// walkthrough), IMPACT (two slides), CLOSE. A shot is either a slide Film.jsx draws itself (`slide`)
// or an app screen (`route`) with actions run in order by the fake cursor.
//
// `say` is the narration (scripts/narrate.mjs renders it and writes film.timing.json); a shot holds
// for max(holdMs, narration + 600 ms) after its actions, then 400 ms of silence. `expect` is checked
// at the end of the hold: the selector must exist on screen and contain the text (a string or a list;
// `notText` means the element's text must have moved on from that value). Failures land in
// window.__film.errors; the recorder prints the PASS/FAIL table and tiles one frame per check into
// docs/wattson-demo-shots.png. title is big (six words or fewer), sub one line; transitional shots
// have neither. Every number here is one the screen renders itself or one in docs/demo_script.md
// (recomputed from the served files); docs/narration.md is the readable copy of the script.
//
// Action: { type: 'move' | 'click' | 'type' | 'wait' | 'scroll', selector?, text?, ms?, fallback? }
//   move    cursor to the element's centre (measured at that moment)   click   move, ripple, el.click()
//   type    set the input's value key by key, then a keydown Enter (fallback: a selector to click
//           when the hash has not changed 1.2 s later)
//   scroll  scroll the element's scrolling ancestor so it sits near the top, then move to it
//   wait    ms
// `text` on click/move picks, among the selector's matches, the one whose text is exactly `text`.
export const DEMO_COMPARE_ROUTE = '#/compare?mw=300&metros=Phoenix%7CNorthern%20Virginia%7COmaha'

// Figures the slides draw. National: regions.json meta.national (the Found page's "Day vs night"
// pair, Compare's "Why night matters"). Detector: fixtures/opening.json detector (the Found page's
// "Where load is landing"): validation named in advance and the five new leads, with the ranks the
// screen shows. Sources: the Google claim's page cites (company/GOOGL.json) and the data footer.
export const NATIONAL = { day: { 2019: 0.372, 2025: 0.465 }, night: { 2019: 0.405, 2025: 0.397 } }
export const DETECTOR = {
  scored: 111,
  named: [['Northern Virginia', 6], ['Omaha', 7], ['Central Ohio', 19], ['Dallas', 91]],
  leads: [['N. Texas', 1], ['Permian', 2], ['Phoenix', 3], ['Tucson', 4], ['Santee Cooper', 9]],
}
export const SOURCES = ['p. 4 · matched 100%', 'p. 94 · 65% hourly CFE', 'google-2026-environmental-report.pdf', 'EIA-930 hourly, via PUDL', 'through 2026-09-05', '111 regions']

export const FILM = [
  // PROBLEM
  { id: 'flat', section: 'problem', slide: 'flat', holdMs: 3000, title: 'AI datacenters draw the same power at 3am as at noon.',
    say: 'AI datacenters draw the same power at 3am as at noon.',
    expect: { selector: '.film-slide.show', text: '3am' } },

  { id: 'night', section: 'problem', slide: 'night', holdMs: 6000, title: 'Since 2019 the grid cleaned up by day and stood still at night.',
    say: 'Since 2019 the US grid got cleaner by day and stood still at night. Half of that load lands in hours that did not improve.',
    expect: { selector: '.film-slide.show', text: ['46.5%', '39.7%'] } },

  // SOLUTION
  { id: 'two', section: 'solution', slide: 'two', holdMs: 5000, title: 'Wattson answers two questions.',
    say: 'Wattson reads what every US grid actually generated, hour by hour, and asks two questions.',
    expect: { selector: '.film-slide.show', text: ['powering', 'new load'] } },

  // HOW IT WORKS
  { id: 'landing', section: 'how', route: '#/', holdMs: 1500, title: "What's really powering it?", sub: 'Every US grid, every hour, from EIA-930 via PUDL.',
    say: "Let's check Google.",
    waitFor: '.pal-inline input', actions: [{ type: 'wait', ms: 300 }, { type: 'move', selector: '.pal-inline input' }],
    expect: { selector: '.hero-q', text: "What's really powering it?" } },

  { id: 'type', section: 'how', route: '#/', holdMs: 400, title: null, sub: null, say: null, waitFor: '.pal-inline input',
    actions: [
      { type: 'click', selector: '.pal-inline input' },
      { type: 'type', selector: '.pal-inline input', text: 'Google', fallback: 'a.chip[href="#/check/GOOGL"]' },
    ],
    expect: { selector: '.column', text: 'Alphabet (Google)' } },

  { id: 'google', section: 'how', route: '#/check/GOOGL', holdMs: 4000, title: 'True on paper. 6% physically.', sub: 'One mapped site, on a grid that generated 6% clean power in 2025.',
    say: 'Google says 100 percent renewable. True on paper. Its one mapped site sits on a grid that generated 6 percent clean power last year.',
    waitFor: '.column .verdict', actions: [{ type: 'wait', ms: 400 }, { type: 'move', selector: '.column .verdict' }],
    expect: { selector: '.column .verdict', text: 'True on paper' } },

  { id: 'evidence', section: 'how', route: '#/check/GOOGL', holdMs: 5000, title: 'Page 4 vs page 94', sub: 'Their own report, both pages.',
    say: 'Their own report agrees: page 4 says matched 100 percent, page 94 says 65 percent hourly. Both true, different measurements.',
    waitFor: '.column .toggle', actions: [
      { type: 'click', selector: '.column .toggle' },
      { type: 'scroll', selector: '[data-module="sbs"]' },
    ],
    expect: { selector: '[data-module="sbs"]', text: ['Says', 'Discloses'] } },

  { id: 'chip', section: 'how', route: '#/check/GOOGL?evidence=1', holdMs: 600, title: null, sub: null,
    say: 'Now: 300 megawatts, Phoenix, Northern Virginia or Omaha?',
    waitFor: '.brand', actions: [
      { type: 'click', selector: '.brand' },
      { type: 'wait', ms: 300 },
      { type: 'click', selector: 'a.chip[href^="#/compare"]' },
    ],
    expect: { selector: '.column', text: 'Compare' } },

  { id: 'compare', section: 'how', route: DEMO_COMPARE_ROUTE, holdMs: 5000, title: 'Same 300 MW, three grids', sub: 'Ranked on clean power at night, frozen before any result was seen.',
    say: 'Omaha ran 52 percent clean at night and is improving. Northern Virginia, 39 and getting worse. Phoenix, corrected from a very low base, is 10.',
    waitFor: '.column .nums', actions: [{ type: 'wait', ms: 400 }, { type: 'move', selector: '.column .nums' }],
    expect: { selector: '.column .verdict', text: 'Omaha is your cleanest option' } },

  { id: 'shape', section: 'how', route: DEMO_COMPARE_ROUTE, holdMs: 4000, title: 'Same places, different load shape', sub: 'A load has a shape; the ranking re-runs from each 24-hour profile.',
    say: 'A load has a shape. On business hours the ranking re-runs: Omaha 44, Northern Virginia 40, Phoenix 36.',
    waitFor: '.shape-seg button', actions: [{ type: 'click', selector: '.shape-seg button', text: 'business hours' }],
    expect: { selector: '.column .verdict', text: 'For a business hours load' } },

  { id: 'nearby', section: 'how', route: DEMO_COMPARE_ROUTE, holdMs: 4000, title: 'Is there a cleaner grid nearby?', sub: 'The same load, the cleanest grids within reach.',
    say: 'Nearby? Nothing within 500 miles of Omaha runs cleaner at night.',
    waitFor: '.column .toggle', actions: [
      { type: 'click', selector: '.shape-seg button', text: '24/7 flat' },
      { type: 'click', selector: '.column .toggle' },
      { type: 'scroll', selector: '[data-module="nearby"], [data-module="night"]' },
    ],
    expect: { selector: '[data-module="nearby"], [data-module="night"]', text: 'Omaha' } },

  { id: 'sweep', section: 'how', route: '#/found?s=sweep', holdMs: 6000, title: 'Cleaner by day, not at night', sub: 'The grid cleaned up by day and stood still at night since 2019.',
    say: 'By day, clean power rose from 37.2 to 46.5 percent. At night, 40.5 to 39.7. Solar fixed the day, not the night.',
    waitFor: '.pair', actions: [{ type: 'wait', ms: 300 }, { type: 'move', selector: '.pair' }],
    expect: { selector: '.pair', text: '40.5%' } },

  { id: 'detector', section: 'how', route: '#/found?s=detector', holdMs: 7000, title: 'Where flat load is landing', sub: '111 regions scored from demand alone, no company list.',
    say: '111 regions scored from demand alone, method frozen before results. Northern Virginia sixth, Omaha seventh, the Dallas miss reported as is.',
    waitFor: '.ys-play', actions: [{ type: 'wait', ms: 300 }, { type: 'click', selector: '.ys-play' }],
    expect: { selector: '.ys-year', notText: '2019' } },

  // IMPACT
  { id: 'found', section: 'impact', slide: 'found', holdMs: 5000, title: '111 regions scored from demand alone.',
    say: 'Four clusters were named before the ranking was seen; five new leads are not known datacenter clusters.',
    expect: { selector: '.film-slide.show', text: ['Northern Virginia', 'Santee Cooper'] } },

  { id: 'sources', section: 'impact', slide: 'sources', holdMs: 4500, title: 'Every number cites its source.',
    say: 'Grid-only, average mix, contracted power excluded. Every number cites its source.',
    expect: { selector: '.film-slide.show', text: ['p. 94', 'EIA-930'] } },

  // CLOSE
  { id: 'end', section: 'close', slide: 'end', holdMs: 4000, title: 'Wattson',
    say: 'Wattson. It follows the power, not the press release.',
    expect: { selector: '.film-slide.show', text: 'HackMIT 2026' } },
]
