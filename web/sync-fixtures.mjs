// Copies fixtures into public/fixtures so the static site reads them without a backend.
// Source order: ../fixtures/*.json (Yash's contract fixtures, when present) overrides
// ./fixtures.provisional/*.json (reshaped from regions.json until his land). Runs before dev and build.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
const provisional = new URL('./fixtures.provisional/', import.meta.url)
const contract = new URL('../fixtures/', import.meta.url)
const dst = new URL('./public/fixtures/', import.meta.url)
const jsons = dir => (existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json')) : [])
rmSync(dst, { recursive: true, force: true }); mkdirSync(dst, { recursive: true })
const used = {}
for (const f of jsons(provisional)) { cpSync(new URL(f, provisional), new URL(f, dst)); used[f] = 'provisional' }
for (const f of jsons(contract)) { cpSync(new URL(f, contract), new URL(f, dst)); used[f] = 'fixtures/' }
console.log('fixtures synced:', Object.entries(used).map(([f, src]) => `${f} (${src})`).join(', ') || 'none')
