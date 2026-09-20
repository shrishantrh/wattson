"""Test 2. How stable is a score, and how stable is a RANK?

Hourly demand is heavily autocorrelated (see engine/stats/autocorr.py), so an iid
bootstrap over hours is invalid: it would treat 8,760 hours as 8,760 independent
draws and produce absurdly tight intervals. We use a CIRCULAR BLOCK bootstrap
over local days.

Three design choices, each load-bearing:

1. Block = 7 local days (168 h), primary. The demand series has a diurnal cycle
   AND a weekday/weekend cycle; a 1-day block would sever the weekly structure
   and a block shorter than a day would sever the diurnal structure, which is
   the very thing the overnight statistic measures. 1-day blocks are run as a
   sensitivity so the reader can see how much the choice matters.

2. Circular (wrap-around) blocks, so every day of the year is equally likely to
   be drawn. Non-circular moving blocks under-weight the first and last L-1 days.

3. The SAME resampled day indices are used for every region within a year.
   Regions are not independent - a cold snap hits a BA and its neighbours
   together - and `neighbor_divergence` is explicitly a cross-sectional
   statistic. Resampling regions independently would destroy that correlation
   and understate the uncertainty on divergence. Base and target years are drawn
   independently of each other, because 2019 weather and 2025 weather are
   independent; that is the conservative choice (paired draws would let seasonal
   effects cancel and give narrower intervals).

WHAT THIS DOES NOT CAPTURE, and it is the larger part of the uncertainty:
the choice of 2019 as the baseline, reporting or footprint changes inside a BA
(WACM, AZPS), and uncertainty about the detector's weights. The bootstrap sees
sampling noise inside two fixed years and nothing else.
"""
from __future__ import annotations

import time

import numpy as np

from .core import DAYS_PER_YEAR, Panel, score_from_moments


def _block_days(rng: np.random.Generator, L: int, D: int = DAYS_PER_YEAR) -> np.ndarray:
    """Circular block bootstrap indices: ceil(D/L) blocks of L consecutive days, wrapped."""
    if L == 1:
        return rng.integers(0, D, size=D)
    nb = int(np.ceil(D / L))
    starts = rng.integers(0, D, size=nb)
    idx = (starts[:, None] + np.arange(L)[None, :]) % D
    return idx.ravel()[:D]


def _moments_year(demand_y: np.ndarray, night_y: np.ndarray, days: np.ndarray):
    """(avg, overnight avg, p99.5) for one year given resampled day indices."""
    flat = demand_y[:, days, :].reshape(demand_y.shape[0], -1)
    nm = night_y[:, days, :].reshape(night_y.shape[0], -1)
    avg = flat.mean(axis=1)
    nightavg = (flat * nm).sum(axis=1) / nm.sum(axis=1)
    p995 = np.quantile(flat, 0.995, axis=1, method="linear")
    return avg, nightavg, p995


def run(panel: Panel, b: int = 10_000, block_days: int = 7, seed: int = 0) -> dict:
    """B block-bootstrap replicates of the whole detector. Returns replicate matrices."""
    t0 = time.time()
    rng = np.random.default_rng(seed)
    n = panel.n
    score = np.empty((b, n))
    rank = np.empty((b, n), dtype=np.int16)
    oe = np.empty((b, n))
    nd = np.empty((b, n))
    growth = np.empty((b, n))
    lfd = np.empty((b, n))

    avg = np.empty((2, n))
    nightavg = np.empty((2, n))
    p995 = np.empty((2, n))
    for i in range(b):
        for y in (0, 1):
            days = _block_days(rng, block_days)
            avg[y], nightavg[y], p995[y] = _moments_year(
                panel.demand[y], panel.night[y], days)
        out = score_from_moments(avg, nightavg, p995, panel.peers)
        score[i] = out["score"]
        rank[i] = out["rank"]
        oe[i] = out["overnight_excess"]
        nd[i] = out["neighbor_divergence"]
        growth[i] = out["growth_pct"]
        lfd[i] = out["load_factor_delta"]

    return {"score": score, "rank": rank, "overnight_excess": oe,
            "neighbor_divergence": nd, "growth_pct": growth, "load_factor_delta": lfd,
            "b": b, "block_days": block_days, "seed": seed,
            "runtime_sec": round(time.time() - t0, 1)}


def summarise(panel: Panel, shp: dict, rep: dict, top_k: int = 25) -> dict:
    """95% percentile CIs on score and on rank, plus stability diagnostics."""
    r = shp["r"]
    regions = panel.regions
    sc, rk = rep["score"], rep["rank"]
    obs_score = r["score"].to_numpy(dtype=float)
    obs_rank = r["rank"].to_numpy(dtype=int)

    lo_s, hi_s = np.percentile(sc, [2.5, 97.5], axis=0)
    lo_r, hi_r = np.percentile(rk, [2.5, 97.5], axis=0)
    rows = []
    for i, rg in enumerate(regions):
        rows.append({
            "region": rg,
            "score": round(float(obs_score[i]), 3),
            "score_ci95": [round(float(lo_s[i]), 3), round(float(hi_s[i]), 3)],
            "score_se": round(float(sc[:, i].std(ddof=1)), 3),
            "score_boot_median": round(float(np.median(sc[:, i])), 3),
            "rank": int(obs_rank[i]),
            "rank_ci95": [int(np.ceil(lo_r[i])), int(np.floor(hi_r[i]))],
            "rank_ci_width": int(np.floor(hi_r[i])) - int(np.ceil(lo_r[i])),
            "rank_boot_median": int(np.median(rk[:, i])),
            "p_in_top10": round(float((rk[:, i] <= 10).mean()), 3),
            "p_in_top20": round(float((rk[:, i] <= 20).mean()), 3),
        })
    rows.sort(key=lambda x: x["rank"])

    widths = np.array([x["rank_ci_width"] for x in rows])
    top = [x for x in rows if x["rank"] <= 10]
    return {
        "b": rep["b"], "block_days": rep["block_days"], "seed": rep["seed"],
        "runtime_sec": rep["runtime_sec"],
        "per_region": rows,
        "median_rank_ci_width": int(np.median(widths)),
        "median_rank_ci_width_top10": int(np.median(widths[:10])),
        "median_rank_ci_width_rest": int(np.median(widths[10:])),
        "n_regions_rank_ci_wider_than_20": int((widths > 20).sum()),
        "n_regions_rank_ci_width_le_5": int((widths <= 5).sum()),
        "expected_true_top10_members": round(float(sum(x["p_in_top10"] for x in top)), 2),
        "median_rank_bias": float(np.median([x["rank_boot_median"] - x["rank"] for x in rows])),
        "median_score_bias": round(float(np.median(
            [x["score_boot_median"] - x["score"] for x in rows])), 4),
        "table": [{k: x[k] for k in ("region", "score", "score_ci95", "rank",
                                     "rank_ci95", "rank_boot_median", "p_in_top10")}
                  for x in rows[:top_k]],
    }
