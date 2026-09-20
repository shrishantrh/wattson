"""Does the carbon-free share predict measured carbon intensity, and where not?

Wattson ranks regions by carbon-free share. That ranking is a claim about
emissions. This module tests the claim against EPA CEMS and names the regions
where it fails.

The proxy's implicit physics is intensity = (1 - carbon_free_share) x F, where F
is the CO2 per MWh of the non-carbon-free half. The proxy is only as good as the
assumption that F is similar everywhere. It is not: F is about 0.4 short tons per
MWh for a combined-cycle gas fleet and about 1.0 for a coal fleet. So we report

  1. the correlation between carbon-free share and measured intensity,
  2. the implied fleet intensity F per region, which is where the spread lives,
  3. the regions whose measured intensity is furthest above what their share
     predicts (the proxy flatters them) and furthest below (the proxy libels them),
  4. how far the two rankings disagree.

Nothing here is tuned. The fit is an ordinary least squares line of measured
intensity on (1 - carbon_free_share) across the published regions, and residuals
are read off it.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

PUBLISHED_TIERS = ("A", "B")


def published(ba_window: pd.DataFrame, year: int, window: str, tiers=PUBLISHED_TIERS) -> pd.DataFrame:
    q = ba_window[(ba_window.year == year) & (ba_window.window == window) & ba_window.tier.isin(tiers)].copy()
    q = q[np.isfinite(q.carbon_free_share) & np.isfinite(q.intensity_short_tons_per_mwh)]
    return q.sort_values("intensity_short_tons_per_mwh", ascending=False)


def proxy_fit(q: pd.DataFrame) -> dict:
    """Correlate the shipped proxy with the measurement, and fit the null model."""
    x = 1.0 - q.carbon_free_share.to_numpy(float)
    y = q.intensity_short_tons_per_mwh.to_numpy(float)
    ok = np.isfinite(x) & np.isfinite(y)
    x, y = x[ok], y[ok]
    r = float(np.corrcoef(q.carbon_free_share[ok], y)[0, 1])
    rho = float(pd.Series(q.carbon_free_share[ok].to_numpy()).corr(pd.Series(y), method="spearman"))
    slope, intercept = np.polyfit(x, y, 1)
    pred = slope * x + intercept
    ss_res = float(((y - pred) ** 2).sum())
    ss_tot = float(((y - y.mean()) ** 2).sum())
    return {
        "n": int(ok.sum()),
        "pearson_r_share_vs_intensity": round(r, 4),
        "spearman_rho_share_vs_intensity": round(rho, 4),
        "r2_of_fit_on_one_minus_share": round(1 - ss_res / ss_tot, 4),
        "fit_slope_short_tons_per_mwh": round(float(slope), 4),
        "fit_intercept": round(float(intercept), 4),
        "rmse_short_tons_per_mwh": round(float(np.sqrt(ss_res / ok.sum())), 4),
    }


def residuals(q: pd.DataFrame) -> pd.DataFrame:
    x = 1.0 - q.carbon_free_share.to_numpy(float)
    y = q.intensity_short_tons_per_mwh.to_numpy(float)
    slope, intercept = np.polyfit(x, y, 1)
    out = q.copy()
    out["predicted_intensity"] = slope * x + intercept
    out["residual"] = y - out.predicted_intensity
    # the physical decomposition: CO2 per MWh of non-carbon-free generation
    denom = (out.total_generation_mwh - out.carbon_free_mwh)
    out["fleet_intensity_short_tons_per_mwh"] = np.where(denom > 0, out.co2_short_tons / denom, np.nan)
    out["coal_share_of_fossil"] = np.where(out.fossil_mwh > 0, out.coal_mwh / out.fossil_mwh, np.nan)
    return out.sort_values("residual", ascending=False)


def rank_disagreement(q: pd.DataFrame) -> pd.DataFrame:
    out = q.copy()
    out["rank_by_proxy"] = out.carbon_free_share.rank(ascending=True, method="min")  # 1 = dirtiest by proxy
    out["rank_by_measured"] = out.intensity_short_tons_per_mwh.rank(ascending=False, method="min")
    out["rank_gap"] = out.rank_by_proxy - out.rank_by_measured
    return out.sort_values("rank_gap")


def spread_within_band(q: pd.DataFrame, lo: float, hi: float) -> dict:
    band = q[q.carbon_free_share.between(lo, hi)]
    if len(band) < 2:
        return {}
    i = band.intensity_short_tons_per_mwh
    return {
        "band": f"{lo:.2f}-{hi:.2f}",
        "regions": int(len(band)),
        "min_intensity": round(float(i.min()), 3),
        "max_intensity": round(float(i.max()), 3),
        "ratio_max_over_min": round(float(i.max() / i.min()), 2) if i.min() > 0 else None,
        "cleanest": band.loc[i.idxmin(), "ba"],
        "dirtiest": band.loc[i.idxmax(), "ba"],
    }


def contradictions(ba_window: pd.DataFrame, window="daytime", min_fossil_mw=500.0,
                   min_plants=5) -> pd.DataFrame:
    """Where do the two datasets disagree about which way fossil output moved?

    EIA-930 reports a region's fossil net generation. EPA CEMS measures the fuel
    the region's large fossil units actually burned. Between 2019 and 2025 the two
    should move together. Where they move in opposite directions, one of them is
    wrong about that region, and only one of them is a measurement at the stack.

    Restricted to regions with real fossil generation and at least a handful of
    CEMS plants, so the test is not reading noise in a tiny footprint.
    """
    q = ba_window[ba_window.window == window]
    p = q.pivot_table(index="ba", columns="year",
                      values=["fossil_avg_mw", "cems_gross_mwh", "plants", "coverage"])
    keep = []
    for ba in p.index:
        try:
            f19, f25 = p[("fossil_avg_mw", 2019)][ba], p[("fossil_avg_mw", 2025)][ba]
            c19, c25 = p[("cems_gross_mwh", 2019)][ba], p[("cems_gross_mwh", 2025)][ba]
            n19, n25 = p[("plants", 2019)][ba], p[("plants", 2025)][ba]
        except KeyError:
            continue
        if not np.isfinite([f19, f25, c19, c25]).all() or c19 <= 0 or f19 <= 0:
            continue
        if min(f19, f25) < min_fossil_mw or min(n19, n25) < min_plants:
            continue
        keep.append({
            "ba": ba,
            "eia930_fossil_avg_mw_2019": f19, "eia930_fossil_avg_mw_2025": f25,
            "eia930_pct_change": 100 * (f25 / f19 - 1),
            "cems_gross_mwh_2019": c19, "cems_gross_mwh_2025": c25,
            "cems_pct_change": 100 * (c25 / c19 - 1),
            "coverage_2019": p[("coverage", 2019)][ba], "coverage_2025": p[("coverage", 2025)][ba],
            "cems_plants_2019": n19, "cems_plants_2025": n25,
        })
    d = pd.DataFrame(keep)
    if not len(d):
        return d
    d["opposite_signs"] = np.sign(d.eia930_pct_change) != np.sign(d.cems_pct_change)
    d["gap_points"] = d.eia930_pct_change - d.cems_pct_change
    return d.sort_values("gap_points", ascending=False)


def pjm_restated(ba_window: pd.DataFrame) -> pd.DataFrame:
    q = ba_window[(ba_window.ba == "PJM")].copy()
    cols = ["year", "window", "gen_hours", "total_generation_avg_mw", "carbon_free_avg_mw", "carbon_free_share",
            "gas_avg_mw", "coal_avg_mw", "co2_short_tons", "co2_short_tons_per_hour",
            "intensity_short_tons_per_mwh", "intensity_kg_per_mwh", "coverage", "tier", "plants"]
    return q[cols].sort_values(["window", "year"])


def facilities_intensity(regions: pd.DataFrame, facilities: pd.DataFrame, year=2025,
                         window="overnight") -> pd.DataFrame:
    """Measured CO2 per MWh of the grid each datacenter site draws from, at 3am."""
    r = regions[(regions.year == year) & (regions.window == window)]
    r = r[["region", "ba", "zone", "is_zone", "intensity_short_tons_per_mwh", "intensity_kg_per_mwh",
           "carbon_free_share", "coverage", "tier", "co2_inherited_from_ba"]]
    f = facilities.copy()
    f["zone"] = f.zone.where(f.zone.notna() & (f.zone.astype(str) != ""), None)
    # claims/lookup/facilities.csv already writes the zone as the full "BA/ZONE"
    # region string; tolerate either spelling rather than building "PJM/PJM/DOM"
    z = f.zone.astype("string")
    f["region"] = np.where(
        f.zone.isna(), f.ba.astype(str),
        np.where(z.str.contains("/", na=False), z, f.ba.astype(str) + "/" + z))
    m = f.merge(r, on="region", how="left", suffixes=("", "_r"))
    miss = m.intensity_short_tons_per_mwh.isna()
    # a site in a zone we do not score falls back to its parent BA, flagged
    if miss.any():
        parent = r[~r.is_zone][["ba", "intensity_short_tons_per_mwh", "intensity_kg_per_mwh",
                                "carbon_free_share", "coverage", "tier"]]
        fb = m.loc[miss, ["ba"]].merge(parent, on="ba", how="left")
        for c in ["intensity_short_tons_per_mwh", "intensity_kg_per_mwh", "carbon_free_share", "coverage", "tier"]:
            m.loc[miss, c] = fb[c].to_numpy()
        m.loc[miss, "matched_at"] = "parent_ba"
    m["matched_at"] = m.get("matched_at", pd.Series(index=m.index, dtype=object)).fillna("region")
    return m
