# SHAPE — two unsupervised questions about the shape of demand

Module: [`engine/shape/`](../engine/shape/). Reproduce with
`source ~/hackmit-venv/bin/activate && pip install ruptures && python3 -m engine.shape`.
Every number below comes from that run. Seed **20260920** throughout.

Two questions, neither of which uses the detector as an input:

1. **Do datacenter grids cluster together on load shape alone?** — unsupervised
   clustering of the 24-hour demand profile, scored afterwards against 134
   independently mapped sites.
2. **When did each region's load go flat?** — changepoint detection on the monthly
   overnight-to-average demand ratio, 2018–2026.

**Answer to Q1: no. It is a null result and it is reported as one.** Mapped-site
regions are not over-represented in any load-shape cluster. The smallest p-value
anywhere in a 50-test grid is 0.028, it lands in the *placebo* year, and the
family-wise corrected p is 1.000.

**Answer to Q2: dated breaks exist and several are strong, but they do not cluster in
calendar time** (p = 0.31 against a seeded uniform null), and site regions' breaks are
neither earlier, later, nor larger than anyone else's (p = 0.91 and p = 0.69).

The one clearly positive result in this file is a **post-hoc** one: the shipped
detector's score correlates at ρ = +0.66 (p = 6 × 10⁻¹⁵) with a quantity computed here
without ever looking at it. The detector survived an independent check; the premise
that "datacenter load has a visible shape at balancing-authority resolution" did not.

---

## 1. Data and the region universe

Source: EIA-930 via PUDL — `out_eia930__hourly_subregion_demand` and
`out_eia930__hourly_operations` (`demand_imputed_pudl_mwh` in both), plus
`core_eia__codes_balancing_authorities` for the reporting time zone. A *region* is a
balancing authority or a `BA/ZONE` subregion, built exactly as `scripts/l3_detector.py`
builds them.

Every hour is converted to the BA's **local** time before anything else. An hour is
only "overnight" locally, and the big BAs span time zones; in UTC the 24-hour profile
of MISO or PJM is a blur of three time zones and means nothing.

**n = 111 regions.** Eligibility is the shipped detector's rule, recomputed here from
the parquet rather than read from detector output: mean demand ≥ 500 MW **and** ≥ 90%
of the year's hours reported, in both 2019 and 2025. It reproduces the detector's
count exactly (111), which is the point — the two analyses are about the same regions.

**The 500 MW floor is kept**, for the reason the detector has it and one more. Below
it the hourly series is dominated by reporting noise and a handful of individual
industrial customers, so a "24-hour load shape" built from it is not describing a
grid. And keeping it means any disagreement between this module and the detector is a
disagreement about method, not about which regions were in the room.

Zones carry **demand only**, which is their own measurement. No generation figure is
used anywhere in this module, for a zone or for anything else.

### Independence, structurally enforced

`profiles.py`, `cluster.py`, `changepoint.py` and `sites.py` read two things: PUDL
parquet and `claims/lookup/facilities.csv`. They do not import the detector or read
`l3_detector.csv` or `regions.json`. `compare.py` is the only file permitted to read
detector output, and `build.py` calls it last, after both questions are finished,
handing it completed results.

### The site labels, and an honest problem with them

`claims/lookup/facilities.csv`: **134 sites, 54 companies, 48 of the 111 regions**,
mapped from serving utilities and public filings. A region "has a site" if at least
one row lands in it. 48 of 111 is a 43% base rate, which is high — it limits the power
of any enrichment test before the first calculation is run.

Nine of the 134 rows mention the detector in their free-text note (one says outright
that a county "is the same footprint our detector…"). So the lookup's curation was not
perfectly blind. Four sensitivity label sets are therefore pre-specified and all of
them are reported:

| label set | regions | sites | what it drops |
|---|---:|---:|---|
| `all` | 48 | 134 | nothing (primary) |
| `detector_blind` | 46 | 125 | the 9 rows whose note mentions the detector |
| `visible_load` | 44 | 119 | 15 rows flagged behind-the-meter, interruptible, or not yet energised — real datacenters that EIA-930 cannot see |
| `heavy` | 19 | 95 | regions with fewer than 3 mapped sites |
| `validation_excluded` | 44 | 110 | PJM/DOM, PJM/AEP, SWPP/OPPD, ERCO/NCEN — the four the detector named in advance |

---

## 2. Q1 — clustering on load shape

### Features

One row per (region, year): the mean demand in each of the 24 local hours, divided by
that region-year's own mean, so each profile averages to 1.0. Scale is removed;
**peak-to-trough ratio is kept**. That choice matters: flatness is the thing being
looked for, and z-scoring each profile — the other obvious normalization — divides
exactly that signal away. (The z-scored variant is available in `cluster.py` as a
robustness option.)

Fitted on **2019–2025 pooled: 776 region-years** (111 × 7, less PSEI in 2020, which
does not report a full year). 2018 is excluded from Q1 because subregion demand only
covers 43 of the 111 regions that year. Pooling years rather than fitting one year at
a time gives a single shape space that regions can be seen to move through.

### Choosing k

Mean silhouette over k = 2…10, k-means with `n_init=50`, `random_state=20260920`.
Highest silhouette wins; the rule was fixed before any labels were joined.

| k | 2 | **3** | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|
| k-means silhouette | 0.283 | **0.354** | 0.284 | 0.301 | 0.256 | 0.281 | 0.282 | 0.280 | 0.285 |
| Ward silhouette | 0.306 | 0.345 | 0.314 | 0.273 | 0.238 | 0.236 | 0.237 | 0.235 | 0.245 |

**k = 3.** Ward agrees at k = 3 (adjusted Rand index between the two partitions =
0.699), which is reassurance that the structure is in the data and not in k-means'
initialisation.

### What the principal components physically are

PCA on the column-centred 776 × 24 matrix. Three components carry **95.0%** of the
variance. Rather than assert what they mean, each component's scores are correlated
against quantities you can compute by hand from a profile:

| | share of variance | strongest correlations | physical reading |
|---|---:|---|---|
| **PC1** | **55.6%** | overnight ratio **−0.90**, peak-to-trough **+0.73**, peak hour −0.41 | **day/night amplitude.** Low PC1 = flat: the night sits close to the daily mean. High PC1 = peaky. This is the "flatness axis" and it is the majority of all the variation there is. |
| **PC2** | **27.8%** | evening-minus-afternoon **+0.92**, trough hour +0.46, peak hour +0.35 | **when the peak happens.** High PC2 = an evening peak (18:00–22:00, winter/residential); low PC2 = an afternoon peak (12:00–16:00, summer air-conditioning, or a midday trough dug by distributed solar). |
| **PC3** | 11.6% | morning ramp **+0.95** | **how sharp the morning ramp is** — the 04:00→08:00 climb. |

So the first component is exactly what the project has been asserting all along: the
dominant way US load shapes differ from each other is how flat they are. That much is
confirmed. Whether *datacenters* explain which regions sit where on that axis is the
next question, and the answer is no.

### The clusters

Cluster 0 is defined as the one with the flattest centroid.

| cluster | overnight (00–05) | daytime (10–16) | peak/trough | peak | trough |
|---|---:|---:|---:|---:|---:|
| **0 — flattest** | 0.911 | 0.949 | 1.373 | 20:00 | 04:00 |
| 1 — middle | 0.881 | 1.047 | 1.306 | 19:00 | 04:00 |
| 2 — peakiest | 0.831 | 1.062 | 1.525 | 18:00 | 04:00 |

Membership moves, and in the expected direction:

| year | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---:|---:|---:|---:|---:|---:|---:|
| cluster 0 (flattest) | 7 | 5 | 6 | 8 | 13 | 15 | **22** |
| cluster 1 | 77 | 76 | 79 | 79 | 77 | 74 | 75 |
| cluster 2 (peakiest) | 27 | 29 | 26 | 24 | 21 | 22 | **14** |

**The American grid is getting flatter.** Regions in the flattest cluster tripled from
7 to 22 between 2019 and 2025 and the peakiest cluster halved. That is a real,
label-free finding.

### Enrichment — the test this was all for

Hypergeometric survival function (one-sided, P of ≥ x mapped-site regions by chance)
plus Fisher's exact test, Bonferroni-corrected across the k = 3 clusters. 2025 slice,
one row per region, N = 111, K = 48.

| cluster | n | with sites | expected | p (hypergeom.) | Bonferroni | Fisher 2-sided |
|---|---:|---:|---:|---:|---:|---:|
| 0 — flattest | 22 | **6** | 9.5 | 0.975 | 1.000 | 0.100 |
| 1 — middle | 75 | 36 | 32.4 | 0.104 | 0.313 | 0.158 |
| 2 — peakiest | 14 | 6 | 6.1 | 0.621 | 1.000 | 1.000 |

**Mapped-site regions are not enriched in the flat cluster. They are slightly
depleted in it: 6 where 9.5 were expected.** Nothing is significant in either
direction after correction.

What is actually in the 2025 flat cluster explains why:

> AZPS\*, CISO/PGAE\*, CISO/SDGE, ISNE, ISNE/4001, ISNE/4003, ISNE/4004, ISNE/4006,
> MISO/0004, NYIS/ZONB, NYIS/ZONC\*, NYIS/ZONE, NYIS/ZONF, NYIS/ZONG, NYIS/ZONK,
> PJM/AE\*, PJM/JC, PJM/PS\*, PNM, PNM/PNM\*, TEPC, WALC   (\* = has a mapped site)

It is New England, upstate and downstate New York, California and the desert
Southwest. These are flat because they are mature, low-growth, efficient and full of
behind-the-meter solar that fills in the midday, not because of datacenters. The
unsupervised structure is real; it is just answering a different question than ours.

### Placebo and the full grid

Running the same test on the **2019** slice — before most of the buildout — gives the
flat cluster n = 7, 5 with sites, expected 3.0, p = 0.123. Not significant, but
pointing the *same* way as 2025 and slightly stronger, which is evidence that any
association is a pre-existing property of where datacenters get built, not something
the buildout caused.

The full grid is reported rather than mined: **four profile specifications × five
label sets × every cluster = 50 enrichment tests.**

| spec | k | silhouette |
|---|---:|---:|
| S1 annual mean profile, 2025 | 2 | 0.375 |
| S2 annual mean profile, 2019 (placebo) | 2 | 0.364 |
| S3 change in profile 2019 → 2025 | 3 | 0.537 |
| S4 shoulder season (Apr, May, Oct, Nov) 2025 | 3 | 0.390 |

- **Smallest uncorrected p across all 50: 0.0275.** It falls in S2 — the *placebo
  year* — with the `validation_excluded` label set, cluster 0.
- **Bonferroni over the family of 50: p = 1.000.**

S3 deserves a note of its own. Clustering on how each region's profile *changed*
between 2019 and 2025 gives the cleanest separation of anything here (silhouette
0.537), and the leading change-component (**64.0%** of the variance) loads negative
across 00:00–08:00 and 18:00–23:00 and positive across 10:00–17:00, peaking at
12:00–13:00 — the midday being eaten. **The dominant change in American load shape
since 2019 is the solar duck
curve, not flat load.** The change-cluster that isolates it contains CAISO, the NYISO
zones, ISO-NE, AZPS, PNM and TEPC. Mapped-site enrichment in it: p = 0.81.

### The continuous version

Cluster membership is a coarse instrument. The same question, asked of PC1 directly
with a Mann-Whitney U test (lower PC1 = flatter):

| comparison | site median | other median | p |
|---|---:|---:|---:|
| PC1, 2019, `all` (48 vs 63) | −0.004 | +0.031 | **0.047** |
| PC1, 2025, `all` (48 vs 63) | −0.061 | −0.008 | **0.045** |
| PC1 **change** 2019→2025, `all` | −0.056 | −0.073 | 0.739 |
| PC1, 2025, `heavy` (19 vs 92) | −0.037 | −0.044 | 0.648 |
| PC1 change, `heavy` | −0.029 | −0.071 | 0.898 |

Mapped-site regions are marginally flatter — **and were just as marginally flatter in
2019, before the buildout.** They did not flatten faster than everyone else; if
anything they flattened slightly less. Read plainly: datacenters are sited in regions
that already had flat load, which is what you would expect of large urban and
industrial footprints with good transmission. This is a statement about siting, not
about the shape of new load, and it is not strong enough to lean on either way.

### The figure

[`engine/shape/pca_scatter.svg`](../engine/shape/pca_scatter.svg) — PC1 against PC2
for 2025, coloured by cluster, mapped-site regions drawn as filled circles whose
radius grows with site count. The same numbers are in
`shape.json` → `q1_clustering.scatter`, one flat row per region-year, which is what a
front end should read.

---

## 3. Q2 — when did each region's load go flat?

### Series and method

Per region, per month: **mean overnight (00:00–05:59 local) demand ÷ mean demand over
all hours.** 1.0 is a perfectly flat day. The ratio is scale-free, so a 1.9 GW zone
and a 96 GW BA are directly comparable and a region simply getting bigger does not
move it. 2018-01 to 2026-08; months with under 85% of their hours are dropped, which
is what truncates the 2026 tail. 92–104 months per region.

**Seasonal adjustment.** The ratio has a large regular annual cycle (summer afternoon
air conditioning depresses it). Left in, a changepoint search finds July, every year,
and nothing else. Each calendar month's own mean across all years is subtracted and
the series mean added back. Level and trend are untouched — a trend is precisely what
is being looked for.

**Search.** `ruptures` PELT with an L2 (mean-shift) cost. Penalty
`2.0 × σ̂² × log n`, a BIC-flavoured choice, with σ̂ taken from the MAD of the series'
first differences (using differences rather than levels means a genuine level shift
inflates σ̂ by one point out of ~100 instead of by the whole shift, so the penalty is
not talked up by the thing being detected). `min_size = 12` months: a break must hold
for a year to count as structural. **Binary segmentation is run with identical cost,
penalty and min_size as a cross-check** and its answer is reported next to PELT's.

All parameters are module constants, fixed before any region's answer was seen.

### What came out

**292 breaks across 106 of the 111 regions. 250 raise the overnight ratio, 42 lower
it.** Among the 85 "clean" primary breaks (excluding COVID-window and edge-of-window
ones), the night-vs-day decomposition — comparing the 12 months either side in MW, so
seasonality cancels exactly — splits:

| what moved at the break | n |
|---|---:|
| night grew faster than the day | 50 |
| night grew while average demand fell | 16 |
| day fell faster than the night | 11 |
| day grew faster than the night | 5 |
| both fell | 3 |

### The named regions

Sites mapped is the count from `facilities.csv`; 2025 mean demand from the shipped
export, quoted for scale only.

**Northern Virginia — PJM/DOM (Dominion), 15.4 GW, 9 mapped sites.**
Overnight ratio **0.8625 (2019) → 0.9116 (2025), +4.9 points.** There is no single
break. PELT finds a **staircase**:

| date | magnitude | σ | night Δ | average Δ | reading |
|---|---:|---:|---:|---:|---|
| 2019-11 | +1.41 pts | 1.7 | +0 MW (+0.0%) | −201 MW (−1.7%) | night held while the day fell |
| 2021-11 | +0.99 pts | 1.2 | +571 MW (+5.3%) | +516 MW (+4.2%) | night grew faster than the day |
| 2023-05 | +1.24 pts | 1.5 | +573 MW (+4.9%) | +473 MW (+3.6%) | night grew faster than the day |
| 2025-06 | +1.41 pts | 1.7 | +1,151 MW (+8.6%) | +1,115 MW (+7.6%) | night grew faster than the day |

Binary segmentation does not reproduce the 2025-06 step. **Dominion did not step; it
ramped, in four roughly equal increments, accelerating.** That is a more interesting
answer than a single date, and it is the honest one: "when did Northern Virginia go
flat" has no single answer, and any headline that gives one would be wrong.

**ERCOT — and read the zone names carefully.** "ERCOT North" is ambiguous in EIA-930
and the two candidates give different answers:

| region | what it is | 2025 mean | sites | ratio 2019 → 2025 | primary break |
|---|---|---:|---:|---|---|
| **ERCO/NRTH** | the zone literally named *North* (Wichita Falls corridor) | 1.9 GW | **0** | 0.8605 → 0.9179 (**+5.7 pts**) | **2022-01, +3.50 pts, 3.4σ**, binseg agrees exactly |
| **ERCO/NCEN** | *North Central* — the Dallas–Fort Worth metro | 15.5 GW | 6 | 0.8481 → 0.8597 (+1.2 pts) | 2022-01, +1.18 pts, 1.1σ, binseg agrees |
| ERCO/FWES | Far West — the Permian Basin | 7.6 GW | 4 | 0.9666 → 0.9804 (+1.4 pts) | 2020-11, +1.29 pts, 3.5σ |
| ERCO | whole BA | 55.7 GW | 13 | 0.8634 → 0.8879 (+2.5 pts) | 2023-07, +1.35 pts, 1.5σ |

ERCO/NRTH's 2022-01 break is the cleanest single result in this file: +3.50 points at
3.4σ, confirmed by an independent segmentation, with overnight MW up 24.0% against
average MW up 20.0% over the twelve months either side. **And our own site lookup has
zero datacenters in it.** Either the lookup has a gap in the ERCOT zone with the
sharpest flattening in Texas, or something other than a datacenter is doing it — a
1.9 GW zone is small enough that a few hundred MW of crypto mining or oilfield
electrification would do this. Both possibilities are worth chasing; neither is
resolved here. (The shipped detector, computed independently, ranks ERCO/NRTH **1st**
of 111.)

**Omaha — SWPP/OPPD, 1.9 GW, 2 mapped sites.**
Overnight ratio **0.8571 → 0.8907, +3.4 points.** Another staircase, and the steps get
bigger every time:

| date | magnitude | σ | night Δ | average Δ |
|---|---:|---:|---:|---:|
| 2019-10 | +0.66 pts | 1.1 | +27 MW (+2.4%) | +23 MW (+1.7%) |
| 2022-01 | +0.76 pts | 1.3 | +65 MW (+5.2%) | +58 MW (+4.0%) |
| 2023-12 | +1.22 pts | 2.0 | +136 MW (+10.2%) | +137 MW (+8.8%) |
| **2025-05** | **+1.42 pts** | **2.4** | +188 MW (+12.1%) | +188 MW (+10.7%) |

Every step is "night grew faster than the day," and the primary (2025-05) is confirmed
to the month by binary segmentation. Consistent with flat load arriving in Omaha in
waves rather than at once; not proof of what that load is.

**PJM/AEP** (7 sites): 2021-11 (+1.04 pts) then **2025-01 (+1.49 pts, 1.9σ**, binseg
says 2024-12), with overnight MW +9.3% against average +7.9%.
**PJM as a whole** (96 GW): 2020-04 (COVID-flagged), 2022-02, then 2024-12 (+0.83 pts,
overnight +3,828 MW).

### The top of the table

The 20 largest primary breaks, excluding the COVID window and edge-of-window breaks
(85 of 106 primaries survive both filters):

| region | date | pts | σ | binseg | what moved | sites |
|---|---|---:|---:|---|---|---:|
| AZPS | 2025-02 | +7.04 | 7.1 | ✓ | night grew faster | 3 |
| CISO/PGAE | 2022-07 | +4.87 | 5.6 | ✓ | night grew faster | 1 |
| NYIS/ZONE | 2025-06 | +4.67 | 4.2 | ✓ | night grew, average fell | 0 |
| WALC | 2020-11 | +4.64 | 1.9 | ✓ | night grew faster | 0 |
| CISO | 2022-07 | +4.55 | 6.8 | ✗ | night grew faster | 1 |
| TEPC | 2020-12 | +4.15 | 2.9 | ✓ | day fell faster | 0 |
| ISNE/4001 | 2025-03 | +3.66 | 5.8 | ✓ | night grew, average fell | 0 |
| **ERCO/NRTH** | **2022-01** | **+3.50** | **3.4** | ✓ | night grew faster | **0** |
| SWPP/GRDA | 2023-08 | −3.34 | −3.6 | ✓ | day grew faster | 1 |
| PJM/PN | 2022-10 | +3.21 | 5.2 | ✗ | night grew, average fell | 1 |
| WACM | 2022-09 | +2.99 | 4.2 | ✓ | night grew faster | 2 |
| ERCO/EAST | 2025-01 | +2.98 | 2.3 | ✓ | night grew faster | 0 |
| ISNE/4003 | 2025-07 | +2.96 | 2.6 | ✓ | night grew faster | 0 |
| NYIS/ZONC | 2025-07 | +2.81 | 4.0 | ✓ | night grew, average fell | 2 |
| ERCO/WEST | 2025-05 | +2.80 | 2.2 | ✓ | night grew faster | 1 |
| NYIS/ZONF | 2025-07 | +2.57 | 3.4 | ✓ | night grew, average fell | 0 |
| NYIS/ZONB | 2022-09 | +2.39 | 2.8 | ✓ | day fell faster | 0 |
| NYIS/ZONI | 2024-09 | +2.23 | 3.3 | ✓ | night grew faster | 0 |
| NYIS/ZONG | 2022-09 | +2.22 | 2.3 | ✓ | day fell faster | 0 |
| SC | 2020-09 | +2.22 | 2.5 | ✓ | night grew faster | 1 |

AZPS's +7.04 points is the largest in the file and should be treated with the caution
`CLAUDE.md` already attaches to AZPS. This is a demand-side measurement, so it is not
the known generation-side artefact — but a region with one confirmed reporting problem
deserves a second look before its demand-side result is quoted.

### Do the breaks cluster in time? No.

- **Largest number of primary breaks in any 6-month calendar window: 16 observed vs
  14.9 expected** under a seeded uniform null (each region's break index drawn
  uniformly over its own searchable range, 10,000 simulations, seed 20260920).
  **p = 0.310.**
- Kolmogorov–Smirnov against uniform *relative* position: D = 0.149, **p = 0.017** —
  there is some departure from uniform, and inspection of the half-year histogram
  attributes it mostly to the 2020 pile-up, which is COVID.
- **Site regions vs the rest, break date:** Mann-Whitney **p = 0.911** (medians
  2022-07 vs 2023-03).
- **Site regions vs the rest, magnitude:** Mann-Whitney **p = 0.689** (+1.31 vs
  +1.37 points — the non-site regions are marginally larger).

Primary breaks by half-year, site-region share in brackets:

```
2019H1   3 [0]     2021H1   3 [0]     2023H1   4 [0]     2025H1  12 [7]
2019H2   3 [2]     2021H2   6 [2]     2023H2   7 [3]     2025H2  10 [4]
2020H1  13 [6]     2022H1  12 [8]     2024H1   5 [2]
2020H2   7 [4]     2022H2   8 [5]     2024H2  13 [3]
```

There are visible bumps in 2020H1 (COVID), 2022H1 and 2024H2–2025H1. The 2022H1 and
2025H1 bumps do carry a higher site-region share (8/12 and 7/12). But the formal test
does not clear chance, and with 48 of 111 regions carrying a site the base rate is
already 43%, so 8/12 is roughly two regions above expectation. It is a hint, not a
result, and it is written down here as a hint.

### The 2020 control, and two more that are just as important

**COVID.** 23 of 292 breaks and **13 of 106 primary breaks fall in 2020 H1** and are
flagged `covid_suspect`. They are excluded from the tables above rather than counted.
The mechanism is visible in the decomposition: PJM's 2020-04 break has overnight MW
*up* 259 MW while average demand fell 838 MW — commercial daytime load collapsing, not
night load arriving. Anything in that window is a pandemic artefact until shown
otherwise.

Two further artefact classes were found and are flagged in the output, because they
would otherwise have been quoted as findings:

**Edge-of-window breaks.** 24 of 292 breaks (8 primaries) sit at the first or last
index PELT is allowed to search. **Fifteen regions break at exactly 2025-09** — which,
for a series ending 2026-08 with `min_size = 12`, is the last legal position. That is
where the algorithm parks a trend it cannot resolve, not fifteen simultaneous events.
Flagged `edge_of_window` and kept out of the headline tables.

**Dates shared by many regions.** Any month where ≥ 10 regions break is listed as a
warning:

| date | regions | status |
|---|---:|---|
| 2020-04 | 17 | COVID |
| **2022-01** | **15** | interior — unexplained |
| 2025-09 | 15 | edge-of-window artefact |
| 2022-09 | 14 | interior — unexplained |

**2022-01 is the one that should bother a careful reader.** AVA, BPAT, EPE, four ERCOT
zones, MISO/0035, NYIS, PJM/AE, SWPP and three SPP zones all break in the same month,
at interior indices 36–48 — nowhere near a search boundary. Fifteen regions across
five interconnections do not change behaviour on the same January for the same
physical reason. Either something changed in EIA-930 reporting or PUDL imputation in
January 2022, or the calendar-month seasonal adjustment is anchoring on January in a
way this analysis has not diagnosed. **It is not resolved here.** ERCO/NRTH's headline
break is one of the fifteen, which is a caveat on the strongest result in this file.
2022-09 (14 regions, almost all ISO-NE and NYISO) has the same problem.

### Cross-check against announced years

Fifteen rows of `facilities.csv` name a year somewhere in their free-text note. That
field is prose, not a schema field: some years are build dates, some are acquisitions,
some are grid-mix figures for a year. The nearest changepoint to each is therefore
listed with the note, for a human to judge, and nothing downstream trusts it.

| company | metro | region | note year | nearest break | gap |
|---|---|---|---:|---|---:|
| Stronghold (Vulcan) | Venango Co., PA | PJM/PN | 2025 | 2025-03 | **+2 mo** |
| IREN | Sweetwater, TX | ERCO/WEST | 2025 | 2025-05 | **+4 mo** |
| Meta | Prineville, OR | PACW | 2019 | 2019-07 | +6 mo |
| Riot Platforms | Rockdale, TX | ERCO | 2023 | 2023-07 | +6 mo |
| TeraWulf | Lansing, NY | NYIS/ZONC | 2026 | 2025-07 | −6 mo |
| Meta | Prineville, OR | PACW | 2025 | 2025-09 | +8 mo |
| Nebius | Independence, MO | SWPP | 2026 | 2024-12 | −13 mo |
| Meta | Los Lunas, NM | PNM/PNM | 2018 | 2019-07 | +18 mo |
| Microsoft | Quincy, WA | GCPD | 2025 | 2023-05 | −20 mo |
| Google | Moncks Corner, SC | SC | 2025 | 2023-05 | −20 mo |
| CoreWeave | Denton, TX | ERCO/NCEN | 2025 | 2022-01 | **−36 mo** |

Four land within six months. **But three of those four are sites whose own notes say
the load is behind the meter or interruptible and therefore invisible to EIA-930** —
Stronghold's Venango waste-coal plant, IREN Sweetwater (whose note says the
substations energise in 2026–27, so there is no load yet), and Riot Rockdale (which
curtails). A changepoint that "matches" an announced date at a site EIA-930 cannot see
is a coincidence, and counting it would be self-deception. The honest read of this
table is: **no alignment strong enough to claim, and the near-misses are mostly at
sites where alignment is not physically possible.**

---

## 4. Post-hoc comparison with the shipped detector

Only after both questions were finished. Spearman rank correlation, n = 111 (106 where
a primary changepoint exists):

| detector score vs … | ρ | p |
|---|---:|---:|
| 2019→2025 change in overnight ratio | **+0.655** | 6.2 × 10⁻¹⁵ |
| PC1 change 2019→2025 (flattening) | **−0.569** | 6.9 × 10⁻¹¹ |
| primary changepoint magnitude | +0.346 | 2.8 × 10⁻⁴ |
| PC1 in 2025 (level flatness) | −0.306 | 1.1 × 10⁻³ |

The signs are right (a higher detector score goes with a bigger rise in the overnight
ratio and a bigger *fall* in PC1, which is flattening) and the top two are strong.
**The detector is measuring something real and an independently built pipeline
recovers it.** This is the strongest positive result in this file, and it is a result
about the detector, not about datacenters.

The detector's top 10, with what this module independently says:

| # | region | shape cluster 2025 | primary break | ratio change 2019→2025 |
|---:|---|---:|---|---:|
| 1 | ERCO/NRTH | 1 | 2022-01 (+3.50) | +5.74 pts |
| 2 | ERCO/FWES | 1 | 2020-11 (+1.29) | +1.37 pts |
| 3 | AZPS | 0 | 2025-02 (+7.04) | +7.89 pts |
| 4 | TEPC | 0 | 2020-12 (+4.15) | +9.10 pts |
| 5 | WACM | 1 | 2022-09 (+2.99) | +3.03 pts |
| 6 | PJM/DOM | 1 | 2025-06 (+1.41) | +4.91 pts |
| 7 | SWPP/OPPD | 1 | 2025-05 (+1.42) | +3.36 pts |
| 8 | ERCO | 1 | 2023-07 (+1.35) | +2.45 pts |
| 9 | SC | 1 | 2020-09 (+2.22) | +3.22 pts |
| 10 | CISO/SDGE | 0 | 2025-09 (−7.79, edge) | +9.46 pts |

Note that only 3 of the detector's top 10 sit in the flattest shape cluster. A region
can be *becoming* flat fast while still being peakier than New England in absolute
terms. Level and trend are different questions, and the detector asks about trend.

---

## 5. What this does not establish

- **It does not establish that datacenter load has a distinguishable shape at
  balancing-authority resolution.** It establishes the opposite, at this resolution,
  with this site list: mapped-site regions do not fall into a load-shape cluster more
  than chance, in any of 50 tests. That is a finding against our own premise.
- **The null is a statement about aggregation as much as about datacenters.** A
  500 MW campus inside a 96 GW balancing authority moves the annual-mean 24-hour
  profile by half a percent. The test had weak power by construction, and 48 of 111
  regions carrying a site made it weaker. A null here is not evidence that datacenters
  lack a shape; it is evidence that **this instrument cannot see one at this scale.**
  Nodal or utility-level data would be the way to ask the question properly.
- **A changepoint is a change in the data. It is not proof of its cause.** Every date
  in section 3 is "consistent with" something new arriving on the system, and nothing
  here distinguishes a datacenter from a crypto mine, an oilfield electrification
  programme, a large industrial customer, a reporting change or a seasonal-adjustment
  artefact. Two of the four most common break months in this file are demonstrably
  artefacts.
- **2022-01 is unexplained.** Fifteen regions across five interconnections break in
  that month at interior indices. Until that is diagnosed, every 2022-01 break in this
  file — including ERCO/NRTH's headline result — carries a discount.
- **The site list is not a ground truth and is not fully blind.** 134 hand-mapped
  sites, 9 of whose notes reference the detector, 15 of which describe load EIA-930
  cannot see at all. Regions with no mapped site are treated as negatives, and some of
  them certainly host datacenters we have not mapped — ERCO/NRTH being the obvious
  candidate. Every enrichment p-value in section 2 inherits that.
- **The overnight ratio rises almost everywhere.** 250 of 292 breaks are positive and
  the national picture is a steady climb from 2018 to 2025. Any single region's rise
  has to be read against that background, not against zero. The regions with the
  *largest* rises are mostly NYISO, ISO-NE and CAISO zones where the *day fell* —
  distributed solar, the opposite mechanism.
- **This module measures demand only** and never touches generation, so it says
  nothing about what is burned to serve any of this. It does not allocate interchange,
  and regions are as coarse here as everywhere else in Wattson.
- **`min_size = 12` months means nothing faster than a year is visible.** A datacenter
  that ramps over six months and then holds would be seen; one that arrives and leaves
  inside a year would not.
