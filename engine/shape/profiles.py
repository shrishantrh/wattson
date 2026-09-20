"""Load EIA-930 demand and build the two shape panels this module runs on.

Everything here reuses scripts/l3_detector.py's loading, LOCAL-TIME conversion and
region definitions so the region set reconciles exactly with the shipped detector.
It does NOT import or read any detector output: only raw PUDL parquet.

Two panels come out:

  hour_panel    (region, year, local_hour) -> mean demand MW, hours
                the 24-hour load shape, used for Q1 (clustering).
  month_panel   (region, year, month) -> mean demand MW, mean overnight (00-05
                local) demand MW, hours; used for Q2 (changepoints).

Region = a BA (from out_eia930__hourly_operations) or "BA/ZONE" (from
out_eia930__hourly_subregion_demand), demand_imputed_pudl_mwh in both, exactly as
the detector builds them. Zones carry their own demand; no generation figure is
ever used for a zone (or for anything else in this module).

Both panels are cached to data/processed/ (gitignored) because the raw load is
~4.5M rows and takes a couple of minutes.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
PUDL = REPO_ROOT / "data" / "pudl"
PROCESSED = REPO_ROOT / "data" / "processed"

NIGHT = range(0, 6)              # 00:00-05:59 local, as everywhere else in Wattson
MIN_MW = 500                     # same floor as the shipped detector
BASE, TARGET = 2019, 2025        # same baseline / target years
FULL_YEAR_FRACTION = 0.9         # >= 90% of 8760 hours reported, same as the detector


# --------------------------------------------------------------------------- load

def load_demand() -> pd.DataFrame:
    """Hourly demand for every BA and every subregion. Mirrors l3_detector.load_demand."""
    sub = pd.read_parquet(
        PUDL / "out_eia930__hourly_subregion_demand.parquet",
        columns=["datetime_utc", "balancing_authority_code_eia",
                 "balancing_authority_subregion_code_eia", "demand_imputed_pudl_mwh"],
    )
    sub.columns = ["datetime_utc", "ba", "zone", "demand_mwh"]
    sub["zone"] = sub.zone.astype(str)
    ops = pd.read_parquet(
        PUDL / "out_eia930__hourly_operations.parquet",
        columns=["datetime_utc", "balancing_authority_code_eia", "demand_imputed_pudl_mwh"],
    )
    ops.columns = ["datetime_utc", "ba", "demand_mwh"]
    ops["zone"] = None
    d = pd.concat([sub, ops], ignore_index=True).dropna(subset=["demand_mwh"])
    d["region"] = np.where(d.zone.isna(), d.ba, d.ba + "/" + d.zone.astype(str))
    return d


def localize(d: pd.DataFrame, codes: pd.DataFrame) -> pd.DataFrame:
    """UTC -> the BA's reporting time zone. Mirrors l3_detector.localize.

    This matters more here than anywhere: an hour is only "overnight" in local time
    and the big BAs span time zones, so the 24-hour profile is meaningless in UTC.
    """
    d = d.merge(codes[["code", "report_timezone"]], left_on="ba", right_on="code",
                how="left").drop(columns="code")
    missing = sorted(d.loc[d.report_timezone.isna(), "ba"].unique())
    if missing:
        print("no time zone, dropped:", missing)
    parts = []
    for tzname, g in d.dropna(subset=["report_timezone"]).groupby("report_timezone",
                                                                 observed=True):
        local = g.datetime_utc.dt.tz_localize("UTC").dt.tz_convert(tzname)
        parts.append(g.assign(local_hour=local.dt.hour, year=local.dt.year,
                              month=local.dt.month))
    return pd.concat(parts, ignore_index=True)


def codes() -> pd.DataFrame:
    return pd.read_parquet(PUDL / "core_eia__codes_balancing_authorities.parquet")


# -------------------------------------------------------------------------- panels

def build_panels() -> tuple[pd.DataFrame, pd.DataFrame]:
    d = localize(load_demand(), codes())
    night = d.local_hour.isin(NIGHT)

    hour = (d.groupby(["region", "year", "local_hour"], observed=True)
              .agg(ba=("ba", "first"), zone=("zone", "first"),
                   mw=("demand_mwh", "mean"), hours=("demand_mwh", "count"))
              .reset_index())

    month = (d.groupby(["region", "year", "month"], observed=True)
               .agg(ba=("ba", "first"), zone=("zone", "first"),
                    mw=("demand_mwh", "mean"), hours=("demand_mwh", "count"))
               .reset_index())
    ngt = (d[night].groupby(["region", "year", "month"], observed=True)
             .agg(overnight_mw=("demand_mwh", "mean"),
                  overnight_hours=("demand_mwh", "count")))
    month = month.join(ngt, on=["region", "year", "month"])

    return hour, month


def panels(refresh: bool = False) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Cached panels. Cache lives under data/processed/, which is gitignored."""
    PROCESSED.mkdir(parents=True, exist_ok=True)
    hp, mp = PROCESSED / "shape_hour_panel.parquet", PROCESSED / "shape_month_panel.parquet"
    if not refresh and hp.exists() and mp.exists():
        return pd.read_parquet(hp), pd.read_parquet(mp)
    hour, month = build_panels()
    hour.to_parquet(hp, index=False)
    month.to_parquet(mp, index=False)
    return hour, month


# ------------------------------------------------------------------ region universe

def eligible_regions(hour: pd.DataFrame) -> pd.Index:
    """The detector's region universe, rebuilt from raw data.

    avg demand >= 500 MW and >= 90% of the year's hours reported, in BOTH 2019 and
    2025. Identical rule to scripts/l3_detector.detect(), so the two region sets
    reconcile -- but computed here from the parquet, not read from detector output.

    We keep the 500 MW floor for the same reason the detector has it: below it the
    hourly series is dominated by reporting noise and a handful of industrial
    customers, and a 24-hour profile built from it is not measuring a grid.
    """
    y = (hour.groupby(["region", "year"], observed=True)
             .agg(mw=("mw", "mean"), hours=("hours", "sum")))
    ok = {}
    for yr in (BASE, TARGET):
        s = y.xs(yr, level="year")
        ok[yr] = s.index[(s.mw >= MIN_MW) & (s.hours >= FULL_YEAR_FRACTION * 8760)]
    return ok[BASE].intersection(ok[TARGET]).sort_values()


# ---------------------------------------------------------------------- Q1 features

def hour_profiles(hour: pd.DataFrame, regions: pd.Index, year: int) -> pd.DataFrame:
    """24-wide normalized load shape, one row per region.

    Normalization: each hour's mean demand divided by that region-year's mean demand,
    so every profile averages to 1.0 and a region's SIZE is removed while its
    PEAK-TO-TROUGH RATIO is kept. Flatness is the thing we are trying to see, so it
    must survive normalization -- z-scoring each profile (the other obvious choice)
    would divide exactly that signal away. The z-scored variant is run as a
    robustness check in cluster.py.
    """
    h = hour[(hour.year == year) & hour.region.isin(regions)]
    wide = h.pivot_table(index="region", columns="local_hour", values="mw")
    wide = wide.reindex(columns=range(24))
    if wide.isna().any().any():
        raise ValueError("missing local hours in profile matrix")
    return wide.div(wide.mean(axis=1), axis=0)


# ---------------------------------------------------------------------- Q2 features

def monthly_overnight_ratio(month: pd.DataFrame, regions: pd.Index,
                            start_year: int = 2018) -> pd.DataFrame:
    """(region x month) overnight-to-average demand ratio, long form.

    ratio = mean demand over local hours 00-05 / mean demand over all 24 hours.
    1.0 means a perfectly flat day. Rising = the night is catching up with the day.
    The ratio is scale-free, so it is comparable across a 1 GW zone and a 90 GW BA
    and unaffected by a region simply getting bigger.

    Partial months are dropped (< 85% of the hours the month should have), which is
    what drops the tail of the 2026 snapshot.
    """
    m = month[month.region.isin(regions) & (month.year >= start_year)].copy()
    days = pd.to_datetime(dict(year=m.year, month=m.month, day=1)).dt.days_in_month
    m["expected_hours"] = days * 24
    m = m[m.hours >= 0.85 * m.expected_hours]
    m = m.dropna(subset=["overnight_mw", "mw"])
    m["ratio"] = m.overnight_mw / m.mw
    m["date"] = pd.to_datetime(dict(year=m.year, month=m.month, day=1))
    return m[["region", "date", "year", "month", "mw", "overnight_mw", "ratio",
              "hours"]].sort_values(["region", "date"]).reset_index(drop=True)


def deseasonalize(g: pd.DataFrame) -> pd.Series:
    """Remove the calendar-month climatology from one region's ratio series.

    The overnight ratio has a large, regular seasonal cycle (summer afternoon air
    conditioning depresses it, mild months raise it). Left in, a changepoint search
    fires on July every year and finds nothing else. We subtract each calendar
    month's own mean across all years and add the series mean back, so the level is
    preserved and only the seasonal wiggle is taken out. No trend is removed: a
    trend is exactly what we are looking for.
    """
    clim = g.groupby(g.date.dt.month).ratio.transform("mean")
    return g.ratio - clim + g.ratio.mean()
