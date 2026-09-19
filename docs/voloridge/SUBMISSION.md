# Wattson — Voloridge submission

**Where the AI buildout is landing, and what is burning to serve it.**

Dataset: Public Utility Data Liberation Project (PUDL), EIA-930 hourly.
Fetched with Voloridge's own `src/pudl/fetch.py`, used unmodified (byte-identical to the copy in
`scripts/vendor/pudl_fetch.py`).

---

## The finding

**In PJM — the grid serving the largest datacenter cluster on earth — overnight clean generation has
not increased since 2019. Every added gigawatt of overnight generation was fossil.**

| PJM, 00:00–05:59 local | 2019 | 2025 |
|---|---|---|
| Clean generation | 35,700 MW | 35,619 MW |
| Total generation | — | **+8.7 GW** |
| Net exports | 3,814 MW | 2,489 MW |

Clean generation flat within 100 MW while total grew 8.7 GW. Exports *fell* 1.3 GW, so that growth
served PJM's own load rather than leaving the footprint. The gap is fossil.

Why it has gone unnoticed: the environmental story of AI is told in annual totals, and totals hide
it. Solar cleaned up the middle of the day and did nothing for the middle of the night. A datacenter
draws the same power at 3am in January as at noon in June, so roughly half of AI's demand lands in
hours that have not improved in seven years.

Nationally the same split: overnight clean output rose 14 GW but overnight *total* rose 45 GW, so
overnight share slipped 0.405 → 0.397. Daytime share went 0.372 → 0.465.

This is not an accusation against any company. Annual renewable matching is a legitimate accounting
method under the GHG Protocol. It describes contracts. We measured physics.

---

## Scale

4.45 million hourly rows, 70 balancing authorities, July 2018 – September 2026. One hourly
carbon-free index, then a demand-only detector scoring 111 regions, then a siting score.

---

## The detector, and why its misses are reported

score = z(overnight_excess) + z(neighbor_divergence) + 0.5·z(load_factor_delta), robust z
(median/MAD). Regions under 500 MW average demand excluded. Peak is the 99.5th percentile hour.

**No company list appears anywhere in it.** It sees demand shape and nothing else.

Weights were fixed and the four validation regions named *before* the ranking was seen:

| Named in advance | Result |
|---|---|
| PJM/DOM (Dominion, N. Virginia) | rank 6 |
| SWPP/OPPD (Omaha) | rank 7 |
| PJM/AEP (central Ohio) | rank 19 |
| ERCO/NCEN (Dallas) | **rank 91 — missed** |

Two of four in the top seven, one at 19, one missed. Reported without tuning.

**Why Dallas was missed, stated rather than fixed:** neighbor divergence compares a zone against
adjacent zones in the same interconnection. Every ERCOT zone is booming, so a booming Dallas scores
as unremarkable *relative to its neighbors*. That is a property of the method, not a bug we hid.

**What the detector cannot do:** it finds flat 24/7 load in general. It cannot distinguish a
datacenter from a crypto mine or oilfield electrification. That is why West Texas ranks 2nd. We say
"consistent with datacenter load being served by gas," never "caused by."

---

## Data traps

Voloridge's challenge is about noisy data. Here is what this dataset does to you. The first five
were found building the index; the last four were found *today*, three of them in our own outputs.

**1. EIA split the fuel categories mid-dataset.** On 2024-07-01, hydro/solar/wind each split into
sub-categories. Old and new labels never co-occur in the same hour, so summing all of them is safe —
but summing only the old names silently truncates everything after July 2024, and the series still
looks plausible.

**2. Two corrupt Dominion hours read over a billion MWh.** October 2021, in the raw demand table.
Any mean computed over the raw table is destroyed and no error is raised. Fixed by using the
subregion table and `demand_imputed_pudl_mwh`.

**3. 98 million of 118 million rows are empty padding.** Real coverage starts 2018-07-01. A
row-count sanity check passes; the analysis is 83% nothing.

**4. Small BAs that generate nothing produce undefined or 0% shares.** Mapped to parent regions
rather than averaged in, which would have dragged national figures down.

**5. 2018 is a half year and 2026 ends 2026-09-05.** Naive year-over-year comparisons are
arithmetic on different window lengths. All comparisons are same-months or trailing-12.

**6. `heatmap_uri` is not a promise.** All 124 region records carry a non-null heatmap path; three
(AEC, OVEC, SWPW) point at files that do not exist. The existing UI survived by accident of
defensive coding. A schema that says a field is present does not say the file it names exists.

**7. A documented caveat that no program could see.** The Arizona Public Service generation break —
overnight clean share reading 0.62 in 2019 and 0.104 in 2025, an 87% collapse that is almost
certainly a reporting change — was recorded in our project notes as prose and nowhere machine-
readable. `data_flags` was populated for one region and empty for AZPS. Unhandled, that artefact
would have been the **single largest-magnitude alert on the demo screen**, and it is fake. Caught
one predicate before it shipped.

**8. A rule that violated our own frozen decision.** Six alerts were computed on 2026-09, a month
containing five days of data, while every other rule used 2026-08. Our own written rule says partial
months are dropped. The code did not know that.

**9. A ranking that was secretly a tautology.** Our first alert-prioritisation pass scored missing
persistence and recency values as 1.0. Structural alerts have no such values, so they got a free
pass on two of three factors and swept the top eight slots — the "prioritised" screen was the
detector ranking relabelled, and it looked entirely reasonable. Unknown factors now score at the
population median, so missing data is never an advantage.

**The common thread:** every one of these produces a clean-looking number rather than an error. The
check that catches them is not "did the code run" but "what would this look like if the pipeline were
silently broken, and does it look like that?"

---

## What we built with it

A monitoring tool that opens on results, not a prompt.

- **Ranked detector** — 111 regions scored on flat-load signature, each row carrying serving utility,
  parent company and ticker.
- **Region evidence** — 365×24 hourly heatmap, night-vs-day trend, overnight fuel mix by year,
  and which fuel filled the growth.
- **Siting score** — the actionable output. Overnight clean share today, its 2019–2025 slope, and
  overnight clean MW relative to overnight demand. Ask it where to put 300 MW of flat load across
  Phoenix, Northern Virginia and Omaha and it answers Omaha 0.737 (wind filled +4.16 GW), Northern
  Virginia 0.436 (gas filled +10.74 GW), Phoenix 0.173.
- **Claim verification** — company statements checked against the grid their sites physically draw
  from. Verdicts are `true_on_paper | contradicted | unfalsifiable | cannot_verify`, never "they
  lied," and `cannot_verify` carries an enumerated reason and a visible count.

Siting today is decided on land, fiber, tax abatement and interconnection speed. Grid mix is nowhere
in the decision. This is the data that would put it there.

---

## Where AI is and is not used

AI does exactly two jobs: extracting atomic claims from 10-Ks and ESG reports with structured output,
and retrieving contradictions between them.

Everything else is deterministic arithmetic over federal data, and that is the point. **The AI reads
the text; the physics comes from metered generation.** AI is deliberately kept out of the facility
lookup, where it produces confidently wrong balancing-authority mappings, and out of the detector.

---

## Limits, stated

- Generation within a footprint, not consumption. Interchange is not allocated.
- Average grid mix, not marginal emissions.
- Regions are coarse; PJM spans Chicago to New Jersey.
- Zones inherit the parent BA's generation figures; zones report demand only.
- The detector cannot distinguish a datacenter from a crypto mine.
- Facility and operator mapping is hand-curated. Operator tickers are unverified.
- Hourly data updated with each release. PUDL is a snapshot ending 2026-09-05, not a live feed.
- Dominion's roughly +4 GW overnight is about half of PJM's overnight growth. Half, not all.

---

## Reproducibility run on Voloridge compute

Re-ran the full pipeline end to end on a Voloridge-provided `i7i.12xlarge`
(48 vCPU, 371 GB RAM, Amazon Linux 2023), from raw PUDL parquet to final JSON.

| Step | Wall clock |
|---|---|
| PUDL fetch, 359 MB, 6 tables | **3.7 s** |
| `build_wide` (118,404,998 rows) | 13.7 s |
| `carbon_free_index` | 12.3 s |
| `overnight_profile` | 3.3 s |
| `l2_temporal` | 9.5 s |
| `l2_interchange` | 6.8 s |
| `l3_detector` | 19.3 s |
| `l4_supply` | 29.1 s |
| `export_json` | 5.7 s |
| **Total** | **under 2 minutes** |

The 3.7-second fetch is the in-region advantage: same AWS region as the PUDL bucket.

**The results are identical across a Python and pandas major version boundary.** The
development machine runs Python 3.14 with pandas 3; the instance runs Python 3.9 with
pandas 2.3.3. Every headline figure reproduced exactly:

| | Dev machine | Voloridge instance |
|---|---|---|
| Regions / detector-scored | 124 / 111 | 124 / 111 |
| Dominion rank, score | 6, 7.71 | 6, 7.71 |
| Dominion overnight gas 2019→2025 | +10.74 GW | +10.74 GW |
| PJM overnight clean generation | 35,700 → 35,619 MW | 35,700 → 35,619 MW |
| National overnight CF share | 0.405 → 0.397 | 0.405 → 0.397 |

**Two portability issues, reported rather than smoothed over.**

*The analysis needed no changes.* No file in `scripts/` was edited for this run. One
environment shim was required: pandas 2 cannot accept a dictionary-encoded column with
uint32 indices from pyarrow, so dictionary columns are decoded to their value type at
the parquet read. That is a representation change, not an analytical one.

*The shim's first version was wrong and the failure was loud, which is the point.* It
dropped the `columns=` argument, so scripts requesting 4 columns silently received all
6 — surfacing as `Length mismatch: Expected axis has 6 elements, new values have 4`.
Had it failed quietly instead, it would have produced numbers rather than an error.

*One genuine pandas-2/3 difference remains, and it is cosmetic.* `l4_supply` line 105
pretty-prints PJM's overnight fuel table. PJM reports no geothermal, and pandas 2 drops
the all-null column from the pivot where pandas 3 retains it, raising `KeyError:
['geothermal'] not in index`. Every output CSV is written before that line, so the
analysis completes and the failure is a display statement. Reported because a
"FAILED" in a log that turns out to be cosmetic is exactly the thing a reader should
be able to check rather than take on trust.
