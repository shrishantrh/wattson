"""Test 5. Hourly demand is autocorrelated, so what is n, really?

A region-year is 8,760 hourly observations. It is nowhere near 8,760 independent
observations: demand has a diurnal cycle, a weekly cycle, and weather persistence
on top of both. Quoting an iid standard error on an annual mean would understate
its uncertainty by the square root of the variance inflation factor.

Three estimates, deliberately computed by different routes so they can disagree:

  ACF            descriptive. rho at lags 1, 24, 168 on the raw hourly series,
                 and the ACF of the DAILY MEAN series out to 14 days, which is
                 what justifies the 7-day bootstrap block length.
  HAC / Bartlett long-run variance with a Bartlett kernel at bandwidth 336 h
                 (2 weeks). ESS = n * Var(x) / LRV. Standard Newey-West logic.
  Block bootstrap the SE of the annual mean under 7-day circular blocks, against
                 the iid SE sd/sqrt(n). VIF = (SE_block / SE_iid)^2,
                 ESS = n / VIF. This is the estimate the rest of this module
                 actually relies on, because it is the resampling scheme used.
"""
from __future__ import annotations

import time

import numpy as np

from .bootstrap import _block_days
from .core import DAYS_PER_YEAR, Panel


def acf(x: np.ndarray, nlags: int) -> np.ndarray:
    """Biased (n-denominator) sample ACF via FFT, lags 0..nlags."""
    x = x - x.mean()
    n = len(x)
    size = 1 << (2 * n - 1).bit_length()
    f = np.fft.rfft(x, size)
    ac = np.fft.irfft(f * np.conjugate(f), size)[: nlags + 1].real
    return ac / ac[0]


def deseasonalise(daily: np.ndarray, window: int = 29) -> np.ndarray:
    """Daily series minus a centred moving average, wrapped at the year boundary.

    The raw daily ACF stays near 0.6 at two weeks, but almost all of that is the
    seasonal cycle: a July day resembles another July day. A day-block bootstrap
    does not have to reproduce the ORDER of the seasons, only their composition,
    so the quantity that sets the right block length is the memory of the
    de-seasonalised residual, not of the raw series.
    """
    k = np.ones(window) / window
    pad = np.concatenate([daily[-(window // 2):], daily, daily[: window // 2]])
    smooth = np.convolve(pad, k, mode="valid")
    return daily - smooth


def bartlett_ess(x: np.ndarray, bandwidth: int = 336) -> float:
    """ESS = n * Var / LRV with a Bartlett kernel (Newey-West)."""
    n = len(x)
    rho = acf(x, bandwidth)
    w = 1.0 - np.arange(1, bandwidth + 1) / (bandwidth + 1)
    lrv_ratio = 1.0 + 2.0 * np.sum(w * rho[1:])
    return float(n / max(lrv_ratio, 1e-9))


def run(panel: Panel, b: int = 2_000, block_days: int = 7, seed: int = 0,
        nlags_daily: int = 14) -> dict:
    t0 = time.time()
    rng = np.random.default_rng(seed)
    n_reg = panel.n
    rows = []
    for y, yname in ((0, "2019"), (1, "2025")):
        for i in range(n_reg):
            x = panel.demand[y, i].reshape(-1)
            daily = panel.demand[y, i].mean(axis=1)
            rh = acf(x, 168)
            rd = acf(daily, nlags_daily)
            rr = acf(deseasonalise(daily), nlags_daily)
            rows.append({
                "region": panel.regions[i], "year": yname,
                "rho_h1": float(rh[1]), "rho_h24": float(rh[24]), "rho_h168": float(rh[168]),
                "rho_d1": float(rd[1]), "rho_d7": float(rd[7]), "rho_d14": float(rd[14]),
                "rho_resid_d1": float(rr[1]), "rho_resid_d3": float(rr[3]),
                "rho_resid_d7": float(rr[7]), "rho_resid_d14": float(rr[14]),
                "ess_bartlett": bartlett_ess(x),
                "sd_hourly": float(x.std(ddof=1)), "mean_hourly": float(x.mean()),
            })

    # block bootstrap SE of the annual mean, on every region-year at once
    daily_means = panel.demand.mean(axis=3)                 # (2, n, 365)
    vif = np.empty((2, n_reg))
    se_block = np.empty((2, n_reg))
    for y in (0, 1):
        draws = np.empty((b, n_reg))
        for j in range(b):
            days = _block_days(rng, block_days, DAYS_PER_YEAR)
            draws[j] = daily_means[y][:, days].mean(axis=1)
        se_block[y] = draws.std(axis=0, ddof=1)
        flat = panel.demand[y].reshape(n_reg, -1)
        se_iid = flat.std(axis=1, ddof=1) / np.sqrt(flat.shape[1])
        vif[y] = (se_block[y] / se_iid) ** 2

    ess_block = 8760.0 / vif
    med = lambda a: float(np.median(a))
    keys = ("rho_h1", "rho_h24", "rho_h168", "rho_d1", "rho_d7", "rho_d14",
            "rho_resid_d1", "rho_resid_d3", "rho_resid_d7", "rho_resid_d14", "ess_bartlett")
    tbl = {k: med(np.array([r[k] for r in rows])) for k in keys}

    return {
        "n_region_years": len(rows),
        "b_block_bootstrap": b, "block_days": block_days, "seed": seed,
        "median_acf": {k: round(tbl[k], 3) for k in keys if k != "ess_bartlett"},
        "hourly_n_nominal": 8760,
        "ess_bartlett_median": round(tbl["ess_bartlett"], 1),
        "ess_bartlett_iqr": [round(float(np.percentile([r["ess_bartlett"] for r in rows], 25)), 1),
                             round(float(np.percentile([r["ess_bartlett"] for r in rows], 75)), 1)],
        "vif_block_median": round(med(vif), 1),
        "vif_block_iqr": [round(float(np.percentile(vif, 25)), 1),
                          round(float(np.percentile(vif, 75)), 1)],
        "ess_block_median": round(med(ess_block), 1),
        "ess_block_iqr": [round(float(np.percentile(ess_block, 25)), 1),
                          round(float(np.percentile(ess_block, 75)), 1)],
        "se_annual_mean_inflation_factor_median": round(float(np.median(np.sqrt(vif))), 2),
        "runtime_sec": round(time.time() - t0, 1),
    }
