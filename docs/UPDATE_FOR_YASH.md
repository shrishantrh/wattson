# Update for Yash (and his Claude) — the site is live

**https://shrishantrh.github.io/wattson/**

Published from `ui/shell`. Verified on the deployed site, not just "the build went green":
Omaha 0.737 / Phoenix 0.449 / N. Virginia 0.436 · GOOGL 5 claims with the p. 94 hourly series and
the SCEG caveat · `is_mock: false` · 7 facilities, 4 with no listed equity · both page crops serve ·
no console errors.

## Two things I changed on your side of the fence

1. **The repo is public now.** Full-history scan first: no `.env`, `.pem`, key-shaped strings,
   tokens, or the EC2 password in any commit. `claims/raw/` ships extracted text from published
   corporate reports (public material); the PDFs themselves stay gitignored.
2. **The dead custom domain is gone.** `shrishantrh.github.io` had a `CNAME` file pointing at
   `shrishant.me`, which Shri no longer owns, and that redirected *every* project page on the
   account to a dead host. I cleared the Pages custom domain on that repo. Side effect, a good one:
   Shri's personal site is reachable again at `shrishantrh.github.io`. If you ever re-add the
   domain, the `CNAME` file in that repo will bring the redirect back.

## It auto-deploys

`.github/workflows/pages.yml` runs on every push to `master`, `integration` or `ui/shell`.
Whichever branch was pushed last is what the live site shows; `concurrency: pages` cancels an
in-flight run so the newest always wins. So yes: push UI work, the site updates in about 90 seconds.
After the release merge, `master` takes over and nothing needs changing.

The workflow fails loudly rather than shipping something wrong. It aborts if the build log does not
say `static export synced`, if `dist/api/{regions,facilities,company/GOOGL}.json` are missing, or if
`node test/smoke.mjs` fails. A silent fall back to contract fixtures was the one failure mode that
looks fine on screen, so it is now a hard stop.

## What is on the site right now

Input-first: one box over the globe, two chip rows, a three-step "how it works". Check a company →
one sentence, three numbers, evidence on demand (the p. 4 / p. 94 card now shows **cropped images of
Google's own two pages with the lines highlighted**, click to enlarge). Compare places → ranked
answer, a load-shape what-if that re-ranks on the hours a load actually uses, nearest-cleaner-grid,
and a relocation what-if on companies ("if this site drew from Omaha instead…"). Plus the accounting
ladder: the same number under annual/market-based → the company's own hourly figure → the grid at its
sites → overnight → the share of new night generation that was clean. Screener, Explore (any two of
14 metrics, r computed over independent points only), Data sheets with CSV, alerts with tiers,
corrections shown published-beside-corrected, demo mode with a guided tour, and a 2:08 narrated
video in `docs/wattson-demo.mp4`.

## Three small things from our audits, in your files

1. `alerts.json` has `count_before_ranking == count` (14 == 14); the docs say 162 raw → 14 ranked, so
   one of the two is stale.
2. `claims/raw/` totals 354 chunks, not the 309 in the older notes. Cosmetic, but it is quoted.
3. Meta's Papillion site stores `zone: "SWPP/OPPD"` (already a full id) while other sites store a bare
   zone. Our loader handles both now, but making it consistent would be cleaner.

## If your Claude hits trouble with env vars or API keys

Paste this:

> The repo has no committed `.env` and must never have one: `.env` is gitignored and the full history
> was scanned before the repo was made public. Read every secret from `process.env` / `os.environ`
> only, never log or echo a key, never write one into a file the build or the repo can see, and never
> put one in a URL. If a key is missing, fail with a one-line message naming the variable and what it
> is for, and fall back to a mode that works without it (for example the narration script uses
> OpenAI TTS when `OPENAI_API_KEY` is set and the macOS `say` voice when it is not; the whole web app
> is static and needs no key at all). If you need a key for a build step, the build must still
> succeed without it, because GitHub Actions builds the site with no secrets configured. To use one
> locally, `export OPENAI_API_KEY=…` in the shell before running the script; do not add it to
> `web/.env`, since anything reachable from `web/` can be bundled into the public site.

## Still open

- The EC2 reproducibility run: the terminal is sitting at the password prompt on Shri's machine.
  When it finishes, `docs/ec2_runtime.csv` has the per-step and total runtime for the Voloridge
  write-up.
- Freeze time and who writes which submission.
