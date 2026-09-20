"""Print the EIA-860 evidence pack for the Palo Verde inference.

    python3 -m engine.plants
    python3 -m engine.plants --json      # also -> engine/plants/evidence.json
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys

from engine.plants import eia860, palo_verde

OUT = pathlib.Path("engine/plants/evidence.json")


def rule(title):
    print(f"\n{title}\n" + "-" * len(title))


def fmt(x, nd=4):
    if isinstance(x, float):
        return f"{x:,.{nd}f}".rstrip("0").rstrip(".") if nd else f"{x:,.0f}"
    return "" if x is None else str(x)


def table(rows, cols, widths=None):
    if not rows:
        print("  (none)")
        return
    widths = widths or {}
    head = "  " + "  ".join(f"{c:<{widths.get(c, 14)}}" for c in cols)
    print(head)
    print("  " + "  ".join("-" * widths.get(c, 14) for c in cols))
    for r in rows:
        print("  " + "  ".join(f"{fmt(r.get(c)):<{widths.get(c, 14)}}" for c in cols))


def report(d):
    print("=" * 78)
    print("PALO VERDE / AZPS DOUBLE COUNT -- EIA-860 PLANT-LEVEL CHECK")
    print("=" * 78)
    print("\n" + d["question"])

    rule("Tables used")
    notes = d.get("read_notes", {})
    for t, rows in d["row_counts"].items():
        print(f"  {t:<58} {rows:>10,} rows")
        if t in notes:
            print(f"  {'':<58} {notes[t]}")

    rule("1. Identify the plant")
    table(d["identify"]["matches_nationwide"],
          ["plant_id_eia", "plant_name_eia", "city", "county", "state"],
          {"plant_name_eia": 20, "city": 14, "county": 12, "state": 5})
    print(f"\n  Arizona match: plant_id_eia = {d['plant_id_eia']}")

    cap = d["capacity"]
    rule(f"2. Capacity, {cap['year']} (core_eia860__scd_generators)")
    table(cap["generators"],
          ["generator_id", "capacity_mw", "summer_capacity_mw",
           "winter_capacity_mw", "energy_source_code_1", "ownership_code",
           "generator_operating_date"],
          {"generator_id": 12, "capacity_mw": 11, "summer_capacity_mw": 18,
           "winter_capacity_mw": 18, "energy_source_code_1": 20,
           "ownership_code": 14, "generator_operating_date": 24})
    print(f"\n  nameplate          {cap['nameplate_mw']:>10,.1f} MW")
    print(f"  net summer         {cap['net_summer_capacity_mw']:>10,.1f} MW")
    print(f"  net winter         {cap['net_winter_capacity_mw']:>10,.1f} MW")
    print(f"  we published       {cap['published_nameplate_mw']:>10,.1f} MW "
          f"as 'plant nameplate'")
    if not cap["published_figure_matches_nameplate"]:
        print(f"  >> MISLABELLED: our 3,937 MW is {cap['published_figure_is']}.")

    own = d["ownership"]
    rule(f"3. Ownership, {own.get('year')} "
         f"({own.get('source_table', 'out_eia860__yearly_ownership')})")
    if not own.get("available"):
        print("  " + own.get("why", "unavailable"))
    else:
        table(own["table"],
              ["owner_utility_id_eia", "owner_utility_name_eia", "owner_state",
               "fraction_owned"],
              {"owner_utility_id_eia": 20, "owner_utility_name_eia": 40,
               "owner_state": 11, "fraction_owned": 14})
        print(f"\n  shares sum to 1.0:            {own['fraction_sums_to_one']}")
        print(f"  identical across all 3 units: {own['identical_across_units']}")
        print(f"  operator:                     "
              f"{own['operator_utility_name_eia']} "
              f"(utility_id_eia {own['operator_utility_id_eia']})")
        print(f"  APS and SRP BOTH own it:      {own['aps_and_srp_both_own']} "
              f"(APS {own['aps_share']}, SRP {own['srp_share']})")
        print(f"  shares unchanged 2017-2025:   {own['shares_unchanged_2017_2025']}")

    ba = d["ba_attribution"]
    rule("4. Balancing authority attribution (core_eia860__scd_plants)")
    table([r for r in ba["by_year"] if 2016 <= r["year"] <= 2022],
          ["year", "balancing_authority_code_eia", "utility_id_eia",
           "transmission_distribution_owner_name", "data_maturity"],
          {"year": 6, "balancing_authority_code_eia": 28, "utility_id_eia": 15,
           "transmission_distribution_owner_name": 36, "data_maturity": 14})
    print(f"\n  distinct BA codes ever:      {ba['distinct_codes_ever']}")
    print(f"  first year with a BA code:   {ba['first_year_with_a_code']}")
    print(f"  code in 2019:                {ba['code_in_base_year']}")
    print(f"  changed around the step:     {ba['changed_around_step']}")
    print(f"  {ba['caveat']}")

    alt = d["alternatives"]
    rule(f"5. Alternatives: every AZ plant >= 400 MW nameplate, {alt['year']}")
    table(alt["az_plants_over_min_mw"],
          ["plant_id_eia", "plant_name_eia", "balancing_authority_code_eia",
           "nameplate_mw", "fuels"],
          {"plant_id_eia": 12, "plant_name_eia": 36,
           "balancing_authority_code_eia": 28, "nameplate_mw": 12, "fuels": 12})
    print(f"\n  nuclear plants in Arizona, any year: "
          f"{[p['plant_name_eia'] for p in alt['az_nuclear_plants_any_year']]}")
    print(f"  nuclear plant-years anywhere under AZPS: "
          f"{alt['nuclear_plant_years_under_azps']}")
    print(f"  nuclear plants under SRP: {alt['nuclear_plants_under_srp']}")
    print("  largest AZ carbon-free plants after Palo Verde:")
    table(alt["largest_az_carbon_free_after_palo_verde"],
          ["plant_id_eia", "plant_name_eia", "nameplate_mw", "fuels",
           "balancing_authority_code_eia"],
          {"plant_id_eia": 12, "plant_name_eia": 30, "nameplate_mw": 12,
           "fuels": 8, "balancing_authority_code_eia": 28})
    print("  largest carbon-free plants EIA-860 does put under AZPS:")
    table(alt["largest_azps_carbon_free"],
          ["plant_id_eia", "plant_name_eia", "nameplate_mw", "fuels"],
          {"plant_id_eia": 12, "plant_name_eia": 34, "nameplate_mw": 12,
           "fuels": 8})

    x = d["eia930_cross_check"]
    rule("6. EIA-930 reported MW against EIA-860 capacity")
    if not x.get("available"):
        print("  skipped: " + x.get("why", ""))
    else:
        print(f"  hours AZPS and SRP both reported nuclear in 2019: "
              f"{x['hours_both_reported']:,}")
        print(f"  correlation {x['correlation']}, within 5 MW in "
              f"{x['share_within_5mw']:.1%} of hours")
        print(f"  AZPS mean {x['azps_mean_mw']:,.0f} MW   "
              f"SRP mean {x['srp_mean_mw']:,.0f} MW")
        print(f"  combined mean before the step: {x['combined_mean_before_mw']:,.0f} MW"
              f"  = {x['combined_over_nameplate']:.2f} x nameplate")
        print(f"  combined mean after the step:  {x['combined_mean_after_mw']:,.0f} MW"
              f"  = {x['after_over_nameplate']:.2f} x nameplate")
        print(f"  peak combined hour:            {x['peak_combined_hour_mw']:,.0f} MW"
              f"  = {x['peak_combined_over_nameplate']:.2f} x nameplate")
        print(f"  each BA reported the WHOLE plant, not its share: "
              f"{x['each_ba_reported_whole_plant']}")
        print(f"    APS 29.10% of nameplate = {x['aps_share_of_nameplate_mw']:,.0f} MW, "
              f"SRP 17.49% = {x['srp_share_of_nameplate_mw']:,.0f} MW, "
              f"yet each reported ~{x['azps_mean_mw']:,.0f} MW.")

    v = d["verdict"]
    rule("VERDICT")
    print(f"  {v['verdict'].upper()}")
    decisive = set(v["supporting"]) | set(v["failed"])
    print("\n  clauses of the inference (these decide the verdict):")
    for k in v["checks"]:
        if k in decisive:
            print(f"    [{'x' if v['checks'][k] else ' '}] {k}")
    print("\n  separately checked, not clauses of the inference:")
    for k in v["checks"]:
        if k not in decisive:
            print(f"    [{'x' if v['checks'][k] else ' '}] {k}")
    print("\n  not available in EIA-860:")
    for u in v["unavailable_in_eia860"]:
        print(f"    - {u}")
    print("\n  what corrections.json should now say:")
    for c in v["corrections_to_our_published_text"]:
        print(f"    field:       {c['field']}")
        print(f"    published:   {c['published']}")
        print(f"    should say:  {c['should_say']}")
        print(f"    why:         {c['why']}\n")


def main(argv=None):
    ap = argparse.ArgumentParser(prog="python3 -m engine.plants")
    ap.add_argument("--json", action="store_true",
                    help=f"also write {OUT}")
    args = ap.parse_args(argv)
    try:
        d = palo_verde.run()
    except eia860.MissingTable as exc:
        sys.exit(f"error: {exc}")
    report(d)
    if args.json:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(d, indent=2, default=str))
        print(f"\nwrote {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
