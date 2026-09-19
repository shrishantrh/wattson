"""Export dashboard JSON from the L1-L4 outputs.

Writes to dashboard/public/data/:
  regions.json            {"meta": {...}, "regions": [ ...one object per region... ]}
  heatmaps/<BA>.json      365 x 24 carbon-free share for 2025, local time, per BA
and to claims/:
  companies.mock.json     illustrative Meta card with REAL grid evidence numbers
and copies claims/*.json into dashboard/public/claims/ for the static site.

A zone (PJM/DOM etc.) inherits its parent BA's generation numbers and is flagged
cf_inherited_from_ba = true. Nulls are values that do not exist for that region.
"""
import json
import shutil
from datetime import date
from pathlib import Path
import numpy as np
import pandas as pd

PROCESSED = Path("data/processed")
OUT = Path("dashboard/public/data")
HM = OUT / "heatmaps"
CLAIMS = Path("claims")
YEARS = list(range(2019, 2027))
FUELS = ["nuclear", "hydro", "wind", "solar", "geothermal", "gas", "coal", "oil", "other"]

DATA_FLAGS = {
    "WACM": "Demand rose about 1.5 GW during 2022 while generation stayed near 4 GW and net exports fell from 1.5 GW to zero, "
            "with no change in interchange partners. Not explained by the data; could be a reporting or footprint change. "
            "Kept in the ranking (method frozen), excluded from alerts.",
}


def r(x, nd=3):
    if x is None:
        return None
    try:
        if pd.isna(x):
            return None
    except (TypeError, ValueError):
        pass
    return round(float(x), nd)


def main():
    OUT.mkdir(parents=True, exist_ok=True); HM.mkdir(exist_ok=True); CLAIMS.mkdir(exist_ok=True)
    codes = pd.read_parquet("data/pudl/core_eia__codes_balancing_authorities.parquet").set_index("code")
    subs = pd.read_parquet("data/pudl/core_eia__codes_balancing_authority_subregions.parquet")
    zone_names = {(a, b): c for a, b, c in subs.itertuples(index=False)}
    l2 = pd.read_csv(PROCESSED / "l2_cf_by_period.csv")
    t12 = pd.read_csv(PROCESSED / "l2_trailing12.csv")
    prof = pd.read_csv(PROCESSED / "cf_by_local_hour.csv")
    ry = pd.read_csv(PROCESSED / "l3_region_year.csv")
    det = pd.read_csv(PROCESSED / "l3_detector.csv").set_index("region")
    det26 = pd.read_csv(PROCESSED / "l3_detector_2026_jan_aug.csv").set_index("region")
    fuel = pd.read_csv(PROCESSED / "l4_overnight_fuel_by_ba_year.csv")
    sit = pd.read_csv(PROCESSED / "l4_siting.csv").set_index("ba")
    ops = pd.read_parquet("data/pudl/out_eia930__hourly_operations.parquet", columns=["datetime_utc", "balancing_authority_code_eia", "interchange_adjusted_mwh"])
    operators = json.loads(Path("scripts/operators_manual.json").read_text())

    # overnight net export by BA and year (positive = export), local time
    ops = ops.dropna().merge(codes[["report_timezone"]], left_on="balancing_authority_code_eia", right_index=True, how="inner")
    parts = []
    for tzname, g in ops.groupby("report_timezone", observed=True):
        local = g.datetime_utc.dt.tz_localize("UTC").dt.tz_convert(tzname)
        parts.append(g.assign(year=local.dt.year, night=local.dt.hour < 6))
    ops = pd.concat(parts)
    ix_night = ops[ops.night].groupby(["balancing_authority_code_eia", "year"]).interchange_adjusted_mwh.mean()
    ix_all = ops.groupby(["balancing_authority_code_eia", "year"]).interchange_adjusted_mwh.mean()

    cal = l2[l2.window == "calendar"]
    ba_cf = {ba: g for ba, g in cal.groupby("ba")}

    def cf_block(ba):
        g = ba_cf.get(ba)
        if g is None:
            return None, None, None
        share, mw, tot = {}, {}, {}
        for y in YEARS:
            gy = g[g.year == y].set_index("period")
            if gy.empty:
                continue
            share[str(y)] = {p: r(gy.cf_share.get(p)) for p in ["overnight", "daytime", "all"]}
            mw[str(y)] = {p: r(gy.cf_avg_mw.get(p), 0) for p in ["overnight", "daytime", "all"]}
            tot[str(y)] = {p: r(gy.total_avg_mw.get(p), 0) for p in ["overnight", "daytime", "all"]}
        return share, mw, tot

    def trailing(ba):
        g = t12[t12.ba == ba]
        if g.empty:
            return None
        o = g[g.period == "overnight"].set_index("month"); d = g[g.period == "daytime"].set_index("month")
        months = sorted(set(o.index) & set(d.index))
        return {"month": months,
                "overnight_share": [r(o.cf_share[m]) for m in months], "daytime_share": [r(d.cf_share[m]) for m in months],
                "overnight_clean_mw": [r(o.cf_avg_mw[m], 0) for m in months], "overnight_total_mw": [r(o.total_avg_mw[m], 0) for m in months]}

    def profile(ba):
        g = prof[prof.ba == ba]
        out = {}
        for y in [2019, 2025]:
            gy = g[g.year == y].set_index("local_hour").carbon_free_share
            out[str(y)] = [r(gy.get(h)) for h in range(24)]
        return out if g.size else None

    def fuel_block(ba):
        g = fuel[fuel.ba == ba]
        if g.empty:
            return None, None
        p = g.pivot(index="year", columns="fuel", values="avg_mw")
        by_year = {str(y): {f: r(p.at[y, f], 0) if f in p.columns and y in p.index else None for f in FUELS} for y in YEARS if y in p.index}
        delta = None
        if 2019 in p.index and 2025 in p.index:
            delta = {f: r((p.at[2025, f] - p.at[2019, f]) / 1000, 2) if f in p.columns else None for f in FUELS}
        return by_year, delta

    def demand_block(region):
        g = ry[(ry.region == region) & (ry.window == "calendar")].set_index("year")
        out = {}
        for y in YEARS:
            if y in g.index:
                row = g.loc[y]
                out[str(y)] = {"avg_mw": r(row.avg_mw, 0), "overnight_avg_mw": r(row.overnight_avg_mw, 0), "peak_mw": r(row.peak_mw, 0),
                               "p995_mw": r(row.p995_mw, 0), "load_factor": r(row.load_factor), "hours": int(row.hours)}
        return out or None

    def detection_block(region):
        if region not in det.index:
            return None
        d = det.loc[region]
        d26 = det26.loc[region] if region in det26.index else None
        return {"growth_pct": r(d.growth_pct, 1), "overnight_growth_pct": r(d.overnight_growth_pct, 1), "overnight_excess": r(d.overnight_excess, 1),
                "load_factor_delta": r(d.load_factor_delta), "load_factor_max_delta": r(d.load_factor_max_delta), "neighbor_divergence": r(d.neighbor_divergence, 1),
                "score": r(d.score, 2), "rank": int(d["rank"]), "n_scored": int(len(det)), "pattern": d.pattern,
                "avg_mw_2019": r(d.avg_mw_base, 0), "avg_mw_2025": r(d.avg_mw_target, 0),
                "rank_2026_jan_aug": int(d26["rank"]) if d26 is not None else None, "score_2026_jan_aug": r(d26.score, 2) if d26 is not None else None}

    def siting_block(ba):
        if ba not in sit.index:
            return None
        s = sit.loc[ba]
        return {"overnight_cf_share_2025": r(s.overnight_cf_share_2025), "change_since_2019": r(s.change_since_2019),
                "overnight_clean_mw_over_demand": r(s.overnight_clean_mw_over_demand), "ratio_2019": r(s.ratio_2019),
                "ratio_slope_per_year": r(s.ratio_slope_per_year, 4), "siting_score": r(s.siting_score), "siting_rank": None if pd.isna(s.siting_rank) else int(s.siting_rank),
                "n_ranked": int(sit.siting_score.notna().sum())}

    def interchange_block(ba):
        out = {}
        for y in YEARS:
            if (ba, y) in ix_all.index:
                out[str(y)] = {"overnight_net_export_mw": r(ix_night.get((ba, y)), 0), "all_hours_net_export_mw": r(ix_all.get((ba, y)), 0)}
        return out or None

    regions_ids = list(det.index) + [b for b in sit.index if b not in det.index and b in ba_cf]
    regions = []
    for rid in regions_ids:
        ba, zone = (rid.split("/") + [None])[:2]
        share, mw, tot = cf_block(ba)
        fuel_by_year, fuel_delta = fuel_block(ba)
        name = zone_names.get((ba, zone), zone) if zone else codes.description.get(ba, ba)
        flags = []
        if zone:
            flags.append("Generation numbers are the parent BA's (zones report demand only).")
        if ba in DATA_FLAGS:
            flags.append(DATA_FLAGS[ba])
        regions.append({
            "id": rid, "ba": ba, "zone": zone, "type": "zone" if zone else "ba",
            "name": name, "ba_name": codes.description.get(ba, ba), "region_eia": codes.balancing_authority_region_name_eia.get(ba),
            "timezone": codes.report_timezone.get(ba),
            "cf_inherited_from_ba": bool(zone),
            "cf_share": share, "cf_avg_mw": mw, "total_avg_mw": tot,
            "trailing12": trailing(ba), "profile_24h": profile(ba),
            "demand": demand_block(rid),
            "detection": detection_block(rid),
            "fuel_delta_overnight_gw": fuel_delta, "overnight_fuel_mw": fuel_by_year,
            "siting": siting_block(ba),
            "interchange": interchange_block(ba) if not zone else None,
            "operators": operators.get(rid, []),
            "data_flags": flags,
            "exclude_from_alerts": ba in DATA_FLAGS,
            "heatmap_uri": f"data/heatmaps/{ba}.json" if ba in ba_cf else None,
        })

    meta = {
        "generated": date.today().isoformat(), "data_snapshot_end": "2026-09-05", "baseline_year": 2019,
        "headline": "PJM overnight clean generation has been flat within 100 MW since 2019 while overnight generation rose 8.7 GW and exports fell.",
        "overnight_hours_local": "00:00-05:59", "daytime_hours_local": "10:00-15:59",
        "detector": {"n_scored": int(len(det)), "method": "score = z(overnight_excess) + z(neighbor_divergence) + 0.5 z(load_factor_delta), robust z; 500 MW cut; p99.5 peak; frozen before results",
                     "validation_named_in_advance": ["PJM/DOM", "PJM/AEP", "SWPP/OPPD", "ERCO/NCEN"]},
        "pattern_labels": {"flat-load growth": "growth >= 10% and overnight excess > 0",
                           "possible midday solar suppression": "growth < 5% and overnight excess >= 5 points",
                           "mixed": "everything else"},
        "caveats": ["Generation within a footprint, not consumption; interchange not allocated.",
                    "Average grid mix, not marginal emissions.", "Regions are coarse; PJM spans Chicago to New Jersey.",
                    "Zones inherit the parent BA's generation figures.", "Operator table is hand-mapped.",
                    "Detector flags flat 24/7 load in general (datacenters, crypto mining, oilfield electrification); language is 'consistent with'."],
        "data_flags": DATA_FLAGS,
    }
    (OUT / "regions.json").write_text(json.dumps({"meta": meta, "regions": regions}, indent=None))
    print(f"regions.json: {len(regions)} regions ({sum(1 for x in regions if x['type']=='zone')} zones)")

    # heatmaps, 2025 local time
    idx = pd.read_parquet(PROCESSED / "hourly_cf_index.parquet", columns=["datetime_utc", "ba", "carbon_free_share"])
    idx = idx[(idx.datetime_utc >= "2024-12-31") & (idx.datetime_utc < "2026-01-02")]
    idx = idx.merge(codes[["report_timezone"]], left_on="ba", right_index=True, how="inner")
    n = 0
    for tzname, g in idx.groupby("report_timezone", observed=True):
        local = g.datetime_utc.dt.tz_localize("UTC").dt.tz_convert(tzname)
        g = g.assign(day=local.dt.strftime("%Y-%m-%d"), hour=local.dt.hour)
        g = g[g.day.str.startswith("2025")]
        for ba, gb in g.groupby("ba"):
            p = gb.pivot_table(index="day", columns="hour", values="carbon_free_share", aggfunc="mean").reindex(columns=range(24))
            days = pd.date_range("2025-01-01", "2025-12-31").strftime("%Y-%m-%d")
            p = p.reindex(days)
            z = [[r(v) for v in row] for row in p.values.tolist()]
            (HM / f"{ba}.json").write_text(json.dumps({"ba": ba, "year": 2025, "timezone": tzname, "days": list(days), "hours": list(range(24)), "cf_share": z}))
            n += 1
    print(f"heatmaps: {n}")

    # mock company card: illustrative claims, real grid evidence
    def cf_all(ba, y):
        g = cal[(cal.ba == ba) & (cal.year == y) & (cal.period == "all")]
        return r(g.cf_share.iloc[0]) if len(g) else None
    sites = [("Prineville, OR", "PACW", None, "Pacific Power"), ("Altoona, IA", "MISO", None, "MidAmerican Energy"),
             ("Newton County, GA", "SOCO", None, "Georgia Power / Walton EMC"), ("Gallatin, TN", "TVA", None, "Gallatin Dept. of Electricity (TVA)")]
    ev = [{"type": "grid", "ba": b, "year": 2024, "cf_share": cf_all(b, 2024)} for _, b, _, _ in sites]
    vals = [e["cf_share"] for e in ev if e["cf_share"] is not None]
    mock = [{
        "_mock": True, "company": "Meta Platforms", "ticker": "META",
        "sites": [{"metro": m, "ba": b, "pjm_zone": z, "serving_utility": u, "source_type": "inferred", "source_url": None} for m, b, z, u in sites],
        "claims": [
            {"claim_id": "META-MOCK-001", "verbatim": "[MOCK] We matched 100% of the electricity use of our data centers and offices with renewable energy.",
             "source_doc": "MOCK sustainability report", "page": None, "year": 2024, "metric": "renewable_electricity_share", "magnitude": 1.0, "unit": "fraction",
             "timeframe": "2024", "scope": "market_based", "falsifiability": 0.9, "greenwash_patterns": ["hidden_tradeoff"], "verdict": "true_on_paper",
             "physical_min": min(vals), "physical_max": max(vals), "physical_mean_unweighted": r(sum(vals) / len(vals)), "confidence": "high",
             "evidence": ev + [{"type": "note", "note": "MOCK claim text. Grid evidence values are real L1 outputs (calendar 2024, all hours, grid-only)."}]},
            {"claim_id": "META-MOCK-002", "verbatim": "[MOCK] We are committed to a sustainable future for our data centers.",
             "source_doc": "MOCK sustainability report", "page": None, "year": 2024, "metric": None, "magnitude": None, "unit": None,
             "timeframe": None, "scope": None, "falsifiability": 0.1, "greenwash_patterns": ["vague_wording"], "verdict": "unfalsifiable",
             "physical_min": None, "physical_max": None, "physical_mean_unweighted": None, "confidence": "high", "evidence": []},
            {"claim_id": "META-MOCK-003", "verbatim": "[MOCK] Our new campus will be supported by 500 MW of new solar in the region.",
             "source_doc": "MOCK press release", "page": None, "year": 2025, "metric": "contracted_capacity_mw", "magnitude": 500, "unit": "MW",
             "timeframe": "2025-2027", "scope": "contracted", "falsifiability": 0.7, "greenwash_patterns": [], "verdict": "cannot_verify",
             "physical_min": None, "physical_max": None, "physical_mean_unweighted": None, "confidence": "low",
             "evidence": [{"type": "note", "note": "cannot_verify: PPA deliveries are not in EIA-930; grid-only method cannot see contracted power."}]},
        ],
        "talk_score": 0.8, "walk_score": r(sum(vals) / len(vals)), "coverage": 0.67, "unverifiable_share": 0.33,
        "notes": ["MOCK DATA: claim text and scores are illustrative placeholders until claims/companies.json lands.",
                  "grid-only, excludes PPAs", "unweighted across sites, no capacity data", "facility mapping is hand-curated"],
    }]
    (CLAIMS / "companies.mock.json").write_text(json.dumps(mock, indent=2))
    dash_claims = Path("dashboard/public/claims"); dash_claims.mkdir(parents=True, exist_ok=True)
    for f in CLAIMS.glob("*.json"):
        shutil.copy(f, dash_claims / f.name)
    print("claims copied:", sorted(p.name for p in dash_claims.glob("*.json")))


if __name__ == "__main__":
    main()
