#!/usr/bin/env node
// Renders each film shot's `say` line to audio, converts it to 48 kHz AAC with a 200 ms fade at the
// end, measures it, writes src/demo/film.timing.json (so Film.jsx holds each shot at least as long
// as its narration and scripts/film.mjs can mux the clips at the right offsets) and docs/narration.md
// (the script in one pass, with per-shot timings).
//
//   node web/scripts/narrate.mjs [--voice <name>] [--rate 170] [--dir <clip dir>] [--ffmpeg <path>] [--say]
//
// Backends: OpenAI text-to-speech when OPENAI_API_KEY is set in the environment (model
// gpt-4o-mini-tts, voice alloy, nova as the fallback; one request per shot; the key is read from
// process.env only and never printed), otherwise macOS `say` with Samantha at rate 170 (a Premium
// voice such as "Ava (Premium)" is used when installed). --say forces the macOS backend.
// Clips go to <tmpdir>/wattson-film/narration by default (outside the repo); the timing file records where.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : null)).filter(Boolean))
const ffmpeg = typeof args.ffmpeg === 'string' ? args.ffmpeg : '/opt/homebrew/bin/ffmpeg'
const ffprobe = ffmpeg.replace(/ffmpeg$/, 'ffprobe')
const rate = Number(args.rate) || 170
const dir = resolve(typeof args.dir === 'string' ? args.dir : join(tmpdir(), 'wattson-film', 'narration'))
const timingOut = join(here, '..', 'src', 'demo', 'film.timing.json')
const scriptOut = join(here, '..', '..', 'docs', 'narration.md')
const FADE = 0.2
const INSTRUCTIONS = 'Calm, clear documentary narrator; unhurried, plain, no sales tone; read numbers carefully.'
const SECTIONS = { problem: 'Problem', solution: 'Solution', how: 'How it works', impact: 'Impact', close: 'Close' }

const duration = f => parseFloat(execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())
function pickSayVoice() {
  if (typeof args.voice === 'string') return args.voice
  const list = execFileSync('say', ['-v', '?']).toString().split('\n')
  for (const v of ['Ava (Premium)', 'Zoe (Premium)']) if (list.some(l => l.startsWith(v))) return v
  return 'Samantha'
}

// Backend (a): OpenAI. Returns the raw mp3 bytes. The key never leaves process.env except in the header.
async function openaiTTS(text, voice) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice, input: text, response_format: 'mp3', instructions: INSTRUCTIONS }),
  })
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return Buffer.from(await res.arrayBuffer())
}

const { FILM } = await import(pathToFileURL(join(here, '..', 'src', 'demo', 'film.js')).href)
const useOpenAI = !args.say && !!process.env.OPENAI_API_KEY
let backend = useOpenAI ? 'openai:alloy' : `say:${pickSayVoice()}@${rate}`
mkdirSync(dir, { recursive: true })
console.log(`[narrate] backend ${backend}; clips in ${dir}`)

const timing = {}
let total = 0, words = 0
for (const [i, s] of FILM.entries()) {
  if (!s.say) { timing[s.id] = { durationMs: 0 }; continue }
  const raw = join(dir, `shot-${i}.${useOpenAI ? 'mp3' : 'aiff'}`), m4a = join(dir, `shot-${i}.m4a`)
  if (useOpenAI) {
    let bytes
    try { bytes = await openaiTTS(s.say, 'alloy') } catch (e) { console.log(`[narrate] alloy failed for ${s.id} (${e.message}); trying nova`); bytes = await openaiTTS(s.say, 'nova'); backend = 'openai:nova' }
    writeFileSync(raw, bytes)
  } else {
    execFileSync('say', ['-v', backend.slice(4).split('@')[0], '-r', String(rate), '-o', raw, s.say])
  }
  const d0 = duration(raw)
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', raw, '-af', `afade=t=out:st=${Math.max(0, d0 - FADE).toFixed(3)}:d=${FADE}`, '-ar', '48000', '-ac', '2', '-c:a', 'aac', '-b:a', '160k', m4a])
  const d = duration(m4a)
  const w = s.say.trim().split(/\s+/).length
  timing[s.id] = { durationMs: Math.round(d * 1000), clip: m4a, words: w }
  total += d; words += w
  console.log(`[narrate] ${String(i).padStart(2)} ${s.id.padEnd(9)} ${d.toFixed(1).padStart(5)} s  ${String(w).padStart(3)} words`)
}
writeFileSync(timingOut, JSON.stringify({ backend, generated: new Date().toISOString(), shots: timing }, null, 2) + '\n')

// docs/narration.md: the script in reading order, then the per-shot table. film.mjs fills in the
// recorded start offsets between the timing markers after a run.
const md = []
md.push('# Wattson film narration', '', '*It follows the power, not the press release.*', '')
md.push(`Generated by \`web/scripts/narrate.mjs\` (${backend}) on ${new Date().toISOString().slice(0, 10)}. One narrator, plain and`)
md.push(`unhurried: ${words} words, ${total.toFixed(1)} s of speech (${Math.round(words / (total / 60))} words per minute). Every figure is one the`)
md.push('screen renders or one in `docs/demo_script.md`; if the data is rebuilt, re-read the sentences off the screen first.', '')
md.push('## The script', '')
let sec = null
for (const s of FILM) {
  if (s.section !== sec) { sec = s.section; md.push(`### ${SECTIONS[sec] || sec}`, '') }
  const where = s.slide ? `slide: ${s.title}` : `${s.route}${s.title ? ` · "${s.title}"` : ''}`
  md.push(`**${s.id}** · ${where}`, '')
  md.push(s.say ? `> ${s.say}` : '> *(no narration)*', '')
}
md.push('## Timings', '')
md.push('Clip is the narration length; hold is the shot\'s minimum after its actions (the shot lasts')
md.push('max(hold, clip + 0.6 s), then 0.4 s of silence). Start is filled in by `web/scripts/film.mjs` from the last recording.', '')
md.push('<!-- timings:start -->')
md.push('| # | shot | section | clip | hold | start |', '|---|---|---|---|---|---|')
FILM.forEach((s, i) => md.push(`| ${i + 1} | ${s.id} | ${SECTIONS[s.section] || s.section} | ${timing[s.id].durationMs ? (timing[s.id].durationMs / 1000).toFixed(1) + ' s' : '—'} | ${(s.holdMs / 1000).toFixed(1)} s | |`))
md.push('<!-- timings:end -->', '')
md.push('## Not said, on purpose', '')
md.push('Never "balancing authority", "carbon-free share of generation", "PJM Interconnection", "caused by", "lied",')
md.push('"greenwashing". The detector flags flat load in general; the verdicts are "true on paper, X physically".', '')
writeFileSync(scriptOut, md.join('\n'))
console.log(`[narrate] ${words} words, ${total.toFixed(1)} s of speech (${Math.round(words / (total / 60))} wpm); wrote ${timingOut} and ${scriptOut}`)
