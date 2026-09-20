# The Wattson film

*It follows the power, not the press release.*

A ~2 minute narrated product video, recorded automatically from the real app. The app plays
itself: `web/src/pages/Film.jsx` runs the shot list in `web/src/demo/film.js` as an overlay on
whatever route the hash shows (story slides, a fake cursor, click ripples, captions, a progress
line) and drives the live pages with real clicks and keystrokes. The narration is
`web/scripts/narrate.mjs`; the recorder is `web/scripts/film.mjs`. The script in reading order,
with per-shot timings, is `docs/narration.md`.

## Record a take

Three commands, in this order. The whole thing is about five minutes.

```bash
# 1. the app (dev server on 5174; or the built site, see "Recording against the built site")
cd /Users/shrishant/Code/hackmit/web && npm run dev

# 2. narration clips + web/src/demo/film.timing.json + docs/narration.md
node /Users/shrishant/Code/hackmit/web/scripts/narrate.mjs

# 3. record, assemble, check
node /Users/shrishant/Code/hackmit/web/scripts/film.mjs
```

**Step 2 is not optional and it is not once-off.** Re-run `narrate.mjs` every time anyone edits a
`say` line, a shot `id`, or a `holdMs` in `web/src/demo/film.js`. `narrate.mjs` stamps a
fingerprint of the shot list into `film.timing.json`, and `film.mjs` refuses to record when it no
longer matches. That is deliberate: a stale timing file is the one failure that produces a video
which looks perfect and has the narration on the wrong scenes.

While Chrome is recording, **do not touch the mouse or keyboard, and do not save any file under
`web/src`.** The fullscreen Chrome window is the one being captured, and a Vite hot update
restarts the film mid-take.

## What the flags do

`web/scripts/film.mjs`

| flag | what it does |
|---|---|
| `--url <url>` | what to record. Default `http://localhost:5174/#/?film=1` |
| `--out <path>` | the MP4. The GIF and contact sheet are written next to it. Default `docs/wattson-demo.mp4` |
| `--silent` | record with no narration; skips every timing-file check. For debugging the shot list |
| `--no-gif` | skip the GIF. It is several encoding passes and the slowest part of a run |
| `--no-sheet` | skip the contact sheet |
| `--keep-frames` | keep the captured JPEGs instead of deleting them, and print the directory |
| `--allow-hmr` | downgrade "a Vite hot update arrived mid-take" from an abort to a warning |
| `--inject` | mount `Film.jsx` through the dev server, for testing before `App.jsx` gates on `?film=1` |
| `--chrome <path>`, `--ffmpeg <path>` | override the binaries |

`web/scripts/narrate.mjs`

| flag | what it does |
|---|---|
| `--dry-run` | print every line's spoken form and exit. Synthesises nothing. Proofread here first |
| `--speak "<text>"` | print the spoken form of one arbitrary string and exit |
| `--list-voices` | list the installed voices, best narrator first |
| `--audition` | render one sample sentence in each narrator-grade installed voice, and print the paths |
| `--voice <name>` | override the voice (a macOS voice name, or an OpenAI voice) |
| `--rate <wpm>` | macOS `say` rate. Default 168 |
| `--speed <x>` | OpenAI speed multiplier. Default 1.0 |
| `--say` | force the macOS backend even when `OPENAI_API_KEY` is set |
| `--model <id>` | OpenAI model. Default `gpt-4o-mini-tts` |
| `--no-expand` | do not rewrite numbers into spoken words |
| `--dir <path>` | where the clips go. Default `<tmpdir>/wattson-film/narration` |

## Where the output lands

| file | what |
|---|---|
| `docs/wattson-demo.mp4` | 1440 x 900, 30 fps, H.264 yuv420p + AAC 160k, faststart |
| `docs/wattson-demo.gif` | silent, 960 wide, 12 fps (stepped down until under 15 MB) |
| `docs/wattson-demo-shots.png` | contact sheet: one frame per shot at the moment of its check, 3 wide, title and narration under each |
| `docs/narration.md` | the script; the recorder fills the recorded start offsets into its timing table |
| `web/src/demo/film.timing.json` | per-shot clip length + path + shot-list fingerprint. Written by `narrate.mjs`, read by both `Film.jsx` and `film.mjs` |

The narration clips themselves live outside the repo, in `<tmpdir>/wattson-film/narration`. macOS
clears that directory eventually; `film.mjs` checks every clip still exists and tells you to re-run
`narrate.mjs` if not.

## Before you trust a take

The dangerous outcome is a video that looks fine and is quietly wrong, so most of this is checked
for you. **Read the exit code first:**

- **exit 2 — abort.** The recorder refused to produce a take it could not vouch for. It prints
  `[film] ABORT:` and why. Nothing about the video is trustworthy. Causes: a stale or missing
  `film.timing.json`; the page reloaded or hot-updated during the take; no frames; the finished
  file has no audio stream, or its audio is silence; a shot with a `say` line got no clip; the
  file is implausibly short.
- **exit 1 — recorded, but some shot failed its check.** The files are written and the video is
  mechanically sound; one or more shots did not show what `expect` said they would. Read the
  PASS/FAIL table and the contact sheet.
- **exit 0 — every shot passed.**

If you pipe the output (`| tail`), the shell reports the exit code of `tail`, not of `film.mjs`.
Use `set -o pipefail`, or just read the last line of the log.

Then check by eye, in this order:

1. **The PASS/FAIL table**, and the line under it: `16 FAIL` vs `all 16 shots PASS`.
   `N shot(s) never reached their check` means the film ended early — usually a selector the film
   waits for never appeared.
2. **The audio check line**, e.g. `audio check: mean -22.9 dB, peak -4.6 dB`. Real narration sits
   around -20 to -25 dB mean. Anything near -91 dB is silence and would already have aborted.
3. **The contact sheet** (`docs/wattson-demo-shots.png`). One frame per shot: this is the fastest
   way to see a blank screen, a half-loaded chart, or a shot that is visually right but checked
   the wrong thing.
4. **The length.** The recorder warns over 135 s. The film's real length is driven by the
   narration, not by `holdMs`: each shot lasts `max(holdMs, clip + 0.6 s)`. If it runs long, the
   fix is shorter `say` lines in `web/src/demo/film.js`, not faster audio.
5. **Actually watch it**, at least the first and last fifteen seconds.

## Re-recording without redoing everything

There is no way to re-record a single shot in place. `Film.jsx` runs the shot list start to finish
in real time, and the video is one continuous screencast, so any change to a shot means another
full pass. What you can shorten:

- **Iterating on the shot list or the overlay:** `--silent --no-gif --no-sheet`. That skips the
  narration checks and both slow encode steps, so you get the PASS/FAIL table in about the length
  of the film itself.
- **Iterating on the voice only:** run `narrate.mjs` alone and listen to the clips in
  `<tmpdir>/wattson-film/narration`. No recording needed. Use `--dry-run` to proofread the spoken
  form and `--audition` to compare voices.
- **Re-encoding without re-recording:** run with `--keep-frames`; the recorder prints the frame
  directory and leaves the JPEGs and the `list.txt` concat file in it. You can re-run ffmpeg over
  that list to change the encode without replaying the film.
- **Fixing only one shot's wording:** you still need a full re-record, but do it with `--no-gif`
  first to confirm the shot passes, then one final clean run.

## The voice

`narrate.mjs` uses OpenAI text-to-speech when `OPENAI_API_KEY` is present in the environment, and
macOS `say` otherwise. It prints which one it chose, and whether the key was found, on its first
line. The key is read from `process.env` only: it is never printed, never written to a file, and
must never be committed. Do not create a `.env` for it; export it in the shell that runs the
command.

**On this machine the key is not set, so the macOS backend is what ships.** No Premium or Enhanced
voice is installed, which is why earlier takes sounded flat: `say` had nothing good to use and fell
back to Samantha. Of the voices actually installed, the default is now **Daniel** (en_GB), a
steadier documentary read than Samantha. Compare them yourself:

```bash
node /Users/shrishant/Code/hackmit/web/scripts/narrate.mjs --audition
open "$(node -e 'console.log(require("os").tmpdir())')/wattson-film/narration/audition"
```

and then pin your choice with `--voice "Karen"` (or whichever wins).

The single biggest upgrade available is a better voice asset, and it is free: **System Settings >
Accessibility > Spoken Content > System Voice > Manage Voices**, install an English (US or UK)
**Premium** voice such as Ava or Zoe (a few hundred MB). `narrate.mjs` prefers Premium and Enhanced
voices automatically, so nothing needs changing afterwards — just re-run it.

### Numbers

TTS engines mangle `8.7 GW` and read `2019` as two thousand and nineteen, which is most of what
makes synthetic narration sound wrong. `narrate.mjs` rewrites every line into spoken words before
synthesis:

| written | spoken |
|---|---|
| `8.7 GW` | eight point seven gigawatts |
| `46.5%` | forty six point five percent |
| `2019` | twenty nineteen |
| `2019-2025` | twenty nineteen to twenty twenty five |
| `6th` | sixth |
| `p. 94` | page ninety four |
| `3,814 MW` | three thousand eight hundred fourteen megawatts |
| `24/7` | twenty four seven |

It is safe on lines that are already written out in words. Check any new line with
`--speak "your sentence"`, or the whole script with `--dry-run`; a warning is printed if any digit
survives expansion. On the macOS backend it also inserts `[[slnc]]` pauses at sentence boundaries
and a short lead-in, and every clip gets a 0.3 s tail pad before its fade so the last word is never
clipped.

### Timing

`narrate.mjs` measures each finished clip and prints it against that shot's `holdMs`, flagging
every shot where the narration is longer than the hold. That is safe — `Film.jsx` stretches the
shot to `max(holdMs, clip + 0.6 s)` — but it lengthens the film, and a shot whose `holdMs` is far
under its narration is really a `holdMs` that was never updated. Raise it in `web/src/demo/film.js`
so the pacing is deliberate rather than accidental.

Do not fix a long film by speeding up the audio. Shorten the `say` line.

## Recording against the built site

Immune to hot updates, and closer to what a judge sees:

```bash
cd /Users/shrishant/Code/hackmit/web && npm run build
cd dist && python3 -m http.server 8099
node /Users/shrishant/Code/hackmit/web/scripts/film.mjs --url 'http://localhost:8099/#/?film=1'
```

## How it works

The recorder launches the installed Google Chrome headed (so the globe renders on the GPU),
fullscreen with a 1440 x 900 emulated viewport, opens the film URL, takes a CDP screencast
(JPEG 90, every frame, acked) until `window.__film.done`, then with ffmpeg
(`/opt/homebrew/bin/ffmpeg`) assembles the frames at 30 fps from a concat list carrying each
frame's real on-screen duration (the screencast only emits a frame when something changed), muxes
each narration clip at the moment its shot actually started (`window.__film.marks`), and verifies
the result with ffprobe and `volumedetect` before reporting success.

`App.jsx` mounts `<Film />` at its root when the hash carries `film=1`
(`{/[?&]film=1/.test(hash) && <Film route={route} />}`). In-app navigation drops the query, so
Film puts `film=1` back on every `hashchange` with `location.replace` (which itself fires
`hashchange`), keeping the gate true; `isFilm(hash)` from `Film.jsx` is a sticky alternative for
the gate. Film never uses the Shell: it portals onto `document.body`, sets
`document.body.dataset.film = '1'` (which hides `.demo-hud` and the tour), and exposes
`window.__film = { done, shot, total, marks, checks, errors, start() }` for the recorder.

Reloading the page restarts the film from the first shot. To watch without recording, open the
same URL; the demo HUD and the tour stay hidden while `?film=1` is set.

## Fallback: record it by hand

The in-app cursor, slides and captions are the video, so any screen recorder works:

1. Start the app and open `http://localhost:5174/#/?film=1` in Chrome, full-screen
   (`Ctrl+Cmd+F`), window at 1440 x 900 if you can. The film starts on its own 1.5 s after load.
2. Record with QuickTime: `Cmd+Shift+5`, "Record Selected Portion" over the browser, stop when
   the closing card has held for a few seconds.
3. That recording is silent. To add the narration, run `narrate.mjs`, then mux the clips at the
   offsets in `docs/narration.md`'s timing table (or simply re-run `film.mjs`, which does it).
