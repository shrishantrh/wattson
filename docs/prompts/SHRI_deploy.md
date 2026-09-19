# Brief for Shri — publish the demo so judges can open it

## Situation

The production build is verified to work with **no API server, no network and no console
errors**. `vite.config.js` already sets `base: './'`, so the build runs from any path.
`npm run build` bakes the engine's static export into `dist/api/` — 137 JSON files,
every endpoint response. 174 files, 13 MB total, zero external requests: fonts are
bundled woff2, the map is local topojson, the globe textures are local jpgs.

So there is nothing to configure. The only blocker is that
`github.com/shrishantrh/wattson` is **private**, and GitHub Pages on a private repo needs
a paid plan.

## Before making anything public — check this first

```bash
git log --all --diff-filter=A --name-only --pretty=format: | sort -u | grep -iE '\.env|\.pem|secret|credential|key' 
git grep -iE 'sk-[a-zA-Z0-9]{20}|AKIA[0-9A-Z]{16}|BEGIN (RSA|OPENSSH|PRIVATE)' $(git rev-list --all) 2>/dev/null | head
```

`.env` is gitignored and no key should be in the tree, but **check the full history, not
just the working copy** — a secret committed and later deleted is still public once the
repo is. If anything turns up, do not flip visibility; tell Yash.

Also worth a look: `claims/raw/` holds extracted text from published corporate reports.
That is public material and fine, but be deliberate rather than surprised.

## Then, the deploy

Repo settings -> General -> Change visibility -> Public. Then a workflow:

```yaml
# .github/workflows/pages.yml
name: pages
on:
  push:
    branches: [master]
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: npm, cache-dependency-path: web/package-lock.json }
      - run: npm ci
        working-directory: web
      - run: npm run build          # predev/prebuild runs sync-fixtures.mjs
        working-directory: web
      - uses: actions/upload-pages-artifact@v3
        with: { path: web/dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: '${{ steps.d.outputs.page_url }}' }
    steps:
      - id: d
        uses: actions/deploy-pages@v4
```

Then Settings -> Pages -> Source: GitHub Actions.

**One thing to verify in CI:** `sync-fixtures.mjs` copies from `../server/static_export/`,
which is committed, so the Action needs no Python. Confirm the build log prints
`static export synced` — if it prints `no server/static_export yet`, the app will fall
back to fixtures and the deployed site will show contract samples instead of real data.
That failure is silent and looks fine on screen.

## Verify the deployed site, not just that it deployed

Open the Pages URL and check:

- **SITE query** ranks Omaha 0.737 > **Phoenix 0.449** > N. Virginia 0.436. If Phoenix
  reads **0.173** the corrections overlay did not reach the build — that is the
  uncorrected AZPS number and it contradicts our own correction screen.
- **`/#/check/GOOGL`** shows 5 claims, the first being the hourly-CFE table
  (65 / 64 / 64 / 66 / 65 on p94), and a caveats block mentioning SCEG.
- **Companies report `is_mock: false`** — no MOCK banner.
- **The globe has pins** — `api/facilities.json` present, 7 sites.
- Browser console is clean.

## Keep the local path as the primary demo

Do not present from the URL. Present from a local build:

```bash
cd web && npm run build && cd dist && python3 -m http.server 8099
```

That needs no internet and no backend. The Pages URL is the leave-behind, and insurance
if a laptop dies. Have a built `dist/` on two machines before judging.

Full detail in `docs/DEPLOY.md`.
