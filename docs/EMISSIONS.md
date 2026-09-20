# Measured CO2: replacing the proxy with a measurement

Wattson's shipped index measures the **carbon-free share of generation**. That is a
proxy for emissions, and a good one, but it is not emissions. Two regions with the
same carbon-free share can be a factor of three apart in CO2 per megawatt hour,
depending on whether the fossil half is gas or coal.

This module measures it instead. EPA CEMS, the Continuous Emissions Monitoring
Systems, reports hourly CO2 and heat input from the stacks of essentially every
large US fossil generator. It sits inside PUDL, the same curated source Wattson
already uses for EIA-930, so this is a second dataset from dataset #6 joined to the
one we have.

The shipped detector and the shipped carbon-free index are **frozen and unchanged**.
This is a measurement placed beside them.

Module: `engine/emissions/`. Write-up numbers below are all reproduced by
`python3 -m engine.emissions`.

---

## Headline results

| | |
|---|---|
| PJM overnight carbon intensity, 2019 | **0.369 short tons CO2 per MWh** (334 kg/MWh) |
| PJM overnight carbon intensity, 2025 | **0.353 short tons CO2 per MWh** (321 kg/MWh) |
| PJM overnight CO2, 2019 to 2025 | **+3,957,992 short tons per year** (+3.59M tonnes, +5.9%) |
| Carbon-free share vs measured intensity, 2025 overnight | Pearson **r = -0.834**, Spearman **-0.868**, n = 49 balancing authorities |
| Same, restricted to coverage-verified regions only | Pearson **r = -0.654**, Spearman **-0.739**, n = 39 |
| CEMS coverage achieved, 2025 overnight | **1.008** of EIA-930 net fossil generation, pooled over 39 published regions |

**The finding that cuts against our own framing:** PJM's overnight carbon-free share
fell from 0.433 to 0.390, and the README reads that as "overnight got dirtier."
Measured at the stack, PJM's overnight generation got **cleaner per megawatt hour**,
by 13.8 kg CO2/MWh, because the fossil half shifted from coal to gas. Total overnight
CO2 still rose, by 5.9%, because there is simply more overnight generation. Details in
[section 8, PJM restated](#8-pjm-restated-in-measured-co2).

---

## 1. Tables used

Everything comes from the PUDL `stable` release on the public bucket
`s3://pudl.catalyst.coop`. Table names below are the real ones in this release; none
are assumed.

| Table | Role | What we read |
|---|---|---|
| `core_epacems__hourly_emissions` | hourly measured CO2, heat input, gross load per EPA unit | 704 of 10,180 row groups |
| `out_eia__yearly_plants` (EIA-860) | plant to balancing authority, per year, plus plant timezone | 11,866 plants (2019), 16,983 (2025) |
| `out_eia__yearly_generators` (EIA-860) | capacity-weighted primary fuel per plant, for the unit check | 2019 and 2025 rows |
| `core_eia__codes_balancing_authorities` | BA to `report_timezone` | 1 row per BA |
| `core_eia930__hourly_net_generation_by_energy_source` | the generation denominator, via `scripts/build_wide.py` | already in the pipeline |
| `data/processed/l3_detector.csv` | the 111 frozen detector regions | 111 rows, 43 distinct BAs |

### The crosswalk question

PUDL ships `core_epa__assn_eia_epacamd` and `core_epa__assn_eia_epacamd_subplant_ids`
as the EPA/EIA crosswalk. **We did not need to apply them**: PUDL has already applied
the crosswalk upstream, and `core_epacems__hourly_emissions` carries `plant_id_eia`
next to `plant_id_epa`. This was verified rather than assumed: **0 of 70,290,144 rows
read are missing `plant_id_eia`**, in either year.

### What was actually pulled

`core_epacems__hourly_emissions` is a single 4.88 GB parquet file, 1,017,999,168 rows,
16 columns, 10,180 row groups. The file is physically sorted by year, so every row
group carries one year in its statistics. We read only the row groups for 2019 (364)
and 2025 (340) and projected down to 11 columns. Nothing else was downloaded; the pull
takes about 150 seconds.

| Year | Unit-hours read | UTC range | Rows with no CO2 value | Rows with no EIA plant id |
|---|---|---|---|---|
| 2019 | 36,301,368 | 2019-01-01 04:00 to 2020-01-01 08:00 | 24,885,914 | 0 |
| 2025 | 33,988,776 | 2025-01-01 04:00 to 2026-01-01 08:00 | 22,500,141 | 0 |

The large null-CO2 counts are **not missing data**. CEMS emits a row per unit per hour
whether or not the unit ran; a null CO2 is a unit that was not operating. The rows that
did operate carry a measurement code, and those counts reconcile exactly:

| Code | 2019 | 2025 |
|---|---|---|
| Measured | 10,966,290 | 11,122,795 |
| Measured and Substitute | 216,792 | 153,483 |
| LME (low mass emissions) | 173,600 | 172,189 |
| Other | 54,387 | 33,914 |
| Substitute | 4,385 | 6,254 |
| **Total with a code** | **11,415,454** | **11,488,635** |

11,415,454 plus 24,885,914 equals 36,301,368, the full 2019 read. 96.1% of operating
unit-hours in 2019 and 96.8% in 2025 are flagged "Measured", not substituted.

After aggregating units up to plants and hours, the working table is 23,504,424
plant-hour rows.

### Plant to balancing authority

| | 2019 | 2025 |
|---|---|---|
| Plants in EIA-860 | 11,866 | 16,983 |
| BA reported in that same year | 11,537 | 16,656 |
| BA taken from the nearest other year | 9 | 11 |
| Still without a BA | 320 | 316 |

The plants without a BA are overwhelmingly small non-CEMS solar and storage sites; a
CEMS plant that cannot be placed in a BA contributes no CO2 to any region and shows up
as missing coverage, which the coverage test then catches.

---

## 2. Units, which are the trap

CEMS reports CO2 mass in **short tons**, and PUDL keeps the column name
`co2_mass_tons`. We did not take that on faith, because short tons and metric tonnes
differ by 10.2% and a CO2 figure with the wrong unit is worse than none.

CO2 per MMBtu of heat input is fixed by the carbon content of the fuel, so a
single-fuel plant pins the mass unit. Taking every plant whose EIA-860 capacity is at
least 95% one fuel and which burned at least 1 million MMBtu in the year:

| Fuel | Plants | Median reported tons per MMBtu | Reads as, if short tons | Reads as, if metric tonnes | Published factor |
|---|---|---|---|---|---|
| Gas | 1,225 | 0.059429 | **53.91 kg CO2/MMBtu** | 59.43 kg/MMBtu | 53.97 (EPA 40 CFR 75 App. G, Fc = 1040 scf/MMBtu) |
| Coal | 316 | 0.104836 | **95.11 kg CO2/MMBtu** | 104.84 kg/MMBtu | 93.28 bituminous, 97.17 subbituminous (40 CFR 98 Table C-1) |

Read as short tons, the gas fleet lands on EPA's own Part 75 reporting factor to within
0.1%, and the coal fleet lands between the bituminous and subbituminous factors exactly
where a US coal fleet should sit. Read as metric tonnes, gas would emit 12% more CO2 per
MMBtu than any published gas factor and coal more than any coal rank. The gas
interquartile spread is negligible (p10 0.059423, p90 0.059573), which is what you
expect when reporters use a common factor.

**Verdict: `co2_mass_tons` is short tons.** Every figure in this document states its
unit. Conversion used where tonnes are given: 1 short ton = 907.18474 kg.

---

## 3. Method

Definitions are copied from the frozen pipeline, not re-invented. `engine/emissions/build.py`
imports `scripts/carbon_free_index.py` by path to get the fuel category lists rather than
retyping them.

- **Windows.** Overnight is local 00:00 to 05:59, daytime is local 10:00 to 15:59,
  matching `scripts/overnight_profile.py` and `scripts/l3_detector.py`. Years are 2019
  and 2025 calendar years in local time.
- **Local time.** Primary conversion uses the BA's `report_timezone`, the same
  conversion the detector and L2 use. This matters: the CO2 numerator and the
  generation denominator then cover exactly the same set of hours. A plant-own-timezone
  variant was computed as a sensitivity across 204 BA-year-window cells: median absolute
  difference **0.0%**, p95 **1.0%**, worst case PNM daytime 2025 at 8.7%. For PJM, whose
  footprint spans Eastern and Central time, the two conventions differ by **0.04% to
  0.24%** across its four cells, so the headline is not a timezone artifact.
- **Denominator.** EIA-930 total generation in the same cell, using the L1 definition:
  carbon-free plus fossil plus other/unknown, negatives clipped to zero, storage
  excluded.
- **Carbon intensity.** Measured CO2 short tons divided by EIA-930 total generation MWh
  in that cell. This is CO2 per MWh *generated inside the footprint*, consistent with
  the rest of Wattson, which measures generation within a footprint and does not
  allocate interchange.
- **Zones.** The 68 zones report demand only and inherit the parent BA's generation in
  the shipped pipeline. They inherit its measured CO2 and its carbon intensity the same
  way, flagged `co2_inherited_from_ba`, exactly as `cf_inherited_from_ba` works today.

---

## 4. Coverage achieved

CEMS covers fossil units that report to EPA, mostly those above 25 MW. It does not
cover everything. Coverage for a cell is **CEMS gross generation divided by EIA-930 net
fossil generation**. Full coverage sits slightly above 1.0, because gross load includes
station service, typically 4 to 7%.

Thresholds were fixed before any result was looked at:

- **tier C, dropped:** coverage is defined and outside 0.70 to 1.40, or the region
  reports no fossil generation at all while CEMS measures CO2 inside it.
- **tier B, published with a flag:** coverage undefined, or fossil generation below
  100 MW average. These are hydro and nuclear BAs whose CO2 is near zero either way.
- **tier A, published as a measurement:** everything else.

One ordering fix was applied after the first run and is disclosed here: the size floor
must not rescue an implausible coverage ratio. HGMA (Harquahala, a one-plant BA) first
landed in tier B on a 90 MW fossil average while CEMS measured six times the generation
EIA-930 reports for it. A cell that inconsistent should not be published at any size, so
the coverage test now runs first.

| Year | Window | tier A | tier B | tier C | Pooled coverage, tier A |
|---|---|---|---|---|---|
| 2019 | overnight | 39 | 13 | 13 | **1.029** |
| 2019 | daytime | 41 | 13 | 11 | **1.049** |
| 2025 | overnight | 39 | 11 | 11 | **1.008** |
| 2025 | daytime | 38 | 10 | 13 | **1.050** |

Pooled coverage landing between 1.008 and 1.050 is the validation of the whole join:
independently measured stack output reproduces EIA-930's reported net fossil generation
to within the expected gross-to-net gap, four times out of four.

48 of the 157 tier A cells sit below 0.95 coverage. For those, some fossil generation is
outside CEMS, so the published intensity is a **lower bound** on the region's true
intensity. The flag is `intensity_is_lower_bound` in the output CSV.

**Dropped regions and why.** BPAT (coverage 2.4 to 2.6), PGE, PSEI, PACW, WALC, GVL and
WACM 2019 all sit far above 1.0: independent power producers inside their footprints
burn fuel that the BA does not report as its own generation. AVRN, CPLW, GRID and SPA
report fossil generation to EIA-930 with no EPA-reporting plant attributable to them.
CISO daytime 2025 falls the other way, at 0.327, and is discussed in section 7.

Consequence for the demo: two sites in `claims/lookup/facilities.csv` sit in BPAT and
one in PACW, and **we publish no measured intensity for them.** That is the correct
outcome, not a gap to paper over.

### Scale check, tier A regions pooled

| Year | Window | Regions | CO2, million short tons | Generation, million MWh | Pooled intensity |
|---|---|---|---|---|---|
| 2019 | overnight | 39 | 347.7 | 807.8 | 0.430 st/MWh (391 kg/MWh) |
| 2019 | daytime | 41 | 456.0 | 993.1 | 0.459 st/MWh (417 kg/MWh) |
| 2025 | overnight | 39 | 359.9 | 912.6 | 0.394 st/MWh (358 kg/MWh) |
| 2025 | daytime | 38 | 387.1 | 1,020.1 | 0.379 st/MWh (344 kg/MWh) |

In 2019 the pooled overnight MWh was cleaner than the pooled daytime MWh (391 against
417 kg/MWh); in 2025 it is dirtier (358 against 344). That reversal is consistent with
the solar build entering the daytime denominator. The two windows do not pass exactly
the same regions (39 against 38 in 2025), so this is a directional observation, not a
matched-pair result.

---

## 5. Carbon intensity per region

Full tables: `data/processed/emissions_ba_window.csv` (BA by year by window) and
`data/processed/emissions_region.csv` (all 111 detector regions, zones inheriting).

### 2025, overnight, dirtiest ten

| BA | Carbon-free share | Short tons CO2/MWh | kg CO2/MWh | Generation, avg MW | Coverage |
|---|---|---|---|---|---|
| WACM | 0.297 | 0.936 | 849 | 3,688 | 1.283 |
| SC | 0.007 | 0.904 | 820 | 1,906 | 0.974 |
| LGEE | 0.011 | 0.904 | 820 | 3,454 | 1.064 |
| AECI | 0.144 | 0.785 | 712 | 2,414 | 1.227 |
| PACE | 0.255 | 0.715 | 649 | 6,533 | 1.128 |
| JEA | 0.000 | 0.593 | 538 | 891 | 0.783 |
| EPE | 0.001 | 0.578 | 524 | 655 | 1.019 |
| AZPS | 0.104 | 0.567 | 515 | 2,314 | 0.780 |
| NWMT | 0.429 | 0.564 | 511 | 2,187 | 0.988 |
| LDWP | 0.171 | 0.510 | 462 | 1,682 | 1.076 |

### 2025, overnight, cleanest

Ten regions measure **0.000 short tons CO2/MWh overnight**: CHPD, DOPD, GCPD, GWA,
SCL, SEPA, TPWR, WAUW, WWA and YAD. These are hydro BAs in the Pacific Northwest and the
Carolinas, all tier B, all with a 1.000 carbon-free share. CEMS finds no reporting fossil
unit inside them and EIA-930 reports no fossil generation. The two datasets agree, and
the number is a genuine zero rather than a missing value.

Among tier A regions with real fossil fleets, the cleanest overnight in 2025 are IID
(0.110 st/MWh, 100 kg/MWh), IPCO (0.149, 135), PNM (0.151, 137), AVA (0.154, 140), CISO
(0.160, 145, a lower bound at 0.738 coverage) and BANC (0.185, 167).

### 2019, overnight, dirtiest ten

| BA | Carbon-free share | Short tons CO2/MWh | kg CO2/MWh | Coverage |
|---|---|---|---|---|
| EEI | 0.000 | 1.294 | 1,174 | 1.184 |
| SEC | 0.000 | 1.153 | 1,046 | 1.251 |
| PACE | 0.147 | 1.038 | 942 | 1.319 |
| LGEE | 0.011 | 0.913 | 828 | 1.069 |
| AECI | 0.072 | 0.843 | 765 | 1.203 |
| NWMT | 0.259 | 0.788 | 715 | 1.006 |
| SC | 0.041 | 0.663 | 602 | 0.799 |
| JEA | 0.000 | 0.657 | 596 | 0.803 |
| PNM | 0.223 | 0.607 | 551 | 0.936 |
| EPE | 0.000 | 0.599 | 543 | 1.010 |

### 2025, daytime, dirtiest five

LGEE 0.921 st/MWh (836 kg/MWh), SC 0.854 (775), WACM 0.814 (739), AECI 0.811 (736),
JEA 0.624 (566).

---

## 6. Does the carbon-free share predict measured intensity?

The proxy's implicit physics is `intensity = (1 - carbon_free_share) x F`, where F is the
CO2 per MWh of the non-carbon-free half. The proxy is exactly as good as the assumption
that F is similar everywhere.

| Year | Window | Set | n | Pearson r | Spearman rho | R2 on (1 - share) | RMSE, st/MWh |
|---|---|---|---|---|---|---|---|
| 2019 | overnight | A+B | 50 | -0.777 | -0.826 | 0.604 | 0.196 |
| 2019 | overnight | A only | 39 | -0.662 | -0.722 | 0.438 | 0.202 |
| 2019 | daytime | A+B | 52 | -0.805 | -0.834 | 0.649 | 0.188 |
| 2019 | daytime | A only | 41 | -0.699 | -0.731 | 0.488 | 0.195 |
| 2025 | overnight | **A+B** | **49** | **-0.834** | **-0.868** | **0.696** | **0.140** |
| 2025 | overnight | A only | 39 | -0.654 | -0.739 | 0.428 | 0.157 |
| 2025 | daytime | A+B | 48 | -0.866 | -0.897 | 0.749 | 0.121 |
| 2025 | daytime | A only | 38 | -0.746 | -0.794 | 0.556 | 0.136 |

Both sets are reported because both are honest. Tier A+B includes the zero-fossil hydro
BAs, which are real regions with a real intensity of zero; tier A restricts to regions
where the measurement is coverage-verified, which also restricts the range of the
predictor and pulls the correlation down. **The proxy explains between 43% and 70% of
the variance in measured overnight carbon intensity. It is a real signal and it is not
a substitute for a measurement.**

Across all 111 detector regions as the detector sees them (zones carrying their parent
BA's numbers, which weights big BAs by zone count): Pearson **-0.713**, Spearman
**-0.512**, R2 0.508.

### Where the spread lives

The implied fleet intensity F, CO2 per MWh of non-carbon-free generation, 2025 overnight:

| BA | F, short tons/MWh | Coal share of fossil | Carbon-free share |
|---|---|---|---|
| WACM | 1.331 | 0.879 | 0.297 |
| NWMT | 0.986 | 0.864 | 0.429 |
| PACE | 0.960 | 0.718 | 0.255 |
| AECI | 0.916 | 0.655 | 0.144 |
| LGEE | 0.914 | 0.804 | 0.011 |
| MISO | 0.764 | 0.462 | 0.345 |
| PJM | 0.580 | 0.292 | 0.390 |
| NYIS | 0.499 | 0.000 | 0.459 |
| FPL | 0.363 | 0.000 | 0.263 |
| CISO | 0.295 | 0.000 | 0.458 |

**F ranges over a factor of 4.5 across regions**, from 0.295 to 1.331 short tons per MWh,
and it tracks the coal share of the fossil fleet almost perfectly. That entire range is
invisible to the carbon-free share, which is why the proxy fails where it fails.

---

## 7. Where the proxy is worst: named regions

### The cleanest single comparison

| | PACE (PacifiCorp East) | FPL (Florida Power & Light) |
|---|---|---|
| 2025 overnight carbon-free share | **0.255** | **0.263** |
| Measured overnight intensity | **0.715 st/MWh (649 kg/MWh)** | **0.268 st/MWh (243 kg/MWh)** |
| Coal share of fossil | 0.718 | 0.000 |
| CEMS coverage | 1.128 | 0.902 |

Wattson's map puts these two regions within 0.008 of each other. The stacks say one emits
**2.7 times** as much CO2 per megawatt hour as the other. PACE hosts four datacenter sites
in `claims/lookup/facilities.csv`, including a Meta site.

A second pair, NWMT (0.429 share, 0.564 st/MWh, coverage 0.988) against CISO (0.458 share,
0.160 st/MWh, coverage 0.738): a 0.029 gap in the proxy, a **3.5x** gap in the
measurement. Even after allowing for CISO's incomplete coverage by scaling its intensity
up to 0.217, the gap is still 2.6x.

### Regions the proxy flatters most, 2025 overnight

Residual against an OLS fit of measured intensity on (1 - carbon-free share):

| BA | Share | Measured | Predicted | Residual | Coal share | Coverage |
|---|---|---|---|---|---|---|
| WACM | 0.297 | 0.936 | 0.428 | **+0.508** | 0.879 | 1.283 |
| LGEE | 0.011 | 0.904 | 0.601 | +0.303 | 0.804 | 1.064 |
| SC | 0.007 | 0.904 | 0.603 | +0.301 | 0.719 | 0.974 |
| AECI | 0.144 | 0.785 | 0.521 | +0.264 | 0.655 | 1.227 |
| PACE | 0.255 | 0.715 | 0.453 | +0.262 | 0.718 | 1.128 |
| NWMT | 0.429 | 0.564 | 0.348 | +0.215 | 0.864 | 0.988 |
| MISO | 0.345 | 0.501 | 0.399 | +0.102 | 0.462 | 1.036 |
| SWPP | 0.519 | 0.383 | 0.293 | +0.089 | 0.569 | 0.946 |
| TVA | 0.480 | 0.393 | 0.317 | +0.075 | 0.340 | 1.152 |

**WACM carries a caveat and should not lead.** Its coverage of 1.283 means CEMS measures
28% more generation than EIA-930 reports as WACM's fossil output, so part of that +0.508
is a denominator problem rather than a fuel-mix one. WACM is already flagged in
`CLAUDE.md` as unexplained. Lead with **PACE, LGEE, SC, AECI and NWMT**, whose coverage
sits between 0.97 and 1.23 and whose residuals are driven by coal.

### Regions the proxy libels, 2025 overnight

DEAA (-0.191), FPL (-0.180), CISO (-0.171), TAL (-0.164), BANC (-0.156), NEVP (-0.150).
All-gas and gas-plus-solar fleets. A region with a 0.000 carbon-free share and a modern
combined-cycle fleet (DEAA, 0.416 st/MWh) emits **less than half** what a region with a
0.297 share and a coal fleet emits (WACM, 0.936).

### Rank disagreement

Ranking regions dirtiest-first by proxy against dirtiest-first by measurement, 2025
overnight:

| BA | Rank by proxy | Rank by measurement | Gap |
|---|---|---|---|
| WACM | 19th | **1st** | 18 places |
| NWMT | 26th | 9th | 17 |
| PACE | 17th | 5th | 12 |
| AECI | 14th | 4th | 10 |
| MISO | 21st | 11th | 10 |
| DEAA | 1st | 22nd | -21 |
| TAL | 1st | 16th | -15 |
| FPL | 18th | 31st | -13 |
| SEC | 1st | 12th | -11 |

### Spread inside a single carbon-free-share band

Regions that look the same on Wattson's map today, 2025 overnight:

| Carbon-free share band | Regions | Cleanest measured | Dirtiest measured | Ratio |
|---|---|---|---|---|
| 0.00 to 0.10 | 11 | DEAA 0.416 | SC 0.904 | 2.2x |
| 0.20 to 0.30 | 4 | FPL 0.268 | WACM 0.936 | 3.5x |
| 0.30 to 0.40 | 5 | ISNE 0.250 | MISO 0.501 | 2.0x |
| 0.40 to 0.50 | 7 | CISO 0.160 | NWMT 0.564 | 3.5x |
| 0.50 to 0.70 | 6 | PNM 0.151 | SWPP 0.383 | 2.5x |

---

## 8. PJM restated in measured CO2

The shipped claim: overnight clean generation in PJM has been flat since 2019
(35,700 MW to 35,619 MW average) while overnight generation rose 8.7 GW, with gas
supplying 10.7 GW of it.

**Every fuel-side number reproduces exactly.** Our own independent run gives gas
+10,739 MW and coal -2,518 MW overnight, against the published +10.7 and -2.5.

Restated at the stack, with 268 CEMS plants in 2019 and 237 in 2025, coverage 0.974 and
0.978:

| PJM overnight | 2019 | 2025 | Change |
|---|---|---|---|
| Total generation, avg MW | 82,539 | 91,240 | +8,701 |
| Carbon-free generation, avg MW | 35,700 | 35,619 | -81 |
| Carbon-free share | 0.433 | 0.390 | **-0.043** |
| **Measured CO2, short tons** | **66,643,207** | **70,601,199** | **+3,957,992 (+5.9%)** |
| Measured CO2, metric tonnes | 60,457,700 | 64,048,330 | +3,590,630 |
| Measured CO2 per overnight hour, short tons | 30,431 | 32,253 | +1,822 |
| **Carbon intensity, short tons/MWh** | **0.369** | **0.353** | **-0.016 (-4.1%)** |
| Carbon intensity, kg/MWh | 334.5 | 320.7 | **-13.8** |
| Fleet intensity F, short tons/MWh | 0.650 | 0.580 | -0.070 |

Totals are across the 2,190 overnight hours of each year, not the whole year.

### Where the extra CO2 comes from

A two-factor decomposition of the +3,957,992 short tons, exact to the last ton:

| Effect | Short tons per year |
|---|---|
| More overnight generation, at 2019's intensity | **+6,991,735** |
| Cleaner overnight generation, at 2025's volume | **-3,033,743** |
| Net | **+3,957,992** |

PJM's fossil fleet getting less carbon intensive, which the fuel mix says is coal
giving way to gas, bought back 3.0 million short tons of CO2 a year in the overnight
window. The extra 8.7 GW of overnight generation spent 7.0 million. **The
growth in overnight load ate the entire decarbonization benefit of the coal retirements
and 4.0 million short tons more on top.** That is a stronger and more defensible
sentence than "overnight got dirtier," and it is the one the measurement supports.

### What this contradicts

The README says "In PJM, overnight got dirtier." Per megawatt hour, measured at the
stack, **it did not**. Both PJM windows got cleaner per MWh between 2019 and 2025:
overnight -4.1%, daytime -11.8%. Daytime CO2 fell outright, by 7,325,611 short tons.

The carbon-free share and the measured carbon intensity **point in opposite directions
for PJM**: the share fell 4.3 points while the intensity fell 13.8 kg/MWh. Both are
correct about what they measure. The share fell because clean generation did not grow
with load; the intensity fell because the fossil that did grow was gas replacing coal.
Only one of the two is an emissions statement.

The honest framing, which we should adopt: **PJM's overnight grid got cleaner per unit
of energy and dirtier in total, and the reason it got dirtier in total is consistent
with new flat load being served by gas.**

---

## 9. Two things the measurement caught that the proxy could not

### CISO daytime 2025: the two datasets disagree about direction

Across the 28 regions with real fossil fleets and at least five CEMS plants in both
years, three move in opposite directions between 2019 and 2025 in the daytime window.
One is large:

| | 2019 | 2025 | Change |
|---|---|---|---|
| CISO daytime fossil, EIA-930 net, avg MW | 6,119 | 10,578 | **+72.9%** |
| CISO daytime, CEMS gross measured, avg MW | 4,854 | 3,464 | **-28.6%** |
| Coverage | 0.793 | 0.327 | |
| CEMS plants attributed to CISO | 92 | 89 | |

A 101-point gap in direction. The monthly series show the two tracking closely all
through 2019 and diverging through 2025. Two explanations are ruled out by the data:
plant re-attribution (CISO keeps 93 then 91 California CEMS plants in EIA-860, and BANC,
LDWP, IID and TIDC counts are unchanged) and a CEMS reporting collapse (all 240 to 245
California CEMS units still report; statewide measured CO2 fell only 10.8%, from 31.3M
to 28.0M short tons).

The CEMS direction is also the physically expected one. In this same EIA-930 table,
CISO's midday solar generation rose from 8.0 GW to 13.9 GW average between 2019 and 2025;
midday gas should fall against that, not rise 73%. We do
not assert which series is wrong. We state that they disagree, that only one of them is
a measurement at the stack, and that CISO daytime 2025 is therefore **dropped from the
published intensity table**.

### AZPS: an independent check on a known artifact

`CLAUDE.md` flags AZPS's overnight carbon-free share falling from 0.620 in 2019 to 0.104
in 2025 as almost certainly a reporting change, and `engine/diagnostics/corrections.py`
argues it is Palo Verde nuclear double counted under Arizona and SRP through 2019. CEMS
is an entirely independent series, and it agrees.

| AZPS overnight | 2019 | 2025 |
|---|---|---|
| Carbon-free share | 0.620 | 0.104 |
| Total generation, avg MW | 5,434 | 2,314 |
| Fossil generation, avg MW | 2,033 | 2,043 |
| **Measured CO2, short tons** | **3,483,618** | **2,875,405 (-17.5%)** |
| Carbon intensity, short tons/MWh | 0.293 | 0.567 |

AZPS's fossil generation is flat to within 0.5% and its **measured CO2 fell 17.5%**.
Nothing started burning. The intensity appears to double only because 3.1 GW of reported
generation left the denominator. A carbon-free share can collapse without a single extra
ton of CO2, and here it did. The generation-side AZPS numbers should keep their warning
label, and the measured CO2 series is the one to quote. Three datacenter sites (Compass,
Microsoft, Vantage) sit in AZPS.

---

## 10. What a datacenter site draws at 3am

All 134 sites in `claims/lookup/facilities.csv` matched a scored region. Measured CO2 per
MWh of the grid inside the footprint each site draws from, 2025 overnight.

| Region | Sites | Measured kg CO2/MWh | Carbon-free share | Tier | Operators |
|---|---|---|---|---|---|
| GCPD | 3 | **0** | 1.000 | B | Microsoft (Quincy), Sabey, Vantage |
| PNM | 1 | 137 | 0.595 | A | Meta |
| CISO | 2 | 145 | 0.458 | A | Vantage, Equinix |
| DUK | 4 | 235 | 0.593 | A | Apple, Core Scientific, Google, WhiteFiber |
| NYIS and zones A/C/J | 6 | 245 | 0.459 | A | TeraWulf, Hut 8, Fluidstack, Sabey, Vulcan |
| SRP | 3 | 265 | 0.551 | A | Digital Realty, EdgeConneX, Google |
| **PJM/DOM** | **9** | **321** | 0.390 | A | Amazon, Digital Realty, Equinix, Meta, Microsoft, Oracle, QTS, Yondr |
| PJM/AEP | 7 | 321 | 0.390 | A | Amazon, Google, Meta, Microsoft, OpenAI, STACK, Vantage |
| PJM, other zones | 14 | 321 | 0.390 | A | Amazon, CoreWeave, CyrusOne, Equinix, Iron Mountain, Meta, Nebius, OpenAI, Prime, Stronghold, Bitdeer |
| SWPP and zones | 9 | 347 | 0.519 | A | Google, Lambda, MARA, Meta, Nebius, Core Scientific, Fermi America, TierPoint |
| ERCO and zones | 28 | 356 | 0.413 | A | Bitdeer, Cipher, Crusoe/Stargate, Galaxy, Hut 8, IREN, OpenAI, Oracle, Riot, Tesla, Microsoft, Google, CoreWeave, Equinix |
| TVA | 7 | 356 | 0.480 | A | Bitdeer, Core Scientific, Flexential, Google, Meta, xAI |
| SOCO | 6 | 383 | 0.310 | A | Core Scientific, Edged, Equinix, Meta, Microsoft, T5 |
| PGE | 2 | 386 | 0.227 | A | Digital Realty, NTT |
| NEVP | 3 | 405 | 0.018 | A | Apple, Switch |
| MISO and zones | 15 | 454 | 0.345 | A | Apple, Applied Digital, Core Scientific, CoreWeave, Google, QTS, Switch, Amazon, Meta, xAI, Microsoft, OpenAI, DataBank |
| AZPS | 3 | 515 | 0.104 | A | Compass, Microsoft, Vantage |
| EPE | 2 | 524 | 0.001 | A | OpenAI, Oracle |
| **PACE** | **4** | **649** | 0.255 | A | Aligned, DataBank, Meta, Novva |
| SC | 1 | 820 | 0.007 | A | Google (Moncks Corner) |
| WACM | 2 | 849 | 0.297 | A | Crusoe Energy, Novva |
| BPAT, PACW | 3 | **not published** | | C | Amazon, Google, Meta |

Sentences this supports, in the form the measurement licenses:

- The nine Northern Virginia sites in Dominion draw from a grid that emitted a measured
  **321 kg CO2 per MWh** generated in PJM's footprint at 3am in 2025.
- Microsoft's Quincy site and its two neighbors in Grant County PUD draw from a
  footprint where CEMS measured **zero CO2**, overnight and daytime, in both years.
- The four sites in PacifiCorp East draw from a footprint at **649 kg CO2 per MWh**
  overnight, 2.7 times what a region with practically the same carbon-free share emits
  (FPL, share 0.263, measured 243 kg/MWh).

Zones carry their parent BA's measured intensity, so every PJM zone reads 321 kg/MWh
and every ERCOT zone 356; the table groups them for that reason. Rows sum to all 134
sites.

Three caveats travel with this table and must not be dropped:

- **SC (Google, Moncks Corner) keeps its coarse-region caveat.** As
  `claims/lookup/facilities.csv` already records, Santee Cooper's jointly owned V.C.
  Summer nuclear reports under SCEG, not SC, so the SC footprint understates the clean
  content of power actually available to the site. The measured 820 kg/MWh inherits that
  caveat in full.
- **AZPS keeps its artifact caveat** from section 9.
- **BPAT and PACW are blank on purpose.** Their coverage fails the test, so the Meta
  Prineville, Amazon and Google sites in them get no number from this module.

---

## 11. What this does not establish

- **This is generation inside a footprint, not consumption.** Interchange is not
  allocated. A region that imports heavily emits less inside its own boundary than its
  load is responsible for, and this number does not correct for that. It is the same
  boundary the rest of Wattson uses, chosen for consistency, not because it is the only
  defensible one.
- **This is an average, not a marginal rate.** The CO2 avoided by moving one megawatt of
  datacenter load is the marginal emissions rate, which is usually higher than the
  average and is not computed here.
- **No causal claim.** Nothing here shows that any datacenter caused any ton of CO2. The
  language throughout is "consistent with," and the load the detector flags includes
  crypto mining and oilfield electrification alongside AI datacenters.
- **Regions are coarse.** PJM spans Chicago to New Jersey. A single carbon intensity for
  it is an average over an enormous and heterogeneous footprint, and a zone inside it
  inherits the parent BA's number rather than measuring its own.
- **CEMS is not a census.** It covers fossil units that report to EPA, mostly above
  25 MW. Coverage is stated per region, 48 of 157 published cells are marked as lower
  bounds, and 11 to 13 regions per window are dropped rather than published thin.
  1.96% of measured CO2 comes from CEMS units that report no gross load at all,
  mostly cogeneration and steam-only units; that CO2 enters the numerator without
  entering the coverage denominator, so it biases measured coverage slightly low.
- **We did not audit EIA-930.** Section 9 reports that CEMS and EIA-930 disagree about
  CISO's daytime fossil trend. It does not establish which one is right.
- **2026 is out of scope.** The comparison is 2019 against 2025 calendar years, matching
  the frozen detector. CEMS in this release runs into 2026, and we did not pull it.
- **No emissions are claimed for the 2,190 hours that are neither overnight nor
  daytime.** The two windows cover 12 of 24 hours.

---

## 12. Reproducing

```bash
source ~/hackmit-venv/bin/activate
# prerequisites already in the shipped pipeline
python3 scripts/build_wide.py && python3 scripts/carbon_free_index.py
PYTHONPATH=scripts python3 scripts/overnight_profile.py
PYTHONPATH=scripts python3 scripts/l2_temporal.py
python3 scripts/l3_detector.py

# this module
python3 -m engine.emissions.cems     # ~150s, pulls the 2019 and 2025 CEMS slice
python3 -m engine.emissions          # build + full report
python3 -m engine.emissions --report # report only, reusing built tables
```

Outputs:

| Path | Contents |
|---|---|
| `data/processed/cems_plant_hour.parquet` | 23,504,424 plant-hour rows, CO2 short tons, gross MWh, heat MMBtu |
| `data/processed/cems_unit_year.parquet` | 8,308 CEMS unit-year totals, used for the unit check |
| `data/processed/cems_code_plant_year.parquet` | CO2 split by EPA measurement code per plant-year |
| `data/processed/cems_fetch_meta.json` | row counts, date ranges, null counts, measurement codes |
| `data/processed/emissions_ba_window.csv` | BA by year by window: CO2, generation, intensity, coverage, tier |
| `data/processed/emissions_region.csv` | all 111 detector regions, zones inheriting their BA |
| `data/processed/emissions_facilities.csv` | 134 datacenter sites with the intensity of the grid they draw from |
| `data/processed/emissions_contradictions_*.csv` | EIA-930 vs CEMS direction disagreement per window |
| `engine/emissions/emissions.json` | provenance, unit check, coverage thresholds, timezone sensitivity |
