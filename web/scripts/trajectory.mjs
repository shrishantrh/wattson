// Builds src/data/trajectory.json: clean-at-night and by-day share for every region and year
// 2019..2025, from the engine's static export (public/api/region/*.json). Uses the engine's
// corrected 2019 figure where a correction exists. Run: node scripts/trajectory.mjs
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
const dir = fileURLToPath(new URL('../public/api/region/', import.meta.url))   // file names contain %2F, so no URL joins
const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025]
const out = { _note: 'Derived from the static export region files (engine, Sept 2026); corrected 2019 values used where the engine published a correction.', generated: new Date().toISOString().slice(0, 10), years: YEARS, regions: {} }
if (!existsSync(dir)) { console.error('no public/api/region; run node sync-fixtures.mjs first'); process.exit(1) }
const files = readdirSync(dir).filter(f => f.endsWith('.json'))
const byId = {}
for (const f of files) { const j = JSON.parse(readFileSync(join(dir, f), 'utf8')); const r = j.region || j; byId[r.id] = r }
const r3 = v => (v == null ? null : Math.round(v * 1000) / 1000)
for (const [id, r] of Object.entries(byId)) {
  const gen = r.type === 'zone' && !r.cf_share && byId[r.ba] ? byId[r.ba] : r
  const cf = gen.cf_share || {}
  const corr = (r.corrections?.corrections || []).find(c => c.path === 'cf_share.2019')
  const night = YEARS.map(y => (y === 2019 && corr?.corrected?.overnight != null ? corr.corrected.overnight : cf[String(y)]?.overnight ?? null)).map(r3)
  const day = YEARS.map(y => (y === 2019 && corr?.corrected?.daytime != null ? corr.corrected.daytime : cf[String(y)]?.daytime ?? null)).map(r3)
  const demand_night_mw = YEARS.map(y => r.demand?.[String(y)]?.overnight_avg_mw ?? null).map(v => (v == null ? null : Math.round(v)))
  out.regions[id] = { night, day, demand_night_mw, corrected: !!corr, flagged: (r.data_flags || []).some(x => /WACM|footprint|reporting change/i.test(String(x))) || id === 'WACM' }
}
const scored = Object.entries(out.regions).filter(([, v]) => v.night[0] != null && v.night[6] != null && !v.corrected && !v.flagged)
const med = arr => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null }
out.summary = {
  by_year: YEARS.map((y, i) => ({ year: y, median_night: r3(med(Object.values(out.regions).map(v => v.night[i]).filter(v => v != null))), n: Object.values(out.regions).filter(v => v.night[i] != null).length })),
  biggest_drop: scored.map(([id, v]) => ({ id, from: v.night[0], to: v.night[6], delta: r3(v.night[6] - v.night[0]) })).sort((a, b) => a.delta - b.delta).slice(0, 5),
  biggest_rise: scored.map(([id, v]) => ({ id, from: v.night[0], to: v.night[6], delta: r3(v.night[6] - v.night[0]) })).sort((a, b) => b.delta - a.delta).slice(0, 5),
}
writeFileSync(fileURLToPath(new URL('../src/data/trajectory.json', import.meta.url)), JSON.stringify(out))
console.log(`trajectory: ${Object.keys(out.regions).length} regions; median night by year ${out.summary.by_year.map(x => x.median_night).join(' ')}; biggest drop ${out.summary.biggest_drop[0]?.id} ${out.summary.biggest_drop[0]?.delta}; biggest rise ${out.summary.biggest_rise[0]?.id} ${out.summary.biggest_rise[0]?.delta}`)
