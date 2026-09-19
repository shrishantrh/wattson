# The Wattson film

*It follows the power, not the press release.*

A ~2 minute narrated product video, recorded automatically from the real app. The app plays
itself: `web/src/pages/Film.jsx` runs the shot list in `web/src/demo/film.js` as an overlay on
whatever route the hash shows (story slides, a fake cursor, click ripples, captions, a progress
line) and drives the live pages with real clicks and keystrokes. The narration is
`web/scripts/narrate.mjs`; the recorder is `web/scripts/film.mjs`. The script in reading order,
with per-shot timings, is `docs/narration.md`.

## Run it

```bash
# 1. the app (dev server on 5174; or the built site, see below)
cd /Users/shrishant/Code/hackmit/web && npm run dev

# 2. narration clips + web/src/demo/film.timing.json + docs/narration.md
node /Users/shrishant/Code/hackmit/web/scripts/narrate.mjs
#    with OPENAI_API_KEY in the environment it uses OpenAI TTS (gpt-4o-mini-tts, alloy);
#    otherwise macOS `say` (Samantha, rate 170). It prints which. The key is never printed.

# 3. record, assemble, check
node /Users/shrishant/Code/hackmit/web/scripts/film.mjs
```

The recorder launches the installed Google Chrome headed (so the globe renders on the GPU),
fullscreen with a 1440 x 900 emulated viewport, opens `http://localhost:5174/#/?film=1`, takes
a CDP screencast (JPEG 90, every frame, acked) until `window.__film.done`, then with ffmpeg
(`/opt/homebrew/bin/ffmpeg`) assembles the frames at 30 fps from a concat list with per-frame
durations, muxes each narration clip at the moment its shot started (`window.__film.marks`),
and writes:

| file | what |
|---|---|
| `docs/wattson-demo.mp4` | 1440 x 900, 30 fps, H.264 yuv420p + AAC 160k, faststart |
| `docs/wattson-demo.gif` | silent, 960 wide, 12 fps (stepped down until under 15 MB) |
| `docs/wattson-demo-shots.png` | contact sheet: one frame per shot at the moment of its check, 3 wide, title and narration under each |
| `docs/narration.md` | the script; the recorder fills the recorded start offsets into its timing table |

It prints a per-shot PASS/FAIL table (each shot's `expect`: a selector that must be on screen
and a text it must contain; checked at the end of the shot, retried for 2.5 s) and exits
non-zero on any FAIL, still writing the files. Flags: `--url`, `--out` (mp4 path; the gif and
sheet sit next to it), `--chrome`, `--ffmpeg`, `--silent` (no narration), `--keep-frames`,
`--inject` (mounts Film.jsx through the dev server for testing the film without the App gate).

Against the built site instead of the dev server:

```bash
cd /Users/shrishant/Code/hackmit/web && npm run build
cd dist && python3 -m http.server 8099
node /Users/shrishant/Code/hackmit/web/scripts/film.mjs --url 'http://localhost:8099/#/?film=1'
```

A run takes about 2.5 minutes of wall clock (the film plays in real time) plus ~30 s of encoding.
Do not touch the mouse or keyboard while Chrome is recording; the fullscreen Chrome window is
the one being captured.

## What the film shows

Sixteen shots in five sections (`web/src/demo/film.js`): PROBLEM (two slides: the flat 24-hour
load, then the day/night numbers ticking 37.2 → 46.5% and 40.5 → 39.7%), SOLUTION (the two
questions), HOW IT WORKS (landing, type "Google", the answer, page 4 vs page 94, the 300 MW
compare, the business-hours what-if, the nearest cleaner grid, the day/night sweep, the detector
map with the year slider), IMPACT (111 regions, four named in advance, five new leads; every
number cites its source), CLOSE. Each shot holds for max(its hold, its narration + 0.6 s), then
0.4 s of silence. Slides cross-fade over the next app screen, which loads underneath first.

Every figure on a slide or in a caption is one the app renders or one in `docs/demo_script.md`.
If the pipeline re-runs, re-read the sentences off the screen and update `film.js` and the
constants at its top (`NATIONAL`, `DETECTOR`, `SOURCES`).

## Fallback: record it by hand

The in-app cursor, slides and captions are the video, so any screen recorder works:

1. Start the app and open `http://localhost:5174/#/?film=1` in Chrome, full-screen
   (`Ctrl+Cmd+F`), window at 1440 x 900 if you can. The film starts on its own 1.5 s after load.
2. Record with QuickTime: `Cmd+Shift+5`, "Record Selected Portion" over the browser, stop when
   the closing card has held for a few seconds (about 2 min 10 s).
3. That recording is silent. To add the narration, run `narrate.mjs`, then mux the clips at the
   offsets in `docs/narration.md`'s timing table (or simply re-run `film.mjs`, which does it).

Reloading the page restarts the film from the first shot. To watch without recording, open the
same URL; the demo HUD and the tour stay hidden while `?film=1` is set.

## How it is wired

`App.jsx` mounts `<Film />` at its root when the hash carries `film=1`
(`{/[?&]film=1/.test(hash) && <Film route={route} />}`). In-app navigation drops the query, so
Film puts `film=1` back on every `hashchange` with `location.replace` (which itself fires
`hashchange`), keeping the gate true; `isFilm(hash)` from `Film.jsx` is a sticky alternative for
the gate. Film never uses the Shell: it portals onto `document.body`, sets
`document.body.dataset.film = '1'` (which hides `.demo-hud` and the tour), and exposes
`window.__film = { done, shot, total, marks, checks, errors, start() }` for the recorder.
