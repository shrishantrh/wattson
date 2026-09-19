#!/usr/bin/env node
// Records the product film. Opens the app with ?film=1 in the installed Chrome (headed, so the globe
// renders on the real GPU), captures a CDP screencast until window.__film.done, assembles an H.264
// MP4 at 30 fps, muxes the narration clips (scripts/narrate.mjs) at each shot's start, writes a
// silent GIF, prints the per-shot PASS/FAIL table from the shots' `expect` checks, tiles one frame
// per check into a contact sheet, and exits non-zero when any check failed (the files are still
// written). See docs/video.md.
//
//   node web/scripts/film.mjs [--url http://localhost:5174/#/?film=1] [--out docs/wattson-demo.mp4]
//                             [--chrome <path>] [--ffmpeg <path>] [--silent] [--inject] [--keep-frames]
//
// --silent skips the narration (no film.timing.json clips needed). --inject mounts src/pages/Film.jsx
// onto the page itself through the Vite dev server (for testing before App.jsx gates <Film /> on
// ?film=1; dev server only).
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync, statSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..', '..')
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : null)).filter(Boolean))
const url = typeof args.url === 'string' ? args.url : 'http://localhost:5174/#/?film=1'
const out = resolve(typeof args.out === 'string' ? args.out : join(repo, 'docs', 'wattson-demo.mp4'))
const base = out.replace(/\.mp4$/i, '')
const gifOut = base + '.gif', sheetOut = base + '-shots.png'
const chrome = typeof args.chrome === 'string' ? args.chrome : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ffmpeg = typeof args.ffmpeg === 'string' ? args.ffmpeg : '/opt/homebrew/bin/ffmpeg'
const ffprobe = ffmpeg.replace(/ffmpeg$/, 'ffprobe')
const timingFile = join(here, '..', 'src', 'demo', 'film.timing.json')
const narrationMd = join(repo, 'docs', 'narration.md')
const W = 1440, H = 900, FPS = 30

const frameDir = mkdtempSync(join(tmpdir(), 'wattson-film-'))
const log = (...a) => console.log('[film]', ...a)
const mb = p => (statSync(p).size / 1048576).toFixed(2) + ' MB'
const durationOf = f => parseFloat(execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())
const ff = a => execFileSync(ffmpeg, ['-y', '-loglevel', 'error', ...a], { stdio: 'inherit' })
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

async function main() {
  const { FILM } = await import(pathToFileURL(join(here, '..', 'src', 'demo', 'film.js')).href)
  const timing = !args.silent && existsSync(timingFile) ? JSON.parse(readFileSync(timingFile, 'utf8')) : null
  if (!args.silent && !timing) log('no src/demo/film.timing.json; run scripts/narrate.mjs first, or pass --silent')
  log('chrome:', chrome)
  const browser = await puppeteer.launch({
    executablePath: chrome, headless: false, defaultViewport: null,
    args: [`--window-size=${W},${H + 87}`, '--start-fullscreen', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', '--no-first-run', '--no-default-browser-check', '--disable-infobars', '--disable-session-crashed-bubble', '--hide-crash-restore-bubble'],
  })
  const [page] = await browser.pages()
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log('page', m.type(), m.text()) })
  page.on('pageerror', e => log('page error', e.message))

  log('open', url)
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await fitViewport(page)
  if (args.inject) await inject(page)

  const cdp = await page.createCDPSession()
  const frames = []   // { file, t } with t in epoch seconds (CDP frame swap time)
  let n = 0, size = null
  cdp.on('Page.screencastFrame', async ({ data, sessionId, metadata }) => {
    if (!size) size = `${metadata.deviceWidth}x${metadata.deviceHeight}`
    const file = join(frameDir, `f${String(++n).padStart(6, '0')}.jpg`)
    writeFileSync(file, Buffer.from(data, 'base64'))
    frames.push({ file, t: metadata.timestamp })
    try { await cdp.send('Page.screencastFrameAck', { sessionId }) } catch { /* screencast stopped */ }
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: W, maxHeight: H, everyNthFrame: 1 })
  await new Promise(r => setTimeout(r, 300))
  await page.evaluate(() => { if (window.__film) window.__film.start() })
  const t0 = Date.now()
  log('recording; waiting for window.__film.done')
  try {
    await page.waitForFunction(() => window.__film && window.__film.done, { timeout: 300000, polling: 500 })
  } catch (e) {
    const shot = await page.evaluate(() => (window.__film ? window.__film.shot : 'no __film (is ?film=1 wired in App.jsx? try --inject on the dev server)')).catch(() => '?')
    log('timed out waiting for the film to finish; last shot:', shot, e.message)
  }
  await new Promise(r => setTimeout(r, 400))
  await cdp.send('Page.stopScreencast').catch(() => {})
  const { marks, checks } = await page.evaluate(() => ({ marks: window.__film?.marks || [], checks: window.__film?.checks || [] })).catch(() => ({ marks: [], checks: [] }))
  await new Promise(r => setTimeout(r, 200))
  const wall = (Date.now() - t0) / 1000
  log(`captured ${frames.length} frames in ${wall.toFixed(1)} s, viewport ${size}`)
  if (frames.length < 2) { log('no frames captured'); await browser.close(); process.exit(1) }
  if (size !== `${W}x${H}`) log(`warning: frames are ${size}, not ${W}x${H}; the video is padded, not stretched`)
  const frameAt = t => { let f = frames[0]; for (const x of frames) { if (x.t <= t) f = x; else break } return f }

  // Contact sheet: one frame per expect check (the frame just before the check), 3 wide, with the
  // shot's title and narration under each; rendered in the same Chrome and screenshotted.
  const cells = checks.map(c => { const s = FILM[c.shot] || {}; const f = frameAt(c.t / 1000); return { ...c, title: s.title || (s.route ? `${s.id} · ${s.route}` : s.id), say: s.say || '', section: s.section, img: readFileSync(f.file).toString('base64'), at: Math.max(0, f.t - frames[0].t) } })
  if (cells.length) {
    log('rendering the contact sheet')
    const html = `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;background:#0a0c0b;color:#e9ece9;font-family:-apple-system,Inter,system-ui,sans-serif;padding:28px}
      h1{font-size:20px;font-weight:600;margin:0 0 4px;letter-spacing:-0.01em} .sub{color:#a2a8a4;font-size:13px;margin:0 0 20px}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
      .cell{background:#111413;border:1px solid rgba(255,255,255,.08);border-radius:10px;overflow:hidden}
      .cell img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;background:#000}
      .meta{padding:10px 12px 12px} .k{display:flex;justify-content:space-between;align-items:baseline;font:500 11px ui-monospace,Menlo,monospace;color:#676d69;margin-bottom:4px}
      .ok{color:#8fd19e}.fail{color:#ff7a4a} .t{font-size:14px;font-weight:600;letter-spacing:-0.01em;line-height:1.25} .s{font-size:12px;color:#a2a8a4;line-height:1.4;margin-top:4px} .m{font-size:11px;color:#ff7a4a;margin-top:4px}
    </style><h1>Wattson film, ${cells.length} shots</h1><p class="sub">One frame per shot at the moment of its check · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · ${url}</p><div class="grid">${cells.map(c => `<div class="cell"><img src="data:image/jpeg;base64,${c.img}"><div class="meta"><div class="k"><span>${c.shot + 1} · ${esc(c.id)} · ${esc(c.section)} · ${c.at.toFixed(1)} s</span><span class="${c.ok ? 'ok' : 'fail'}">${c.ok ? 'PASS' : 'FAIL'}</span></div><div class="t">${esc(c.title)}</div>${c.say ? `<div class="s">${esc(c.say)}</div>` : ''}${c.ok ? '' : `<div class="m">${esc(c.missing)}</div>`}</div></div>`).join('')}</div>`
    const sheet = await browser.newPage()
    await sheet.setViewport({ width: 1500, height: 1000, deviceScaleFactor: 1 })
    await sheet.setContent(html, { waitUntil: 'load' })
    await sheet.screenshot({ path: sheetOut, fullPage: true })
    await sheet.close()
  }
  await browser.close()

  // Concat list with per-frame durations (screencast frames arrive only when something changed).
  const lines = ['ffconcat version 1.0']
  for (let i = 0; i < frames.length; i++) {
    const d = i + 1 < frames.length ? Math.max(1 / FPS / 2, frames[i + 1].t - frames[i].t) : 0.5
    lines.push(`file '${frames[i].file}'`, `duration ${d.toFixed(4)}`)
  }
  lines.push(`file '${frames[frames.length - 1].file}'`)
  const list = join(frameDir, 'list.txt')
  writeFileSync(list, lines.join('\n') + '\n')

  mkdirSync(dirname(out), { recursive: true })
  const silent = join(frameDir, 'silent.mp4')
  log('encoding video')
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-vf', `fps=${FPS},scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=#0a0c0b,format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', silent])
  const videoDur = durationOf(silent)

  // Narration: a silent stereo base of the video's length, each clip delayed to its shot's start.
  const clips = (timing ? marks : []).map(m => ({ ...m, clip: timing.shots?.[m.id]?.clip })).filter(c => c.clip && existsSync(c.clip)).map(c => ({ ...c, at: Math.max(0, c.t / 1000 - frames[0].t) }))
  if (clips.length) {
    log(`muxing ${clips.length} narration clips`)
    const inputs = ['-i', silent, '-f', 'lavfi', '-t', videoDur.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo']
    clips.forEach(c => inputs.push('-i', c.clip))
    const delayed = clips.map((c, i) => `[${i + 2}:a]adelay=${Math.round(c.at * 1000)}|${Math.round(c.at * 1000)}[a${i}]`).join(';')
    const mix = `[1:a]${clips.map((c, i) => `[a${i}]`).join('')}amix=inputs=${clips.length + 1}:normalize=0:duration=first[a]`
    ff([...inputs, '-filter_complex', `${delayed};${mix}`, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-movflags', '+faststart', out])
  } else {
    if (timing) log('no narration marks found on the page; writing the silent video')
    ff(['-i', silent, '-c', 'copy', out])
  }

  // GIF: 12 fps, 960 wide, under 15 MB; step down colours and fps until it fits.
  const tries = [[12, 960, 160], [12, 960, 96], [10, 880, 96], [10, 800, 64], [8, 720, 64]]
  for (const [fps, w, colors] of tries) {
    log(`encoding gif ${w}w ${fps}fps ${colors} colours`)
    ff(['-i', silent, '-vf', `fps=${fps},scale=${w}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, '-loop', '0', gifOut])
    if (statSync(gifOut).size < 15 * 1048576) break
  }
  if (!args['keep-frames']) rmSync(frameDir, { recursive: true, force: true }); else log('frames kept in', frameDir)

  // The recorded start offsets go into docs/narration.md's timing table.
  if (existsSync(narrationMd) && marks.length) {
    const md = readFileSync(narrationMd, 'utf8')
    const at = Object.fromEntries(marks.map(m => [m.id, Math.max(0, m.t / 1000 - frames[0].t)]))
    const rows = md.replace(/(<!-- timings:start -->)([\s\S]*?)(<!-- timings:end -->)/, (_, a, body, z) => a + body.replace(/^\| (\d+) \| ([\w-]+) \|(.*)\| *[\d.]* ?s? *\|$/gm, (l, i, id, rest) => (at[id] != null ? `| ${i} | ${id} |${rest}| ${at[id].toFixed(1)} s |` : l)) + z)
    writeFileSync(narrationMd, rows.replace(/^(\| # \| shot .*)$/m, '$1'))
  }

  // The table.
  const total = durationOf(out)
  log('')
  log('shot        section   at      result')
  let failed = 0
  for (const c of checks) {
    const s = FILM[c.shot] || {}, m = marks.find(x => x.shot === c.shot)
    if (!c.ok) failed++
    log(`${c.id.padEnd(11)} ${String(s.section || '').padEnd(9)} ${(m ? Math.max(0, m.t / 1000 - frames[0].t) : 0).toFixed(1).padStart(5)} s  ${c.ok ? 'PASS' : 'FAIL  ' + c.missing}`)
  }
  const missing = FILM.length - checks.length
  if (missing > 0) { failed += missing; log(`${missing} shot(s) never reached their check`) }
  log('')
  log(`mp4    ${out}  ${mb(out)}  ${total.toFixed(1)} s${clips.length ? `  (${clips.length} narration clips, ${timing?.backend || ''})` : '  (silent)'}`)
  log(`gif    ${gifOut}  ${mb(gifOut)}`)
  if (cells.length) log(`sheet  ${sheetOut}  ${mb(sheetOut)}`)
  log(failed ? `${failed} FAIL` : `all ${checks.length} shots PASS`)
  if (total > 135) log(`warning: ${total.toFixed(1)} s is over the 2:15 limit`)
  process.exit(failed ? 1 : 0)
}

// The screencast captures the visible area, so the window's content area must hold all of W x H.
// A 13-inch display (1470 x 956 points) cannot fit 900 px under Chrome's toolbar, so the window is
// fullscreen (--start-fullscreen) and the viewport emulated at W x H inside it; the fullscreen
// transition can land after the first setViewport, so it is re-applied until the page agrees.
async function fitViewport(page) {
  for (let i = 0; i < 8; i++) {
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 })
    await new Promise(r => setTimeout(r, 500))
    const { w, h } = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }))
    if (w === W && h === H) { log(`viewport ${w}x${h}`); return }
  }
  log('warning: could not get a stable viewport of', `${W}x${H}`)
}

// Test path: mount the Film component ourselves, resolving react and react-dom/client to the very
// module URLs the app uses (Vite's pre-bundled deps carry a ?v= hash) so hooks share one React.
async function inject(page) {
  log('injecting src/pages/Film.jsx (dev server test mode)')
  await page.evaluate(async () => {
    const src = await (await fetch('/src/pages/Film.jsx')).text()
    const main = await (await fetch('/src/main.jsx')).text()
    const reactUrl = (src.match(/from\s+"([^"]*\/react\.js[^"]*)"/) || [])[1]
    const domUrl = (main.match(/from\s+"([^"]*react-dom_client[^"]*)"/) || [])[1]
    if (!reactUrl || !domUrl) throw new Error('could not resolve react module urls from the dev server')
    const [{ default: Film }, reactMod, domMod] = await Promise.all([import('/src/pages/Film.jsx'), import(reactUrl), import(domUrl)])
    const React = reactMod.default || reactMod, { createRoot } = domMod.default || domMod   // pre-bundled CJS: named exports live on default
    const host = document.createElement('div'); host.id = 'film-host'; document.body.appendChild(host)
    createRoot(host).render(React.createElement(Film))
  })
}

main().catch(e => { console.error(e); process.exit(1) })
