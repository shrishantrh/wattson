"""Run both questions and write engine/shape/shape.json.

Q1 (cluster.py) and Q2 (changepoint.py) are unsupervised. The site labels from
claims/lookup/facilities.csv are joined only after every fit is complete.

The enrichment grid is deliberately exhaustive rather than selective: four profile
specifications x five label sets x every cluster, all reported, so the smallest
p-value can be read against the number of tests that produced it. Picking the best
cell out of 50 and quoting it alone would be the easiest way to manufacture a result
here, so the file records `n_tests` and the family-wise correction next to it.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import mannwhitneyu

from . import changepoint as CP
from . import cluster as C
from . import profiles as P
from . import sites as S

OUT = Path(__file__).resolve().parent / "shape.json"
FIT_YEARS = range(2019, 2026)     # 2018 covers only 43 of 111 regions, so it is out of Q1
PLACEBO_YEAR, TARGET_YEAR = 2019, 2025
FOCUS = ["PJM/DOM", "PJM/AEP", "ERCO/NRTH", "ERCO/NCEN", "ERCO/FWES", "SWPP/OPPD",
         "PJM", "ERCO", "SWPP", "MISO"]


def _j(o):
    """numpy -> json."""
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return None if not np.isfinite(o) else float(o)
    if isinstance(o, (np.bool_,)):
        return bool(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    raise TypeError(type(o))


# ------------------------------------------------------------------------------ Q1

def question_one(hour, regions, labels) -> dict:
    X = C.profile_matrix(hour, regions, years=FIT_YEARS)
    k, curve = C.choose_k(X)
    fit = C.fit_clusters(X, k)
    pca = C.run_pca(X)
    scores = pca["scores"]

    site_all = set(labels["all"])
    primary = {
        "spec": "pooled region-years 2019-2025, annual mean profile, mean-normalized",
        "n_rows": int(len(X)), "n_regions": int(X.index.get_level_values("region").nunique()),
        "k": k, "silhouette": fit["silhouette"],
        "ari_kmeans_vs_ward": fit["ari_kmeans_vs_ward"],
        "enrichment_2025": C.enrichment(fit["labels"].xs(TARGET_YEAR, level="year"),
                                        site_all, k),
        "enrichment_2019_placebo": C.enrichment(fit["labels"].xs(PLACEBO_YEAR, level="year"),
                                                site_all, k),
    }

    # how cluster membership moves over time
    lab = fit["labels"]
    by_year = (lab.reset_index().groupby(["year", "cluster"]).size()
               .unstack(fill_value=0).astype(int))
    migration = {int(y): {int(c): int(v) for c, v in row.items()}
                 for y, row in by_year.iterrows()}

    # --- the grid: 4 profile specs x 5 label sets, every cluster, nothing hidden
    Xsho = C.profile_matrix(hour, regions, years=FIT_YEARS, months=C.SHOULDER)
    specs = {
        "S1_annual_2025": X.xs(2025, level="year"),
        "S2_annual_2019_placebo": X.xs(2019, level="year"),
        "S3_delta_2019_to_2025": (X.xs(2025, level="year") - X.xs(2019, level="year")).dropna(),
        "S4_shoulder_season_2025": Xsho.xs(2025, level="year"),
    }
    grid = []
    spec_meta = {}
    for name, M in specs.items():
        kk, cc = C.choose_k(M)
        ff = C.fit_clusters(M, kk)
        pp = C.run_pca(M, n_components=3)
        spec_meta[name] = {"k": kk, "silhouette": ff["silhouette"],
                           "ari_kmeans_vs_ward": ff["ari_kmeans_vs_ward"],
                           "n_regions": int(len(M)),
                           "centroid_overnight_ratio":
                               [c["overnight_ratio"] for c in ff["centroid_stats"]],
                           "pca_explained_variance_ratio":
                               [pp["components"][f"PC{i + 1}"]["explained_variance_ratio"]
                                for i in range(3)],
                           "pc1_loadings": pp["components"]["PC1"]["loadings"],
                           "centroid_profiles":
                               [c["profile"] for c in ff["centroid_stats"]]}
        for lsname in ("all", "heavy", "detector_blind", "visible_load",
                       "validation_excluded"):
            lb = ff["labels"]
            if lsname == "validation_excluded":
                lb = lb.loc[[r for r in lb.index if r not in S.VALIDATION_REGIONS]]
            for e in C.enrichment(lb, set(labels[lsname]), kk):
                grid.append({"spec": name, "label_set": lsname, "k": kk,
                             **{q: e[q] for q in ("cluster", "n_regions", "n_with_sites",
                                                  "expected_with_sites",
                                                  "p_hypergeometric_one_sided",
                                                  "p_fisher_two_sided", "odds_ratio",
                                                  "N", "K")}})
    pmin = min(g["p_hypergeometric_one_sided"] for g in grid)
    best = [g for g in grid if g["p_hypergeometric_one_sided"] == pmin][0]

    # --- continuous version: is PC1 (flatness) lower for mapped-site regions?
    pc1 = {}
    for yr in (PLACEBO_YEAR, TARGET_YEAR):
        s = scores.xs(yr, level="year").PC1
        for lsname in ("all", "heavy"):
            st = set(labels[lsname])
            a = [s[r] for r in s.index if r in st]
            b = [s[r] for r in s.index if r not in st]
            u, p = mannwhitneyu(a, b, alternative="less")   # lower PC1 = flatter
            pc1[f"{yr}_{lsname}"] = {
                "n_site": len(a), "n_other": len(b),
                "median_site": float(np.median(a)), "median_other": float(np.median(b)),
                "mannwhitney_p_site_flatter": float(p),
            }
    d = (scores.xs(2025, level="year").PC1 - scores.xs(2019, level="year").PC1).dropna()
    for lsname in ("all", "heavy"):
        st = set(labels[lsname])
        a = [d[r] for r in d.index if r in st]
        b = [d[r] for r in d.index if r not in st]
        u, p = mannwhitneyu(a, b, alternative="less")
        pc1[f"delta_{lsname}"] = {
            "n_site": len(a), "n_other": len(b),
            "median_site": float(np.median(a)), "median_other": float(np.median(b)),
            "mannwhitney_p_site_flattened_more": float(p),
        }

    # --- the scatter the front end plots
    counts = labels["all"]
    scatter = []
    for (region, year), row in scores.iterrows():
        scatter.append({
            "region": region, "year": int(year),
            "pc1": round(float(row.PC1), 5), "pc2": round(float(row.PC2), 5),
            "pc3": round(float(row.PC3), 5),
            "cluster": int(lab.loc[(region, year)]),
            "n_sites": int(counts.get(region, 0)),
            "has_site": region in counts,
        })

    return {
        "method": {
            "input": "normalized 24-hour local-time mean demand profile per region-year",
            "normalization": "each profile divided by its own mean (averages to 1.0)",
            "years": list(FIT_YEARS), "seed": C.SEED, "kmeans_n_init": C.N_INIT,
            "k_search": list(C.K_RANGE), "k_rule": "highest mean silhouette, k-means",
            "detector_inputs_used": "none",
        },
        "silhouette_curve": curve,
        "primary": primary,
        "pca": {
            "explained_variance_ratio": [
                float(v) for v in
                [pca["components"][f"PC{i + 1}"]["explained_variance_ratio"] for i in range(5)]],
            "cumulative_explained": pca["cumulative_explained"],
            "mean_profile": pca["mean_profile"],
            "components": pca["components"],
        },
        "clusters": {
            "k": k, "centroids": fit["centroid_stats"],
            "membership_by_year": migration,
            "members_2025": {int(c): sorted(r for r in fit["labels"].xs(2025, level="year").index
                                            if fit["labels"].loc[(r, 2025)] == c)
                             for c in range(k)},
            "members_2019": {int(c): sorted(r for r in fit["labels"].xs(2019, level="year").index
                                            if fit["labels"].loc[(r, 2019)] == c)
                             for c in range(k)},
        },
        "enrichment_grid": {
            "specs": spec_meta, "n_tests": len(grid),
            "min_p_uncorrected": pmin, "min_p_cell": best,
            "min_p_bonferroni_over_family": min(1.0, pmin * len(grid)),
            "tests": grid,
        },
        "pc1_continuous_test": pc1,
        "scatter": scatter,
    }


# ------------------------------------------------------------------------------ Q2

def question_two(month, regions, labels) -> dict:
    monthly = P.monthly_overnight_ratio(month, regions)
    res = CP.detect_all(monthly)
    site_all = set(labels["all"])
    tim = CP.timing(res, site_all)

    # cross-check against the years that appear in facilities.csv notes
    cross = []
    for site in S.announced_years():
        r = res.get(site["region"])
        if not r:
            continue
        for y in site["years"]:
            target = pd.Timestamp(f"{y}-01-01")
            if not r["changepoints"]:
                cross.append({**{q: site[q] for q in ("company", "metro", "region",
                                                      "invisible_to_eia930")},
                              "note_year": y, "nearest_break": None,
                              "gap_months": None, "note": site["note"][:200]})
                continue
            near = min(r["changepoints"],
                       key=lambda c: abs((pd.Timestamp(c["date"] + "-01") - target).days))
            gap = (pd.Timestamp(near["date"] + "-01").to_period("M")
                   - target.to_period("M")).n
            cross.append({
                **{q: site[q] for q in ("company", "metro", "region", "invisible_to_eia930")},
                "note_year": y, "nearest_break": near["date"],
                "gap_months": int(gap), "magnitude_pts": near["magnitude_pts"],
                "covid_suspect": near["covid_suspect"],
                "story": near["decomposition"].get("story"),
                "note": site["note"][:200],
            })

    # strip the per-month series out of the bulk payload; keep it for the focus set
    compact = {}
    for k, r in res.items():
        c = {q: r[q] for q in ("n_months", "sigma", "penalty", "changepoints", "primary",
                               "ratio_2019_mean", "ratio_2025_mean")}
        c["n_changepoints"] = len(r["changepoints"])
        c["has_site"] = k in site_all
        c["n_sites"] = int(labels["all"].get(k, 0))
        compact[k] = c

    return {
        "method": {
            "series": "monthly mean overnight (00-05 local) demand / monthly mean demand",
            "seasonal_adjustment": "calendar-month climatology removed; level and trend kept",
            "algorithms": ["ruptures PELT, l2 cost", "ruptures Binseg, l2 cost"],
            "min_size_months": CP.MIN_SIZE,
            "penalty": f"{CP.BETA} * sigma_hat^2 * log(n), sigma_hat from MAD of first differences",
            "covid_window": "2020-01 to 2020-06 flagged covid_suspect",
            "detector_inputs_used": "none",
        },
        "n_regions": len(res),
        "timing": tim,
        "regions": compact,
        "focus_series": {k: res[k]["series"] for k in FOCUS if k in res},
        "announced_year_cross_check": cross,
    }


# ---------------------------------------------------------------------------- main

def build() -> dict:
    hour, month = P.panels()
    regions = P.eligible_regions(hour)
    labels = S.label_sets(regions)

    q1 = question_one(hour, regions, labels)
    q2 = question_two(month, regions, labels)

    # LAST, and only now: compare the finished results with the shipped detector.
    from . import compare as CMP
    detector = CMP.compare(q1, q2)

    return {
        "meta": {
            "module": "engine/shape",
            "question_1": "do datacenter grids cluster together on load shape alone?",
            "question_2": "when did each region's load go flat?",
            "seed": C.SEED,
            "n_regions": int(len(regions)),
            "region_rule": (f"BA or BA/ZONE demand from EIA-930 via PUDL; "
                            f">= {P.MIN_MW} MW mean demand and >= 90% of hours reported "
                            f"in both {P.BASE} and {P.TARGET} -- identical to the shipped "
                            f"detector, recomputed here from parquet, not read from it"),
            "overnight_hours_local": "00:00-05:59",
            "shoulder_months": list(C.SHOULDER),
            "detector_outputs_used_as_input": "none",
            "site_labels": {"source": "claims/lookup/facilities.csv", **labels["_meta"]},
            "label_set_sizes": {k: {"regions": len(v), "sites": sum(v.values())}
                                for k, v in labels.items() if k != "_meta"},
        },
        "q1_clustering": q1,
        "q2_changepoints": q2,
        "detector_comparison": detector,
    }


def _round(o, nd: int = 6):
    """Trim float mantissas before serialising. Nothing here is read to 1e-7."""
    if isinstance(o, float):
        return None if not np.isfinite(o) else round(o, nd)
    if isinstance(o, (np.floating,)):
        return None if not np.isfinite(o) else round(float(o), nd)
    if isinstance(o, dict):
        return {k: _round(v, nd) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_round(v, nd) for v in o]
    return o


def write(result: dict, path: Path = OUT) -> Path:
    path.write_text(json.dumps(_round(result), separators=(",", ":"), default=_j))
    return path
