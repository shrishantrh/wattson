"""Run every test, seeded, and write engine/stats/results/stats_results.json.

    python3 -m engine.stats                 # full run
    python3 -m engine.stats --quick         # smaller B/n_perm, for a smoke test

Every random draw is derived from MASTER_SEED so the whole file reproduces.
"""
from __future__ import annotations

import argparse
import json
import platform
import subprocess
import time
from pathlib import Path

import numpy as np
import pandas as pd

from . import MASTER_SEED
from . import autocorr, bootstrap, core, fdr, holdout, permutation

OUT = Path(__file__).resolve().parent / "results" / "stats_results.json"

SEEDS = {"permutation": MASTER_SEED + 1, "component": MASTER_SEED + 2,
         "bootstrap_week": MASTER_SEED + 3, "bootstrap_day": MASTER_SEED + 4,
         "holdout": MASTER_SEED + 5, "autocorr": MASTER_SEED + 6,
         "permutation_holdout": MASTER_SEED + 7, "bootstrap_month": MASTER_SEED + 8,
         "family": MASTER_SEED + 9}


def _git_head() -> str:
    try:
        return subprocess.run(["git", "rev-parse", "--short", "HEAD"],
                              cwd=core.REPO, capture_output=True, text=True,
                              timeout=10).stdout.strip()
    except Exception:
        return "unknown"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--b", type=int, default=10_000, help="bootstrap replicates")
    ap.add_argument("--nperm", type=int, default=100_000, help="Monte Carlo permutations")
    a = ap.parse_args()
    b = 300 if a.quick else a.b
    nperm = 5_000 if a.quick else a.nperm
    t0 = time.time()

    print("loading frozen detector and hourly panel ...")
    shp = core.shipped()
    panel = core.build_panel(shp)
    rec = core.verify(shp, panel)
    print(f"  reconciles with shipped export: {rec['reconciles']} "
          f"(max |dscore| {rec['max_abs_score_diff_vs_export']:.5f}, "
          f"{rec['rank_mismatches_vs_export']} rank mismatches)")
    if not rec["reconciles"]:
        raise SystemExit("reconciliation FAILED - stop and report this, do not publish numbers")

    print("1/5 permutation ...")
    perm = permutation.label_permutation(shp["r"], n_perm=nperm, seed=SEEDS["permutation"])
    perm_hold = permutation.label_permutation(shp["r26"], n_perm=nperm,
                                              seed=SEEDS["permutation_holdout"])
    perm_drop = permutation.drop_one_sensitivity(shp["r"])
    perm_fam = permutation.family_restricted(shp["r"], n_perm=nperm, seed=SEEDS["family"])
    comp = permutation.component_independence(shp["r"], n_perm=min(nperm, 50_000),
                                              seed=SEEDS["component"])
    print(f"  p_exact(mean score) = {perm['p_exact_mean_score']:.4f}  "
          f"p_exact(mean rank) = {perm['p_exact_mean_rank']:.4f}")

    print(f"2/5 block bootstrap, B={b} ...")
    rep7 = bootstrap.run(panel, b=b, block_days=7, seed=SEEDS["bootstrap_week"])
    boot7 = bootstrap.summarise(panel, shp, rep7)
    print(f"  7-day blocks: {rep7['runtime_sec']}s")
    rep1 = bootstrap.run(panel, b=b, block_days=1, seed=SEEDS["bootstrap_day"])
    boot1 = bootstrap.summarise(panel, shp, rep1)
    print(f"  1-day blocks: {rep1['runtime_sec']}s")
    rep28 = bootstrap.run(panel, b=b, block_days=28, seed=SEEDS["bootstrap_month"])
    boot28 = bootstrap.summarise(panel, shp, rep28)
    print(f"  28-day blocks: {rep28['runtime_sec']}s")

    print("3/5 out of sample ...")
    hold = holdout.run(shp, n_boot=min(nperm, 10_000), seed=SEEDS["holdout"])
    print(f"  spearman {hold['spearman_rho']:.3f}  kendall {hold['kendall_tau_b']:.3f}")
    cov = holdout.ci_coverage(shp, boot7["per_region"])
    print(f"  bootstrap CI covers the holdout rank {cov['empirical_coverage']} of the time "
          f"(nominal 0.95)")
    plac = holdout.placebo(shp)
    for yr, w in plac["windows"].items():
        if "p_exact_mean_score" in w:
            print(f"  placebo 2019->{yr}: p={w['p_exact_mean_score']:.4f} "
                  f"ranks={list(w['validation_ranks'].values())}")

    print("4/5 multiple comparisons ...")
    fdr_out = fdr.run(panel, shp, rep7)

    print("5/5 autocorrelation ...")
    ac = autocorr.run(panel, b=min(b, 2_000), block_days=7, seed=SEEDS["autocorr"])
    print(f"  ESS (block) median {ac['ess_block_median']} of a nominal 8760")

    res = {
        "meta": {
            "generated": pd.Timestamp.now("UTC").strftime("%Y-%m-%d %H:%M UTC"),
            "git_head": _git_head(),
            "master_seed": MASTER_SEED,
            "seeds": SEEDS,
            "python": platform.python_version(),
            "numpy": np.__version__, "pandas": pd.__version__,
            "machine": platform.platform(),
            "detector": "scripts/l3_detector.py, FROZEN 2026-09-19, imported not copied",
            "total_runtime_sec": None,
        },
        "reconciliation": rec,
        "permutation": perm,
        "permutation_holdout": perm_hold,
        "permutation_drop_one_POSTHOC": perm_drop,
        "permutation_family_restricted": perm_fam,
        "component_independence_POSTHOC": comp,
        "bootstrap_7day_blocks": boot7,
        "bootstrap_1day_blocks_sensitivity": boot1,
        "bootstrap_28day_blocks_sensitivity": boot28,
        "holdout": hold,
        "placebo_windows": plac,
        "bootstrap_ci_coverage_of_holdout": cov,
        "fdr": fdr_out,
        "autocorrelation": ac,
    }
    res["meta"]["total_runtime_sec"] = round(time.time() - t0, 1)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(res, indent=1, default=float))
    print(f"\nwrote {OUT}  ({res['meta']['total_runtime_sec']}s total)")


if __name__ == "__main__":
    main()
