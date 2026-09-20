"""Test 1. Is the ranking better than chance?

Null H0: the detector's components carry no information about which regions host
flat 24/7 load, i.e. the score vector is exchangeable across region identities.

Test statistic: the mean detector score of the four PRE-REGISTERED validation
regions (PJM/DOM, PJM/AEP, SWPP/OPPD, ERCO/NCEN). That set was named in
`scripts/l3_detector.py` before the ranking was seen, which is what makes the
statistic non-circular: we are not asking "are the regions that scored high
high?", we are asking "did four regions nominated in advance land high?".

Under label permutation the null distribution of the statistic is the
distribution of the mean of 4 scores drawn without replacement from the 111
observed scores. That has only C(111,4) = 5,989,005 outcomes, so we compute the
p-value EXACTLY by enumeration and also by seeded Monte Carlo as a cross-check.

Two statistics are reported:
  mean score  primary. It is the detector's own output, but the score
              distribution is right-skewed (max 16.5 against a median of 0.33),
              so a single extreme region can carry it.
  mean rank   sensitivity. Outlier-insensitive; if the two disagree, the mean-score
              result is being driven by one region and should not be leaned on.

A secondary null (component independence) asks a different question: do the
three components AGREE on the same regions, more than chance? Its statistic is
post-hoc (chosen after seeing the ranking) and is reported as a diagnostic only.
"""
from __future__ import annotations

import itertools
import time

import numpy as np

from .core import VALIDATION, robust_z


def _exact_upper_tail_mean_of_k(values: np.ndarray, thresh_sum: float, k: int = 4) -> int:
    """Exact count of k-subsets (without replacement) whose sum >= thresh_sum.

    Enumerates the C(n, k-1) leading index triples and closes the last index with
    a binary search, which is exact and ~30x cheaper than enumerating all subsets.
    """
    if k != 4:
        raise ValueError("implemented for k=4")
    ss = np.sort(values)                       # ascending
    n = len(ss)
    tri = np.fromiter(itertools.chain.from_iterable(itertools.combinations(range(n - 1), 3)),
                      dtype=np.int32)
    tri = tri.reshape(-1, 3)
    i, j, kk = tri[:, 0], tri[:, 1], tri[:, 2]
    need = thresh_sum - (ss[i] + ss[j] + ss[kk])
    pos = np.searchsorted(ss, need, side="left")          # first index with ss >= need
    start = np.maximum(pos, kk + 1)                       # last index must exceed kk
    return int(np.clip(n - start, 0, None).sum())


def _exact_lower_tail_mean_of_k(values: np.ndarray, thresh_sum: float, k: int = 4) -> int:
    """Exact count of k-subsets whose sum <= thresh_sum (used for the rank statistic)."""
    return _exact_upper_tail_mean_of_k(-values, -thresh_sum, k)


def label_permutation(r, n_perm: int = 100_000, seed: int = 0) -> dict:
    """Primary test. Exact enumeration plus seeded Monte Carlo."""
    t0 = time.time()
    regions = list(r.index)
    score = r["score"].to_numpy(dtype=float)
    rank = r["rank"].to_numpy(dtype=float)
    n = len(regions)
    vi = np.array([regions.index(v) for v in VALIDATION])
    k = len(vi)

    obs_score = float(score[vi].mean())
    obs_rank = float(rank[vi].mean())
    total = 1
    for a in range(k):
        total = total * (n - a) // (a + 1)

    n_ge_score = _exact_upper_tail_mean_of_k(score, obs_score * k, k)
    n_le_rank = _exact_lower_tail_mean_of_k(rank, obs_rank * k, k)

    rng = np.random.default_rng(seed)
    draws = np.array([rng.choice(n, size=k, replace=False) for _ in range(n_perm)])
    mc_score = score[draws].mean(axis=1)
    mc_rank = rank[draws].mean(axis=1)
    # +1 convention for Monte Carlo (the observed configuration is itself admissible)
    p_mc_score = float((1 + (mc_score >= obs_score).sum()) / (n_perm + 1))
    p_mc_rank = float((1 + (mc_rank <= obs_rank).sum()) / (n_perm + 1))

    return {
        "statistic": "mean detector score of the 4 pre-registered validation regions",
        "validation_regions": VALIDATION,
        "validation_scores": {v: round(float(score[regions.index(v)]), 3) for v in VALIDATION},
        "validation_ranks": {v: int(rank[regions.index(v)]) for v in VALIDATION},
        "n_regions": n,
        "n_subsets_enumerated": total,
        "n_permutations_monte_carlo": n_perm,
        "seed": seed,
        "obs_mean_score": round(obs_score, 4),
        "null_mean_score": round(float(score.mean()), 4),
        "p_exact_mean_score": n_ge_score / total,
        "p_monte_carlo_mean_score": p_mc_score,
        "obs_mean_rank": obs_rank,
        "null_mean_rank": (n + 1) / 2,
        "p_exact_mean_rank": n_le_rank / total,
        "p_monte_carlo_mean_rank": p_mc_rank,
        "mc_null_score_quantiles": {q: round(float(np.quantile(mc_score, q)), 3)
                                    for q in (0.5, 0.9, 0.95, 0.99)},
        "runtime_sec": round(time.time() - t0, 1),
    }


def drop_one_sensitivity(r) -> dict:
    """POST-HOC and therefore NOT evidence. Reported only so nobody has to ask.

    Removing the region that failed after seeing that it failed is exactly the
    circularity the pre-registered set exists to avoid. Shown to quantify how
    much of the primary result hangs on the single pre-registered miss.
    """
    regions = list(r.index)
    score = r["score"].to_numpy(dtype=float)
    n = len(regions)
    out = {}
    for drop in VALIDATION:
        keep = [v for v in VALIDATION if v != drop]
        vi = np.array([regions.index(v) for v in keep])
        obs = float(score[vi].mean())
        # exact 3-subset tail by direct enumeration of pairs
        ss = np.sort(score)
        pairs = np.fromiter(itertools.chain.from_iterable(itertools.combinations(range(n - 1), 2)),
                            dtype=np.int32).reshape(-1, 2)
        need = obs * 3 - (ss[pairs[:, 0]] + ss[pairs[:, 1]])
        pos = np.searchsorted(ss, need, side="left")
        start = np.maximum(pos, pairs[:, 1] + 1)
        cnt = int(np.clip(n - start, 0, None).sum())
        total = n * (n - 1) * (n - 2) // 6
        out[f"drop_{drop}"] = {"obs_mean_score": round(obs, 4), "p_exact": cnt / total}
    return {"warning": "post-hoc, circular, not evidence", "results": out}


def family_restricted(r, n_perm: int = 200_000, seed: int = 2) -> dict:
    """Robustness. The 111 regions are NOT exchangeable: 68 zones are nested
    inside 8 balancing authorities that are themselves scored, so a plain label
    permutation draws 4 regions that may all be the same electricity.

    This null preserves the observed nesting structure exactly. The validation
    set is 2 regions from one BA family (PJM/DOM, PJM/AEP) plus 1 each from two
    other families (SWPP, ERCO). Each permutation draws the same shape: two
    members of one randomly chosen family, and one member each from two other
    distinct families. Monte Carlo only - the restricted sample space has no
    convenient closed form.
    """
    t0 = time.time()
    regions = list(r.index)
    score = r["score"].to_numpy(dtype=float)
    ba = r["ba"].astype(str).to_numpy()
    vi = np.array([regions.index(v) for v in VALIDATION])
    obs = float(score[vi].mean())

    fams = {}
    for i, b in enumerate(ba):
        fams.setdefault(b, []).append(i)
    keys = sorted(fams)
    big = [k for k in keys if len(fams[k]) >= 2]
    rng = np.random.default_rng(seed)
    null = np.empty(n_perm)
    for t in range(n_perm):
        f1 = big[rng.integers(len(big))]
        pick = rng.choice(fams[f1], size=2, replace=False)
        others = [k for k in keys if k != f1]
        f2, f3 = rng.choice(len(others), size=2, replace=False)
        a = fams[others[f2]][rng.integers(len(fams[others[f2]]))]
        b2 = fams[others[f3]][rng.integers(len(fams[others[f3]]))]
        null[t] = (score[pick[0]] + score[pick[1]] + score[a] + score[b2]) / 4.0
    p = float((1 + (null >= obs).sum()) / (n_perm + 1))
    return {
        "null": "restricted permutation preserving the BA-family composition "
                "(2 regions from one family, 1 each from two others)",
        "answers": "red-team objection that 68 zones nest inside 8 scored parents",
        "n_families": len(keys),
        "obs_mean_score": round(obs, 4),
        "null_median": round(float(np.median(null)), 4),
        "p_monte_carlo": p,
        "n_permutations": n_perm,
        "seed": seed,
        "runtime_sec": round(time.time() - t0, 1),
    }


def component_independence(r, n_perm: int = 100_000, seed: int = 1) -> dict:
    """Secondary, diagnostic. Do the three components point at the SAME regions?

    Null: the three component vectors are independently shuffled across regions,
    so each component keeps its marginal distribution but all cross-component
    alignment is destroyed. Statistic: the mean of the top 10 scores, which
    measures how concentrated the top of the ranking is.

    This statistic was chosen after seeing the ranking. It is a description of
    component agreement, not a confirmatory test, and is labelled as such.
    """
    t0 = time.time()
    oe = r["overnight_excess"].to_numpy(dtype=float)
    nd = r["neighbor_divergence"].to_numpy(dtype=float)
    lf = r["load_factor_delta"].to_numpy(dtype=float)
    obs = float(np.sort(r["score"].to_numpy(dtype=float))[::-1][:10].mean())

    zoe, znd, zlf = robust_z(oe), robust_z(nd), robust_z(lf)
    rng = np.random.default_rng(seed)
    n = len(oe)
    null = np.empty(n_perm)
    for b in range(n_perm):
        s = zoe[rng.permutation(n)] + znd[rng.permutation(n)] + 0.5 * zlf[rng.permutation(n)]
        null[b] = np.sort(s)[::-1][:10].mean()
    p = float((1 + (null >= obs).sum()) / (n_perm + 1))
    corr = np.corrcoef(np.vstack([zoe, znd, zlf]))
    return {
        "note": "post-hoc statistic; diagnostic of component agreement, not a confirmatory test",
        "statistic": "mean of the top 10 scores",
        "obs": round(obs, 4),
        "null_median": round(float(np.median(null)), 4),
        "p_monte_carlo": p,
        "n_permutations": n_perm,
        "seed": seed,
        "pearson_corr_components": {
            "overnight_excess~neighbor_divergence": round(float(corr[0, 1]), 3),
            "overnight_excess~load_factor_delta": round(float(corr[0, 2]), 3),
            "neighbor_divergence~load_factor_delta": round(float(corr[1, 2]), 3),
        },
        "runtime_sec": round(time.time() - t0, 1),
    }
