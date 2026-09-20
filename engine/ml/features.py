"""Load-shape features. Hourly DEMAND only -- nothing else touches this file.

Hard constraints, because the whole experiment is worthless if they are broken:

*   No feature is derived from the L3 detector's score, rank, components,
    z-scores, pattern label, or any export produced from them. `l3_detector.csv`
    is not read here. The only thing imported from `scripts/l3_detector.py` is
    its data loading and timezone localization, so the two methods see exactly
    the same regions in exactly the same local time.
*   No generation-derived feature, for any region. Zones inherit their parent
    BA's generation, so a generation feature on a zone would be a feature of a
    different electrical object. Demand is the zone's own; only demand is used.
*   Every feature is SCALE-FREE (a ratio, a share, a correlation, or a
    difference of those). Region size is deliberately kept out of the feature
    matrix so it can be tested separately as a confound.

Windows follow the project's frozen conventions: overnight 00:00-05:59 local,
daytime 10:00-15:59 local, baseline 2019, target 2025, peak = the 99.5th
percentile hour.
"""
from __future__ import annotations

import importlib.util
import os
from pathlib import Path

import numpy as np
import pandas as pd

BASE, TARGET = 2019, 2025
NIGHT = range(0, 6)
DAY = range(10, 16)
MIN_MW = 500          # same cut as the detector, so the frames line up
MIN_HOURS = 0.9 * 8760

# Static shape features, computed for each of 2019 and 2025.
STATIC = [
    "load_factor", "floor_ratio", "night_day_ratio", "weekend_ratio",
    "seasonal_amp", "summer_winter_ratio", "cv", "diurnal_range",
    "profile_entropy", "harm1_amp", "harm2_amp", "peak_hour_sin",
    "peak_hour_cos", "acf1", "acf24", "acf168", "resid_cv",
]
# Of those, the ones whose 2019->2025 difference is informative. peak_hour_sin
# and peak_hour_cos are circular coordinates; their raw difference is not
# meaningful, so a separate `peak_hour_shift` handles them.
DELTA_OF = [
    "load_factor", "floor_ratio", "night_day_ratio", "weekend_ratio",
    "seasonal_amp", "summer_winter_ratio", "cv", "diurnal_range",
    "profile_entropy", "harm1_amp", "harm2_amp", "acf1", "acf24", "acf168",
    "resid_cv",
]


def _detector_module(repo_root: Path):
    """Import scripts/l3_detector.py by path (scripts/ is not a package).

    Only `load_demand` and `localize` are used. Importing does not execute the
    detector -- its scoring lives under `if __name__ == "__main__"`.
    """
    spec = importlib.util.spec_from_file_location(
        "wattson_l3_detector", repo_root / "scripts" / "l3_detector.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _acf(x: np.ndarray, lag: int) -> float:
    """Autocorrelation at `lag` of a (possibly gappy) hourly series."""
    if len(x) <= lag + 24:
        return np.nan
    a, b = x[:-lag], x[lag:]
    ok = np.isfinite(a) & np.isfinite(b)
    if ok.sum() < 24 or np.std(a[ok]) == 0 or np.std(b[ok]) == 0:
        return np.nan
    return float(np.corrcoef(a[ok], b[ok])[0, 1])


def _static_features(g: pd.DataFrame) -> dict[str, float]:
    """Shape of one region-year. `g` has demand_mwh, local_hour, month, dow, and
    is already sorted by datetime_utc."""
    d = g["demand_mwh"].to_numpy(dtype=float)
    mean = d.mean()
    if not np.isfinite(mean) or mean <= 0:
        return {}

    hour = g["local_hour"].to_numpy()
    month = g["month"].to_numpy()
    dow = g["dow"].to_numpy()

    # Mean daily profile, normalised so it averages 1.0 across the 24 hours.
    prof = np.array([d[hour == h].mean() if (hour == h).any() else np.nan for h in range(24)])
    prof = prof / np.nanmean(prof)
    if not np.isfinite(prof).all():
        return {}

    # Shannon entropy of the profile treated as a distribution over the day,
    # scaled so a perfectly flat 24/7 shape is exactly 1.0.
    q = prof / prof.sum()
    entropy = float(-(q * np.log(q)).sum() / np.log(24))

    # Fourier amplitudes of the daily profile: harmonic 1 is the ordinary
    # day/night swing, harmonic 2 the twin-peak (morning + evening) shape.
    fft = np.fft.rfft(prof)
    peak_h = int(np.argmax(prof))

    monthly = pd.Series(d).groupby(month).mean()
    summer = d[np.isin(month, [6, 7, 8])].mean()
    winter = d[np.isin(month, [12, 1, 2])].mean()

    # Irregular variation: strip the systematic month-by-hour pattern and see
    # how much relative noise is left. Steady load adds a constant, which
    # lowers this; weather-driven load does not.
    cell = pd.Series(d).groupby([month, hour]).transform("mean").to_numpy()
    resid = d - cell

    return {
        "load_factor": mean / np.quantile(d, 0.995),
        "floor_ratio": np.quantile(d, 0.05) / mean,
        "night_day_ratio": d[np.isin(hour, list(NIGHT))].mean() / d[np.isin(hour, list(DAY))].mean(),
        "weekend_ratio": d[np.isin(dow, [5, 6])].mean() / d[np.isin(dow, [0, 1, 2, 3, 4])].mean(),
        "seasonal_amp": (monthly.max() - monthly.min()) / mean,
        "summer_winter_ratio": summer / winter if winter > 0 else np.nan,
        "cv": d.std() / mean,
        "diurnal_range": float(prof.max() - prof.min()),
        "profile_entropy": entropy,
        "harm1_amp": float(np.abs(fft[1]) / 12.0),
        "harm2_amp": float(np.abs(fft[2]) / 12.0),
        "peak_hour_sin": float(np.sin(2 * np.pi * peak_h / 24)),
        "peak_hour_cos": float(np.cos(2 * np.pi * peak_h / 24)),
        "acf1": _acf(d, 1),
        "acf24": _acf(d, 24),
        "acf168": _acf(d, 168),
        "resid_cv": float(resid.std() / mean),
        # bookkeeping, not features -- used for the frame filter, the size
        # confound test and the growth primitives
        "_avg_mw": mean,
        "_night_mw": d[np.isin(hour, list(NIGHT))].mean(),
        "_hours": float(len(d)),
        "_peak_hour": float(peak_h),
    }


def build(repo_root: Path) -> pd.DataFrame:
    """One row per scored region, wide feature matrix. Cached by the caller."""
    cwd = os.getcwd()
    os.chdir(repo_root)          # the detector's loaders use relative paths
    try:
        l3 = _detector_module(repo_root)
        codes = pd.read_parquet("data/pudl/core_eia__codes_balancing_authorities.parquet")
        d = l3.localize(l3.load_demand(), codes)
    finally:
        os.chdir(cwd)

    d = d[d.year.isin([BASE, TARGET])].copy()
    d["dow"] = d.datetime_utc.dt.dayofweek
    d = d.sort_values(["region", "year", "datetime_utc"])

    rows = []
    for (region, year), g in d.groupby(["region", "year"], observed=True):
        feat = _static_features(g)
        if not feat:
            continue
        feat["region"], feat["year"] = region, year
        feat["ba"] = g["ba"].iloc[0]
        feat["is_zone"] = bool(pd.notna(g["zone"].iloc[0]))
        rows.append(feat)
    ry = pd.DataFrame(rows)

    base = ry[ry.year == BASE].set_index("region")
    targ = ry[ry.year == TARGET].set_index("region")
    keep = base.index.intersection(targ.index)
    keep = keep[
        (base.loc[keep, "_avg_mw"] >= MIN_MW) & (targ.loc[keep, "_avg_mw"] >= MIN_MW)
        & (base.loc[keep, "_hours"] >= MIN_HOURS) & (targ.loc[keep, "_hours"] >= MIN_HOURS)
    ]
    base, targ = base.loc[keep], targ.loc[keep]

    X = pd.DataFrame(index=keep)
    X.index.name = "region"
    X["ba"] = targ["ba"]
    X["is_zone"] = targ["is_zone"]

    for c in STATIC:
        X[f"{c}_25"] = targ[c]
        X[f"{c}_19"] = base[c]
    for c in DELTA_OF:
        X[f"d_{c}"] = targ[c] - base[c]

    # circular distance between the 2019 and 2025 peak hours, in hours 0..12
    sh = (targ["_peak_hour"] - base["_peak_hour"]).abs()
    X["peak_hour_shift"] = np.minimum(sh, 24 - sh)

    # growth primitives (logs, so they are symmetric and unbounded both ways)
    X["g_avg"] = np.log(targ["_avg_mw"] / base["_avg_mw"])
    X["g_night"] = np.log(targ["_night_mw"] / base["_night_mw"])
    # The detector's own overnight_excess, recomputed from raw demand. NOT a
    # member of any feature set: it is an exact linear combination of g_night
    # and g_avg, both of which are, so adding it would only duplicate them
    # collinearly. It is carried here so the recomputation can be checked
    # against the frozen detector's column (they agree to 9e-14), and so the
    # importance of g_avg / g_night can be read as the importance of this.
    X["overnight_excess"] = (
        100 * (targ["_night_mw"] / base["_night_mw"] - 1)
        - 100 * (targ["_avg_mw"] / base["_avg_mw"] - 1)
    )

    # NOT a feature. Kept beside the matrix so the size confound can be measured.
    X["_avg_mw_25"] = targ["_avg_mw"]
    return X.reset_index()


# ---------------------------------------------------------------------------
# Feature sets. Each is a tier of independence from the frozen detector.

def feature_sets(X: pd.DataFrame) -> dict[str, list[str]]:
    static = [f"{c}_25" for c in STATIC]
    shape = (
        static
        + [f"{c}_19" for c in STATIC]
        + [f"d_{c}" for c in DELTA_OF]
        + ["peak_hour_shift", "g_avg", "g_night"]
    )
    return {
        # A. 2025 load shape only. No reference to 2019 at all, so it cannot
        #    contain the detector's rule, which is entirely a 2019->2025 change
        #    rule. This is the strictest independence test.
        "static_2025": static,
        # B. The full load-shape description including change. Honest caveat:
        #    d_load_factor IS the detector's load_factor_delta component, and
        #    overnight_excess is a linear combination of g_avg and g_night, so
        #    this set SPANS two of the detector's three components. It does not
        #    contain the detector's weights, its robust z-scores, or its
        #    neighbour-divergence component.
        "shape_change": shape,
        # C. The confound baseline: region size alone, no shape at all.
        "size_only": ["log_size"],
        # D. Does shape add anything beyond size?
        "shape_plus_size": shape + ["log_size"],
    }
