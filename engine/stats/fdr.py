"""Test 4. We scored 111 regions. How many top hits are luck?

The composite score has no region-level null - it is defined by cross-sectional
robust z-scores, so "is this score large" is circular. What does have a
region-level null is the detector's primary component:

    H0(i): overnight_excess_i <= 0
           (region i's overnight demand grew no faster than its average demand)

That is exactly the claim the detector makes about a region, one region at a
time, and it is testable against the block-bootstrap sampling distribution from
engine/stats/bootstrap.py.

Two families are reported:
  A  overnight_excess > 0                                           (111 tests)
  B  overnight_excess > 0 AND neighbor_divergence > 0, as an
     intersection-union test with p = max(p_A, p_B), which is valid
     without assuming independence between the two components.      (111 tests)

Benjamini-Hochberg controls the expected proportion of false discoveries among
rejections at level q, under the positive-dependence (PRDS) condition. Regions
are positively dependent (shared weather, shared BAs), which is the case BH is
proved for; BY would be the distribution-free fallback and is also reported.

p-values are computed two ways. The percentile p-value is floored at 1/(B+1),
which at B = 10,000 is 1e-4 - below the smallest BH threshold 0.05/111 = 4.5e-4,
so the floor does not bind. The normal-approximation p-value uses the bootstrap
standard error and is used for the headline because it is not granular; the two
are reported side by side.
"""
from __future__ import annotations

import math

import numpy as np


def _norm_sf(z: np.ndarray) -> np.ndarray:
    """Upper tail of the standard normal, via erfc."""
    return 0.5 * np.array([math.erfc(v / math.sqrt(2)) for v in np.atleast_1d(z)])


def bh(p: np.ndarray, q: float) -> np.ndarray:
    """Benjamini-Hochberg step-up. Returns a boolean rejection mask."""
    n = len(p)
    order = np.argsort(p)
    thresh = q * np.arange(1, n + 1) / n
    passed = p[order] <= thresh
    rej = np.zeros(n, dtype=bool)
    if passed.any():
        kmax = np.max(np.nonzero(passed)[0])
        rej[order[: kmax + 1]] = True
    return rej


def by(p: np.ndarray, q: float) -> np.ndarray:
    """Benjamini-Yekutieli: BH with the harmonic correction, valid under any dependence."""
    n = len(p)
    c = np.sum(1.0 / np.arange(1, n + 1))
    return bh(p, q / c)


def _one_sided_p(obs: np.ndarray, reps: np.ndarray) -> dict:
    """One-sided p for H0: theta <= 0, from bootstrap replicates of theta."""
    b = reps.shape[0]
    p_pct = (1 + (reps <= 0).sum(axis=0)) / (b + 1)
    se = reps.std(axis=0, ddof=1)
    with np.errstate(divide="ignore", invalid="ignore"):
        z = np.where(se > 0, obs / se, np.where(obs > 0, np.inf, -np.inf))
    p_norm = _norm_sf(z)
    return {"p_percentile": p_pct, "p_normal": p_norm, "se": se, "z": z,
            "p_floor": 1.0 / (b + 1)}


def run(panel, shp, rep: dict) -> dict:
    r = shp["r"]
    regions = panel.regions
    n = len(regions)
    obs_oe = r["overnight_excess"].to_numpy(dtype=float)
    obs_nd = r["neighbor_divergence"].to_numpy(dtype=float)
    obs_rank = r["rank"].to_numpy(dtype=int)

    A = _one_sided_p(obs_oe, rep["overnight_excess"])
    B_nd = _one_sided_p(obs_nd, rep["neighbor_divergence"])
    p_iut = np.maximum(A["p_normal"], B_nd["p_normal"])

    out = {
        "b": rep["b"], "block_days": rep["block_days"], "seed": rep["seed"],
        "n_tests": n,
        "naive_expected_false_positives_at_alpha_0.05": round(0.05 * n, 2),
        "p_value_floor_percentile": A["p_floor"],
        "smallest_bh_threshold_q005": 0.05 / n,
        "families": {},
    }
    for name, p in [("A_overnight_excess_gt_0", A["p_normal"]),
                    ("B_iut_overnight_and_divergence_gt_0", p_iut)]:
        fam = {"n_tests": n}
        for q in (0.05, 0.10):
            rej = bh(p, q)
            rej_by = by(p, q)
            in_top10 = int(rej[obs_rank <= 10].sum())
            fam[f"bh_q{q:.2f}"] = {
                "n_rejected": int(rej.sum()),
                "expected_false_discoveries_overall": round(q * int(rej.sum()), 2),
                "n_rejected_in_top10": in_top10,
                "expected_false_discoveries_in_top10_upper_bound": round(q * in_top10, 2),
                "by_n_rejected": int(rej_by.sum()),
                "not_rejected_in_top20": [regions[i] for i in range(n)
                                          if obs_rank[i] <= 20 and not rej[i]],
            }
        fam["max_p_in_top10"] = float(np.max(p[obs_rank <= 10]))
        fam["median_p_all"] = float(np.median(p))
        out["families"][name] = fam

    # per-region detail for the top of the ranking
    order = np.argsort(obs_rank)
    out["per_region_top25"] = [{
        "region": regions[i], "rank": int(obs_rank[i]),
        "overnight_excess": round(float(obs_oe[i]), 2),
        "se": round(float(A["se"][i]), 3),
        "p_normal": float(A["p_normal"][i]),
        "p_percentile": float(A["p_percentile"][i]),
    } for i in order[:25]]
    out["n_regions_with_negative_overnight_excess"] = int((obs_oe <= 0).sum())
    return out
