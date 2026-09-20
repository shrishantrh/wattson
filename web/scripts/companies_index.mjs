// Regenerates src/data/companies_index.json from ../claims/companies.json.
//
// The searchable company list is DATA, not a hand-written array. Before this, web/src/lib/query.js
// listed four tickers, so a user typing IREN or CRWV -- both mapped in claims/lookup/facilities.csv,
// both with real grid figures -- was told "We don't have IREN". Coverage that exists in the repo and
// not in the product is not coverage.
//
//   node scripts/companies_index.mjs
//
// Runs before dev and build (see package.json). If claims/companies.json is missing it leaves the
// committed index alone and exits 0: a missing source must never break the build.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const src = new URL('../../claims/companies.json', import.meta.url)
const dst = new URL('../src/data/companies_index.json', import.meta.url)

// Nicknames people actually type. The generated ones (full name, first word, ticker) cover most of
// it; these are the ones generation cannot guess. Hand-written, lowercase, checked for collisions.
const EXTRA = {
  META: ['meta', 'facebook', 'meta platforms', 'fb'],
  GOOGL: ['google', 'alphabet', 'goog'],
  MSFT: ['microsoft', 'msft', 'azure'],
  AMZN: ['amazon', 'aws', 'amzn'],
  IREN: ['iren', 'iris energy', 'childress'],
  WULF: ['terawulf', 'tera wulf', 'wulf', 'lake mariner'],  // 'fluidstack' is its own record now
  RIOT: ['riot', 'riot platforms', 'rockdale', 'corsicana'],
  CIFR: ['cipher', 'cipher mining', 'cifr', 'black pearl'],
  APLD: ['applied digital', 'apld', 'polaris forge', 'ellendale'],
  CRWV: ['coreweave', 'core weave', 'crwv'],
  NBIS: ['nebius', 'nbis', 'nebius group'],
  XAI: ['xai', 'x ai', 'grok', 'colossus'],
  ORCL: ['oracle', 'orcl', 'abilene', 'stargate'],  // 'crusoe'/'openai'/'stargate' are their own records now
  DLR: ['digital realty', 'dlr', 'digital realty trust'],
  EQIX: ['equinix', 'eqix'],
  VANTAGE: ['vantage', 'vantage data centers'],
}

const norm = s => String(s || '').toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim()
// "TeraWulf / Fluidstack JV" -> "terawulf"; "Cipher Digital (Cipher Mining)" -> "cipher digital".
const trimmed = name => norm(String(name).split('/')[0].replace(/\([^)]*\)/g, ''))

if (!existsSync(src)) {
  console.log('companies index: ../claims/companies.json missing; keeping the committed index')
  process.exit(0)
}

let companies
try { companies = JSON.parse(readFileSync(src, 'utf8')) } catch (e) {
  console.log(`companies index: ${e.message}; keeping the committed index`)
  process.exit(0)
}

const rows = companies.map(c => {
  const key = String(c.id || c.ticker || '').toUpperCase()
  // Full name, the name without a JV or parenthetical, the route key, the ticker, and the
  // hand-written nicknames. Deliberately NOT the bare first word: that hands "digital" to
  // Digital Realty and "applied" to Applied Digital, which is a guess, not a nickname.
  const aliases = new Set([...(EXTRA[key] || []), norm(c.company), trimmed(c.company), key.toLowerCase()])
  if (c.ticker) aliases.add(String(c.ticker).toLowerCase())
  return {
    key,
    ticker: c.ticker || null,
    name: c.company,
    listed_equity: c.listed_equity ?? !!c.ticker,
    coverage_status: c.coverage_status || (c.claims?.length ? 'sites_and_claims' : 'sites_only'),
    claims_absent_reason: c.claims_absent_reason ?? null,
    n_sites: (c.sites || []).length,
    n_claims: (c.claims || []).length,
    walk_score: c.walk_score ?? null,
    // Where its sites sit, for the palette hint and the not-found screen.
    grids: [...new Set((c.sites || []).map(s => s.region_id || s.ba).filter(Boolean))],
    aliases: [...aliases].filter(Boolean).sort(),
  }
})

// A company's OWN name, ticker and route key outrank any nickname we hand-wrote for a
// different company. Oracle's record mentions OpenAI and Crusoe because they share the
// Abilene site, but someone typing "openai" wants OpenAI. Identity beats association.
const identity = new Map()
for (const r of rows) {
  for (const a of [r.key.toLowerCase(), norm(r.name), trimmed(r.name),
                   r.ticker && String(r.ticker).toLowerCase()].filter(Boolean)) {
    identity.set(a, r.key)
  }
}
for (const r of rows) {
  r.aliases = r.aliases.filter(a => !identity.has(a) || identity.get(a) === r.key)
}

// An alias that names two companies routes the user to whichever came first. Say so loudly.
const owner = new Map()
for (const r of rows) for (const a of r.aliases) {
  if (owner.has(a)) console.log(`WARN alias "${a}" claimed by ${owner.get(a)} and ${r.key}; the first wins`)
  else owner.set(a, r.key)
}

const out = {
  _note: 'GENERATED from claims/companies.json by web/scripts/companies_index.mjs. Do not hand-edit. '
    + 'This is the list the command palette and the not-found screen search; it must equal what the API serves.',
  generated: new Date().toISOString().slice(0, 10),
  counts: {
    total: rows.length,
    sites_and_claims: rows.filter(r => r.coverage_status === 'sites_and_claims').length,
    sites_only: rows.filter(r => r.coverage_status === 'sites_only').length,
    no_site_resolved: rows.filter(r => r.coverage_status === 'no_site_resolved').length,
  },
  companies: rows,
}
writeFileSync(dst, `${JSON.stringify(out, null, 1)}\n`)
console.log(`companies index: ${rows.length} operators (${out.counts.sites_and_claims} with claims, `
  + `${out.counts.sites_only} sites only, ${out.counts.no_site_resolved} unmapped), `
  + `${owner.size} aliases`)
