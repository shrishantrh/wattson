# Wattson

*It follows the power, not the press release.*

**PJM overnight clean generation has been flat within 100 MW since 2019, while overnight generation rose 8.7 GW and exports fell.**

HackMIT 2026, Voloridge "Signal in the Noise" track. Team: Yash and Shri.

A monitor for what the US grid is physically doing every hour in every balancing
authority, built on PUDL's EIA-930 tables (Voloridge dataset #6). It uses that index to
(a) detect flat 24/7 load growth from demand data alone, (b) score where new flat load
would be served cleanly, and (c) check company clean-energy claims against the grid
their facilities draw from. The spec is [docs/spec.md](docs/spec.md).

| | 2019 | 2025 |
|---|---|---|
| PJM overnight clean generation, avg MW | 35,700 | 35,619 |
| PJM overnight total generation, avg MW | 82,539 | 91,240 |
| PJM overnight carbon-free share | 0.433 | 0.390 |
| PJM overnight net export, avg MW | 3,814 | 2,489 |
| Dominion (N. Virginia) zone overnight demand, avg MW | 10,060 | 14,033 |

Overnight is 00:00–05:59 local time; daytime is 10:00–15:59. Baseline year is 2019.
The data snapshot ends 2026-09-05.

## What the data says

**All of the grid's decarbonization since 2019 happened in daylight.** Nationally,
daytime clean generation rose 61 GW (share 0.372 to 0.465) while overnight clean
generation rose 14 GW against 45 GW of overnight demand growth, so the overnight share
slipped from 0.405 to 0.397. The trailing twelve months to August 2026 read 0.484 daytime
and 0.401 overnight. These figures are consistent with EIA's published generation mix.

**In PJM, overnight got dirtier.** Overnight generation grew 8.7 GW from 2019 to 2025.
By fuel: gas +10.7 GW, coal −2.5, nuclear −0.9, wind +1.1, hydro −0.2, solar 0.0. PJM's
overnight net exports fell from 3.8 GW to 2.5 GW over the same period, so the new
overnight generation is serving PJM's own load, not its neighbors. This is consistent
with datacenter load being served by gas; part of the gas rise is coal-to-gas switching.

**The load growth sits in one zone.** Dominion Virginia's PJM zone grew average demand
32% (11.7 GW to 15.4 GW) and overnight demand 39%. The next fastest PJM zone, AEP, grew
9%; 17 of 20 zones were flat or shrinking. Dominion's roughly +4 GW overnight is about
half of PJM's overnight growth. +32% in six years far exceeds plausible demographic
growth, and overnight growing faster than average is the discriminator: residential and
EV load is peakier, not flatter.

**Same pattern elsewhere.** NYISO's overnight clean generation fell 2.3 GW after Indian
Point closed (overnight share 0.654 to 0.459). TVA and ISO-NE also lost overnight share.
ERCOT, MISO and SPP added overnight clean generation faster than overnight demand grew.

## The detector (L3)

A scoring function over demand data alone. It needs no company list: it finds flat 24/7
load from its electrical fingerprint. 111 regions scored: 68 zones from
`out_eia930__hourly_subregion_demand` and 43 balancing authorities from
`out_eia930__hourly_operations`, 2019 to 2025 calendar years, after excluding regions
under 500 MW average demand.

| component | definition |
|---|---|
| overnight excess | overnight demand growth % minus average demand growth % |
| load factor delta | mean / p99.5 demand, 2025 minus 2019 (supporting evidence only) |
| neighbor divergence | growth % minus median growth of peers (other zones in the same BA; for BAs, other BAs in the same interconnection) |
| score | z(overnight excess) + z(neighbor divergence) + 0.5 z(load factor delta), robust z (median / MAD) |

**Method frozen.** The weights, the 500 MW cut and the p99.5 peak were set before the
ranking was looked at and were not tuned to it. The four validation regions were named in
advance: Northern Virginia (PJM/DOM), central Ohio (PJM/AEP), Omaha (SWPP/OPPD) and
Dallas (ERCOT/NCEN). Ranks are reported as they came out.

| rank | region | growth % | overnight excess | LF delta | neighbor div. | score | pattern |
|---|---|---|---|---|---|---|---|
| 1 | ERCOT / North | 94.6 | 13.4 | 0.069 | 74.5 | 16.5 | flat-load growth |
| 2 | ERCOT / Far West | 116.1 | 3.1 | 0.015 | 96.0 | 13.9 | flat-load growth |
| 3 | AZPS (Phoenix) | 31.0 | 12.3 | 0.051 | 26.4 | 9.0 | flat-load growth |
| 4 | TEPC (Tucson) | 15.1 | 14.5 | 0.090 | 10.6 | 8.5 | flat-load growth |
| 5 | WACM (flagged, see below) | 52.1 | 4.9 | 0.028 | 47.5 | 8.2 | flat-load growth |
| 6 | **PJM / DOM** | 31.8 | 7.7 | 0.042 | 32.9 | 7.7 | flat-load growth |
| 7 | **SWPP / OPPD** | 39.4 | 5.6 | 0.059 | 30.9 | 6.8 | flat-load growth |
| 8 | ERCOT (whole) | 27.2 | 3.9 | 0.071 | 22.7 | 5.1 | flat-load growth |
| 9 | SC (Santee Cooper) | 28.3 | 5.4 | 0.014 | 25.0 | 5.1 | flat-load growth |
| 10 | CAISO / SDGE | 3.5 | 10.5 | 0.013 | −1.1 | 3.7 | possible midday solar suppression |
| 19 | **PJM / AEP** | 9.2 | 3.4 | 0.021 | 10.4 | 2.3 | mixed |
| 91 | **ERCOT / NCEN** | 14.2 | 1.9 | 0.029 | −12.2 | −1.3 | flat-load growth |

Validation: DOM 6th, OPPD 7th, AEP 19th, **Dallas 91st**. Dominion's load factor moved
0.628 to 0.670 (0.590 to 0.617 on raw peak, matching the hand estimate). On a 2019 to
2026 Jan–Aug basis DOM is 3rd, OPPD 6th, AEP 12th, NCEN 84th.

**The Dallas miss, and why.** NCEN grew 14%, but the median ERCOT zone grew about 26%,
so its neighbor divergence is −12: the detector penalizes zones inside a BA that is
booming overall. That is a property of the method, reported as is.

**Pattern labels** are descriptive only and do not touch the score: *flat-load growth*
(growth ≥ 10% and overnight excess > 0), *possible midday solar suppression* (growth < 5%
and overnight excess ≥ 5 points, the signature of behind-the-meter solar lowering
metered midday demand), *mixed* (everything else). Growth is shown next to the score
everywhere.

**What the detector flags.** Flat 24/7 load in general: datacenters, crypto mining,
oilfield electrification. ERCOT Far West is the Permian Basin. We say "consistent with,"
never "caused by." Regions it flags that are not known datacenter clusters are named as
findings: ERCOT North and Far West, Phoenix and Tucson, Santee Cooper.

**WACM flag.** WACM's demand rose about 1.5 GW during 2022 while its generation stayed
near 4 GW and its net exports fell from 1.5 GW to zero, with no change in interchange
partners. The data does not explain it; it could be a reporting or footprint change. It
stays in the ranking (frozen method) and is excluded from alerts.

## Siting score (L4)

Per BA: overnight carbon-free share in 2025, its change since 2019, overnight clean MW
divided by overnight demand in 2025, and the 2019 to 2025 per-year slope of that ratio.
The composite is the mean percentile across the first three (higher = new flat load
served more cleanly). No "years remaining" or capacity headroom is claimed.

| BA | overnight CF 2025 | change since 2019 | clean MW / demand | ratio slope / yr | siting rank |
|---|---|---|---|---|---|
| BPAT | 0.905 | +0.022 | 1.245 | −0.044 | 3 |
| SPP | 0.519 | +0.052 | 0.537 | +0.010 | 10 |
| Duke Carolinas | 0.593 | −0.018 | 0.657 | −0.007 | 17 |
| ERCOT | 0.413 | +0.014 | 0.417 | 0.000 | 18 |
| MISO | 0.345 | +0.025 | 0.341 | +0.007 | 24 |
| PJM | 0.390 | −0.042 | 0.408 | −0.004 | 34 |
| NYISO | 0.459 | −0.195 | 0.386 | −0.026 | 35 |

52 BAs ranked. The hand-mapped operator table (zone → utility → parent → ticker) for the
top flagged regions is in `scripts/operators_manual.json`; it is a who-serves-the-load
table, not an investment view.

## Honesty rules we hold to

- We measure generation within a footprint, not consumption. Interchange is not
  allocated, and overnight is when interchange is largest relative to load.
- Average grid mix, not marginal emissions.
- Regions are coarse. PJM spans Chicago to New Jersey. Zones report demand only and
  inherit their parent BA's generation figures; the dashboard labels this.
- "Consistent with datacenter load being served by gas," never "caused by."
- Company verdicts are "true on paper, X physically," grid-only, excluding contracted
  clean power. The facility lookup is hand-curated. `cannot_verify` is explicit.
- No backtests, no claims about stock prices.
- National figures are "consistent with EIA's published mix" unless a number is cited.

## Data traps found and handled

- **Fuel categories changed on 2024-07-01.** EIA split hydro, solar and wind into finer
  buckets. Old and new buckets are never both populated in the same hour, so summing
  parent plus children never double counts.
- **98M of 118M generation rows are empty padding.** Real data starts 2018-07-01.
- **Raw Dominion demand has two corrupt hours** in October 2021 (over a billion MWh).
  Use `out_eia930__hourly_subregion_demand` and `demand_imputed_pudl_mwh`.
- **The partner-level interchange table is unreliable for PJM before 2020.** The PJM–MISO
  tie flips sign between 2019 and 2020 and the partner sum correlates only 0.45 with
  EIA's adjusted net. The headline interchange series comes from the operations table,
  which closes generation − interchange = demand to a 7 MW median residual. Sign
  convention: positive = export from the reporting BA.
- **PJM/PL has one corrupt demand hour in 2019** (11.6 GW spike against a 7.6 GW p99.5)
  that would have given it a fake +0.18 load-factor jump; hence the p99.5 peak.
- **Small BAs that generate nothing read 0%.** Map facilities to the parent region.
- **2018 is a half year and 2026 ends 2026-09-05.** Same-months (Jan–Aug) and
  trailing-12-month series make 2026 comparable; partial months are dropped.
- **69 of 70 generating BAs have a reporting time zone** (SIKE does not, dropped).
  Arizona is America/Phoenix, no DST.

## Definitions (L1)

Carbon-free = nuclear + hydro + wind + solar + geothermal. Fossil = gas + coal + oil.
Other/unknown (biomass, waste, petcoke) counts in the denominator, not as carbon-free.
Storage (net of charging) is excluded from both sides. Small negatives are clipped to
zero. Value column: `net_generation_adjusted_mwh`, populated in all but 58 real rows.

## Running the pipeline

```bash
python3 -m venv ~/hackmit-venv && source ~/hackmit-venv/bin/activate
pip install boto3 pandas pyarrow

python3 scripts/vendor/pudl_fetch.py --output-dir data/pudl \
  --table core_eia930__hourly_net_generation_by_energy_source \
  --table core_eia930__hourly_interchange \
  --table out_eia930__hourly_operations \
  --table out_eia930__hourly_subregion_demand \
  --table core_eia__codes_balancing_authorities \
  --table core_eia__codes_balancing_authority_subregions

python3 scripts/build_wide.py          # long -> wide generation table
python3 scripts/carbon_free_index.py   # L1: hourly CF index, 70 BAs
python3 scripts/overnight_profile.py   # L2: local-time night vs day
python3 scripts/l2_temporal.py         # L2: clean MW, Jan-Aug, trailing 12
python3 scripts/l2_interchange.py      # L2: PJM interchange
python3 scripts/l3_detector.py         # L3: detector (frozen)
python3 scripts/l4_supply.py           # L4: fuel mix, siting score
python3 scripts/export_json.py         # regions.json, heatmaps, mock company card
python3 scripts/alerts.py              # alerts.json

cd dashboard && npm install && npm run dev   # static React + Plotly, no backend
```

About 375 MB of raw parquet, a few minutes per step on a laptop. `data/` is gitignored;
the exported JSON under `dashboard/public/data/` is committed.

## JSON contracts

`dashboard/public/data/regions.json` is `{"meta": {...}, "regions": [...]}`, one object per
region with `cf_share`, `cf_avg_mw`, `demand`, `detection`, `fuel_delta_overnight_gw`,
`overnight_fuel_mw`, `siting`, `interchange`, `trailing12`, `profile_24h`, `operators`,
`data_flags` and `heatmap_uri` (see docs/spec.md for the field-level schema). Zones carry
`cf_inherited_from_ba: true`. Heatmaps are `data/heatmaps/<BA>.json`, 365 × 24 for 2025 in
local time. `alerts.json` lists threshold rules with the month each was first crossed.

`claims/companies.json` is Yash's deliverable (schema in docs/spec.md). Until it lands,
the dashboard loads `claims/companies.mock.json` behind a visible MOCK DATA banner. The
mock file's claim text is illustrative; its grid evidence numbers are real L1 outputs.

## Document retrieval (Elastic Cloud)

The verified corpus is indexed as-is; retrieval never re-extracts a PDF. Configure one
of these credential pairs locally (they are intentionally not committed):

```bash
# ~/.wattson.env
ELASTIC_CLOUD_ID=...              # preferred Elastic Cloud connection form
ELASTIC_API_KEY=...
# Or, when the project setup supplies an endpoint instead:
# ELASTICSEARCH_URL=https://...elastic-cloud.com
# ELASTIC_API_KEY=...
```

```bash
pip install -r requirements.txt
python3 -m engine.retrieval --dry-run  # validates: 354 passages, 309 ESG + 45 10-K
python3 -m engine.retrieval            # create/index wattson-corpus-v1
python3 -m server
curl 'localhost:8000/api/search/status'
curl 'localhost:8000/api/search?q=100%25+renewable'
curl 'localhost:8000/api/search?q=100%25+renewable&ticker=MSFT&doc_type=10k'
```

`/api/search/status` reports corpus counts and the live `indexed` count; `/api/search`
reports `total`, score, exact source URL, and either a PDF page or an EDGAR HTML locator
for each result. `quality_flag=suspect` remains searchable for completeness but must
never be presented as a quote; `tabular` hits are numerical evidence only.

## Dashboard (L7)

`dashboard/` is a static Vite + React + Plotly site reading the JSON above. Screens:
ranked detector table (landing), region detail (365 × 24 heatmap, 24-hour profile 2019
vs 2025, night vs day trend, overnight fuel mix by year, siting score, demand and load
factor, operators), alerts with first-crossed dates, and the company watchlist with the
Talk vs Walk chart. Every table has a CSV export button.

## Repo layout

Shri: `scripts/`, `dashboard/`. Yash: `claims/`. Raw and processed data live in `data/`
(not committed). Voloridge's original fetch script is vendored in `scripts/vendor/`.
