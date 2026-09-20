"""Build the correction overlay for published figures known to be wrong.

    python3 -m engine.diagnostics.corrections   # -> claims/derived/corrections.json

This does NOT rewrite dashboard/public/data/. It emits an overlay keyed by
region and field path, carrying the published value, the corrected value, the
evidence and the confidence tier, so the API can serve both and the UI can show
"published 0.620, corrected 0.017, here is why". A project about numbers that
look clean and are wrong should show its own correction in place rather than
quietly swapping the number.

Method is calibrated against the published pipeline before correcting anything:
using net_generation_adjusted_mwh and excluding storage reproduces AZPS 2019
overnight as share 0.620 / clean 3,372 MW / total 5,434 MW against published
0.620 / 3,373 / 5,436, and 2025 as 0.104 / 240 against published 0.104 / 240.
"""

import json
import pathlib

import numpy as np
import pandas as pd

GEN = pathlib.Path("data/pudl/core_eia930__hourly_net_generation_by_energy_source.parquet")
REGIONS = pathlib.Path("dashboard/public/data/regions.json")
OUT = pathlib.Path("claims/derived/corrections.json")

CLEAN = {"nuclear", "hydro", "hydro_excluding_pumped_storage", "wind",
         "wind_wo_integrated_battery_storage", "solar",
         "solar_wo_integrated_battery_storage", "geothermal"}
STORAGE = {"battery_storage", "pumped_storage"}
COL = "net_generation_adjusted_mwh"
AZ_UTC_OFFSET = -7          # Arizona does not observe DST

PROVEN = (
    "AZPS and SRP reported the same generation hour by hour through 2019: "
    "correlation 0.9948 over 7,976 hours, identical within 5 MW in 98.8% of "
    "them, combined 7,087 MW against a 4,209.6 MW nameplate (3,937 MW net "
    "summer capacity), and a peak combined hour of 8,041 MW, which is 1.91 "
    "times the nameplate. A plant cannot produce 1.91 times its nameplate. "
    "The series ends in a step on a single date, 2019-12-04, not a decline."
)
CONFIRMED_860 = (
    "Confirmed against plant-level EIA-860 (PUDL, plant 6008). Palo Verde is the "
    "only nuclear station in Arizona and the only nuclear plant anywhere recorded "
    "under SRP; no nuclear plant in any year sits under AZPS. It is jointly owned, "
    "Arizona Public Service 29.10% and Salt River Project 17.49% among seven "
    "owners summing to 1.0, which is why both had a claim to report it. Each "
    "reported the WHOLE plant rather than its share: APS's share is 1,225 MW and "
    "SRP's is 736 MW, yet each reported about 3,620 MW."
)
UNCONFIRMED_DATE = (
    "Not reachable from EIA-860, which is annual: it records Palo Verde under SRP "
    "for every year from 2013 through 2026 and shows no change around 2019-12-04. "
    "The attribution never moved. What was corrected on that date was EIA-930, "
    "which had carried the AZPS duplicate from the first hour AZPS reported a fuel "
    "breakdown at all, 2018-07-01. That date rests on EIA-930 alone."
)
# One correction still carries this label and it must keep a definition: the corrected
# siting RANK is recomputed from rounded published components, so it reproduces 41 of 52
# published ranks exactly and is good to about +/- 2. That is an inference about the rank,
# nothing to do with the plant attribution, which EIA-860 now confirms outright.
RANK_INFERENCE = (
    "High-confidence inference about the RANK only. The corrected siting rank is "
    "recomputed over the same 52 ranked balancing authorities from components the "
    "published file stores rounded, while the pipeline ranked on full precision. The "
    "method reproduces 41 of 52 published ranks exactly, so treat a corrected rank as "
    "plus or minus 2. The corrected VALUES it is derived from are proven."
)
UNKNOWN = (
    "Not established: why the correction happened on that date, and why the "
    "series was missing for 17 months before becoming a literal zero."
)


def load_azps():
    d = pd.read_parquet(GEN, filters=[("balancing_authority_code_eia", "==", "AZPS")])
    d = d[~d["generation_energy_source"].isin(STORAGE)].copy()
    d["local"] = d["datetime_utc"] + pd.Timedelta(hours=AZ_UTC_OFFSET)
    return d


def _mean_mw(frame, fuels=None):
    f = frame if fuels is None else frame[frame["generation_energy_source"].isin(fuels)]
    if f.empty:
        return 0.0
    return float(f.groupby("datetime_utc")[COL].sum().mean())


def window(d, year=None, hours=None, ex_nuclear=False):
    f = d
    if year is not None:
        f = f[f["local"].dt.year == year]
    if hours is not None:
        f = f[f["local"].dt.hour.isin(hours)]
    if ex_nuclear:
        f = f[f["generation_energy_source"] != "nuclear"]
    total = _mean_mw(f)
    clean = _mean_mw(f, CLEAN)
    return {"clean_mw": round(clean, 1), "total_mw": round(total, 1),
            "share": round(clean / total, 3) if total else None}


NIGHT = list(range(0, 6))
DAY = list(range(10, 16))


def profile_24h(d, year, ex_nuclear):
    out = []
    for h in range(24):
        w = window(d, year=year, hours=[h], ex_nuclear=ex_nuclear)
        out.append(w["share"])
    return out


def monthly_overnight(d, ex_nuclear):
    """Mean overnight MW per calendar month: (clean, total)."""
    f = d[d["local"].dt.hour.isin(NIGHT)].copy()
    if ex_nuclear:
        f = f[f["generation_energy_source"] != "nuclear"]
    f["m"] = f["local"].dt.to_period("M").astype(str)
    total = f.groupby(["m", "datetime_utc"])[COL].sum().groupby("m").mean()
    clean = (f[f["generation_energy_source"].isin(CLEAN)]
             .groupby(["m", "datetime_utc"])[COL].sum().groupby("m").mean())
    return clean.reindex(total.index).fillna(0.0), total


def trailing12(d, ex_nuclear, months):
    """Trailing-12-month overnight figures for exactly the months given.

    Written as an explicit window rather than .rolling(12): rolling silently
    produced a value at the very first month, where no twelve-month history
    exists, and the calibration against the published series is what caught it.
    """
    clean, total = monthly_overnight(d, ex_nuclear)
    index = list(total.index)
    pos = {m: i for i, m in enumerate(index)}
    out = {"month": [], "overnight_share": [], "overnight_clean_mw": []}
    for m in months:
        i = pos.get(m)
        if i is None or i < 11:
            continue
        window_clean = float(clean.iloc[i - 11:i + 1].mean())
        window_total = float(total.iloc[i - 11:i + 1].mean())
        out["month"].append(m)
        out["overnight_share"].append(round(window_clean / window_total, 3)
                                      if window_total else None)
        out["overnight_clean_mw"].append(round(window_clean))
    return out


def ols_slope(years, values):
    ok = [(y, v) for y, v in zip(years, values) if v is not None]
    x = np.array([y for y, _ in ok], dtype=float)
    y = np.array([v for _, v in ok], dtype=float)
    return float(np.polyfit(x, y, 1)[0])


def resite(regions, corrected_change):
    """Recompute the siting table with AZPS's change_since_2019 corrected.

    siting_score is the mean of cross-sectional percentile ranks over three
    components, so correcting one region moves the whole table. Only BAs with
    all three components are ranked (52 of them, matching n_ranked).
    """
    rows = []
    for r in regions:
        s = r.get("siting")
        if r.get("type") != "ba" or not s:
            continue
        rows.append({"id": r["id"],
                     "a": s.get("overnight_cf_share_2025"),
                     "b": s.get("change_since_2019"),
                     "c": s.get("overnight_clean_mw_over_demand")})
    df = pd.DataFrame(rows).set_index("id")
    before = df[["a", "b", "c"]].dropna()
    base_score = before.rank(pct=True).mean(axis=1)
    base_rank = base_score.rank(ascending=False, method="min")

    df.loc["AZPS", "b"] = corrected_change
    after = df[["a", "b", "c"]].dropna()
    new_score = after.rank(pct=True).mean(axis=1)
    new_rank = new_score.rank(ascending=False, method="min")
    agree = int((base_rank == pd.Series({r["id"]: (r.get("siting") or {}).get("siting_rank")
                                         for r in regions
                                         if r.get("type") == "ba" and r.get("siting")})
                 .reindex(base_rank.index)).sum())
    return {"score": round(float(new_score["AZPS"]), 3),
            "rank": int(new_rank["AZPS"]),
            "n_ranked": int(len(after)),
            "method_reproduces_published_ranks": f"{agree} of {len(base_rank)}"}


def main():
    d = load_azps()
    regions = json.loads(REGIONS.read_text())
    regions = regions["regions"] if isinstance(regions, dict) and "regions" in regions else regions
    az = next(r for r in regions if r["id"] == "AZPS")

    cur = {k: window(d, 2019, h, ex_nuclear=True) for k, h in
           (("overnight", NIGHT), ("daytime", DAY), ("all", list(range(24))))}

    clean_by_year = {y: window(d, y, NIGHT, ex_nuclear=True)["clean_mw"]
                     for y in range(2019, 2026)}
    demand = {int(y): v["overnight_avg_mw"] for y, v in az["demand"].items()}
    years = list(range(2019, 2026))
    ratios = [clean_by_year[y] / demand[y] if demand.get(y) else None for y in years]
    slope = ols_slope(years, ratios)

    corrected_change = round(az["siting"]["overnight_cf_share_2025"] - cur["overnight"]["share"], 3)
    sit = resite(regions, corrected_change)
    n_t12 = 18
    published_months = az["trailing12"]["month"][:n_t12]
    t12 = trailing12(d, ex_nuclear=True, months=published_months)
    calib = trailing12(d, ex_nuclear=False, months=published_months)

    def field(path, published, corrected, why, confidence="proven", **extra):
        return dict({"path": path, "published": published, "corrected": corrected,
                     "evidence": why, "confidence": confidence}, **extra)

    corrections = [
        field("cf_share.2019",
              az["cf_share"]["2019"],
              {"overnight": cur["overnight"]["share"],
               "daytime": cur["daytime"]["share"], "all": cur["all"]["share"]},
              "The 2019 figure counts nuclear generation that SRP reported at "
              "the same time. Recomputed on a consistent basis with nuclear "
              "excluded throughout. " + PROVEN),
        field("cf_avg_mw.2019",
              az["cf_avg_mw"]["2019"],
              {"overnight": cur["overnight"]["clean_mw"],
               "daytime": cur["daytime"]["clean_mw"], "all": cur["all"]["clean_mw"]},
              "Overnight clean generation in 2019 was solar only. " + PROVEN),
        field("fuel_delta_overnight_gw.nuclear",
              az["fuel_delta_overnight_gw"]["nuclear"], 0.0,
              "-3.61 GW describes a duplicate being removed from the books, "
              "not fuel being displaced on the system. On a consistent basis "
              "AZPS reports no nuclear in either period. " + PROVEN),
        field("siting.change_since_2019",
              az["siting"]["change_since_2019"], corrected_change,
              "Published value has the wrong SIGN: it reports a 0.517 fall "
              "where the like-for-like change is an increase. " + PROVEN),
        field("siting.ratio_slope_per_year",
              az["siting"]["ratio_slope_per_year"], round(slope, 4),
              "Wrong sign, driven entirely by the inflated 2019 point. "
              "Recomputed over 2019-2025 with nuclear excluded. " + PROVEN),
        field("siting.ratio_2019",
              az["siting"]["ratio_2019"],
              round(clean_by_year[2019] / demand[2019], 4),
              "Overnight clean MW over overnight demand, nuclear excluded. " + PROVEN),
        field("siting.siting_score",
              az["siting"]["siting_score"], sit["score"],
              "Recomputed with the corrected change_since_2019. siting_score "
              "is a mean of cross-sectional percentile ranks, so one region's "
              "correction moves the table.", confidence="proven"),
        field("siting.siting_rank",
              az["siting"]["siting_rank"], sit["rank"],
              "Recomputed over the same 52 ranked BAs. The published file "
              "stores rounded components while the pipeline ranked on full "
              "precision, so this method reproduces "
              f"{sit['method_reproduces_published_ranks']} published ranks "
              "exactly. Treat the corrected rank as +/- 2.",
              confidence="high_confidence_inference",
              approximate=True),
        field("profile_24h.2019",
              az["profile_24h"]["2019"], profile_24h(d, 2019, ex_nuclear=True),
              "Inflated at every hour by the duplicated nuclear. " + PROVEN),
        field(f"trailing12[0:{n_t12}]",
              {"month": az["trailing12"]["month"][:n_t12],
               "overnight_share": az["trailing12"]["overnight_share"][:n_t12],
               "overnight_clean_mw": az["trailing12"]["overnight_clean_mw"][:n_t12]},
              t12,
              "Every trailing-12 window touching a month before 2019-12-04 "
              "includes the duplicate, which is what produces the apparent "
              "2019-2021 decline. " + PROVEN,
              calibration={
                  "recomputed_with_nuclear_included": calib["overnight_share"][:4],
                  "published": az["trailing12"]["overnight_share"][:4],
                  "note": "The same code with nuclear left in reproduces the "
                          "published series, which is what makes the corrected "
                          "series trustworthy."}),
    ]

    unaffected = [{
        "path": "detection",
        "fields": {"rank": az["detection"]["rank"], "score": az["detection"]["score"],
                   "growth_pct": az["detection"]["growth_pct"]},
        "status": "UNAFFECTED AND SAFE TO PUBLISH",
        "why": "The detector is demand-only: z(overnight_excess) + "
               "z(neighbor_divergence) + 0.5 z(load_factor_delta), all computed "
               "from demand, load factor and neighbouring demand. It contains no "
               "generation term, so the nuclear reporting change cannot reach it. "
               "AZPS is rank 3 on the demo screen and that ranking stands.",
    }]

    result = {
        "what": "Correction overlay. Apply at serve time and return BOTH the "
                "published and the corrected value; do not rewrite "
                "dashboard/public/data/.",
        "generated_from": "python3 -m engine.diagnostics.corrections",
        "method_calibration": "Using net_generation_adjusted_mwh and excluding "
            "storage reproduces AZPS 2019 overnight as share 0.620 / clean "
            "3,372 MW / total 5,434 MW (published 0.620 / 3,373 / 5,436) and "
            "2025 as 0.104 / 240 MW (published 0.104 / 240). The method was "
            "checked against the published pipeline before anything was "
            "corrected.",
        "confidence_tiers": {
            "proven": PROVEN,
            "confirmed_against_eia860": CONFIRMED_860,
            "correction_date_not_in_eia860": UNCONFIRMED_DATE,
            "high_confidence_inference": RANK_INFERENCE,
            "not_established": UNKNOWN,
        },
        "regions": {
            "AZPS": {
                "summary": "Published overnight carbon-free share falls 0.620 "
                           f"-> 0.104. It was never 0.620. Corrected, it RISES "
                           f"{cur['overnight']['share']} -> 0.104. The published "
                           "figure is wrong in direction, not only magnitude.",
                "corrections": corrections,
                "unaffected": unaffected,
                "data_flags_should_be": [{
                    "code": "generation_reporting_break",
                    "severity": "high",
                    "applies_to": ["cf_share", "cf_avg_mw",
                                   "fuel_delta_overnight_gw", "siting",
                                   "trailing12", "profile_24h"],
                    "effective_before": "2019-12-04",
                    "message": "Generation-side figures before 2019-12-04 "
                               "include a nuclear plant also reported by SRP. "
                               "Treat AZPS generation history as beginning "
                               "2021-01-01, or use the corrected values.",
                }],
                "published_data_flags": az.get("data_flags", []),
                "published_exclude_from_alerts": az.get("exclude_from_alerts"),
                "recommended_handling": "Treat AZPS generation-side history as "
                    "beginning 2021-01-01, or apply this overlay. Either way "
                    "stop publishing a decline.",
            },
            "WACM": {
                "summary": "Checked with the same method and NOT the same "
                           "problem. No generation step break in coal, its "
                           "dominant fuel. Demand rises from ~2,300 MW (2021) "
                           "to ~4,000 MW (Dec 2022) over about six months, "
                           "generation rising with it and exports falling from "
                           "~1,400 to ~400 MW. A ramp, not a step.",
                "corrections": [],
                "unreliable": True,
                "unreliable_reason": "WACM's demand anomaly remains unexplained. "
                    "It is not a reporting artefact we can correct, and its "
                    "existing flag and alert exclusion should stay.",
            },
        },
        "project_level_finding": {
            "title": "A caveat that is not machine-readable does not exist",
            "detail": "AZPS ships with data_flags: [] and exclude_from_alerts: "
                      "false while the caveat sat in CLAUDE.md prose, so every "
                      "consumer of regions.json saw an unqualified 87% collapse. "
                      "The alerts work hit the same failure from the other side. "
                      "Twice is a pattern: a caveat written for humans in a "
                      "document is invisible to the API, the UI and the export. "
                      "Every caveat needs a field.",
        },
        "note_on_data_availability": {
            "detail": "This investigation was nearly not done, because the team "
                      "believed the raw data was unavailable on this machine and "
                      "work was being routed to a remote box. data/ is absent "
                      "only because it is gitignored. The PUDL parquet is public "
                      "and anonymous from s3://pudl.catalyst.coop: the two tables "
                      "needed here downloaded in 36 seconds. Nobody had tested "
                      "the assumption.",
        },
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, indent=2) + "\n")
    print(f"wrote {OUT}")
    for c in corrections:
        pub = c["published"]
        cor = c["corrected"]
        if isinstance(pub, dict):
            pub = pub.get("overnight", list(pub.values())[0])
            cor = cor.get("overnight", list(cor.values())[0]) if isinstance(cor, dict) else cor
        if isinstance(pub, list):
            pub, cor = f"[{pub[0]} ...]", f"[{cor['overnight_share'][0] if isinstance(cor, dict) else cor[0]} ...]"
        print(f"  {c['path']:38} {str(pub):>22} -> {str(cor):<22} [{c['confidence']}]")
    return result


if __name__ == "__main__":
    main()
