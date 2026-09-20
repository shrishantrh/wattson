// Pure chart builders: (inputs) => { data, layout, table: { columns, rows }, title, note, empty? }.
// No React here. Every builder reads the theme tokens at call time and tolerates a partial
// region object (missing years, nulls, null blocks); it returns { empty: true } instead of throwing.
//
// Field names match dashboard/public/data/regions.json:
//   region.cf_share[year].{overnight,daytime,all}      0-1 fractions
//   region.cf_avg_mw[year].{overnight,daytime,all}     clean MW
//   region.total_avg_mw[year].{overnight,daytime,all}  total MW
//   region.profile_24h[year][0..23]                    0-1 fractions by local hour
//   region.overnight_fuel_mw[year][fuel]               MW, fuel in FUEL_ORDER
//   region.fuel_delta_overnight_gw[fuel]               GW change 2019 -> 2025
//   region.demand[year].{avg_mw,overnight_avg_mw,peak_mw,p995_mw,load_factor,hours}
//   region.trailing12.{month[],overnight_share[],daytime_share[],overnight_clean_mw[],overnight_total_mw[]}
//   region.interchange[year].{overnight_net_export_mw,all_hours_net_export_mw}   (null for zones)
//   meta.national.{cf_share,cf_avg_mw,total_avg_mw,trailing12,note}
//   heatmap file: { ba, year, timezone, days[365], hours[24], cf_share[365][24] }

import { FUEL_COLORS, FUEL_ORDER, FUEL_PATTERN, SEQ, alpha, bars, layout, line, mix, seriesColors, thinLine, tokens } from './theme.js'
import { YEARS, fmt, pct } from '../lib/format.js'

// -- helpers --------------------------------------------------------------------
const num = x => (x == null || x === '' || Number.isNaN(Number(x)) ? null : Number(x))
const isObj = x => x != null && typeof x === 'object' && !Array.isArray(x)
const yearsWith = block => (isObj(block) ? YEARS.filter(y => isObj(block[y])) : [])
const col = (key, label, render = x => x, num = true) => ({ key, label, num, render: r => render(r[key]), raw: r => r[key] })
const EMPTY = (t = tokens(), title = '') => ({ data: [], layout: layout({}, t), table: { columns: [], rows: [] }, title, empty: true })
const safe = (fn, title) => (...args) => {
  try { return fn(...args) } catch (e) { return { ...EMPTY(tokens(), title), error: String(e?.message || e) } }
}
const shareAxis = { tickformat: '.0%', hoverformat: '.1%', rangemode: 'tozero' }
const mwAxis = { tickformat: ',.0f', hoverformat: ',.0f', rangemode: 'tozero' }
const yearAxis = { dtick: 1, type: 'category' }

// -- 24-hour carbon-free profile, one line per year (latest year = accent) ----------
function _profile24h(region, years = ['2019', '2025']) {
  const t = tokens(), p = region?.profile_24h
  const ys = years.filter(y => Array.isArray(p?.[y]) && p[y].length)
  if (!ys.length) return EMPTY(t, '24-hour carbon-free profile')
  const hours = [...Array(24).keys()]
  const grays = [t.ink2, t.muted, t.line]
  const data = ys.map((y, i) => line(y, hours, hours.map(h => num(p[y][h])), i === ys.length - 1 ? t.accent : grays[Math.min(i, grays.length - 1)], {}, t))
  return {
    data,
    layout: layout({
      yaxis: shareAxis, xaxis: { dtick: 3, title: { text: 'hour of day (local)' }, range: [-0.5, 23.5] },
      shapes: [
        { type: 'rect', xref: 'x', yref: 'paper', x0: -0.5, x1: 5.5, y0: 0, y1: 1, fillcolor: t.accentSoft, line: { width: 0 }, layer: 'below' },      // overnight window
        { type: 'rect', xref: 'x', yref: 'paper', x0: 9.5, x1: 15.5, y0: 0, y1: 1, fillcolor: alpha(t.ink2, 0.08), line: { width: 0 }, layer: 'below' }, // daytime window
      ],
      annotations: [
        { x: 2.5, y: 1.0, yref: 'paper', text: 'overnight', showarrow: false, font: { color: t.muted, size: 11 } },
        { x: 12.5, y: 1.0, yref: 'paper', text: 'daytime', showarrow: false, font: { color: t.muted, size: 11 } },
      ],
    }, t),
    table: { columns: [col('hour', 'Hour'), ...ys.map(y => col(`y${y}`, y, pct))], rows: hours.map(h => Object.fromEntries([['hour', h], ...ys.map(y => [`y${y}`, num(p[y][h])])])) },
    title: `24-hour carbon-free profile, ${ys.join(' vs ')}`, note: 'Generation-weighted share by local hour. Shaded: overnight (00-05) and daytime (10-15) windows.',
  }
}
export const profile24h = safe(_profile24h, '24-hour carbon-free profile')

// -- overnight vs daytime share by year (shared by region and national) --------------
function sharesByYear(block, t, title) {
  const ys = yearsWith(block)
  if (!ys.length) return EMPTY(t, title)
  const c = seriesColors(t), g = (y, k) => num(block[y]?.[k])
  return {
    data: [
      line('overnight', ys, ys.map(y => g(y, 'overnight')), c.overnight, {}, t),
      line('daytime', ys, ys.map(y => g(y, 'daytime')), c.daytime, {}, t),
      thinLine('all hours', ys, ys.map(y => g(y, 'all')), c.all, {}, t),
    ],
    layout: layout({ yaxis: shareAxis, xaxis: yearAxis }, t),
    table: { columns: [col('year', 'Year', x => x, false), col('overnight', 'Overnight share', pct), col('daytime', 'Daytime share', pct), col('all', 'All hours', pct)], rows: ys.map(y => ({ year: y, overnight: g(y, 'overnight'), daytime: g(y, 'daytime'), all: g(y, 'all') })) },
    title, years: ys,
  }
}
export const nightDayTrend = safe(region => ({ ...sharesByYear(region?.cf_share, tokens(), 'Overnight vs daytime carbon-free share by year'), note: 'Overnight = 00:00-05:59 local, daytime = 10:00-15:59. 2026 is Jan-Aug.' }), 'Overnight vs daytime carbon-free share by year')

export const nationalNightDay = safe(meta => {
  const t = tokens(), nat = meta?.national
  const out = sharesByYear(nat?.cf_share, t, 'National carbon-free share of generation by year')
  if (out.empty) return out
  out.table.columns.push(col('clean_night', 'Overnight clean MW', fmt), col('clean_day', 'Daytime clean MW', fmt))
  for (const r of out.table.rows) { r.clean_night = num(nat.cf_avg_mw?.[r.year]?.overnight); r.clean_day = num(nat.cf_avg_mw?.[r.year]?.daytime) }
  out.note = [nat.note, 'Overnight has not moved; daytime rises with solar.'].filter(Boolean).join(' ')
  return out
}, 'National carbon-free share of generation by year')

// -- clean MW: overnight vs daytime (absolute terms of the share question) -----------
export const nightDayCleanMW = safe(region => {
  const t = tokens(), block = region?.cf_avg_mw, ys = yearsWith(block)
  const title = 'Clean generation, overnight vs daytime (average MW)'
  if (!ys.length) return EMPTY(t, title)
  const c = seriesColors(t), g = (y, k) => num(block[y]?.[k])
  return {
    data: [line('overnight clean MW', ys, ys.map(y => g(y, 'overnight')), c.overnight, {}, t), line('daytime clean MW', ys, ys.map(y => g(y, 'daytime')), c.daytime, {}, t), thinLine('all hours clean MW', ys, ys.map(y => g(y, 'all')), c.all, {}, t)],
    layout: layout({ yaxis: mwAxis, xaxis: yearAxis }, t),
    table: { columns: [col('year', 'Year', x => x, false), col('overnight', 'Overnight clean MW', fmt), col('daytime', 'Daytime clean MW', fmt), col('all', 'All hours clean MW', fmt)], rows: ys.map(y => ({ year: y, overnight: g(y, 'overnight'), daytime: g(y, 'daytime'), all: g(y, 'all') })) },
    title, note: 'Clean = nuclear + hydro + wind + solar + geothermal.',
  }
}, 'Clean generation, overnight vs daytime (average MW)')

// -- overnight generation: clean vs total (the dashboard "cleanmw" card) -------------
export const overnightCleanVsTotal = safe(region => {
  const t = tokens(), ys = yearsWith(region?.cf_avg_mw).filter(y => isObj(region?.total_avg_mw?.[y]))
  const title = 'Overnight generation, clean vs total (average MW)'
  if (!ys.length) return EMPTY(t, title)
  const cm = y => num(region.cf_avg_mw[y]?.overnight), tm = y => num(region.total_avg_mw[y]?.overnight), sh = y => num(region.cf_share?.[y]?.overnight)
  return {
    data: [line('overnight clean MW', ys, ys.map(cm), t.accent, {}, t), thinLine('overnight total MW', ys, ys.map(tm), t.muted, {}, t)],
    layout: layout({ yaxis: mwAxis, xaxis: yearAxis }, t),
    table: { columns: [col('year', 'Year', x => x, false), col('clean', 'Clean MW', fmt), col('total', 'Total MW', fmt), col('share', 'Share', pct)], rows: ys.map(y => ({ year: y, clean: cm(y), total: tm(y), share: sh(y) })) },
    title, note: 'Clean = nuclear + hydro + wind + solar + geothermal. Flat clean line under a rising total line is the headline.',
  }
}, 'Overnight generation, clean vs total (average MW)')

// -- overnight generation by fuel, stacked ----------------------------------------
export const overnightFuelMix = safe(region => {
  const t = tokens(), fm = region?.overnight_fuel_mw, fy = yearsWith(fm)
  const title = 'Overnight generation by fuel (average MW)'
  if (!fy.length) return EMPTY(t, title)
  const colors = FUEL_COLORS(t)
  const fuels = FUEL_ORDER.filter(f => fy.some(y => (num(fm[y]?.[f]) ?? 0) > 0))
  if (!fuels.length) return EMPTY(t, title)
  const data = fuels.map(f => {
    const color = colors[f], shape = FUEL_PATTERN[f]
    const marker = { color, line: { color: t.surface, width: 2 } }
    if (shape) marker.pattern = { shape, bgcolor: color, fgcolor: mix(color, t.ink, 0.3), size: 5, solidity: 0.35 }
    return bars(f, fy, fy.map(y => num(fm[y]?.[f]) ?? 0), color, { marker }, t)
  })
  return {
    data,
    layout: layout({ barmode: 'stack', bargap: 0.35, yaxis: mwAxis, xaxis: yearAxis, legend: { traceorder: 'normal' } }, t),
    table: { columns: [col('year', 'Year', x => x, false), ...fuels.map(f => col(f, f, fmt))], rows: fy.map(y => Object.fromEntries([['year', y], ...fuels.map(f => [f, num(fm[y]?.[f])])])) },
    title, note: 'Storage excluded; other = biomass, waste, unclassified. Gas is the only colored fuel.', fuels,
  }
}, 'Overnight generation by fuel (average MW)')

// -- change in overnight generation by fuel, 2019 -> 2025 (GW) ------------------------
export const fuelDelta = safe(region => {
  const t = tokens(), d = region?.fuel_delta_overnight_gw
  const title = 'Change in overnight generation by fuel, 2019 to 2025 (GW)'
  if (!isObj(d)) return EMPTY(t, title)
  const colors = FUEL_COLORS(t)
  const fuels = FUEL_ORDER.filter(f => num(d[f]) != null)
  if (!fuels.length) return EMPTY(t, title)
  const ys = [...fuels].reverse()   // horizontal bars read top-down in FUEL_ORDER
  return {
    data: [{ type: 'bar', orientation: 'h', name: 'change', x: ys.map(f => num(d[f])), y: ys, marker: { color: ys.map(f => colors[f]), line: { color: t.surface, width: 2 } }, hovertemplate: '%{y}: %{x:+.2f} GW<extra></extra>' }],
    layout: layout({ hovermode: 'closest', showlegend: false, margin: { l: 78 }, bargap: 0.3, xaxis: { tickformat: '+.1f', zeroline: true, zerolinecolor: t.muted, title: { text: 'GW, 2019 to 2025' } }, yaxis: { type: 'category', showgrid: false } }, t),
    table: { columns: [col('fuel', 'Fuel', x => x, false), col('gw', 'Change, GW', x => (x == null ? '—' : `${x > 0 ? '+' : ''}${fmt(x, 2)}`))], rows: fuels.map(f => ({ fuel: f, gw: num(d[f]) })) },
    title, note: 'Overnight average MW, 2025 minus 2019, in GW.',
  }
}, 'Change in overnight generation by fuel, 2019 to 2025 (GW)')

// -- 365 x 24 heatmap of carbon-free share -----------------------------------------
// Color scale spans this region's 1st-99th percentile (min span 0.15) unless hm.zmin/zmax or opts.zmin/zmax say otherwise.
export function zrange(z) {
  const v = (Array.isArray(z) ? z.flat() : []).filter(x => x != null && !Number.isNaN(Number(x))).map(Number).sort((a, b) => a - b)
  if (!v.length) return [0, 1]
  let lo = v[Math.floor(v.length * 0.01)], hi = v[Math.min(v.length - 1, Math.floor(v.length * 0.99))]
  if (hi - lo < 0.15) { const m = (hi + lo) / 2; lo = m - 0.075; hi = m + 0.075 }
  return [Math.max(0, lo), Math.min(1, hi)]
}
export const heatmap = safe((hm, { zmin, zmax } = {}) => {
  const t = tokens()
  const title = `Carbon-free share, every hour of ${hm?.year ?? 2025}`
  if (!hm || !Array.isArray(hm.cf_share) || !hm.cf_share.length) return EMPTY(t, title)
  const z = hm.cf_share
  const hours = Array.isArray(hm.hours) && hm.hours.length ? hm.hours : [...Array(z[0]?.length ?? 24).keys()]
  const days = Array.isArray(hm.days) && hm.days.length ? hm.days : z.map((_, i) => i + 1)
  const dateY = typeof days[0] === 'string'
  const [lo, hi] = zrange(z)
  const z0 = num(hm.zmin) ?? num(zmin) ?? lo, z1 = num(hm.zmax) ?? num(zmax) ?? hi
  return {
    data: [{
      type: 'heatmap', z, x: hours, y: days, colorscale: SEQ(t), zmin: z0, zmax: z1, hoverongaps: false, xgap: 0, ygap: 0,
      colorbar: { thickness: 8, len: 0.9, outlinewidth: 0, tickformat: '.0%', ticks: 'outside', tickcolor: t.line, ticklen: 3, tickfont: { family: t.fontMono, color: t.muted, size: 10 } },
      hovertemplate: (dateY ? '%{y|%b %d}' : 'day %{y}') + ' %{x}:00<br>carbon-free %{z:.0%}<extra></extra>',
    }],
    layout: layout({
      hovermode: 'closest', margin: { t: 8, r: 8, l: 48, b: 36 },
      xaxis: { title: { text: 'hour of day (local)' }, dtick: 2, showgrid: false, zeroline: false },
      yaxis: dateY ? { type: 'date', autorange: 'reversed', tickformat: '%b', showgrid: false, zeroline: false } : { autorange: 'reversed', showgrid: false, zeroline: false, title: { text: 'day of year' } },
    }, t),
    table: {
      columns: [col('day', 'Day', x => x, false), ...hours.map(h => col(`h${h}`, `${h}:00`, x => (x == null ? '—' : Number(x).toFixed(2))))],
      rows: days.map((day, i) => Object.fromEntries([['day', day], ...hours.map((h, j) => [`h${h}`, num(z[i]?.[j])])])),
    },
    title, note: `${days.length} days x ${hours.length} hours, local time (${hm.timezone || 'local'}). Dark = more fossil, light to accent = more carbon-free. Scale spans ${pct(z0, 0)}-${pct(z1, 0)}.`,
    zmin: z0, zmax: z1,
  }
}, 'Carbon-free share, every hour')

// -- demand by year ------------------------------------------------------------------
export const demandByYear = safe(region => {
  const t = tokens(), dy = yearsWith(region?.demand)
  const title = 'Demand by year (average MW)'
  if (!dy.length) return EMPTY(t, title)
  const c = seriesColors(t), g = (y, k) => num(region.demand[y]?.[k])
  return {
    data: [
      line('overnight average', dy, dy.map(y => g(y, 'overnight_avg_mw')), c.overnight, {}, t),
      thinLine('average', dy, dy.map(y => g(y, 'avg_mw')), c.all, {}, t),
      line('p99.5 hour (peak)', dy, dy.map(y => g(y, 'p995_mw')), c.daytime, { line: { color: c.daytime, width: 2, dash: 'dot' } }, t),
    ],
    layout: layout({ yaxis: mwAxis, xaxis: yearAxis }, t),
    table: {
      columns: [col('year', 'Year', x => x, false), col('avg_mw', 'Average MW', fmt), col('overnight_avg_mw', 'Overnight MW', fmt), col('p995_mw', 'p99.5 MW', fmt), col('peak_mw', 'Max hour MW', fmt), col('load_factor', 'Load factor', x => fmt(x, 3)), col('hours', 'Hours', fmt)],
      rows: dy.map(y => ({ year: y, avg_mw: g(y, 'avg_mw'), overnight_avg_mw: g(y, 'overnight_avg_mw'), p995_mw: g(y, 'p995_mw'), peak_mw: g(y, 'peak_mw'), load_factor: g(y, 'load_factor'), hours: g(y, 'hours') })),
    },
    title, note: 'Average, overnight average, and the 99.5th percentile hour used as peak. Overnight growing faster than average is the flat-load discriminator.',
  }
}, 'Demand by year (average MW)')

export const loadFactor = safe(region => {
  const t = tokens(), dy = yearsWith(region?.demand).filter(y => num(region.demand[y]?.load_factor) != null)
  const title = 'Load factor (mean / p99.5 demand)'
  if (!dy.length) return EMPTY(t, title)
  return {
    data: [line('load factor', dy, dy.map(y => num(region.demand[y].load_factor)), t.accent, {}, t)],
    layout: layout({ showlegend: false, yaxis: { tickformat: '.2f', hoverformat: '.3f' }, xaxis: yearAxis }, t),
    table: { columns: [col('year', 'Year', x => x, false), col('load_factor', 'Load factor', x => fmt(x, 3))], rows: dy.map(y => ({ year: y, load_factor: num(region.demand[y].load_factor) })) },
    title, note: 'Rises where flat load arrives. Supporting evidence only.',
  }
}, 'Load factor (mean / p99.5 demand)')

// Demand chart plus its load-factor companion (two axes of different scale, so two charts).
export const demandLoadFactor = region => ({ ...demandByYear(region), loadFactor: loadFactor(region) })

// -- trailing-12-month share ---------------------------------------------------------
export const trailing12 = safe(region => {
  const t = tokens(), tr = region?.trailing12
  const title = 'Trailing-12-month carbon-free share'
  if (!tr || !Array.isArray(tr.month) || !tr.month.length) return EMPTY(t, title)
  const c = seriesColors(t)
  const x = tr.month.map(m => `${m}-01`)
  const base2019 = num(region?.cf_share?.['2019']?.overnight)
  const nomark = { mode: 'lines', marker: undefined }
  return {
    data: [line('overnight', x, tr.overnight_share, c.overnight, nomark, t), line('daytime', x, tr.daytime_share, c.daytime, nomark, t)],
    layout: layout({
      yaxis: shareAxis, xaxis: { type: 'date', tickformat: '%Y', hoverformat: '%b %Y' },
      shapes: base2019 == null ? [] : [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: base2019, y1: base2019, line: { color: t.muted, width: 1, dash: 'dot' } }],
      annotations: base2019 == null ? [] : [{ xref: 'paper', x: 1, y: base2019, text: '2019 overnight', showarrow: false, xanchor: 'right', yanchor: 'bottom', font: { color: t.muted, size: 10 } }],
    }, t),
    table: {
      columns: [col('month', 'Window end', x => x, false), col('o', 'Overnight share', pct), col('d', 'Daytime share', pct), col('cmw', 'Overnight clean MW', fmt), col('tmw', 'Overnight total MW', fmt)],
      rows: tr.month.map((m, i) => ({ month: m, o: num(tr.overnight_share?.[i]), d: num(tr.daytime_share?.[i]), cmw: num(tr.overnight_clean_mw?.[i]), tmw: num(tr.overnight_total_mw?.[i]) })),
    },
    title, note: 'Window ending each month; partial months dropped. Dotted line = 2019 overnight share.',
  }
}, 'Trailing-12-month carbon-free share')

// -- net interchange by year (BAs only; zones carry interchange: null) ----------------
export const interchange = safe(region => {
  const t = tokens(), ix = region?.interchange, iy = yearsWith(ix)
  const title = 'Net interchange by year (average MW)'
  if (!iy.length) return EMPTY(t, title)
  const c = seriesColors(t), g = (y, k) => num(ix[y]?.[k])
  return {
    data: [bars('overnight net export', iy, iy.map(y => g(y, 'overnight_net_export_mw')), c.overnight, {}, t), bars('all hours net export', iy, iy.map(y => g(y, 'all_hours_net_export_mw')), c.all, {}, t)],
    layout: layout({ barmode: 'group', bargap: 0.3, yaxis: { tickformat: ',.0f', hoverformat: ',.0f', zeroline: true, zerolinecolor: t.muted }, xaxis: yearAxis }, t),
    table: { columns: [col('year', 'Year', x => x, false), col('o', 'Overnight net export MW', fmt), col('a', 'All hours net export MW', fmt)], rows: iy.map(y => ({ year: y, o: g(y, 'overnight_net_export_mw'), a: g(y, 'all_hours_net_export_mw') })) },
    title, note: 'Positive = export from this BA. EIA-adjusted net, operations table.',
  }
}, 'Net interchange by year (average MW)')

// -- talk vs walk, one point per company -----------------------------------------------
export const talkVsWalk = safe(companies => {
  const t = tokens()
  const title = 'Talk vs Walk'
  const list = Array.isArray(companies) ? companies : Array.isArray(companies?.companies) ? companies.companies : []
  const ws = list.filter(c => num(c?.talk_score) != null && num(c?.walk_score) != null)
  if (!ws.length) return EMPTY(t, title)
  return {
    data: [{
      type: 'scatter', mode: 'markers+text', name: 'companies',
      x: ws.map(c => num(c.walk_score)), y: ws.map(c => num(c.talk_score)), text: ws.map(c => c.ticker || c.company || ''),
      textposition: 'top center', textfont: { family: t.fontMono, color: t.ink2, size: 11 },
      marker: { color: t.accent, size: 10, line: { color: t.surface, width: 2 } },
      customdata: ws.map(c => c.company || ''), hovertemplate: '%{customdata}<br>walk %{x:.2f} · talk %{y:.2f}<extra></extra>',
    }],
    layout: layout({
      hovermode: 'closest', showlegend: false,
      xaxis: { title: { text: 'walk: physical carbon-free share of the grids its sites use (grid-only)' }, range: [0, 1.05], tickformat: '.1f' },
      yaxis: { title: { text: 'talk: boldness and specificity of the language' }, range: [0, 1.05], tickformat: '.1f' },
      shapes: [{ type: 'line', x0: 0, y0: 0, x1: 1, y1: 1, line: { color: t.line, width: 1, dash: 'dot' } }],
      annotations: [{ x: 0.12, y: 0.97, text: 'language ahead of physics', showarrow: false, xanchor: 'left', font: { color: t.muted, size: 10 } }],
    }, t),
    table: {
      columns: [col('company', 'Company', x => x, false), col('ticker', 'Ticker', x => x || '—', false), col('walk_score', 'Walk', x => fmt(x, 2)), col('talk_score', 'Talk', x => fmt(x, 2)), col('coverage', 'Coverage', x => pct(x, 0)), col('unverifiable_share', 'Unverifiable', x => pct(x, 0))],
      rows: ws.map(c => ({ company: c.company, ticker: c.ticker, walk_score: num(c.walk_score), talk_score: num(c.talk_score), coverage: num(c.coverage), unverifiable_share: num(c.unverifiable_share) })),
    },
    title, note: 'One point per company. Above the dotted line: language ahead of physics. Grid-only, excludes PPAs.',
  }
}, 'Talk vs Walk')

// Everything a region page needs, in one call. Each key is a builder result; check `.empty` before rendering.
export function regionCharts(region, hm) {
  return {
    profile: profile24h(region), shares: nightDayTrend(region), cleanmw: overnightCleanVsTotal(region), cleanNightDay: nightDayCleanMW(region),
    fuel: overnightFuelMix(region), fuelDelta: fuelDelta(region), demand: demandByYear(region), lf: loadFactor(region), t12: trailing12(region), ix: interchange(region),
    heatmap: hm ? heatmap(hm) : null,
  }
}

// -- national day/night CF share + mean satellite irradiance (dual axis) ------------
function _irradianceDayNight(meta, irradianceDoc) {
  const t = tokens(), nat = meta?.national?.cf_share, regions = irradianceDoc?.regions || []
  const title = 'Why the day got clean and the night didn\'t'
  if (!isObj(nat) || !regions.length) return EMPTY(t, title)
  // Prefer the national series years that also appear in the irradiance annual means.
  const irrYears = regions[0]?.irradiance?.years || []
  const ys = (irrYears.length ? irrYears : YEARS).filter(y => isObj(nat[y]))
  if (!ys.length) return EMPTY(t, title)
  const meanIrr = y => {
    const vals = regions.map(r => num(r.irradiance?.annual_mean?.[y])).filter(v => v != null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }
  const c = seriesColors(t)
  const irrColor = mix(t.ink2, t.muted, 0.4)
  const data = [
    line('daytime clean share', ys, ys.map(y => num(nat[y]?.daytime)), c.daytime, {}, t),
    line('overnight clean share', ys, ys.map(y => num(nat[y]?.overnight)), c.overnight, {}, t),
    line('mean satellite irradiance', ys, ys.map(meanIrr), irrColor, { yaxis: 'y2', line: { color: irrColor, width: 2, dash: 'dot' }, marker: { color: irrColor, size: 7, line: { color: t.surface, width: 2 } } }, t),
  ]
  const irrVals = ys.map(meanIrr).filter(v => v != null)
  const irrMin = irrVals.length ? Math.min(...irrVals) : 0
  const irrMax = irrVals.length ? Math.max(...irrVals) : 1
  const pad = Math.max(0.15, (irrMax - irrMin) * 2) || 0.5
  return {
    data,
    layout: layout({
      yaxis: { ...shareAxis, title: { text: 'carbon-free share' } },
      yaxis2: {
        title: { text: irradianceDoc.units || 'kWh/m²/day' },
        overlaying: 'y', side: 'right', showgrid: false,
        tickfont: { family: t.fontMono, color: t.muted, size: 11 },
        titlefont: { family: t.fontUI, color: t.muted, size: 11 },
        range: [irrMin - pad, irrMax + pad],
      },
      xaxis: yearAxis,
      margin: { t: 28, r: 56, l: 56, b: 40 },
    }, t),
    table: {
      columns: [
        col('year', 'Year', x => x, false),
        col('daytime', 'Daytime share', pct),
        col('overnight', 'Overnight share', pct),
        col('irradiance', 'Mean irradiance', v => (v == null ? '—' : Number(v).toFixed(3))),
      ],
      rows: ys.map(y => ({ year: y, daytime: num(nat[y]?.daytime), overnight: num(nat[y]?.overnight), irradiance: meanIrr(y) })),
    },
    title,
    note: 'The dotted line is the sun. It never moves. The two solid lines are the same country over the same years: one climbs, one does not.',
  }
}
export const irradianceDayNight = safe(_irradianceDayNight, 'Why the day got clean and the night didn\'t')

