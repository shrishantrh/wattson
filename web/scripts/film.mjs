#!/usr/bin/env node
// Records the product film. Opens the app with ?film=1 in the installed Chrome (headed, so the globe
// renders on the real GPU), captures a CDP screencast until window.__film.done, then assembles an
// H.264 MP4 and a GIF with ffmpeg. See docs/video.md.
//
//   node web/scripts/film.mjs [--url http://localhost:5174/#/?film=1] [--out docs/wattson-demo.mp4]
//                             [--chrome <path>] [--ffmpeg <path>] [--inject] [--keep-frames]
//
// --inject mounts src/pages/Film.jsx onto the page itself through the Vite dev server (for testing
// the film before App.jsx gates <Film /> on ?film=1; dev server only).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, statSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..', '..')
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : null)).filter(Boolean))
const url = typeof args.url === 'string' ? args.url : 'http://localhost:5174/#/?film=1'
const out = resolve(typeof args.out === 'string' ? args.out : join(repo, 'docs', 'wattson-demo.mp4'))
const gifOut = out.replace(/\.mp4$/i, '') + '.gif'
const chrome = typeof args.chrome === 'string' ? args.chrome : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ffmpeg = typeof args.ffmpeg === 'string' ? args.ffmpeg : '/opt/homebrew/bin/ffmpeg'
const W = 1440, H = 900, FPS = 30

const frameDir = mkdtempSync(join(tmpdir(), 'wattson-film-'))
const log = (...a) => console.log('[film]', ...a)
const mb = p => (statSync(p).size / 1048576).toFixed(2) + ' MB'

// ffprobe sits next to ffmpeg in a Homebrew install; fall back to parsing ffmpeg's own banner.
function durationOf(file) {
  try { return parseFloat(execFileSync(ffmpeg.replace(/ffmpeg$/, 'ffprobe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim()) } catch {
    try { execFileSync(ffmpeg, ['-i', file], { stdio: 'pipe' }) } catch (e) { const m = String(e.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/); if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3] }
    return NaN
  }
}

async function main() {
  log('chrome:', chrome)
  const browser = await puppeteer.launch({
    executablePath: chrome, headless: false, defaultViewport: null,
    args: [`--window-size=${W},${H + 87}`, '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', '--start-fullscreen', '--no-first-run', '--no-default-browser-check', '--disable-infobars', '--disable-session-crashed-bubble', '--hide-crash-restore-bubble'],
  })
  const [page] = await browser.pages()
  await fitWindow(browser, page)
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log('page', m.type(), m.text()) })
  page.on('pageerror', e => log('page error', e.message))

  const cdp = await page.createCDPSession()
  const frames = []   // { file, t }
  let n = 0
  let size = null
  cdp.on('Page.screencastFrame', async ({ data, sessionId, metadata }) => {
    if (!size) size = `${metadata.deviceWidth}x${metadata.deviceHeight}`
    const file = join(frameDir, `f${String(++n).padStart(6, '0')}.jpg`)
    writeFileSync(file, Buffer.from(data, 'base64'))
    frames.push({ file, t: metadata.timestamp })
    try { await cdp.send('Page.screencastFrameAck', { sessionId }) } catch { /* screencast stopped */ }
  })

  log('open', url)
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  if (args.inject) await inject(page)
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: W, maxHeight: H, everyNthFrame: 1 })
  const t0 = Date.now()
  log('recording; waiting for window.__film.done')
  try {
    await page.waitForFunction(() => window.__film && window.__film.done, { timeout: 240000, polling: 500 })
  } catch (e) {
    const shot = await page.evaluate(() => (window.__film ? window.__film.shot : 'no __film (is ?film=1 wired in App.jsx? try --inject on the dev server)')).catch(() => '?')
    log('timed out waiting for the film to finish; last shot:', shot, e.message)
  }
  await new Promise(r => setTimeout(r, 400))
  await cdp.send('Page.stopScreencast').catch(() => {})
  await new Promise(r => setTimeout(r, 300))
  await browser.close()
  const wall = (Date.now() - t0) / 1000
  log(`captured ${frames.length} frames in ${wall.toFixed(1)} s, viewport ${size}`)
  if (frames.length < 2) { log('no frames captured'); process.exit(1) }

  // concat list with per-frame durations (screencast frames arrive only when something changed).
  const lines = ['ffconcat version 1.0']
  for (let i = 0; i < frames.length; i++) {
    const d = i + 1 < frames.length ? Math.max(1 / FPS / 2, frames[i + 1].t - frames[i].t) : 1
    lines.push(`file '${frames[i].file}'`, `duration ${d.toFixed(4)}`)
  }
  lines.push(`file '${frames[frames.length - 1].file}'`)
  const list = join(frameDir, 'list.txt')
  writeFileSync(list, lines.join('\n') + '\n')

  mkdirSync(dirname(out), { recursive: true })
  log('encoding mp4')
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `fps=${FPS},scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=#0a0c0b,format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' })

  // GIF: 12 fps, 960 wide, under 15 MB; step down colours and fps until it fits.
  const tries = [[12, 960, 160], [12, 960, 96], [10, 880, 96], [10, 800, 64], [8, 720, 64]]
  for (const [fps, w, colors] of tries) {
    log(`encoding gif ${w}w ${fps}fps ${colors} colours`)
    execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', out, '-vf', `fps=${fps},scale=${w}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, '-loop', '0', gifOut], { stdio: 'inherit' })
    if (statSync(gifOut).size < 15 * 1048576) break
  }

  if (!args['keep-frames']) rmSync(frameDir, { recursive: true, force: true }); else log('frames kept in', frameDir)
  const dur = durationOf(out)
  log(`mp4  ${out}  ${mb(out)}  ${isNaN(dur) ? '' : dur.toFixed(1) + ' s'}`)
  log(`gif  ${gifOut}  ${mb(gifOut)}`)
}

// The screencast captures the visible area, so the window's content area must hold all of W x H.
// A 13-inch display (1470 x 956 points) cannot fit 900 px under Chrome's toolbar, so the window is
// taken fullscreen and the viewport emulated at W x H inside it; frames then come out at 1440 x 900.
async function fitWindow(browser, page) {
  const cdp = await page.createCDPSession()
  const { windowId } = await cdp.send('Browser.getWindowForTarget')
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'fullscreen' } }).catch(() => {})
  await new Promise(r => setTimeout(r, 1500))
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 })
  await new Promise(r => setTimeout(r, 300))
  const { w, h } = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }))
  if (w !== W || h !== H) log(`warning: viewport is ${w}x${h}, wanted ${W}x${H}`)
  await cdp.detach()
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
