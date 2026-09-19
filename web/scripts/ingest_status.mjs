// Regenerates src/data/ingest_status.json from ../claims/raw/*.jsonl (Yash's E1 ingest):
// chunks and pages read per company and document kind, and whether extraction has landed.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
const raw = new URL('../../claims/raw/', import.meta.url), ext = new URL('../../claims/extracted/', import.meta.url)
const out = { _note: 'Ingest progress from claims/raw/*.jsonl (Yash, E1). Regenerate with node scripts/ingest_status.mjs.', generated: new Date().toISOString().slice(0, 10), companies: {} }
if (existsSync(raw)) for (const f of readdirSync(raw).filter(f => f.endsWith('.jsonl'))) {
  const [ticker, kind] = f.replace('.jsonl', '').split('_')
  const lines = readFileSync(new URL(f, raw), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  const c = (out.companies[ticker] ||= { documents: [], chunks: 0, pages: 0, extracted: false })
  c.documents.push({ kind, chunks: lines.length, pages: new Set(lines.map(l => l.page)).size, source_doc: lines[0]?.source_doc || null })
  c.chunks += lines.length; c.pages += new Set(lines.map(l => l.page)).size
  c.extracted = existsSync(new URL(`${ticker}.json`, ext))
}
writeFileSync(new URL('../src/data/ingest_status.json', import.meta.url), JSON.stringify(out, null, 1))
console.log('ingest status:', Object.entries(out.companies).map(([t, c]) => `${t} ${c.chunks} chunks / ${c.pages} pages${c.extracted ? ' · extracted' : ''}`).join(', '))
