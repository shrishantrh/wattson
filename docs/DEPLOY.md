# Demo survival

Verified on 2026-09-19 against the production build.

## The demo has no runtime dependencies

`npm run build` bakes the engine's static export into `web/dist/api/` — 137 JSON files,
every endpoint response. The app resolves data in this order:

1. `VITE_API_BASE` (a live FastAPI server) — **optional**
2. `dist/api/**` (the baked export) — **what the demo uses**
3. `dist/fixtures/*` (contract fixtures) — last resort

**Verified with no API server running and no network:**

| Check | Result |
|---|---|
| Production build serves over plain HTTP | 200 |
| Console errors | none |
| SITE query (300 MW) | Omaha 0.737 > Phoenix 0.449 > N. Virginia 0.436, Phoenix corrected |
| GOOGL claims / caveats | 5 / 6 |
| Facilities (globe) | 7 sites |
| External network requests | **zero** |

No CDN, no Google Fonts, no map tiles. Fonts are bundled woff2, the map is local
topojson, the globe textures are local jpg. `vite.config.js` sets `base: './'`, so the
build runs from any path — a web host, a subdirectory, or a USB stick.

## Running it with everything switched off

```bash
cd web && npm run build
cd dist && python3 -m http.server 8099
```

Then open `http://localhost:8099`. That is the demo. It needs no Python packages, no
API server, no EC2, no internet. If the Voloridge instance is revoked overnight, nothing
changes — the instance only ever produced a reproducibility result, never demo data.

Keep a built `dist/` on at least two laptops before judging.

## If judges need a URL

The repository is private, so GitHub Pages requires either making it public or a paid
plan. Options, in order of reliability:

1. **Make the repo public and enable Pages** on `web/dist`. Free, permanent, no account
   needed by judges. Check first that nothing sensitive is committed — `.env` is
   gitignored and no key is in the tree, but confirm before flipping visibility.
2. **Netlify or Vercel drop-in** — drag `web/dist` onto their deploy page. No build
   config needed since everything is prebuilt and relative-pathed.
3. **A laptop on the venue network** running the command above.

Do not make the URL the primary demo path. Present from the local build and offer the
link as a leave-behind.

## What is NOT load-bearing

- **The Voloridge EC2 instance.** It produced the reproducibility timings, which are
  committed at `docs/voloridge/artifacts/ec2_run.log`. It holds nothing else.
- **The FastAPI server.** Useful in development; the demo reads the static export.
- **The OpenAI key.** Extraction already ran; its output is committed.
- **The Elastic cluster**, if it lands. Additive, on its own screen.

## Before freeze

- [ ] `npm run build` clean, `npm run check` at 0 failures
- [ ] Walk every screen against the built `dist/`, not the dev server
- [ ] Confirm `companies.json` reports `is_mock: false`
- [ ] Confirm Phoenix shows its corrected siting score, not 0.173
- [ ] Built `dist/` copied to a second machine
