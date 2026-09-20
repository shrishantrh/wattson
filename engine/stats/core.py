"""Shared plumbing: load the frozen detector, build a dense hourly panel, and
provide a vectorised re-implementation of the frozen score for resampling.

Nothing in here may alter the detector. `verify()` is the guard: it recomputes
the shipped ranking through `scripts/l3_detector.detect` AND through the fast
vectorised path and asserts the two agree to floating point. If they ever
diverge, every downstream number is void.
"""
from __future__ import annotations

import glob
import importlib.util
import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

REPO = Path(__file__).resolve().parents[2]
PUDL = REPO / "data" / "pudl"
CACHE = REPO / "data" / "processed" / "stats_panel_cache.parquet"
EXPORT_REGION_GLOB = str(REPO / "web" / "public" / "api" / "region" / "*.json")

BASE, TARGET = 2019, 2025
HOLDOUT = 2026
HOURS_PER_YEAR = 8760
DAYS_PER_YEAR = 365
VALIDATION = ["PJM/DOM", "PJM/AEP", "SWPP/OPPD", "ERCO/NCEN"]


# --------------------------------------------------------------------------
# the frozen detector, imported (not copied) from scripts/
# --------------------------------------------------------------------------
def frozen():
    """Import scripts/l3_detector.py as a module. scripts/ is FROZEN; we only read it."""
    path = REPO / "scripts" / "l3_detector.py"
    spec = importlib.util.spec_from_file_location("l3_detector_frozen", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load_hourly() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Hourly demand, localised, using the frozen detector's own loaders."""
    m = frozen()
    codes = pd.read_parquet(PUDL / "core_eia__codes_balancing_authorities.parquet")
    if CACHE.exists():
        return pd.read_parquet(CACHE), codes
    d = m.localize(m.load_demand(), codes)
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    d.to_parquet(CACHE)
    return d, codes


def shipped() -> dict:
    """Run the frozen detector exactly as `scripts/l3_detector.py __main__` does."""
    m = frozen()
    d, codes = load_hourly()
    stats = m.region_year_stats(d)
    r = m.detect(stats, codes).set_index("region")
    r26 = m.detect(stats, codes, window="jan_aug", target=HOLDOUT).set_index("region")
    return {"hourly": d, "codes": codes, "stats": stats, "r": r, "r26": r26}


def exported_detection() -> pd.DataFrame:
    """detection blocks as actually shipped to the web app."""
    rows = {}
    for p in glob.glob(EXPORT_REGION_GLOB):
        j = json.load(open(p))["region"]
        det = j.get("detection") or {}
        if "score" in det:
            rows[j["id"]] = det
    return pd.DataFrame(rows).T


# --------------------------------------------------------------------------
# dense panel: region x year x day x hour, for block resampling
# --------------------------------------------------------------------------
@dataclass
class Panel:
    regions: list[str]            # (n,) region ids, detector order
    demand: np.ndarray            # (2, n, 365, 24) float64, [year_idx, region, day, hour]
    night: np.ndarray             # (2, n, 365, 24) bool, local hour in 00..05
    peers: list[np.ndarray]       # per region: indices whose growth median it is compared against
    is_zone: np.ndarray           # (n,) bool

    @property
    def n(self) -> int:
        return len(self.regions)


def build_panel(shp: dict) -> Panel:
    """Dense array form of exactly the region-years the frozen detector scores.

    Blocks are the 24 consecutive hours starting at local midnight Jan 1. Every
    scored region-year has exactly 8760 hours (asserted), so no missing-data
    handling is needed and day d means "local day d of the year" for every
    region. That is what lets the bootstrap resample the SAME days across all
    regions and so preserve the cross-sectional (weather) correlation that
    neighbour-divergence depends on.
    """
    r = shp["r"]
    regions = list(r.index)
    idx = {rg: i for i, rg in enumerate(regions)}
    n = len(regions)

    d = shp["hourly"]
    d = d[d.region.isin(set(regions)) & d.year.isin([BASE, TARGET])]
    d = d.sort_values(["region", "year", "datetime_utc"], kind="stable")

    demand = np.full((2, n, DAYS_PER_YEAR, 24), np.nan)
    night = np.zeros((2, n, DAYS_PER_YEAR, 24), dtype=bool)
    for (rg, yr), g in d.groupby(["region", "year"], sort=False, observed=True):
        if rg not in idx:
            continue
        yi = 0 if yr == BASE else 1
        if len(g) != HOURS_PER_YEAR:
            raise AssertionError(f"{rg} {yr}: {len(g)} hours, expected {HOURS_PER_YEAR}")
        demand[yi, idx[rg]] = g.demand_mwh.to_numpy().reshape(DAYS_PER_YEAR, 24)
        night[yi, idx[rg]] = np.isin(g.local_hour.to_numpy().reshape(DAYS_PER_YEAR, 24), range(0, 6))
    if np.isnan(demand).any():
        raise AssertionError("panel has gaps; the scored set was supposed to be complete")

    is_zone = r.is_zone.to_numpy().astype(bool)
    peers = _peer_index(r, idx)
    return Panel(regions=regions, demand=demand, night=night, peers=peers, is_zone=is_zone)


def _peer_index(r: pd.DataFrame, idx: dict) -> list[np.ndarray]:
    """Reproduce the frozen neighbour-divergence peer sets, as index arrays.

    Frozen rule: peers = own peer_group minus self; if that leaves fewer than 3,
    fall back to all non-zone regions minus self.
    """
    all_bas = np.array([idx[x] for x in r.index[~r.is_zone.to_numpy().astype(bool)]])
    out = []
    groups = r.groupby("peer_group").groups
    for rg in r.index:
        members = groups[r.at[rg, "peer_group"]]
        p = np.array([idx[x] for x in members if x != rg], dtype=int)
        if len(p) < 3:
            p = all_bas[all_bas != idx[rg]]
        out.append(p)
    return out


# --------------------------------------------------------------------------
# vectorised frozen score
# --------------------------------------------------------------------------
def robust_z(x: np.ndarray) -> np.ndarray:
    med = np.median(x)
    mad = np.median(np.abs(x - med)) * 1.4826
    return (x - med) / mad if mad > 0 else x * 0.0


def score_from_moments(avg: np.ndarray, night: np.ndarray, p995: np.ndarray,
                       peers: list[np.ndarray]) -> dict:
    """The frozen score, from (2, n) arrays of per-region-year moments.

    avg/night/p995 are [year_idx, region] with year_idx 0 = base, 1 = target.
    """
    growth = 100.0 * (avg[1] / avg[0] - 1.0)
    night_growth = 100.0 * (night[1] / night[0] - 1.0)
    overnight_excess = night_growth - growth
    lf = avg / p995
    lf_delta = lf[1] - lf[0]

    med_peer = np.array([np.median(growth[p]) if len(p) else np.nan for p in peers])
    neighbor_divergence = growth - med_peer

    score = (robust_z(overnight_excess) + robust_z(neighbor_divergence)
             + 0.5 * robust_z(lf_delta))
    order = np.argsort(-score, kind="stable")
    rank = np.empty(len(score), dtype=int)
    rank[order] = np.arange(1, len(score) + 1)
    return {"growth_pct": growth, "overnight_excess": overnight_excess,
            "load_factor_delta": lf_delta, "neighbor_divergence": neighbor_divergence,
            "score": score, "rank": rank}


def moments(demand: np.ndarray, night: np.ndarray) -> tuple[np.ndarray, ...]:
    """(avg, overnight avg, p99.5) per year and region from a (2, n, D, 24) block."""
    flat = demand.reshape(demand.shape[0], demand.shape[1], -1)
    avg = flat.mean(axis=2)
    nm = night.reshape(night.shape[0], night.shape[1], -1)
    nightavg = (flat * nm).sum(axis=2) / nm.sum(axis=2)
    p995 = np.quantile(flat, 0.995, axis=2, method="linear")
    return avg, nightavg, p995


def verify(shp: dict, panel: Panel) -> dict:
    """Guard. Vectorised path must equal the frozen detect(); both must equal the export."""
    avg, nightavg, p995 = moments(panel.demand, panel.night)
    fast = score_from_moments(avg, nightavg, p995, panel.peers)
    r = shp["r"]
    out = {}
    for k in ["growth_pct", "overnight_excess", "load_factor_delta",
              "neighbor_divergence", "score"]:
        out[f"max_abs_diff_{k}"] = float(np.max(np.abs(fast[k] - r[k].to_numpy())))
    out["rank_mismatches_vs_frozen"] = int((fast["rank"] != r["rank"].to_numpy()).sum())
    worst = max(out[f"max_abs_diff_{k}"] for k in
                ["growth_pct", "overnight_excess", "load_factor_delta",
                 "neighbor_divergence", "score"])
    if worst > 1e-9 or out["rank_mismatches_vs_frozen"]:
        raise AssertionError(f"vectorised detector diverged from frozen detect(): {out}")

    exp = exported_detection()
    common = [x for x in panel.regions if x in exp.index]
    my = r.loc[common, "score"].to_numpy()
    theirs = exp.loc[common, "score"].astype(float).to_numpy()
    out["n_regions_compared_to_export"] = len(common)
    out["max_abs_score_diff_vs_export"] = float(np.max(np.abs(my - theirs)))
    out["rank_mismatches_vs_export"] = int(
        (r.loc[common, "rank"].to_numpy() != exp.loc[common, "rank"].astype(int).to_numpy()).sum())
    # the export rounds score to 2 dp, so 0.005 is the tightest achievable bound
    out["export_score_rounding"] = 0.005
    out["reconciles"] = bool(out["max_abs_score_diff_vs_export"] <= 0.005
                             and out["rank_mismatches_vs_export"] == 0)
    return out
