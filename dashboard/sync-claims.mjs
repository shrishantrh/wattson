// Copies claims/*.json from the repo root into public/claims so the static site can read
// Yash's companies.json (or the mock) without a backend. Runs before dev and build.
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
const src = new URL('../claims/', import.meta.url)
const dst = new URL('./public/claims/', import.meta.url)
mkdirSync(dst, { recursive: true })
if (existsSync(src)) for (const f of readdirSync(src)) if (f.endsWith('.json')) cpSync(new URL(f, src), new URL(f, dst))
console.log('claims synced:', existsSync(src) ? readdirSync(src).filter(f => f.endsWith('.json')).join(', ') : 'none')
