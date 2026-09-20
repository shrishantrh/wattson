# Pitch numbers: every claimable figure, traced

Verified 2026-09-19 (late) against the files the product actually serves, read-only. No
pipeline script was re-run. Sources, in order of authority:

- `api/` = `web/public/api/` — what the live site serves. **This is the authority for anything on screen.**
- `dash/` = `dashboard/public/data/regions.json` and `alerts.json` — the pipeline export.
- `parquet` = `data/processed/hourly_cf_index.parquet` — gitignored, local only.
- `README.md`, `CLAUDE.md`, `docs/numbers_checklist.md` — prose, **not** authority. Where
  prose and `api/` disagree, `api/` wins and the prose is the error.

Status: **MATCHES** · **DIFFERS** (do not speak as stated) · **UNVERIFIABLE** (a figure that
cannot be traced to data is a figure that must not be spoken).

**52 figures checked. 43 MATCH. 7 DIFFER. 2 were previously untraceable and are now traced.**

---

## 1. DIFFERS — fix or drop before stage

| # | Figure as stated | Verified value | Source / computation | Why it differs |
|---|---|---|---|---|
| D1 | "Phoenix fell from 62% to 10%" (as a real decline) | 62% was **never real**. Like-for-like, AZPS overnight clean **rose 1.7% → 10.4%** | `api/region/AZPS.json` region.corrections.corrections[0]: `cf_share.2019.overnight` published 0.620, corrected **0.017**; 2025 = 0.104, uncorrected | Palo Verde nuclear was reported by AZPS **and** SRP simultaneously until 2019-12-04 (r = 0.9948 over 7,976 hours; identical within 5 MW in 98.8%; combined 7,087 MW against a 3,937 MW nameplate). Confidence tier: **proven**. Say "a double count we caught", never "it collapsed". |
| D2 | Compare ranks Omaha 1st, N. Virginia 2nd, Phoenix 3rd (worst) | The shipped preset ranks **Omaha 1st (0.737), Phoenix 2nd (0.449), N. Virginia 3rd (0.436)** | `api/site/300mw-phoenix-nova-omaha.json` candidates[].verdict_rank / siting_score | The AZPS correction is applied at serve time: published siting_score 0.173 → corrected **0.449**, rank 49 → **32**. `dash/regions.json` still says 0.173 / 49. Any line implying Phoenix is the worst of three will be contradicted by the screen. Phoenix's *level* is still 10.4% — only its direction was corrected. |
| D3 | `alerts.json` `count_before_ranking` = 14 | Raw alerts are **162** (105 active); ranked output is **14** | `api/alerts.json` count=14, count_before_ranking=14; `dash/alerts.json` `alerts` length 162, 105 with `active: true` | Known bug (docs/UPDATE_FOR_YASH.md item 1). The ratio to speak is **162 raw → 14 ranked** (or "105 active → 14"), not "14 → 14". Do not say "we cut 162 to 14" while pointing at a field that says 14. |
| D4 | `api/alerts.json` `excluded_regions: []` | WACM **is** excluded by frozen decision; `dash/alerts.json` `excluded_regions: ["WACM"]` | both files | WACM does not appear in the 14, so behaviour is right and provenance is wrong. Do not claim on stage "the export names the region we excluded" — this one does not. |
| D5 | CLAUDE.md: "AZPS overnight clean share reads ~0.15 in 2025" | **0.104** (2025); 0.117 (2024) | `api/region/AZPS.json` cf_share.2025.overnight | Stale note in CLAUDE.md. Never say 0.15. |
| D6 | README: "the next fastest PJM zones, EKPC and AEP, grew 11% and 9%; the other 16 of 19 grew under 3%" | Correct as written for 19 zones — but **13 of 19 shrank** | computed from `dash/regions.json`: PJM/DOM 31.8, PJM/EKPC 11.0, PJM/AEP 9.2, PJM/ATSI 2.5, PJM/PL 2.2 | Not an error, but the checklist's DISC 10 ("17 of 20") is the stale version. Use 19 zones, 16 under 3%, 13 shrinking. |
| D7 | "Dominion's ~+4 GW overnight is about half of PJM's overnight growth" | +3,973 MW = **45.7% of PJM's overnight *generation* growth** (8,701 MW), but **60.6% of PJM's overnight *demand* growth** (6,560 MW) | `dash/regions.json` PJM/DOM demand[2019/2025].overnight_avg_mw (10,060 → 14,033); PJM total_avg_mw overnight (82,539 → 91,240); PJM demand overnight (80,643 → 87,203) | "About half" is true only against generation. Say which, or say "roughly half of the extra power PJM generates at night now goes to one zone." |

---

## 2. MATCHES — safe to speak exactly as stated

### 2.1 PJM, the headline

| Figure as stated | Verified | Source / computation |
|---|---|---|
| PJM overnight clean generation 35,700 MW (2019) → 35,619 MW (2025) | 35,700.0 / 35,619.0 | `api/region/PJM.json` cf_avg_mw.2019.overnight, .2025.overnight |
| "flat within 100 MW since 2019" | **−81 MW**, 0.23% of the 2019 level | 35,619 − 35,700 |
| Overnight generation rose 8.7 GW | 91,240 − 82,539 = **8,701 MW** | `api/region/PJM.json` total_avg_mw overnight |
| Gas supplied 10.7 GW of it | gas **+10.74 GW** | `api/region/PJM.json` fuel_delta_overnight_gw.gas |
| Fuel deltas close | nuclear −0.95, hydro −0.22, wind +1.07, solar +0.01, gas +10.74, coal −2.52, oil +0.15, other +0.41 → **sum +8.69 GW** vs total +8.70 | same field; closure check |
| Overnight net export 3,814 MW (2019) → 2,489 MW (2025) | 3,814.0 / 2,489.0 | `api/region/PJM.json` interchange.2019/.2025.overnight_net_export_mw (EIA-adjusted operations table, positive = export) |
| PJM overnight carbon-free share 0.433 → 0.390 | 0.433 / 0.390 | `api/region/PJM.json` cf_share overnight |
| **Of the 8.7 GW PJM added at night, none was clean — clean fell 81 MW.** Increment share **−0.9%** | −81 / 8,701 = −0.0093 | recomputed from `overnight_fuel_mw` 2019 vs 2025, clean = nuclear+hydro+wind+solar+geothermal: 35,700 → 35,619 clean; 82,539 → 91,241 total |

### 2.2 Dominion / Northern Virginia

| Figure as stated | Verified | Source |
|---|---|---|
| Dominion zone average demand +32% in six years | 15,395 / 11,681 − 1 = **+31.8%** | `api/region/PJM%2FDOM.json` demand[2019/2025].avg_mw; 11.7 GW → 15.4 GW |
| Overnight demand +39% | 14,033 / 10,060 − 1 = **+39.5%** | same, overnight_avg_mw |
| Overnight demand 10,060 MW → 14,033 MW | exact | same |
| Detector: score 7.71, overnight excess 7.7 pts, neighbour divergence 32.9, LF delta 0.042 | exact | `api/region/PJM%2FDOM.json` detection |
| N. Virginia 39% clean at night, getting worse | 0.390; change_since_2019 **−0.042** | `api/region/PJM.json` cf_share.2025.overnight, siting.change_since_2019 (inherited by the zone) |

### 2.3 The detector

| Figure as stated | Verified | Source |
|---|---|---|
| 111 regions scored | **111**, ranks 1..111 contiguous | `api/regions.json` meta.n_scored and count; recounted from `dash/regions.json` |
| Composition: 68 zones + 43 BAs | exact | counted by `type` over ranked regions |
| Four validation regions named in advance | `["PJM/DOM","PJM/AEP","SWPP/OPPD","ERCO/NCEN"]` | `api/regions.json` meta.validation_named_in_advance |
| Northern Virginia **6th** | PJM/DOM rank 6, score 7.71, growth 31.8 | `api/region/PJM%2FDOM.json`; label "N. Virginia" in `web/src/data/region_coords.json` |
| Omaha **7th** | SWPP/OPPD rank 7, score 6.82, growth 39.4 | `api/region/SWPP%2FOPPD.json`; label "Omaha" |
| Central Ohio **19th** | PJM/AEP rank 19, score 2.29, growth 9.2, pattern "mixed" | `api/region/PJM%2FAEP.json`; coords label **"Columbus OH"**, place "Columbus, Ohio area (AEP zone: OH/IN/WV/VA/KY)" |
| Dallas **91st** | ERCO/NCEN rank 91, score −1.32, growth 14.2 | `api/region/ERCO%2FNCEN.json`; coords label "Dallas", place "Dallas–Fort Worth (ERCOT North Central)" |
| 500 MW exclusion cut | **holds**: 13 regions unranked, largest excluded is IID at 434 MW; smallest ranked is TPWR at 518 MW | `dash/regions.json` demand[2025].avg_mw over ranked vs unranked |
| Method string, frozen | "score = z(overnight_excess) + z(neighbor_divergence) + 0.5 z(load_factor_delta), robust z; 500 MW cut; p99.5 peak; frozen before results" | `api/regions.json` meta.detector_method |
| Top 5: ERCO/NRTH +94.6, ERCO/FWES +116.1, AZPS +31.0, TEPC +15.1, WACM +52.1 | exact, scores 16.47 / 13.89 / 9.01 / 8.51 / 8.24 | `dash/regions.json` detection |

### 2.4 Scale of the data — **now traced, previously untraceable**

| Figure as stated | Verified | Source |
|---|---|---|
| 4.45 million hourly rows | **4,451,763** | recomputed: `len(pd.read_parquet('data/processed/hourly_cf_index.parquet'))` |
| 70 balancing authorities | **70** | same file, `ba.nunique()` |
| Date range 2018–2026 | **2018-07-01 05:00 UTC → 2026-09-05 07:00 UTC** | same file, `datetime_utc` min/max |
| Snapshot ends 2026-09-05 | exact | `api/index.json` generated_from.data_snapshot_end; `api/regions.json` meta.data_snapshot_end |

**Caveat that must travel with these two.** They are reproducible but they live only in a
**gitignored local parquet**, not in any committed JSON. They are safe to speak, and if a judge
asks for the field, the honest answer is "it's the row count of the L1 index; the published
JSON carries the 124 regions built from it, not the raw rows."

**And say "balancing authorities", not "grid regions".** The three counts are different and a
judge who notices will think one is wrong:

- **70** balancing authorities in the raw hourly index (parquet)
- **124** published regions = 56 BAs + 68 zones (`api/index.json`: "124 ids")
- **111** regions scored by the detector = 43 BAs + 68 zones

"An hourly clean-power index for 70 balancing authorities from 4.45 million rows; 111 regions
scored" is all three, correctly.

### 2.5 National

| Figure as stated | Verified | Source |
|---|---|---|
| 47% clean by day, latest complete year | 2025 daytime **0.465** → 47% | `api/regions.json` meta.national.cf_share.2025.daytime |
| 40% clean at night, latest complete year | 2025 overnight **0.397** → 40% | same, .overnight |
| Day 37% in 2019 | 0.372 | meta.national.cf_share.2019.daytime |
| Night 40.5% in 2019 (spoken as "40") | 0.405 | same, .overnight |
| "Cleaner by day, stood still at night" | day **+9.3 pts**, night **−0.8 pts** | 0.465−0.372; 0.397−0.405 |
| Daytime clean generation rose 61 GW | 239,533 − 178,129 = **61,404 MW** | meta.national.cf_avg_mw |
| Overnight clean rose 14 GW | 173,380 − 159,031 = **14,349 MW** | same |
| "against 45 GW of overnight growth" | 437,303 − 392,186 = **45,117 MW** | meta.national.**total_avg_mw** — this is **generation**, not demand. Say "overnight generation", not "overnight demand". |
| Trailing 12 to 2026-08: 0.401 night / 0.484 day | exact, last element of the series | meta.national.trailing12 |

### 2.6 Companies — every displayed figure

Totals: **4 companies · 7 facilities · 10 claims · 9 true_on_paper · 1 cannot_verify · is_mock false.**
Verified by counting `api/company/*.json` claims and against `api/companies.json` and
`api/facilities.json` (count 7).

| Company | Claimed | Physical (grid, 2025, all hours) | Gap | Sites | cannot_verify | Source |
|---|---|---|---|---|---|---|
| Alphabet (Google) | **100%** (p. 4, annual, market-based) | **5.6%** (SC / Santee Cooper) | **94.4 pts** | 1 | 0 | `api/company/GOOGL.json`; walk_score 0.056; talk_score 0.405 |
| Meta Platforms | **100%** (p. 18, annual, market-based) | **60.3%** (range 45.6–75.0) | 39.7 pts | 2 | 0 | `api/company/META.json`; PACW 0.750, SWPP 0.456 |
| Microsoft | **100%** (p. 6, annual, market-based) | **64.2%** (range 28.5–100) | 35.8 pts | 2 | 0 | `api/company/MSFT.json`; GCPD 1.000, AZPS 0.285 |
| Amazon | **no falsifiable claim extracted** | 39.3% | — | 2 | **1** | `api/company/AMZN.json`; kind `no_finding`, reason `no_falsifiable_content`; talk_score is `null` |

Every `cf_share_2025` above equals `cf_share[2025].all` in `dash/regions.json` for that BA —
8 of 8 checked, all exact (PACW 0.750, SWPP 0.456, GCPD 1.000, AZPS 0.285, SC 0.056, PJM 0.393 ×2).

| Other company figures | Verified | Source |
|---|---|---|
| Google's own page-94 hourly CFE: 65, 64, 64, 66, 65 | exact, years 2021–2025 | `api/company/GOOGL.json` claims[0].evidence[1].**values** = [65,64,64,66,65] |
| Google's "37% annual increase in electricity demand" (p. 4) | present verbatim | same file, claims[3].evidence |
| SCEG 42% (V.C. Summer backup) | **0.421** | `api/region/SCEG.json` cf_share.2025.all |
| PacifiCorp West generates 797 MW against 2,311 MW demand = 34% | 797 / 2,311 = **0.345** | `api/region/PACW.json` total_avg_mw.2025.all, demand.2025.avg_mw |
| "9 of 10 claims true on paper, 1 we can't verify" | exact | counted across all four company files |

### 2.7 Compare: 300 MW, Phoenix / Northern Virginia / Omaha

| Figure as stated | Verified | Source / computation |
|---|---|---|
| Omaha 52% clean at night, improving | 0.519; ratio_slope +0.0101/yr; change since 2019 **+5.2 pts** | `api/site/300mw-phoenix-nova-omaha.json` candidates[0].components; `api/region/SWPP.json` |
| N. Virginia 39% at night, getting worse | 0.390; slope −0.0044; change **−4.2 pts** | candidates[2].components; `api/region/PJM.json` |
| Phoenix 10% at night | 0.104 | candidates[1].components.level_overnight_cf_share_2025 — **not corrected**, the level is real |
| **144 MW** fossil at 300 MW, Omaha | 300 × (1 − 0.519) = **144.3** | arithmetic; spoken in `web/src/demo/tour.js` |
| **269 MW** fossil at 300 MW, Phoenix | 300 × (1 − 0.104) = **268.8** | arithmetic |
| 183 MW fossil, N. Virginia | 300 × (1 − 0.390) = **183.0** | arithmetic |
| "40 MW more fossil every hour" (Omaha vs N. Virginia) | 183.0 − 144.3 = **38.7** | arithmetic; `web/src/demo/film.js` |
| Your load as a share of night demand: Omaha 17.8%, N. Virginia 2.1%, Phoenix 7.1% | 300/1,682; 300/14,033; 300/4,221 | zone `demand[2025].overnight_avg_mw` |
| Omaha's growth was filled by wind +4.2 GW | wind **+4.16 GW** (largest positive) | candidates[0].fuel_delta_overnight_gw |
| Siting: 52 BAs ranked | **52**, single value across every region | `siting.n_ranked` |

---

## 3. UNVERIFIABLE — do not speak these as measurements

A figure that cannot be traced to data is a figure that must not be spoken. These may be
spoken only as what they are, labelled out loud.

| Figure | Why it cannot be verified | Say instead |
|---|---|---|
| "Half a datacenter's power is used at night" | Not measured. Overnight is 6 of 24 hours; this is a framing of flat load. | "A flat 24/7 load draws the same megawatt at 3am as at noon" |
| Operator tickers (D, PNW, BRK.B, TXNM, FTS) | Hand-mapped in `scripts/operators_manual.json`, no source field. CLAUDE.md flags TXNM and FTS as unverified. | "who serves the load, hand-mapped" |
| Site → utility → BA mappings | Hand-curated. Some rows are `source_type: press` or `inferred`, `source_url: null`. | "hand-curated from serving utilities, never inferred from state" |
| All lat/lng and place labels (`region_coords.json`, `metros.json`) | Hand-placed; `_uncertain` lists six the author was unsure of (WAUW, SWPW, SWPP/SECI, PJM/AP, MISO/0027, SWPP/CSWS). | — |
| "Consistent with EIA's published mix" | Assertion in `meta.national.note`. No EIA-published number is cited or compared anywhere in the repo. | Say it as an assertion, and do not cite a specific EIA figure |
| The *reason* for the AZPS 2019-12-04 step | `api/regions.json` corrections.confidence_tiers.not_established: why it happened on that date is not established. | "corrected on a single date; why, we don't know" |
| That the plant is Palo Verde | Tier `high_confidence_inference` — not confirmed against EIA-860 plant data. | "the only nuclear station in Arizona, magnitude matches the nameplate" |
| Corrected AZPS siting rank 32 | Tier `high_confidence_inference`, `approximate: true`, reproduces 41 of 52 published ranks. | "about 32, plus or minus 2" |
| "354 chunks in claims/raw" | Cosmetic count in prose, not checked here. | don't quote it |
| EC2 reproducibility runtime | Not run; `docs/ec2_runtime.csv` does not exist. | "it's a static export; anyone can rerun the six scripts" |

---

## 4. Traps: technically correct, easy to say wrong

| # | The wrong sentence | The right sentence | Why |
|---|---|---|---|
| T1 | "Northern Virginia's grid is 39% clean at night." | "The grid serving Northern Virginia — PJM, Chicago to New Jersey — is 39% clean at night. The zone reports demand only." | Zones have **demand only** and inherit the parent BA's generation (`cf_inherited_from_ba: true`). The same applies to Omaha: 52% is **SPP-wide**, not Omaha's own. |
| T2 | "Phoenix's clean power collapsed from 62% to 10%." | "Phoenix reads 10% clean at night. The 62% in 2019 was a double count — a nuclear plant booked twice — and corrected, Phoenix actually rose from 2%." | See D1. The 2025 *level* (10.4%) is sound; the 2019 baseline and every delta from it were not. AZPS's demand-side rank (3rd) was never affected. |
| T3 | "Phoenix is the worst of the three places to build." | "Phoenix is the dirtiest of the three tonight, but it's the only one improving — so the siting score puts it second." | See D2. The screen ranks Phoenix 2nd. Level and direction disagree, and the product says so. |
| T4 | "Google's data centre runs on 6% clean power." | "The Santee Cooper grid that serves Google's Moncks Corner site generated 5.6% carbon-free in 2025. That's the footprint, not the meter — and Santee Cooper's share of V.C. Summer nuclear reports under a different authority (SCEG, 42%), so this understates what's available to the site." | `api/company/GOOGL.json` sites[0].note says "Never present 0.056 without this caveat." |
| T5 | "Meta's Prineville site is 75% clean." | "The grid there generated 75% clean — but PacifiCorp West generated only 797 MW against 2,311 MW of demand, so that 75% describes about a third of what the site actually uses." | A small-importer footprint artifact. Also the 2019-era framing (BPAT 0.898 vs PACW 0.297, a 60-point error) is **stale**: by 2025 the gap is ~16 points. |
| T6 | "Adding load in PJM means 39% of it is clean." | "39% of PJM's overnight generation was carbon-free on average. This is an average mix, not a marginal one — EIA-930 gives fuel and interchange, not dispatch order." | Average vs marginal. Say the caveat first. |
| T7 | "The night grid got dirtier, so 45 GW more demand at night went to gas." | "Overnight **generation** nationally rose 45 GW." | `meta.national.total_avg_mw` is generation. The README sentence that pairs it with "demand growth" is loose. |
| T8 | "Nationally, night clean power fell." | "The night **share** slipped, from 40.5% to 39.7%. Clean megawatts at night actually rose 14 GW — they just didn't keep up with 45 GW of new generation." | Share vs level. A judge who knows the grid will catch this. |
| T9 | "Central Ohio came 19th." | "The AEP zone — Columbus and out across Ohio, Indiana, West Virginia, Virginia and Kentucky — came 19th." | `region_coords` place field. "Central Ohio" is shorthand for a five-state zone. |
| T10 | "We found 105 live alerts." | "162 raw signals rank down to 14 we'd actually show." | See D3. 105 is the active count in the pipeline export; the product ships 14. |
| T11 | "The grid is 40% clean at night today." | "In 2025, the last complete year, 40%." | 2026 is partial (snapshot 2026-09-05) and reads 0.403 night / 0.491 day. Don't mix a partial year into a trend. |
| T12 | "WACM is one of our findings." | "WACM ranks 5th and we flagged it — its demand jumped 1.5 GW in 2022 with flat generation and exports falling to zero. The data doesn't explain it, so it's excluded from alerts." | Frozen decision. It stays in the ranking; presenting it as a clean win invites the obvious question. |
| T13 | "Microsoft's Quincy site is on a 100% clean grid, so the naive map was right." | "Naive geography would have put Quincy on BPAT at 91% and made it look dirtier than it is — Grant County PUD reads 100%, essentially all Columbia River hydro." | The mapping trap runs both directions; say so, it's a strength. |
| T14 | "Amazon scored worst — we couldn't verify them." | "Amazon's report has no falsifiable sentence we could extract, so we count it as cannot-verify rather than scoring it. `talk_score` is null, not zero." | `kind: no_finding`, `talk_score: null`. Do not render null as 0. |
| T15 | "The detector found Data Center Alley." | "The detector found Data Center Alley sixth, and it missed Dallas at 91st — because the whole of ERCOT is booming, so Dallas doesn't diverge from its neighbours. Both are on screen." | Named in advance; reporting the miss is the credibility. |
| T16 | "70 grid regions." | "70 balancing authorities in the index; 111 regions scored." | See §2.4 — three different counts. |
| T17 | "We measure what these companies consume." | "We measure what the grid inside a footprint generated. Interchange isn't allocated." | On every screen; say it before the first company number. |

---

## 5. Lead with these — verified and striking, ranked

1. **PJM added 8.7 gigawatts of overnight generation since 2019 and not one megawatt of it was clean — clean generation actually fell 81 MW.** Two fields, one subtraction, no modelling. `api/region/PJM.json` cf_avg_mw and total_avg_mw. The strongest number in the repo: it is a flat line against a rising one.
2. **Google says 100% renewable; the grid at the site we mapped generated 5.6%.** A 94-point gap, both numbers from published sources, neither an accusation. `api/company/GOOGL.json`.
3. **Google's own report says 65% — on page 94, ninety pages after the 100% on page 4.** Their number, not ours. Five years of it: 65, 64, 64, 66, 65.
4. **All of the grid's decarbonization since 2019 happened in daylight: 37% → 47% by day, 40.5% → 39.7% at night.** Nobody publishes the night series. This is what the hourly split buys you.
5. **A detector using demand data alone, with the method frozen and four regions named in advance, put Data Center Alley 6th of 111 and Omaha 7th — and missed Dallas at 91st.** The miss is the reason to believe the hits.
6. **Same 300 MW, three grids: 144 MW of fossil at night in Omaha, 269 in Phoenix.** One subtraction a judge can do in their head.
7. **We caught a double-counted nuclear plant in the federal data.** Two authorities reporting the same generator, r = 0.9948 over 7,976 hours, 7,087 MW against a 3,937 MW nameplate, ending in a step on a single date. Published and corrected shown side by side.
8. **4.45 million hourly rows, 70 balancing authorities, July 2018 to September 2026.** Scale — but say it as balancing authorities, and only as the setup for 1–4.
