// Copies data the static site reads, in precedence order, before dev and build:
//   ../server/static_export/**  -> public/api/       (the engine's static export: real endpoint responses)
//   ../fixtures/*.json          -> public/fixtures/  (Yash's contract fixtures)
//   ./fixtures.provisional/*.json -> public/fixtures/ (reshaped from regions.json until his land; same names lose)
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
const provisional = new URL('./fixtures.provisional/', import.meta.url)
const contract = new URL('../fixtures/', import.meta.url)
const staticExport = new URL('../server/static_export/', import.meta.url)
const dstFix = new URL('./public/fixtures/', import.meta.url)
const dstApi = new URL('./public/api/', import.meta.url)
const jsons = dir => (existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json')) : [])
rmSync(dstFix, { recursive: true, force: true }); mkdirSync(dstFix, { recursive: true })
const used = {}
for (const f of jsons(provisional)) { cpSync(new URL(f, provisional), new URL(f, dstFix)); used[f] = 'provisional' }
for (const f of jsons(contract)) { cpSync(new URL(f, contract), new URL(f, dstFix)); used[f] = 'fixtures/' }
console.log('fixtures synced:', Object.entries(used).map(([f, src]) => `${f} (${src})`).join(', ') || 'none')
rmSync(dstApi, { recursive: true, force: true })
if (existsSync(staticExport)) { cpSync(staticExport, dstApi, { recursive: true }); console.log('static export synced from server/static_export -> public/api') }
else console.log('no server/static_export yet; the app reads fixtures')
