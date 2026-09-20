# Can a model that never saw our rule find the same regions?

`engine/ml/` — independent supervised corroboration of the frozen L3 flat-load detector.

## The question

The L3 detector scores 111 US demand regions on how much they look like they host new
flat 24/7 load. It is a hand-built linear rule over three hand-picked features:

```
score = z(overnight_excess) + z(neighbor_divergence) + 0.5 · z(load_factor_delta)
```

The weights, the 500 MW cut and the p99.5 peak were fixed before the ranking was seen,
and four validation regions were named in advance. That is the strongest procedural
defence available, and it is still not an answer to the obvious challenge from a
quantitative reader:

> You designed that rule looking at the same data. Can a model that never saw your rule
> find the same regions from the raw load shape alone?

That is a supervised learning problem with a real, externally sourced label set. This
document reports what happened when we ran it. The short version, in three findings:

1. **Yes, partly.** A model given nothing but the 2025 hourly demand shape separates
   datacenter-hosting regions from the rest at AUC 0.727 ± 0.092 and average precision
   0.705 ± 0.100, against floors of 0.500 and 0.441. Under 1,000 label shuffles, not one
   beat it (*p* = 0.001). The load-shape premise the whole project rests on survives an
   independent test.
2. **But the labels are size-confounded, and the shape model does not beat size.** A
   one-variable model on `log(average demand)` scores *better* (AUC 0.749 ± 0.097), and
   paired on identical folds the shape model loses to it (ΔAUC −0.030, *p* = 0.022).
   The shape does carry signal *beyond* size — a permutation null that holds size fixed
   is still rejected at *p* = 0.010–0.032 — but "adds information beyond size" is a
   strictly weaker claim than "is a better predictor," and the two are easy to conflate.
3. **It does not corroborate the detector's ranking.** Spearman agreement with the frozen
   score is +0.344 on the feature tier that shares two of the detector's three components,
   and an insignificant +0.137 (*p* = 0.15) on the strictly independent tier. The reason
   turns out to be substantive rather than embarrassing, and is set out in
   [Agreement](#agreement-with-the-frozen-detector).

Findings 2 and 3 are weaker than we hoped for and are reported as they came out.

---

## The labels

**Positive class.** A region that demonstrably hosts large datacenter or flat-load
capacity, taken from `claims/lookup/facilities.csv`: 134 sited facilities across 54
operators, each row carrying a named serving utility and a source URL (71 company
disclosures, 42 press, 19 SEC filings, 2 inferred). Every row was mapped from the
**serving utility**, not from geography, to a balancing authority and — where public
sources established it — to a subregion. The file was built for the claim-verification
layer and never consults the detector, its score, its ranking or any export downstream of
it. That independence is the only reason it is usable as a label here.

**Negative class.** Every scored region with no mapped facility.

**Mapping.** A facility's region is its zone where one was established (`PJM/DOM`),
otherwise its BA (`ERCO`). A facility sited in `PJM/DOM` is physically inside `PJM`, so
by default a zone-level facility also marks its parent BA positive; the no-propagation
variant is reported in [Label sensitivity](#label-sensitivity).

### The labels are noisy, and here is exactly how

**1. Absence of a mapped site is absence of *coverage*, not absence of a datacenter.**
The negative class is contaminated with true positives we never sourced. A model that
correctly flags an unsourced datacenter region is scored as *wrong*. Contaminated
negatives depress measured precision and recall, so **every score in this document is a
lower bound.** The detector's own top-20 contains six unlabelled regions
(`ERCO/NRTH`, `TEPC`, `CISO/SDGE`, `NYIS/ZONE`, `NYIS/ZOND`, `NYIS/ZONG`) that are, on
the face of it, exactly the kind of place this contamination would live — the ERCOT North
zone and three upstate New York zones are well-known crypto-mining and buildout
territory. We did not move them into the positive class, because relabelling on the
strength of the model's own output is precisely the circularity this exercise exists to
avoid.

**2. Eleven sites are behind the meter and invisible to EIA-930 by construction.**
EIA-930 reports at the balancing-authority boundary; load served by an on-site microgrid
never crosses that boundary. Oracle/OpenAI Shackelford County runs on "an onsite,
behind-the-meter, gas-powered microgrid"; Vulcan/Greenidge Dresden draws all power from
its own 106 MW plant. These are labels the features **cannot** satisfy, no matter how
good the model is. They are enumerated in `engine/ml/labels.py::BEHIND_THE_METER` and the
experiment is run both with and without them.

**3. BA-level labels contaminate their own zones.** A facility whose sourcing only
established the BA (zone blank) labels the BA. The zones *inside* that BA then sit in the
negative class even though one of them almost certainly contains the site. 70 of the 134
facilities are mapped at BA level only; ERCO carries 13 of them and MISO 8, which makes
those two the largest contamination channels.

**4. Coverage is not size-neutral, and this turned out to matter more than anything
else.** A 90 GW balancing authority is far more likely to have a sourced facility than a
600 MW zone — bigger regions attract more press, more filings, more disclosure. See
[The size confound](#the-size-confound).

**5. Two labelled sites are explicitly not flat load.** MARA Kearney is interruptible by
NPPD's own account, and the Keel/Stronghold Pennsylvania sites are to be offered into PJM
as demand response. They stay in the positive class. Removing them would be tuning the
labels to the hypothesis.

---

## The features

Every feature is computed from **hourly demand only**, by `engine/ml/features.py`, and
obeys three hard constraints:

- **No detector output, in any form.** Not the score, rank, components, robust z-scores,
  pattern label, or anything exported from them. `l3_detector.csv` is read in exactly one
  place in the module — the agreement analysis — and never enters the feature matrix.
- **No generation-derived feature, for any region.** Zones inherit their parent BA's
  generation, so a generation feature on a zone would describe a different electrical
  object. Demand is the zone's own; only demand is used.
- **Every feature is scale-free** — a ratio, a share, a correlation, or a difference of
  those. Region size is deliberately kept *out* of the matrix so it can be tested
  separately as a confound rather than smuggled in.

To make the two methods see identical regions in identical local time, the module imports
`load_demand` and `localize` from `scripts/l3_detector.py` (frozen; importing it does not
run its scoring) and applies the same 500 MW and 90%-of-hours cuts. The resulting frame is
the same 111 regions, verified by set equality.

### The seventeen shape features, computed for 2019 and for 2025

| Feature | What it measures |
|---|---|
| `load_factor` | mean / 99.5th-percentile hour — flatness |
| `floor_ratio` | 5th percentile / mean — how high the baseload floor sits |
| `night_day_ratio` | mean(00–05 local) / mean(10–15 local) |
| `weekend_ratio` | mean(Sat–Sun) / mean(Mon–Fri) |
| `seasonal_amp` | (max − min monthly mean) / annual mean |
| `summer_winter_ratio` | mean(Jun–Aug) / mean(Dec–Feb) |
| `cv` | standard deviation / mean of the hourly series |
| `diurnal_range` | max − min of the normalised mean daily profile |
| `profile_entropy` | Shannon entropy of the daily profile, scaled so perfectly flat = 1 |
| `harm1_amp`, `harm2_amp` | Fourier amplitude of the daily profile at 24 h and 12 h |
| `peak_hour_sin`, `peak_hour_cos` | hour of peak, as circular coordinates |
| `acf1`, `acf24`, `acf168` | autocorrelation at 1 hour, 1 day, 1 week |
| `resid_cv` | relative scatter left after removing the month × hour pattern — irregular, weather-driven variation |

Plus, for the change tiers: the fifteen meaningful 2019→2025 differences (`d_*`), the
circular `peak_hour_shift`, and two growth primitives `g_avg = log(mean₂₅/mean₁₉)` and
`g_night = log(night₂₅/night₁₉)`.

### Three tiers of independence from the detector

| Set | p | Contents | Independence |
|---|---|---|---|
| `static_2025` | 17 | 2025 shape only | **Strictest.** Contains no reference to 2019 at all, so it structurally cannot encode the detector's rule, which is entirely a 2019→2025 change rule. |
| `shape_change` | 52 | + 2019 shape, deltas, growth primitives | **Spans two of the detector's three components** — see the disclosure below. |
| `shape_plus_size` | 53 | + `log_size` | Not an independence tier; the control for [the confound](#the-size-confound). |

**Disclosure that a reviewer should hold us to.** `d_load_factor` *is* the detector's
`load_factor_delta` component, and `overnight_excess` is an exact linear combination of
`g_avg` and `g_night`. So the `shape_change` set spans two of the detector's three
components. It does **not** contain the detector's weights, its robust z-scores, or its
neighbour-divergence component — that one is a cross-sectional construct relative to a
hand-chosen peer group and is excluded from every tier. We recomputed the shared
quantities from raw demand rather than reading them from the detector, and they agree with
it to floating point: max |ours − detector| is 8.9e-14 for `overnight_excess` and 3.0e-16
for `load_factor_delta`. That is an integrity check, not a defence — it confirms the
overlap is real, which is why `static_2025` exists and is reported first.

---

## The cross-validation scheme

n = 111 with 49 positives. A single train/test split on that sample is noise, and a quant
will say so. Every number below comes from:

- **`RepeatedStratifiedKFold(n_splits=5, n_repeats=20, random_state=20260920)`** — 100
  fits. We report the mean **and standard deviation** across folds, because the spread is
  the point: fold-to-fold SD is ≈0.09 AUC here, which is larger than most of the
  differences anyone would want to argue about.
- **Leave-one-out**, 111 fits, as an independent second scheme. Per-fold AUC is undefined
  with one test point, so LOO is scored on the pooled predictions.
- **Every scaler is fitted inside the training fold** (sklearn `Pipeline`). Nothing about
  a test fold reaches its own fit.
- Models: **L2 logistic regression** (C = 1.0 on standardised features, not tuned — with
  n = 111 an inner tuning loop would spend the sample on hyperparameters) and **gradient
  boosting** (200 trees, depth 2, lr 0.05, subsample 0.9; depth 2 because deeper
  memorises at this n).

**Why average precision matters more than ROC-AUC here.** The classes are imbalanced
(44.1% positive) and, more importantly, the only part of the ranking anyone would act on
is the top. ROC-AUC is prevalence-insensitive and gives credit for correctly ordering the
large, easy negative mass; average precision asks how clean the head of the ranking is,
and its no-skill floor is the prevalence (0.441) rather than 0.5. A model at AUC 0.73 and
AP 0.69 has barely moved the number that matters.

---

## The size confound

Before any model result can be read, one thing has to be measured rather than assumed.

**`log(average demand 2025)` alone, with no load-shape information whatsoever, predicts
the labels at fold AUC 0.749 ± 0.097 and fold AP 0.753 ± 0.093.** Median 2025 demand is
4,789 MW for labelled regions and 2,023 MW for unlabelled ones.

That is not a fact about datacenters. It is a fact about *us*: a 90 GW balancing authority
generates more press, more filings and more disclosure than a 600 MW zone, so our
hand-curated facility list finds it more often. Region size is the strongest single
predictor of *our own coverage*, and it beats the frozen detector's own score at the same
task (detector score against these labels: AUC 0.650, AP 0.601).

Every claim below is therefore stated against **two** benchmarks: chance, and size.

---

## Results

100 fits (repeated stratified 5-fold × 20) plus 111 leave-one-out fits, per row.
No-skill floors: **AUC 0.500, AP 0.441**.

| Feature set | Model | Fold AUC | Fold AP | Pooled AUC | Pooled AP | LOO AUC |
|---|---|---|---|---|---|---|
| `static_2025` | logistic | 0.711 ± 0.084 | 0.665 ± 0.103 | 0.710 | 0.621 | 0.688 |
| `static_2025` | grad. boosting | **0.727 ± 0.092** | **0.705 ± 0.100** | 0.732 | 0.692 | 0.717 |
| `shape_change` | logistic | 0.665 ± 0.098 | 0.624 ± 0.108 | 0.680 | 0.577 | 0.630 |
| `shape_change` | grad. boosting | 0.718 ± 0.095 | 0.676 ± 0.108 | 0.731 | 0.611 | 0.705 |
| `size_only` *(confound)* | logistic | *0.749 ± 0.097* | *0.753 ± 0.093* | 0.735 | 0.720 | 0.725 |
| `shape_plus_size` | logistic | 0.723 ± 0.098 | 0.694 ± 0.107 | 0.743 | 0.668 | 0.703 |
| `shape_plus_size` | grad. boosting | 0.737 ± 0.088 | 0.710 ± 0.100 | 0.746 | 0.650 | 0.722 |

Three things to take from this table.

1. **The load shape does carry signal.** The strictest tier — 2025 shape only, no reference
   to 2019, structurally incapable of encoding a change rule — reaches AUC 0.727 and AP
   0.705 against floors of 0.500 and 0.441.
2. **It does not beat region size.** Paired on identical folds (below), `shape_change` is
   *worse* than a one-variable size model, and the gap is significant.
3. **The change tier adds nothing over the static tier.** `static_2025` is, if anything,
   slightly better than `shape_change` (paired ΔAUC +0.008, p = 0.33). The extra 35
   features describing how the shape *moved* between 2019 and 2025 buy nothing. This is
   the first hint of the main finding.

### Paired comparison on identical folds

Fold-to-fold SD is ≈0.09–0.13 AUC, so unpaired means cannot settle a 0.03 difference.
Positive Δ means A beats B; 100 paired folds each.

| A vs B | ΔAUC (sd) | ΔAP | paired-t *p* | A wins |
|---|---|---|---|---|
| `shape_change`/GB vs `size_only` | **−0.030** (0.129) | −0.077 | **0.022** | 39% of folds |
| `static_2025`/GB vs `size_only` | −0.022 (0.126) | −0.048 | 0.087 | 43% |
| `shape_plus_size`/GB vs `size_only` | −0.011 (0.105) | −0.043 | 0.292 | 43% |
| `static_2025`/GB vs `shape_change`/GB | +0.008 (0.085) | +0.029 | 0.334 | 51% |

**Against us, plainly:** the load-shape model loses to a single size variable, and adding
the whole 52-feature shape description on top of size does not measurably improve it
(p = 0.29). At n = 111 we cannot demonstrate that load shape is a *better* datacenter
locator than "how big is this region".

---

## Permutation test

Labels shuffled, model refit, pooled out-of-fold AUC recomputed, empirical
*p* = (1 + #{null ≥ observed}) / (1 + n) — which never reports *p* = 0, a claim the number
of shuffles could not support. Two nulls:

- **plain** — shuffle freely. Tests *any* signal.
- **size-stratified** — shuffle only within quintiles of `log_size`, so the null retains
  the coverage-vs-size association. Tests whether the shape carries signal **beyond** the
  confound.

| Feature set | Model | Null | Observed | Null mean | Null sd | Null p95 | *p* |
|---|---|---|---|---|---|---|---|
| `static_2025` | logistic | plain | 0.713 | 0.493 | 0.078 | 0.619 | **0.0010** |
| `static_2025` | logistic | size-stratified | 0.713 | 0.574 | 0.065 | 0.672 | **0.0120** |
| `static_2025` | GB | plain | 0.718 | 0.494 | 0.077 | 0.625 | **0.0020** |
| `static_2025` | GB | size-stratified | 0.718 | 0.547 | 0.075 | 0.673 | **0.0140** |
| `shape_change` | logistic | plain | 0.694 | 0.495 | 0.074 | 0.607 | **0.0020** |
| `shape_change` | logistic | size-stratified | 0.694 | 0.566 | 0.067 | 0.674 | **0.0260** |
| `shape_change` | GB | plain | 0.723 | 0.497 | 0.076 | 0.626 | **0.0020** |
| `shape_change` | GB | size-stratified | 0.723 | 0.559 | 0.074 | 0.680 | **0.0140** |
| `shape_plus_size` | logistic | plain | 0.753 | 0.495 | 0.075 | 0.609 | **0.0010** |
| `shape_plus_size` | logistic | size-stratified | 0.753 | 0.637 | 0.051 | 0.721 | **0.0100** |
| `shape_plus_size` | GB | plain | 0.756 | 0.497 | 0.076 | 0.628 | **0.0020** |
| `shape_plus_size` | GB | size-stratified | 0.756 | 0.644 | 0.053 | 0.735 | **0.0319** |
| `size_only` | logistic | plain | 0.732 | 0.469 | 0.086 | 0.594 | **0.0010** |
| `size_only` | logistic | size-stratified | 0.732 | **0.730** | 0.011 | 0.747 | **0.4146** |

**The last row is the control that makes the rest readable.** Under size-stratified
shuffling the size-only model's null mean is 0.730 against an observed 0.732, and
*p* = 0.41 — the stratification correctly annihilates the size model's apparent signal.
The test is doing what it claims. The same test still rejects for every shape model at
*p* = 0.010–0.032.

**Reading it.** Against chance, the result is not close: *p* ≈ 0.001–0.002 everywhere,
and on the plain null not one shuffle out of 1,000 beat the strict `static_2025` logistic
model. Against the harder null that holds size fixed, six shape specifications land
between *p* = 0.010 and *p* = 0.032. So the hourly demand shape does carry information
about where datacenters are that region size alone does not explain.

**The multiplicity caveat, stated rather than hidden.** Fourteen permutation tests are
reported here and none of the *p*-values is corrected for that. The plain-null results
survive Bonferroni comfortably (0.002 × 14 = 0.028); the size-stratified results do not
(0.010 × 14 = 0.14). What should carry weight in the stratified column is not any single
*p* but that six differently-specified models all land in the same narrow band on the same
side — not that the smallest one clears 0.05.

---

## Feature importance

Permutation importance on **held-out** folds — the drop in test-fold AUC when one column
is shuffled — not impurity importance on the training set, which rewards features that let
a tree memorise. Correlated features split the credit, so read groups, not ranks.

**`static_2025`, the strictly independent tier** (AUC drop, mean ± sd over 25 folds × 10 shuffles):

| Logistic | | Gradient boosting | |
|---|---|---|---|
| `summer_winter_ratio` | **+0.0695** ± 0.0901 | `summer_winter_ratio` | **+0.0439** ± 0.0739 |
| `resid_cv` | +0.0610 ± 0.0694 | `acf1` | +0.0323 ± 0.0433 |
| `diurnal_range` | +0.0506 ± 0.0790 | `harm1_amp` | +0.0282 ± 0.0438 |
| `profile_entropy` | +0.0436 ± 0.0795 | `diurnal_range` | +0.0282 ± 0.0575 |
| `floor_ratio` | +0.0321 ± 0.0596 | `floor_ratio` | +0.0213 ± 0.0434 |
| `cv` | +0.0247 ± 0.0536 | `load_factor` | +0.0175 ± 0.0557 |

Note the spreads: every drop is smaller than its own fold-to-fold standard deviation. No
single feature is individually significant here, which is expected when 17 correlated
flatness measures share the credit. The ordering is informative; the magnitudes are not.

**`shape_change`, logistic** (top 6 of 52): `d_resid_cv` +0.0333, `g_avg` +0.0332,
`summer_winter_ratio_19` +0.0324, `summer_winter_ratio_25` +0.0294, `g_night` +0.0289,
`resid_cv_25` +0.0273.

### Does this corroborate the detector's central assumption? Partially, and not primarily.

The detector's premise is that **overnight demand growing faster than average demand**
marks arriving flat load. The honest reading of the table above is:

- **The growth primitives do appear, but they are not the top of the list.** The detector's
  `overnight_excess` is an exact linear combination of `g_avg` and `g_night`, so where
  those two land is the direct test of whether an independent model reaches for the
  detector's central quantity. In the linear model on the change tier they rank **2nd and
  5th of 52** (+0.0332, +0.0289) — real, but comparable to the seasonal and
  residual-variation features rather than dominant over them. In the boosted model they
  fall to **11th and 12th of 52** (+0.0052, +0.0043), which is mid-pack.
- **The detector's other component carries nothing.** `d_load_factor` — numerically
  identical to the frozen `load_factor_delta` — ranks **52nd of 52** in the linear model,
  with a *negative* importance (−0.0120: shuffling it slightly *improved* held-out AUC),
  and 44th of 52 in the boosted model. Whatever signal the change tier has, the load-factor
  delta is not carrying it.
- **What the model actually leans on is static flatness.** The single strongest feature in
  both models on the strict tier is `summer_winter_ratio`: how much the region's demand
  changes between summer and winter. After it come `resid_cv` (how much irregular,
  weather-driven scatter survives removal of the month × hour pattern), `diurnal_range`,
  `profile_entropy`, `floor_ratio` and `load_factor` — all measures of a load that is flat
  *now*, none of them measures of how it *changed*.

So an independent model, given free choice over 52 load-shape descriptors, prefers
"this region's load is already flat, season-insensitive and weather-insensitive" over
"this region's overnight load grew." That is a partial corroboration of the physics the
project is built on — flat 24/7 load does leave a detectable fingerprint in hourly demand —
and a direct challenge to the specific feature the frozen detector was built around.

---

## Agreement with the frozen detector

Spearman correlation between the model's out-of-fold probability and the detector's score,
across all 111 regions:

| Model | ρ vs detector score | *p* |
|---|---|---|
| `shape_change` / gradient boosting | **+0.344** | 2.2 × 10⁻⁴ |
| `shape_plus_size` / gradient boosting | +0.344 | 2.2 × 10⁻⁴ |
| `shape_change` / logistic | +0.313 | 8.3 × 10⁻⁴ |
| `static_2025` / logistic | +0.200 | 0.036 |
| `static_2025` / gradient boosting | **+0.137** | **0.153** |

**This is the result that goes most clearly against us, and it should not be softened.**
On the tier that shares two of the detector's three components, agreement is real but
modest (ρ ≈ +0.34 — the two rankings share about 12% of their rank variance). On the strictly
independent tier, agreement is **statistically indistinguishable from zero** (ρ = +0.137,
*p* = 0.15). Two methods that both find datacenter regions are *not* converging on the
same ranking.

### Why — and this is the substantive finding, not an excuse

The detector and the labels are answering different questions.

- The detector is a **change** detector. It scores 2019 → 2025 movement and by design says
  nothing about a region that has hosted datacenters since 2014 and has been flat the
  whole time.
- The labels are a **level** question: *where are the datacenters now?* Fourteen labelled
  regions sit below detector rank 70, and they are dominated by long-established sites —
  `MISO` (15 mapped facilities across 13 operators, rank 89), `SOCO` (6, rank 93), `DUK`
  (4, rank 76), `NYIS/ZONJ` (1, rank 82), `PACE` (4, rank 85), `ERCO/NCEN` (6, rank 91,
  the Dallas miss already documented as a known limitation).

The experiment therefore says something sharper than "the model disagrees":
**the detector is not a datacenter locator, it is a datacenter-*arrival* detector, and the
two targets are separable in the data.** A model trained on "where are they now" recovers
static flatness and largely ignores change; the detector does the reverse. Both are
defensible; they are not the same instrument, and the project should stop implying they
are interchangeable.

### Where they disagree most, region by region

Model ranked far above the detector (`shape_change` / GB):

| Region | Labelled | Model rank | Detector rank | 2025 avg MW | Why |
|---|---|---|---|---|---|
| `ERCO/COAS` | 0 | 1 | 56 | 14,511 | Houston coast: large, flat, industrially dominated, season-insensitive — everything the model rewards, with no *recent* change for the detector to see. Unlabelled, and a plausible coverage gap. |
| `SWPP/SECI` | 0 | 2 | 80 | 725 | Small and very flat. Most likely a false positive: flat rural/industrial load looks identical to flat datacenter load in demand alone. |
| `MISO` | **1** | 11 | 89 | 75,765 | 15 mapped facilities. A genuine model win — the detector ranks it 89th because MISO's aggregate growth is 2.2%. |
| `PACE` | **1** | 30 | 85 | 6,119 | 4 mapped facilities, detector rank 85. Second genuine model win. |
| `WALC`, `PSCO`, `NWMT`, `SCEG` | 0 | 18–46 | 94–108 | 1.0–5.2 GW | Flat western/southeastern load; unlabelled. |

Detector ranked far above the model:

| Region | Labelled | Model rank | Detector rank | Why |
|---|---|---|---|---|
| `ERCO/FWES` | **1** | 58 | 2 | **The model's worst miss.** +116% demand growth 2019→2025, four mapped facilities, and the model puts it 58th because its 2025 shape is not unusually flat. A pure level model cannot see an explosion in progress. The detector is right here and the model is wrong. |
| `NYIS/ZONC` | **1** | 106 | 32 | Two mapped sites: TeraWulf Lake Mariner (grid-connected) and Vulcan/Greenidge Dresden, which draws **all** its power from its own 106 MW behind-the-meter plant. Half the labelled load there is invisible to the features by construction — a partial excuse for the model, not a full one. |
| `NYIS/ZONG`, `NYIS/ZONF`, `ISNE/4006`, `ISNE/4002`, `PJM/JC`, `FPC` | 0 | 87–110 | 20–45 | Regions the detector flags on overnight excess with flat or falling total demand — the "possible midday solar suppression" pattern. The model, seeing no flatness in levels, ranks them at the bottom. Unlabelled, so this experiment cannot adjudicate. |

`ERCO/FWES` and `NYIS/ZONC` between them are the whole story: one case where the change
detector is clearly right and the level model is clearly wrong, and one case where the
label is unreachable by construction.

---

## Calibration

Out-of-fold probabilities, five equal-count bins. Base-rate-only model Brier = 0.2466.

| | Brier | Q1 pred → obs | Q2 | Q3 | Q4 | Q5 |
|---|---|---|---|---|---|---|
| `shape_change` / GB | **0.2193** | 0.048 → 0.174 | 0.209 → 0.273 | 0.425 → 0.455 | 0.640 → 0.636 | 0.875 → **0.682** |
| `static_2025` / GB | 0.2206 | 0.065 → 0.174 | 0.203 → 0.273 | 0.414 → 0.545 | 0.657 → 0.545 | 0.880 → **0.682** |
| `shape_change` / logistic | 0.2449 | 0.066 → 0.217 | 0.201 → 0.273 | 0.413 → 0.591 | 0.663 → 0.545 | 0.861 → 0.591 |

The boosted models beat the base rate (0.219 vs 0.247) and the observed rate rises
monotonically across bins, so the ordering is usable. **The logistic model is essentially
uncalibrated** — Brier 0.2449 against a base rate of 0.2466 is no improvement worth
quoting, and its middle bins are non-monotone.

Both boosted models are **over-confident at the top**: the highest bin predicts 0.88 and
delivers 0.68. Part of that is ordinary small-sample over-fitting. Part of it is the
contaminated negatives — a model that confidently flags `ERCO/COAS` and `SWPP/SECI` is
scored as wrong there, and we have no way to tell how much of the 0.88 → 0.68 gap is
over-confidence and how much is our own missing coverage. **Do not put these probabilities
on a screen as percentages.** They are a ranking, not a risk estimate.

---

## Label sensitivity

Headline set (`shape_change` / gradient boosting) re-run under each label variant:

| Variant | Positives | Fold AUC | Fold AP | Pooled AP |
|---|---|---|---|---|
| Primary — 134 sites, zone → BA propagated | 49 | 0.718 ± 0.095 | 0.676 ± 0.108 | 0.611 |
| **Behind-the-meter sites excluded** (123) | 46 | 0.695 ± 0.101 | 0.636 ± 0.114 | 0.580 |
| No zone → parent-BA propagation | 48 | 0.685 ± 0.088 | 0.636 ± 0.090 | 0.577 |
| Both | 45 | 0.693 ± 0.101 | 0.633 ± 0.109 | 0.577 |

**Counter-intuitive and reported as it came out:** removing the eleven invisible
behind-the-meter sites made performance slightly *worse* (AUC 0.718 → 0.695), not better.
The expected effect was the opposite. The likely reason is arithmetic rather than
physical: eight of the eleven sit in regions that also contain visible facilities, so
excluding them changes the region label in only three cases while shrinking the positive
class. The differences are all well inside the ±0.10 fold spread and none of them should
be read as a real effect.

**Grouped CV.** `PJM` and `PJM/DOM` are not independent samples — the BA's demand is the
sum of its zones. Re-running with `StratifiedGroupKFold` on the parent BA, so a zone and
its parent can never land on opposite sides of a split:

| Model | Fold AUC | Fold AP | Pooled AUC | Pooled AP |
|---|---|---|---|---|
| gradient boosting | 0.722 ± 0.104 | 0.687 ± 0.103 | 0.691 | 0.605 |
| logistic | 0.672 ± 0.090 | 0.644 ± 0.128 | 0.638 | 0.542 |

Essentially unchanged from the ungrouped 0.718 ± 0.095. **The nesting is not what is
producing the result** — worth knowing, because it is the first thing a careful reader
would suspect.

**Restricted samples**, where the size confound is much weaker inside each stratum:

| Sample | n | Positives | Shape AUC / AP | Size-only AUC / AP |
|---|---|---|---|---|
| Zones only | 68 | 28 | 0.618 / 0.575 | **0.737 / 0.723** |
| BAs only | 43 | 21 | 0.742 / 0.773 | **0.753 / 0.813** |

Size wins in both strata. Among zones the shape model is weak in absolute terms
(AUC 0.618) — and zones are exactly where the BA-level label contamination is worst, so
this is the cell where the measurement is least trustworthy in either direction.

---

## What this does not establish

1. **It does not establish that the frozen detector is right.** Independent corroboration
   was the goal and it is not what came back. Agreement is ρ = +0.344 on the overlapping
   tier and ρ = +0.137 (*p* = 0.15) on the independent one. The defensible claim is that
   flat load leaves a detectable fingerprint in hourly demand, not that the detector's
   particular ranking is confirmed.
2. **It does not establish that load shape beats region size.** It loses to it
   (paired ΔAUC −0.030, *p* = 0.022), and adding shape on top of size does not measurably
   help (*p* = 0.29). The shape carries signal *beyond* size (stratified permutation
   *p* = 0.010–0.032), which is a weaker statement than "it is a better predictor", and
   the two are easy to conflate.
3. **It does not establish that the flagged regions host datacenters** rather than any
   other flat 24/7 load. Crypto mining, oilfield electrification and continuous-process
   industry all produce the same fingerprint. `SWPP/SECI` at model rank 2 with 725 MW is
   the clearest illustration.
4. **n = 111.** Fold-to-fold SD is 0.09–0.13 AUC. Nothing here resolves a difference under
   about 0.05 AUC, and no claim in this document rests on one.
5. **The negatives are contaminated, and not at random.** Scores here are lower bounds,
   but the contamination correlates with region size and obscurity, so "lower bound" is a
   direction, not a correction anyone can apply.
6. **Eleven labelled sites are unreachable by construction.** Behind-the-meter load never
   crosses the EIA-930 boundary. No demand-only method, ours or a model's, can ever recover
   them.
7. **The labels are ours.** 134 facilities hand-curated by this team. A different
   analyst's list would produce different numbers, and the *p*-values do not account for
   that.
8. **No multiplicity correction.** See the caveat under the permutation table.
9. **Nothing here is a trading signal, a price claim, or a forecast.** No backtest was run
   and none is planned.
10. **`shape_change` spans two of the detector's three components.** Agreement measured on
    that tier is partly agreement by construction. `static_2025` is the tier to quote for
    independence, and it is the tier where agreement vanishes.

---

## Reproducing

```bash
source ~/hackmit-venv/bin/activate
pip install scikit-learn scipy                      # not in the base venv
python3 scripts/vendor/pudl_fetch.py --output-dir data/pudl \
  --table out_eia930__hourly_subregion_demand --table out_eia930__hourly_operations \
  --table core_eia__codes_balancing_authorities \
  --table core_eia__codes_balancing_authority_subregions
python3 scripts/l3_detector.py                      # needed only for the agreement section
python3 -m engine.ml.experiment
```

Seed `20260920`, fixed in `engine/ml/__init__.py` and used for every split, every model
and every permutation draw. Permutations are drawn up front from one seeded generator, so
the null is identical regardless of how joblib schedules the fits — the run is
bit-reproducible, and was confirmed so by two independent executions producing identical
Section-1 tables.

Runtime **1,951 s** (32.5 min) on an M-series Mac, 10 cores, dominated by the 3,000
gradient-boosting permutation CVs (45,000 fits). Feature construction from the raw
parquet is 8.7 s.
Python 3.14.2, scikit-learn 1.9.1, scipy 1.18.1, pandas 3.0.6, numpy 2.5.3.

Outputs: `engine/ml/results/experiment.json` (every number in this document),
`importance_*.csv` (full importance tables, all 52 features),
`oof_vs_detector.csv` (per-region model probability, model rank, detector rank, label).
The feature matrix is cached at `data/processed/ml_features.csv` (gitignored; delete to
rebuild).

## Module layout

| File | Contents |
|---|---|
| `engine/ml/__init__.py` | the seed, and the leakage contract in one paragraph |
| `engine/ml/labels.py` | label construction, the eleven behind-the-meter sites, the five noise channels documented in place |
| `engine/ml/features.py` | the seventeen shape features, the three tiers, the hard constraints |
| `engine/ml/experiment.py` | CV, permutation tests, held-out importance, agreement, calibration, sensitivity, paired comparison |

`l3_detector.csv` is read in exactly one place — `experiment.py` section 4 — and never
reaches the feature matrix. `scripts/` is untouched.

