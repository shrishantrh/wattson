"""The central test: does the flat-load signal survive a weather control?

Two independent controls, deliberately different in construction so they can
disagree.

CONTROL A - cross-sectional residualization (the one the brief asks for)
    Across the scored regions, regress 2019 -> 2025 overnight demand growth on the
    2019 -> 2025 change in overnight cooling and heating degree hours, and average
    demand growth on the change in all-hours degree hours. R-squared answers "how
    much of demand growth is weather?". The residuals, re-centered on the sample
    mean so they stay readable as percent growth, are then pushed back through the
    FROZEN scoring formula: overnight excess from residual growth, neighbor
    divergence recomputed from residual growth inside the frozen peer groups,
    load factor delta untouched, the same robust z and the same 1 / 1 / 0.5
    weights. Nothing about the detector is retuned.

CONTROL B - per-region weather normalization (physically grounded)
    Control A only uses variation BETWEEN regions, so a warming that hits every
    region equally is invisible to it. Control B does not have that blind spot.
    For each region and each window, fit that region's own 2019 hourly demand on
    its own hourly cooling and heating degree hours plus hour-of-day and weekend
    effects, then predict 2025 from 2019's response and 2025's actual weather.
    Growth beyond that prediction is growth weather does not explain, in MW.
    Run separately for the overnight window and the daytime window, this also
    answers the sharper question: cooling load peaks in the afternoon, so if
    overnight growth were cooling, daytime growth should be larger still.

The detector is FROZEN. `verify_peers()` asserts that this module's
re-implementation of neighbor divergence reproduces the shipped numbers exactly
before any adjusted score is computed.
"""
from __future__ import annotations

import importlib.util

import numpy as np
import pandas as pd

from .stations import REPO

PUDL = REPO / "data" / "pudl"
PANEL_CACHE = REPO / "data" / "processed" / "stats_panel_cache.parquet"
BASE, TARGET = 2019, 2025
VALIDATION = ["PJM/DOM", "PJM/AEP", "SWPP/OPPD", "ERCO/NCEN"]


# --------------------------------------------------------------------------
# the frozen detector, imported rather than copied
# --------------------------------------------------------------------------
def frozen():
    path = REPO / "scripts" / "l3_detector.py"
    spec = importlib.util.spec_from_file_location("l3_detector_frozen_weather", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load_demand_hourly():
    """Hourly demand on the frozen detector's local clock."""
    m = frozen()
    codes = pd.read_parquet(PUDL / "core_eia__codes_balancing_authorities.parquet")
    if PANEL_CACHE.exists():
        return pd.read_parquet(PANEL_CACHE), codes
    d = m.localize(m.load_demand(), codes)
    PANEL_CACHE.parent.mkdir(parents=True, exist_ok=True)
    d.to_parquet(PANEL_CACHE)
    return d, codes


def shipped(d: pd.DataFrame, codes: pd.DataFrame) -> dict:
    """Frozen detector output: the shipped calendar ranking and the Jan-Aug ranking."""
    m = frozen()
    stats = m.region_year_stats(d)
    return {
        "stats": stats,
        "calendar": m.detect(stats, codes, window="calendar", base=BASE, target=TARGET)
                     .set_index("region"),
        "jan_aug": m.detect(stats, codes, window="jan_aug", base=BASE, target=TARGET)
                    .set_index("region"),
    }


def tz_by_region(d: pd.DataFrame) -> dict[str, str]:
    return d.groupby("region", observed=True).report_timezone.first().to_dict()


# --------------------------------------------------------------------------
# frozen peer logic, re-implemented for an arbitrary growth column
# --------------------------------------------------------------------------
def neighbor_divergence(r: pd.DataFrame, growth_col: str) -> pd.Series:
    """Exactly scripts/l3_detector.py's rule, over `growth_col` instead of growth_pct."""
    div = pd.Series(index=r.index, dtype=float)
    for grp, members in r.groupby("peer_group").groups.items():
        for m in members:
            peers = r.loc[members].drop(index=m)[growth_col]
            if len(peers) < 3:
                peers = r[~r.is_zone].drop(index=m, errors="ignore")[growth_col]
            div[m] = r.at[m, growth_col] - peers.median() if len(peers) else np.nan
    return div


def robust_z(s: pd.Series) -> pd.Series:
    med = s.median()
    mad = (s - med).abs().median() * 1.4826
    return (s - med) / mad if mad > 0 else s * 0


def verify_peers(r: pd.DataFrame) -> float:
    """Guard: our peer code must reproduce the frozen neighbor_divergence exactly."""
    ours = neighbor_divergence(r, "growth_pct")
    return float((ours - r.neighbor_divergence).abs().max())


def rescore(r: pd.DataFrame, overnight_excess: pd.Series, divergence: pd.Series,
            lf_delta: pd.Series) -> pd.DataFrame:
    """The frozen formula, applied to whatever components are handed to it."""
    out = pd.DataFrame(index=r.index)
    out["overnight_excess"] = overnight_excess
    out["neighbor_divergence"] = divergence
    out["load_factor_delta"] = lf_delta
    out["z_overnight_excess"] = robust_z(overnight_excess)
    out["z_neighbor_divergence"] = robust_z(divergence)
    out["z_load_factor_delta"] = robust_z(lf_delta)
    out["score"] = (out.z_overnight_excess + out.z_neighbor_divergence
                    + 0.5 * out.z_load_factor_delta)
    out = out.sort_values("score", ascending=False)
    out["rank"] = np.arange(1, len(out) + 1)
    return out


# --------------------------------------------------------------------------
# ordinary least squares with t-statistics, no statsmodels dependency
# --------------------------------------------------------------------------
def ols(y: np.ndarray, X: np.ndarray, names: list[str]) -> dict:
    n, k = X.shape
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    fitted = X @ beta
    resid = y - fitted
    ss_res = float(resid @ resid)
    ss_tot = float(((y - y.mean()) ** 2).sum())
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else np.nan
    dof = n - k
    sigma2 = ss_res / dof if dof > 0 else np.nan
    try:
        cov = sigma2 * np.linalg.inv(X.T @ X)
        se = np.sqrt(np.diag(cov))
    except np.linalg.LinAlgError:
        se = np.full(k, np.nan)
    t = beta / se
    from scipy import stats as sps
    p = 2 * sps.t.sf(np.abs(t), dof)
    return {
        "n": n, "k": k, "r2": r2,
        "adj_r2": 1 - (1 - r2) * (n - 1) / dof if dof > 0 else np.nan,
        "coef": {nm: float(b) for nm, b in zip(names, beta)},
        "se": {nm: float(s) for nm, s in zip(names, se)},
        "t": {nm: float(v) for nm, v in zip(names, t)},
        "p": {nm: float(v) for nm, v in zip(names, p)},
        "f_p": float(sps.f.sf((r2 / (k - 1)) / ((1 - r2) / dof), k - 1, dof))
        if dof > 0 and k > 1 and r2 < 1 else np.nan,
        "resid": resid, "fitted": fitted,
    }


def spearman(a: pd.Series, b: pd.Series) -> dict:
    common = a.index.intersection(b.index)
    from scipy import stats as sps
    rho, p = sps.spearmanr(a.loc[common], b.loc[common])
    tau, tp = sps.kendalltau(a.loc[common], b.loc[common])
    return {"n": len(common), "spearman_rho": float(rho), "spearman_p": float(p),
            "kendall_tau": float(tau), "kendall_p": float(tp)}


# --------------------------------------------------------------------------
# CONTROL A
# --------------------------------------------------------------------------
def control_a(r: pd.DataFrame, wx: pd.DataFrame, winsor: float = 0.0) -> dict:
    """Residualize growth on weather change, then re-run the frozen formula."""
    m = r.join(wx.set_index("region"), how="inner")
    m = m[m.d_cdh_night.notna() & m.d_hdh_night.notna()
          & m.d_cdh_all.notna() & m.d_hdh_all.notna()]

    def clip(v):
        if winsor <= 0:
            return v
        lo, hi = np.quantile(v, [winsor, 1 - winsor])
        return np.clip(v, lo, hi)

    one = np.ones(len(m))
    Xn = np.column_stack([one, m.d_cdh_night, m.d_hdh_night])
    Xa = np.column_stack([one, m.d_cdh_all, m.d_hdh_all])
    yn = clip(m.overnight_growth_pct.to_numpy(float))
    ya = clip(m.growth_pct.to_numpy(float))

    fit_night = ols(yn, Xn, ["const", "d_cdh_night", "d_hdh_night"])
    fit_all = ols(ya, Xa, ["const", "d_cdh_all", "d_hdh_all"])

    # excess directly: the night-minus-all weather change is the only part of
    # weather that can move a night-versus-average statistic
    Xe = np.column_stack([one, m.d_cdh_night - m.d_cdh_all, m.d_hdh_night - m.d_hdh_all])
    fit_excess = ols(clip(m.overnight_excess.to_numpy(float)), Xe,
                     ["const", "d_cdh_night_minus_all", "d_hdh_night_minus_all"])

    adj = pd.DataFrame(index=m.index)
    adj["overnight_growth_adj"] = yn.mean() + fit_night["resid"]
    adj["growth_adj"] = ya.mean() + fit_all["resid"]
    adj["overnight_excess_adj"] = adj.overnight_growth_adj - adj.growth_adj

    base = m.copy()
    base["growth_adj"] = adj.growth_adj
    div_adj = neighbor_divergence(base, "growth_adj")

    full = rescore(m, adj.overnight_excess_adj, div_adj, m.load_factor_delta)
    minimal = rescore(m, adj.overnight_excess_adj, m.neighbor_divergence,
                      m.load_factor_delta)
    direct = rescore(m, pd.Series(m.overnight_excess.mean() + fit_excess["resid"],
                                  index=m.index),
                     m.neighbor_divergence, m.load_factor_delta)
    return {"merged": m, "adj": adj, "fit_night": fit_night, "fit_all": fit_all,
            "fit_excess": fit_excess, "full": full, "minimal": minimal,
            "direct": direct}


# --------------------------------------------------------------------------
# CONTROL B
# --------------------------------------------------------------------------
HOURS = {"night": range(0, 6), "day": range(10, 16), "all": range(0, 24)}


def control_b(demand: pd.DataFrame, region_hours: pd.DataFrame, day_max: int,
              base_c: float, regions: list[str], quadratic: bool = False) -> pd.DataFrame:
    """Per-region weather normalization. 2019 response, 2025 weather, 2025 actuals.

    `quadratic` adds CDH^2 and HDH^2. A linear degree-hour response understates
    demand in extreme heat, and 2025 asks the 2019 model to extrapolate past its
    own temperature range for a small share of hours, so the quadratic version is
    the harder test: it gives weather MORE room to explain the growth.
    """
    wx = region_hours[["region", "datetime_utc", "temp_c", "local_hour", "year"]].copy()
    wx = wx[wx.year.isin([BASE, TARGET]) & wx.temp_c.notna()]
    wx["cdh"] = np.maximum(wx.temp_c - base_c, 0.0)
    wx["hdh"] = np.maximum(base_c - wx.temp_c, 0.0)

    dm = demand[demand.region.isin(regions) & demand.year.isin([BASE, TARGET])]
    dm = dm[["region", "datetime_utc", "demand_mwh", "local_hour", "year", "month"]]

    j = dm.merge(wx[["region", "datetime_utc", "cdh", "hdh", "temp_c"]],
                 on=["region", "datetime_utc"], how="inner")
    j["doy"] = j.datetime_utc.dt.dayofyear
    j = j[j.doy <= day_max]
    j["dow"] = j.datetime_utc.dt.dayofweek
    j["weekend"] = (j.dow >= 5).astype(float)

    rows = []
    for region, g in j.groupby("region", observed=True):
        for wname, hrs in HOURS.items():
            gw = g[g.local_hour.isin(hrs)]
            b = gw[gw.year == BASE]
            t = gw[gw.year == TARGET]
            if len(b) < 500 or len(t) < 500:
                continue
            hour_levels = sorted(set(b.local_hour) | set(t.local_hour))

            def design(x):
                cols = [np.ones(len(x)), x.cdh.to_numpy(), x.hdh.to_numpy()]
                if quadratic:
                    cols += [x.cdh.to_numpy() ** 2, x.hdh.to_numpy() ** 2]
                cols.append(x.weekend.to_numpy())
                for h in hour_levels[1:]:
                    cols.append((x.local_hour.to_numpy() == h).astype(float))
                return np.column_stack(cols)

            names = (["const", "cdh", "hdh"]
                     + (["cdh2", "hdh2"] if quadratic else [])
                     + ["weekend"] + [f"h{h}" for h in hour_levels[1:]])
            fit = ols(b.demand_mwh.to_numpy(float), design(b), names)
            beta = np.array([fit["coef"][n] for n in names])
            pred = design(t) @ beta
            actual = float(t.demand_mwh.mean())
            predicted = float(pred.mean())
            base_mean = float(b.demand_mwh.mean())
            # how far outside 2019's own temperature range does 2025 ask us to go?
            lo, hi = b.temp_c.min(), b.temp_c.max()
            out_of_support = float(((t.temp_c < lo) | (t.temp_c > hi)).mean())
            rows.append({
                "region": region, "window": wname,
                "mean_mw_base": base_mean, "mean_mw_target": actual,
                "mean_mw_target_weather_predicted": predicted,
                "raw_growth_pct": 100 * (actual / base_mean - 1),
                "weather_implied_growth_pct": 100 * (predicted / base_mean - 1),
                "wx_adjusted_growth_pct": 100 * (actual / predicted - 1),
                "mw_total_change": actual - base_mean,
                "mw_weather_explained": predicted - base_mean,
                "mw_unexplained": actual - predicted,
                "beta_cdh_mw_per_degh": fit["coef"]["cdh"],
                "beta_hdh_mw_per_degh": fit["coef"]["hdh"],
                "t_cdh": fit["t"]["cdh"], "r2_2019": fit["r2"],
                "n_base_hours": len(b), "n_target_hours": len(t),
                "frac_2025_out_of_2019_temp_support": out_of_support,
            })
    return pd.DataFrame(rows)


def control_b_wide(cb: pd.DataFrame) -> pd.DataFrame:
    """Night versus day, per region: the sharper statement."""
    w = cb.pivot(index="region", columns="window")
    w.columns = [f"{a}_{b}" for a, b in w.columns]
    w["night_minus_day_wx_growth_pts"] = (w.wx_adjusted_growth_pct_night
                                          - w.wx_adjusted_growth_pct_day)
    w["night_minus_day_raw_growth_pts"] = (w.raw_growth_pct_night
                                           - w.raw_growth_pct_day)
    w["weather_share_of_night_growth"] = (
        w.mw_weather_explained_night / w.mw_total_change_night)
    return w.reset_index().set_index("region")


def control_b_rescore(r: pd.DataFrame, w: pd.DataFrame) -> dict:
    """The frozen formula on per-region weather-normalized growth.

    Every input is the region's own growth net of its own 2019 temperature
    response, so a warming common to the whole country is removed too - which is
    exactly what the cross-sectional Control A cannot see.
    """
    m = r.join(w[["wx_adjusted_growth_pct_night", "wx_adjusted_growth_pct_all",
                  "wx_adjusted_growth_pct_day"]], how="inner").dropna(
        subset=["wx_adjusted_growth_pct_night", "wx_adjusted_growth_pct_all"])
    excess = m.wx_adjusted_growth_pct_night - m.wx_adjusted_growth_pct_all
    div = neighbor_divergence(m.assign(g=m.wx_adjusted_growth_pct_all), "g")
    return {"merged": m,
            "scored": rescore(m, excess, div, m.load_factor_delta),
            "overnight_excess_wx": excess}
