"""Test 3. Does the ranking hold out of sample?

The frozen method was set on 2019 -> 2025 calendar years. `scripts/l3_detector.py`
also emits a 2019 -> 2026 Jan-Aug ranking from data that did not exist when the
method was frozen (snapshot ends 2026-09-05). We formalise the comparison:
Spearman and Kendall with CIs, top-k overlap with an exact hypergeometric tail,
and a re-run of the pre-registered permutation test on the holdout ranking.

THE CAVEAT THAT MATTERS, stated before the numbers: this is out of sample in the
TARGET year only. Both rankings share the same 2019 baseline and the same 111
regions, and a region's demand trajectory is persistent - a region growing 30%
by 2025 is still growing in 2026 - so a high rank correlation is close to
mechanical. It demonstrates that the ranking is not an artefact of one year's
weather. It does NOT demonstrate that the detector predicts anything.
"""
from __future__ import annotations

import math
import time

import numpy as np

from .core import VALIDATION


def _rankdata(x: np.ndarray) -> np.ndarray:
    """Average-tie ranks, ascending."""
    order = np.argsort(x, kind="stable")
    ranks = np.empty(len(x), dtype=float)
    ranks[order] = np.arange(1, len(x) + 1)
    _, inv, cnt = np.unique(x, return_inverse=True, return_counts=True)
    if (cnt > 1).any():
        sums = np.zeros(len(cnt))
        np.add.at(sums, inv, ranks)
        ranks = (sums / cnt)[inv]
    return ranks


def spearman(a: np.ndarray, b: np.ndarray) -> float:
    ra, rb = _rankdata(a), _rankdata(b)
    return float(np.corrcoef(ra, rb)[0, 1])


def kendall_tau_b(a: np.ndarray, b: np.ndarray) -> float:
    n = len(a)
    da = np.sign(a[:, None] - a[None, :])
    db = np.sign(b[:, None] - b[None, :])
    iu = np.triu_indices(n, 1)
    sa, sb = da[iu], db[iu]
    conc = float((sa * sb).sum())
    n0 = n * (n - 1) / 2
    n1 = float((sa == 0).sum())
    n2 = float((sb == 0).sum())
    return conc / math.sqrt((n0 - n1) * (n0 - n2))


def _hypergeom_upper(x: int, N: int, K: int, n: int) -> float:
    """P(X >= x) for X ~ Hypergeometric(N, K, n). Exact."""
    tot = math.comb(N, n)
    return sum(math.comb(K, i) * math.comb(N - K, n - i)
               for i in range(x, min(K, n) + 1)) / tot


def ci_coverage(shp: dict, boot_rows: list) -> dict:
    """Does the within-year bootstrap CI cover the OUT-OF-SAMPLE rank?

    This is the sharpest test in the module and the detector does not pass it.
    The block bootstrap says how much a rank moves when the SAME two years are
    resampled. The 2026 holdout says how much it actually moved when the window
    changed. If the 95% intervals covered the holdout rank about 95% of the time
    they would be honest intervals to quote. They do not, and the gap is the
    size of the uncertainty the bootstrap cannot see.
    """
    r26 = shp["r26"]
    covered, total, misses = 0, 0, []
    for row in boot_rows:
        rg = row["region"]
        if rg not in r26.index:
            continue
        lo, hi = row["rank_ci95"]
        out_rank = int(r26.at[rg, "rank"])
        total += 1
        if lo <= out_rank <= hi:
            covered += 1
        else:
            misses.append({"region": rg, "rank_in_sample": row["rank"],
                           "rank_ci95": [lo, hi], "rank_holdout": out_rank,
                           "outside_by": int(min(abs(out_rank - lo), abs(out_rank - hi)))})
    misses.sort(key=lambda m: -m["outside_by"])
    return {
        "nominal_coverage": 0.95,
        "n_regions": total,
        "n_covered": covered,
        "empirical_coverage": round(covered / total, 3) if total else None,
        "interpretation": "coverage far below 0.95 means the block bootstrap measures "
                          "within-year sampling noise only; window and regime choice "
                          "dominate the real uncertainty on a rank",
        "worst_misses": misses[:10],
        "top10_misses": [m for m in misses if m["rank_in_sample"] <= 10],
    }


def placebo(shp: dict) -> dict:
    """Falsification. Run the FROZEN detector on earlier target years.

    The detector is supposed to be picking up flat 24/7 load that arrived during
    the datacenter buildout. If the four pre-registered regions already scored
    high in 2019 -> 2021, the detector is reading something structural and
    persistent about those regions, not the buildout, and the interpretation is
    wrong even if the ranking is stable. If instead the permutation p-value falls
    as the target year advances, the signal is dated to the buildout.

    Nothing about the method changes: same weights, same cuts, same code path,
    only `target`. The region set differs slightly between windows because the
    500 MW and completeness filters bite differently, so each window is scored
    and permuted within itself.
    """
    from .core import frozen
    from .permutation import label_permutation

    m = frozen()
    stats, codes = shp["stats"], shp["codes"]
    base_rank = shp["r"]["score"]
    out = {}
    for target in (2021, 2022, 2023, 2024, 2025):
        rt = m.detect(stats, codes, window="calendar", base=2019, target=target)
        rt = rt.set_index("region")
        missing = [v for v in VALIDATION if v not in rt.index]
        if missing:
            out[str(target)] = {"n_scored": len(rt), "skipped": f"not scored: {missing}"}
            continue
        p = label_permutation(rt, n_perm=20_000, seed=1234 + target)
        common = [x for x in base_rank.index if x in rt.index]
        out[str(target)] = {
            "n_scored": len(rt),
            "validation_ranks": p["validation_ranks"],
            "obs_mean_score": p["obs_mean_score"],
            "p_exact_mean_score": p["p_exact_mean_score"],
            "p_exact_mean_rank": p["p_exact_mean_rank"],
            "spearman_vs_shipped_2025": round(
                spearman(base_rank.loc[common].to_numpy(dtype=float),
                         rt.loc[common, "score"].to_numpy(dtype=float)), 4),
        }
    return {"note": "frozen detector, target year varied; method unchanged", "windows": out}


def run(shp: dict, n_boot: int = 10_000, seed: int = 0) -> dict:
    t0 = time.time()
    r, r26 = shp["r"], shp["r26"]
    common = [x for x in r.index if x in r26.index]
    dropped = sorted(set(r.index) - set(r26.index))

    s_in = r.loc[common, "score"].to_numpy(dtype=float)
    s_out = r26.loc[common, "score"].to_numpy(dtype=float)
    n = len(common)

    rho = spearman(s_in, s_out)
    tau = kendall_tau_b(s_in, s_out)

    # Fisher z CI for Spearman (standard normal approximation, SE = 1/sqrt(n-3))
    z = np.arctanh(rho)
    se = 1.0 / math.sqrt(n - 3)
    fisher = (float(np.tanh(z - 1.96 * se)), float(np.tanh(z + 1.96 * se)))

    # bootstrap over REGIONS (the sampling unit here is the region, not the hour)
    rng = np.random.default_rng(seed)
    rb, tb = np.empty(n_boot), np.empty(n_boot)
    for i in range(n_boot):
        k = rng.integers(0, n, size=n)
        rb[i] = spearman(s_in[k], s_out[k])
    boot_rho = (float(np.percentile(rb, 2.5)), float(np.percentile(rb, 97.5)))
    n_tau = min(n_boot, 2000)            # tau-b is O(n^2); 2k replicates is plenty
    for i in range(n_tau):
        k = rng.integers(0, n, size=n)
        tb[i] = kendall_tau_b(s_in[k], s_out[k])
    boot_tau = (float(np.percentile(tb[:n_tau], 2.5)), float(np.percentile(tb[:n_tau], 97.5)))

    # top-k overlap with an exact hypergeometric tail
    rin = r.loc[common, "score"].rank(ascending=False, method="first")
    rout = r26.loc[common, "score"].rank(ascending=False, method="first")
    overlap = {}
    for k in (10, 20):
        a = set(rin[rin <= k].index)
        b = set(rout[rout <= k].index)
        x = len(a & b)
        overlap[f"top{k}"] = {
            "overlap": x, "of": k,
            "expected_by_chance": round(k * k / n, 2),
            "p_hypergeometric": _hypergeom_upper(x, n, k, k),
            "members_both": sorted(a & b),
            "in_sample_only": sorted(a - b),
            "holdout_only": sorted(b - a),
        }

    val = {v: {"rank_in_sample": int(r.at[v, "rank"]),
               "rank_holdout": int(r26.at[v, "rank"]) if v in r26.index else None,
               "score_in_sample": round(float(r.at[v, "score"]), 3),
               "score_holdout": round(float(r26.at[v, "score"]), 3) if v in r26.index else None}
           for v in VALIDATION}

    return {
        "in_sample": "2019 -> 2025, calendar years",
        "holdout": "2019 -> 2026 Jan-Aug (data through 2026-09-05)",
        "n_common_regions": n,
        "dropped_from_holdout": dropped,
        "spearman_rho": round(rho, 4),
        "spearman_ci95_fisher": [round(fisher[0], 4), round(fisher[1], 4)],
        "spearman_ci95_bootstrap": [round(boot_rho[0], 4), round(boot_rho[1], 4)],
        "kendall_tau_b": round(tau, 4),
        "kendall_ci95_bootstrap": [round(boot_tau[0], 4), round(boot_tau[1], 4)],
        "n_bootstrap_regions_spearman": n_boot,
        "n_bootstrap_regions_kendall": n_tau,
        "seed": seed,
        "topk_overlap": overlap,
        "validation_set": val,
        "runtime_sec": round(time.time() - t0, 1),
    }
