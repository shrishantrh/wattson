"""Q2: when did each region's load go flat?

Series: the monthly overnight-to-average demand ratio, 2018-01 to the end of the
snapshot, one series per region, seasonally adjusted by calendar-month climatology
(see profiles.deseasonalize -- level and trend are preserved, only the annual wiggle
is removed). Nothing from the detector enters.

Search: PELT with an L2 (mean-shift) cost, penalty pen = BETA * sigma_hat^2 * log(n)
with BETA = 2, the BIC-flavoured choice, and sigma_hat a robust noise estimate taken
from the MAD of the series' first differences. min_size = 12 months, so a break has
to hold for a year before it counts as structural -- a two-month excursion is not a
changepoint. Binary segmentation is run with identical cost, penalty and min_size as
a cross-check, and the two are reported side by side.

All parameters were fixed before any region's answer was looked at. They are
constants at the top of this file for exactly that reason.

COVID: any break dated 2020-01 through 2020-06 is flagged `covid_suspect`. The 2020
demand collapse moved load everywhere and changed its shape (commercial load fell in
the day, residential rose), so a break there is a pandemic artefact until shown
otherwise and is reported separately rather than counted as a finding.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import ruptures as rpt

MIN_SIZE = 12          # months; a break must hold a year
BETA = 2.0             # penalty multiplier on sigma^2 * log(n)
COVID_START = pd.Timestamp("2020-01-01")
COVID_END = pd.Timestamp("2020-06-30")


def robust_sigma(y: np.ndarray) -> float:
    """Noise sd from first differences: MAD(diff) * 1.4826 / sqrt(2).

    Using differences rather than the level means a genuine level shift inflates
    sigma_hat by one point out of n instead of by the whole shift, so the penalty
    is not talked up by the very thing we are looking for.
    """
    d = np.diff(y)
    if len(d) == 0:
        return 0.0
    return float(np.median(np.abs(d - np.median(d))) * 1.4826 / np.sqrt(2))


def segments(y: np.ndarray, bkps: list[int]) -> list[tuple[int, int]]:
    edges = [0] + list(bkps)
    return [(edges[i], edges[i + 1]) for i in range(len(edges) - 1)]


def detect_one(g: pd.DataFrame, adjusted: pd.Series) -> dict:
    """PELT + binary segmentation on one region's seasonally adjusted ratio series."""
    y = adjusted.to_numpy(float)
    dates = pd.to_datetime(g.date).reset_index(drop=True)
    n = len(y)
    sigma = robust_sigma(y)
    pen = BETA * sigma ** 2 * np.log(n) if sigma > 0 else np.inf

    if n < 3 * MIN_SIZE or not np.isfinite(pen):
        return {"n_months": n, "sigma": sigma, "penalty": None,
                "changepoints": [], "binseg_changepoints": [], "primary": None}

    pelt = rpt.Pelt(model="l2", min_size=MIN_SIZE, jump=1).fit(y).predict(pen=pen)
    binseg = rpt.Binseg(model="l2", min_size=MIN_SIZE, jump=1).fit(y).predict(pen=pen)

    def describe(bkps):
        out = []
        segs = segments(y, bkps)
        for i in range(1, len(segs)):
            a0, a1 = segs[i - 1]
            b0, b1 = segs[i]
            before, after = y[a0:a1], y[b0:b1]
            mag = float(after.mean() - before.mean())
            out.append({
                "index": int(b0),
                "date": dates.iloc[b0].strftime("%Y-%m"),
                "before_mean": float(before.mean()),
                "after_mean": float(after.mean()),
                "magnitude": mag,
                "magnitude_pts": mag * 100,          # percentage points of the ratio
                "magnitude_sigma": mag / sigma if sigma > 0 else None,
                "months_before": int(a1 - a0),
                "months_after": int(b1 - b0),
                "covid_suspect": bool(COVID_START <= dates.iloc[b0] <= COVID_END),
                # A break at the first or last searchable index is where PELT parks a
                # trend it cannot resolve. It is a weaker claim than an interior break
                # and is labelled so, not quietly counted.
                "edge_of_window": bool(b0 <= MIN_SIZE or b0 >= n - MIN_SIZE),
            })
        return out

    cps = describe(pelt)
    bs = describe(binseg)
    primary = max(cps, key=lambda c: abs(c["magnitude"])) if cps else None
    if primary is not None:
        near = [b for b in bs if abs(b["index"] - primary["index"]) <= 3]
        primary = dict(primary, binseg_agrees=bool(near),
                       binseg_date=near[0]["date"] if near else None)
    return {
        "n_months": n, "sigma": sigma, "penalty": float(pen),
        "changepoints": cps, "binseg_changepoints": bs, "primary": primary,
    }


def decompose(g: pd.DataFrame, index: int, window: int = 12) -> dict:
    """What moved at the break: the night, or the day?

    The ratio can rise two ways. Overnight MW can go UP (something new is running at
    night) or average MW can come DOWN while the night holds (behind-the-meter solar
    eating midday demand). These are opposite stories and the ratio alone cannot tell
    them apart, so we compare the 12 months either side of the break in MW.

    Both windows are exactly 12 months long, so the seasonal cycle cancels and no
    adjustment is needed. Windows shorter than `window` at the ends of the series are
    reported with their actual length.
    """
    a = g.iloc[max(0, index - window):index]
    b = g.iloc[index:index + window]
    if len(a) < 6 or len(b) < 6:
        return {"months_each_side": [len(a), len(b)], "usable": False}
    o0, o1 = float(a.overnight_mw.mean()), float(b.overnight_mw.mean())
    m0, m1 = float(a.mw.mean()), float(b.mw.mean())
    d_night = o1 - o0
    d_avg = m1 - m0
    if d_night > 0 and d_avg > 0 and d_night / max(o0, 1e-9) > d_avg / max(m0, 1e-9):
        story = "night grew faster than the day"
    elif d_night > 0 and d_avg <= 0:
        story = "night grew while average fell"
    elif d_night <= 0 and d_avg < 0 and d_avg / max(m0, 1e-9) < d_night / max(o0, 1e-9):
        story = "day fell faster than the night"
    elif d_night <= 0 and d_avg <= 0:
        story = "both fell"
    else:
        story = "day grew faster than the night"
    return {
        "months_each_side": [len(a), len(b)], "usable": True,
        "overnight_mw_before": o0, "overnight_mw_after": o1, "overnight_mw_delta": d_night,
        "avg_mw_before": m0, "avg_mw_after": m1, "avg_mw_delta": d_avg,
        "overnight_pct": 100 * d_night / o0 if o0 else None,
        "avg_pct": 100 * d_avg / m0 if m0 else None,
        "story": story,
    }


def detect_all(monthly: pd.DataFrame) -> dict[str, dict]:
    """monthly: long frame from profiles.monthly_overnight_ratio."""
    from . import profiles as P

    out = {}
    for region, g in monthly.groupby("region", observed=True):
        g = g.sort_values("date").reset_index(drop=True)
        adj = P.deseasonalize(g)
        res = detect_one(g, adj)
        for c in res["changepoints"]:
            c["decomposition"] = decompose(g, c["index"])
        if res["primary"] is not None:
            res["primary"]["decomposition"] = decompose(g, res["primary"]["index"])
        res["series"] = {
            "dates": [d.strftime("%Y-%m") for d in pd.to_datetime(g.date)],
            "ratio": [round(float(v), 5) for v in g.ratio],
            "ratio_adjusted": [round(float(v), 5) for v in adj],
        }
        res["ratio_2019_mean"] = float(g[g.year == 2019].ratio.mean()) \
            if (g.year == 2019).any() else None
        res["ratio_2025_mean"] = float(g[g.year == 2025].ratio.mean()) \
            if (g.year == 2025).any() else None
        out[region] = res
    return out


# ---------------------------------------------------------------- timing questions

SHARED_DATE_MIN = 10   # >= this many regions breaking in the same month is suspicious


def timing(res: dict[str, dict], site_regions: set, seed: int = 20260920,
           n_sim: int = 10000) -> dict:
    """Do the primary changepoints cluster in calendar time, and do site regions differ?

    Null model: each region's break index is uniform over its own searchable range
    [MIN_SIZE, n - MIN_SIZE). That respects the fact that the series have different
    start dates and lengths, which a naive "uniform over 2018-2026" null would not.
    Statistic: the largest number of primary breaks falling inside any 6-month
    calendar window. Monte Carlo, seeded.
    """
    import collections

    from scipy.stats import kstest, mannwhitneyu

    rng = np.random.default_rng(seed)
    rows = []
    for region, r in res.items():
        p = r.get("primary")
        if not p:
            continue
        dates = r["series"]["dates"]
        rows.append({
            "region": region, "index": p["index"], "n": r["n_months"],
            "date": pd.Timestamp(dates[p["index"]] + "-01"),
            "start": pd.Timestamp(dates[0] + "-01"),
            "magnitude_pts": p["magnitude_pts"],
            "covid_suspect": p["covid_suspect"], "edge_of_window": p["edge_of_window"],
            "site": region in site_regions,
        })
    D = pd.DataFrame(rows)
    if D.empty:
        return {}

    def max_window(dates, months=6):
        d = np.sort(np.array([x.year * 12 + x.month for x in dates]))
        return max(int(((d >= s) & (d < s + months)).sum()) for s in d)

    observed = max_window(list(D.date))
    null = np.empty(n_sim, dtype=int)
    starts = D.start.to_numpy()
    lo = np.full(len(D), MIN_SIZE)
    hi = D.n.to_numpy() - MIN_SIZE
    for s in range(n_sim):
        idx = rng.integers(lo, hi)
        sim = [pd.Timestamp(st) + pd.DateOffset(months=int(i)) for st, i in zip(starts, idx)]
        null[s] = max_window(sim)

    u = (D["index"] - MIN_SIZE) / (D.n - 2 * MIN_SIZE)
    ks_d, ks_p = kstest(u, "uniform")

    a = D[D.site].date.map(lambda x: x.year * 12 + x.month)
    b = D[~D.site].date.map(lambda x: x.year * 12 + x.month)
    mwu_date = mannwhitneyu(a, b)[1] if len(a) and len(b) else None
    mwu_mag = mannwhitneyu(D[D.site].magnitude_pts, D[~D.site].magnitude_pts,
                           alternative="greater")[1] if len(a) and len(b) else None

    all_breaks = [(k, c) for k, r in res.items() for c in r["changepoints"]]
    by_month = collections.Counter(c["date"] for _, c in all_breaks)
    shared = [
        {"date": d, "n_regions": n,
         "regions": sorted(k for k, c in all_breaks if c["date"] == d),
         "covid_suspect": bool(COVID_START <= pd.Timestamp(d + "-01") <= COVID_END),
         "any_edge_of_window": any(c["edge_of_window"] for k, c in all_breaks
                                   if c["date"] == d)}
        for d, n in by_month.most_common() if n >= SHARED_DATE_MIN
    ]

    hy = D.date.dt.year.astype(str) + "H" + ((D.date.dt.month > 6).astype(int) + 1).astype(str)
    return {
        "n_primary": int(len(D)),
        "n_primary_site_regions": int(D.site.sum()),
        "max_in_any_6_month_window": {
            "observed": observed, "null_mean": float(null.mean()),
            "null_p95": float(np.percentile(null, 95)),
            "p_value": float(np.mean(null >= observed)), "n_sim": n_sim, "seed": seed,
        },
        "ks_uniform_relative_position": {"D": float(ks_d), "p_value": float(ks_p)},
        "site_vs_nonsite_break_date_mwu_p": float(mwu_date) if mwu_date else None,
        "site_vs_nonsite_magnitude_mwu_p_greater": float(mwu_mag) if mwu_mag else None,
        "median_break_date_site": D[D.site].date.median().strftime("%Y-%m"),
        "median_break_date_other": D[~D.site].date.median().strftime("%Y-%m"),
        "median_magnitude_pts_site": float(D[D.site].magnitude_pts.median()),
        "median_magnitude_pts_other": float(D[~D.site].magnitude_pts.median()),
        "primary_by_half_year": {k: int(v) for k, v in sorted(hy.value_counts().items())},
        "primary_by_half_year_site": {
            k: int(v) for k, v in sorted(hy[D.site.to_numpy()].value_counts().items())},
        "covid_h1_2020": {
            "primary_breaks": int(D.covid_suspect.sum()),
            "all_breaks": int(sum(1 for _, c in all_breaks if c["covid_suspect"])),
            "all_breaks_total": len(all_breaks),
        },
        "edge_of_window": {
            "primary_breaks": int(D.edge_of_window.sum()),
            "all_breaks": int(sum(1 for _, c in all_breaks if c["edge_of_window"])),
        },
        "shared_dates": shared,
        "direction": {
            "positive": int(sum(1 for _, c in all_breaks if c["magnitude"] > 0)),
            "negative": int(sum(1 for _, c in all_breaks if c["magnitude"] < 0)),
        },
        "table": D.assign(date=D.date.dt.strftime("%Y-%m"),
                          start=D.start.dt.strftime("%Y-%m")).to_dict("records"),
    }
