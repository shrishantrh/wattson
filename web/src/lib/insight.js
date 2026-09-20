// "What am I looking at", one short explainer per screen, generated here, not written by hand
// per page and never by a model. Same rules as lib/findings.js: plain English, no jargon, and no
// number that the page did not hand us. Nothing in this file contains a digit; every figure that
// appears comes from `ctx` and is interpolated only when it is given.
//
//   insightFor(route, ctx) -> { title, lines: string[], hint?, actions?: [{ label, href }] }
//   insightForRoute(hash, ctx) -> the same, for a location hash (see ../router.js)
//
// Keep every line under ~90 characters so the panel stays a small card in the corner.

import { parseHash } from '../router.js'

export const MAX_LINE = 90

// Only interpolate when the page gave us the value; otherwise keep the sentence general.
const has = v => v != null && v !== '' && !(typeof v === 'number' && Number.isNaN(v))
const keep = (...lines) => lines.filter(Boolean)

const FOUND = {
  headline: 'The globe marks the one grid the headline is about: Northern Virginia.',
  night: 'Dots are the places whose demand grew fastest in the hours after midnight.',
  sweep: 'The lit half of the globe moves, so you can watch day clean up and night stand still.',
  detector: 'Every scored region is a dot; ember means its grid is dirtiest in the night hours.',
}

const ONE_LINERS = {
  explore: {
    title: 'Explore',
    lines: ['Build your own view: pick regions, pick a measure, and the chart follows.', 'Nothing here is precomputed, so a filter changes the numbers in place.'],
    hint: 'Presets are starting points, not saved answers.',
  },
  screen: {
    title: 'The screener',
    lines: ['Every region we score, in one sortable table, with the reason for each rank.', 'Sort to ask a question; the sentence at the top rewrites itself to match.'],
  },
  data: {
    title: 'Data',
    lines: ['Where every figure comes from, and what we had to drop before using it.', 'Each table can be downloaded as it was used, not as a summary.'],
  },
  alerts: {
    title: 'Alerts',
    lines: ['Regions whose latest month broke out of their own recent range.', 'An alert is a flag to look, not a finding.'],
  },
  companies: {
    title: 'Companies',
    lines: ['Each watchlist company, its own claim, and the grid its mapped sites draw from.', 'Claims we cannot check from grid data are counted, not quietly dropped.'],
  },
  method: {
    title: 'Method',
    lines: ['How the index, the detector and the siting score are built, and what they miss.', 'The limits are listed here rather than in a footnote.'],
  },
  landing: {
    title: 'Wattson',
    lines: ['We check clean-power claims against the grid that actually serves the buildings.', 'The globe is every US grid, coloured by how clean its power is.'],
    hint: 'Type a company or a place to start.',
  },
}

export function insightFor(route = {}, ctx = {}) {
  const page = route.page || 'landing'
  switch (page) {
    case 'check': {
      const who = route.ticker && ctx.company ? ctx.company : null
      return {
        title: who ? `Checking ${who}` : 'Checking a company',
        lines: keep(
          'The verdict is about accounting: "true on paper" means the paperwork adds up.',
          has(ctx.physicalRange)
            ? `The physical number is the grid its sites draw from: ${ctx.physicalRange} clean.`
            : 'The physical number is the grid its sites draw from, hour by hour.',
          'The bar shows the gap between the two: claimed on one side, measured on the other.',
          'Contracted clean power is excluded here, so this is the grid alone.',
        ),
        hint: 'Sites are hand-mapped, so read the count as a sample, not a census.',
        actions: keep(
          route.ticker && { label: 'See the evidence', href: `#/check/${encodeURIComponent(route.ticker)}?evidence=1` },
          { label: 'How this is built', href: '#/method' },
        ),
      }
    }
    case 'compare': {
      const n = Array.isArray(route.metros) ? route.metros.length : 0
      return {
        title: n ? 'Comparing places' : 'Compare places',
        lines: keep(
          'Rank: clean at night, whether it is improving, and clean power against demand.',
          'The three count equally, and the weights were frozen before any result was seen.',
          'Pins on the globe are the places you are comparing, in rank order.',
          'The shape picker re-ranks on the hours your load would actually use.',
          has(ctx.mw) ? `Sized for the ${ctx.mw} MW of flat load you asked about.` : null,
        ),
        hint: 'Grid-only: contracted clean power is not counted.',
        actions: [{ label: 'Why this order', href: '#/method' }],
      }
    }
    case 'region': {
      const name = has(ctx.name) ? ctx.name : route.id || 'this region'
      return {
        title: name,
        lines: keep(
          'The hour bars are one day: how clean this grid runs in each hour, local time.',
          'Night hours are drawn in ember, because that is when flat load has nowhere clean to go.',
          'A zone has demand only, so it carries its parent grid\'s generation figures.',
          has(ctx.rank) ? `Detector rank ${ctx.rank}: how much its demand looks like flat load.` : 'The detector rank says how much its demand looks like flat, around-the-clock load.',
        ),
        hint: 'The rank reads demand shape alone; no company list feeds it.',
        actions: [{ label: 'Compare with others', href: '#/screen' }],
      }
    }
    case 'found': {
      const s = route.params?.s || 'headline'
      return {
        title: 'What we found',
        lines: keep(
          FOUND[s] || FOUND.headline,
          'The card on the left is the finding; the globe is the same data, placed.',
        ),
        actions: [{ label: 'Method and limits', href: '#/method' }],
      }
    }
    default: {
      const o = ONE_LINERS[page] || ONE_LINERS.landing
      return { ...o, lines: [...o.lines] }
    }
  }
}

export function insightForRoute(hash = '', ctx = {}) {
  return insightFor(parseHash(typeof hash === 'string' ? hash : ''), ctx)
}

export const ROUTE_KINDS = ['landing', 'check', 'compare', 'region', 'found', 'explore', 'screen', 'data', 'alerts', 'companies', 'method']
