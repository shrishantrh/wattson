"""THE ONLY FILE IN THIS MODULE THAT IS ALLOWED TO READ DETECTOR OUTPUT.

profiles.py, cluster.py, changepoint.py and sites.py read raw PUDL parquet and
claims/lookup/facilities.csv and nothing else. This file reads the shipped detector's
ranks out of dashboard/public/data/regions.json and compares them to results that
were already finished. build.py calls it last, after both questions are computed, and
passes it finished output, so there is no path by which a detector number can reach a
fit. That separation is the entire point of the exercise; keep it.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

REPO_ROOT = Path(__file__).resolve().parents[2]
REGIONS_JSON = REPO_ROOT / "dashboard" / "public" / "data" / "regions.json"


def detector_table() -> pd.DataFrame:
    d = json.loads(REGIONS_JSON.read_text())
    rows = [{"region": r["id"], **{k: r["detection"].get(k) for k in
                                   ("rank", "score", "growth_pct", "overnight_excess",
                                    "pattern", "avg_mw_2019", "avg_mw_2025")}}
            for r in d["regions"] if r.get("detection")]
    return pd.DataFrame(rows).set_index("region")


def compare(q1: dict, q2: dict) -> dict:
    det = detector_table()

    cp = pd.DataFrame([
        {"region": k,
         "primary_date": (v["primary"] or {}).get("date"),
         "primary_magnitude_pts": (v["primary"] or {}).get("magnitude_pts"),
         "n_changepoints": v["n_changepoints"],
         "ratio_delta_pts": (v["ratio_2025_mean"] - v["ratio_2019_mean"]) * 100
         if v["ratio_2019_mean"] and v["ratio_2025_mean"] else None}
        for k, v in q2["regions"].items()]).set_index("region")

    sc = pd.DataFrame(q1["scatter"])
    pc25 = sc[sc.year == 2025].set_index("region")
    pc19 = sc[sc.year == 2019].set_index("region")
    cp["pc1_2025"] = pc25.pc1
    cp["cluster_2025"] = pc25.cluster
    cp["pc1_delta"] = pc25.pc1 - pc19.pc1

    j = det.join(cp, how="inner")
    out = {"n": int(len(j)), "source": str(REGIONS_JSON.relative_to(REPO_ROOT)),
           "note": "post-hoc only; no detector number entered any fit"}

    def sp(a, b, label):
        m = j[[a, b]].dropna()
        r, p = spearmanr(m[a], m[b])
        out[label] = {"spearman_rho": float(r), "p_value": float(p), "n": int(len(m))}

    sp("score", "ratio_delta_pts", "score_vs_overnight_ratio_change")
    sp("score", "primary_magnitude_pts", "score_vs_primary_changepoint_magnitude")
    sp("score", "pc1_2025", "score_vs_pc1_2025")
    sp("score", "pc1_delta", "score_vs_pc1_change")

    top = j.sort_values("rank").head(10)
    out["detector_top10"] = [
        {"rank": int(r["rank"]), "region": i, "score": float(r["score"]),
         "shape_cluster_2025": None if pd.isna(r.cluster_2025) else int(r.cluster_2025),
         "primary_changepoint": r.primary_date,
         "primary_magnitude_pts": None if pd.isna(r.primary_magnitude_pts)
         else float(r.primary_magnitude_pts),
         "overnight_ratio_change_pts": None if pd.isna(r.ratio_delta_pts)
         else float(r.ratio_delta_pts)}
        for i, r in top.iterrows()]

    # where do the shape clusters sit in the detector's ranking?
    out["mean_detector_rank_by_shape_cluster"] = {
        int(c): {"n": int(len(g)), "mean_rank": float(g["rank"].mean()),
                 "median_rank": float(g["rank"].median())}
        for c, g in j.dropna(subset=["cluster_2025"]).groupby("cluster_2025")}

    # the biggest disagreement in each direction
    j2 = j.dropna(subset=["ratio_delta_pts"]).copy()
    j2["rank_by_ratio"] = j2.ratio_delta_pts.rank(ascending=False)
    j2["rank_gap"] = j2["rank"] - j2["rank_by_ratio"]
    out["biggest_disagreements"] = {
        "detector_ranks_much_higher_than_shape": [
            {"region": i, "detector_rank": int(r["rank"]),
             "shape_rank_by_ratio_change": int(r.rank_by_ratio),
             "ratio_change_pts": float(r.ratio_delta_pts)}
            for i, r in j2.nsmallest(5, "rank_gap").iterrows()],
        "shape_ranks_much_higher_than_detector": [
            {"region": i, "detector_rank": int(r["rank"]),
             "shape_rank_by_ratio_change": int(r.rank_by_ratio),
             "ratio_change_pts": float(r.ratio_delta_pts)}
            for i, r in j2.nlargest(5, "rank_gap").iterrows()],
    }
    return out
