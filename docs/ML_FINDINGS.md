# What the statistics say about the detector

Three independent modules were pointed at the frozen flat-load detector overnight. All
three were forbidden from using any detector output as an input, so where they agree with
it, that agreement is evidence.

| Module | Question | Verdict |
|---|---|---|
| `engine/stats` | Is the ranking better than chance? How stable? Does it hold out of sample? | **Holds out of sample. In-sample significance is marginal.** |
| `engine/ml` | Can a model that never saw our rule find the same regions from raw demand shape? | **Yes, but the labels are size-confounded.** |
| `engine/shape` | Do datacenter grids cluster on shape? When did each region go flat? | **No, and the breaks do not cluster in time.** |

Every module first reproduced the frozen detector to prove it was measuring the real
thing. `engine/stats` matches it to 6.2e-14 with zero rank mismatches of 111.

---

## What held

**Out of sample is the strongest result in the project.** The 2019 to 2025 ranking against
the 2026 January to August holdout, data that did not exist when the method was frozen:

| | |
|---|---|
| Spearman | **0.877**, CI [0.825, 0.914] |
| Kendall tau-b | 0.718, CI [0.634, 0.788] |
| Top-10 overlap | **8 of 10**, against 0.91 expected by chance, p = 4.8e-9 |
| Dominion's rank | 6th, 95% CI **3rd to 7th** |

**The signal is dated to the buildout.** Running the same frozen detector ending in each
earlier year: p = 0.129 (2021), 0.145 (2022), 0.215 (2023), 0.099 (2024), then **0.049
(2025)** and **0.016 (2026)**. Nothing before 2025 clears 0.05. That is what a datacenter
reading predicts, and it also means the method had no measurable power before 2024.

**A model that never saw the rule finds the same regions.** Trained only on 2025 demand
shape, with no reference to 2019 and no detector output: AUC **0.727**, average precision
**0.705**, against floors of 0.500 and 0.441. Zero of 1,000 label shuffles beat it.

**An independent recomputation agrees with the score.** `engine/shape` computed an
overnight-ratio change from raw parquet without ever reading the detector. Correlation with
the shipped score: **0.655** (p = 6e-15).

**The nesting objection does not bite.** 68 of the 111 regions are zones inside 8 scored
parents. Holding BA-family composition fixed across 43 families, p = 0.0491 against 0.0488
unrestricted. Valid objection, no effect.

---

## What did not hold, and is published anyway

**In-sample significance is marginal.** The permutation p on the four pre-registered
regions is **0.0488** on mean score and **0.0571** on mean rank. One of the two statistics
fails the conventional bar. Dropping PJM/DOM alone moves it to 0.137: the in-sample
headline rests on four observations. The out-of-sample p (0.016) is the stronger claim and
should be the one quoted.

**The rank intervals are too narrow.** The block bootstrap's 95% rank intervals contain the
out-of-sample rank only **71.8%** of the time. San Diego's interval was 9th to 19th; the
holdout put it 79th. Within-year sampling noise is the small part of the uncertainty and
window choice dominates. This is the test the detector fails.

**Below the top 10 the ranking is not an ordering.** Median 95% rank interval is 29 places
wide; 72 of 111 are wider than 20 places. Treat the top 10 as a set, not a sequence.

**The labels are size-confounded.** log(average demand) alone scores AUC 0.749, beating
every shape model, and paired on identical folds shape loses to size by 0.030 AUC
(p = 0.022). Bigger regions carry more mapped sites because we mapped more sites in bigger
regions. The defensible claim is that shape adds information beyond size, not that shape
beats size.

**Datacenter regions do not cluster on load shape.** 50 pre-declared tests across four
profile specifications and five label sets. Nothing survives correction, and mapped-site
regions are *depleted* in the flattest cluster rather than enriched. The flattest cluster in
2025 is ISO-NE, NYISO, CAISO and the desert Southwest: mature low-growth zones with
behind-the-meter solar.

**Changepoints do not cluster in time.** Maximum primary breaks in any 6-month window: 16
observed against 14.9 under a uniform null, p = 0.310. Site versus non-site break date
p = 0.911.

**Two changepoint artifacts, both flagged.** Six regions break at exactly 2025-09, the last
index the algorithm may search, which is an edge effect. Ten break at exactly 2022-01 across
five interconnections, unexplained. **Checked: only 1 of those 10 is in the detector's top
10, median rank 37 against 57 for everyone else, so the artifact does not drive the
ranking.**

---

## The reframe that comes out of all three

The supervised model leans on *static flatness*: summer/winter ratio, residual variation,
diurnal range. The detector leans on *change*: overnight growth relative to average. Its
load-factor change term ranks last of 52 in the model's importance, with negative weight.

So they are not measuring the same thing, and the disagreements are informative.
ERCO/FWES is detector rank 2 and model rank 58. MISO and PACE carry mapped sites and sit at
detector rank 89 and 85.

**The detector finds where flat load is arriving. The model finds where it already sits.**
Those are separable targets, and the detector is the first one. That is the honest
description of what we built, and it is a sharper claim than "we find datacenters."

---

## If a quant asks

- *"Is it better than chance?"* Out of sample, yes: rho 0.877, top-10 overlap p = 4.8e-9.
  In sample it is marginal at 0.049 and we say so.
- *"How stable is rank 6?"* 3rd to 7th, and our intervals are demonstrably too narrow
  below the top 10. We measured that rather than assuming it.
- *"Could this be size?"* Partly. Size alone beats shape on our labels. We report it.
- *"Could it be the zone nesting?"* No. Family-restricted permutation, no effect.
- *"Did you tune it?"* The scoring function is unchanged from the commit that produced the
  first ranking, +22/-0 lines since, none touching the score.
