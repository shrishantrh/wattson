# UI audit: loading, empty, error and keyboard states

Date: 2026-09-19. App: `web/` (Vite 8, React 19), dev server at http://localhost:5174, viewport 1440x900.
Files changed: `web/src/components/States.jsx`, `web/src/components/ErrorBoundary.jsx`,
`web/src/components/QuickSearch.jsx`, `web/src/styles/states.css` (new). No export was renamed.

Method. The Browser pane was hidden the whole time, so no screenshots: every state was read from
the DOM and the accessibility tree, focus was walked with real Tab/Escape/? key presses and a
probe that reports `document.activeElement`, `:focus-visible` and the computed ring. Offline was
simulated by monkey-patching `window.fetch` to reject and `navigator.onLine` to `false` for one
navigation, then restored. The render-error fallback was exercised by mounting the boundary in a
scratch React root inside the tab with a child that throws (no page throws on bad params: Data,
Screener and Found all fall back to a default).

## States exercised

| # | State | How | What showed | Fixed or left |
|---|---|---|---|---|
| 1 | Missing company | `#/check/XYZ` | Card "XYZ": **We don't have XYZ.** and "Verified so far: Meta" as a chip. | Left. Check.jsx handles `NotFound` itself and the copy is right. Any other error on this page now goes through the new `ErrorState`. |
| 2 | Missing region | `#/region/NOPE` | Card "NOPE": **We don't have NOPE.** and "In this data source: N. Virginia" as a chip. | Left. Region.jsx gained its own `NotFoundState` (its owner, during this audit). |
| 3 | Empty compare | `#/compare?mw=300&metros=` | Not empty: the full baked demo answer (Omaha vs N. Virginia vs Phoenix, sentence, numbers, share bar) with **no place chips** in the form. The card's own "Nothing to rank yet" branch never renders because `loadSite` returns the demo fixture when `metros` is empty. | Left, not my file. Remaining issue 1. |
| 4 | Loading | any page; verified with fetch delayed 3 s on `#/found` | Before: one muted line "Loading the findings…", no role. After: three solid blocks shaped like the card (22 px sentence at 88 % width, three 26 px number blocks in the `.nums` grid, a 10 px caption), `role="status"`, `aria-live="polite"`, `aria-busy="true"`, visually hidden "Loading the findings" (1x1 px). `animation-name: none` on every block. | Fixed in States.jsx / states.css. |
| 5 | Error, online | `#/method` and `#/data` with fetch rejecting | Before: "Could not load: Failed to fetchRetry" (raw TypeError text, no separator, no way home, no role). After: `role="alert"`, one line "Could not load: the data could not be fetched." (raw message kept on `title`), `Retry` (`type="button"`) and a "Back to start" link. HTTP errors read "the server answered 500."; JSON errors "the data file is malformed". Retry with the network back restored the page. | Fixed. |
| 6 | Offline | `#/found`, `#/data`, `#/check/MSFT` with `navigator.onLine === false` | Before: identical to 5, no mention of being offline. After: `ErrorState` switches to `Offline` automatically: "You are offline. The data could not be loaded; it will retry when the connection returns." with Retry and Back to start. It subscribes to `online`/`offline`, and on `online` it calls `onRetry` by itself; verified: alert shown, `online` dispatched, page loaded with no click. | Fixed (new `Offline` export). |
| 7 | Data pages offline | `#/data` (lazy chunk), `#/found`, `#/method` (static) | The page shell, top bar and the card header render; the error sits inside the card where the content would be. Nothing goes blank. | Left as is; see remaining issue 6 for the lazy-chunk gap before the page code itself arrives. |
| 8 | Render error | boundary mounted with a throwing child | Before: fixed card, banner, Try again, Back to start; no role; every catch logged. After: `role="alert"`, banner "Something failed to render: boom from the audit", one mono line with the first frame (`Boom (<anonymous>:1:628)`), buttons Try again / Reload / Copy error and a Back to start link. Logged exactly once per error object (WeakSet); the second console line in dev is React's own. Copy error flips to "Copied" or, when the clipboard refuses (it did here: an unfocused background tab), "Copy failed". | Fixed in ErrorBoundary.jsx. |
| 9 | Palette: ⌘K, /, Esc | on `#/compare` and `#/found` | ⌘K opens with focus in the input; `/` opens when nothing is being typed in; Esc closes and focus returns to the element that had it (the top-bar button). | Works. Focus leaks out of it under Tab: keyboard findings. |
| 10 | Shortcuts sheet: ? | landing, compare | `?` opens the sheet, focus moves to the sheet (`tabindex=-1`), Esc closes and restores focus. (The harness's `type` action does not produce this key; a real key press does.) | Works. Same Tab leak as the palette. |
| 11 | Empty | `Empty` and `Pending` | Not rendered by any page today. `Pending` had no CSS at all (`.pending` exists nowhere). | Kept signatures; both now carry `.st-empty` / `.st-pending` styles. `Provisional` unchanged. |
| 12 | Top-bar search button | every non-landing page | `aria-keyshortcuts="Meta+K"` (Control+K elsewhere), `aria-haspopup="dialog"`, ring on keyboard focus only (measured after a real Tab: `0 0 0 2px rgba(255,255,255,.25)`), opens on click, Enter and Space (explicit keydown, `preventDefault` so it cannot open twice), ⌘K pressed while it is focused still goes to the palette. | Fixed in QuickSearch.jsx. |

Console: after a fresh load, counters on `console.error`, `console.warn`, `window.error` and
`unhandledrejection` stayed empty across `#/check/XYZ` and `#/region/NOPE`, and no resource
answered >= 400. The Vite "Failed to reload" 500s seen mid-audit were mine: States.jsx was written
a beat before states.css existed; they are gone after reload. The one "fetch is not a function"
seen on `#/data` was my restore step running after an HMR full reload, not the app.

## Keyboard findings

Focus order, landing (`#/`). Autofocus lands in the inline search input. Tab: Meta, Google,
Microsoft, Amazon, "300 MW: Phoenix vs Northern Virginia", "What we found in the grid data →",
then wraps to the top bar: Wattson, Data, What we found, Method, then the stage controls Zoom in,
Zoom out, 2D, night lights, then the input again. 15 stops, every one shows `var(--ring)`.
Shift+Tab from the input therefore goes to the night-lights button first, which is drawn at the
right edge mid-screen: surprising, not a trap. The "How it works" list added during the audit has
no focusable content.

Focus order, result card (`#/check/META`). Wattson, Search or ask (⌘K), Data, What we found,
Method, Zoom in, Zoom out, 2D, night lights, Copy link, Back to start (the × close), Show the
evidence, Resize column (`role="separator"`, `tabindex="0"`). 13 stops, all with rings. The
headline and numbers are static text (correct). On `#/compare` the four shape radios are named by
their visible label (the hint sits on `title`) and the "flexible 20%" chip is `aria-pressed`.

Traps and leaks. Neither dialog contains focus: from the palette input, Tab goes to the Wattson
link and then the search button while the palette stays open; from the sheet's Close button, Tab
goes to the Wattson link and Data with the sheet open. Both declare `aria-modal="true"`. Escape
works everywhere and returns focus, so nothing is stuck; the page underneath is just reachable.
No positive `tabindex` anywhere; the globe canvas is not focusable; `.stage` is `aria-hidden`.

Missing focus rings. None found on the walked pages. The only weak spot is the inline search on
the landing: `.pal-input` has `outline: none` and relies on the box border brightening
(`.pal-inline:focus-within`, 0.28 alpha), which is faint over the globe.

One flag I could not settle: the accessibility-tree tool reported the evidence toggle on
`#/compare` (`<button class="toggle"><b>Show why</b><span>▾</span></button>`) as unnamed while
the same toggle on `#/check/META` read "Show the evidence▾". The DOM text is there; check it with
VoiceOver before changing anything.

## Remaining issues in files I was not allowed to touch

1. `web/src/lib/data.js`, `loadSite`: `if (sameRequest(req, norm.request) || !req.metros.length) return norm` hands the baked demo to an empty request, so `#/compare?mw=300&metros=` is never empty. Fix: in `web/src/pages/Compare.jsx`, before the loading branch, `if (!request.metros.length)` render the card with `form` and the existing "Nothing to rank yet" note and skip the fetch (or, in data.js, return `normalizeSite({ request: req, candidates: [] }, req)` when `!req.metros.length`).
2. `web/src/components/CommandPalette.jsx`: no focus trap. Fix: in the `open` effect, `const root = document.getElementById('root'); root.inert = true; return () => { root.inert = false }` (the dialog is portaled to `body`, so it stays reachable).
3. `web/src/components/Shortcuts.jsx`: same leak from the Close button. Same `inert` toggle in its open effect.
4. `web/src/pages/Region.jsx`: the local `Skeleton()` duplicates `Loading` with inline styles and `aria-busy` but no live region. Fix: `import { Loading } from '../components/States.jsx'`, render `<Loading what={label} />`, delete `Skeleton`.
5. `web/src/components/modules/AlertsModule.jsx:30`: `<p className="mod-empty">Loading alerts…</p>` has no status role. Fix: `<Loading what="alerts" />`.
6. `web/src/App.jsx`: `<Suspense fallback={null}>` leaves the column empty while a lazy chunk (Screener, Explore, Alerts, Companies, Data) downloads. Fix: `fallback={<div className="card st-boundary"><Loading what="the page" /></div>}` (`.st-boundary` is the fixed column-position card in states.css).
7. `web/src/styles/palette.css`: add `.pal-inline:focus-within { box-shadow: var(--ring); }` so the landing input has a ring, not only a brighter border.
8. `web/src/pages/Check.jsx` and `web/src/pages/Region.jsx`: the not-found branches are plain fragments and are not announced. Fix: wrap each in `<div role="status">` (status, not alert: it is expected content).
9. `web/src/console/Console.jsx`: the stage controls sit between the top links and the column in Tab order though they are drawn at the right edge. Optional fix: move `.stage-ctl` after the column and overlay in the JSX; CSS positions it regardless.
10. `web/src/App.jsx` (pre-existing build warning): Found, Region and Method are imported both statically and through `import.meta.glob('./pages/*.jsx')`, so vite reports INEFFECTIVE_DYNAMIC_IMPORT three times. Fix: narrow the glob to the lazy pages, `import.meta.glob(['./pages/Screener.jsx', './pages/Explore.jsx', './pages/Alerts.jsx', './pages/Companies.jsx', './pages/Data.jsx'])`.

## Verification

- `oxlint -c web/.oxlintrc.json` on the three components: clean (exit 0).
- `vite build web --config web/vite.config.js --outDir <scratchpad>/audit-build`: built in 374 ms; `.st-loading` and friends are in `assets/widgets-*.css`. (Note for the integrator: the CLI takes the root as a positional argument; `--root` is not an option in Vite 8.)
- Reloaded the tab and re-checked `#/check/XYZ` and `#/region/NOPE`: same copy as above, console counters empty.
