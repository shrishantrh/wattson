# Wattson — Voloridge submission

> **A greenwashing investigation of datacenter operators — settled against 4.45 million
> hours of federal meter data.**

Dataset: Public Utility Data Liberation Project (PUDL), EIA-930 hourly. Fetched with
Voloridge's own `src/pudl/fetch.py`, used unmodified — byte-identical to the copy in
`scripts/vendor/pudl_fetch.py`. Reproduced end to end on a Voloridge EC2 instance.

---

## Signal in the noise, literally

Every AI datacenter operator says it runs clean. Nobody had checked against the meter,
because the claim is a sentence in a PDF and the answer is 4.45 million hourly rows across
70 balancing authorities. We joined them.

**The signal is invisible at the resolution everyone reports at.** Annual totals say US
grids got cleaner — and they did. Separate the hours and the story inverts: the day gained
9.3 points since 2019 while the night lost 0.8. A datacenter draws the same power at 3am
as at noon, so roughly half of AI's electricity lands in the half of the day that never
improved.

**At annual resolution this finding does not exist.** That is the whole result.

What it cost to see it: **ten data traps** that each produce a clean-looking wrong number
rather than an error, **one of our own published figures wrong in direction**, a **69-BA
sweep** and a **4,430-pair duplicate search** to establish that error was unique, and an
independent cross-check against figures Google computes separately.

---

## The finding

**In PJM — the grid serving the largest datacenter cluster on earth — overnight clean generation has
not increased since 2019. Every added gigawatt of overnight generation was fossil.**

| PJM, 00:00–05:59 local | 2019 | 2025 |
|---|---|---|
| Clean generation | 35,700 MW | 35,619 MW |
| Total generation | — | **+8.7 GW** |
| Net exports | 3,814 MW | 2,489 MW |

2025 clean generation is within 100 MW of 2019 (81 MW apart) while total grew 8.7 GW. The path
between them is not flat: the series runs 34,316-36,299 MW and 2020 sits 1,384 MW below 2019. The
claim is about the endpoints, seven years apart, and we state it that way. Exports *fell* 1.3 GW, so that growth
served PJM's own load rather than leaving the footprint. The gap is fossil.

Why it has gone unnoticed: the environmental story of AI is told in annual totals, and totals hide
it. Solar cleaned up the middle of the day and did nothing for the middle of the night. A datacenter
draws the same power at 3am in January as at noon in June, so roughly half of AI's demand lands in
hours that have not improved in seven years.

Nationally the same split: overnight clean output rose from 155.7 to 173.4 GW — up 17.7 GW — but
overnight *total* rose faster, so overnight share slipped 0.397, flat. Daytime share went
0.372 → 0.465. The share fall must never be shown without the absolute rise beside it: clean
generation grew, it just grew slower than demand.

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

**9. A ranking that was secretly a tautology.** Our first alert-prioritization pass scored missing
persistence and recency values as 1.0. Structural alerts have no such values, so they got a free
pass on two of three factors and swept the top eight slots — the "prioritized" screen was the
detector ranking relabelled, and it looked entirely reasonable. Unknown factors now score at the
population median, so missing data is never an advantage.

**The common thread:** every one of these produces a clean-looking number rather than an error. The
check that catches them is not "did the code run" but "what would this look like if the pipeline were
silently broken, and does it look like that?"


---

## Every guard we built was blind to something

This is the part we would most want another team to take away, and it is the challenge's
own thesis turned on the people doing the work. We built eight checks. Each one caught
real problems. **Not one of the eight most serious failures was caught by a test.** Every
one was caught by reading an output and asking why it looked the way it did.

**A page-fidelity audit that could not see reading order.** We verified all 309 page
citations against the source: zero mismatches. The check compared each chunk against *the
same extraction that produced it*, so it proved the chunk came from that page while the
words within it were scrambled. A self-consistent check cannot detect a systematic bias in
the instrument it checks with.

**A verbatim guard that could not see corruption.** Downstream, a second guard required
every quote to appear character-for-character in its chunk. It caught 20 model
paraphrases. It cannot prove the chunk matches the document — a spliced quote passes it
perfectly. Two guards, one blind spot each, stacked in the same direction.

**An acceptance test that was insufficient.** We specified four pages that had to come out
clean. A rewrite passed all four and silently broke a fifth — the page four of eight
findings cite — because a heading ended exactly where a column began. A page can satisfy a
targeted substring check and be mangled two inches higher up.

**Synthetic tests that passed while reality failed.** The 10-K section slicer passed every
test we wrote, while three of four real filings sliced wrong: 759 words instead of 11,754;
a 52,000-word run-on; a 367-word truncation. Tests only test what you imagined.

**A ranking that was secretly a tautology.** Our alert prioritizer scored missing values
as 1.0, so structural alerts got a free pass on two of three factors and swept the top
eight slots. The "prioritized" screen was the detector ranking relabelled. Every test
passed. It was caught by noticing the ordering looked too tidy.

**A sweep that missed the thing it was built to find.** Our first pairwise duplicate
detector swept 2019–2026 in one window and did not find AZPS/SRP, the pair it existed to
confirm, because the duplication *ended* and the post-break period destroys the
correlation. It also reported a false positive on two solar series that match trivially in
the dark.

**A derived field that overwrote its own source.** The falsifiability cap was not
idempotent: re-running it read the capped value back into the field holding the model's
original score, destroying the record of what the model actually said. Caught because two
numbers moved that had no business moving. A model's score is a fact about a past API
call; if it changes, something is overwriting history.

**A shim that silently dropped an argument.** Our pandas-2 compatibility layer ignored a
`columns=` parameter, so scripts asking for four columns received all six. That one failed
loudly. Had it failed quietly it would have produced numbers instead of an error.

**The through-line.** Every one of these produces a plausible result rather than a crash.
The question that caught them is never "did the tests pass" — they did — but *why does
this output look the way it does?* Why is this ordering so tidy. Why did this company
return zero findings when it makes the same claim as the others. Why did a number change
that cannot change. Why is the sum of two balancing authorities larger than the power
plant.

That question is the whole job. The data traps in EIA-930 are the same shape as the traps
in our own code, and neither announces itself.

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
  Virginia 0.436, Phoenix 0.449. Phoenix's published score of 0.173 is corrected: it rests on the
  AZPS figures fixed below, and the API applies the correction and returns both values.
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
- Zones inherit the parent BA's generation figures; zones report demand only. This is a trap we
  walked into ourselves: PJM/DOM's `fuel_delta_overnight_gw.gas` reads 10.74 GW, but that is PJM's
  figure, byte-identical across every PJM zone. Dominion's OWN overnight demand grew 3,973 MW,
  roughly half of PJM's 8.7 GW overnight growth. Say PJM-wide gas rose 10.74 GW and Dominion's own
  overnight demand rose about 4 GW. Never attribute the 10.74 to Dominion.
- The detector cannot distinguish a datacenter from a crypto mine.
- Facility and operator mapping is hand-curated. Operator tickers are unverified.
- Hourly data updated with each release. PUDL is a snapshot ending 2026-09-05, not a live feed.
- Dominion's roughly +4 GW overnight is about half of PJM's overnight growth. Half, not all.

---

## We swept the whole dataset for the bug we found

Finding one reporting error is an anecdote. We turned it into a method and ran it across
every balancing authority.

**69 BAs swept. One permanent material break in a carbon-free fuel in the entire dataset:
AZPS nuclear. One case of two BAs reporting the same generation hour by hour: AZPS and
SRP, correlation 0.9953, identical within 5 MW in 97.8% of hours over the 180 days before
the break. No other pair comes close.**

48 clean, 1 coverage gap, 20 with a break in a minor fuel. PJM, ERCOT, CAISO, TEPC, WACM,
SC, SOCO, DUK, TVA, SCEG and BPAT are all clean, so nothing under the headline finding is
affected.

**What was actually wrong with AZPS.** Through 2019, Arizona Public Service and Salt River
Project each reported the same roughly 3,900 MW of nuclear. Their combined output was
about 1.8 times Palo Verde's nameplate capacity. Last hour reported 2019-12-04 07:00 UTC,
then 17 months of nulls, then a literal zero. Every other AZPS fuel continues across that
date. A step on one date, not a decline.

Consequence: our own published figure said AZPS overnight clean share **fell** from 0.620
to 0.104. On a consistent basis it **rose** from 0.017. **Wrong in direction, not
magnitude.** It is corrected in the product as an overlay that shows the published value,
the corrected value and the evidence side by side, rather than silently swapped.

**Four false-positive classes had to be eliminated first.** Each would have been a wrong
public claim about a named grid operator.

*Pre-2019 coverage.* The first PJM run flagged a break in every fuel on 2018-07-11, which
would have read as a catastrophe under our biggest region. PJM simply stops reporting: 251
of 365 days null in 2018, 1 of 2,806 from 2019 onward. Chasing it produced the
discriminator the sweep now rests on: **every fuel stopping together means the BA stopped
reporting; one fuel stopping while the others continue means the generation was
reattributed.** Only the second is a finding.

*Refuelling outages.* A 30-day window flagged nuclear at BPAT, NYISO, SCEG and SPP. All
four resume — nuclear refuelling runs past thirty days. Only AZPS never comes back.

*The 2024 category split*, already known, excluded by fuel and date.

*A seasonal artefact in our own method.* A 60-day before/after comparison cannot detect
reattribution at all. It confidently "explained" nearly every candidate, because national
gas swings tens of gigawatts seasonally and the test simply names whichever large BA
happened to rise. Only direct hour-by-hour pair comparison works. We nearly shipped the
version that was wrong twenty times over.

**Trap 10: the `reported` generation column contains integer-overflow sentinels.** 75
hours carry values like 429,497,248 MW and 2,576,980,992 MW, against roughly 450,000 MW of
total US generation. `net_generation_adjusted_mwh` has zero such hours and is the column
the pipeline uses, so our results are unaffected — but that choice is now verified rather
than assumed. Anyone reaching for the reported column gets a 2.5-billion-megawatt hydro
hour in BANC.


### Testing our own claim at full scale, on your hardware

We published a claim: the AZPS/SRP double-count was the only pair of balancing
authorities reporting the same generation as each other. That came from investigating
Arizona and then checking its neighbor. It had never been tested exhaustively.

So we tested it. **Every unordered pair of balancing authorities, every fuel, every hour
both report, in 90-day windows stepped 30 days: 4,430 pairs with enough data across
580,410 window comparisons, nine workers on the 48-core instance, 17.1 seconds.**

34 pairs exceed 0.90 correlation. **Two are actual duplicates.**

| Pair | Fuel | Correlation | Identical within 5 MW | Combined |
|---|---|---|---|---|
| **AZPS / SRP** | nuclear | **0.999982** | **99.58%** | 7,746 MW vs a 3,937 MW plant |
| PNM / TEPC | solar | 0.94 | 51% | 145.7 MW |

The Arizona duplication is now established by exhaustive search rather than by
investigation. The second is small, affects no published figure, and we name it as a
**candidate** rather than a finding.

**The first version of this sweep had two bugs, and both are the point.**

It swept 2019–2026 as a single window and **missed AZPS/SRP — the very pair it was
written to find.** The duplication ended on 2019-12-04, and the post-break period, where
AZPS reads zero against SRP's 3,900 MW, destroys the correlation. *A duplication that
stops is invisible to a whole-period test.* Hence sliding windows.

It also reported BANC/PACW solar as a duplicate at "53% identical". Solar is zero at
night for both, so **any two solar series match trivially in the dark.** Hours where both
are near zero are now dropped before comparing.

And correlation alone is not evidence. LDWP/NEVP solar correlates at **0.979** and is not
a duplicate, because their values differ by 71 MW on average. Two balancing authorities
in one region share weather and load shape. **The discriminator is whether the numbers are
identical, not whether they move together** — a test built on correlation would have
produced dozens of false accusations about named grid operators.

---

## An independent check on the whole index

Google publishes grid carbon-free share per balancing authority in its environmental
report — the same quantity we compute from EIA-930, calculated independently, by a
different organization, from different inputs.

| BA | Google | Wattson |
|---|---|---|
| ERCOT | 46 | 46.1 |
| Duke | 57 | 57.5 |
| Southern | 33 | 32.5 |
| PJM | 40 | 39.3 |
| MISO | 36 | 34.9 |
| SPP | 47 | 45.6 |
| TVA | 47 | 48.7 |

**7 of 11 within 2 points, median difference −0.5 points.**

Three outliers are recorded as open questions rather than errors. The clearest, SC, is a
good illustration of a caveat we already publish: we read Santee Cooper's balancing
authority alone, while Google appears to aggregate it with SCEG next door, which holds the
jointly-owned nuclear. The outlier argues for the honesty of our regional caveat rather
than against the accuracy of the index.

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

Raw timings: `docs/voloridge/artifacts/ec2_run.log`.

The 3.7-second fetch is the in-region advantage: same AWS region as the PUDL bucket.

**The results are identical across a Python and pandas major version boundary.** The
development machine runs Python 3.14 with pandas 3; the instance runs Python 3.9 with
pandas 2.3.3. Every headline figure reproduced exactly:

| | Dev machine | Voloridge instance |
|---|---|---|
| Regions / detector-scored | 124 / 111 | 124 / 111 |
| Dominion rank, score | 6, 7.71 | 6, 7.71 |
| PJM overnight gas 2019→2025 | +10.74 GW | +10.74 GW |
| PJM overnight clean generation | 35,700 → 35,619 MW | 35,700 → 35,619 MW |
| National overnight CF share | 0.397, flat | 0.397, flat |

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
