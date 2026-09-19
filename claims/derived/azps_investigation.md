# AZPS: the overnight clean-energy collapse is not real

**Finding.** Arizona Public Service's overnight carbon-free share did not fall from
0.62 to 0.10. It was never 0.62. The 2019 baseline counted the output of a nuclear
plant that Salt River Project was reporting at the same time, hour for hour. On
**2019-12-04** that generation stopped being attributed to AZPS, and the apparent
87% collapse is the removal of the duplicate.

Corrected for the duplication, AZPS overnight clean share has **risen** every year:

| Year | Published overnight CF share | On a consistent basis (excl. nuclear) |
|---|---|---|
| 2019 | 0.620 | **0.017** |
| 2020 | 0.015 | 0.015 |
| 2021 | 0.037 | 0.037 |
| 2022 | 0.067 | 0.067 |
| 2023 | 0.102 | 0.102 |
| 2024 | 0.117 | 0.117 |
| 2025 | 0.104 | 0.100 |
| 2026 (Jan–Sep 5) | 0.174 | 0.160 |

The published series says AZPS got six times dirtier overnight. On a like-for-like
basis it got roughly six times cleaner. **The number we publish is wrong in
direction, not just magnitude.**

## 1. The date, and why it is a reporting change

- Last hour with AZPS nuclear generation: **2019-12-04 07:00 UTC, 3,974 MW.**
- From 2019-12-04 08:00 UTC the value is missing (NaN), continuously, for 17 months.
- From May 2021 onward it is reported as a literal **0**, and still is in 2026.
- Every other AZPS fuel continues across the date. Coal dips in early 2020 and
  recovers to ~970 MW by June 2020 — operational variation plus the Navajo
  Generating Station closure, not a break. Gas is continuous.

A step on one date is a reporting artefact; a decline over months is a grid event.
This is a step. Palo Verde, the largest nuclear station in the United States, did
not shut down in December 2019 — and SRP keeps reporting it throughout.

## 2. What was double-counted, and how we know

Through 2019 **AZPS and SRP each reported the same ~3,900 MW**:

| Measure | Value |
|---|---|
| Hours in 2019 both reported nuclear | 7,976 |
| Correlation, AZPS vs SRP | **0.9948** |
| Mean absolute difference | **2.8 MW** |
| Hours identical within 5 MW | **98.8%** |
| Combined output, Jun–Dec 2019 | **7,087 MW** |
| Palo Verde nameplate | **3,937 MW** |
| Combined output, Jan–Jun 2020 | 3,637 MW |

Two BAs reported the same plant, minute for minute, and their sum was about **1.8
times the plant's physical capacity**. That is not possible as real generation.
After the correction the total is ~3,637 MW: one plant at a normal capacity factor.

Corroborating: reported US nuclear across all BAs peaked at **103,352 MW** before
the break and **96,828 MW** after, against a fleet of roughly 95–97 GW. The
pre-break figure exceeds the physical fleet. (Treated as supporting rather than
decisive, since winter output legitimately exceeds summer ratings.)

## 3. The corrected baseline

AZPS overnight clean generation in 2019 was **~35 MW**, not 3,373 MW — solar only,
with the nuclear removed. Overnight carbon-free share was **0.017**, not 0.620.

## 4. What this affects in what we publish

| Output | Effect |
|---|---|
| `cf_share` 2019 for AZPS | **Wrong.** 0.620 should be ~0.017. |
| `cf_avg_mw` 2019 overnight | **Wrong.** 3,373 MW should be ~35 MW. |
| `fuel_delta_overnight_gw.nuclear` = −3.61 | **Wrong.** Describes a duplicate being deleted, not fuel being displaced. |
| `siting.change_since_2019` = −0.517 | **Wrong sign.** Should be about +0.08. |
| `siting.ratio_slope_per_year` = −0.1105 | **Wrong sign.** Driven entirely by the bogus 2019 point. |
| `siting_rank` 49 of 52 | **Too low**, for the same reason. |
| `trailing12` overnight series | First 18 points inflated; the 2019→2021 "decline" is the artefact. |
| `profile_24h` 2019 | Inflated across all hours. |
| **`detection` rank 3, score 9.01** | **Unaffected.** Demand-only: demand, load factor, neighbour divergence. No generation term. Safe. |
| `demand`, `interchange` | Not recomputed here; interchange swings ~4 GW across the same date and deserves the same scrutiny. |
| `data_flags` = `[]`, `exclude_from_alerts` = `false` | **AZPS currently ships with no warning at all.** The caveat exists in CLAUDE.md but not in the data. |

Recommended handling: treat AZPS generation-side history as beginning **2021-01-01**,
or drop nuclear from its 2019 baseline. Either way, stop publishing a decline.

## 5. WACM: not the same signature

Checked with the same method. WACM has **no step break** in coal, its dominant fuel.
Its anomaly is demand-side and gradual: demand rises from ~2,300 MW (2021) to
~4,000 MW (Dec 2022) over roughly six months, generation rises with it, and exports
fall from ~1,400 MW to ~400 MW. A ramp, not a step — consistent with real load
arriving, not with a reporting change. **WACM remains unexplained** and its existing
flag should stay.

Two anomalies, two different mechanisms. One is now explained.

## Confidence

**Proven.** AZPS and SRP reported the same generation hour by hour in 2019
(r = 0.995, identical within 5 MW in 98.8% of hours). Their combined output is
~1.8× the plant's nameplate. The transition is a step on a single date.

**High-confidence inference.** The plant is Palo Verde — the only nuclear station in
Arizona, magnitude matches nameplate, profile flat across all hours. Not confirmed
against plant-level EIA-860 data. EIA corrected the attribution so the plant counts
once, under SRP.

**Not established.** Why the correction happened on that date, and why the series
was missing for 17 months before becoming zero.

## Reproducing

```bash
python3 -m engine.diagnostics.azps     # writes the .json beside this file
```

Needs `data/pudl/core_eia930__hourly_net_generation_by_energy_source.parquet`,
fetched anonymously from the public bucket `s3://pudl.catalyst.coop`. No
credentials and no remote host required — the raw data is publicly downloadable in
about 20 seconds, which is worth knowing, because the team had assumed it was
unavailable on this machine.

## One more thing, checked and clear

Step breaks appear in solar, wind and hydro for many BAs on **2024-07-02**. That is
the EIA fuel-category split (`solar` → `solar_wo_integrated_battery_storage`, and
the same for wind and hydro). `scripts/carbon_free_index.py` already sums both the
parent and child categories, so published shares are unaffected. Checked rather than
assumed — a rename like that would otherwise have shown up as a nationwide clean
collapse in mid-2024.
