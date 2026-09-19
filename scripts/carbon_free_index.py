"""Hourly carbon-free generation index for every US balancing authority.

Input : data/processed/gen_by_source_wide.parquet  (one row per UTC hour x BA,
        one column per EIA-930 energy source, values = net_generation_adjusted_mwh)
Output: data/processed/hourly_cf_index.parquet     (hourly index, all BAs)
        data/processed/annual_cf_by_ba.csv         (generation-weighted annual share)

Category notes (verified against the data, see analysis in README):
  * On 2024-07-01 EIA split hydro/solar/wind into finer buckets. Parent and
    child buckets are never populated in the same hour, so summing all of them
    is safe and never double counts.
  * "other" (biomass, waste, petcoke, ...) and "unknown" count toward total
    generation but NOT toward carbon-free. Conservative on purpose.
  * Storage buckets are net of charging (often negative) and are not
    generation; they are excluded from both numerator and denominator.
  * Small negative values (station load, pumping folded into pre-2024 hydro)
    are clipped to zero before summing.
"""
from pathlib import Path
import pandas as pd

CARBON_FREE = [
    "nuclear",
    "hydro", "hydro_excluding_pumped_storage",
    "wind", "wind_w_integrated_battery_storage", "wind_wo_integrated_battery_storage",
    "solar", "solar_w_integrated_battery_storage", "solar_wo_integrated_battery_storage",
    "geothermal",
]
FOSSIL = ["gas", "coal", "oil"]
OTHER = ["other", "unknown"]
STORAGE = ["battery_storage", "pumped_storage", "other_energy_storage", "unknown_energy_storage"]

PROCESSED = Path("data/processed")


def build_index(wide: pd.DataFrame) -> pd.DataFrame:
    gen = wide[CARBON_FREE + FOSSIL + OTHER].clip(lower=0)
    out = pd.DataFrame(index=wide.index)
    out["carbon_free_mwh"] = gen[CARBON_FREE].sum(axis=1, min_count=1)
    out["fossil_mwh"] = gen[FOSSIL].sum(axis=1, min_count=1)
    out["other_mwh"] = gen[OTHER].sum(axis=1, min_count=1)
    out["storage_net_mwh"] = wide[STORAGE].sum(axis=1, min_count=1)
    out["total_generation_mwh"] = out[["carbon_free_mwh", "fossil_mwh", "other_mwh"]].sum(axis=1, min_count=1)
    # A BA that reports gas but no carbon-free category has 0 carbon-free MWh, not "unknown".
    has_total = out.total_generation_mwh.notna()
    for c in ["carbon_free_mwh", "fossil_mwh", "other_mwh"]:
        out.loc[has_total, c] = out.loc[has_total, c].fillna(0)
    out["carbon_free_share"] = (out.carbon_free_mwh / out.total_generation_mwh).where(out.total_generation_mwh > 0)
    return out.reset_index()


def annual_summary(idx: pd.DataFrame) -> pd.DataFrame:
    idx = idx.assign(year=idx.datetime_utc.dt.year)
    g = idx.groupby(["ba", "year"]).agg(
        carbon_free_twh=("carbon_free_mwh", lambda s: s.sum() / 1e6),
        total_twh=("total_generation_mwh", lambda s: s.sum() / 1e6),
        hours=("total_generation_mwh", "count"),
    )
    g["carbon_free_share"] = g.carbon_free_twh / g.total_twh
    return g.reset_index()


if __name__ == "__main__":
    wide = pd.read_parquet(PROCESSED / "gen_by_source_wide.parquet")
    idx = build_index(wide)
    idx.to_parquet(PROCESSED / "hourly_cf_index.parquet", index=False)
    annual = annual_summary(idx)
    annual.to_csv(PROCESSED / "annual_cf_by_ba.csv", index=False)

    pd.set_option("display.width", 200)
    print(f"hourly rows: {len(idx):,}  BAs: {idx.ba.nunique()}  range: {idx.datetime_utc.min()} -> {idx.datetime_utc.max()}")
    print("share out of [0,1]:", ((idx.carbon_free_share < 0) | (idx.carbon_free_share > 1)).sum(),
          " share NaN:", idx.carbon_free_share.isna().sum())

    nat = annual.groupby("year")[["carbon_free_twh", "total_twh"]].sum()
    nat["carbon_free_share"] = nat.carbon_free_twh / nat.total_twh
    print("\nNATIONAL (all reporting BAs, generation-weighted):")
    print(nat.round(3).to_string())

    print("\nPJM by year:")
    print(annual[annual.ba == "PJM"].set_index("year")[["carbon_free_share", "total_twh", "hours"]].round(3).to_string())

    full = annual[(annual.year == 2025) & (annual.hours > 8000)].sort_values("carbon_free_share")
    print("\n2025, lowest 8 BAs (>=8000 hours):")
    print(full.head(8)[["ba", "carbon_free_share", "total_twh"]].round(3).to_string(index=False))
    print("\n2025, highest 8 BAs (>=8000 hours):")
    print(full.tail(8)[["ba", "carbon_free_share", "total_twh"]].round(3).to_string(index=False))
