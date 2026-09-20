"""Pull EPA CEMS hourly emissions for the two comparison years out of PUDL.

Source table : core_epacems__hourly_emissions  (PUDL `stable` release, public S3
               bucket s3://pudl.catalyst.coop, one 4.88 GB parquet file,
               1,017,999,168 rows, 16 columns, 10,180 row groups).

The file is physically sorted by year, so every row group carries a single year
in its statistics and we read only the row groups for 2019 and 2025. Nothing
else is downloaded. Columns are projected down to the eleven we use.

The PUDL table already carries `plant_id_eia` alongside `plant_id_epa`: PUDL has
applied the EPA/EIA crosswalk (core_epa__assn_eia_epacamd) upstream. We record
how many rows and how much CO2 fail to carry an EIA plant id rather than
assuming the join is complete.

Outputs, all under data/processed/:
  cems_plant_hour.parquet   plant_id_eia x UTC hour, CO2 short tons, gross load
                            MW, heat input MMBtu, operating hours, unit count
  cems_unit_year.parquet    CEMS unit x year totals (used for the unit check)
  cems_fetch_meta.json      row counts, date range, null counts, codes
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.fs as pafs
import pyarrow.parquet as pq

BUCKET_PATH = "pudl.catalyst.coop/stable/core_epacems__hourly_emissions.parquet"
REGION = "us-west-2"
YEARS = (2019, 2025)
SLAB = 20  # row groups per read

COLS = [
    "plant_id_eia",
    "plant_id_epa",
    "emissions_unit_id_epa",
    "state",
    "operating_datetime_utc",
    "co2_mass_tons",
    "co2_mass_measurement_code",
    "gross_load_mw",
    "heat_content_mmbtu",
    "operating_time_hours",
    "year",
]

PROCESSED = Path("data/processed")
PLANT_HOUR = PROCESSED / "cems_plant_hour.parquet"
UNIT_YEAR = PROCESSED / "cems_unit_year.parquet"
CODE_PLANT_YEAR = PROCESSED / "cems_code_plant_year.parquet"
META = PROCESSED / "cems_fetch_meta.json"


def open_remote() -> pq.ParquetFile:
    s3 = pafs.S3FileSystem(anonymous=True, region=REGION)
    return pq.ParquetFile(s3.open_input_file(BUCKET_PATH))


def row_groups_for_years(pf: pq.ParquetFile, years=YEARS) -> dict[int, list[int]]:
    """Row groups whose `year` statistics touch each wanted year."""
    md = pf.metadata
    names = [pf.schema_arrow.field(i).name for i in range(md.num_columns)]
    yi = names.index("year")
    out: dict[int, list[int]] = {y: [] for y in years}
    for i in range(md.num_row_groups):
        st = md.row_group(i).column(yi).statistics
        for y in years:
            if st.min <= y <= st.max:
                out[y].append(i)
    return out


def _decode(t: pa.Table) -> pa.Table:
    """PUDL stores `state` and the measurement codes as dictionaries; Acero cannot
    unify dictionaries across row-group chunks, so decode them to plain strings."""
    cols = []
    for f, col in zip(t.schema, t.columns):
        if pa.types.is_dictionary(f.type):
            col = col.cast(pa.string())
        cols.append(col)
    return pa.Table.from_arrays(cols, names=t.column_names)


SUMS = ("co2_mass_tons", "gross_load_mw", "gross_load_mwh", "heat_content_mmbtu",
        "operating_time_hours", "n_units")
PH_KEYS = ["plant_id_eia", "operating_datetime_utc"]
UY_KEYS = ["plant_id_epa", "emissions_unit_id_epa", "plant_id_eia", "state", "year"]


def _derive(t: pa.Table) -> pa.Table:
    """gross_load_mw is the average MW over the part of the hour the unit ran, so
    energy for the hour is gross_load_mw * operating_time_hours. Summing raw MW
    would overstate the output of any unit that ran less than a full hour."""
    return t.append_column("gross_load_mwh", pc.multiply(
        pc.fill_null(t["gross_load_mw"], 0.0), pc.fill_null(t["operating_time_hours"], 0.0)))


def _agg(t: pa.Table, keys: list[str]) -> pa.Table:
    """Group and sum. Every measure is a sum, so re-running this on its own
    output (partial aggregates) gives the same answer as one pass over the raw."""
    if "n_units" not in t.column_names:
        t = t.append_column("n_units", pa.array([1] * t.num_rows, pa.int64()))
    cols = [c for c in SUMS if c in t.column_names]
    out = t.group_by(keys).aggregate([(c, "sum") for c in cols])
    return out.rename_columns([c[:-4] if c.endswith("_sum") else c for c in out.column_names])


def _plant_hour(t: pa.Table) -> pa.Table:
    return _agg(t, PH_KEYS)


def _unit_year(t: pa.Table) -> pa.Table:
    return _agg(t, UY_KEYS)


CODE_KEYS = ["plant_id_eia", "year", "co2_mass_measurement_code"]


def _code_plant_year(t: pa.Table) -> pa.Table:
    return _agg(t, CODE_KEYS)


def _recombine(tables: list[pa.Table], fn) -> pa.Table:
    return fn(pa.concat_tables(tables))


def fetch(years=YEARS, slab=SLAB, verbose=True) -> dict:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    pf = open_remote()
    rgs = row_groups_for_years(pf, years)
    meta: dict = {
        "source_table": "core_epacems__hourly_emissions",
        "source_uri": "s3://" + BUCKET_PATH,
        "release": "stable",
        "file_rows_total": pf.metadata.num_rows,
        "file_row_groups_total": pf.metadata.num_row_groups,
        "columns_read": COLS,
        "years": list(years),
        "row_groups_read": {str(y): len(v) for y, v in rgs.items()},
        "rows_read": {},
        "per_year": {},
    }
    ph_parts: list[pa.Table] = []
    uy_parts: list[pa.Table] = []
    cy_parts: list[pa.Table] = []
    code_counts: dict[str, dict[str, int]] = {}
    t0 = time.time()

    for y in years:
        ids = rgs[y]
        rows = 0
        null_eia_rows = 0
        null_eia_co2 = 0.0
        null_co2_rows = 0
        dmin = dmax = None
        ph_year: list[pa.Table] = []
        uy_year: list[pa.Table] = []
        cy_year: list[pa.Table] = []
        codes: dict[str, int] = {}
        for s in range(0, len(ids), slab):
            chunk = ids[s:s + slab]
            t = _derive(_decode(pf.read_row_groups(chunk, columns=COLS)))
            t = t.filter(pc.equal(t["year"], y))
            if t.num_rows == 0:
                continue
            rows += t.num_rows
            nm = pc.is_null(t["plant_id_eia"])
            n_null = pc.sum(pc.cast(nm, pa.int64())).as_py() or 0
            if n_null:
                null_eia_rows += n_null
                null_eia_co2 += pc.sum(pc.if_else(nm, t["co2_mass_tons"], 0.0)).as_py() or 0.0
            null_co2_rows += pc.sum(pc.cast(pc.is_null(t["co2_mass_tons"]), pa.int64())).as_py() or 0
            lo = pc.min(t["operating_datetime_utc"]).as_py()
            hi = pc.max(t["operating_datetime_utc"]).as_py()
            dmin = lo if dmin is None or lo < dmin else dmin
            dmax = hi if dmax is None or hi > dmax else dmax
            cc = t.group_by(["co2_mass_measurement_code"]).aggregate([("co2_mass_measurement_code", "count")])
            for k, v in zip(cc.column(0).to_pylist(), cc.column(1).to_pylist()):
                codes[str(k)] = codes.get(str(k), 0) + v
            ph_year.append(_plant_hour(t))
            uy_year.append(_unit_year(t))
            cy_year.append(_code_plant_year(t))
            del t
            if verbose and (s // slab) % 5 == 0:
                print(f"  {y}: {s + len(chunk)}/{len(ids)} row groups, {rows:,} rows, {time.time() - t0:.0f}s", flush=True)
            if len(ph_year) >= 8:
                ph_year = [_recombine(ph_year, _plant_hour)]
                uy_year = [_recombine(uy_year, _unit_year)]
                cy_year = [_recombine(cy_year, _code_plant_year)]
        ph_parts.append(_recombine(ph_year, _plant_hour))
        uy_parts.append(_recombine(uy_year, _unit_year))
        cy_parts.append(_recombine(cy_year, _code_plant_year))
        code_counts[str(y)] = codes
        meta["rows_read"][str(y)] = rows
        meta["per_year"][str(y)] = {
            "rows": rows,
            "rows_missing_plant_id_eia": null_eia_rows,
            "co2_short_tons_missing_plant_id_eia": null_eia_co2,
            "rows_missing_co2": null_co2_rows,
            "datetime_utc_min": str(dmin),
            "datetime_utc_max": str(dmax),
        }
        if verbose:
            print(f"{y}: {rows:,} CEMS rows read in {time.time() - t0:.0f}s", flush=True)

    ph = _recombine(ph_parts, _plant_hour)
    uy = _recombine(uy_parts, _unit_year)
    cy = _recombine(cy_parts, _code_plant_year)
    pq.write_table(ph, PLANT_HOUR, compression="zstd")
    pq.write_table(uy, UNIT_YEAR, compression="zstd")
    pq.write_table(cy, CODE_PLANT_YEAR, compression="zstd")
    meta["co2_mass_measurement_code_counts"] = code_counts
    meta["plant_hour_rows"] = ph.num_rows
    meta["unit_year_rows"] = uy.num_rows
    meta["code_plant_year_rows"] = cy.num_rows
    meta["elapsed_s"] = round(time.time() - t0, 1)
    META.write_text(json.dumps(meta, indent=2, default=str))
    if verbose:
        print(f"wrote {PLANT_HOUR} ({ph.num_rows:,} rows) and {UNIT_YEAR} ({uy.num_rows:,} rows)")
    return meta


if __name__ == "__main__":
    fetch()
