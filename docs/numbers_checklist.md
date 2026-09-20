# Numbers checklist: every figure a judge sees in `web/`, traced to its source

Verified 2026-09-19 against the files the UI actually reads. Nothing here was eyeballed:
every "shown" value was recomputed by loading the fixture JSON and applying the same
formatting as `web/src/lib/findings.js` (JS `toFixed` / `Math.round`, which round
differently from Python), and every fixture value was compared field-by-field to
`dashboard/public/data/regions.json` (the pipeline export) and to the README tables.

Automated version: `node web/test/smoke.mjs` (exits non-zero on any failure).

JSX line numbers are as of this verification; the pages were being edited concurrently
(the fields and `findings.js` formatting behind every number were unchanged at the time).

Legend: **OK** matches source · **DISC** discrepancy (see the numbered list at the end) ·
**HAND** hand-mapped, not from the data · **MOCK** illustrative placeholder ·
**HARD** hard-coded string in JSX, not read from data.

Sources: `README.md` (headline table L15-21, detector table L71-84, siting table L117-125),
`regions.json` = `dashboard/public/data/regions.json`, fixtures =
`web/fixtures.provisional/*.json` (byte-identical copies are served from
`web/public/fixtures/`, confirmed with `cmp`), `coords` = `web/src/data/region_coords.json`,
`metros` = `web/src/data/metros.json`, `caveats` = `web/src/data/data_caveats.json`.

The last column answers "what would this look like if the pipeline were silently broken?"

---

## 1. Landing (`pages/Landing.jsx`)

| Shown | Fixture field | Pipeline source | Check | Broken-pipeline tell |
|---|---|---|---|---|
| footer "…through 2026-09-05" | none: HARD string in `Landing.jsx` L24 | `regions.json meta.data_snapshot_end = "2026-09-05"`; `opening.data_snapshot_end` same | OK, but HARD: will silently go stale on a re-fetch | a re-fetch moves the snapshot and this text does not follow |
| chip "300 MW: Phoenix vs Northern Virginia vs Omaha" | `query.js DEMO_COMPARE` (HARD) → `metros` aliases → AZPS, PJM/DOM, SWPP/OPPD | `site.json request.candidates` = Phoenix, AZ / Northern Virginia / Omaha, NE | OK: `matchMetro` resolves all three exactly; `sameRequest` is true so the baked `site.json` is used, not the client-side ranking | if an alias changed, Compare would silently fall back to client-side ranking (`_computed_client_side`) with a different card title |
| chips Meta / Google / Microsoft / Amazon | `query.js COMPANIES` (HARD) | `company.json companies` has only META | OK by design: the other three render "isn't verified yet. Verified so far: Meta" | — |

## 2. Check: META card and evidence (`pages/Check.jsx`, `checkAnswer`)

All claim text, talk/coverage scores and the verdicts are **MOCK** (`claims/companies.mock.json`,
banner "mock claims" is shown). The grid numbers behind them are real L1 outputs.

| Shown | Fixture field (how computed) | Pipeline source | Check | Broken-pipeline tell |
|---|---|---|---|---|
| "Meta Platforms says 100% renewable." | `claims[0].magnitude=1.0`, `unit=fraction`, `metric=renewable_electricity_share` → `Math.round(1.0*100)` | MOCK claim | MOCK | — |
| "True on paper." | `claims[0].verdict = true_on_paper` | MOCK verdict | MOCK | — |
| "Physically, its sites run on 32–93% clean power." | `physical_min=0.321`, `physical_max=0.934` → `Math.round` | min/max of the four grid-evidence `cf_share` values: SOCO 0.321, PACW 0.934 (recomputed: min 0.321, max 0.934, mean 0.526) | OK arithmetically; **DISC 6** on what 93% means (PACW imports 75% of its load) | if all four sites read the same value, the site→BA lookup collapsed to one region |
| Num "100%" claimed · "market based" | `pct0(magnitude)`, `scope.replace('_',' ')` | MOCK | MOCK | — |
| Num "32–93%" actually clean, by site · "grid average, all hours" | as above | `regions.json` `cf_share[2024].all` for PACW/MISO/SOCO/TVA | OK | — |
| Num "4" sites checked · "1 claim can't be verified" | `sites.length=4`; `cannot_verify_count=1` | count of `verdict=cannot_verify` (1 of 3) | OK | — |
| Evidence row Prineville, OR: "Pacific Power · W. Oregon · inferred" **93% · 93% at night** | `evidence[ba=PACW].cf_share=0.934`, `overnight_cf_share=0.925` (→ `Math.round(92.5)=93`); label from `coords["PACW"].label` | `regions.json PACW cf_share[2024] all=0.934, overnight=0.925` | OK values. HAND site→BA mapping (`source_type: inferred`). **DISC 6**: PACW total generation 600 MW avg vs 2,423 MW demand (gen/demand 0.25, net import 1,823 MW); 93% describes a quarter of Prineville's supply. Two identical "93%" figures look like a bug but are 0.934 and 0.925 rounded | a BA that generates almost nothing reads either ~0% or ~100%; check `total_avg_mw` vs `demand.avg_mw` |
| Altoona, IA: "MidAmerican Energy · MISO · inferred" **34% · 35% at night** | `cf_share=0.337`, `overnight=0.351` | `regions.json MISO cf_share[2024]` all 0.337, overnight 0.351; gen/demand 0.99 | OK. HAND mapping. Note MISO is the whole 15-state BA; MISO/0035 (Iowa) is the zone the metros file uses for Des Moines, but the mock site uses the BA | — |
| Newton County, GA: "Georgia Power / Walton EMC · Southern Co. · inferred" **32% · 31% at night** | `0.321`, `0.314` | `regions.json SOCO cf_share[2024]` all 0.321, overnight 0.314; gen/demand 1.04 | OK. HAND mapping | — |
| Gallatin, TN: "Gallatin Dept. of Electricity (TVA) · TVA · inferred" **51% · 50% at night** | `0.51`, `0.496` | `regions.json TVA cf_share[2024]` all 0.51, overnight 0.496; gen/demand 0.96 | OK. HAND mapping | — |
| note "…on each site's grid in 2024, all hours" | `a.primary.year=2024` (falls back to HARD 2024 if absent) | claim year (MOCK) | OK | — |
| claim 2 "too vague to check", claim 3 "can't verify" + reason "PPA deliveries are not in EIA-930…" | `verdict`, `evidence[type=note].note` | MOCK | MOCK | — |
| Talk vs walk: **80% / 53% / 67%** | `talk_score=0.8`, `walk_score=0.526`, `coverage=0.67` via `pct0` | walk = `physical_mean_unweighted` = mean(0.934,0.337,0.321,0.51) = 0.5255 → 0.526 (recomputed, OK). talk and coverage: MOCK, no derivation (coverage 0.67 = 2 of 3 claims, but only 1 of 3 was actually checkable) | walk OK; talk/coverage MOCK | — |
| "Since 2019 the US grid got cleaner during the day and stood still at night." | HARD prose in `Check.jsx` L88 | national series: day 0.372→0.465, night 0.405→0.397 | OK today (see §4.3) | — |

## 3. Compare: 300 MW, Phoenix / Northern Virginia / Omaha (`pages/Compare.jsx`, `compareAnswer`)

Ranking key: `siting.siting_score` descending (Omaha 0.737, NoVA 0.436, Phoenix 0.173; sorted OK).
Zones (OPPD, DOM) use the parent BA's siting (`siting_from` SWPP, PJM); verified equal to
`regions.json` parent `siting` field-for-field.

| Shown | Fixture field (how computed) | Pipeline source | Check | Broken-pipeline tell |
|---|---|---|---|---|
| title "Compare · 300 MW of flat load" | `request.mw=300` | request | OK | — |
| "Omaha, NE is your cleanest option: 52% clean power at night and improving." | first candidate without a caveat, `pct0(siting.overnight_cf_share_2025=0.519)`; "improving" = `ratio_slope_per_year 0.0101 > 0.005` | `regions.json SWPP siting` (0.519, slope 0.0101); README siting table SPP row 0.519 / +0.010 | OK | if SWPP's clean share were inherited wrongly, OPPD would show a different value from README's SPP row |
| "Northern Virginia is 39% and holding steady." | `pct0(0.39)`; "holding steady" = `|−0.0044| ≤ 0.005` | `regions.json PJM siting` 0.39 / slope −0.0044; README PJM row 0.390 / −0.004 | OK numerically; **DISC 4** on wording (README: "In PJM, overnight got dirtier", −4.2 pts since 2019) | — |
| "Phoenix, AZ reads 10% but its data looks unreliable, so treat it as unknown." | `pct0(0.104)`; caveat from `caveats["AZPS"]` | `regions.json AZPS siting` 0.104; AZPS overnight cf_share by year 0.62 (2019), 0.015 (2020), …, 0.104 (2025) | OK; the caveat is HAND (web-only, not in `regions.json data_flags`, see **DISC 5**) | AZPS overnight generation falls 5,436→1,784 MW in 2020 with nuclear 3,612→0 (Palo Verde leaves the footprint) and interchange flips +2,813→−1,832 MW: a reporting break, not physics |
| Nums "52% 1. Omaha, NE improving" / "39% 2. Northern Virginia holding steady" / "10% 3. Phoenix, AZ data unreliable" | `pct0(share)`, `rank`, trend word or caveat | as above | OK | — |
| note "Ranked on clean power at night, whether it is improving, and clean power relative to demand. Equal weight, frozen…" | HARD prose | README L112-115: composite = mean percentile of overnight CF 2025, change since 2019, clean MW / demand; slope shown only | OK, but "whether it is improving" in the ranking is `change_since_2019`, while the sentence's "improving / holding steady" word uses `ratio_slope_per_year`, which is not in the composite. A simple mean-percentile recomputation reproduces `siting_score` to within 0.02 (PJM 0.425 vs 0.436, SWPP 0.732 vs 0.737); exact percentile convention lives in `scripts/l4_supply.py` | — |

### "Show why", per candidate

| Candidate | Shown | Fixture field | Pipeline source | Check |
|---|---|---|---|---|
| 1. Omaha, NE · Omaha | ring **51.9%** · "+1.0 pts / yr" | `overnight_cf_share_2025=0.519`, `ratio_slope_per_year=0.0101` | SWPP siting (inherited) | OK |
| | since 2019 **+5.2 pts** | `change_since_2019=0.052` | README SPP +0.052 | OK |
| | clean power vs demand at night **0.54×** | `overnight_clean_mw_over_demand=0.537` | README SPP 0.537 | OK, but this is SWPP-wide clean MW over SWPP-wide demand, whereas "your load" below uses OPPD's local 1,682 MW: two footprints on one card (the inherited-generation note covers it) |
| | what filled the last growth **wind +4.2 GW** | `last_growth_filled_by` = largest positive of `fuel_delta_overnight_gw` (wind 4.16) | `regions.json SWPP/OPPD fuel_delta_overnight_gw` (= SWPP's) | OK |
| | who serves the load **Omaha Public Power District** | `operators[0]` from `scripts/operators_manual.json` | HAND | HAND |
| | your load **17.8% of night demand** | 300 / `demand.overnight_avg_mw 1682` | `regions.json SWPP/OPPD demand[2025]` | OK |
| | from fossil at the 2025 mix **144 of 300 MW** | `300 × (1 − 0.519)` = 144.3 | — | OK arithmetic; label says "fossil" but 1−CF also includes other/biomass (denominator-only) |
| | new flat load already showing up **#7 of 111 · +39%** | `detector.rank=7`, `growth_pct=39.4`; "111" is HARD | README detector row 7 (39.4, 6.8) | OK |
| | siting rank **10 of 52** | `siting_rank=10`, `n_ranked=52` | README SPP rank 10 | OK |
| | clean at night by year "2019 47% · … · 2025 52%" | `region.json` SWPP/OPPD → parent SWPP `cf_share[y].overnight` | 0.467, 0.493, 0.513, 0.53, 0.537, 0.539, 0.519 | OK |
| 2. Northern Virginia · N. Virginia | ring **39.0%** · "-0.4 pts / yr" | 0.39, −0.0044 | PJM siting; README 0.390 / −0.004 | OK (hyphen-minus here vs typographic minus elsewhere) |
| | since 2019 **-4.2 pts** | −0.042 | README −0.042 | OK |
| | clean power vs demand **0.41×** | 0.408 | README 0.408 | OK |
| | what filled the last growth **gas +10.7 GW** | gas 10.74 | README "gas +10.7" | OK |
| | who serves the load **Virginia Electric and Power (Dominion Energy Virginia) · D** | operators_manual | HAND (CLAUDE.md: tickers unverified) | HAND |
| | your load **2.1% of night demand** | 300 / 14,033 | DOM demand[2025].overnight_avg_mw | OK |
| | from fossil **183 of 300 MW** | 300 × 0.61 | — | OK |
| | **#6 of 111 · +32%** | rank 6, growth 31.8 | README row 6 | OK |
| | siting rank **34 of 52** | 34 | README PJM rank 34 | OK |
| | by year "2019 43% · 43 · 42 · 42 · 42 · 41 · 2025 39%" | PJM `cf_share[y].overnight` | 0.433, 0.434, 0.422, 0.415, 0.421, 0.411, 0.39 | OK |
| 3. Phoenix, AZ · Phoenix | ring **10.4%** · "-11.1 pts / yr" | 0.104, −0.1105 | AZPS siting | OK numerically; AZPS caveat banner shown |
| | since 2019 **-51.7 pts** | −0.517 | 0.62 → 0.104 | OK numerically; reporting break |
| | clean power vs demand **0.06×**; filled by **gas +0.3 GW** | 0.057; gas 0.31 (nuclear is −3.61, the real story) | AZPS | OK numerically, misleading without the caveat (which is shown) |
| | who serves **Arizona Public Service · PNW** | operators_manual | HAND | HAND |
| | your load **7.1%**; from fossil **269 of 300 MW**; **#3 of 111 · +31%**; siting rank **49 of 52** | 300/4,221; 300×0.896; rank 3, growth 31.0; 49 | README row 3 (31.0, 9.0) | OK |
| | by year "2019 62% · 2020 2% · 4 · 7 · 10 · 12 · 2025 10%" | AZPS `cf_share[y].overnight` | as listed above | OK; this row is the visible evidence of the break |

### "Why night matters" and "Where new flat load is already showing up"

| Shown | Fixture field | Pipeline source | Check |
|---|---|---|---|
| **47%** clean during the day, 2025 · "37% in 2019" | `opening.national.cf_share[2025].daytime=0.465` → `Math.round(46.5)=47`; 0.372 → 37 | `regions.json meta.national` | OK (half-up rounding; the Found page shows the same values as 46.5% / 37.2%) |
| **40%** clean at night, 2025 · "41% in 2019" | 0.397 → 40; 0.405 → `Math.round(40.5)=41` | same | OK, but 0.405 rendered as "41%" next to Found's "40.5%" reads as two different numbers |
| **½** "of a datacenter's power is used at night" | HARD | overnight is 6 of 24 hours; "half" is the spec's framing for flat load over all non-daytime hours | HARD; rhetorical, not measured |
| top-5 rows "North #1 +95% / Far West #2 +116% / Arizona Public Service Company #3 +31% / Tucson Electric Power Company #4 +15% / Western Area Power Administration - Rocky Mountain Region · data flagged #5 +52%" | `detector.regions` rank ≤ 5, label `known_cluster_label || name` (regions.json long name) | README detector rows 1-5 | OK; labels differ from the Found page, which uses `coords.label` ("N. Texas", "Permian", "Phoenix", "Tucson", "WAPA Rockies") |

## 4. What we found (`pages/Found.jsx`)

### 4.1 The finding (headline scene)

| Shown | Fixture field (how computed) | Pipeline source | Check | Broken-pipeline tell |
|---|---|---|---|---|
| "The mid-Atlantic grid's (PJM) overnight clean generation has not moved since 2019." | `openingTitle`: rel = (35619−35700)/35700 = −0.0023, `|rel| < 0.01` → "has not moved"; "PJM's" string-replaced | README L5 / headline | OK | an exact 0 delta or identical 2019/2025 values = year filter failure; a swing of hundreds of MW = DST/timezone slip in the 00:00-05:59 window |
| hero **35,700 → 35,619 MW clean at night** | `pjm.overnight_clean_mw[2019]`, `[2025]` | `regions.json PJM cf_avg_mw[y].overnight`; README table L17 (35,700 / 35,619). Recomputed from `overnight_fuel_mw`: nuclear+hydro+wind+solar = 35,700 (2019) and 35,619 (2025) exactly | OK | — |
| sub "35,700 MW then, 35,619 MW now. Overnight generation rose 8.7 GW." | `(91240−82539)/1000` = 8.701 → "8.7 GW" | README L18 (82,539 / 91,240); `overnight_fuel_mw` sums to 82,539 and 91,241 (1 MW rounding) | OK | — |
| sub "Gas supplied 10.7 GW of it." | `fuel_delta_overnight_gw.gas=10.74` | README L35 gas +10.7 | OK number; **DISC 3** wording: 10.7 of 8.7 GW is arithmetically odd (coal −2.5, nuclear −0.9 explain it; README says coal-to-gas switching, the UI does not) | fuel deltas sum to 8.69 GW vs 8.70 total: they close, so no fuel category was dropped by the 2024-07-01 recategorisation |
| sub "Net exports fell from 3.8 GW to 2.5 GW, so the new generation served PJM's own load." | `overnight_net_export_mw` 3814 → 2489 | README L20; `regions.json PJM interchange[y].overnight_net_export_mw` (EIA-adjusted operations table, positive = export) | OK | a sign flip (PJM-MISO tie) would show exports rising; the frozen decision pins the operations table for this |
| Nums **+8.7 GW** "more power at night since 2019" / **+10.7 GW** "of it from gas" / **3.8 GW → 2.5 GW** "exports to neighbors" | as above via `signedGw`, `gw1` | as above | OK | — |
| globe marker "Northern Virginia · +39% at night" | **HARD** string in `Found.jsx` L73 | 14,033/10,060 − 1 = 0.3949 → 39%; README L41 "overnight demand 39%" | OK today, HARD (**DISC 7**) | will not follow the data |
| hour bars "Clean share by hour on that grid, 2025" | `pjm.profile_24h[2025]` (24 values) | mean of hours 0-5 = 0.3905 vs `cf_share[2025].overnight` 0.390; hours 10-15 mean 0.4160 vs daytime 0.416; 2019 hours 0-5 mean 0.4327 vs 0.433 | OK, internally consistent | if the profile were in UTC the night trough would sit at hours 4-9 |
| "Named before the ranking was seen": Northern Virginia **6th of 111**, Omaha **7th**, Central Ohio **19th**, Dallas **91st** | `detector.regions` with `validation: true`, `ordinal(rank)`, `n_scored` | README L86; `regions.json meta.detector.validation_named_in_advance` | OK | — |

### 4.2 At night

| Shown | Fixture field (how computed) | Pipeline source | Check |
|---|---|---|---|
| "Night-time demand is rising faster than daytime demand in **8** places." | top-10 by rank, minus `data_flagged` (WACM) and minus `pattern ≠ flat-load growth` (CISO/SDGE), that have coords → 8 | README detector table rows 1-10 | OK count; **DISC 8** framing: it is "8 of the top 10", and the detector compares overnight growth to *average* growth, not to daytime |
| rows: N. Texas · new #1 +95% / Permian · new #2 +116% / Phoenix · new #3 +31% / Tucson · new #4 +15% / WAPA Rockies · data flagged #5 +52% / Northern Virginia #6 +32% / Omaha #7 +39% / ERCOT · new #8 +27% / Santee Cooper · new #9 +28% / San Diego · new #10 +4% | `growth_pct.toFixed(0)`, labels from `coords.label`, "new" = in `new_leads` | README rows 1-10: 94.6, 116.1, 31.0, 15.1, 52.1, 31.8, 39.4, 27.2, 28.3, 3.5 | OK (all 12 README detector rows match the fixture and `regions.json` on growth, excess, LF delta, neighbor divergence and score) |

### 4.3 Day vs night (sweep)

| Shown | Fixture field (how computed) | Pipeline source | Check | Broken-pipeline tell |
|---|---|---|---|---|
| "Since 2019 the grid cleaned up by day and stood still at night." | d = 0.465−0.372 = +0.093; o = 0.397−0.405 = −0.008, `|o| < 0.01` → "stood still" | README L28-31 | OK | — |
| pair **37.2% → 46.5%** day, **40.5% → 39.7%** night | `national.cf_share[2019|2025].daytime|overnight` via `pct1` | `regions.json meta.national.cf_share`; README "0.372 to 0.465", "0.405 to 0.397" | OK | if day and night moved together the local-time split failed; the −0.8 pt night change is the load-bearing number |
| sub "Daytime clean share 37.2% to 46.5% (+9.3 pts). Overnight 40.5% to 39.7% (−0.8 pts)." | same | same | OK | — |
| KV day 2019 **178,129 MW** / day 2025 **239,533** / night 2019 **159,031** / night 2025 **173,380** | `national.cf_avg_mw` | `regions.json meta.national.cf_avg_mw`; README "daytime clean generation rose 61 GW" (239,533−178,129 = 61,404 OK), "overnight rose 14 GW" (14,349 OK) "against 45 GW of overnight demand growth" (`meta.national.total_avg_mw` overnight 392,186 → 437,303 = +45,117; that field is generation, not demand) | OK | — |
| year ruler 2019…2025, interpolated live values | `interpYears` linear between yearly points | same series | OK (display only) | — |

### 4.4 Where load is landing (detector)

| Shown | Fixture field (how computed) | Pipeline source | Check |
|---|---|---|---|
| "**111** regions scored from demand alone. **7** flagged regions are not known datacenter clusters." | `n_scored=111`; `new_leads.length=7` = top-10 not in KNOWN_CLUSTERS and not data_flagged: ERCO/NRTH, ERCO/FWES, AZPS, TEPC, **ERCO**, SC, **CISO/SDGE** | README L100-103 names **5**: ERCOT North, Far West, Phoenix, Tucson, Santee Cooper | **DISC 2**: the fixture counts ERCO (the parent BA of two leads already listed) and CISO/SDGE (pattern "possible midday solar suppression", not flat load) |
| sub "Validation named in advance: Northern Virginia 6th, Omaha 7th, Central Ohio 19th, Dallas 91st." | validation regions sorted by rank | README L86 | OK |
| rows (named + leads): …, Central Ohio · mixed #19 +9%, Dallas · flat-load growth #91 +14% | as §4.2 plus PJM/AEP (9.2) and ERCO/NCEN (14.2) | README rows 19 and 91 | OK |
| map: hollow pin = data flagged | `data_flagged` = id in `regions.json meta.data_flags` (WACM only) | AZPS has `data_flags: []` in `regions.json` | **DISC 5**: Phoenix is a solid "new" lead here and "data unreliable" on Compare |

## 5. Region: PJM/DOM (`pages/Region.jsx`, `regionTitle`)

| Shown | Fixture field (how computed) | Pipeline source | Check | Broken-pipeline tell |
|---|---|---|---|---|
| card title "N. Virginia · Northern Virginia (Loudoun / Fairfax), Dominion zone" | `coords["PJM/DOM"].label`, `.place` | HAND | HAND | — |
| "N. Virginia's overnight demand grew **39%** since 2019." | 14,033/10,060 − 1 = 0.3949 → `pct0` | `regions.json PJM/DOM demand[y].overnight_avg_mw`; README L21 (10,060 / 14,033) and L41 "overnight demand 39%" | OK | the two corrupt Oct-2021 Dominion hours (>1e9 MWh) would blow the average by orders of magnitude; 14,033 is sane |
| "The grid serving it (PJM) is **4.3 pts** less clean at night." | `cf_share[2025].overnight − cf_share[2019].overnight` = 0.39 − 0.433 = −0.043 (3-dp rounded inputs) | PJM `cf_share` (inherited, `cf_inherited_from_ba: true`) | **DISC 1**: the Num two lines below says **−4.2 pts** | — |
| sub "Average demand 11,681 MW to 15,395 MW; overnight 10,060 MW to 14,033 MW." | `demand[2019|2025].avg_mw`, `.overnight_avg_mw` | README L41 "11.7 GW to 15.4 GW", +32% (15,395/11,681 = 1.318 OK) | OK | — |
| Num **39.0%** "clean power at night, 2025" · "**−4.2 pts** since 2019" | `parent.siting.overnight_cf_share_2025=0.39`, `change_since_2019=−0.042` (pipeline computes this from unrounded shares) | README siting PJM row 0.390 / −0.042 | OK vs README; **DISC 1** vs the title on the same card | — |
| Num **#6** "of 111 for new flat load" · "flat-load growth" | `detection.rank=6`, `pattern`; "111" HARD | README row 6 | OK | — |
| Num **14,033** "MW demand at night, 2025" · "10,060 in 2019" | `demand` | README L21 | OK | — |
| chip "generation figures are the whole PJM grid" | `cf_inherited_from_ba=true` | spec Amendment 3 | OK | — |
| hour bars 2025 | `parent.profile_24h[2025]` | PJM profile (consistent with cf_share, see §4.1) | OK | — |
| What changed at night: gas **+10.7 GW**, coal **−2.5**, nuclear **−0.9**, wind **+1.1**, solar **+0.0**, hydro **−0.2** | `parent.fuel_delta_overnight_gw` via `signedGw` (10.74, −2.52, −0.95, 1.07, 0.01, −0.22) | README L35 "gas +10.7 GW, coal −2.5, nuclear −0.9, wind +1.1, hydro −0.2, solar 0.0" | OK (note `(0.95).toFixed(1)` is "0.9" only because 0.95 is below 0.95 in binary; a pipeline change to 0.96 would print 1.0) | deltas sum to 8.69 GW = total growth, so nothing was dropped |
| "clean power vs night demand **0.41× · -0.4 pts/yr**" | `siting.overnight_clean_mw_over_demand=0.408`, `ratio_slope_per_year=−0.0044` | README PJM row 0.408 / −0.004 | OK | — |
| Who serves the load (hand-mapped): Virginia Electric and Power (Dominion Energy Virginia) → Dominion Energy · **D**; NOVEC → member-owned | `operators_manual` = `scripts/operators_manual.json["PJM/DOM"]` | HAND; CLAUDE.md says tickers unverified | HAND | — |
| How the detector scored it: score **7.71**, night faster than average by **7.7 pts**, faster than neighbors by **32.9 pts**, load factor change **0.042**, demand growth **+31.8%** | `detection.*` | README row 6 (31.8, 7.7, 0.042, 32.9, 7.7); load factor 0.628 → 0.670 (README L87) matches `demand[y].load_factor` | OK | — |

---

## Discrepancies (exact values)

1. **Region PJM/DOM shows two different "since 2019" figures on one card.** Title: "4.3 pts less clean at night" (from `cf_share`: 0.39 − 0.433 = −0.043, both already rounded to 3 dp in the export). Num below: "−4.2 pts since 2019" (from `siting.change_since_2019 = −0.042`, computed by the pipeline before rounding). Same for any zone/BA where the 3-dp rounding crosses a boundary. Fix: `regionTitle` should read `siting.change_since_2019` when present (`web/src/lib/findings.js` L47), or the export should carry `cf_share` at 4 dp.
2. **Found/detector says "7 flagged regions are not known datacenter clusters"; the README names 5.** `opening.detector.new_leads` = `["ERCO/NRTH","ERCO/FWES","AZPS","TEPC","ERCO","SC","CISO/SDGE"]`. ERCO is the parent BA of the first two (double count); CISO/SDGE's pattern is "possible midday solar suppression" (growth 3.5%, overnight excess 10.5) and is by the frozen labels not a flat-load flag. README L100-103: "ERCOT North and Far West, Phoenix and Tucson, Santee Cooper". Both `web/fixtures.provisional/_generate_provisional.py` (`new_leads`) and the `loadOpening` fallback in `web/src/lib/data.js` build the list as "top 10, not validation, not data-flagged" with no pattern filter.
3. **"Gas supplied 10.7 GW of it" where "it" is 8.7 GW** (Found headline sub, `openingTitle`). Both numbers are right (gas +10.74, total +8.70; coal −2.52, nuclear −0.95, hydro −0.22 make up the difference), but the sentence reads as an arithmetic error. README L38 adds "part of the gas rise is coal-to-gas switching"; the UI does not.
4. **Compare says Northern Virginia is "holding steady"; README says "In PJM, overnight got dirtier."** `trendWord` uses `ratio_slope_per_year = −0.0044` with a ±0.005 dead band; `change_since_2019 = −0.042` (−4.2 pts) and the yearly night series (43, 43, 42, 42, 42, 41, 39%) both say declining. The word and the number on the same card disagree in spirit.
5. **The AZPS caveat exists only in the web layer.** `regions.json` has `data_flags: []` for AZPS (only WACM is flagged in `meta.data_flags`), so `data_flagged` is false in the fixture: the Found map draws Phoenix as a solid accent "new" lead while Compare calls the same region "data unreliable". Also `CLAUDE.md` says AZPS overnight clean share reads "~0.15 in 2025"; the export says **0.104** (2025) and 0.117 (2024); `data_caveats.json` ("about 10%") is the one that matches the data. The break itself: AZPS overnight total generation 5,436 MW (2019) → 1,784 MW (2020), nuclear 3,612 → 0, overnight net interchange +2,813 → −1,832 MW.
6. **PACW "93% clean" is a small-importer footprint artifact.** `regions.json` PACW 2024: `total_avg_mw.all = 600`, `cf_avg_mw.all = 560`, `demand.avg_mw = 2,423`, net import 1,823 MW (gen/demand 0.25). The 0.934 that sets Meta's `physical_max` and the "32–93%" range describes one quarter of Prineville's supply. The spec's own lookup table (docs/spec.md, Meta row) expected "BPAT ~91% clean, PACW far lower"; the export says the opposite (BPAT overnight 0.905, PACW all-hours 0.934). This is the README's "small BAs that generate nothing" trap in its other form and is not marked anywhere on the Check page.
7. **Hard-coded numbers that happen to match today:** Found globe marker "Northern Virginia · +39% at night" (`Found.jsx` L73; recomputes to 39.49%); "of 111" in `Region.jsx` L41 and `Compare.jsx` L67 (`n_scored` is 111); Landing footer "through 2026-09-05" (`Landing.jsx` L24; `meta.data_snapshot_end`); `Check.jsx` L62 falls back to 2024 as the evidence year.
8. **Found/night "in 8 places"** is top-10 minus WACM (flagged) minus CISO/SDGE (not flat-load); the sentence implies a national count. Also the detector's `overnight_excess` is overnight growth minus *average* growth (README L61), not minus daytime growth as the sentence says.
9. **`metros.json` duplicate aliases mis-route input.** `"prineville"` is an alias of both "Hillsboro, OR" (PGE) and "Prineville, OR" (PACW); `matchMetro` returns the first exact hit, so typing "Prineville" ranks PGE, while Meta's Prineville site (and `site.json`'s metro index) is PACW. `"gallatin"` is on both "Nashville, TN" and "Gallatin, TN" (both TVA, harmless). Also "Altoona" alone does not resolve (only "des moines / altoona"). The smoke test fails on the cross-region duplicate; the fix is to delete `"prineville"` from the Hillsboro entry.
10. **README PJM-zone sentence does not match the export.** README L40-42: "The next fastest PJM zone, AEP, grew 9%; 17 of 20 zones were flat or shrinking." `regions.json` has **19** PJM zones, and PJM/EKPC grew **+11.0%** (second fastest), PJM/AEP +9.2% (third); 16 of 19 grew under 3% (13 shrank). No UI screen shows this sentence, but a judge reading the README next to the Region page for PJM/AEP will see it.
11. **README "Dominion's roughly +4 GW overnight is about half of PJM's overnight growth."** DOM overnight +3,973 MW is 45.7% of PJM's overnight *generation* growth (8,701 MW) but 60.6% of PJM's overnight *demand* growth (80,643 → 87,203 = +6,560 MW). "Half" holds only for the generation figure; say which.
12. **Compare rounds 0.405 to "41% in 2019"** ("Why night matters") while the Found sweep shows "40.5%" for the same field: half-up rounding, two screens, two numbers.

## Not verifiable from the data

- Every META claim: the verbatim text, source documents, `year`, `falsifiability`, `greenwash_patterns`, the three verdicts, `talk_score 0.8`, `coverage 0.67`, `unverifiable_share 0.33`. All are `[MOCK]` placeholders from `claims/companies.mock.json`; `_mock: true` and the "mock claims" chip are shown. `walk_score 0.526` is the only derived one (mean of the four grid shares).
- The site → BA mapping for Meta (Prineville → PACW, Altoona → MISO, Newton County → SOCO, Gallatin → TVA): `source_type: inferred`, `source_url: null`. Hand-curated, not from EIA-930. Whether Altoona should be MISO/0035 (the zone the metros file uses for Des Moines) rather than the whole MISO BA is a lookup decision, not a data fact.
- Everything in `web/src/data/region_coords.json`, `metros.json` (lat/lng, labels, serving utilities, aliases) and `scripts/operators_manual.json` (utility → parent → ticker). `region_coords._uncertain` lists six placements the author was unsure of. CLAUDE.md flags TXNM and FTS tickers as unverified; D (Dominion) and PNW (Pinnacle West) appear on the demo screens.
- "½ of a datacenter's power is used at night" (Compare): a framing of flat load over non-daytime hours, not a measured share (the overnight window is 6 of 24 hours).
- The `data_caveats.json` prose for AZPS and WACM: the numbers in it match the export (AZPS 0.62 → 0.104; WACM demand +1.5 GW during 2022 with generation ~4 GW and exports 1,653 → 122 MW), but the explanations ("reporting change", "footprint change") are hypotheses.
- Whether the PJM overnight-export series (3,814 → 2,489 MW) is right: it is taken from the EIA-adjusted operations table by frozen decision; the partner-level table disagrees before 2020 and is not used.
- National figures are "consistent with EIA's published mix" by assertion (`meta.national.note`); no EIA-published number is cited or compared here. Trailing-12 to 2026-08 (0.401 overnight, 0.484 daytime, README L31) matches `meta.national.trailing12`.

## What was checked and found consistent (summary)

- `opening.pjm` ↔ `regions.json` PJM/DOM: 12 of 12 scalar fields equal; fuel deltas and national series equal.
- README headline table (L15-21): all 10 numbers equal the fixture and the export.
- README detector table (L71-84): all 12 rows equal on id, growth, overnight excess, LF delta, neighbor divergence and score (to 1 dp); 111 regions, ranks 1..111 contiguous, validation ids at 6 / 19 / 7 / 91.
- README siting table (L117-125): all 7 BAs equal on all five columns; 52 BAs ranked.
- `site.json`: siting, fuel deltas, 2025 demand, detector fields and overnight fuel mix equal the export (zones via the parent BA); sorted by `siting_score` desc.
- `company.json` grid evidence: 8 of 8 shares equal `regions.json cf_share[2024]`; physical min/max/mean recompute exactly.
- `region.json`: 13 regions, all with coords; PJM/DOM demand, cf_share, detection, siting equal the export; PJM/DOM `cf_share` and `siting` are byte-equal to PJM's (inheritance).
- Internal closure: PJM `overnight_fuel_mw` sums to `overnight_total_mw` (±1 MW) and its clean fuels to `overnight_clean_mw` exactly for 2019 and 2025; `profile_24h` hour means reproduce `cf_share` overnight/daytime to 3 dp.
- 124 ids in `region_coords.json` = 124 ids in `regions.json`, no gaps either way; all metro `region_id`s and caveat keys resolve.
- `web/public/fixtures/*.json` are byte-identical to `web/fixtures.provisional/*.json`; no `fixtures/` (Yash) and no `server/static_export` exist yet, so the provisional files are what the UI serves.
