"""Build measured-CO2 tables and print everything docs/EMISSIONS.md reports.

    python3 -m engine.emissions            # build + report
    python3 -m engine.emissions --report   # report only, reuse built tables

Fetching the CEMS slice is a separate, slower step:

    python3 -m engine.emissions.cems
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from engine.emissions import analyze, build

PROCESSED = Path("data/processed")
HERE = Path(__file__).resolve().parent
pd.set_option("display.width", 220)
pd.set_option("display.max_columns", 40)


def _load_built():
    ba = pd.read_csv(PROCESSED / "emissions_ba_window.csv")
    reg = pd.read_csv(PROCESSED / "emissions_region.csv")
    art = json.loads((HERE / "emissions.json").read_text())
    return ba, reg, art


def report(ba: pd.DataFrame, reg: pd.DataFrame, art: dict) -> dict:
    out: dict = {}

    print("=" * 100)
    print("1. WHAT WAS PULLED")
    print("=" * 100)
    m = art["cems_fetch"]
    print(f"table {m['source_table']}  release {m['release']}")
    print(f"file: {m['file_rows_total']:,} rows in {m['file_row_groups_total']:,} row groups; "
          f"read {sum(m['row_groups_read'].values())} row groups")
    for y, d in m["per_year"].items():
        print(f"  {y}: {d['rows']:,} unit-hours, {d['datetime_utc_min']} -> {d['datetime_utc_max']} UTC; "
              f"rows with no CO2 value (unit not running) {d['rows_missing_co2']:,}; "
              f"rows with no EIA plant id {d['rows_missing_plant_id_eia']:,}")
    print("  measurement codes:", json.dumps(m["co2_mass_measurement_code_counts"]))
    print("  plant-hour rows after aggregation:", f"{m['plant_hour_rows']:,}")
    print("\nplant -> balancing authority (EIA-860 out_eia__yearly_plants):")
    print(json.dumps(art["plant_attribution"], indent=2))
    print("\nlocal-time sensitivity (BA report_timezone vs plant's own timezone):")
    print(json.dumps(art["tz_sensitivity"], indent=2))

    print("\n" + "=" * 100)
    print("2. UNITS")
    print("=" * 100)
    print(json.dumps(art["units"], indent=2))

    print("\n" + "=" * 100)
    print("3. COVERAGE")
    print("=" * 100)
    cov = ba.groupby(["year", "window", "tier"]).size().unstack(fill_value=0)
    print(cov.to_string())
    for (y, w), g in ba.groupby(["year", "window"]):
        a = g[g.tier == "A"]
        tot_cov = a.cems_gross_mwh.sum() / a.fossil_mwh.sum() if a.fossil_mwh.sum() else np.nan
        print(f"  {y} {w}: tier A regions {len(a)}, pooled CEMS gross / EIA-930 net fossil = {tot_cov:.3f}")
    print("\ndropped (tier C):")
    c = ba[ba.tier == "C"][["ba", "year", "window", "coverage", "fossil_avg_mw", "co2_short_tons", "plants"]]
    print(c.sort_values(["ba", "year", "window"]).round(3).to_string(index=False) if len(c) else "  none")
    out["coverage_table"] = cov

    print("\n" + "=" * 100)
    print("4. CARBON INTENSITY BY REGION")
    print("=" * 100)
    cols = ["ba", "carbon_free_share", "co2_short_tons_per_hour", "intensity_short_tons_per_mwh",
            "intensity_kg_per_mwh", "total_generation_avg_mw", "fossil_avg_mw", "coverage", "tier"]
    for y in (2019, 2025):
        for w in ("overnight", "daytime"):
            q = analyze.published(ba, y, w)
            print(f"\n--- {y} {w}: {len(q)} published regions, dirtiest 10 ---")
            print(q[cols].head(10).round(3).to_string(index=False))
            print(f"--- {y} {w}: cleanest 8 ---")
            print(q[cols].tail(8).round(3).to_string(index=False))

    print("\nscale check, tier A regions pooled:")
    for y in (2019, 2025):
        for w in ("overnight", "daytime"):
            q = ba[(ba.year == y) & (ba.window == w) & (ba.tier == "A")]
            print(f"  {y} {w}: {len(q)} regions, {q.co2_short_tons.sum() / 1e6:,.1f}M short tons CO2, "
                  f"{q.total_generation_mwh.sum() / 1e6:,.1f}M MWh, pooled intensity "
                  f"{q.co2_short_tons.sum() / q.total_generation_mwh.sum():.3f} short tons/MWh "
                  f"({1000 * q.co2_short_tons.sum() * 0.90718474 / q.total_generation_mwh.sum():.0f} kg/MWh)")
    print(f"  regions whose intensity is a lower bound (coverage < 0.95): "
          f"{int(ba[ba.tier == 'A'].intensity_is_lower_bound.sum())} of {int((ba.tier == 'A').sum())} tier A cells")

    print("\n" + "=" * 100)
    print("5. DOES CARBON-FREE SHARE PREDICT MEASURED INTENSITY?")
    print("=" * 100)
    fits = {}
    for y in (2019, 2025):
        for w in ("overnight", "daytime"):
            for label, tiers in (("A+B", ("A", "B")), ("A only", ("A",))):
                q = analyze.published(ba, y, w, tiers=tiers)
                fits[f"{y} {w} [{label}]"] = analyze.proxy_fit(q)
    print(pd.DataFrame(fits).T.to_string())
    out["fits"] = fits

    # the same test as the detector sees it: all 111 regions, zones carrying their
    # parent BA's numbers, so large BAs are weighted by how many zones they contain
    for y, w in ((2025, "overnight"),):
        rq = reg[(reg.year == y) & (reg.window == w) & reg.tier.isin(["A", "B"])]
        rq = rq[np.isfinite(rq.carbon_free_share) & np.isfinite(rq.intensity_short_tons_per_mwh)]
        print(f"\nacross the {len(rq)} scored detector regions (zones inherit their BA), {y} {w}:")
        print(json.dumps(analyze.proxy_fit(rq)))

    q25 = analyze.published(ba, 2025, "overnight")
    res = analyze.residuals(q25)
    rcols = ["ba", "carbon_free_share", "intensity_short_tons_per_mwh", "predicted_intensity", "residual",
             "fleet_intensity_short_tons_per_mwh", "coal_share_of_fossil", "total_generation_avg_mw", "coverage"]
    print("\n2025 overnight, proxy flatters these most (measured intensity above the fit):")
    print(res[rcols].head(10).round(3).to_string(index=False))
    print("\n2025 overnight, proxy libels these most (measured intensity below the fit):")
    print(res[rcols].tail(8).round(3).to_string(index=False))
    out["residuals_2025_overnight"] = res

    print("\nimplied fleet intensity (CO2 per MWh of non-carbon-free generation), 2025 overnight:")
    ff = res[res.total_generation_avg_mw >= 1000].sort_values("fleet_intensity_short_tons_per_mwh", ascending=False)
    print(ff[["ba", "fleet_intensity_short_tons_per_mwh", "coal_share_of_fossil", "carbon_free_share",
              "intensity_short_tons_per_mwh"]].round(3).to_string(index=False))

    print("\nspread of measured intensity inside narrow carbon-free-share bands, 2025 overnight:")
    for lo, hi in [(0.0, 0.1), (0.1, 0.2), (0.2, 0.3), (0.3, 0.4), (0.4, 0.5), (0.5, 0.7)]:
        s = analyze.spread_within_band(q25, lo, hi)
        if s:
            print("  ", json.dumps(s))

    print("\nrank disagreement, 2025 overnight (negative gap = proxy ranks it cleaner than it measures):")
    rd = analyze.rank_disagreement(q25)
    print(rd[["ba", "carbon_free_share", "intensity_short_tons_per_mwh", "rank_by_proxy",
              "rank_by_measured", "rank_gap"]].head(8).round(3).to_string(index=False))
    print(rd[["ba", "carbon_free_share", "intensity_short_tons_per_mwh", "rank_by_proxy",
              "rank_by_measured", "rank_gap"]].tail(6).round(3).to_string(index=False))

    print("\n" + "=" * 100)
    print("5b. WHERE THE TWO DATASETS DISAGREE ABOUT THE DIRECTION OF FOSSIL OUTPUT")
    print("=" * 100)
    for w in ("daytime", "overnight"):
        con = analyze.contradictions(ba, window=w)
        if not len(con):
            continue
        print(f"\n--- {w}, {len(con)} regions tested, {int(con.opposite_signs.sum())} move in opposite directions ---")
        show = ["ba", "eia930_fossil_avg_mw_2019", "eia930_fossil_avg_mw_2025", "eia930_pct_change",
                "cems_pct_change", "gap_points", "coverage_2019", "coverage_2025",
                "cems_plants_2019", "cems_plants_2025", "opposite_signs"]
        print(con[show].head(8).round(2).to_string(index=False))
        out[f"contradictions_{w}"] = con
        con.to_csv(PROCESSED / f"emissions_contradictions_{w}.csv", index=False)

    print("\n" + "=" * 100)
    print("6. PJM RESTATED IN MEASURED CO2")
    print("=" * 100)
    pjm = analyze.pjm_restated(ba)
    print(pjm.round(3).to_string(index=False))
    o = pjm[pjm.window == "overnight"].set_index("year")
    if {2019, 2025} <= set(o.index):
        d19, d25 = o.loc[2019], o.loc[2025]
        dt = d25.co2_short_tons - d19.co2_short_tons
        print(f"\novernight CO2 2019 {d19.co2_short_tons:,.0f} short tons -> "
              f"2025 {d25.co2_short_tons:,.0f}; change {dt:+,.0f} short tons "
              f"({100 * dt / d19.co2_short_tons:+.1f}%), {dt * 0.90718474:+,.0f} tonnes")
        print(f"overnight intensity {d19.intensity_short_tons_per_mwh:.3f} -> "
              f"{d25.intensity_short_tons_per_mwh:.3f} short tons/MWh "
              f"({d19.intensity_kg_per_mwh:.0f} -> {d25.intensity_kg_per_mwh:.0f} kg/MWh)")
        print(f"overnight avg CO2 per hour {d19.co2_short_tons_per_hour:,.0f} -> {d25.co2_short_tons_per_hour:,.0f} short tons/h")
        print(f"fuel story cross-check: gas avg MW {d19.gas_avg_mw:,.0f} -> {d25.gas_avg_mw:,.0f} "
              f"({d25.gas_avg_mw - d19.gas_avg_mw:+,.0f}); coal {d19.coal_avg_mw:,.0f} -> {d25.coal_avg_mw:,.0f} "
              f"({d25.coal_avg_mw - d19.coal_avg_mw:+,.0f})")
    out["pjm"] = pjm

    print("\n" + "=" * 100)
    print("7. WHAT A DATACENTER SITE DRAWS AT 3AM")
    print("=" * 100)
    fac = pd.read_csv("claims/lookup/facilities.csv")
    fi = analyze.facilities_intensity(reg, fac, 2025, "overnight")
    print(f"sites: {len(fi)}; matched to a scored region: {fi.intensity_short_tons_per_mwh.notna().sum()}")
    byreg = (fi.dropna(subset=["intensity_short_tons_per_mwh"])
               .groupby(["region", "matched_at", "tier"], dropna=False)
               .agg(sites=("company", "size"),
                    companies=("company", lambda s: ",".join(sorted(set(s)))),
                    intensity=("intensity_short_tons_per_mwh", "first"),
                    kg_per_mwh=("intensity_kg_per_mwh", "first"),
                    cf_share=("carbon_free_share", "first"))
               .reset_index().sort_values("sites", ascending=False))
    print(byreg.round(3).to_string(index=False))
    out["facilities"] = fi
    fi.to_csv(PROCESSED / "emissions_facilities.csv", index=False)
    return out


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if "--report" in argv:
        ba, reg, art = _load_built()
    else:
        b = build.build()
        ba, reg, art = b["ba_window"], b["regions"], b["artifact"]
    report(ba, reg, art)


if __name__ == "__main__":
    main()
