#!/usr/bin/env node
// Data smoke test for the Wattson web app. Node ESM, stdlib only, no app imports.
//
//   node web/test/smoke.mjs [repoRoot]
//
// Prints one line per check ("ok" / "FAIL" / "warn" / "skip") and exits 1 if any check
// FAILs. It checks the provisional fixtures the UI reads today against the README's
// headline numbers, the pipeline export (dashboard/public/data/regions.json, when
// present) and the hand-mapped lookups in web/src/data. If Yash's contract fixtures
// exist at <repoRoot>/fixtures/*.json they are checked too, with shape-appropriate
// assertions; when that folder is absent those checks are skipped, not failed.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..', '..'))
const P = {
  provisional: join(ROOT, 'web', 'fixtures.provisional'),
  contract: join(ROOT, 'fixtures'),
  regions: join(ROOT, 'dashboard', 'public', 'data', 'regions.json'),
  coords: join(ROOT, 'web', 'src', 'data', 'region_coords.json'),
  metros: join(ROOT, 'web', 'src', 'data', 'metros.json'),
  caveats: join(ROOT, 'web', 'src', 'data', 'data_caveats.json'),
}

// README headline table (README.md L15-21) and the validation ranks (L86). Frozen.
const README = {
  overnight_clean_mw: { 2019: 35700, 2025: 35619 },
  overnight_total_mw: { 2019: 82539, 2025: 91240 },
  overnight_cf_share: { 2019: 0.433, 2025: 0.390 },
  overnight_net_export_mw: { 2019: 3814, 2025: 2489 },
  dom_overnight_demand_mw: { 2019: 10060, 2025: 14033 },
}
const VALIDATION = { 'PJM/DOM': 6, 'PJM/AEP': 19, 'SWPP/OPPD': 7, 'ERCO/NCEN': 91 }
const N_SCORED = 111
const DEMO_SITES = { 'Phoenix, AZ': 'AZPS', 'Northern Virginia': 'PJM/DOM', 'Omaha, NE': 'SWPP/OPPD' }
const VERDICTS = new Set(['true_on_paper', 'contradicted', 'unfalsifiable', 'cannot_verify'])

// ---------------------------------------------------------------- harness
let fails = 0, warns = 0
const line = (tag, name, detail) => console.log(`${tag.padEnd(4)} ${name}${detail ? `: ${detail}` : ''}`)
const ok = (name, detail) => line('ok', name, detail)
const fail = (name, detail) => { fails++; line('FAIL', name, detail) }
const warn = (name, detail) => { warns++; line('warn', name, detail) }
const skip = (name, detail) => line('skip', name, detail)
const check = (name, cond, detail) => (cond ? ok(name, detail) : fail(name, detail))
const near = (a, b, eps = 1e-9) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= eps
const contiguous = (ranks, n) => { const s = [...ranks].sort((a, b) => a - b); return s.length === n && s.every((r, i) => r === i + 1) }
const loadJSON = (name, path) => { try { return JSON.parse(readFileSync(path, 'utf8')) } catch (e) { fail(`${name} parses`, `${path}: ${e.message}`); return null } }
const eqDeep = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ---------------------------------------------------------------- lookups
const coordsDoc = loadJSON('region_coords.json', P.coords)
const coords = coordsDoc?.regions || {}
const inCoords = id => Object.prototype.hasOwnProperty.call(coords, id)
check('region_coords.json has regions', Object.keys(coords).length > 0, `${Object.keys(coords).length} ids`)

const metrosDoc = loadJSON('metros.json', P.metros)
const metros = metrosDoc?.metros || []
{
  const missing = metros.filter(m => !inCoords(m.region_id)).map(m => `${m.metro}→${m.region_id}`)
  check('metros: every region_id exists in region_coords', missing.length === 0, missing.length ? missing.join(', ') : `${metros.length} metros`)
  const upper = metros.flatMap(m => (m.aliases || []).filter(a => a !== a.toLowerCase()).map(a => `${m.metro}:"${a}"`))
  check('metros: aliases are lowercase', upper.length === 0, upper.join(', ') || undefined)
  const owners = new Map()
  for (const m of metros) for (const a of m.aliases || []) { if (!owners.has(a)) owners.set(a, []); owners.get(a).push(m) }
  const dupes = [...owners].filter(([, ms]) => ms.length > 1)
  const crossRegion = dupes.filter(([, ms]) => new Set(ms.map(m => m.region_id)).size > 1)
  const sameRegion = dupes.filter(([, ms]) => new Set(ms.map(m => m.region_id)).size === 1)
  check('metros: aliases unique across metros (different regions)', crossRegion.length === 0,
    crossRegion.length ? crossRegion.map(([a, ms]) => `"${a}" → ${ms.map(m => `${m.metro} (${m.region_id})`).join(' and ')}; matchMetro takes the first, so input routes to the wrong grid`).join('; ') : undefined)
  if (sameRegion.length) warn('metros: duplicate aliases within one region', sameRegion.map(([a, ms]) => `"${a}" → ${ms.map(m => m.metro).join(' and ')}`).join('; '))
  else ok('metros: no duplicate aliases within one region')
}

const caveats = loadJSON('data_caveats.json', P.caveats)
if (caveats) {
  const keys = Object.keys(caveats).filter(k => !k.startsWith('_'))
  const missing = keys.filter(k => !inCoords(k))
  check('data_caveats: keys exist in region_coords', missing.length === 0, missing.length ? missing.join(', ') : keys.join(', '))
}

// ---------------------------------------------------------------- pipeline export (optional cross-check)
const regionsExport = existsSync(P.regions) ? loadJSON('dashboard regions.json', P.regions) : null
const byId = regionsExport ? Object.fromEntries((regionsExport.regions || []).map(r => [r.id, r])) : null
if (!regionsExport) skip('pipeline export cross-checks', `${P.regions} not found`)

// ---------------------------------------------------------------- provisional fixtures
const prov = {}
for (const name of ['opening', 'region', 'site', 'company']) {
  const path = join(P.provisional, `${name}.json`)
  if (!existsSync(path)) { fail(`provisional ${name}.json exists`, path); continue }
  const doc = loadJSON(`provisional ${name}.json`, path)
  if (!doc) continue
  prov[name] = doc
  check(`provisional ${name}.json parses and has _provisional: true`, doc._provisional === true, doc._provisional === true ? undefined : `_provisional = ${JSON.stringify(doc._provisional)}`)
}

// opening.pjm vs README
if (prov.opening) {
  const pjm = prov.opening.pjm || {}
  for (const [field, years] of Object.entries(README)) {
    for (const [y, want] of Object.entries(years)) {
      const got = pjm[field]?.[y]
      check(`opening.pjm.${field}[${y}] == README ${want}`, near(Number(got), want, 1e-9), `fixture ${got}`)
    }
  }
  // Internal closure: share = clean / total; fuel deltas sum to the total change; fuel mix sums to the clean and total figures.
  for (const y of ['2019', '2025']) {
    const clean = pjm.overnight_clean_mw?.[y], tot = pjm.overnight_total_mw?.[y], share = pjm.overnight_cf_share?.[y]
    check(`opening.pjm share[${y}] == clean/total`, near(clean / tot, share, 0.0006), `${clean}/${tot} = ${(clean / tot).toFixed(4)} vs ${share}`)
    const mix = pjm.overnight_fuel_mw?.[y]
    if (mix) {
      const cleanSum = ['nuclear', 'hydro', 'wind', 'solar', 'geothermal'].reduce((a, k) => a + (mix[k] || 0), 0)
      const totSum = Object.values(mix).reduce((a, v) => a + (v || 0), 0)
      check(`opening.pjm overnight_fuel_mw[${y}] clean fuels sum to overnight_clean_mw`, near(cleanSum, clean, 1.5), `${cleanSum} vs ${clean}`)
      check(`opening.pjm overnight_fuel_mw[${y}] all fuels sum to overnight_total_mw`, near(totSum, tot, 1.5), `${totSum} vs ${tot}`)
    }
  }
  const fd = pjm.fuel_delta_overnight_gw || {}
  const fdSum = Object.values(fd).reduce((a, v) => a + (v || 0), 0)
  const totDelta = (pjm.overnight_total_mw?.['2025'] - pjm.overnight_total_mw?.['2019']) / 1000
  check('opening.pjm fuel_delta_overnight_gw sums to the overnight total change', near(fdSum, totDelta, 0.05), `${fdSum.toFixed(2)} vs ${totDelta.toFixed(2)} GW`)
  check('opening.pjm.overnight_net_export_mw sign convention stated', pjm.overnight_net_export_mw?.sign === 'positive = export', JSON.stringify(pjm.overnight_net_export_mw?.sign))

  // detector
  const det = prov.opening.detector || {}
  const rows = det.regions || []
  check(`opening.detector.n_scored == ${N_SCORED}`, det.n_scored === N_SCORED, `${det.n_scored}`)
  check(`opening.detector.regions has ${N_SCORED} rows`, rows.length === N_SCORED, `${rows.length}`)
  check('opening.detector ranks are 1..111 contiguous', contiguous(rows.map(r => r.rank), N_SCORED))
  for (const [id, rank] of Object.entries(VALIDATION)) {
    const r = rows.find(x => x.id === id)
    check(`opening.detector validation ${id} rank ${rank}`, r && r.rank === rank && r.validation === true, r ? `rank ${r.rank}, validation ${r.validation}` : 'missing')
  }
  check('opening.detector.validation_named_in_advance lists the four ids', eqDeep([...(det.validation_named_in_advance || [])].sort(), Object.keys(VALIDATION).sort()), JSON.stringify(det.validation_named_in_advance))
  const noCoords = rows.filter(r => !inCoords(r.id)).map(r => r.id)
  check('opening.detector: every region id exists in region_coords', noCoords.length === 0, noCoords.join(', ') || undefined)
  const badPattern = rows.filter(r => !['flat-load growth', 'possible midday solar suppression', 'mixed'].includes(r.pattern)).map(r => `${r.id}:${r.pattern}`)
  check('opening.detector: pattern labels are the three frozen labels', badPattern.length === 0, badPattern.join(', ') || undefined)
  const leadsNotFlat = (det.new_leads || []).filter(id => rows.find(r => r.id === id)?.pattern !== 'flat-load growth')
  if (leadsNotFlat.length) warn('opening.detector.new_leads includes non-flat-load patterns', `${leadsNotFlat.join(', ')} (README names 5 leads; fixture has ${(det.new_leads || []).length})`)
  else ok('opening.detector.new_leads are all flat-load growth')

  // national
  const nat = prov.opening.national?.cf_share || {}
  check('opening.national.cf_share has 2019 and 2025 day/night', ['2019', '2025'].every(y => typeof nat[y]?.daytime === 'number' && typeof nat[y]?.overnight === 'number'))

  if (byId) {
    const p = byId.PJM, d = byId['PJM/DOM']
    const pairs = [
      ['overnight_clean_mw', y => p?.cf_avg_mw?.[y]?.overnight], ['overnight_total_mw', y => p?.total_avg_mw?.[y]?.overnight],
      ['overnight_cf_share', y => p?.cf_share?.[y]?.overnight], ['overnight_net_export_mw', y => p?.interchange?.[y]?.overnight_net_export_mw],
      ['dom_overnight_demand_mw', y => d?.demand?.[y]?.overnight_avg_mw], ['dom_avg_demand_mw', y => d?.demand?.[y]?.avg_mw],
    ]
    const bad = pairs.flatMap(([k, get]) => ['2019', '2025'].filter(y => !near(Number(pjm[k]?.[y]), Number(get(y)))).map(y => `${k}[${y}] ${pjm[k]?.[y]} vs ${get(y)}`))
    check('opening.pjm equals dashboard regions.json PJM / PJM/DOM', bad.length === 0, bad.join('; ') || '12 fields')
    check('opening.pjm.fuel_delta_overnight_gw equals regions.json', eqDeep(fd, p?.fuel_delta_overnight_gw))
    check('opening.national equals regions.json meta.national', eqDeep(prov.opening.national?.cf_share, regionsExport.meta?.national?.cf_share) && eqDeep(prov.opening.national?.cf_avg_mw, regionsExport.meta?.national?.cf_avg_mw))
    const detBad = rows.filter(r => { const e = byId[r.id]?.detection; return !e || e.rank !== r.rank || !near(e.score, r.score) || e.pattern !== r.pattern || !near(e.growth_pct, r.growth_pct) }).map(r => r.id)
    check('opening.detector rows equal regions.json detection', detBad.length === 0, detBad.join(', ') || `${rows.length} rows`)
  }
}

// region.json
if (prov.region) {
  const regs = prov.region.regions || {}
  const ids = Object.keys(regs)
  check('region.json has regions', ids.length > 0, `${ids.length}: ${ids.join(', ')}`)
  const noCoords = ids.filter(id => !inCoords(id))
  check('region.json: every region id exists in region_coords', noCoords.length === 0, noCoords.join(', ') || undefined)
  const dom = regs['PJM/DOM']
  check('region.json PJM/DOM is a zone that inherits PJM generation', dom && dom.type === 'zone' && dom.cf_inherited_from_ba === true && dom.parent?.id === 'PJM')
  check('region.json PJM/DOM overnight demand 10060 -> 14033', near(dom?.demand?.['2019']?.overnight_avg_mw, 10060) && near(dom?.demand?.['2025']?.overnight_avg_mw, 14033), `${dom?.demand?.['2019']?.overnight_avg_mw} -> ${dom?.demand?.['2025']?.overnight_avg_mw}`)
  check('region.json PJM/DOM cf_share equals its parent PJM (inherited)', dom && eqDeep(dom.cf_share, dom.parent?.cf_share))
  const badProfile = ids.filter(id => { const g = regs[id].type === 'zone' && regs[id].parent ? regs[id].parent : regs[id]; const pr = g.profile_24h?.['2025']; return !Array.isArray(pr) || pr.length !== 24 })
  check('region.json: 24-hour profiles have 24 values', badProfile.length === 0, badProfile.join(', ') || undefined)
  const badHeat = ids.filter(id => { const h = regs[id].heatmap?.cf_share; return !Array.isArray(h) || h.length !== 365 || h.some(row => !Array.isArray(row) || row.length !== 24) })
  if (badHeat.length) warn('region.json: heatmaps are 365 x 24', badHeat.join(', '))
  else ok('region.json: heatmaps are 365 x 24')
  if (byId) {
    const bad = ids.filter(id => { const e = byId[id]; return !e || !eqDeep(regs[id].demand, e.demand) || !eqDeep(regs[id].detection, e.detection) || !eqDeep(regs[id].siting, e.siting) })
    check('region.json demand/detection/siting equal regions.json', bad.length === 0, bad.join(', ') || `${ids.length} regions`)
  }
}

// site.json
if (prov.site) {
  const s = prov.site, res = s.results || []
  check('site.json request is 300 MW flat 24/7', s.request?.mw === 300 && s.request?.flat_24_7 === true, JSON.stringify(s.request))
  check('site.json has a hand-mapped metro index', s.metro_index?.hand_mapped === true && Array.isArray(s.metro_index?.metros) && s.metro_index.metros.length > 0)
  const scores = res.map(r => r.siting?.siting_score)
  check('site.json results sorted by siting_score descending', scores.every((v, i) => i === 0 || v <= scores[i - 1]), scores.join(' > '))
  check('site.json result ranks are 1..n contiguous', contiguous(res.map(r => r.rank), res.length))
  const got = Object.fromEntries(res.map(r => [r.metro, r.region_id]))
  const badDemo = Object.entries(DEMO_SITES).filter(([m, id]) => got[m] !== id).map(([m, id]) => `${m}: ${got[m] ?? 'missing'} (want ${id})`)
  check('site.json demo candidates map to SWPP/OPPD, PJM/DOM, AZPS', badDemo.length === 0, badDemo.join('; ') || Object.entries(got).map(([m, id]) => `${m}→${id}`).join(', '))
  check('site.json request.candidates all appear in results', (s.request?.candidates || []).every(c => got[c]), (s.request?.candidates || []).join(', '))
  const noCoords = res.filter(r => !inCoords(r.region_id)).map(r => r.region_id)
  check('site.json: every result region_id exists in region_coords', noCoords.length === 0, noCoords.join(', ') || undefined)
  const badFrom = res.filter(r => r.siting_from !== (r.region_id.includes('/') ? r.region_id.split('/')[0] : r.region_id)).map(r => `${r.region_id}: ${r.siting_from}`)
  check('site.json zones take siting from their parent BA', badFrom.length === 0, badFrom.join(', ') || res.map(r => `${r.region_id}←${r.siting_from}`).join(', '))
  const badShare = res.filter(r => { const v = r.siting?.overnight_cf_share_2025; return typeof v !== 'number' || v < 0 || v > 1 }).map(r => r.region_id)
  check('site.json shares are 0-1 fractions', badShare.length === 0, badShare.join(', ') || undefined)
  if (byId) {
    const bad = res.filter(r => !eqDeep(r.siting, byId[r.siting_from]?.siting) || !eqDeep(r.demand, byId[r.region_id]?.demand?.['2025'])).map(r => r.region_id)
    check('site.json siting and 2025 demand equal regions.json', bad.length === 0, bad.join(', ') || `${res.length} results`)
  }
}

// company.json
if (prov.company) {
  const meta = prov.company.companies?.META
  check('company.json has META', !!meta, meta ? `${meta.company}, _mock=${meta._mock}` : 'missing')
  if (meta) {
    const sites = meta.sites || [], claims = meta.claims || []
    check('company.json META has 4 sites', sites.length === 4, `${sites.length}`)
    const noCoords = sites.filter(x => !inCoords(x.region_id)).map(x => `${x.metro}→${x.region_id}`)
    check('company.json META: every site region_id exists in region_coords', noCoords.length === 0, noCoords.join(', ') || sites.map(x => x.region_id).join(', '))
    const noLatLng = sites.filter(x => typeof x.lat !== 'number' || typeof x.lng !== 'number').map(x => x.metro)
    check('company.json META: sites have lat/lng', noLatLng.length === 0, noLatLng.join(', ') || undefined)
    check('company.json META has 3 claims', claims.length === 3, `${claims.length}`)
    const badV = claims.filter(k => !VERDICTS.has(k.verdict)).map(k => `${k.claim_id}:${k.verdict}`)
    check('company.json META: verdicts in the allowed set', badV.length === 0, badV.join(', ') || claims.map(k => k.verdict).join(', '))
    const cv = claims.filter(k => k.verdict === 'cannot_verify').length
    check('company.json META: cannot_verify_count matches claims', meta.cannot_verify_count === cv, `${meta.cannot_verify_count} vs ${cv}`)
    const primary = claims.find(k => k.physical_min != null)
    if (primary) {
      const grid = (primary.evidence || []).filter(e => e.type === 'grid').map(e => e.cf_share)
      const mn = Math.min(...grid), mx = Math.max(...grid), mean = grid.reduce((a, b) => a + b, 0) / grid.length
      check('company.json META: physical_min/max/mean recompute from grid evidence', near(primary.physical_min, mn, 1e-9) && near(primary.physical_max, mx, 1e-9) && near(primary.physical_mean_unweighted, mean, 0.0006), `${mn} / ${mx} / ${mean.toFixed(3)} vs ${primary.physical_min} / ${primary.physical_max} / ${primary.physical_mean_unweighted}`)
      check('company.json META: walk_score equals the unweighted site mean', near(meta.walk_score, mean, 0.0006), `${meta.walk_score} vs ${mean.toFixed(4)}`)
      const badShare = grid.filter(v => typeof v !== 'number' || v < 0 || v > 1)
      check('company.json META: evidence shares are 0-1 fractions', badShare.length === 0)
      const evBAs = new Set((primary.evidence || []).filter(e => e.type === 'grid').map(e => e.ba))
      check('company.json META: every site has grid evidence', sites.every(x => evBAs.has(x.ba)), sites.filter(x => !evBAs.has(x.ba)).map(x => x.ba).join(', ') || undefined)
      if (byId) {
        const bad = (primary.evidence || []).filter(e => e.type === 'grid').filter(e => { const cf = byId[e.ba]?.cf_share?.[String(e.year)]; return !cf || !near(cf.all, e.cf_share) || (e.overnight_cf_share != null && !near(cf.overnight, e.overnight_cf_share)) }).map(e => e.ba)
        check('company.json META grid evidence equals regions.json cf_share', bad.length === 0, bad.join(', ') || `${evBAs.size} BAs, year ${primary.year}`)
        const thin = [...evBAs].filter(ba => { const r = byId[ba]; const g = r?.total_avg_mw?.[String(primary.year)]?.all, d = r?.demand?.[String(primary.year)]?.avg_mw; return g && d && g / d < 0.5 }).map(ba => `${ba} generates ${byId[ba].total_avg_mw[String(primary.year)].all} MW vs ${byId[ba].demand[String(primary.year)].avg_mw} MW demand`)
        if (thin.length) warn('company.json META: a site BA generates under half its own demand (footprint share is not consumption share)', thin.join('; '))
        else ok('company.json META: site BAs generate at least half their own demand')
      }
    } else fail('company.json META: a claim with physical_min exists')
  }
}

// ---------------------------------------------------------------- Yash's contract fixtures (optional)
if (!existsSync(P.contract)) skip("contract fixtures (Yash's fixtures/*.json)", `${P.contract} absent`)
else {
  const files = readdirSync(P.contract).filter(f => f.endsWith('.json'))
  if (!files.length) skip("contract fixtures (Yash's fixtures/*.json)", 'folder present but empty')
  for (const f of files) {
    const doc = loadJSON(`contract ${f}`, join(P.contract, f))
    if (!doc) continue
    ok(`contract ${f} parses`)
    if (f === 'regions.json') {
      const regs = doc.regions || []
      check('contract regions.json has {meta, count, regions}', doc.meta && typeof doc.count === 'number' && Array.isArray(doc.regions))
      check(`contract regions.json count == ${N_SCORED}`, doc.count === N_SCORED, `${doc.count}`)
      check('contract regions.json regions.length == count', regs.length === doc.count, `${regs.length}`)
      const ranks = regs.map(r => r.detection?.rank ?? r.rank).filter(r => r != null)
      check('contract regions.json ranks are 1..count contiguous', contiguous(ranks, regs.length))
      const noCoords = regs.filter(r => !inCoords(r.id)).map(r => r.id)
      check('contract regions.json: every id exists in region_coords', noCoords.length === 0, noCoords.join(', ') || undefined)
      for (const [id, rank] of Object.entries(VALIDATION)) { const r = regs.find(x => x.id === id); check(`contract regions.json validation ${id} rank ${rank}`, r && (r.detection?.rank ?? r.rank) === rank, r ? `${r.detection?.rank ?? r.rank}` : 'missing') }
    } else if (f === 'region.json') {
      const r = doc.region
      check('contract region.json has {meta, region}', doc.meta && r && typeof r.id === 'string')
      check('contract region.json region.id exists in region_coords', r && inCoords(r.id), r?.id)
      check('contract region.json has demand for 2019 and 2025', r?.demand?.['2019'] && r?.demand?.['2025'])
      if (r?.cf_inherited_from_ba) check('contract region.json zone carries its parent BA', typeof r.ba === 'string' && r.ba !== r.id, `ba=${r.ba}`)
    } else if (f === 'site.json') {
      const cs = doc.candidates || []
      check('contract site.json has {request, candidates}', doc.request && Array.isArray(doc.candidates))
      check('contract site.json request has mw', typeof doc.request?.mw === 'number', `${doc.request?.mw}`)
      const ranks = cs.map(c => c.verdict_rank)
      check('contract site.json candidates sorted by verdict_rank ascending', ranks.every((v, i) => typeof v === 'number' && (i === 0 || v >= ranks[i - 1])), ranks.join(' < '))
      check('contract site.json verdict_ranks are 1..n contiguous', contiguous(ranks, cs.length))
      const noCoords = cs.filter(c => !inCoords(c.region_id || c.id)).map(c => c.region_id || c.id)
      check('contract site.json: every candidate region exists in region_coords', noCoords.length === 0, noCoords.join(', ') || undefined)
      const badShare = cs.filter(c => { const v = c.siting?.overnight_cf_share_2025 ?? c.components?.level_overnight_cf_share_2025; return typeof v !== 'number' || v < 0 || v > 1 }).map(c => c.region_id || c.id)
      check('contract site.json shares are 0-1 fractions', badShare.length === 0, badShare.join(', ') || undefined)
    } else if (f === 'company.json') {
      const c = doc.company && doc.ticker ? doc : (doc.companies ? null : doc)
      check('contract company.json is a single company with ticker and company', !!(c && typeof c.ticker === 'string' && typeof c.company === 'string'), c ? `${c.ticker}` : 'shape not recognised')
      if (c) {
        check('contract company.json has sites[] and claims[]', Array.isArray(c.sites) && Array.isArray(c.claims), `${c.sites?.length} sites, ${c.claims?.length} claims`)
        const badV = (c.claims || []).filter(k => !VERDICTS.has(k.verdict)).map(k => `${k.claim_id}:${k.verdict}`)
        check('contract company.json verdicts in the allowed set', badV.length === 0, badV.join(', ') || undefined)
        const noRegion = (c.sites || []).filter(s => { const z = s.zone ?? s.pjm_zone; const id = s.region_id || (z ? `${s.ba}/${z}` : s.ba); return !inCoords(id) }).map(s => s.metro)
        check('contract company.json: every site resolves to a region in region_coords', noRegion.length === 0, noRegion.join(', ') || undefined)
        const badShare = (c.claims || []).flatMap(k => (k.evidence || []).filter(e => e.type === 'grid' && (typeof e.cf_share !== 'number' || e.cf_share < 0 || e.cf_share > 1)).map(e => `${k.claim_id}:${e.ba}`))
        check('contract company.json evidence shares are 0-1 fractions', badShare.length === 0, badShare.join(', ') || undefined)
      }
    } else ok(`contract ${f}: no shape assertions`, 'parse only')
  }
}

// ---------------------------------------------------------------- summary
console.log(`\n${fails ? 'FAILED' : 'PASSED'}: ${fails} failure${fails === 1 ? '' : 's'}, ${warns} warning${warns === 1 ? '' : 's'} (root ${ROOT})`)
process.exit(fails ? 1 : 0)
