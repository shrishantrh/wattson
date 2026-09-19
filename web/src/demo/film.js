// The film: an ordered shot list Film.jsx runs on top of the live app (open any route with ?film=1).
// Each shot: route (hash to land on; the film flag is added), actions run in order with the fake
// cursor, then the caption holds for holdMs before fading. title is big (six words or fewer), sub is
// one line. Transitional shots have no title. Every number here is one the screen renders itself or
// one in docs/demo_script.md; the captions name the module, the app shows the figures.
//
// Action: { type: 'move' | 'click' | 'type' | 'wait' | 'scroll', selector?, text?, ms?, fallback? }
//   move    cursor to the element's centre        click   move, ripple, el.click()
//   type    set the input's value key by key, then a keydown Enter (fallback: a selector to click
//           when the hash has not changed 1.2 s later)
//   scroll  scroll the element's scrolling ancestor so it sits near the top, and move the cursor to it
//   wait    ms
// `text` on click/move picks, among the selector's matches, the one whose text is exactly `text`.
export const DEMO_COMPARE_ROUTE = '#/compare?mw=300&metros=Phoenix%7CNorthern%20Virginia%7COmaha'

export const FILM = [
  { route: '#/', holdMs: 5000, title: "What's really powering it?", sub: 'Every US grid, every hour, from EIA-930 via PUDL.',
    waitFor: '.pal-inline input', actions: [{ type: 'wait', ms: 800 }, { type: 'move', selector: '.pal-inline input' }] },

  { route: '#/', holdMs: 1200, title: null, sub: null, waitFor: '.pal-inline input',
    actions: [
      { type: 'click', selector: '.pal-inline input' },
      { type: 'type', selector: '.pal-inline input', text: 'Google', fallback: 'a.chip[href="#/check/GOOGL"]' },
    ] },

  { route: '#/check/GOOGL', holdMs: 6000, title: 'True on paper. 6% physically.', sub: 'One mapped site, on a grid that generated 6% clean power in 2025.',
    waitFor: '.column .verdict', actions: [{ type: 'wait', ms: 600 }, { type: 'move', selector: '.column .verdict' }] },

  { route: '#/check/GOOGL', holdMs: 8000, title: 'Page 4 vs page 94', sub: 'Their own report, both pages.',
    waitFor: '.column .toggle', actions: [
      { type: 'click', selector: '.column .toggle' },
      { type: 'scroll', selector: '[data-module="sbs"]' },
    ] },

  { route: '#/check/GOOGL?evidence=1', holdMs: 900, title: null, sub: null, waitFor: '.brand',
    actions: [{ type: 'click', selector: '.brand' }] },

  { route: '#/', holdMs: 900, title: null, sub: null, waitFor: 'a.chip[href^="#/compare"]',
    actions: [{ type: 'wait', ms: 500 }, { type: 'click', selector: 'a.chip[href^="#/compare"]' }] },

  { route: DEMO_COMPARE_ROUTE, holdMs: 7000, title: 'Same 300 MW, three grids', sub: 'Ranked on clean power at night, frozen before any result was seen.',
    waitFor: '.column .nums', actions: [{ type: 'wait', ms: 600 }, { type: 'move', selector: '.column .nums' }] },

  { route: DEMO_COMPARE_ROUTE, holdMs: 5000, title: 'Same places, different load shape', sub: 'A load has a shape; the ranking re-runs from each 24-hour profile.',
    waitFor: '.shape-seg button', actions: [{ type: 'click', selector: '.shape-seg button', text: 'business hours' }] },

  { route: DEMO_COMPARE_ROUTE, holdMs: 6000, title: 'Is there a cleaner grid nearby?', sub: 'The same load, the cleanest grids within reach.',
    waitFor: '.column .toggle', actions: [
      { type: 'click', selector: '.shape-seg button', text: '24/7 flat' },
      { type: 'click', selector: '.column .toggle' },
      { type: 'scroll', selector: '[data-module="nearby"], [data-module="night"]' },
    ] },

  { route: '#/found?s=sweep', holdMs: 8000, title: 'Cleaner by day, not at night', sub: 'The grid cleaned up by day and stood still at night since 2019.',
    waitFor: '.pair', actions: [{ type: 'wait', ms: 400 }, { type: 'move', selector: '.pair' }] },

  { route: '#/found?s=detector', holdMs: 9000, title: 'Where flat load is landing', sub: '111 regions scored from demand alone, no company list.',
    waitFor: '.ys-play', actions: [{ type: 'wait', ms: 500 }, { type: 'click', selector: '.ys-play' }] },

  { route: '#/', holdMs: 6000, title: 'Wattson', sub: 'It follows the power, not the press release.', end: true,
    waitFor: '.hero-q', actions: [{ type: 'wait', ms: 300 }] },
]
