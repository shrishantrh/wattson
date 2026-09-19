"""L4: supply attribution and siting score.

Overnight (00:00-05:59 local) generation by fuel group, per BA and year, plus a
monthly overnight series for the alert rules, and the siting score per BA.

Fuel groups (same rules as L1: storage excluded, small negatives clipped):
  nuclear, hydro, wind, solar, geothermal, gas, coal, oil, other

Siting score per BA (spec Amendment 2), calendar years:
  overnight_cf_share_2025           overnight carbon-free share of generation
  change_since_2019                 share points
  overnight_clean_mw_over_demand    overnight clean generation MW / overnight demand MW
                                    (demand_imputed_pudl_mwh, operations table), 2025
  ratio_slope_per_year              OLS slope of that ratio over 2019..2025, per year
  siting_score                      mean percentile across the first three components
                                    (0..1, higher = new flat load served more cleanly)

Outputs (data/processed/):
  l4_overnight_fuel_by_ba_year.csv  ba, year, fuel, avg_mw
  l4_overnight_fuel_monthly.csv     ba, month, fuel, mwh, hours
  l4_siting.csv                     one row per BA
"""
from pathlib import Path
import numpy as np
import pandas as pd

PROCESSED = Path("data/processed")
NIGHT = range(0, 6)
GROUPS = {
    "nuclear": ["nuclear"],
    "hydro": ["hydro", "hydro_excluding_pumped_storage"],
    "wind": ["wind", "wind_w_integrated_battery_storage", "wind_wo_integrated_battery_storage"],
    "solar": ["solar", "solar_w_integrated_battery_storage", "solar_wo_integrated_battery_storage"],
    "geothermal": ["geothermal"],
    "gas": ["gas"], "coal": ["coal"], "oil": ["oil"],
    "other": ["other", "unknown"],
}
CLEAN = ["nuclear", "hydro", "wind", "solar", "geothermal"]


def overnight_fuel(wide: pd.DataFrame, tz: pd.DataFrame):
    grouped = pd.DataFrame({k: wide[v].clip(lower=0).sum(axis=1, min_count=1) for k, v in GROUPS.items()})
    grouped = grouped.reset_index().merge(tz, left_on="ba", right_on="code", how="inner").drop(columns="code")
    parts = []
    for tzname, g in grouped.groupby("report_timezone", observed=True):
        local = g.datetime_utc.dt.tz_localize("UTC").dt.tz_convert(tzname)
        parts.append(g.assign(year=local.dt.year, month=local.dt.strftime("%Y-%m"), hour=local.dt.hour))
    g = pd.concat(parts, ignore_index=True)
    night = g[g.hour.isin(NIGHT)]
    fuels = list(GROUPS)
    by_year = night.groupby(["ba", "year"])[fuels].mean().stack().rename("avg_mw").reset_index().rename(columns={"level_2": "fuel"})
    monthly = night.groupby(["ba", "month"])[fuels].sum(min_count=1)
    monthly["hours"] = night.groupby(["ba", "month"]).size()
    monthly = monthly.reset_index().melt(id_vars=["ba", "month", "hours"], var_name="fuel", value_name="mwh")
    return by_year, monthly


def siting(by_year: pd.DataFrame, l2: pd.DataFrame, l3: pd.DataFrame) -> pd.DataFrame:
    share = l2[(l2.window == "calendar") & (l2.period == "overnight") & (l2.ba != "US")].pivot(index="ba", columns="year", values="cf_share")
    clean_mw = l2[(l2.window == "calendar") & (l2.period == "overnight") & (l2.ba != "US")].pivot(index="ba", columns="year", values="cf_avg_mw")
    dem = l3[(l3.window == "calendar") & l3.zone.isna()].pivot(index="region", columns="year", values="overnight_avg_mw")
    years = [y for y in range(2019, 2026)]
    rows = []
    for ba in share.index:
        if ba not in dem.index:
            continue
        ratio = {y: clean_mw.at[ba, y] / dem.at[ba, y] for y in years if y in dem.columns and pd.notna(dem.at[ba, y]) and dem.at[ba, y] > 0 and pd.notna(clean_mw.at[ba, y])}
        slope = np.nan
        if len(ratio) >= 4:
            xs, ys = np.array(list(ratio)), np.array(list(ratio.values()))
            slope = np.polyfit(xs, ys, 1)[0]
        rows.append({
            "ba": ba,
            "overnight_cf_share_2025": share.get(2025, pd.Series(dtype=float)).get(ba, np.nan),
            "overnight_cf_share_2019": share.get(2019, pd.Series(dtype=float)).get(ba, np.nan),
            "overnight_clean_mw_2025": clean_mw.get(2025, pd.Series(dtype=float)).get(ba, np.nan),
            "overnight_demand_mw_2025": dem.at[ba, 2025] if 2025 in dem.columns else np.nan,
            "overnight_clean_mw_over_demand": ratio.get(2025, np.nan),
            "ratio_2019": ratio.get(2019, np.nan),
            "ratio_slope_per_year": slope,
            "ratio_years": len(ratio),
        })
    s = pd.DataFrame(rows).set_index("ba")
    s["change_since_2019"] = s.overnight_cf_share_2025 - s.overnight_cf_share_2019
    comp = s[["overnight_cf_share_2025", "change_since_2019", "overnight_clean_mw_over_demand"]].dropna()
    s["siting_score"] = comp.rank(pct=True).mean(axis=1)
    s["siting_rank"] = s.siting_score.rank(ascending=False, method="min")
    return s.reset_index().sort_values("siting_score", ascending=False)


if __name__ == "__main__":
    pd.set_option("display.width", 220); pd.set_option("display.max_columns", 30)
    wide = pd.read_parquet(PROCESSED / "gen_by_source_wide.parquet")
    tz = pd.read_parquet("data/pudl/core_eia__codes_balancing_authorities.parquet")[["code", "report_timezone"]].dropna()
    by_year, monthly = overnight_fuel(wide, tz)
    by_year.to_csv(PROCESSED / "l4_overnight_fuel_by_ba_year.csv", index=False)
    monthly.to_csv(PROCESSED / "l4_overnight_fuel_monthly.csv", index=False)

    l2 = pd.read_csv(PROCESSED / "l2_cf_by_period.csv")
    l3 = pd.read_csv(PROCESSED / "l3_region_year.csv")
    s = siting(by_year, l2, l3)
    s.to_csv(PROCESSED / "l4_siting.csv", index=False)

    pjm = by_year[by_year.ba == "PJM"].pivot(index="year", columns="fuel", values="avg_mw")
    print("PJM overnight avg MW by fuel:"); print(pjm[list(GROUPS)].round(0).to_string())
    print("\nSITING, BAs with 2025 overnight demand >= 5 GW, sorted by siting score:")
    big = s[s.overnight_demand_mw_2025 >= 5000]
    cols = ["ba", "overnight_cf_share_2025", "change_since_2019", "overnight_clean_mw_over_demand", "ratio_2019", "ratio_slope_per_year", "siting_score", "siting_rank"]
    print(big[cols].round(3).to_string(index=False))
    print(f"\n{len(s)} BAs scored; {s.siting_score.isna().sum()} without a full score")
