# engine/shape — load shape, unsupervised

Two questions about the *shape* of demand, both answered without the detector.

1. **Do datacenter grids cluster together on load shape alone?** PCA + k-means +
   Ward on the normalized 24-hour local-time demand profile of every region, then a
   hypergeometric / Fisher enrichment test against the 134 sites in
   `claims/lookup/facilities.csv`.
2. **When did each region's load go flat?** PELT and binary segmentation on the
   monthly overnight-to-average demand ratio, 2018-01 to 2026-08, per region.

Findings, caveats and the numbers live in [`docs/SHAPE.md`](../../docs/SHAPE.md).
The headline is that **Q1 is a null result** and it is reported as one.

```bash
source ~/hackmit-venv/bin/activate
pip install ruptures                 # scikit-learn and scipy are already in the venv
python3 -m engine.shape              # ~90 s after the first panel build
```

Writes `engine/shape/shape.json` (~420 kB) and `engine/shape/pca_scatter.svg`.
Panels are cached to `data/processed/shape_{hour,month}_panel.parquet` (gitignored);
delete them or call `profiles.panels(refresh=True)` to rebuild from the parquet.

## Independence, structurally enforced

`profiles.py`, `cluster.py`, `changepoint.py` and `sites.py` read exactly two things:
PUDL parquet under `data/pudl/` and `claims/lookup/facilities.csv`. None of them
imports the detector, `data/processed/l3_detector.csv` or
`dashboard/public/data/regions.json`.

`compare.py` is the one file allowed to read detector output. `build.py` calls it
**after** both questions are finished and hands it completed results, so there is no
path by which a detector number can reach a fit. If you extend this module, keep that
split — it is the whole value of the exercise.

## Files

| file | what it does |
|---|---|
| `profiles.py` | loads EIA-930 demand, converts to **local time**, rebuilds the detector's 111-region universe from raw parquet, emits the hour and month panels, deseasonalizes |
| `cluster.py` | Q1: profile matrix, PCA, silhouette-chosen k, k-means + Ward, hypergeometric / Fisher enrichment |
| `changepoint.py` | Q2: PELT + Binseg, COVID and edge-of-window flags, night-vs-day decomposition of each break, timing tests |
| `sites.py` | facilities.csv → region labels, plus four pre-specified sensitivity label sets |
| `compare.py` | post-hoc only: correlates the finished results with the shipped detector |
| `figure.py` | renders `pca_scatter.svg` by hand (no matplotlib in the venv) |
| `build.py` | orchestration, writes `shape.json` |
| `__main__.py` | prints the whole report |

## Reproducibility

Seed `20260920` everywhere (`cluster.SEED`, reused by the changepoint Monte Carlo).
k-means uses `n_init=50`. Frozen constants: `MIN_MW=500`, `NIGHT=range(0,6)`,
`changepoint.MIN_SIZE=12` months, `changepoint.BETA=2.0`,
`cluster.K_RANGE=range(2,11)`, `cluster.SHOULDER=(4,5,10,11)`. All were fixed before
any ranking was looked at, which is why they are module constants and not arguments.

## What the front end can plot

`shape.json` → `q1_clustering.scatter` is a flat list, one row per region-year:

```json
{"region":"PJM/DOM","year":2025,"pc1":-0.07,"pc2":0.01,"pc3":0.00,
 "cluster":1,"n_sites":9,"has_site":true}
```

`q2_changepoints.regions.<region>.changepoints` is the per-region break list with
`date`, `magnitude_pts`, `magnitude_sigma`, `covid_suspect`, `edge_of_window` and a
`decomposition` saying whether the night grew or the day fell.
`q2_changepoints.focus_series` carries the full monthly series (raw and seasonally
adjusted) for nine headline regions so a chart can draw the series under the breaks.
