# Statistics on the flat-load detector

The detector in `scripts/l3_detector.py` ranks 111 US grid regions on the electrical
fingerprint of new 24/7 load. The method was frozen on 2026-09-19, before the ranking was
seen, with four validation regions named in advance. What it never had was a null.
`grep -rn "permutation\|bootstrap\|p-value" scripts/ engine/` returned nothing, and
`docs/judges_qa_redteam.md` concedes the gap in four separate places. This closes it.

Everything below **measures** the frozen detector. Nothing below changes a weight, a
cutoff, or a rank. Where a test came out against the detector, the number is printed as it
came out.

Code: `engine/stats/`. Raw output: `engine/stats/results/stats_results.json`.
Reproduce: `python3 -m engine.stats` (20 minutes, seeds recorded below).

---

## Headline

**The ranking beats chance, but narrowly, and only in the most recent window.**

On the four pre-registered validation regions, the exact permutation p-value is **0.0488**
on mean score and **0.0571** on mean rank. It straddles 0.05: one of the two statistics
clears the conventional bar and the other does not. On the 2026 Jan-Aug holdout, data that
did not exist when the method was frozen, the same test gives **0.0157** and **0.0271**.
Run the identical frozen detector against 2021, 2022, 2023 and 2024 and **nothing clears
0.05**.

Two things follow. The signal is dated to 2024 onward, which is what the datacenter
reading predicts and is the strongest single result here. And the method has little power
before the buildout got large, which is a real limitation, not a framing choice.

The top 10 of the board is a stable object: 8 of its 10 members are still there on the
holdout, against 0.9 expected by chance. Ranks 11 to 111 are not an ordering; the median
95% rank interval below rank 10 is 29 places wide.

**Read the board as a screen with a measured false-positive rate, not as a hypothesis
test that has been passed.**

---

## Results table

| # | Question | Test | Number | Verdict |
|---|---|---|---|---|
| 0 | Does this code reproduce the shipped detector? | Recompute, compare to `web/public/api/region/*.json` | max abs score diff 6.2e-14 vs `detect()`, 0.00493 vs the export (which rounds to 2 dp), 0 rank mismatches of 111 | Reconciled |
| 1 | Better than chance? | Exact label permutation over all C(111,4) = 5,989,005 subsets | **p = 0.0488** (mean score), **p = 0.0571** (mean rank) | Marginal, straddles 0.05 |
| 1b | Still, given that zones nest inside scored parents? | Family-restricted permutation, 200,000 draws, 43 families | p = 0.0491 | Nesting does not change it |
| 1c | Do the three components agree more than chance? | Independent component permutation, 50,000 draws (post hoc) | top-10 mean 8.458 vs null 6.673, p = 2.0e-5 | Yes, strongly |
| 2 | Is the signal dated to the buildout? | Frozen detector, target year varied | p = 0.129 / 0.145 / 0.215 / 0.099 / 0.049 for 2021-2025 | Passes. Nothing pre-2025 clears 0.05 |
| 3 | How stable is a rank? | Circular block bootstrap, 7-day blocks, B = 10,000 | Dominion 6th, **95% CI 3rd to 7th**. Median rank CI width 3 in the top 10, 29 below it | Top 10 stable, middle is noise |
| 4 | Does it hold out of sample? | Spearman / Kendall vs the 2026 Jan-Aug ranking, n = 110 | **rho = 0.877** [0.795, 0.929], tau-b = 0.718 [0.634, 0.788]; top-10 overlap 8/10, p = 4.8e-9 | Holds |
| 5 | Do the intervals cover reality? | Coverage of the 95% rank CI against the holdout rank | **0.718** against a nominal 0.95 | **Fails.** See below |
| 6 | 111 regions, how many hits are luck? | Benjamini-Hochberg on per-region bootstrap p-values | 71 of 111 survive at q = 0.05, 82 at q = 0.10; all 10 of the top 10; expected false discoveries in the top 10 at most 0.5 | Survives, but see below |
| 7 | What is n, really? | ACF, Bartlett HAC, block bootstrap VIF | ESS median **118** of a nominal 8,760; iid SE understates by 8.6x | n = 8,760 is a fiction |

Seeds: master 20260920, per-test 20260921 to 20260929, all recorded in the results JSON.
Total runtime 1,153 s on an M-series Mac (Python 3.14.2, numpy 2.5.3, pandas 3.0.6).

---

## 0. The gate

Nothing here is worth reading unless this module reproduces the shipped ranking. It does
not copy the detector, it imports `scripts/l3_detector.py` and calls the shipped
`detect()`. It then builds a vectorised path for resampling and asserts, before any test
runs, that the two agree.

| Comparison | Max abs difference | Rank mismatches |
|---|---|---|
| vectorised path vs frozen `detect()` | 6.2e-14 on score | 0 of 111 |
| frozen `detect()` vs shipped export | 0.004932 on score | 0 of 111 |

The export rounds `detection.score` to two decimals, so 0.005 is the tightest bound
achievable against it and 0.004932 is exactly that. `core.verify()` raises rather than
continuing if this ever breaks.

---

## 1. Is the ranking better than chance?

**Question.** Did the detector put the regions we named in advance near the top for a
reason?

**Null.** The detector's components carry no information about which regions host flat
24/7 load. Under that null the score vector is exchangeable across region identities.

**Statistic.** The mean detector score of the four pre-registered validation regions:
PJM/DOM, PJM/AEP, SWPP/OPPD, ERCO/NCEN. This set was written into
`scripts/l3_detector.py` before the ranking was seen. That is what makes the statistic
non-circular. We are not asking "did the regions that scored high score high", we are
asking "did four regions nominated in advance land high".

**Why not something else.** Any statistic chosen after seeing the ranking (the top-10
mean, the max score, the gap between first and second) is circular. The pre-registered set
is the only pre-committed target in the repo.

**Assumption.** Exchangeability of region labels under the null. See 1b for the one place
this bites.

**Numbers.** The null distribution has only C(111,4) = 5,989,005 outcomes, so the p-value
is computed **exactly by enumeration**, not sampled. A seeded Monte Carlo with 200,000
draws is run alongside as a machinery check and agrees to three decimals.

| | Observed | Null mean | p exact | p Monte Carlo (200,000) |
|---|---|---|---|---|
| mean score | 3.872 | 0.702 | **0.04881** | 0.04882 |
| mean rank | 30.75 | 56.0 | **0.05709** | 0.05643 |

Validation regions: PJM/DOM 6th (score 7.707), SWPP/OPPD 7th (6.820), PJM/AEP 19th
(2.285), ERCO/NCEN 91st (-1.325).

**Interpretation.** Both statistics point the same way and land on either side of 0.05.
The mean-score version is the detector's own output but the score distribution is heavily
right-skewed (max 16.5 against a median of 0.33), so the mean-rank version is the
outlier-insensitive read. Reporting only the one under 0.05 would be cherry-picking. The
honest summary is "p is about 0.05", with all the fragility that implies.

The result is not robust to the composition of the validation set. Dropping any single
region changes it a lot:

| Dropped | Mean score of the remaining 3 | p exact |
|---|---|---|
| PJM/DOM | 2.594 | 0.137 |
| SWPP/OPPD | 2.889 | 0.115 |
| PJM/AEP | 4.401 | 0.051 |
| ERCO/NCEN (the pre-registered miss) | 5.604 | 0.022 |

**This table is post hoc and is not evidence.** Removing the region that failed, after
seeing that it failed, is precisely the circularity that pre-registration exists to
prevent. It is printed so nobody has to ask, and to quantify how much of the headline
hangs on four observations.

**Power.** The smallest attainable exact p-value is 1/5,989,005 = 1.7e-7, so the test is
not floored. But a mean of four is a blunt instrument. With four pre-registered regions
there is no way to get a tight answer, and the correct response is a larger pre-registered
set next time, not a different statistic on this one.

**What this does NOT establish.** It does not establish that the regions at the top host
datacenters. It establishes that a set named in advance scored higher than a randomly
drawn set of four would, about 95 times in 100. The detector flags flat 24/7 load in
general: datacenters, crypto mining, oilfield electrification.

### 1b. The nesting objection

`docs/judges_qa_redteam.md` raises it correctly: the 111 regions are not 111 independent
observations. 43 are balancing authorities and 68 are zones nested inside 8 BAs that are
themselves scored (PJM 19 zones, SWPP 13, NYIS 10, ERCO 8, ISNE 8, MISO 6, CISO 3, PNM 1).
PJM's load enters the reference pool twenty times.

A plain label permutation can therefore draw four regions that are all the same
electricity, which the observed validation set (2 from PJM, 1 from SWPP, 1 from ERCO)
cannot be. So the null was re-run with the BA-family composition held fixed: two members
of one randomly chosen family, one each from two other distinct families, 200,000 draws
across 43 families.

**p = 0.0491**, against 0.0488 for the plain version. The objection is valid in principle
and makes no difference here.

A second red-team objection is that the score's robust z-scores are inflated roughly
twofold in the tails because divergence has skew 3.12 and excess kurtosis 14.1. That
objection does not touch the p-value, because a permutation test is distribution-free and
uses the observed scores as their own reference. It does still touch the score, which
remains a rank statistic and not a probability.

### 1c. Do the three components agree?

Post-hoc diagnostic, not a confirmatory test. Permuting the three components independently
across regions preserves each marginal distribution and destroys all cross-component
alignment. Statistic: the mean of the top 10 scores, 8.458 observed against a null median
of 6.673, p = 2.0e-5 over 50,000 draws. Pairwise correlations of the standardised
components are 0.281 (overnight excess with divergence), 0.295 (overnight excess with load
factor) and 0.422 (divergence with load factor).

The three lines of evidence concentrate on the same regions far more than chance. They are
not three independent votes either; the correlations are the reason the composite has a
long right tail.

---

## 2. Is the signal dated to the buildout?

This is the falsification test, and it is the result most worth the space.

**Question.** If the detector reads flat 24/7 load that arrived with the AI buildout, it
should have had little to say in 2021. If the four pre-registered regions already scored
high against a 2019 baseline in 2021, the detector is reading something structural and
permanent about those regions, and the datacenter interpretation is wrong even if the
ranking is stable.

**Test.** Run the frozen detector unchanged, varying only the target year. Same weights,
same 500 MW cut, same p99.5 peak, same code path. Score and permute within each window,
because the 500 MW and completeness filters admit a slightly different region set.

| Target | n | PJM/DOM | SWPP/OPPD | PJM/AEP | ERCO/NCEN | mean score | p exact (score) | p exact (rank) | Spearman vs 2025 |
|---|---|---|---|---|---|---|---|---|---|
| 2021 | 111 | 5 | 12 | 37 | 104 | 1.666 | 0.129 | 0.157 | 0.622 |
| 2022 | 111 | 6 | 17 | 43 | 93 | 1.889 | 0.145 | 0.160 | 0.833 |
| 2023 | 111 | 8 | 22 | 38 | 99 | 1.599 | 0.215 | 0.193 | 0.891 |
| 2024 | 111 | 5 | 8 | 43 | 89 | 2.771 | 0.099 | 0.112 | 0.937 |
| 2025 | 111 | 6 | 7 | 19 | 91 | 3.872 | **0.049** | 0.057 | 1.000 |
| 2026 Jan-Aug | 110 | 3 | 6 | 12 | 81 | 4.112 | **0.016** | 0.027 | 0.877 |

**Interpretation.** No window before 2025 comes close to 0.05, and the p-value falls
monotonically from 2023 onward as the target year advances. The pre-registered set's
collective standing rises with the buildout rather than being a permanent property of
those regions. That is the pattern the datacenter reading predicts and a placebo would
not produce.

**What this does NOT establish.** The windows are nested: all six share the 2019 baseline
and 2021 is contained in the history that produced 2025. They are not six independent
tests and their p-values cannot be combined. It also does not rule out any other flat
24/7 load that grew on the same schedule.

---

## 3. How stable is a score, and how stable is a rank?

**Question.** How much of a region's position is sampling noise?

**Method.** Circular block bootstrap over local days, B = 10,000, seed 20260923. Three
design choices, each of which changes the answer:

1. **Blocks, not hours.** Hourly demand is autocorrelated at rho = 0.979 at lag 1 (section
   7). An iid bootstrap over hours would treat 8,760 hours as 8,760 independent draws and
   return intervals roughly nine times too narrow.

2. **Block length 7 days.** The demand series has a diurnal cycle and a weekday/weekend
   cycle. A sub-daily block would sever the diurnal structure, which is the very thing the
   overnight statistic measures. The raw daily-mean ACF is still 0.625 at 14 days, which
   would argue for much longer blocks, but almost all of that is seasonality: a July day
   resembles another July day. After removing a 29-day centred moving average the residual
   daily ACF is 0.650 at one day and **0.002 at three days**. Weather shocks persist two
   to three days, so a 7-day block more than covers the memory that a day-resampling
   scheme actually has to preserve. 1-day and 28-day blocks are run as sensitivities.

3. **The same resampled days for every region within a year.** Regions are not
   independent: a cold snap hits a BA and its neighbours together, and
   `neighbor_divergence` is explicitly a cross-sectional statistic. Resampling regions
   independently would destroy that correlation and understate divergence uncertainty.
   Base and target years are drawn independently of each other, because 2019 weather and
   2025 weather are independent. That is the conservative choice.

**Numbers, top of the board, 7-day blocks.**

| Rank | Region | Score | Score 95% CI | Rank 95% CI | P(in top 10) |
|---|---|---|---|---|---|
| 1 | ERCO/NRTH | 16.466 | 12.554 to 19.949 | 1 to 1 | 1.000 |
| 2 | ERCO/FWES | 13.893 | 10.459 to 17.501 | 2 to 2 | 1.000 |
| 3 | AZPS | 9.012 | 7.224 to 9.878 | 3 to 6 | 1.000 |
| 4 | TEPC | 8.508 | 6.189 to 9.803 | 3 to 7 | 1.000 |
| 5 | WACM | 8.237 | 5.549 to 10.900 | 3 to 7 | 1.000 |
| 6 | **PJM/DOM** | **7.707** | **5.417 to 9.574** | **3 to 7** | 1.000 |
| 7 | SWPP/OPPD | 6.820 | 4.999 to 8.108 | 5 to 7 | 1.000 |
| 8 | ERCO | 5.138 | 3.878 to 5.907 | 8 to 10 | 0.986 |
| 9 | SC | 5.076 | 3.123 to 7.009 | 8 to 13 | 0.922 |
| 10 | CISO/SDGE | 3.719 | 2.312 to 4.614 | 9 to 19 | 0.303 |
| 11 | PNM/PNM | 3.618 | 2.325 to 4.517 | 9 to 17 | 0.247 |
| 12 | CISO/PGAE | 3.412 | 1.885 to 3.981 | 10 to 24 | 0.074 |
| 19 | PJM/AEP | 2.285 | 1.251 to 3.125 | 14 to 30 | 0.000 |
| 91 | ERCO/NCEN | -1.325 | -2.425 to -0.507 | 75 to 100 | 0.000 |

**The deliverable sentence: Dominion ranks 6th, 95% CI 3rd to 7th.**

**Stability of the board as a whole.** Median rank CI width is **3 places inside the top
10** and **29 places below it**. 72 of 111 regions have a rank interval wider than 20
places; only 12 have one 5 places or narrower. Summing P(in top 10) over the observed top
10 gives 9.21, so about nine of the ten hold their place under resampling.

**Say it plainly: ranks 11 through 111 are not an ordering.** A region at 40 and a region
at 60 are not distinguishable. Quoting a rank below about 15 as if it were a position is
not supported by this analysis.

**Block-length sensitivity.** The choice matters and is reported rather than buried:

| Blocks | Median rank CI width | Top-10 median width | CIs wider than 20 | Dominion rank CI |
|---|---|---|---|---|
| 1 day | 19 | 2 | 50 of 111 | 4 to 6 |
| 7 days (primary) | 27 | 3 | 72 of 111 | 3 to 7 |
| 28 days | 38 | 5 | 89 of 111 | 3 to 7 |

Dominion's interval is 3rd to 7th under both the primary and the most conservative choice.
The board-wide instability is worse under longer blocks, as expected. Median bootstrap
rank bias is 0 and median score bias is -0.088, so the percentile intervals are not
materially shifted.

**What this does NOT capture, and it is the larger part of the uncertainty.** The choice
of 2019 as the baseline. Reporting or footprint changes inside a BA. Uncertainty about
the detector's weights. The bootstrap sees sampling noise inside two fixed years and
nothing else. Section 5 measures how badly that falls short.

**And a tight interval on a wrong number is still wrong.** WACM sits 5th with a rank CI of
3 to 7. The project's own data-quality note says its demand rose about 1.5 GW during 2022
with flat generation and exports falling to zero, unexplained, and flags it out of alerts
for that reason. The bootstrap says that number is reproducible. It does not say it is
real. Statistical stability and validity are different properties and this module only
measures the first.

---

## 4. Does it hold out of sample?

**Test.** The frozen detector also emits a 2019 to 2026 Jan-Aug ranking, from data that
did not exist when the method was frozen (snapshot ends 2026-09-05). 110 regions are
scored in both windows; WACM drops out of the holdout.

| Statistic | Value | 95% CI |
|---|---|---|
| Spearman rho | **0.8769** | [0.8251, 0.9141] Fisher z; [0.7953, 0.9293] bootstrap over regions, 10,000 resamples |
| Kendall tau-b | 0.7181 | [0.6340, 0.7883] bootstrap over regions, 2,000 resamples |

| Overlap | Observed | Expected by chance | Exact hypergeometric P(X >= x) |
|---|---|---|---|
| top 10 | **8 of 10** | 0.91 | 4.8e-9 |
| top 20 | 15 of 20 | 3.64 | 1.6e-10 |

Top-10 members in both windows: AZPS, ERCO, ERCO/FWES, ERCO/NRTH, PJM/DOM, SC, SWPP/OPPD,
TEPC. In sample only: CISO/SDGE, PNM/PNM. Holdout only: ERCO/SOUT, SWPP/GRDA.

The pre-registered regions all improve on the holdout: PJM/DOM 6th to 3rd, SWPP/OPPD 7th
to 6th, PJM/AEP 19th to 12th, ERCO/NCEN 91st to 81st and still a miss. The permutation
test re-run on the holdout ranking gives p = 0.0157 on mean score and 0.0271 on mean rank,
a stronger result than in sample.

**What this does NOT establish, and this caveat is load-bearing.** This is out of sample
in the **target year only**. Both rankings share the same 2019 baseline, the same region
set and eight months of overlap in construction, and a region's demand trajectory is
persistent: a region that grew 30% by 2025 is still growing in 2026. A high rank
correlation is therefore closer to mechanical than to predictive. What it genuinely shows
is that the ranking is not an artefact of one year's weather, and that the two regions
which fell out of the top 10 are the two the project's own descriptive label already calls
solar. It does not show that the detector predicts anything.

---

## 5. Do the intervals cover reality? (the test we fail)

This is the sharpest test in the module and the detector does not pass it.

**Question.** The block bootstrap says how much a rank moves when the same two years are
resampled. The 2026 holdout says how much a rank actually moved when the window changed.
If the 95% intervals were honest intervals to quote, they would contain the holdout rank
about 95% of the time.

**Result: 79 of 110, empirical coverage 0.718 against a nominal 0.95.**

Worst misses:

| Region | In-sample rank | 95% rank CI | Holdout rank | Outside by |
|---|---|---|---|---|
| CISO/SDGE | 10 | 9 to 19 | 79 | 60 |
| SRP | 13 | 9 to 26 | 56 | 30 |
| CISO | 21 | 15 to 42 | 64 | 22 |
| CISO/SCE | 44 | 29 to 77 | 93 | 16 |
| ISNE/4008 | 61 | 45 to 80 | 30 | 15 |

**Interpretation.** Within-year sampling noise is the small part of the uncertainty on a
rank. Window and regime choice dominate it. The red team's question was "your own
`rank_2026_jan_aug` moves a top-ten region to rank 79, why should I believe any rank on
that board", and the previous answer ended "we cannot tell you how much movement is
noise". Now we can: San Diego fell 69 places, from 10th to 79th. Nine of those places are
inside the resampling interval, which reaches to 19th. The other 60 are the window.

Every CI in section 3 should be read with this attached. They are correctly computed
intervals for a narrower question than the one a reader will ask.

The four top-10 regions whose holdout rank fell outside their interval are CISO/SDGE (by
60) and then ERCO/NRTH, ERCO/FWES and SC, each by exactly 1 place, which is the expected
behaviour of a very tight interval at the extreme of a bounded scale. The top of the board
is not the problem. The solar-labelled entrants to the top 10 are.

---

## 6. Multiple comparisons

**The framing.** 111 regions tested at alpha = 0.05 would produce 5.55 false positives by
chance alone. Benjamini-Hochberg is the correction.

**What gets a p-value.** The composite score has no region-level null; it is defined by
cross-sectional robust z-scores, so "is this score large" is circular. The detector's
primary component does have one:

> H0(i): overnight_excess(i) <= 0. Region i's overnight demand grew no faster than its
> average demand.

That is exactly the claim the detector makes about a region, one region at a time, and it
is testable against the block-bootstrap sampling distribution from section 3. Two families
are reported. Family A is that null alone. Family B is the intersection-union test for
overnight excess > 0 **and** neighbour divergence > 0, with p = max of the two one-sided
p-values, which is valid without assuming independence between the components.

p-values are computed two ways. The percentile p-value is floored at 1/(B+1) = 1.0e-4,
which sits below the smallest BH threshold 0.05/111 = 4.5e-4, so the floor does not bind.
The headline uses the normal-approximation p from the bootstrap standard error because it
is not granular. Both are in the results JSON.

| Family | q | Rejected | Expected false discoveries | In the top 10 | Expected false in top 10 | Benjamini-Yekutieli |
|---|---|---|---|---|---|---|
| A: overnight excess > 0 | 0.05 | 71 of 111 | at most 3.55 | 10 of 10 | at most **0.5** | 63 |
| A | 0.10 | 82 of 111 | at most 8.20 | 10 of 10 | at most 1.0 | 65 |
| B: both components > 0 (IUT) | 0.05 | 24 of 111 | at most 1.20 | 9 of 10 | at most 0.45 | 21 |
| B | 0.10 | 26 of 111 | at most 2.60 | 9 of 10 | at most 0.90 | 21 |

BH controls the false discovery rate under positive regression dependence, which is the
case it is proved for and which shared weather and shared parent BAs produce.
Benjamini-Yekutieli, valid under arbitrary dependence, is shown alongside and costs about
ten discoveries.

**The answer to "how many top hits are luck": at q = 0.05, at most 0.5 of the top 10.**
Largest p-value in the top 10 under family A is 0.00395 (SC). No region in the top 20
fails family A.

**But read the next paragraph before quoting that.** 71 of 111 regions surviving is not a
discriminating result. It says that sampling noise on an 8,760-hour annual mean is tiny,
which we already knew from section 7, and therefore that almost any region with a
genuinely positive overnight excess clears any reasonable threshold. 13 regions have
overnight excess at or below zero and none of those are rejected, which is the only
separation the test achieves. The binding uncertainty in this project is not sampling
noise, it is whether a demand series means what it appears to mean, and no bootstrap can
see that. AZPS gets p = 3.8e-26 and CISO/SDGE p = 8.7e-35 under family A, and both are
regions the project itself flags: AZPS for a generation-side reporting break, San Diego
for behind-meter solar that mechanically manufactures the same fingerprint. Significance
here is not validity.

Family B is the more informative of the two. Requiring both components to be positive cuts
the survivors from 71 to 24 and removes **CISO/SDGE, CISO/PGAE and NYIS/ZONE** from the
top 20, with CISO/SDGE at p = 0.691. Those are the same regions the descriptive solar
label already flags and the same ones that collapse out of sample. Three independent
routes converge on the same three names, which is worth more than the FDR count itself.

---

## 7. Autocorrelation and effective sample size

**Question.** A region-year is 8,760 hourly observations. How many of them are
independent?

**ACF, median over 222 region-years.**

| Lag | Raw hourly | Daily mean | Daily mean, de-seasonalised |
|---|---|---|---|
| 1 hour | 0.979 | | |
| 24 hours | 0.897 | | |
| 168 hours | 0.763 | | |
| 1 day | | 0.898 | 0.650 |
| 3 days | | | 0.002 |
| 7 days | | 0.694 | -0.026 |
| 14 days | | 0.625 | 0.020 |

The raw series keeps 0.625 correlation at two weeks, which would look like enormous
memory. De-seasonalising against a 29-day centred moving average collapses it to 0.002 by
day three. Nearly all of the long-range structure is the seasonal cycle, which a
day-resampling bootstrap reproduces in composition without needing to reproduce its order.
This is the evidence behind the 7-day block in section 3.

**Effective sample size, two estimators.**

| Estimator | Median | IQR |
|---|---|---|
| Bartlett HAC, bandwidth 336 h | 62.5 | 53.8 to 71.9 |
| Block bootstrap, 7-day circular blocks, B = 2,000 | **118.0** | 103.7 to 133.5 |

They differ by about a factor of two, which is the honest precision available here. Take
the order of magnitude, not the digit: **a region-year carries on the order of 100
independent observations about its annual mean, not 8,760.**

**The number to quote.** Variance inflation factor, median 74.3 (IQR 65.6 to 84.5). An iid
standard error on a region's annual mean demand **understates it by a factor of about
8.6**.

**What this does NOT establish.** ESS is estimated for the annual mean, which is the
statistic the detector uses. It is not the right n for the p99.5 quantile or for any
extreme-value statement, both of which depend on the tail rather than the centre.

---

## What came out against us

Collected in one place so nobody has to hunt for it.

1. **The in-sample p-value straddles 0.05.** Mean score gives 0.0488 and mean rank gives
   0.0571. One of the two conventional reads fails. Calling this "significant" without the
   qualifier would be a misrepresentation.

2. **The headline rests on four observations.** Dropping PJM/DOM alone moves p from 0.049
   to 0.137. A four-region pre-registered set cannot carry more weight than that.

3. **No placebo window before 2025 clears 0.05.** Read positively this dates the signal to
   the buildout, which is the result we want. Read plainly it also means the detector had
   no measurable power in 2021 through 2023.

4. **Ranks below the top 10 are not an ordering.** Median 95% rank interval is 29 places
   wide and 72 of 111 regions have an interval wider than 20 places.

5. **The bootstrap intervals cover the out-of-sample rank only 71.8% of the time against a
   nominal 95%.** The intervals in section 3 answer a narrower question than a reader will
   ask them. San Diego's interval was 9 to 19 and the holdout put it at 79.

6. **FDR at q = 0.05 rejects 71 of 111 regions, which is close to uninformative.** The
   bootstrap measures the uncertainty that is small and cannot see the uncertainty that is
   large. The regions most likely to be wrong (AZPS, WACM, CISO/SDGE) get among the most
   extreme p-values in the file.

7. **A naive n of 8,760 overstates the information in a region-year by roughly 75x.**
   Anything in the repo that quotes an iid standard error on hourly data is wrong by about
   8.6x.

8. **ERCO/NCEN (Dallas) is a pre-registered miss in every window**, ranking 81st to 104th
   across 2021 to 2026. It has not improved and it is not going to.

9. **The two ESS estimators disagree by a factor of two** (62.5 versus 118.0). Neither is
   wrong; the quantity is simply not sharply identified.

None of this changed the detector. The method is frozen and stays frozen.

---

## What would actually settle it

Out of scope here, recorded so the next person does not have to rediscover it.

- **A larger pre-registered set.** Four regions is the binding constraint on power, not
  the data. Twenty regions named in advance would give a usable p-value.
- **Weather normalisation.** Neither component controls for degree days, so a hot June and
  a datacenter look alike. The 2026 window removing the solar-labelled regions is the
  closest thing to a control in the repo and it is not one.
- **A negative control region set** named in advance: regions where we assert flat load is
  NOT arriving. Without one, specificity is unmeasured.
- **An interval that covers regime change.** The right object is a CI over window choices,
  not over resamples within a window. Section 5 measures the gap; it does not close it.

---

## Reproduce

```bash
source ~/hackmit-venv/bin/activate
python3 scripts/vendor/pudl_fetch.py --output-dir data/pudl \
  --table out_eia930__hourly_subregion_demand \
  --table out_eia930__hourly_operations \
  --table core_eia__codes_balancing_authorities \
  --table core_eia__codes_balancing_authority_subregions
python3 -m engine.stats                  # 1,153 s, writes engine/stats/results/stats_results.json
python3 -m engine.stats --quick          # 40 s smoke test, smaller B
```

Run from the repo root. `engine/stats/core.py` caches the localised hourly panel to
`data/processed/stats_panel_cache.parquet` (gitignored); delete it to force a rebuild.

**Seeds.** Master 20260920. Derived: permutation 20260921, component independence
20260922, bootstrap 7-day 20260923, bootstrap 1-day 20260924, holdout region bootstrap
20260925, autocorrelation 20260926, holdout permutation 20260927, bootstrap 28-day
20260928, family-restricted permutation 20260929.

**Counts.** Exact permutation enumerates all 5,989,005 subsets (5,773,185 on the 110-region
holdout). Monte Carlo cross-checks use 200,000 draws, component independence 50,000,
placebo windows 20,000 each. Every bootstrap is B = 10,000 except the ESS bootstrap at
B = 2,000. Region-resampling for the Spearman CI is 10,000, Kendall 2,000.

**Runtimes.** Permutation 2.2 s. Family-restricted 5.5 s. Bootstrap 483.7 s (7-day),
463.4 s (1-day), 172.3 s (28-day). Holdout 1.2 s. Autocorrelation 0.5 s. Total 1,153.3 s.

| Module | What it does |
|---|---|
| `engine/stats/core.py` | Imports the frozen detector, builds the dense panel, verifies reproduction |
| `engine/stats/permutation.py` | Exact and Monte Carlo permutation nulls |
| `engine/stats/bootstrap.py` | Circular block bootstrap, score and rank CIs |
| `engine/stats/holdout.py` | Spearman, Kendall, top-k, placebo windows, CI coverage |
| `engine/stats/fdr.py` | Benjamini-Hochberg and Benjamini-Yekutieli |
| `engine/stats/autocorr.py` | ACF, Bartlett HAC, variance inflation, ESS |
