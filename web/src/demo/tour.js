// The guided tour: one step per demo scene (scenes.js), matched by sceneId. Tour.jsx shows the
// caption for the scene demo mode is on; `say` is the presenter's line; `focus` is a CSS selector
// outlined on that screen when the element exists (it is looked up again while the page loads).
//
// Every figure here is read off the JSON that screen renders. Google: public/api/company/GOOGL.json.
// Compare: public/api/site/300mw-phoenix-nova-omaha.json (detector ranks and fuel deltas too).
// Sweep, detector, method: public/api/regions.json meta and meta.national. The PJM headline:
// public/api/region/PJM.json and PJM%2FDOM.json (what the Found screen loads). If the data is
// rebuilt, re-read these by hand; a caption that drifts from the screen is worse than none.
export const TOUR = [
  { sceneId: 'landing',
    caption: 'One box over the globe: name a company to check its clean-energy claim against the grids its sites use, or name places to compare on clean power at night.',
    say: 'Wattson follows the power, not the press release. Two questions: what is really powering this company, and where would new load run cleanest?',
    focus: '.pal-inline' },

  { sceneId: 'check',
    caption: "Google's 2026 environmental report says it matched 100% of its electricity with renewable purchases, annual and market-based (p. 4); that is true on paper, and its one mapped site, Moncks Corner SC, sits on a grid that generated 6% clean power in 2025.",
    say: 'True on paper, six percent physically. Read the caveat with it: that co-op’s nuclear reports under the neighbouring SCEG grid at 42%, so the footprint understates what the site can draw.',
    focus: '.column .verdict' },

  { sceneId: 'check-evidence',
    caption: "The same report says “matched 100%” on p. 4 and discloses hourly carbon-free energy across its data centers of 65% for 2025 on p. 94 (64 to 66% every year since 2021); annual matching and hourly supply are different measurements, and the company publishes both.",
    say: 'We did not catch Google out. We put page 4 next to page 94: annual matching is true under the market-based method, hourly supply is what a grid index measures.',
    focus: '[data-module="sbs"]' },

  { sceneId: 'companies',
    caption: 'Four companies, talk against walk: talk is how bold and specific the claims are, walk is the clean share of generation on the grids their mapped sites use, grid-only, contracted power excluded.',
    say: 'Google talks at 41 and walks at 6, on one mapped site with a footprint caveat. The gap is the story, not a verdict on honesty; claims we cannot verify are counted on screen.',
    focus: '.column .rows' },

  { sceneId: 'compare',
    caption: 'For 300 MW of flat load, Omaha would be served 52% clean at night, Northern Virginia 39% and Phoenix 10%; Phoenix ranks second on the frozen score only because its corrected history rises from a very low base.',
    say: 'Same 300 megawatts, three grids. In Omaha about 144 MW of it comes from fossil generation at night; in Phoenix about 269. Average mix, not marginal.',
    focus: '.column .nums' },

  { sceneId: 'compare-evidence',
    caption: "Each card is one grid: Omaha's last growth was filled by wind (+4.2 GW at night), Northern Virginia's by gas (+10.7 GW), and Phoenix's published history is corrected here because AZPS and SRP reported the same generation hour by hour through 2019.",
    say: 'Omaha is not the cleanest place in America. It is the cleanest of these three and moving the right way: plus five points since 2019, with clean power at night still only half of night demand.',
    focus: '[data-module="cand-SWPP/OPPD"]' },

  { sceneId: 'screen',
    caption: "Every scored region as a sortable table, here by the flat-load detector's rank: clean share at night in 2025, change since 2019, yearly trend, clean power over night demand, demand growth and the pattern label; the top 12 are pinned on the globe.",
    say: 'The quant view. Every column comes from hourly EIA-930 generation and demand; the detector reads demand only, so there is no company list for it to be biased by.',
    focus: '.tbl' },

  { sceneId: 'explore',
    caption: 'Demand growth since 2019 against overnight excess, how much faster the night grew than the average, for every scored region; the top-right of the median cross is the fingerprint of flat 24/7 load.',
    say: 'A datacenter draws the same power at 3am as at noon, so it lifts a region’s night-time floor faster than its mean. The four validation clusters were named before the ranking was seen.',
    focus: '.xp-chart' },

  { sceneId: 'alerts',
    caption: 'The engine’s ranked alerts for the trailing twelve months, one per place: night demand at a record or up 20% on 2019, clean share at night down 3 points, gas at night up 3 points in a year, clean power at night below 2019, or a new detector top-10 entry.',
    say: 'Severity is how far past the threshold, for how many months, and how recently. The dashed line separates the primary tier from supporting and chronic alerts.',
    focus: '.column .rows' },

  { sceneId: 'found-headline',
    caption: 'PJM, the mid-Atlantic grid, generated 35,700 MW of clean power at night in 2019 and 35,619 MW in 2025 while its overnight generation rose 8.7 GW; gas rose 10.7 GW and coal fell 2.5 GW.',
    say: 'The headline: overnight clean generation has not moved since 2019 and the growth was served by gas. Northern Virginia’s night demand rose about 4 GW, about half of PJM’s overnight growth, not all of it.',
    focus: '.hero-num' },

  { sceneId: 'found-night',
    caption: 'Rings mark the top-ranked places where night-time demand rose faster than daytime demand since 2019, read from demand data alone; the list is the detector’s top 10 with growth since 2019.',
    say: 'No company list was used. Phoenix ranks third, Northern Virginia sixth, Omaha seventh: a pattern consistent with flat 24/7 load, datacenters included.',
    focus: '.column .rows' },

  { sceneId: 'found-sweep',
    caption: 'The US grid’s clean share by day rose from 37.2% to 46.5% between 2019 and 2025 while at night it went from 40.5% to 39.7%; the sweep replays the years as the day-night line moves.',
    say: 'Solar cleaned up the middle of the day and did nothing for the middle of the night. A datacenter draws half its power in the hours that did not improve.',
    focus: '.pair' },

  { sceneId: 'found-detector',
    caption: '111 regions scored from demand alone with the method frozen before results, robust z of overnight excess plus neighbour divergence plus half the load-factor change; dots take the colour of clean share at night in the slider’s year, hollow when the data is flagged or corrected.',
    say: 'Validation was named in advance and reported as is, including the miss in Dallas. The pins in ember are flagged places that are not known datacenter clusters.',
    focus: '.ys' },

  { sceneId: 'method',
    caption: 'Clean is nuclear, hydro, wind, solar and geothermal as a share of what each balancing authority generated, hour by hour from EIA-930 via PUDL; night is 00:00–05:59 local, day 10:00–15:59, baseline 2019, data through 2026-09-05.',
    say: 'Generation within a footprint, not consumption. Average mix, not marginal. Grid-only, contracted power excluded. Every caveat we hold to is on this page.',
    focus: '.column .rows' },
]
