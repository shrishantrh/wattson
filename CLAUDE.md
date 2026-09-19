# Wattson (HackMIT 2026)

*It follows the power, not the press release.*

Wattson computes the hourly carbon-free share of generation for every US balancing
authority (BA) from EIA-930 via PUDL, and uses it to detect where flat 24/7 load (the
AI datacenter buildout) is landing and what is being burned to serve it. A demand-only
detector scores 111 regions, a siting score says where new flat load would be served
cleanly, and a company watchlist checks clean-energy claims against the grid the sites
actually use. Headline: PJM overnight clean generation has been flat within 100 MW since
2019 while overnight generation rose 8.7 GW and exports fell.

The project was called "Grid Truth"; the rename to Wattson has NOT been done in code,
README, docs, or the dashboard yet. Full spec: `docs/spec.md` (the Amendments block at
the top overrides the body). `docs/GRID_TRUTH_SYNC.md` is older background.

**Deadline: 11:00am Sunday, September 20, 2026.**

## Layer status

| Layer | Status | Script(s) |
|---|---|---|
| L0 data acquisition | done | `scripts/vendor/pudl_fetch.py` (Voloridge's fetch script) |
| L1 grid index, 70 BAs, 4.45M hourly rows | done, verified vs EIA mix | `scripts/build_wide.py` then `scripts/carbon_free_index.py` |
| L2 temporal (night vs day, clean MW, Jan–Aug, trailing 12, PJM interchange) | done | `scripts/overnight_profile.py`, `scripts/l2_temporal.py`, `scripts/l2_interchange.py` |
| L3 flat-load detector, 111 regions | done, FROZEN | `scripts/l3_detector.py` |
| L4 fuel decomposition + siting score | done | `scripts/l4_supply.py` |
| L5 claim extraction (Yash) | not started | `claims/` |
| L6 verification, Talk vs Walk (Yash) | not started | `claims/companies.json` is the deliverable |
| L7 dashboard | done, about to be restructured | `dashboard/` (Vite + React + Plotly, static) |
| export + alerts | done | `scripts/export_json.py`, `scripts/alerts.py` |

Hand-mapped operator table: `scripts/operators_manual.json`. Screenshots: `docs/screenshots/`.

## Frozen decisions (do not re-tune)

- **Detector method.** score = z(overnight_excess) + z(neighbor_divergence) + 0.5 z(load_factor_delta),
  robust z (median/MAD); regions under 500 MW average demand excluded; peak = 99.5th
  percentile hour (PJM/PL has one corrupt hour in 2019). Weights and cuts were set before
  the ranking was seen. Validation regions named in advance: PJM/DOM (6th), PJM/AEP (19th),
  SWPP/OPPD (7th), ERCO/NCEN (91st). The Dallas miss is reported as is: neighbor divergence
  penalizes a zone inside a BA that is booming overall.
- **Pattern labels are descriptive only** and never touch the score: "flat-load growth"
  (growth >= 10% and overnight excess > 0), "possible midday solar suppression" (growth < 5%
  and overnight excess >= 5 pts), else "mixed". Growth is shown next to score everywhere.
- **WACM is flagged and excluded from alerts** (demand +1.5 GW during 2022 with flat
  generation and exports falling to zero; unexplained). It stays in the ranking.
- **Language:** "consistent with datacenter load being served by gas", never "caused by".
  The detector flags flat load in general (datacenters, crypto, oilfield electrification).
- **Siting score replaces capacity headroom** (spec Amendment 2): overnight CF share 2025,
  change since 2019, overnight clean MW / overnight demand, plus the 2019–2025 per-year
  slope of that ratio. Slope only. No "years remaining", no nameplate headroom.
- **Zones inherit the parent BA's generation figures** (`cf_inherited_from_ba: true`); zones
  have demand only. All shares are 0–1 fractions everywhere (JSON, CSV, README).
- **PJM overnight net export:** 3,814 MW (2019) and 2,489 MW (2025), from the EIA-adjusted
  operations table (positive = export). The partner-level interchange table is unreliable for
  PJM before 2020 (PJM–MISO tie sign flips); use it only for the 2020+ breakdown.
- Carbon-free = nuclear + hydro + wind + solar + geothermal. Other/unknown in the
  denominator only. Storage excluded. Overnight = 00:00–05:59 local, daytime = 10:00–15:59.
  Baseline year 2019. Data snapshot ends 2026-09-05; partial months are dropped from
  trailing-12 series; 2026 comparisons use Jan–Aug same-months.

## How to run

Python venv is `~/hackmit-venv` (boto3, pandas 3, pyarrow). Always use it; system pip is
externally managed. `data/` is gitignored: on a new machine re-fetch (about 375 MB).

```bash
source ~/hackmit-venv/bin/activate
python3 scripts/vendor/pudl_fetch.py --output-dir data/pudl \
  --table core_eia930__hourly_net_generation_by_energy_source \
  --table core_eia930__hourly_interchange \
  --table out_eia930__hourly_operations \
  --table out_eia930__hourly_subregion_demand \
  --table core_eia__codes_balancing_authorities \
  --table core_eia__codes_balancing_authority_subregions
python3 scripts/build_wide.py && python3 scripts/carbon_free_index.py
python3 scripts/overnight_profile.py && python3 scripts/l2_temporal.py && python3 scripts/l2_interchange.py
python3 scripts/l3_detector.py && python3 scripts/l4_supply.py
python3 scripts/export_json.py && python3 scripts/alerts.py
cd dashboard && npm install && npm run dev      # http://localhost:5173
```

Run scripts from the repo root. Each step takes a few minutes. Exported JSON lives in
`dashboard/public/data/` and IS committed; heatmaps are `data/heatmaps/<BA>.json`
(365 x 24, 2025, local time). `npm run dev` / `npm run build` first copy `claims/*.json`
into `dashboard/public/claims/` (`dashboard/sync-claims.mjs`).

## Repo layout and ownership

- Shri (this machine): `scripts/`, `dashboard/`, `docs/`, README.
- Yash: `claims/`. He delivers `claims/companies.json` (schema in `docs/spec.md`). Until it
  exists the dashboard loads `claims/companies.mock.json` behind a visible MOCK DATA banner;
  the mock's claim text is illustrative, its grid evidence numbers are real.
- Remote: github.com/shrishantrh/grid-truth (private). Commit after each step, push when
  something works. Never put credentials in the repo.

## Known open issues

- **AZPS generation break.** Overnight clean share reads ~0.15 in 2025 vs 0.62 in 2019,
  almost certainly a reporting change, not a real collapse. Its demand-side detector rank
  (3rd) is fine; treat its generation-side numbers with suspicion until checked.
- **105 active alerts is too noisy.** Half are "record high" hits. Needs prioritization or
  tighter thresholds before it is a demo screen.
- **Operator tickers unverified**, especially TXNM (Texas-New Mexico Power) and FTS (Tucson
  Electric via Fortis). Hand-mapped; a human must check before judging.
- `pjm_zone` in the companies schema should be renamed `zone` (dashboard reads `pjm_zone`).
- EC2 reproducibility run (spec Amendment 1) not done; record runtime for the write-up.
- Write-ups (Voloridge, Arrowstreet) not started.
- Frontend is about to be restructured from a dashboard into an investigation UI.

## Honesty rules (condensed from docs/spec.md)

- We measure generation within a footprint, not consumption. Interchange is not allocated.
- Average grid mix, not marginal emissions. Regions are coarse (PJM spans Chicago to NJ).
- Dominion's ~+4 GW overnight is about half of PJM's overnight growth. Say half, not all.
- Company verdicts are "true on paper, X physically", grid-only, excluding PPAs. Never
  "they lied". `cannot_verify` is explicit and counted on screen. Lookup is hand-curated.
- National figures are "consistent with EIA's published mix" unless a number is cited.
- No backtests, no stock-price claims. Name the utilities serving rising load and stop.
- Dominion growth vs population: +32% in six years exceeds demographics, and overnight
  growing faster than average is the discriminator (residential/EV load is peakier).
