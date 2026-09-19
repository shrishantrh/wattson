# Wattson dashboard

Static Vite + React + Plotly site. No backend. Reads `public/data/regions.json`,
`public/data/heatmaps/<BA>.json`, `public/data/alerts.json` (all produced by
`scripts/export_json.py` and `scripts/alerts.py` at the repo root) and
`public/claims/companies.json` or, if that is absent, `companies.mock.json` behind a
MOCK DATA banner. `npm run dev` and `npm run build` first copy `../claims/*.json` into
`public/claims/` (see `sync-claims.mjs`), so Yash's file shows up without any code change.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/, relative paths, host anywhere
```

Pages: `#/` ranked detector table · `#/region/<id>` detail · `#/alerts` · `#/companies` ·
`#/operators` · `#/about`. Every chart has a Table toggle and a CSV button.
