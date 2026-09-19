# Wattson web

The investigation UI: a static Vite + React + Plotly site with a three.js night globe. No
backend at demo time. `dashboard/` is the older dashboard and stays as the fallback.

```bash
npm install
npm run dev      # http://localhost:5174
npm run build    # static site in dist/, relative paths, host anywhere
```

Routes: `#/` opening (PJM finding, night globe, day/night sweep, detector map) ·
`#/verify/<TICKER>` claims vs. physics · `#/site` where 300 MW of flat load is served
cleanly · `#/region/<id>` evidence view · `#/method` caveats.

Data: `npm run dev` and `npm run build` copy fixtures into `public/fixtures/`
(`sync-fixtures.mjs`): Yash's contract fixtures in `../fixtures/` when present, otherwise
`fixtures.provisional/`, which is reshaped from `dashboard/public/data/regions.json` by
`fixtures.provisional/_generate_provisional.py`. Same file names win, so the engine's real
files replace the provisional ones with no code change. Set `VITE_API_BASE=http://host:port` to read
the live endpoints instead (`/api/opening`, `/api/region/{id}`, `/api/company/{ticker}`,
`POST /api/site`).

Demo mode: press `d`, then `→` / `←` to step through the scripted scenes (`src/demo/scenes.js`).

Layout: `src/styles/tokens.css` is the only place colors and type live. `src/globe/` is the
globe (WebGL, with a 2D fallback when WebGL or frame time is poor). `src/charts/` are the
Plotly builders ported from the dashboard. `src/lib/findings.js` generates every screen
title from the numbers on that screen.
