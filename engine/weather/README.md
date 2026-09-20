# engine.weather: the weather control

Answers the strongest objection to the flat-load detector: *"overnight demand grew
because summers got hotter; you are detecting air conditioning, not datacenters."*

```bash
source ~/hackmit-venv/bin/activate
python3 -m engine.weather              # 35 s warm, +69 s for the first ISD pull
python3 -m engine.weather --quick      # primary spec only, no sensitivities
```

Write-up: [`docs/WEATHER.md`](../../docs/WEATHER.md).
Results: `results/weather_results.json`, `results/regions.csv`, `results/stations.csv`.

## The result

| | |
|---|---|
| Cross-regional overnight demand growth explained by Δ degree hours | R² = **0.074** |
| Share of the 71,861 MW of overnight growth explained by each region's own temperature response | **7.8%** |
| Spearman, shipped ranking vs weather-adjusted ranking | **0.965** (Control B), 0.850 (Control A) |
| Regions whose nights grew faster than their days after weather control | **96 of 111** |

PJM/DOM was **0.21 °C cooler** overnight in Jan-Aug 2025 than in Jan-Aug 2019
while its overnight demand rose **3,960 MW**. Its own temperature response
explains 83 MW of that.

## Files

| File | What it does |
|---|---|
| `stations.py` | The curated region → ICAO table, and resolution against NOAA's `isd-history.csv`. The ICAO code is the only hand-entered value; ids and coordinates are NOAA's. |
| `fetch.py` | Anonymous S3 pull from `noaa-global-hourly-pds`, the observation quality filter, and localization onto the frozen detector's own clock. |
| `degreedays.py` | Cooling and heating degree **hours** on the detector's windows (night 00-05, day 10-15 local). Base 65 °F, with 60 °F and 70 °F as sensitivities. |
| `geo.py` | Capacity-weighted EIA-860 plant centroids. A **cross-check** on the anchors, never the assignment rule; see the LDWP and SCL cases. |
| `control.py` | Control A (cross-sectional residualization) and Control B (per-region weather normalization), plus the re-score through the frozen formula. |
| `__main__.py` | Runs everything, writes `results/`, prints the report. |

## Rules this module keeps

- **The detector is frozen.** `control.verify_peers()` asserts that this module's
  re-implementation of the frozen peer rule reproduces the shipped
  `neighbor_divergence` to exactly 0.0 before any adjusted score exists. The
  scoring formula, the weights and the robust z are imported behaviour, not
  re-tuned.
- **Local time is the detector's local time.** ISD is UTC; each region is
  localized with the same `report_timezone` `scripts/l3_detector.py` uses, so the
  weather hour and the demand hour are the same hour by construction.
- **Nothing is invented.** Station ids, coordinates and periods of record come
  from `isd-history.csv`; every temperature comes from a station-year actually
  fetched. A region that could not be mapped would be dropped and counted.
- **NOAA's archive ends 26 August 2025.** The control therefore runs on the frozen
  detector's `jan_aug` window with both years cut to the same day-of-year span.
  There is no 2026 ISD data, so the 2026 holdout is untested here.
- **Seeded.** `MASTER_SEED = 20260920`. The only random draw is the Monte Carlo
  cross-check inside `engine.stats.permutation`; everything else is closed form.
