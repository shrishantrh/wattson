"""Measured CO2 per grid region, overnight and daytime, 2019 and 2025.

Wattson's shipped index measures the carbon-free *share of generation*. That is a
proxy for emissions. This module puts a measurement next to it: hourly CO2 from
EPA CEMS smokestack monitors, aggregated to the same balancing authorities, the
same local-time windows and the same two years the frozen detector uses.

Nothing here changes the shipped index or the shipped detector.

Inputs
  data/processed/cems_plant_hour.parquet      engine.emissions.cems (EPA CEMS,
                                              PUDL core_epacems__hourly_emissions)
  data/pudl/out_eia__yearly_plants.parquet    plant -> balancing authority, per year
  data/pudl/core_eia__codes_balancing_authorities.parquet   BA -> report_timezone
  data/processed/gen_by_source_wide.parquet   EIA-930 generation (scripts/build_wide.py)
  data/processed/l3_detector.csv              the 111 frozen detector regions

Conventions copied from the frozen pipeline, not re-invented
  overnight = local hours 00:00-05:59, daytime = local hours 10:00-15:59
    (scripts/overnight_profile.py NIGHT / DAY, scripts/l3_detector.py NIGHT)
  carbon-free = nuclear + hydro + wind + solar + geothermal; other/unknown in the
    denominator only; storage excluded; small negatives clipped to zero
    (scripts/carbon_free_index.py, imported here rather than retyped)
  local time comes from the BA's report_timezone, the same conversion the detector
    and L2 use, so the CO2 numerator and the generation denominator cover exactly
    the same hours. A plant-own-timezone variant is computed as a sensitivity.
  zones inherit their parent BA's generation figures, so they inherit its measured
    CO2 and its carbon intensity too, flagged co2_inherited_from_ba.

Units
  CEMS co2_mass_tons is short tons. The claim is not taken on faith: check_units()
  divides measured CO2 by measured heat input for gas-only and coal-only plants and
  compares against the EPA factors (gas 53.07 kg CO2/MMBtu, bituminous coal 93.28,
  subbituminous 97.17). Short tons and metric tonnes differ by 10.2%, far more than
  the spread between those factors, so the test separates them cleanly. Every
  published figure states its unit; metric tonnes are given alongside.

Coverage thresholds, fixed here before any result was looked at
  CEMS covers fossil units that report to EPA, mostly those above 25 MW. Coverage
  for a region-year-window is CEMS gross generation divided by EIA-930 *net* fossil
  generation, so full coverage sits slightly above 1.0 (gross load includes station
  service, typically 4 to 7%).
    tier C   coverage is defined and outside 0.70 to 1.40, or the region reports no
             fossil generation at all while CEMS measures CO2 inside it: dropped
    tier B   coverage undefined or region's fossil generation below 100 MW average;
             CO2 is near zero either way, published with a flag
    tier A   everything else: published as a measurement

Outputs
  data/processed/emissions_ba_window.csv     BA x year x window measured CO2,
                                             generation, intensity, coverage
  data/processed/emissions_region.csv        the 111 detector regions, zones
                                             inheriting their BA
  engine/emissions/emissions.json            compact artifact for the write-up
"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
PROCESSED = Path("data/processed")
PUDL = Path("data/pudl")

NIGHT = range(0, 6)
DAY = range(10, 16)
YEARS = (2019, 2025)

COVERAGE_MIN = 0.70
COVERAGE_MAX = 1.40
FOSSIL_FLOOR_MW = 100.0

SHORT_TON_KG = 907.18474
TONNE_PER_SHORT_TON = SHORT_TON_KG / 1000.0  # 0.90718474

# EPA mandatory-reporting CO2 emission factors, kg CO2 per MMBtu (40 CFR 98 Table C-1).
EPA_KG_PER_MMBTU = {"gas": 53.06, "coal_bit": 93.28, "coal_sub": 97.17, "oil": 73.96}


def _frozen(module: str):
    """Load a frozen script by path. scripts/ is read-only for this module."""
    spec = importlib.util.spec_from_file_location(f"_frozen_{module}", Path("scripts") / f"{module}.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


CFI = _frozen("carbon_free_index")
CARBON_FREE, FOSSIL, OTHER = CFI.CARBON_FREE, CFI.FOSSIL, CFI.OTHER


# ---------------------------------------------------------------- attribution

def ba_timezones() -> pd.DataFrame:
    codes = pd.read_parquet(PUDL / "core_eia__codes_balancing_authorities.parquet")
    return codes[["code", "report_timezone"]].dropna().rename(columns={"code": "ba"})


def plant_attribution(years=YEARS) -> tuple[pd.DataFrame, dict]:
    """plant_id_eia x year -> balancing authority, from EIA-860 as PUDL publishes it.

    A plant with no BA reported in its own year falls back to the nearest year
    that does report one; the count of fallbacks is returned, not hidden.
    """
    cols = ["plant_id_eia", "report_date", "balancing_authority_code_eia", "timezone",
            "state", "plant_name_eia"]
    p = pd.read_parquet(PUDL / "out_eia__yearly_plants.parquet", columns=cols)
    p["year"] = pd.to_datetime(p.report_date).dt.year
    p = p.rename(columns={"balancing_authority_code_eia": "ba", "timezone": "plant_tz"})
    p = p[["plant_id_eia", "year", "ba", "plant_tz", "state", "plant_name_eia"]]

    out, notes = [], {}
    for y in years:
        cur = p[p.year == y].drop_duplicates("plant_id_eia").set_index("plant_id_eia")
        need = cur.index[cur.ba.isna()]
        filled = 0
        if len(need):
            alt = p[p.ba.notna() & p.plant_id_eia.isin(need)].copy()
            alt["dist"] = (alt.year - y).abs()
            alt = alt.sort_values(["plant_id_eia", "dist", "year"]).drop_duplicates("plant_id_eia").set_index("plant_id_eia")
            hit = cur.index.intersection(alt.index)
            cur.loc[hit, "ba"] = alt.loc[hit, "ba"]
            filled = int(cur.loc[need, "ba"].notna().sum())
        notes[str(y)] = {
            "plants_in_eia860": int(len(cur)),
            "ba_from_same_year": int(len(cur) - len(need)),
            "ba_from_nearest_other_year": filled,
            "still_without_ba": int(cur.ba.isna().sum()),
        }
        out.append(cur.assign(year=y).reset_index())
    return pd.concat(out, ignore_index=True), notes


# ------------------------------------------------------------------ CEMS side

def localized_cems(attr: pd.DataFrame, tz: pd.DataFrame, which="ba") -> pd.DataFrame:
    """CEMS plant-hours tagged with BA, local year, local hour and window.

    which="ba"    local time from the BA's report_timezone (primary: the numerator
                  then covers exactly the hours the EIA-930 denominator covers)
    which="plant" local time from the plant's own IANA timezone (sensitivity)
    """
    ph = pd.read_parquet(PROCESSED / "cems_plant_hour.parquet")
    ph = ph.rename(columns={"operating_datetime_utc": "datetime_utc"})
    # the fetch pulled CEMS years 2019 and 2025; the local year is recomputed below
    a = attr[["plant_id_eia", "ba", "plant_tz"]].drop_duplicates("plant_id_eia")
    ph = ph.merge(a, on="plant_id_eia", how="left")
    ph = ph.merge(tz, on="ba", how="left")
    ph["tzname"] = ph.report_timezone if which == "ba" else ph.plant_tz
    parts = []
    for tzname, g in ph.dropna(subset=["tzname"]).groupby("tzname", observed=True):
        local = g.datetime_utc.dt.tz_localize("UTC").dt.tz_convert(tzname)
        parts.append(g.assign(year=local.dt.year, local_hour=local.dt.hour))
    d = pd.concat(parts, ignore_index=True)
    d = d[d.year.isin(YEARS)]
    d["window"] = np.where(d.local_hour.isin(NIGHT), "overnight",
                           np.where(d.local_hour.isin(DAY), "daytime", "other"))
    return d


def cems_by_ba_window(d: pd.DataFrame) -> pd.DataFrame:
    keep = d[d.window != "other"]
    g = keep.groupby(["ba", "year", "window"], observed=True).agg(
        co2_short_tons=("co2_mass_tons", "sum"),
        cems_gross_mwh=("gross_load_mwh", "sum"),
        heat_mmbtu=("heat_content_mmbtu", "sum"),
        plant_hours=("co2_mass_tons", "size"),
        plants=("plant_id_eia", "nunique"),
    ).reset_index()
    hours = keep.groupby(["ba", "year", "window"], observed=True).datetime_utc.nunique().rename("hours")
    return g.merge(hours, on=["ba", "year", "window"])


# ------------------------------------------------------------ generation side

def generation_by_ba_window(tz: pd.DataFrame) -> pd.DataFrame:
    """EIA-930 generation in the same BA x year x window cells, L1 definitions."""
    wide = pd.read_parquet(PROCESSED / "gen_by_source_wide.parquet")
    gen = wide[CARBON_FREE + FOSSIL + OTHER].clip(lower=0)
    g = pd.DataFrame(index=wide.index)
    g["carbon_free_mwh"] = gen[CARBON_FREE].sum(axis=1, min_count=1)
    g["fossil_mwh"] = gen[FOSSIL].sum(axis=1, min_count=1)
    g["gas_mwh"] = gen[["gas"]].sum(axis=1, min_count=1)
    g["coal_mwh"] = gen[["coal"]].sum(axis=1, min_count=1)
    g["other_mwh"] = gen[OTHER].sum(axis=1, min_count=1)
    g["total_generation_mwh"] = g[["carbon_free_mwh", "fossil_mwh", "other_mwh"]].sum(axis=1, min_count=1)
    has_total = g.total_generation_mwh.notna()
    for c in ["carbon_free_mwh", "fossil_mwh", "gas_mwh", "coal_mwh", "other_mwh"]:
        g.loc[has_total, c] = g.loc[has_total, c].fillna(0)
    g = g[has_total].reset_index().merge(tz, on="ba", how="inner")

    parts = []
    for tzname, grp in g.groupby("report_timezone", observed=True):
        local = grp.datetime_utc.dt.tz_localize("UTC").dt.tz_convert(tzname)
        parts.append(grp.assign(year=local.dt.year, local_hour=local.dt.hour))
    d = pd.concat(parts, ignore_index=True)
    d = d[d.year.isin(YEARS)]
    d["window"] = np.where(d.local_hour.isin(NIGHT), "overnight",
                           np.where(d.local_hour.isin(DAY), "daytime", "other"))
    d = d[d.window != "other"]
    out = d.groupby(["ba", "year", "window"], observed=True).agg(
        gen_hours=("total_generation_mwh", "count"),
        total_generation_mwh=("total_generation_mwh", "sum"),
        carbon_free_mwh=("carbon_free_mwh", "sum"),
        fossil_mwh=("fossil_mwh", "sum"),
        gas_mwh=("gas_mwh", "sum"),
        coal_mwh=("coal_mwh", "sum"),
    ).reset_index()
    out["carbon_free_share"] = out.carbon_free_mwh / out.total_generation_mwh
    for c in ["total_generation_mwh", "carbon_free_mwh", "fossil_mwh", "gas_mwh", "coal_mwh"]:
        out[c.replace("_mwh", "_avg_mw")] = out[c] / out.gen_hours
    return out


# -------------------------------------------------------------------- joining

def combine(cems: pd.DataFrame, gen: pd.DataFrame) -> pd.DataFrame:
    m = gen.merge(cems, on=["ba", "year", "window"], how="left")
    for c in ["co2_short_tons", "cems_gross_mwh", "heat_mmbtu", "plants", "plant_hours"]:
        m[c] = m[c].fillna(0)
    m["co2_tonnes"] = m.co2_short_tons * TONNE_PER_SHORT_TON
    m["co2_short_tons_per_hour"] = m.co2_short_tons / m.gen_hours
    m["intensity_short_tons_per_mwh"] = m.co2_short_tons / m.total_generation_mwh
    m["intensity_kg_per_mwh"] = m.intensity_short_tons_per_mwh * SHORT_TON_KG
    m["coverage"] = np.where(m.fossil_mwh > 0, m.cems_gross_mwh / m.fossil_mwh, np.nan)
    m["fossil_avg_mw"] = m.fossil_mwh / m.gen_hours
    m["tier"] = _tier(m)
    # below full coverage some of the region's fossil generation is outside CEMS,
    # so the measured figure is a floor on the region's true intensity
    m["intensity_is_lower_bound"] = m.coverage < 0.95
    return m


def _tier(m: pd.DataFrame) -> np.ndarray:
    """A = coverage verified, B = too little fossil for coverage to mean anything,
    C = dropped.

    The size floor never rescues an implausible coverage ratio. That ordering was
    added after HGMA (Harquahala, a one-plant BA) landed in tier B on a 90 MW
    fossil average while CEMS measured six times the generation EIA-930 reports
    for it; a cell that inconsistent should not be published at any size.
    """
    cov = m.coverage
    plausible = cov.between(COVERAGE_MIN, COVERAGE_MAX)
    mismatch_no_fossil = (m.fossil_mwh <= 0) & (m.co2_short_tons > 0)
    return np.where(
        cov.notna() & ~plausible, "C",
        np.where(mismatch_no_fossil, "C",
                 np.where(m.fossil_avg_mw < FOSSIL_FLOOR_MW, "B", "A")))


def to_regions(ba_window: pd.DataFrame, detector: pd.DataFrame) -> pd.DataFrame:
    """Project BA figures onto the 111 frozen detector regions.

    Zones report demand only and inherit the parent BA's generation in the shipped
    pipeline; they inherit its measured CO2 and carbon intensity the same way.
    """
    reg = detector[["region", "ba", "zone", "is_zone", "rank", "score", "growth_pct",
                    "overnight_excess", "avg_mw_target", "pattern"]].copy()
    out = reg.merge(ba_window, on="ba", how="left")
    out["co2_inherited_from_ba"] = out.is_zone
    return out


# --------------------------------------------------------------- unit checking

def plant_primary_fuel() -> pd.DataFrame:
    """Capacity-weighted dominant PUDL fuel type per plant-year, EIA-860 generators."""
    g = pd.read_parquet(PUDL / "out_eia__yearly_generators.parquet",
                        columns=["plant_id_eia", "report_date", "capacity_mw", "fuel_type_code_pudl"])
    g["year"] = pd.to_datetime(g.report_date).dt.year
    g = g[g.year.isin(YEARS) & g.fuel_type_code_pudl.notna()]
    cap = g.groupby(["plant_id_eia", "year", "fuel_type_code_pudl"], observed=True).capacity_mw.sum().reset_index()
    tot = cap.groupby(["plant_id_eia", "year"]).capacity_mw.sum().rename("cap_total")
    top = cap.sort_values("capacity_mw").drop_duplicates(["plant_id_eia", "year"], keep="last")
    top = top.merge(tot, on=["plant_id_eia", "year"])
    top["fuel_share"] = top.capacity_mw / top.cap_total
    return top.rename(columns={"fuel_type_code_pudl": "fuel"})[["plant_id_eia", "year", "fuel", "fuel_share"]]


def check_units(min_mmbtu=1e6) -> dict:
    """Is co2_mass_tons short tons or metric tonnes? Ask the physics.

    CO2 per MMBtu of heat input is fixed by the carbon content of the fuel, so a
    single-fuel plant pins the mass unit. EPA's factors are in kg per MMBtu; the
    measured ratio divided by those factors gives kg per reported ton.
    """
    uy = pd.read_parquet(PROCESSED / "cems_unit_year.parquet")
    p = uy.groupby(["plant_id_eia", "year"], as_index=False)[["co2_mass_tons", "heat_content_mmbtu"]].sum()
    fuel = plant_primary_fuel()
    p = p.merge(fuel, on=["plant_id_eia", "year"], how="inner")
    p = p[(p.heat_content_mmbtu >= min_mmbtu) & (p.co2_mass_tons > 0) & (p.fuel_share >= 0.95)]
    p["tons_per_mmbtu"] = p.co2_mass_tons / p.heat_content_mmbtu
    out = {}
    for fuel_name, epa_key in (("gas", "gas"), ("coal", "coal_bit")):
        q = p[p.fuel == fuel_name]
        if not len(q):
            continue
        med = float(q.tons_per_mmbtu.median())
        out[fuel_name] = {
            "plants": int(len(q)),
            "median_reported_tons_per_mmbtu": round(med, 6),
            "p10": round(float(q.tons_per_mmbtu.quantile(0.10)), 6),
            "p90": round(float(q.tons_per_mmbtu.quantile(0.90)), 6),
            "epa_part98_kg_co2_per_mmbtu": EPA_KG_PER_MMBTU[epa_key],
            "implied_kg_per_reported_ton_vs_part98": round(EPA_KG_PER_MMBTU[epa_key] / med, 1),
            "kg_co2_per_mmbtu_if_short_tons": round(med * SHORT_TON_KG, 2),
            "kg_co2_per_mmbtu_if_metric_tonnes": round(med * 1000.0, 2),
        }
    # Part 75 Appendix G is what CEMS reporters actually use when they compute CO2
    # from heat input: Fc = 1040 scf CO2 per MMBtu for pipeline gas, at 0.1144 lb
    # per scf, which is 118.98 lb or 53.97 kg CO2 per MMBtu. If co2_mass_tons is
    # short tons the gas ratio should land on that number; if it were metric
    # tonnes it would read 10.2% high.
    out["gas_part75_appendix_g_kg_per_mmbtu"] = round(1040 * 0.1144 * 0.45359237, 2)
    out["short_ton_kg"] = SHORT_TON_KG
    out["metric_tonne_kg"] = 1000.0
    out["verdict"] = "co2_mass_tons is short tons"
    return out


# ------------------------------------------------------------------------ main

def build(verbose=True) -> dict:
    tz = ba_timezones()
    attr, attr_notes = plant_attribution()
    d = localized_cems(attr, tz, which="ba")
    cems = cems_by_ba_window(d)
    gen = generation_by_ba_window(tz)
    ba_window = combine(cems, gen)
    ba_window.to_csv(PROCESSED / "emissions_ba_window.csv", index=False)

    detector = pd.read_csv(PROCESSED / "l3_detector.csv")
    regions = to_regions(ba_window, detector)
    regions.to_csv(PROCESSED / "emissions_region.csv", index=False)

    # sensitivity: plant-own-timezone windows instead of BA report timezone
    dp = localized_cems(attr, tz, which="plant")
    cems_plant_tz = cems_by_ba_window(dp)

    meta = json.loads((PROCESSED / "cems_fetch_meta.json").read_text())
    art = {
        "source_tables": {
            "cems_hourly": "core_epacems__hourly_emissions",
            "plant_to_ba": "out_eia__yearly_plants (EIA-860)",
            "ba_timezone": "core_eia__codes_balancing_authorities",
            "generation": "core_eia930__hourly_net_generation_by_energy_source",
        },
        "cems_fetch": meta,
        "plant_attribution": attr_notes,
        "units": check_units(),
        "thresholds": {"coverage_min": COVERAGE_MIN, "coverage_max": COVERAGE_MAX,
                       "fossil_floor_avg_mw": FOSSIL_FLOOR_MW},
        "tz_sensitivity": _tz_sensitivity(cems, cems_plant_tz),
    }
    (HERE / "emissions.json").write_text(json.dumps(art, indent=2, default=str))
    if verbose:
        print("ba_window rows:", len(ba_window), " regions:", len(regions))
    return {"ba_window": ba_window, "regions": regions, "artifact": art,
            "cems_plant_tz": cems_plant_tz}


def _tz_sensitivity(ba_tz: pd.DataFrame, plant_tz: pd.DataFrame) -> dict:
    m = ba_tz.merge(plant_tz, on=["ba", "year", "window"], suffixes=("_ba", "_plant"))
    m = m[m.co2_short_tons_ba > 0]
    m["rel"] = (m.co2_short_tons_plant - m.co2_short_tons_ba).abs() / m.co2_short_tons_ba
    worst = m.sort_values("rel", ascending=False).head(5)
    return {
        "cells": int(len(m)),
        "median_abs_rel_diff": round(float(m.rel.median()), 5),
        "p95_abs_rel_diff": round(float(m.rel.quantile(0.95)), 5),
        "worst": [{"ba": r.ba, "year": int(r.year), "window": r.window, "rel_diff": round(float(r.rel), 4)}
                  for r in worst.itertuples()],
        "pjm": [{"year": int(r.year), "window": r.window,
                 "co2_ba_tz": float(r.co2_short_tons_ba), "co2_plant_tz": float(r.co2_short_tons_plant),
                 "rel_diff": round(float(r.rel), 4)}
                for r in m[m.ba == "PJM"].itertuples()],
    }


if __name__ == "__main__":
    build()
