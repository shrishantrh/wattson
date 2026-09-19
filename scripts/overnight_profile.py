"""Carbon-free share by LOCAL hour of day, per balancing authority and year.

Converts the UTC index to each BA's reporting time zone (from PUDL's
core_eia__codes_balancing_authorities) and compares overnight hours
(00:00-05:59 local) against midday hours (10:00-15:59 local).

Outputs:
  data/processed/cf_by_local_hour.csv        ba, year, local_hour, carbon_free_share, total_twh
  data/processed/night_vs_day_by_ba_year.csv ba, year, night_share, day_share, gap, total_twh
"""
from pathlib import Path
import pandas as pd

PROCESSED = Path("data/processed")
NIGHT = range(0, 6)
DAY = range(10, 16)


def localize(idx: pd.DataFrame, tz: pd.DataFrame) -> pd.DataFrame:
    idx = idx.merge(tz, left_on="ba", right_on="code", how="left").drop(columns="code")
    missing = sorted(idx.loc[idx.report_timezone.isna(), "ba"].unique())
    if missing:
        print("no time zone for BAs (dropped):", missing)
    parts = []
    for tzname, g in idx.dropna(subset=["report_timezone"]).groupby("report_timezone", observed=True):
        local = g.datetime_utc.dt.tz_localize("UTC").dt.tz_convert(tzname)
        parts.append(g.assign(local_hour=local.dt.hour, year=local.dt.year))
    return pd.concat(parts, ignore_index=True)


def weighted_share(df: pd.DataFrame, keys: list[str]) -> pd.DataFrame:
    g = df.groupby(keys, observed=True)[["carbon_free_mwh", "total_generation_mwh"]].sum()
    g["carbon_free_share"] = g.carbon_free_mwh / g.total_generation_mwh
    g["total_twh"] = g.total_generation_mwh / 1e6
    return g.drop(columns=["carbon_free_mwh", "total_generation_mwh"]).reset_index()


if __name__ == "__main__":
    pd.set_option("display.width", 200)
    idx = pd.read_parquet(PROCESSED / "hourly_cf_index.parquet")
    tz = pd.read_parquet("data/pudl/core_eia__codes_balancing_authorities.parquet")[["code", "report_timezone"]]
    loc = localize(idx, tz)

    by_hour = weighted_share(loc, ["ba", "year", "local_hour"])
    by_hour.to_csv(PROCESSED / "cf_by_local_hour.csv", index=False)

    loc["period"] = pd.NA
    loc.loc[loc.local_hour.isin(NIGHT), "period"] = "night"
    loc.loc[loc.local_hour.isin(DAY), "period"] = "day"
    nd = weighted_share(loc.dropna(subset=["period"]), ["ba", "year", "period"])
    nd = nd.pivot(index=["ba", "year"], columns="period", values=["carbon_free_share", "total_twh"])
    nd.columns = [f"{p}_{'share' if m == 'carbon_free_share' else 'twh'}" for m, p in nd.columns]
    nd["gap"] = nd.day_share - nd.night_share
    nd = nd.reset_index()
    nd.to_csv(PROCESSED / "night_vs_day_by_ba_year.csv", index=False)

    # national, local-time weighted
    nat = weighted_share(loc.dropna(subset=["period"]), ["year", "period"]).pivot(index="year", columns="period", values="carbon_free_share")
    nat["gap"] = nat.day - nat.night
    print("NATIONAL carbon-free share, night (00-05 local) vs day (10-15 local):")
    print(nat.round(3).to_string())

    for ba in ["PJM", "MISO", "ERCO", "CISO", "SWPP"]:
        t = nd[nd.ba == ba].set_index("year")[["night_share", "day_share", "gap"]]
        print(f"\n{ba}:"); print(t.round(3).to_string())

    big = nd[(nd.year == 2025)].assign(tot=lambda x: x.night_twh + x.day_twh).nlargest(15, "tot")
    print("\n2025, 15 largest BAs: night vs day share")
    print(big[["ba", "night_share", "day_share", "gap"]].round(3).to_string(index=False))
