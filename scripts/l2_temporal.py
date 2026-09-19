"""L2: temporal analysis of carbon-free generation, overnight vs daytime.

For every BA and for the national total, by calendar year, by same-months
(Jan-Aug, so 2026 is comparable) and as a trailing-12-month monthly series:

  cf_avg_mw     average carbon-free generation, MW (hourly MWh averaged)
  total_avg_mw  average total generation, MW
  cf_share      generation-weighted carbon-free share, 0..1

Periods are local time: overnight = 00:00-05:59, daytime = 10:00-15:59, all = every hour.
National avg MW is the sum of per-BA averages (robust to a BA missing a few
hours); national share is MWh-weighted across BAs. Baseline year is 2019.

Outputs (data/processed/):
  l2_cf_by_period.csv   ba ("US" = national), window (calendar|jan_aug), year, period, ...
  l2_trailing12.csv     ba, period, month (YYYY-MM, window end), ...
"""
from pathlib import Path
import pandas as pd
from overnight_profile import localize, NIGHT, DAY

PROCESSED = Path("data/processed")


def with_periods(loc: pd.DataFrame) -> pd.DataFrame:
    """Stack the frame three times with period = all / overnight / daytime."""
    loc = loc.assign(month=loc.datetime_utc.dt.tz_localize("UTC").dt.tz_convert("UTC").dt.month)  # placeholder, replaced below
    return loc


def aggregate(df: pd.DataFrame, keys: list[str]) -> pd.DataFrame:
    g = df.groupby(keys, observed=True).agg(
        hours=("total_generation_mwh", "count"),
        cf_mwh=("carbon_free_mwh", "sum"),
        total_mwh=("total_generation_mwh", "sum"),
    ).reset_index()
    g["cf_avg_mw"] = g.cf_mwh / g.hours
    g["total_avg_mw"] = g.total_mwh / g.hours
    g["cf_share"] = g.cf_mwh / g.total_mwh
    return g


def national(ba_table: pd.DataFrame, keys: list[str]) -> pd.DataFrame:
    g = ba_table.groupby(keys, observed=True).agg(
        n_bas=("ba", "nunique"), hours=("hours", "max"),
        cf_mwh=("cf_mwh", "sum"), total_mwh=("total_mwh", "sum"),
        cf_avg_mw=("cf_avg_mw", "sum"), total_avg_mw=("total_avg_mw", "sum"),
    ).reset_index()
    g["cf_share"] = g.cf_mwh / g.total_mwh
    g["ba"] = "US"
    return g


def build(loc: pd.DataFrame):
    loc = loc.dropna(subset=["total_generation_mwh"]).copy()
    loc = loc[loc.total_generation_mwh > 0]
    loc["period"] = "other"
    loc.loc[loc.local_hour.isin(NIGHT), "period"] = "overnight"
    loc.loc[loc.local_hour.isin(DAY), "period"] = "daytime"
    stacked = pd.concat([loc.assign(period="all"), loc[loc.period != "other"]], ignore_index=True)

    # calendar year and Jan-Aug windows
    out = []
    for window, frame in [("calendar", stacked), ("jan_aug", stacked[stacked.local_month <= 8])]:
        ba = aggregate(frame, ["ba", "year", "period"]).assign(window=window)
        us = national(ba, ["year", "period"]).assign(window=window)
        out += [ba, us]
    by_period = pd.concat(out, ignore_index=True)
    cols = ["ba", "window", "year", "period", "hours", "cf_avg_mw", "total_avg_mw", "cf_share", "cf_mwh", "total_mwh"]
    by_period = by_period[cols + (["n_bas"] if "n_bas" in by_period else [])]

    # trailing 12 months: monthly sums per BA, rolled; national = sum across BAs first
    stacked["month"] = stacked.year.astype(str) + "-" + stacked.local_month.astype(str).str.zfill(2)
    monthly = aggregate(stacked, ["ba", "period", "month"])
    # drop partial months (the snapshot ends 2026-09-05): require 90% of the hours the period has in that month
    days = pd.to_datetime(monthly.month + "-01").dt.days_in_month
    per_day = monthly.period.map({"all": 24, "overnight": 6, "daytime": 6})
    monthly = monthly[monthly.hours >= 0.9 * days * per_day]
    nat_m = monthly.groupby(["period", "month"], observed=True)[["hours", "cf_mwh", "total_mwh"]].agg(
        {"hours": "max", "cf_mwh": "sum", "total_mwh": "sum"}).reset_index().assign(ba="US")
    # national hours = max BA hours in that month (a BA-hour count), MW = MWh / hours
    monthly = pd.concat([monthly[["ba", "period", "month", "hours", "cf_mwh", "total_mwh"]], nat_m], ignore_index=True)
    monthly = monthly.sort_values(["ba", "period", "month"])
    roll = monthly.groupby(["ba", "period"], observed=True)[["hours", "cf_mwh", "total_mwh"]].rolling(12, min_periods=12).sum()
    roll = roll.reset_index(level=[0, 1], drop=True)
    monthly[["h12", "cf12", "tot12"]] = roll[["hours", "cf_mwh", "total_mwh"]].values
    # national avg MW over the window = sum of MWh / hours in window; per-BA hours identical in spirit
    monthly["cf_avg_mw"] = monthly.cf12 / monthly.h12
    monthly["total_avg_mw"] = monthly.tot12 / monthly.h12
    monthly["cf_share"] = monthly.cf12 / monthly.tot12
    t12 = monthly.dropna(subset=["cf_share"])[["ba", "period", "month", "cf_avg_mw", "total_avg_mw", "cf_share"]]
    return by_period, t12


if __name__ == "__main__":
    pd.set_option("display.width", 220)
    idx = pd.read_parquet(PROCESSED / "hourly_cf_index.parquet")
    tz = pd.read_parquet("data/pudl/core_eia__codes_balancing_authorities.parquet")[["code", "report_timezone"]]
    loc = localize(idx, tz)
    # localize() gives local_hour and year; add local month the same way
    parts = []
    for tzname, g in loc.groupby("report_timezone", observed=True):
        parts.append(g.assign(local_month=g.datetime_utc.dt.tz_localize("UTC").dt.tz_convert(tzname).dt.month))
    loc = pd.concat(parts, ignore_index=True)

    by_period, t12 = build(loc)
    by_period.to_csv(PROCESSED / "l2_cf_by_period.csv", index=False)
    t12.to_csv(PROCESSED / "l2_trailing12.csv", index=False)

    def show(ba, window):
        t = by_period[(by_period.ba == ba) & (by_period.window == window) & (by_period.period != "all")]
        p = t.pivot(index="year", columns="period", values=["cf_avg_mw", "total_avg_mw", "cf_share"])
        p.columns = [f"{m}_{per[:3]}" for m, per in p.columns]
        p = p[["cf_avg_mw_ove", "cf_avg_mw_day", "total_avg_mw_ove", "total_avg_mw_day", "cf_share_ove", "cf_share_day"]]
        p.columns = ["clean_MW_night", "clean_MW_day", "total_MW_night", "total_MW_day", "share_night", "share_day"]
        return p.round({"clean_MW_night": 0, "clean_MW_day": 0, "total_MW_night": 0, "total_MW_day": 0, "share_night": 3, "share_day": 3})

    for ba in ["US", "PJM"]:
        print(f"\n=== {ba}, calendar years (2018 half year, 2026 through Sep 5) ===")
        print(show(ba, "calendar").to_string())
        print(f"\n=== {ba}, same months Jan-Aug ===")
        print(show(ba, "jan_aug").to_string())

    print("\n=== Trailing-12-month, window ending 2026-08 vs calendar 2019 ===")
    last = t12[t12.month == "2026-08"].set_index(["ba", "period"])
    base = by_period[(by_period.window == "calendar") & (by_period.year == 2019)].set_index(["ba", "period"])
    for ba in ["US", "PJM", "MISO", "ERCO", "CISO", "SWPP", "SOCO"]:
        for per in ["overnight", "daytime"]:
            b, l = base.loc[(ba, per)], last.loc[(ba, per)]
            print(f"{ba:5s} {per:9s} clean MW {b.cf_avg_mw:9,.0f} -> {l.cf_avg_mw:9,.0f} ({l.cf_avg_mw-b.cf_avg_mw:+8,.0f})   "
                  f"total MW {b.total_avg_mw:9,.0f} -> {l.total_avg_mw:9,.0f}   share {b.cf_share:.3f} -> {l.cf_share:.3f} ({l.cf_share-b.cf_share:+.3f})")

    print("\n=== 15 largest BAs, overnight, 2019 -> 2025 calendar ===")
    cal = by_period[(by_period.window == "calendar") & (by_period.period == "overnight") & (by_period.ba != "US")]
    w = cal[cal.year.isin([2019, 2025])].pivot(index="ba", columns="year", values=["cf_avg_mw", "total_avg_mw", "cf_share"])
    w.columns = [f"{m}_{y}" for m, y in w.columns]
    w["clean_delta_mw"] = w.cf_avg_mw_2025 - w.cf_avg_mw_2019
    w["total_delta_mw"] = w.total_avg_mw_2025 - w.total_avg_mw_2019
    w["share_delta"] = w.cf_share_2025 - w.cf_share_2019
    w = w.dropna().sort_values("total_avg_mw_2025", ascending=False).head(15)
    print(w[["cf_avg_mw_2019", "cf_avg_mw_2025", "clean_delta_mw", "total_avg_mw_2019", "total_avg_mw_2025", "total_delta_mw", "cf_share_2019", "cf_share_2025", "share_delta"]]
          .round({"cf_avg_mw_2019": 0, "cf_avg_mw_2025": 0, "clean_delta_mw": 0, "total_avg_mw_2019": 0, "total_avg_mw_2025": 0, "total_delta_mw": 0, "cf_share_2019": 3, "cf_share_2025": 3, "share_delta": 3}).to_string())
