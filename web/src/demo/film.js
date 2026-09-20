// The film: an ordered shot list Film.jsx runs on top of the live app (open any route with ?film=1).
// One story in five sections: PROBLEM (two slides), SOLUTION (one slide), HOW IT WORKS (the app
// walkthrough), IMPACT (the finding and the limits), CLOSE. A shot is either a slide Film.jsx draws
// itself (`slide`) or an app screen (`route`) with actions run in order by the fake cursor.
//
// `say` is the narration (scripts/narrate.mjs renders it and writes film.timing.json); a shot holds
// for max(holdMs, narration + 600 ms) after its actions, then 400 ms of silence. `expect` is checked
// at the end of the hold: the selector must exist on screen and contain the text (a string or a list;
// `notText` means the element's text must have moved on from that value). Failures land in
// window.__film.errors; the recorder prints the PASS/FAIL table and tiles one frame per check into
// docs/wattson-demo-shots.png. title is big (six words or fewer), sub one line; transitional shots
// have neither. Every number here is one the screen renders itself or one in docs/pitch/numbers.md;
// docs/narration.md is the readable copy of the script, with a source for every figure spoken.
//
// Every selector and every expect string below was read off the running app at 1440x900 on
// 2026-09-20, after the interface rebuild: the answer card's primary action is `.ans-next` (its
// label is dynamic — "See its report pages" / "See the evidence" / "Hide the evidence"), the
// compare screen puts the answer above the controls, and evidence cards carry worded Drag/Hide
// buttons. There is no close button on an answer card any more; navigation is the breadcrumb.
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
  // PROBLEM — the flat load, and the hours it lands in.
  { id: 'flat', section: 'problem', slide: 'flat', holdMs: 6500, title: 'The same power at 3am as at noon.',
    say: 'An AI datacenter draws the same power at three in the morning as at noon.',
    expect: { selector: '.film-slide.show', text: '3am' } },

  { id: 'night', section: 'problem', slide: 'night', holdMs: 11000, title: 'The night never got cleaner.',
    say: 'Since twenty nineteen the grid cleaned up by day: thirty seven percent to forty six. At night, forty to forty. Solar fixed the day, not the night.',
    expect: { selector: '.film-slide.show', text: ['46.5%', '39.7%'] } },

  // SOLUTION
  { id: 'two', section: 'solution', slide: 'two', holdMs: 9500, title: 'So we built Wattson.',
    say: 'So half of a flat load lands in hours that never improved. Wattson reads what every American grid actually generated, hour by hour.',
    expect: { selector: '.film-slide.show', text: ['powering', 'new load'] } },

  // HOW IT WORKS — question one: what powers a company's sites?
  { id: 'landing', section: 'how', route: '#/', holdMs: 3500, title: "What's really powering it?", sub: 'Every US grid, every hour, from EIA-930 via PUDL.',
    say: 'First question. What is actually powering a company’s data centers?',
    waitFor: '.pal-inline input', actions: [{ type: 'wait', ms: 300 }, { type: 'move', selector: '.pal-inline input' }],
    expect: { selector: '.hero-q', text: "What's really powering it?" } },

  { id: 'type', section: 'how', route: '#/', holdMs: 400, title: null, sub: null, say: null, waitFor: '.pal-inline input',
    actions: [
      { type: 'click', selector: '.pal-inline input' },
      { type: 'type', selector: '.pal-inline input', text: 'Google', fallback: 'a.chip[href="#/check/GOOGL"]' },
    ],
    expect: { selector: '.column', text: 'Alphabet (Google)' } },

  { id: 'google', section: 'how', route: '#/check/GOOGL', holdMs: 11500, title: 'True on paper. 6% physically.', sub: 'One mapped site, on a grid that generated 6% clean power in 2025.',
    say: 'Google says one hundred percent renewable. True on paper: an annual, market based claim. Its one mapped site sits on Santee Cooper’s grid, which generated six percent clean power last year.',
    waitFor: '.ans-rest', actions: [{ type: 'wait', ms: 400 }, { type: 'move', selector: '.ans-rest' }],
    expect: { selector: '.ans-rest', text: 'True on paper' } },

  { id: 'gap', section: 'how', route: '#/check/GOOGL', holdMs: 5000, title: '94 points apart', sub: 'Says 100%. Its grids generated 6%.',
    say: 'We never say they lied. We say: true on paper, six percent physically.',
    waitFor: '.ans-gap', actions: [{ type: 'move', selector: '.ans-gap' }],
    expect: { selector: '.ans-gap', text: ['100%', '6%', '94 points apart.'] } },

  { id: 'evidence', section: 'how', route: '#/check/GOOGL', holdMs: 7500, title: 'Page 4 vs page 94', sub: 'Their own report, both numbers, one document.',
    say: 'Their own report agrees. Page four makes the claim. Page ninety four discloses the hourly number: about sixty five percent, flat for five years.',
    waitFor: '.ans-next', actions: [
      { type: 'click', selector: '.ans-next' },
      { type: 'scroll', selector: '[data-module="sbs"]' },
    ],
    expect: { selector: '[data-module="sbs"]', text: ['p. 4', 'p. 94', '65%'] } },

  { id: 'page94', section: 'how', route: '#/check/GOOGL?evidence=1', holdMs: 5500, title: 'Their page, full size', sub: 'google-2026-environmental-report.pdf, page 94.',
    say: 'Here is that page, full size, straight out of their report. Two measurements, both theirs.',
    waitFor: '.sbs-ex:nth-child(2) .sbs-shot', actions: [{ type: 'click', selector: '.sbs-ex:nth-child(2) .sbs-shot' }],
    expect: { selector: '.sbs-lb', text: 'page 94' } },

  // HOW IT WORKS — question two: where should new load go?
  { id: 'tocompare', section: 'how', route: '#/check/GOOGL?evidence=1', holdMs: 3000, title: null, sub: null,
    say: 'Second question. If you are building three hundred megawatts of flat load, where should it go?',
    waitFor: '.sbs-lb', actions: [
      { type: 'click', selector: '.sbs-lb' },
      { type: 'click', selector: '.bc-seg', text: 'Home' },
      { type: 'wait', ms: 400 },
      { type: 'click', selector: 'a.chip[href^="#/compare"]' },
    ],
    expect: { selector: '.ans-sticky', text: ['300 MW', 'Omaha'] } },

  { id: 'compare', section: 'how', route: DEMO_COMPARE_ROUTE, holdMs: 9500, title: 'Same 300 MW, three grids', sub: 'Ranked on clean power at night, frozen before any result was seen.',
    say: 'Three hundred megawatts, three places. Omaha is the cleanest: fifty two percent clean at night, and improving. Northern Virginia is thirty nine, and getting worse.',
    waitFor: '.ans-rank', actions: [{ type: 'wait', ms: 400 }, { type: 'move', selector: '.ans-rank' }],
    expect: { selector: '.ans-rank', text: ['Omaha', '52%', 'N. Virginia', '39%'] } },

  { id: 'fossil', section: 'how', route: DEMO_COMPARE_ROUTE, holdMs: 9000, title: '144 MW versus 269 MW', sub: 'Fossil generation behind the same load, at night, on the 2025 mix.',
    say: 'Same three hundred megawatts: a hundred and forty four megawatts of fossil at night in Omaha, two hundred and sixty nine in Phoenix.',
    waitFor: '.note.live', actions: [{ type: 'move', selector: '.note.live' }],
    expect: { selector: '.note.live', text: ['144 MW', '269 MW'] } },

  { id: 'phoenix', section: 'how', route: DEMO_COMPARE_ROUTE, holdMs: 10000, title: 'A double count, corrected', sub: 'Phoenix ranks 2nd on 10%, above Northern Virginia on 39%. Here is why.',
    say: 'Phoenix ranks second on ten percent, above Northern Virginia’s thirty nine. Its published twenty nineteen figure counted a nuclear plant twice, so it is climbing from two percent, not falling from sixty two.',
    waitFor: '.ans-next', actions: [
      { type: 'click', selector: '.ans-next' },
      { type: 'wait', ms: 1200 },
      { type: 'scroll', selector: '[data-module="cand-AZPS"]' },
    ],
    expect: { selector: '[data-module="cand-AZPS"]', text: 'Corrected, Phoenix rose from 2% to 10%' } },

  // IMPACT — the finding, the detector, the limits.
  { id: 'found', section: 'impact', route: '#/found', holdMs: 10500, title: 'Flat since 2019', sub: 'PJM overnight clean generation: 35,700 MW then, 35,619 MW now.',
    say: 'The mid Atlantic grid that serves Data Center Alley added eight point seven gigawatts of overnight generation since twenty nineteen. Clean generation at night fell eighty one megawatts.',
    waitFor: '.fd-fig', actions: [{ type: 'wait', ms: 300 }, { type: 'move', selector: '.fd-fig' }],
    expect: { selector: '.fd-fig', text: '35,619' } },

  { id: 'gas', section: 'impact', route: '#/found', holdMs: 8000, title: '8.7 GW more at night', sub: '10.7 GW of it gas, while exports to neighbours fell.',
    say: 'Ten point seven gigawatts of that growth was gas. Consistent with flat datacenter load being served by gas. Not caused by.',
    waitFor: '.fd-nums', actions: [{ type: 'move', selector: '.fd-nums' }],
    expect: { selector: '.fd-nums', text: ['+8.7 GW', '+10.7 GW'] } },

  { id: 'detector', section: 'impact', route: '#/found?s=detector', holdMs: 10000, title: '111 regions, demand only', sub: 'Method frozen and four regions named before any ranking was seen.',
    say: 'A detector scored one hundred and eleven regions from demand alone, frozen before any ranking. Northern Virginia sixth. Dallas ninety first: we missed it, and we print it.',
    waitFor: '.ys-play', actions: [{ type: 'wait', ms: 300 }, { type: 'click', selector: '.ys-play' }],
    expect: { selector: '.fd-scene .note', text: ['Northern Virginia 6th', 'Dallas 91st'] } },

  { id: 'sources', section: 'impact', slide: 'sources', holdMs: 12500, title: 'Every number cites its source.',
    say: 'The limits. We measure what a grid generated inside its footprint, not what a company consumed. Average mix, not marginal. Contracted power excluded. Claims we cannot verify are counted, not scored.',
    expect: { selector: '.film-slide.show', text: ['p. 94', 'EIA-930'] } },

  // CLOSE
  { id: 'end', section: 'close', slide: 'end', holdMs: 9000, title: 'Wattson',
    say: 'Yash built the data engine and the claims extraction. I built the product. Wattson. It follows the power, not the press release.',
    expect: { selector: '.film-slide.show', text: 'HackMIT 2026' } },
]
