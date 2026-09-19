"""Inspect a PUDL parquet table: shape, dtypes, low-cardinality columns, time range."""
import sys
import pandas as pd

path = sys.argv[1] if len(sys.argv) > 1 else "data/pudl/core_eia930__hourly_net_generation_by_energy_source.parquet"
df = pd.read_parquet(path)

print("FILE:", path)
print("SHAPE:", df.shape)
print("\nDTYPES:")
print(df.dtypes.to_string())
print("\nHEAD:")
print(df.head(8).to_string())

print("\nLOW-CARDINALITY COLUMNS:")
for col in df.columns:
    n = df[col].nunique(dropna=True)
    if n < 120:
        vals = sorted(df[col].dropna().unique().tolist(), key=str)
        print(f"  {col} ({n}): {vals}")
    else:
        print(f"  {col}: {n} distinct values")

time_cols = [c for c in df.columns if "datetime" in c or "date" in c or "hour" in c]
for c in time_cols:
    try:
        print(f"\nTIME RANGE {c}: {df[c].min()} -> {df[c].max()}")
    except Exception as e:
        print(f"\nTIME RANGE {c}: could not compute ({e})")

print("\nNULL COUNTS:")
print(df.isna().sum().to_string())
