"""Cooling and heating degree hours, on the detector's windows and clock.

Base temperature
    65 F = 18.333 C is the US convention (NOAA, EIA, every utility rate case) and
    is the default here. It is a convention, not a measurement: it dates from a
    1920s estimate of the outdoor temperature at which a building needs neither
    heating nor cooling, and modern buildings with more internal gain start
    cooling lower. So the whole central test is run again at 60 F and 70 F and
    the sensitivity is reported. If the answer moved with the base, the answer
    would not be worth much.

Degree HOURS, not degree days
    The standard CDD is max(daily mean - base, 0). That is useless here: it
    cannot tell overnight from afternoon, which is the entire question. So we
    work in degree hours, max(T_h - base, 0) summed or averaged over the hours of
    a window. Note these are not interchangeable: because max(.,0) is convex,
    the mean of hourly CDH exceeds the CDD computed from the daily mean. Every
    number in this module is hourly and is compared only with other hourly
    numbers.

Windows (identical to scripts/l3_detector.py)
    overnight  local hours 00:00-05:59
    daytime    local hours 10:00-15:59
    all        every hour

Season window
    NOAA's global-hourly archive ends in late August 2025, so a calendar-year
    2019 vs 2025 comparison is impossible on the weather side. Both years are cut
    to the same day-of-year span, ending at the last day both years cover, and the
    demand side uses the frozen detector's own `jan_aug` window. The residual
    mismatch (a few days of late August) is quantified in docs/WEATHER.md and
    re-run over a Jan-Jul window as a sensitivity.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

F65_C = (65.0 - 32.0) * 5.0 / 9.0          # 18.333...
F60_C = (60.0 - 32.0) * 5.0 / 9.0          # 15.555...
F70_C = (70.0 - 32.0) * 5.0 / 9.0          # 21.111...
BASES_C = {"60F": F60_C, "65F": F65_C, "70F": F70_C}

NIGHT = range(0, 6)
DAY = range(10, 16)


def degree_hours(temp_c: np.ndarray, base_c: float) -> tuple[np.ndarray, np.ndarray]:
    """(cooling, heating) degree hours, in Celsius-hours, per hour."""
    return np.maximum(temp_c - base_c, 0.0), np.maximum(base_c - temp_c, 0.0)


def common_day_span(region_hours: pd.DataFrame, years: list[int]) -> int:
    """Last day-of-year that every requested year actually covers, capped at Aug 31.

    ISD stops in late August 2025; using the same span in 2019 is what keeps the
    comparison honest.
    """
    last = []
    for y in years:
        g = region_hours[(region_hours.year == y) & region_hours.temp_c.notna()]
        if g.empty:
            return 0
        # last day on which at least 18 of 24 hours reported, pooled over regions
        doy = g.datetime_utc.dt.dayofyear
        per_day = g.groupby(doy).temp_c.size() / g.region.nunique()
        good = per_day[per_day >= 18]
        last.append(int(good.index.max()) if len(good) else int(doy.max()))
    aug31 = 244 if any(y % 4 == 0 for y in years) else 243
    return min(min(last), aug31)


def window_means(region_hours: pd.DataFrame, years: list[int], day_max: int,
                 base_c: float = F65_C) -> pd.DataFrame:
    """Mean temperature and mean degree hours per region, year and window."""
    d = region_hours[region_hours.year.isin(years) & region_hours.temp_c.notna()].copy()
    d["doy"] = d.datetime_utc.dt.dayofyear
    d = d[d.doy <= day_max]
    cdh, hdh = degree_hours(d.temp_c.to_numpy(), base_c)
    d["cdh"], d["hdh"] = cdh, hdh

    frames = []
    for name, hours in (("night", NIGHT), ("day", DAY), ("all", None)):
        g = d if hours is None else d[d.local_hour.isin(hours)]
        agg = g.groupby(["region", "year"]).agg(
            temp_c=("temp_c", "mean"), cdh=("cdh", "mean"), hdh=("hdh", "mean"),
            hours=("temp_c", "size")).reset_index()
        agg["window"] = name
        frames.append(agg)
    return pd.concat(frames, ignore_index=True)


def deltas(wm: pd.DataFrame, base_year: int, target_year: int) -> pd.DataFrame:
    """One row per region: the 2019 -> 2025 change in each window's degree hours."""
    b = wm[wm.year == base_year].set_index(["region", "window"])
    t = wm[wm.year == target_year].set_index(["region", "window"])
    common = b.index.intersection(t.index)
    d = pd.DataFrame(index=common)
    for c in ("temp_c", "cdh", "hdh"):
        d[f"d_{c}"] = t.loc[common, c] - b.loc[common, c]
        d[f"{c}_base"] = b.loc[common, c]
        d[f"{c}_target"] = t.loc[common, c]
    d["hours_base"] = b.loc[common, "hours"]
    d["hours_target"] = t.loc[common, "hours"]
    d = d.reset_index()
    wide = d.pivot(index="region", columns="window")
    wide.columns = [f"{a}_{b_}" for a, b_ in wide.columns]
    return wide.reset_index()


def annual_series(region_hours: pd.DataFrame, years: list[int], day_max: int,
                  base_c: float = F65_C) -> pd.DataFrame:
    """Degree hours per region and year over the same Jan-to-day_max span, all years."""
    return window_means(region_hours, years, day_max, base_c)
