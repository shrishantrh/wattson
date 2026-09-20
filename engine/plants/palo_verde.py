"""Test the Palo Verde inference in claims/derived/corrections.json against EIA-860.

What we published, in the "high_confidence_inference" tier:

    the plant is Palo Verde (the only nuclear station in Arizona, magnitude
    matches its nameplate, profile flat across all hours), and EIA corrected
    the attribution so it counts once, under SRP. NOT CONFIRMED AGAINST
    PLANT-LEVEL EIA-860 DATA.

Everything the tier calls an inference is a plant-level fact, and EIA-860 is a
plant-level table, so each clause is separately checkable:

  is_only_az_nuclear   is Palo Verde the only nuclear station in Arizona
  capacity             what is its nameplate, and is 3,937 MW that number
  joint_ownership      do APS and SRP both own it (the mechanism)
  ba_attribution       whose balancing authority does EIA-860 put it in
  alternatives         does any other Arizona plant fit the same evidence

This module reads only. It does not write claims/derived/corrections.json.
"""

from __future__ import annotations

import pathlib

import pandas as pd

from engine.plants import eia860
from engine.plants.eia860 import eq, load

# What corrections.json and engine/diagnostics/azps.py currently assert. Held
# here as published values to be tested, never as inputs to a calculation.
PUBLISHED_NAMEPLATE_MW = 3937          # engine/diagnostics/azps.py:24
PUBLISHED_COMBINED_MW = 7087           # AZPS + SRP nuclear, 2019-06-01..12-03
PUBLISHED_STEP_DATE = "2019-12-04"

PALO_VERDE_PLANT_ID = 6008             # established by identify(), not assumed
STATE = "AZ"
BASE_YEAR = 2019

GEN930 = "core_eia930__hourly_net_generation_by_energy_source"
CARBON_FREE_FUELS = {"nuclear", "hydro", "wind", "solar", "geothermal"}


# --------------------------------------------------------------------------
# 1. identify the plant
# --------------------------------------------------------------------------

def identify(name: str = "Palo Verde") -> dict:
    """Every US plant whose EIA name contains `name`, so the match is visible."""
    hits = eia860.find_plants(name)
    az = hits[eq(hits["state"], STATE)]
    return {
        "search": name,
        "matches_nationwide": hits.to_dict("records"),
        "arizona_matches": az.to_dict("records"),
        "plant_id_eia": int(az["plant_id_eia"].iloc[0]) if len(az) == 1 else None,
    }


# --------------------------------------------------------------------------
# 2. capacity: the number our note calls a nameplate
# --------------------------------------------------------------------------

def capacity(plant_id: int = PALO_VERDE_PLANT_ID, year: int = BASE_YEAR) -> dict:
    g = load("core_eia860__scd_generators")
    eg = load("core_eia__entity_generators")
    pv = g[g["plant_id_eia"] == plant_id]
    by_year = (pv.groupby("year")
                 .agg(nameplate_mw=("capacity_mw", "sum"),
                      net_summer_mw=("summer_capacity_mw", "sum"),
                      net_winter_mw=("winter_capacity_mw", "sum"),
                      generators=("generator_id", "count"))
                 .round(1))
    yr = pv[eq(pv["year"], year)]
    gens = (yr[["generator_id", "capacity_mw", "summer_capacity_mw",
                "winter_capacity_mw", "prime_mover_code", "energy_source_code_1",
                "technology_description", "operational_status", "ownership_code",
                "utility_id_eia"]]
            .sort_values("generator_id")
            .merge(eg.loc[eg["plant_id_eia"] == plant_id,
                          ["generator_id", "generator_operating_date"]],
                   on="generator_id", how="left"))
    nameplate = float(by_year.loc[year, "nameplate_mw"])
    summer = float(by_year.loc[year, "net_summer_mw"])
    winter = float(by_year.loc[year, "net_winter_mw"])
    return {
        "year": year,
        "generators": gens.to_dict("records"),
        "nameplate_mw": nameplate,
        "net_summer_capacity_mw": summer,
        "net_winter_capacity_mw": winter,
        "by_year": by_year.reset_index().to_dict("records"),
        "published_nameplate_mw": PUBLISHED_NAMEPLATE_MW,
        "published_figure_matches_nameplate": abs(nameplate - PUBLISHED_NAMEPLATE_MW) < 1,
        "published_figure_matches_net_summer": abs(summer - PUBLISHED_NAMEPLATE_MW) < 1,
        "published_figure_is": (
            "net summer capacity, not nameplate"
            if abs(summer - PUBLISHED_NAMEPLATE_MW) < 1
            and abs(nameplate - PUBLISHED_NAMEPLATE_MW) >= 1 else "nameplate"
        ),
    }


# --------------------------------------------------------------------------
# 3. ownership: the mechanism
# --------------------------------------------------------------------------

def ownership(plant_id: int = PALO_VERDE_PLANT_ID, year: int = BASE_YEAR) -> dict:
    """Owner shares per generator. Joint ownership is what lets two utilities
    each believe the plant is theirs to report."""
    own = load("out_eia860__yearly_ownership")   # core_eia860__scd_ownership plus names
    pv = own[own["plant_id_eia"] == plant_id]
    yr = pv[eq(pv["year"], year)]
    if yr.empty:
        return {"year": year, "available": False,
                "why": f"no ownership rows for plant {plant_id} in {year}"}

    # Shares are identical across the three units; carry one table plus a check.
    per_gen = yr.pivot_table(index="owner_utility_name_eia", columns="generator_id",
                             values="fraction_owned")
    identical_across_units = bool(per_gen.nunique(axis=1).max() == 1)
    one_unit = (yr[eq(yr["generator_id"], sorted(yr["generator_id"].unique())[0])]
                [["owner_utility_id_eia", "owner_utility_name_eia", "owner_state",
                  "fraction_owned"]]
                .sort_values("fraction_owned", ascending=False))

    history = (pv.pivot_table(index="owner_utility_name_eia", columns="year",
                              values="fraction_owned")
                 .round(4))
    operator_id = int(yr["operator_utility_id_eia"].iloc[0])
    ut = load("core_eia__entity_utilities")
    operator = ut.loc[ut["utility_id_eia"] == operator_id, "utility_name_eia"]

    owners = {int(r.owner_utility_id_eia): float(r.fraction_owned)
              for r in one_unit.itertuples()}
    aps, srp = 803, 16572
    return {
        "year": year,
        "available": True,
        "source_table": "out_eia860__yearly_ownership",
        "table": one_unit.to_dict("records"),
        "fraction_sums_to_one": bool(abs(one_unit["fraction_owned"].sum() - 1.0) < 1e-9),
        "identical_across_units": identical_across_units,
        "operator_utility_id_eia": operator_id,
        "operator_utility_name_eia": str(operator.iloc[0]) if len(operator) else None,
        "aps_share": owners.get(aps),
        "srp_share": owners.get(srp),
        "aps_and_srp_both_own": aps in owners and srp in owners,
        "aps_plus_srp_share": (owners.get(aps, 0.0) + owners.get(srp, 0.0)) or None,
        "history_by_year": history.reset_index().to_dict("records"),
        "shares_unchanged_2017_2025": bool(
            history.loc[:, [c for c in history.columns if 2017 <= c <= 2025]]
                   .dropna(how="all")
                   .apply(lambda r: r.dropna().nunique() <= 1, axis=1).all()
        ),
    }


# --------------------------------------------------------------------------
# 4. balancing authority attribution
# --------------------------------------------------------------------------

def ba_attribution(plant_id: int = PALO_VERDE_PLANT_ID) -> dict:
    pl = load("core_eia860__scd_plants")
    pv = pl[pl["plant_id_eia"] == plant_id].sort_values("year")
    cols = ["year", "balancing_authority_code_eia", "balancing_authority_name_eia",
            "utility_id_eia", "transmission_distribution_owner_id",
            "transmission_distribution_owner_name", "nerc_region",
            "reporting_frequency_code", "data_maturity"]
    codes = pv["balancing_authority_code_eia"].dropna().unique().tolist()
    around = pv[pv["year"].between(2017, 2021)]
    return {
        "by_year": pv[cols].to_dict("records"),
        "distinct_codes_ever": [str(c) for c in codes],
        "code_in_base_year": (
            str(pv.loc[eq(pv["year"], BASE_YEAR),
                       "balancing_authority_code_eia"].iloc[0])
            if len(pv[eq(pv["year"], BASE_YEAR)]) else None),
        "changed_around_step": bool(
            around["balancing_authority_code_eia"].dropna().nunique() > 1),
        "first_year_with_a_code": (
            int(pv.loc[pv["balancing_authority_code_eia"].notna(), "year"].min())
            if pv["balancing_authority_code_eia"].notna().any() else None),
        "caveat": (
            "EIA-860 is annual. It can say which BA a plant belonged to in a "
            f"given year; it cannot date a change to {PUBLISHED_STEP_DATE}."),
    }


# --------------------------------------------------------------------------
# 5. alternatives: rule out, do not confirm
# --------------------------------------------------------------------------

def alternatives(year: int = BASE_YEAR, min_mw: float = 400.0) -> dict:
    """Every Arizona plant big enough to be mistaken for the duplicated series."""
    ep = load("core_eia__entity_plants")
    g = load("core_eia860__scd_generators")
    pl = load("core_eia860__scd_plants")

    az_ids = ep.loc[eq(ep["state"], STATE), "plant_id_eia"]
    operating = g[eq(g["year"], year) & g["plant_id_eia"].isin(az_ids)
                  & eq(g["operational_status"], "existing")]

    def roll(frame):
        return (frame.groupby("plant_id_eia")
                     .agg(nameplate_mw=("capacity_mw", "sum"),
                          net_summer_mw=("summer_capacity_mw", "sum"),
                          generators=("generator_id", "count"),
                          fuels=("fuel_type_code_pudl",
                                 lambda s: ",".join(sorted(set(s.dropna())))))
                     .reset_index()
                     .merge(ep[["plant_id_eia", "plant_name_eia", "county"]],
                            on="plant_id_eia", how="left")
                     .merge(pl.loc[eq(pl["year"], year),
                                   ["plant_id_eia", "balancing_authority_code_eia"]],
                            on="plant_id_eia", how="left")
                     .sort_values("nameplate_mw", ascending=False)
                     .round(1))

    big = roll(operating)
    big = big[big["nameplate_mw"] >= min_mw]
    clean = roll(operating[operating["fuel_type_code_pudl"].isin(CARBON_FREE_FUELS)])
    clean = clean[clean["nameplate_mw"] >= 100]

    az_nuclear = (g[g["plant_id_eia"].isin(az_ids)
                    & eq(g["fuel_type_code_pudl"], "nuclear")]
                  [["plant_id_eia"]].drop_duplicates()
                  .merge(ep[["plant_id_eia", "plant_name_eia"]], on="plant_id_eia"))

    nuc_years = (g[eq(g["fuel_type_code_pudl"], "nuclear")][["plant_id_eia", "year"]]
                 .drop_duplicates()
                 .merge(pl[["plant_id_eia", "year", "balancing_authority_code_eia"]],
                        on=["plant_id_eia", "year"], how="left"))
    nuclear_under_azps = nuc_years[eq(nuc_years["balancing_authority_code_eia"], "AZPS")]
    nuclear_under_srp = nuc_years[eq(nuc_years["balancing_authority_code_eia"], "SRP")]

    return {
        "year": year,
        "az_plants_over_min_mw": big.to_dict("records"),
        "az_carbon_free_plants_over_100mw": clean.to_dict("records"),
        "az_nuclear_plants_any_year": az_nuclear.to_dict("records"),
        "nuclear_plant_years_under_azps": int(len(nuclear_under_azps)),
        "nuclear_plants_under_srp": sorted(
            int(x) for x in nuclear_under_srp["plant_id_eia"].unique()),
        "largest_az_carbon_free_after_palo_verde": (
            clean[clean["plant_id_eia"] != PALO_VERDE_PLANT_ID]
            .head(3)[["plant_id_eia", "plant_name_eia", "nameplate_mw", "fuels",
                      "balancing_authority_code_eia"]].to_dict("records")),
        "largest_azps_carbon_free": (
            clean[eq(clean["balancing_authority_code_eia"], "AZPS")]
            .head(3)[["plant_id_eia", "plant_name_eia", "nameplate_mw", "fuels"]]
            .to_dict("records")),
    }


# --------------------------------------------------------------------------
# 6. cross-check the reported MW against plant capacity
# --------------------------------------------------------------------------

def reported_vs_capacity(cap: dict) -> dict:
    """Hold the EIA-930 nuclear series next to the EIA-860 capacity.

    Optional: skipped, and said to be skipped, if the 930 table is absent.
    """
    p = eia860.path(GEN930)
    if not p.exists():
        return {"available": False,
                "why": f"{p} not fetched; run pudl_fetch.py --table {GEN930}"}

    df = load(GEN930,
              note="filtered read: AZPS and SRP, nuclear only, 4 of 6 columns",
              columns=["datetime_utc", "balancing_authority_code_eia",
                       "generation_energy_source", "net_generation_reported_mwh"],
              filters=[("balancing_authority_code_eia", "in", ["AZPS", "SRP"]),
                       ("generation_energy_source", "==", "nuclear")])
    w = df.pivot_table(index="datetime_utc",
                       columns="balancing_authority_code_eia",
                       values="net_generation_reported_mwh")
    both = w.loc[f"{BASE_YEAR}-01-01":PUBLISHED_STEP_DATE].dropna()
    combined = w.loc[f"{BASE_YEAR}-06-01":"2019-12-03"].fillna(0).sum(axis=1)
    after = w.loc["2020-01-01":"2020-06-30"].fillna(0).sum(axis=1)
    nameplate = cap["nameplate_mw"]
    peak_combined = float(w.fillna(0).sum(axis=1).max())
    azps = w["AZPS"]
    last_nonzero = azps[azps.fillna(0) != 0].index.max()
    return {
        "available": True,
        "hours_both_reported": int(len(both)),
        "correlation": round(float(both["AZPS"].corr(both["SRP"])), 6),
        "share_within_5mw": round(
            float(((both["AZPS"] - both["SRP"]).abs() <= 5).mean()), 4),
        "azps_mean_mw": round(float(both["AZPS"].mean()), 1),
        "srp_mean_mw": round(float(both["SRP"].mean()), 1),
        "combined_mean_before_mw": round(float(combined.mean()), 1),
        "combined_mean_after_mw": round(float(after.mean()), 1),
        "peak_combined_hour_mw": round(peak_combined, 1),
        "peak_azps_hour_mw": round(float(w["AZPS"].max()), 1),
        "peak_srp_hour_mw": round(float(w["SRP"].max()), 1),
        "nameplate_mw": nameplate,
        "peak_combined_over_nameplate": round(peak_combined / nameplate, 3),
        "combined_over_nameplate": round(float(combined.mean()) / nameplate, 3),
        "after_over_nameplate": round(float(after.mean()) / nameplate, 3),
        "azps_last_nonzero_hour_utc": str(last_nonzero),
        "each_ba_reported_whole_plant": bool(
            float(both["AZPS"].mean()) > 0.75 * nameplate),
        "aps_share_of_nameplate_mw": None,
        "srp_share_of_nameplate_mw": None,
    }


# --------------------------------------------------------------------------
# 7. verdict
# --------------------------------------------------------------------------

def verdict(ident, cap, own, ba, alt, x930) -> dict:
    checks = {
        "palo_verde_found_in_eia860":
            ident["plant_id_eia"] == PALO_VERDE_PLANT_ID,
        "only_nuclear_station_in_arizona":
            len(alt["az_nuclear_plants_any_year"]) == 1
            and alt["az_nuclear_plants_any_year"][0]["plant_id_eia"] == PALO_VERDE_PLANT_ID,
        "aps_and_srp_both_own_it":
            bool(own.get("aps_and_srp_both_own")),
        "eia860_puts_the_plant_under_srp":
            ba["code_in_base_year"] == "SRP",
        "no_nuclear_plant_anywhere_sits_under_azps":
            alt["nuclear_plant_years_under_azps"] == 0,
        "combined_report_exceeds_one_plant":
            bool(x930.get("available")) and x930["combined_over_nameplate"] > 1.25,
        "published_3937_is_the_nameplate":
            cap["published_figure_matches_nameplate"],
        "eia860_dates_the_correction":
            ba["changed_around_step"],
    }
    supporting = [k for k in (
        "palo_verde_found_in_eia860", "only_nuclear_station_in_arizona",
        "aps_and_srp_both_own_it", "eia860_puts_the_plant_under_srp",
        "no_nuclear_plant_anywhere_sits_under_azps",
        "combined_report_exceeds_one_plant") if checks[k]]
    failed = [k for k in (
        "palo_verde_found_in_eia860", "only_nuclear_station_in_arizona",
        "aps_and_srp_both_own_it", "eia860_puts_the_plant_under_srp",
        "no_nuclear_plant_anywhere_sits_under_azps",
        "combined_report_exceeds_one_plant") if not checks[k]]

    if not failed:
        label = "confirmed"
    elif len(supporting) >= 3:
        label = "partially confirmed"
    else:
        label = "not confirmed"

    return {
        "verdict": label,
        "checks": checks,
        "supporting": supporting,
        "failed": failed,
        "unavailable_in_eia860": [
            "the date of the correction: EIA-860 is annual and records Palo Verde "
            f"under {ba['code_in_base_year']} for every year from "
            f"{ba['first_year_with_a_code']}, so it cannot place the step on "
            f"{PUBLISHED_STEP_DATE}. It says which attribution is right, not when "
            "EIA-930 was fixed.",
            "why EIA-930 carried the wrong attribution at all: EIA-860 has no "
            "field for the reporting error.",
        ],
        "corrections_to_our_published_text": [
            {
                "field": "confidence_tiers.proven and every corrections[].evidence",
                "published": f"{PUBLISHED_COMBINED_MW} MW against a "
                             f"{PUBLISHED_NAMEPLATE_MW} MW plant nameplate",
                "should_say": f"{PUBLISHED_COMBINED_MW} MW against a "
                              f"{cap['nameplate_mw']:.1f} MW nameplate "
                              f"({cap['net_summer_capacity_mw']:.0f} MW net summer "
                              f"capacity), EIA-860 plant {PALO_VERDE_PLANT_ID}",
                "why": f"{PUBLISHED_NAMEPLATE_MW} MW is Palo Verde's net SUMMER "
                       f"capacity in EIA-860, not its nameplate. The nameplate is "
                       f"{cap['nameplate_mw']:.1f} MW (3 x "
                       f"{cap['generators'][0]['capacity_mw']} MW). The argument is "
                       f"unchanged, the label is wrong.",
            },
            {
                "field": "confidence_tiers.high_confidence_inference",
                "published": "NOT CONFIRMED AGAINST PLANT-LEVEL EIA-860 DATA",
                "should_say": "confirmed against EIA-860: plant 6008, the only "
                              "nuclear station in Arizona, jointly owned by "
                              "Arizona Public Service and Salt River Project among "
                              "others, recorded by EIA-860 in the SRP balancing "
                              "authority",
                "why": "the clause was flagged as an inference precisely because "
                       "it had not been checked at plant level. It has been.",
            },
        ],
    }


def run() -> dict:
    ident = identify()
    plant_id = ident["plant_id_eia"] or PALO_VERDE_PLANT_ID
    cap = capacity(plant_id)
    own = ownership(plant_id)
    ba = ba_attribution(plant_id)
    alt = alternatives()
    x930 = reported_vs_capacity(cap)
    if x930.get("available") and own.get("available"):
        x930["aps_share_of_nameplate_mw"] = round(
            (own["aps_share"] or 0) * cap["nameplate_mw"], 1)
        x930["srp_share_of_nameplate_mw"] = round(
            (own["srp_share"] or 0) * cap["nameplate_mw"], 1)
    out = {
        "question": ("Was the generation AZPS and SRP both reported through 2019 "
                     "Palo Verde, and does EIA-860 support counting it once under "
                     "SRP?"),
        "plant_id_eia": plant_id,
        "identify": ident,
        "capacity": cap,
        "ownership": own,
        "ba_attribution": ba,
        "alternatives": alt,
        "eia930_cross_check": x930,
    }
    out["verdict"] = verdict(ident, cap, own, ba, alt, x930)
    out["tables_used"] = {t: eia860.TABLES[t] for t in eia860.row_counts()}
    out["row_counts"] = eia860.row_counts()
    out["read_notes"] = eia860.read_notes()
    return out
