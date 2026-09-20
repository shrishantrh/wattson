"""Loaders for the EIA-860 plant, generator and ownership tables in PUDL.

Every table this module touches is named in TABLES, and every load records the
row count, so a report can print its own provenance instead of asserting it.
Fetch them with:

    python3 scripts/vendor/pudl_fetch.py --output-dir data/pudl \
      --table core_eia860__scd_plants \
      --table core_eia860__scd_generators \
      --table core_eia860__scd_ownership \
      --table out_eia860__yearly_ownership \
      --table core_eia__entity_plants \
      --table core_eia__entity_generators \
      --table core_eia__entity_utilities

EIA-860 is an annual survey. Every fact here is a year-resolution fact: it can
say which balancing authority a plant belonged to in 2019, and it cannot say
what happened on a particular day in 2019.
"""

from __future__ import annotations

import pathlib

import pandas as pd

PUDL_DIR = pathlib.Path("data/pudl")

TABLES = {
    "core_eia860__scd_plants":
        "annual plant record: balancing authority code, operator utility, "
        "transmission and distribution owner",
    "core_eia860__scd_generators":
        "annual generator record: nameplate capacity, net summer and winter "
        "capacity, prime mover, fuel, operational status",
    "core_eia860__scd_ownership":
        "generator-level ownership: one row per owner per generator per year, "
        "with fraction_owned",
    "out_eia860__yearly_ownership":
        "the same ownership rows, denormalized with plant and owner names",
    "core_eia__entity_plants":
        "one row per plant that never changes: name, state, county, coordinates",
    "core_eia__entity_generators":
        "one row per generator that never changes: operating date",
    "core_eia__entity_utilities":
        "one row per utility that never changes: name",
    "core_eia930__hourly_net_generation_by_energy_source":
        "hourly generation by BA and fuel; already used by the rest of Wattson, "
        "read here only to cross-check reported MW against plant capacity",
}

_ROW_COUNTS: dict[str, int] = {}
_READ_NOTES: dict[str, str] = {}


class MissingTable(FileNotFoundError):
    """A PUDL table this release does not have on disk."""


def path(table: str) -> pathlib.Path:
    if table not in TABLES:
        raise KeyError(f"{table} is not declared in engine.plants.eia860.TABLES")
    return PUDL_DIR / f"{table}.parquet"


def load(table: str, note: str | None = None, **kwargs) -> pd.DataFrame:
    """Read a declared PUDL table and remember how many rows it had.

    `note` records that a read was a pushed-down subset, so the provenance
    block never prints a filtered row count as if it were the table size.
    """
    p = path(table)
    if not p.exists():
        raise MissingTable(
            f"{p} is not present. Fetch it with scripts/vendor/pudl_fetch.py "
            f"--table {table}"
        )
    df = pd.read_parquet(p, **kwargs)
    _ROW_COUNTS.setdefault(table, len(df))
    if note:
        _READ_NOTES.setdefault(table, note)
    if "report_date" in df.columns:
        df = df.assign(year=pd.to_datetime(df["report_date"]).dt.year)
    return df


def row_counts() -> dict[str, int]:
    """{table: rows read} for everything loaded so far, for the provenance block."""
    return dict(_ROW_COUNTS)


def read_notes() -> dict[str, str]:
    """{table: how the read was narrowed} for tables not read whole."""
    return dict(_READ_NOTES)


def eq(series: pd.Series, value) -> pd.Series:
    """Equality that survives pandas nullable dtypes.

    Several EIA-860 columns are nullable (balancing_authority_code_eia is NA for
    every plant-year before 2013), and `series == value` on those yields pd.NA,
    which raises the moment it is combined with & or used as a mask.
    """
    return series.eq(value).fillna(False).astype(bool)


def plant_name(plant_id: int) -> str:
    ep = load("core_eia__entity_plants")
    hit = ep.loc[ep["plant_id_eia"] == plant_id, "plant_name_eia"]
    return str(hit.iloc[0]) if len(hit) else f"plant {plant_id}"


def find_plants(name_substring: str, state: str | None = None) -> pd.DataFrame:
    """Plants whose EIA name contains a substring, case-insensitively."""
    ep = load("core_eia__entity_plants")
    m = ep["plant_name_eia"].str.contains(name_substring, case=False, na=False)
    if state:
        m &= eq(ep["state"], state)
    return ep.loc[m, ["plant_id_eia", "plant_name_eia", "city", "county",
                      "state", "latitude", "longitude", "timezone"]]
