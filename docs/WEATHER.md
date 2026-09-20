# Weather control: is Wattson detecting datacenters, or air conditioning?

**Module:** `engine/weather/` | **Run:** `python3 -m engine.weather` (35 s) | **Seed:** 20260920
**Results:** `engine/weather/results/weather_results.json`, `regions.csv`, `stations.csv`

---

## The objection

> Overnight demand grew because summers got hotter. You are detecting air
> conditioning and climate, not datacenters.

It is the strongest objection to the flat-load detector and until now Wattson had
no answer to it. Cooling is the largest driver of US summer demand growth, it has
risen over exactly our 2019 to 2025 window, and the detector had never controlled
for it.

## The answer, in four numbers

| | |
|---|---|
| Share of cross-regional **overnight demand growth** explained by the change in overnight degree hours | **R² = 0.074** |
| Share of the **71,861 MW** of overnight demand growth across the 111 scored regions that each region's own temperature response explains | **7.8%** (5,629 MW) |
| Spearman between the **shipped ranking** and the **weather-adjusted ranking** | **0.965** (Control B) / **0.850** (Control A) |
| Regions whose **nights** grew faster than their **days** after each region's own weather response is removed | **96 of 111** (86%) |

The signal survives. Weather is real, it is measurable, and it accounts for under
a tenth of the overnight growth the detector keys on. The last row is the part
that ends the argument: cooling load peaks in the afternoon, so if the overnight
growth were air conditioning, daytime growth would have to be larger still. It
is smaller, in 86% of regions.

And the single sharpest fact in the file: **PJM/DOM, Dominion in northern Virginia,
the region this whole project is about, was 0.21 °C *cooler* overnight in January
to August 2025 than in the same window of 2019, while its overnight demand rose
3,960 MW.** Its weather response explains 83 MW of that. Two percent.

---

## 1. Data

**Source.** NOAA Integrated Surface Database, `s3://noaa-global-hourly-pds`
(public, anonymous, <https://registry.opendata.aws/noaa-isd/>). Station inventory
from `https://www.ncei.noaa.gov/pub/data/noaa/isd-history.csv`.

ISD in full is roughly 600 GB. This module pulls single station-years for a
curated set of stations and throws away everything but five columns.

| | |
|---|---|
| Stations fetched | **138** unique |
| Years fetched | **2018-2025** (8), 1,104 station-years, 0 absent |
| Rows retained | **9,177,306** station-hours |
| Fetch time | **69 s** at 16 threads |
| Analysis window | day-of-year 1-238, i.e. **1 Jan to 26 Aug**, in both 2019 and 2025 |

**The archive stops in August 2025.** The last global-hourly observation in the
bucket is 2025-08-27 (Dulles), 2025-08-25 (O'Hare), 2025-08-26 (Phoenix), and
there is no `2026/` prefix at all. Two consequences, both stated rather than
worked around:

- The shipped detector compares **calendar** 2019 against calendar 2025. The
  weather control cannot. It runs on the frozen detector's own `jan_aug` window
  instead, and the day-of-year span is cut to 238 in *both* years so the two
  years see the same slice of the season.
- The 2026 Jan-Aug holdout **cannot be weather-controlled at all**. Nothing in
  this document says anything about it.

The window change is not free, so it is measured separately from the weather
effect: Spearman between the frozen calendar ranking and the frozen Jan-Aug
ranking, with no weather involved at all, is **0.978**. Everything below that is
weather.

**Observation filter.** `TMP` is `+0078,1`: tenths of a degree Celsius, then a
quality code. Dropped: the missing marker `+9999`; quality codes 2, 3, 6, 7
(ISD's "suspect" and "erroneous"); report types `SOD` and `SOM` (daily and
monthly summaries, not observations); and `FM-16` (SPECI: special reports are
triggered by *changing* conditions, so keeping them would weight unsettled hours
above calm ones). Kept: quality 0, 1, 4, 5, 9 and report types FM-12 (SYNOP) and
FM-15 (METAR). Surviving observations inside a clock hour are averaged. A
physical sanity filter drops anything outside -80 °C to +60 °C.

**Gap rule.** A region with several anchors averages whichever of them reported
that hour. A region-hour with nothing at all is linearly interpolated across gaps
of at most 6 hours; longer gaps stay missing and are excluded from every mean.

| Gap outcome | Count |
|---|---|
| Region-hours in the two analysis windows | 1,281,407 |
| Still missing after averaging and interpolation | **981** (0.077%) |
| Worst single region-year coverage | PJM/AE 2025, **98.74%** |
| Mean coverage | 99.92% |

---

## 2. Stations

**Assignment rule.** Each region gets a hand-curated list of one to four primary
airports, written as ICAO identifiers in `engine/weather/stations.py`. The ICAO
code is the *only* hand-entered value: station id, latitude, longitude and period
of record all come from NOAA's own inventory. Anchors were chosen from the
published footprint of each balancing authority or subregion before any weather
data was pulled. A region whose anchors could not be resolved would be dropped and
counted; none were. One curated code (KUCA, Utica NY) is not in the usable
inventory, and NYIS/ZONE falls back to its second anchor KRME (Rome/Griffiss).

| | |
|---|---|
| Scored regions in the frozen detector | 111 |
| Regions mapped to at least one station | **111** |
| Regions dropped for want of a station | **0** |
| Stations per region | median 1, mean 1.59, max 4 |

Examples: PJM/DOM is Dulles (72403093738) and Richmond (72401013740);
SWPP/OPPD is Eppley Airfield, Omaha (72550014942); ERCO/NRTH is Sheppard
AFB/Wichita Falls (72351013966). The full table is `results/stations.csv`.

**Why not an automatic centroid.** The obvious rule, a capacity-weighted centroid
of the region's EIA-860 plants and then the nearest airport, is wrong for importing
regions, and `engine/weather/geo.py` computes it anyway to show how wrong:

| Region | Anchor | Distance to its generation centroid |
|---|---|---|
| SCL (Seattle City Light) | KSEA | **286 km** (its dams are on the Skagit) |
| CPLW (Duke Progress West) | KAVL | 212 km |
| LDWP (LA Dept of Water & Power) | KBUR, KLAX | 181 km (Intermountain is in Utah) |
| PACW | KPDX, KMFR | 179 km |
| WACM | KDEN, KGJT | 176 km |

Across the 77 regions where a generation centroid is derivable at all, the median
anchor-to-centroid distance is **54 km** and the 90th percentile is 147 km. The
34 regions with no derivable centroid are the geographically named subregions
(ERCOT weather zones, MISO local resource zones, ISO-NE states, NYISO zones):
they have no named utility to match plants against, so their entry is null rather
than a guess.

These are wide, coarse regions. PJM spans Chicago to New Jersey and four anchors
do not fix that. The honest description of the temperature series is "the climate
of the region's main load centers", not "the region's temperature".

---

## 3. Degree hours

**Base temperature: 65 °F = 18.333 °C.** It is the US convention (NOAA, EIA,
every utility rate case) and it is a *convention*, not a measurement. It dates
from a 1920s estimate of the outdoor temperature at which a building needs
neither heating nor cooling, and modern buildings with more internal gain start
cooling lower. So the whole test is run again at 60 °F and 70 °F; see §7.

**Degree HOURS, not degree days.** The standard CDD is
`max(daily mean - base, 0)`. That is useless here: it cannot tell overnight from
afternoon, which is the entire question. This module uses
`CDH_h = max(T_h - base, 0)` per hour, averaged over the window. Because
`max(·,0)` is convex, mean hourly CDH exceeds the CDD implied by the daily mean;
the two are never mixed.

**Windows are the detector's own**, computed on the detector's own clock: ISD
timestamps are UTC and each region is localized with the same
`report_timezone` that `scripts/l3_detector.py` uses for its demand, so the
weather hour and the demand hour are the same hour by construction. Overnight is
local 00:00-05:59, daytime is local 10:00-15:59.

**It did get warmer.** Mean change across the 111 regions, Jan to 26 Aug, 2019 to
2025:

| | all hours | overnight | daytime |
|---|---|---|---|
| Temperature | **+0.49 °C** | +0.33 °C | +0.62 °C |
| CDH (65 °F), °C-h per hour | +0.202 | +0.143 | +0.237 |
| HDH (65 °F), °C-h per hour | -0.293 | -0.185 | - |

80 of 111 regions warmed; 31 cooled. The objection has a real basis. The question
was only ever how much of the demand growth it buys.

---

## 4. Control A: cross-sectional residualization

This is the test the brief asks for. Across the 111 scored regions, regress
2019→2025 growth on the 2019→2025 change in degree hours, then push the residuals
back through the **frozen** scoring formula.

```
overnight_growth_pct ~ 1 + Δ CDH_night + Δ HDH_night        R² = 0.0737  (adj 0.0566, F p = 0.016)
       growth_pct    ~ 1 + Δ CDH_all   + Δ HDH_all          R² = 0.1055  (adj 0.0889, F p = 0.0024)
```

| Coefficient | Estimate | p |
|---|---|---|
| Δ CDH overnight → overnight growth | +23.4 pts per °C-h | 0.0046 |
| Δ HDH overnight → overnight growth | +0.9 pts per °C-h | 0.79 |
| Δ CDH all hours → average growth | +20.9 pts per °C-h | 0.00054 |

The cooling coefficient is real and correctly signed. It explains **7.4%** of the
cross-regional variation in overnight demand growth.

**Re-scoring.** Residuals are re-centered on the sample mean so they stay readable
as percent growth. Then: overnight excess is recomputed as
`residual overnight growth - residual average growth`; neighbor divergence is
recomputed from residual growth **inside the frozen peer groups**; load-factor
delta is untouched; the same robust z and the same 1 / 1 / 0.5 weights are
applied. Nothing about the detector is retuned. A guard asserts that this
module's re-implementation of the peer rule reproduces the shipped
`neighbor_divergence` to **exactly 0.0** before any adjusted score is computed.

Three variants are reported so the choice of what to residualize is visible:

| Variant | What is adjusted | Spearman vs shipped |
|---|---|---|
| full | overnight excess **and** neighbor divergence | **0.850** |
| minimal | overnight excess only | 0.880 |
| direct | overnight excess regressed straight on Δ(night - all) weather | 0.957 |

**Control A's blind spot, stated plainly.** It uses only variation *between*
regions. A warming that hit every region equally would be invisible to it and
would be absorbed into the intercept. That is why Control B exists.

---

## 5. Control B: per-region weather normalization

For each region and each window, fit that region's **own 2019 hourly demand** on
its **own hourly** cooling and heating degree hours plus hour-of-day and weekend
effects; then predict 2025 from the 2019 response and 2025's actual weather.
Growth past that prediction is growth that weather does not explain, in MW. A
warming common to the whole country is removed here, because each region is
compared only against itself.

The model finds air conditioning, decisively:

| | |
|---|---|
| Median 2019 overnight fit R² | **0.733** |
| Median t-statistic on the CDH coefficient | **47.2** |
| Regions with a positive CDH coefficient | **111 of 111** |
| Max share of 2025 hours outside 2019's own temperature range | 3.8% |

And then it finds that there was not enough weather change to matter:

| | Overnight MW change | Weather-explained | Share |
|---|---|---|---|
| All 111 regions | **+71,861 MW** | +5,629 MW | **7.8%** |
| The 59 regions that grew >100 MW overnight | +71,317 MW | +4,825 MW | **6.8%** |
| Median region among those | - | - | **4.8%** |

Control A says 7.4%, Control B says 7.8%. They are built differently, one
cross-sectional and one within-region, and they agree.

### The sharper test: night versus day

Cooling load peaks in the afternoon. If overnight growth were cooling, daytime
growth would have to be larger still. After each region's own weather response is
removed:

| | |
|---|---|
| Mean night-minus-day weather-adjusted growth | **+5.7 points** |
| Median | +4.7 points |
| Regions where night exceeds day | **96 of 111 (86.5%)** |

---

## 6. The ranking

Spearman rank correlation against the **shipped** (calendar 2019→2025) ranking,
all n = 111:

| Comparison | ρ | Kendall τ |
|---|---|---|
| Jan-Aug window, **no weather adjustment at all** | 0.978 | 0.885 |
| **Control B** (per-region normalization) | **0.965** | 0.854 |
| Control B, quadratic temperature response | **0.974** | - |
| **Control A** (cross-sectional, full) | **0.850** | 0.672 |
| Control A vs the frozen Jan-Aug ranking | 0.874 | 0.707 |

### Top 10 as shipped

| Region | Shipped | Jan-Aug | Control A | Control B | Weather share of overnight growth | Night - day (pts) |
|---|---|---|---|---|---|---|
| ERCO/NRTH | 1 | 1 | **1** | **1** | 1.1% | +20.1 |
| ERCO/FWES | 2 | 2 | **2** | **2** | 1.0% | **-4.5** |
| AZPS | 3 | 4 | 5 | 7 | 9.4% | +18.9 |
| TEPC | 4 | 3 | 6 | 4 | 14.5% | +23.4 |
| WACM | 5 | 6 | 3 | 3 | -3.2% | +3.8 |
| PJM/DOM | 6 | 5 | 8 | **6** | 2.1% | +7.5 |
| SWPP/OPPD | 7 | 7 | 4 | 5 | -2.8% | +9.8 |
| ERCO | 8 | 8 | 10 | 8 | 4.8% | +8.1 |
| SC | 9 | 9 | 11 | 9 | 4.5% | +6.5 |
| CISO/SDGE | 10 | 13 | 17 | 15 | -4.0% | +12.0 |

Nine of the top ten stay in the top eleven under Control A and the top nine stay
in the top nine under Control B. The largest top-ten move is CISO/SDGE, 10 → 15,
and most of that (10 → 13) is the window change, not weather.

### The four pre-registered validation regions

Named in `scripts/l3_detector.py` before the ranking was ever seen.

| Region | Shipped | Jan-Aug | Control A | Control B | Verdict |
|---|---|---|---|---|---|
| PJM/DOM | 6 | 5 | 8 | **6** | holds |
| SWPP/OPPD | 7 | 7 | 4 | **5** | holds, improves |
| PJM/AEP | 19 | 32 | 41 | **30** | **weakens** |
| ERCO/NCEN | 91 | 69 | 61 | **63** | the documented miss, improves |

**PJM/AEP is the one that moves against us, and the decomposition matters.** It
falls 19 → 32 on the *window change alone*, before any weather is involved. Weather
control then moves it to 41 (Control A) or back to 30 (Control B). So most of
AEP's loss is the shortened window, not the weather. Weather does explain 12.5%
of AEP's overnight growth, the highest share of any validation region.

ERCO/NCEN, the Dallas miss that the project reports as-is, improves under both
controls, from 91 to 61/63. It is still a miss. The cause is unchanged and
documented: neighbor divergence penalizes a zone inside a booming BA.

### Permutation test

Imported directly from `engine/stats/permutation.py` (`label_permutation`), the
same exact-enumeration test the stats module runs on the shipped detector, with
100,000 seeded Monte Carlo draws as a cross-check. Statistic: the mean score, and
the mean rank, of the four pre-registered regions.

| Ranking | p (mean score) | p (mean rank) |
|---|---|---|
| Shipped calendar | 0.0488 | 0.0571 |
| Frozen Jan-Aug | 0.0558 | 0.0401 |
| Control A (full) | **0.0616** | 0.0416 |
| Control B | 0.0562 | **0.0284** |

On the score statistic the weather-adjusted p-values drift above 0.05. On the
rank statistic, the outlier-insensitive one, every adjusted ranking is
*stronger* than the shipped ranking, and Control B is the strongest of all at
0.028. Read them together, not separately: the score statistic is carried by
ERCO/NRTH's extreme value, which is exactly why the stats module reports both.

---

## 7. Sensitivity

| Specification | R² overnight | R² average | ρ(A, shipped) | ρ(B, shipped) | Weather share of overnight MW | Night > day |
|---|---|---|---|---|---|---|
| **65 °F, Jan-Aug (primary)** | 0.0737 | 0.1055 | 0.850 | **0.965** | **7.8%** | 86.5% |
| 60 °F, Jan-Aug | 0.0984 | 0.1255 | 0.845 | 0.966 | 6.3% | 87.4% |
| 70 °F, Jan-Aug | 0.0447 | 0.0673 | 0.870 | 0.963 | 9.7% | 87.4% |
| 65 °F, Jan-Jul | 0.1148 | 0.1943 | 0.799 | 0.960 | 10.2% | 89.2% |
| 65 °F, 5% winsorized | 0.0495 | 0.1302 | 0.907 | 0.965 | 7.8% | 86.5% |
| 65 °F, quadratic response | 0.0737 | 0.1055 | 0.850 | **0.974** | 9.1% | 89.2% |

The Jan-Jul row is the one that removes the five-day mismatch between the weather
window (through 26 Aug) and the detector's `jan_aug` demand window (through 31
Aug) entirely: both sides are complete in both years. It moves the weather share
from 7.8% to 10.2% and the ranking correlation from 0.965 to 0.960.

The quadratic row is the harder test, not the easier one: a linear degree-hour
response understates demand in extreme heat, and 2025 asks the 2019 model to
extrapolate past its own range for up to 3.8% of hours. Adding CDH² and HDH²
gives weather more room, and it takes 9.1% instead of 7.8%, while the ranking
correlation goes *up*, to 0.974.

Across every specification: weather takes between 6.3% and 10.2% of overnight
growth, the Control B ranking correlation never leaves 0.960-0.974, and nights
beat days in 86% to 89% of regions.

---

## 8. What came out against us

Reported because it is true, not because it is comfortable.

1. **Control A pushes the permutation p-value on the score statistic from 0.0488
   to 0.0616.** It crosses 0.05. The rank statistic goes the other way (0.0571 to
   0.0416), and Control B improves both, but the honest summary is that the
   score-based test is not robust to which control you pick.
2. **PJM/AEP, a pre-registered validation region, falls from 19th to 30th (B) or
   41st (A).** Most of that is the window change, but not all of it: weather
   explains 12.5% of AEP's overnight growth, the most of any validation region.
3. **ERCO/FWES, the 2nd-ranked region, grew faster in the day than at night**
   after weather control (+122.2% vs +117.7%). It fails the night-versus-day test
   while passing everything else. Far West Texas is the Permian Basin; oilfield
   electrification is one of the load types the detector explicitly says it
   cannot separate from datacenters, and this is what that looks like.
4. **Four other regions fail the night-versus-day test with a real margin:**
   CISO/SCE (night +10.1% vs day +20.1%), SWPP/GRDA (-5.6 pts), GCPD (-1.5),
   NEVP (-1.0). CISO/SCE's pattern is the midday-solar-suppression shape the
   detector already labels, not a flat-load shape.
5. **Some regions really are mostly weather.** Among regions that grew more than
   100 MW overnight: PJM/CE (Commonwealth Edison, Chicago) is **91%**
   weather-explained, SWPP/CSWS 57%, CPLE 45%, TEC 29%, PJM/PS 28%, JEA 28%,
   MISO/8910 28%, MISO 26%. CPLE falls 74 → 89 as a result. For these regions the
   objection is correct and the detector should not be leaned on.
6. **PJM as a whole** falls 52 → 69: weather explains 1,250 MW of its 6,608 MW
   overnight growth (19%). The PJM/DOM story is unaffected, since Dominion alone is
   3,960 of those 6,608 MW with 83 MW weather-explained, but the parent BA's
   detector rank is weaker than it looked.
7. **31 of 111 regions got cooler**, not warmer, over the window. That helps the
   headline, but it is also a reminder that six years is short: this is weather,
   not climate, and a different six-year pair could give a different sign.

---

## 9. What this does not establish

- **It does not establish that the growth is datacenters.** It establishes that
  the growth is not weather. Everything the frozen detector already says applies:
  it flags flat 24/7 load in general (datacenters, crypto mining, oilfield
  electrification) and the correct language remains "consistent with", never
  "caused by". Item 3 above is a live example of a non-datacenter load passing.
- **It controls for temperature only.** Humidity, wind chill, cloud cover and
  solar gain are all in ISD and none of them are used here. Cooling load responds
  to wet-bulb, not dry-bulb; a region that got more humid at the same temperature
  would show up as unexplained growth. Dry-bulb degree hours are the standard
  utility control, not a complete one.
- **It does not separate weather from economic growth, electrification or
  efficiency.** Everything that is not temperature lands in the residual. The
  residual is "not weather", not "datacenters".
- **The regions are coarse and the stations are points.** One to four airports
  stand in for footprints that can span several states and more than one climate
  zone. Anchor spread within a region reaches 1,423 km (MISO). The median
  distance from an anchor to the region's generation centroid is 54 km and the
  maximum is 286 km.
- **The 2019 response function is fit on 2019 and extrapolated.** If a region's
  air-conditioning saturation or building stock changed between 2019 and 2025,
  the 2019 response is the wrong response for 2025. Note the direction: new
  datacenter load has a chiller response of its own, so part of what this model
  credits to "weather" in 2025 is the new load's own cooling. That bias runs
  against our conclusion, not for it. Likewise, the model has no seasonal term
  other than temperature, so any non-temperature seasonality (irrigation, for
  instance) is partly absorbed into the CDH coefficient, again inflating the
  weather share, again against us.
- **Calendar-year 2025 is not covered.** NOAA's archive ends 26 August 2025.
  Every number here is a Jan-to-late-August comparison. September to December
  2025, where PJM's winter overnight behavior would show up, is untested.
- **The 2026 Jan-Aug holdout is completely untested.** There is no 2026 ISD data.
  Nothing here supports or undermines the holdout result in `docs/STATS.md`.
- **The station mapping is hand-curated.** 111 ICAO codes were picked by a human
  from published footprints. The coordinates and station ids are NOAA's, and the
  distances to an independently computed generation centroid are published so the
  mapping can be checked, but a wrong anchor would produce a wrong control for
  that region and nothing here would catch it.
- **The detector was not changed and must not be.** Control A and Control B
  produce alternative rankings for the purpose of testing the shipped one. The
  shipped ranking remains the calendar-year ranking in
  `data/processed/l3_detector.csv`.

---

## 10. Reproducing

```bash
source ~/hackmit-venv/bin/activate
python3 -m engine.weather
```

35 s on a warm cache (69 s more for the first ISD pull, 1,104 station-years).
Requires `boto3`; the ISD bucket is anonymous, no credentials. The raw pull is
cached to `data/weather/isd_hourly_2018_2025_8y.parquet` (35 MB), which is
gitignored; `data/weather/isd-history.csv` is NOAA's inventory as fetched.

Everything except the permutation Monte Carlo cross-check is closed form. That
draw is seeded from `MASTER_SEED = 20260920`.
