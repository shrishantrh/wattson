#!/usr/bin/env node
// Renders each film shot's `say` line to audio, converts it to 48 kHz AAC with a short trailing pad
// and fade (so the last word is never clipped), measures it, verifies it is not silence, writes
// src/demo/film.timing.json (so Film.jsx holds each shot at least as long as its narration and
// scripts/film.mjs can mux the clips at the right offsets) and docs/narration.md (the script in one
// pass, with per-shot timings and a fit column).
//
//   node web/scripts/narrate.mjs [--voice <name>] [--rate 168] [--dir <clip dir>] [--ffmpeg <path>]
//                                [--say] [--speed 1.0] [--model <id>] [--no-expand]
//                                [--list-voices] [--audition] [--dry-run]
//
// Backends: OpenAI text-to-speech when OPENAI_API_KEY is set in the environment (model
// gpt-4o-mini-tts, narrator voice `ash`; one request per shot; the key is read from process.env
// only and is never printed or written anywhere), otherwise macOS `say`. --say forces macOS.
//
// Spoken-form expansion (the thing that makes numbers sound right) rewrites the `say` line before
// synthesis: "8.7 GW" -> "eight point seven gigawatts", "46.5%" -> "forty six point five percent",
// "2019" -> "twenty nineteen", "6th" -> "sixth", "p. 4" -> "page four". Run --dry-run to proofread
// every line's spoken form without synthesising anything. --no-expand disables it.
//
// Clips go to <tmpdir>/wattson-film/narration by default (outside the repo); the timing file records
// where, and records a fingerprint of the shot list so scripts/film.mjs can refuse a stale one.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : null)).filter(Boolean))
const ffmpeg = typeof args.ffmpeg === 'string' ? args.ffmpeg : '/opt/homebrew/bin/ffmpeg'
const ffprobe = ffmpeg.replace(/ffmpeg$/, 'ffprobe')
const rate = Number(args.rate) || 168
const speed = Number(args.speed) || 1.0
const dir = resolve(typeof args.dir === 'string' ? args.dir : join(tmpdir(), 'wattson-film', 'narration'))
const timingOut = join(here, '..', 'src', 'demo', 'film.timing.json')
const scriptOut = join(here, '..', '..', 'docs', 'narration.md')
const PAD = 0.30, FADE = 0.18, TAIL_MS = 600   // TAIL_MS must match Film.jsx's TAIL_MS
const INSTRUCTIONS = 'A calm, clear documentary narrator. Unhurried and plain, with no sales tone and no upward inflection. Let each sentence land before the next. Read every number carefully and evenly, as written.'
const SECTIONS = { problem: 'Problem', solution: 'Solution', how: 'How it works', impact: 'Impact', close: 'Close' }

const duration = f => parseFloat(execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())

// ---------------------------------------------------------------------------
// Spoken form. TTS engines mangle "8.7 GW" and "2019"; spelling them out first is the fix.
// ---------------------------------------------------------------------------
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const ORDINAL = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' }

const under100 = n => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''))
const under1000 = n => (n < 100 ? under100(n) : ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + under100(n % 100) : ''))
function intWords(n) {
  if (n === 0) return 'zero'
  const parts = []
  for (const [size, name] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']]) {
    if (n >= size) { parts.push(under1000(Math.floor(n / size)) + ' ' + name); n %= size }
  }
  if (n) parts.push(under1000(n))
  return parts.join(' ')
}
const decimalWords = s => s.split('').map(d => ONES[Number(d)]).join(' ')
function numWords(tok) {
  const neg = tok.startsWith('-')
  const [int, dec] = tok.replace(/^-/, '').replace(/,/g, '').split('.')
  return (neg ? 'minus ' : '') + intWords(Number(int)) + (dec ? ' point ' + decimalWords(dec) : '')
}
function ordinalWords(n) {
  const w = intWords(n), m = w.match(/([a-z]+)$/)
  const last = m ? m[1] : w
  if (ORDINAL[last]) return w.slice(0, w.length - last.length) + ORDINAL[last]
  if (last.endsWith('y')) return w.slice(0, w.length - 1) + 'ieth'
  return w + 'th'
}
// 2019 -> "twenty nineteen"; 2000 -> "two thousand"; 2005 -> "two thousand five".
function yearWords(n) {
  if (n % 1000 === 0) return intWords(n)
  if (n % 100 === 0) return under100(Math.floor(n / 100)) + ' hundred'
  const hi = Math.floor(n / 100), lo = n % 100
  if (lo < 10) return intWords(Math.floor(n / 1000) * 1000) + ' ' + under100(n % 1000)   // 2005 -> two thousand five
  return under100(hi) + ' ' + under100(lo)
}
const UNITS = [
  [/\bGWh\b/g, 'gigawatt hour'], [/\bMWh\b/g, 'megawatt hour'], [/\bTWh\b/g, 'terawatt hour'], [/\bkWh\b/g, 'kilowatt hour'],
  [/\bGW\b/g, 'gigawatt'], [/\bMW\b/g, 'megawatt'], [/\bTW\b/g, 'terawatt'], [/\bkW\b/g, 'kilowatt'],
]

export function speakable(text, { pauses = false } = {}) {
  let s = String(text)
  s = s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  s = s.replace(/\s*[–—]\s*/g, ', ')                       // en/em dash -> a comma's breath
  s = s.replace(/\b24\/7\b/g, 'twenty four seven')
  s = s.replace(/\bp\.\s*(\d+)/gi, (_, n) => 'page ' + intWords(Number(n)))
  s = s.replace(/\b(\d{4})\s*[-–to]{1,2}\s*(\d{4})\b/g, (m, a, b) => (isYear(+a) && isYear(+b) ? `${yearWords(+a)} to ${yearWords(+b)}` : m))
  // A number's unit, so "8.7 GW" becomes one phrase and pluralises correctly.
  for (const [re, word] of UNITS) {
    s = s.replace(new RegExp(`(-?[\\d,]+(?:\\.\\d+)?)\\s*${re.source.replace(/\\b/g, '')}\\b`, 'g'), (_, n) => `${numWords(n)} ${word}${Number(n.replace(/,/g, '')) === 1 ? '' : 's'}`)
    s = s.replace(re, word + 's')                                    // a bare unit with no number
  }
  s = s.replace(/\$\s*(-?[\d,]+(?:\.\d+)?)\s*(billion|million|trillion)?/gi, (_, n, big) => `${numWords(n)}${big ? ' ' + big.toLowerCase() : ''} dollars`)
  s = s.replace(/(-?[\d,]+(?:\.\d+)?)\s*%/g, (_, n) => `${numWords(n)} percent`)
  s = s.replace(/\b(\d+)(st|nd|rd|th)\b/gi, (_, n) => ordinalWords(Number(n)))
  s = s.replace(/\b(\d{4})\b/g, (m, y) => (isYear(+y) ? yearWords(+y) : m))
  s = s.replace(/(-?\b[\d,]+(?:\.\d+)?\b)/g, (m) => (/\d/.test(m) ? numWords(m) : m))
  s = s.replace(/\s{2,}/g, ' ').trim()
  if (pauses) {
    // macOS `say` honours [[slnc ms]]. A breath after each sentence, and a lead-in so the mux and
    // the fade never clip the first phoneme.
    s = s.replace(/([.!?])\s+/g, '$1 [[slnc 300]] ').replace(/:\s+/g, ': [[slnc 200]] ')
    s = '[[slnc 180]] ' + s
  }
  return s
}
const isYear = n => n >= 1900 && n <= 2099

// ---------------------------------------------------------------------------
// Voices
// ---------------------------------------------------------------------------
// macOS `say` voices that are worth narrating with, best first. Anything in the MacinTalk family
// (Fred, Ralph, Albert, Kathy, Junior) or the novelty set (Bells, Zarvox, ...) is deliberately absent.
const SAY_PREFERRED = ['Ava (Premium)', 'Zoe (Premium)', 'Evan (Enhanced)', 'Ava (Enhanced)', 'Samantha (Enhanced)', 'Tom (Enhanced)', 'Daniel (Enhanced)', 'Daniel', 'Samantha', 'Karen', 'Moira', 'Tessa']
const OPENAI_PREFERRED = ['ash', 'sage', 'alloy', 'nova']

function installedVoices() {
  return execFileSync('say', ['-v', '?']).toString().split('\n')
    .map(l => l.match(/^(.+?)\s{2,}([a-z]{2}_[A-Z]{2})/)).filter(Boolean)
    .map(m => ({ name: m[1].trim(), lang: m[2] }))
}
function pickSayVoice(all) {
  if (typeof args.voice === 'string') return args.voice
  const names = new Set(all.map(v => v.name))
  for (const v of SAY_PREFERRED) if (names.has(v)) return v
  return 'Samantha'
}

// Backend (a): OpenAI. Returns the raw mp3 bytes. The key is only ever read from process.env and put
// in the Authorization header; it is never logged, echoed or written to disk.
async function openaiTTS(text, voice, model) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, voice, input: text, response_format: 'mp3', speed, instructions: INSTRUCTIONS }),
  })
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${(await res.text()).replace(/sk-[A-Za-z0-9_-]+/g, '<redacted>').slice(0, 200)}`)
  return Buffer.from(await res.arrayBuffer())
}

// mean_volume in dBFS. Pure digital silence reports -91 dB (or nothing at all).
function meanVolume(f) {
  const out = execFileSync(ffmpeg, ['-hide_banner', '-i', f, '-af', 'volumedetect', '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] }).toString?.() ?? ''
  return out
}
function loudness(f) {
  let stderr = ''
  try { execFileSync(ffmpeg, ['-hide_banner', '-nostats', '-i', f, '-af', 'volumedetect', '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] }) } catch (e) { stderr = (e.stderr || '').toString() }
  if (!stderr) { try { stderr = execFileSync('sh', ['-c', `${JSON.stringify(ffmpeg)} -hide_banner -nostats -i ${JSON.stringify(f)} -af volumedetect -f null - 2>&1`]).toString() } catch { /* ignore */ } }
  const m = stderr.match(/mean_volume:\s*(-?[\d.]+) dB/)
  const p = stderr.match(/max_volume:\s*(-?[\d.]+) dB/)
  return { mean: m ? parseFloat(m[1]) : NaN, max: p ? parseFloat(p[1]) : NaN }
}

// ---------------------------------------------------------------------------
const { FILM } = await import(pathToFileURL(join(here, '..', 'src', 'demo', 'film.js')).href)
const all = installedVoices()

if (args['list-voices']) {
  const en = all.filter(v => v.lang.startsWith('en'))
  console.log(`[narrate] ${all.length} voices installed, ${en.length} English.`)
  console.log('[narrate] narrator-grade and installed, best first:')
  for (const v of SAY_PREFERRED) if (all.some(x => x.name === v)) console.log('   *', v)
  console.log('[narrate] all English voices:', en.map(v => v.name).join(', '))
  process.exit(0)
}

// --speak "<text>" prints the spoken form of arbitrary text and exits: the test harness for the
// expansion rules, and the quickest way to check a new narration line before it is in the shot list.
if (typeof args.speak === 'string') { console.log(speakable(args.speak)); process.exit(0) }

const useOpenAI = !args.say && !!process.env.OPENAI_API_KEY
const openaiModel = typeof args.model === 'string' ? args.model : 'gpt-4o-mini-tts'
const openaiVoice = typeof args.voice === 'string' ? args.voice : OPENAI_PREFERRED[0]
const sayVoice = pickSayVoice(all)
const expand = !args['no-expand']
let backend = useOpenAI ? `openai:${openaiModel}:${openaiVoice}@${speed}` : `say:${sayVoice}@${rate}`
console.log(`[narrate] OPENAI_API_KEY ${process.env.OPENAI_API_KEY ? 'is set' : 'is NOT set'}; backend ${backend}; spoken-form expansion ${expand ? 'on' : 'OFF'}`)
if (!useOpenAI && !SAY_PREFERRED.slice(0, 7).some(v => v === sayVoice)) console.log(`[narrate] note: no Premium/Enhanced voice is installed; "${sayVoice}" is the best of what is here. See --list-voices, and System Settings > Accessibility > Spoken Content > System Voice > Manage Voices to install a better one.`)

// --dry-run: proofread every spoken form without synthesising. The cheapest way to catch a mangled
// number before it is in the video.
if (args['dry-run']) {
  for (const [i, s] of FILM.entries()) {
    if (!s.say) continue
    const spoken = expand ? speakable(s.say) : s.say
    console.log(`\n${String(i).padStart(2)} ${s.id}`)
    console.log(`   written: ${s.say}`)
    console.log(`   spoken : ${spoken}`)
    if (/\d/.test(spoken)) console.log(`   WARNING: digits survive expansion; the engine will read them its own way`)
  }
  process.exit(0)
}

// --audition: one sample sentence in each installed narrator-grade voice, so the owner can listen
// and pick, instead of guessing from a name.
if (args.audition) {
  const sample = FILM.find(s => s.say && /\d/.test(s.say))?.say || 'Clean power fell from 40.5% to 39.7%, while overnight generation rose 8.7 GW since 2019.'
  const adir = join(dir, 'audition'); mkdirSync(adir, { recursive: true })
  console.log(`[narrate] auditioning: "${speakable(sample)}"`)
  for (const v of SAY_PREFERRED) {
    if (!all.some(x => x.name === v)) continue
    const f = join(adir, `${v.replace(/[^\w]+/g, '-')}.aiff`)
    execFileSync('say', ['-v', v, '-r', String(rate), '-o', f, speakable(sample, { pauses: true })])
    console.log(`   ${v.padEnd(22)} ${duration(f).toFixed(1)} s  ${f}`)
  }
  console.log(`[narrate] listen with:  open ${adir}`)
  process.exit(0)
}

mkdirSync(dir, { recursive: true })
console.log(`[narrate] clips in ${dir}`)

const timing = {}
const fit = []
let total = 0, words = 0, failures = 0
for (const [i, s] of FILM.entries()) {
  if (!s.say) { timing[s.id] = { durationMs: 0 }; continue }
  const spoken = expand ? speakable(s.say, { pauses: !useOpenAI }) : s.say
  const raw = join(dir, `shot-${i}.${useOpenAI ? 'mp3' : 'aiff'}`), m4a = join(dir, `shot-${i}.m4a`)
  rmSync(raw, { force: true }); rmSync(m4a, { force: true })
  if (useOpenAI) {
    let bytes, last
    for (const v of [openaiVoice, ...OPENAI_PREFERRED.filter(x => x !== openaiVoice)]) {
      try { bytes = await openaiTTS(spoken, v, openaiModel); backend = `openai:${openaiModel}:${v}@${speed}`; break } catch (e) { last = e; console.log(`[narrate] ${v} failed for ${s.id} (${e.message})`) }
    }
    if (!bytes) throw new Error(`every OpenAI voice failed for ${s.id}: ${last?.message}`)
    writeFileSync(raw, bytes)
  } else {
    execFileSync('say', ['-v', sayVoice, '-r', String(rate), '-o', raw, spoken])
  }
  const d0 = duration(raw)
  // Pad the tail before fading, so the fade never eats the last word.
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', raw, '-af', `apad=pad_dur=${PAD},afade=t=out:st=${(d0 + PAD - FADE).toFixed(3)}:d=${FADE}`, '-t', (d0 + PAD).toFixed(3), '-ar', '48000', '-ac', '2', '-c:a', 'aac', '-b:a', '160k', m4a])
  const d = duration(m4a)
  const { mean, max } = loudness(m4a)

  // Loud failures: a clip that is silence, or implausibly short for its word count, is a broken take.
  const w = spoken.replace(/\[\[[^\]]*\]\]/g, '').trim().split(/\s+/).length
  const problems = []
  if (!(d > 0.3)) problems.push(`clip is ${d.toFixed(2)} s`)
  if (Number.isFinite(max) && max < -50) problems.push(`clip is silence (max ${max.toFixed(1)} dB)`)
  if (Number.isFinite(mean) && mean < -60) problems.push(`clip is near-silent (mean ${mean.toFixed(1)} dB)`)
  if (d < w * 0.12) problems.push(`${d.toFixed(1)} s is too short for ${w} words`)
  if (problems.length) { failures++; console.log(`[narrate] FAIL ${s.id}: ${problems.join('; ')}`) }

  timing[s.id] = { durationMs: Math.round(d * 1000), clip: m4a, words: w, meanDb: Number.isFinite(mean) ? +mean.toFixed(1) : null }
  const need = d * 1000 + TAIL_MS
  fit.push({ i, id: s.id, clip: d, hold: (s.holdMs || 0) / 1000, need: need / 1000, over: need > (s.holdMs || 0) })
  total += d; words += w
  console.log(`[narrate] ${String(i).padStart(2)} ${s.id.padEnd(10)} ${d.toFixed(1).padStart(5)} s  ${String(w).padStart(3)} words  ${Number.isFinite(mean) ? mean.toFixed(1).padStart(6) + ' dB' : ''}  ${need > (s.holdMs || 0) ? `EXTENDS hold ${(s.holdMs / 1000).toFixed(1)}s -> ${(need / 1000).toFixed(1)}s` : 'fits'}`)
}

// The fingerprint lets scripts/film.mjs refuse a timing file generated for a different shot list,
// which is the one way narration can silently land on the wrong scene.
const fingerprint = createHash('sha256').update(JSON.stringify(FILM.map(s => [s.id, s.say || '', s.holdMs || 0]))).digest('hex').slice(0, 16)
writeFileSync(timingOut, JSON.stringify({ backend, generated: new Date().toISOString(), fingerprint, shots: timing }, null, 2) + '\n')

// docs/narration.md: the script in reading order, then the per-shot table. film.mjs fills in the
// recorded start offsets between the timing markers after a run.
const md = []
md.push('# Wattson film narration', '', '*It follows the power, not the press release.*', '')
md.push(`Generated by \`web/scripts/narrate.mjs\` (${backend}) on ${new Date().toISOString().slice(0, 10)}. One narrator, plain and`)
md.push(`unhurried: ${words} words, ${total.toFixed(1)} s of speech (${Math.round(words / (total / 60))} words per minute). Every figure is one the`)
md.push('screen renders or one in `docs/demo_script.md`; if the data is rebuilt, re-read the sentences off the screen first.', '')
md.push('Numbers are expanded into spoken words before synthesis (`speakable()` in `narrate.mjs`), so')
md.push('"8.7 GW" is read "eight point seven gigawatts". Run `node web/scripts/narrate.mjs --dry-run`', 'to proofread every line\'s spoken form.', '')
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
md.push(`max(hold, clip + ${(TAIL_MS / 1000).toFixed(1)} s), then 0.4 s of silence). "Extends" means the narration is longer than the`)
md.push('hold and Film.jsx stretches the shot to fit it, which is fine but lengthens the film. Start is')
md.push('filled in by `web/scripts/film.mjs` from the last recording.', '')
md.push('<!-- timings:start -->')
md.push('| # | shot | section | clip | hold | fit | start |', '|---|---|---|---|---|---|---|')
FILM.forEach((s, i) => {
  const f = fit.find(x => x.id === s.id)
  md.push(`| ${i + 1} | ${s.id} | ${SECTIONS[s.section] || s.section} | ${timing[s.id].durationMs ? (timing[s.id].durationMs / 1000).toFixed(1) + ' s' : '—'} | ${(s.holdMs / 1000).toFixed(1)} s | ${f ? (f.over ? `extends to ${f.need.toFixed(1)} s` : 'fits') : '—'} | |`)
})
md.push('<!-- timings:end -->', '')
md.push('## Not said, on purpose', '')
md.push('Never "balancing authority", "carbon-free share of generation", "PJM Interconnection", "caused by", "lied",')
md.push('"greenwashing". The detector flags flat load in general; the verdicts are "true on paper, X physically".', '')
writeFileSync(scriptOut, md.join('\n'))

const over = fit.filter(f => f.over)
console.log('')
console.log(`[narrate] ${words} words, ${total.toFixed(1)} s of speech (${Math.round(words / (total / 60))} wpm); wrote ${timingOut} and ${scriptOut}`)
console.log(`[narrate] shot-list fingerprint ${fingerprint}`)
if (over.length) {
  console.log(`[narrate] ${over.length} shot(s) whose narration is longer than the hold; Film.jsx stretches these to fit:`)
  for (const f of over) console.log(`   ${f.id.padEnd(10)} clip ${f.clip.toFixed(1)} s + ${(TAIL_MS / 1000).toFixed(1)} s tail = ${f.need.toFixed(1)} s > hold ${f.hold.toFixed(1)} s  (+${(f.need - f.hold).toFixed(1)} s)`)
  console.log('[narrate] this is safe, but it lengthens the film; raise those holdMs in web/src/demo/film.js to make it deliberate.')
}
if (failures) { console.log(`[narrate] ${failures} clip(s) FAILED their loudness/length check; do not record until this is fixed`); process.exit(1) }
