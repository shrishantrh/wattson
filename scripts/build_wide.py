"""Step 1: long EIA-930 generation table -> wide (hour x BA) parquet.

Reads data/pudl/core_eia930__hourly_net_generation_by_energy_source.parquet
(118M rows, of which 98M are empty padding: every BA x fuel x hour since 2015),
keeps only rows that carry a value, and writes:

  data/processed/gen_by_source_compact.parquet  long format, ~20.4M rows
  data/processed/gen_by_source_wide.parquet     index (datetime_utc, ba), one
                                                column per energy source, values
                                                = net_generation_adjusted_mwh
"""
from pathlib import Path
import pandas as pd
import pyarrow.compute as pc
import pyarrow.parquet as pq

RAW = Path("data/pudl/core_eia930__hourly_net_generation_by_energy_source.parquet")
PROCESSED = Path("data/processed")

if __name__ == "__main__":
    PROCESSED.mkdir(parents=True, exist_ok=True)
    t = pq.read_table(RAW)
    has_value = pc.or_(
        pc.or_(pc.is_valid(t["net_generation_adjusted_mwh"]), pc.is_valid(t["net_generation_reported_mwh"])),
        pc.is_valid(t["net_generation_imputed_eia_mwh"]),
    )
    df = t.filter(has_value).to_pandas().rename(columns={
        "balancing_authority_code_eia": "ba",
        "generation_energy_source": "src",
        "net_generation_adjusted_mwh": "adj",
        "net_generation_reported_mwh": "rep",
        "net_generation_imputed_eia_mwh": "imp",
    })
    df["src"] = df["src"].astype(str)
    df.to_parquet(PROCESSED / "gen_by_source_compact.parquet", index=False)
    print(f"compact: {len(df):,} rows, {df.datetime_utc.min()} -> {df.datetime_utc.max()}")

    wide = df.set_index(["datetime_utc", "ba", "src"])["adj"].unstack("src")
    wide.to_parquet(PROCESSED / "gen_by_source_wide.parquet")
    print(f"wide: {wide.shape[0]:,} hour x BA rows, {wide.shape[1]} energy sources, {wide.index.get_level_values('ba').nunique()} BAs")
