"""Run the whole weather control and write engine/weather/results/.

    python3 -m engine.weather              # full run
    python3 -m engine.weather --quick      # skip the base-temperature sensitivities

Outputs
    engine/weather/results/weather_results.json   every headline number
    engine/weather/results/stations.csv           region -> station, with distances
    engine/weather/results/regions.csv            per region, both controls, both ranks

The only random draw in the module is the Monte Carlo cross-check inside
engine.stats.permutation, seeded from MASTER_SEED. Everything else is closed form.
"""
from __future__ import annotations

import argparse
import json
import platform
import time
from pathlib import Path

import numpy as np
import pandas as pd

from . import MASTER_SEED
from . import control as C
from . import degreedays as DD
from . import fetch as F
from . import geo as G
from . import stations as S

OUT = Path(__file__).resolve().parent / "results"
YEARS_FETCH = list(range(2018, 2026))
BASE, TARGET = 2019, 2025


def _j(o):
    """JSON-safe."""
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return None if np.isnan(o) else float(f"{float(o):.6g}")
    if isinstance(o, (np.ndarray,)):
        return [_j(x) for x in o]
    if isinstance(o, dict):
        return {k: _j(v) for k, v in o.items() if k not in ("resid", "fitted")}
    if isinstance(o, (list, tuple)):
        return [_j(x) for x in o]
    if isinstance(o, float):
        return None if np.isnan(o) else float(f"{o:.6g}")
    return o


def main(quick: bool = False) -> dict:
    t0 = time.time()
    res: dict = {"generated": time.strftime("%Y-%m-%d %H:%M:%S"),
                 "seed": MASTER_SEED,
                 "python": platform.python_version(),
                 "pandas": pd.__version__, "numpy": np.__version__}

    # ---------------------------------------------------------------- stations
    hist = S.load_isd_history()
    stn, assigned = S.resolve_anchors(hist)
    unres = S.unresolved(hist)
    station_ids = sorted({s for v in assigned.values() for s in v})
    print(f"[weather] {len(assigned)} regions mapped, {len(station_ids)} unique stations, "
          f"{sum(len(v) for v in unres.values())} curated ICAO codes unusable")

    # ---------------------------------------------------------------- demand
    demand, codes = C.load_demand_hourly()
    sh = C.shipped(demand, codes)
    r_cal, r_ja = sh["calendar"], sh["jan_aug"]
    scored = list(r_ja.index)
    dropped = [g for g in scored if g not in assigned]
    assigned = {k: v for k, v in assigned.items() if k in scored}
    peer_err = C.verify_peers(r_ja)
    assert peer_err == 0.0, f"peer re-implementation diverges from frozen: {peer_err}"
    print(f"[weather] frozen detector: {len(r_cal)} regions calendar, {len(r_ja)} Jan-Aug; "
          f"peer check exact; {len(dropped)} scored regions with no station")

    # ---------------------------------------------------------------- weather
    hourly = F.fetch_all(station_ids, YEARS_FETCH)
    tz = C.tz_by_region(demand)
    rh = F.region_hourly(hourly, assigned, tz)
    day_max = DD.common_day_span(rh, [BASE, TARGET])
    cov = F.coverage(rh, [BASE, TARGET], 8)
    last_day = (pd.Timestamp(f"{TARGET}-01-01") + pd.Timedelta(days=day_max - 1)).date()
    print(f"[weather] {len(hourly):,} station-hours {min(YEARS_FETCH)}-{max(YEARS_FETCH)}; "
          f"common span day 1-{day_max} (ends {last_day}); "
          f"coverage min {cov.frac.min():.4f} mean {cov.frac.mean():.4f}")

    res["data"] = {
        "source": "NOAA Integrated Surface Database, s3://noaa-global-hourly-pds (anonymous)",
        "station_inventory": S.ISD_HISTORY_URL,
        "years_fetched": YEARS_FETCH,
        "station_years_fetched": len(station_ids) * len(YEARS_FETCH),
        "station_hours": int(len(hourly)),
        "unique_stations": len(station_ids),
        "regions_mapped": len(assigned),
        "regions_scored_by_detector": len(scored),
        "regions_dropped_no_station": dropped,
        "unusable_curated_icao": unres,
        "isd_2025_ends": str(rh[rh.year == TARGET].datetime_utc.max()),
        "common_day_of_year_span": day_max,
        "common_span_last_date": str(last_day),
        "coverage_frac_min": float(cov.frac.min()),
        "coverage_frac_mean": float(cov.frac.mean()),
        "hours_missing_total": int((cov.hours_slots - cov.hours_present).sum()),
        "hours_slots_total": int(cov.hours_slots.sum()),
        "gap_rule": f"average over reporting anchors, then linear interpolation over gaps "
                    f"of at most {F.MAX_INTERP_HOURS} h; longer gaps excluded from every mean",
        "quality_codes_kept": sorted(F.GOOD_QUALITY),
        "report_types_dropped": sorted(F.DROP_REPORT_TYPES),
    }

    # -------------------------------------------------- station / geography table
    cent = G.centroids(scored)
    anchors = G.anchor_distances(stn[stn.region.isin(scored)], cent)
    OUT.mkdir(parents=True, exist_ok=True)
    stn[stn.region.isin(scored)].to_csv(OUT / "stations.csv", index=False)
    res["stations"] = {
        "assignment_rule": "curated primary airport(s) per region; ICAO hand-picked, "
                           "station id / lat / lon / period of record from isd-history.csv",
        "anchor_to_generation_centroid_km": {
            "n_with_centroid": int(anchors.anchor_to_centroid_km.notna().sum()),
            "median": float(anchors.anchor_to_centroid_km.median()),
            "p90": float(anchors.anchor_to_centroid_km.quantile(0.9)),
            "max": float(anchors.anchor_to_centroid_km.max()),
            "farthest": anchors.sort_values("anchor_to_centroid_km", ascending=False)
                        .head(6)[["region", "icaos", "anchor_to_centroid_km"]]
                        .round(0).to_dict("records"),
        },
        "centroid_source_counts": anchors.centroid_source.value_counts().to_dict(),
    }

    # ---------------------------------------------------------------- degree hours
    wm = DD.window_means(rh, [BASE, TARGET], day_max, DD.F65_C)
    wx = DD.deltas(wm, BASE, TARGET)
    res["degree_hours"] = {
        "base_temperature": "65 F = 18.333 C (US convention); 60 F and 70 F run as sensitivity",
        "units": "degree hours in Celsius-hours per hour of the window "
                 "(mean over the window, not a sum)",
        "windows": {"night": "local 00:00-05:59", "day": "local 10:00-15:59", "all": "all hours"},
        "mean_change_2019_2025": {
            "temp_c_all": float(wx.d_temp_c_all.mean()),
            "temp_c_night": float(wx.d_temp_c_night.mean()),
            "temp_c_day": float(wx.d_temp_c_day.mean()),
            "cdh_all": float(wx.d_cdh_all.mean()), "cdh_night": float(wx.d_cdh_night.mean()),
            "cdh_day": float(wx.d_cdh_day.mean()),
            "hdh_all": float(wx.d_hdh_all.mean()), "hdh_night": float(wx.d_hdh_night.mean()),
        },
        "regions_that_warmed": int((wx.d_temp_c_all > 0).sum()),
        "regions_that_cooled": int((wx.d_temp_c_all < 0).sum()),
        "max_warming_region": str(wx.loc[wx.d_temp_c_all.idxmax(), "region"]),
        "max_warming_c": float(wx.d_temp_c_all.max()),
    }

    # ---------------------------------------------------------------- CONTROL A
    A = C.control_a(r_ja, wx)
    res["control_a"] = {
        "design": "cross-section over the scored regions: growth regressed on the "
                  "2019->2025 change in degree hours, residuals re-centered and pushed "
                  "back through the frozen scoring formula",
        "overnight_growth_on_night_weather": _j(A["fit_night"]),
        "average_growth_on_all_hours_weather": _j(A["fit_all"]),
        "overnight_excess_on_night_minus_all_weather": _j(A["fit_excess"]),
        "r2_headline": float(A["fit_night"]["r2"]),
    }

    # ---------------------------------------------------------------- CONTROL B
    cb = C.control_b(demand, rh, day_max, DD.F65_C, scored)
    w = C.control_b_wide(cb)
    B = C.control_b_rescore(r_ja, w)
    grew = w[w.mw_total_change_night > 100]
    res["control_b"] = {
        "design": "per region: 2019 hourly demand on its own hourly CDH/HDH + hour-of-day "
                  "+ weekend; predict 2025 from the 2019 response and 2025 weather; "
                  "growth past that prediction is growth weather does not explain",
        "n_regions": int(cb.region.nunique()),
        "median_2019_fit_r2_night": float(cb[cb.window == "night"].r2_2019.median()),
        "median_cdh_t_stat_night": float(cb[cb.window == "night"].t_cdh.median()),
        "cdh_coefficient_positive_share_night":
            float((cb[cb.window == "night"].beta_cdh_mw_per_degh > 0).mean()),
        "max_frac_2025_hours_outside_2019_temp_range":
            float(cb.frac_2025_out_of_2019_temp_support.max()),
        "overnight_mw_change_all_regions": float(w.mw_total_change_night.sum()),
        "overnight_mw_weather_explained": float(w.mw_weather_explained_night.sum()),
        "weather_share_of_overnight_growth": float(
            w.mw_weather_explained_night.sum() / w.mw_total_change_night.sum()),
        "growing_regions_only": {
            "threshold_mw": 100, "n": int(len(grew)),
            "overnight_mw_change": float(grew.mw_total_change_night.sum()),
            "overnight_mw_weather_explained": float(grew.mw_weather_explained_night.sum()),
            "weather_share": float(grew.mw_weather_explained_night.sum()
                                   / grew.mw_total_change_night.sum()),
            "median_per_region_share": float((grew.mw_weather_explained_night
                                              / grew.mw_total_change_night).median()),
        },
        "night_vs_day": {
            "question": "cooling peaks in the afternoon, so if overnight growth were "
                        "cooling, daytime growth should be larger still",
            "mean_night_minus_day_pts": float(w.night_minus_day_wx_growth_pts.mean()),
            "median_night_minus_day_pts": float(w.night_minus_day_wx_growth_pts.median()),
            "share_of_regions_night_exceeds_day":
                float((w.night_minus_day_wx_growth_pts > 0).mean()),
            "n_regions_night_exceeds_day": int((w.night_minus_day_wx_growth_pts > 0).sum()),
        },
    }

    # ---------------------------------------------------------------- rankings
    def movement(frame, names):
        return {n: {"shipped_calendar_rank": int(r_cal.loc[n, "rank"]),
                    "frozen_jan_aug_rank": int(r_ja.loc[n, "rank"]),
                    "rank": int(frame.loc[n, "rank"]) if n in frame.index else None,
                    "score": round(float(frame.loc[n, "score"]), 3)
                    if n in frame.index else None} for n in names}

    top10 = r_cal.sort_values("rank").head(10).index.tolist()
    res["rankings"] = {
        "spearman": {
            "window_change_only_jan_aug_vs_shipped": C.spearman(r_ja["score"], r_cal["score"]),
            "control_a_vs_shipped": C.spearman(A["full"]["score"], r_cal["score"]),
            "control_a_vs_frozen_jan_aug": C.spearman(A["full"]["score"], r_ja["score"]),
            "control_b_vs_shipped": C.spearman(B["scored"]["score"], r_cal["score"]),
            "control_b_vs_frozen_jan_aug": C.spearman(B["scored"]["score"], r_ja["score"]),
            "control_a_minimal_vs_shipped": C.spearman(A["minimal"]["score"], r_cal["score"]),
            "control_a_direct_vs_shipped": C.spearman(A["direct"]["score"], r_cal["score"]),
        },
        "top10_shipped": top10,
        "top10_control_a": movement(A["full"], top10),
        "top10_control_b": movement(B["scored"], top10),
        "validation_control_a": movement(A["full"], C.VALIDATION),
        "validation_control_b": movement(B["scored"], C.VALIDATION),
    }

    # ---------------------------------------------------------------- permutation
    try:
        from engine.stats import permutation as P
        res["permutation"] = {
            "imported_from": "engine/stats/permutation.py (label_permutation)",
            "n_perm_monte_carlo": 100_000, "seed": MASTER_SEED + 1,
        }
        for name, frame in (("shipped_calendar", r_cal), ("frozen_jan_aug", r_ja),
                            ("control_a_full", A["full"]), ("control_b", B["scored"])):
            p = P.label_permutation(frame, n_perm=100_000, seed=MASTER_SEED + 1)
            res["permutation"][name] = {
                k: p[k] for k in ("obs_mean_score", "null_mean_score", "p_exact_mean_score",
                                  "p_monte_carlo_mean_score", "obs_mean_rank",
                                  "p_exact_mean_rank", "p_monte_carlo_mean_rank",
                                  "validation_ranks")}
    except Exception as e:                                    # pragma: no cover
        res["permutation"] = {"status": "NOT RUN", "error": f"{type(e).__name__}: {e}"}
        print(f"[weather] permutation test not run: {e}")

    # ---------------------------------------------------------------- sensitivity
    sens = []
    specs = [("65F Jan-Aug (primary)", DD.F65_C, day_max, 0.0, False)]
    if not quick:
        specs += [("60F Jan-Aug", DD.F60_C, day_max, 0.0, False),
                  ("70F Jan-Aug", DD.F70_C, day_max, 0.0, False),
                  ("65F Jan-Jul", DD.F65_C, 212, 0.0, False),
                  ("65F Jan-Aug, 5% winsorized", DD.F65_C, day_max, 0.05, False),
                  ("65F Jan-Aug, quadratic response", DD.F65_C, day_max, 0.0, True)]
    for label, base_c, dmax, winsor, quad in specs:
        wm_s = DD.window_means(rh, [BASE, TARGET], dmax, base_c)
        wx_s = DD.deltas(wm_s, BASE, TARGET)
        A_s = C.control_a(r_ja, wx_s, winsor=winsor)
        cb_s = C.control_b(demand, rh, dmax, base_c, scored, quadratic=quad)
        w_s = C.control_b_wide(cb_s)
        B_s = C.control_b_rescore(r_ja, w_s)
        sens.append({
            "spec": label,
            "r2_overnight_growth_on_weather": round(A_s["fit_night"]["r2"], 4),
            "r2_average_growth_on_weather": round(A_s["fit_all"]["r2"], 4),
            "spearman_a_vs_shipped": round(C.spearman(A_s["full"]["score"],
                                                      r_cal["score"])["spearman_rho"], 4),
            "spearman_b_vs_shipped": round(C.spearman(B_s["scored"]["score"],
                                                      r_cal["score"])["spearman_rho"], 4),
            "weather_share_of_overnight_mw": round(float(
                w_s.mw_weather_explained_night.sum() / w_s.mw_total_change_night.sum()), 4),
            "share_night_exceeds_day": round(float(
                (w_s.night_minus_day_wx_growth_pts > 0).mean()), 3),
            "validation_ranks_b": {v: int(B_s["scored"].loc[v, "rank"])
                                   for v in C.VALIDATION},
        })
    res["sensitivity"] = sens

    # ---------------------------------------------------------------- per-region CSV
    per = pd.DataFrame({
        "shipped_calendar_rank": r_cal["rank"], "shipped_calendar_score": r_cal["score"],
        "frozen_jan_aug_rank": r_ja["rank"],
        "growth_pct": r_ja["growth_pct"], "overnight_growth_pct": r_ja["overnight_growth_pct"],
        "overnight_excess": r_ja["overnight_excess"],
    })
    per = per.join(wx.set_index("region")[["d_temp_c_all", "d_temp_c_night",
                                           "d_cdh_night", "d_cdh_day", "d_cdh_all",
                                           "d_hdh_night", "d_hdh_all"]])
    per = per.join(A["adj"].rename(columns=lambda c: "a_" + c))
    per = per.join(A["full"][["score", "rank"]].rename(
        columns={"score": "control_a_score", "rank": "control_a_rank"}))
    per = per.join(w[["raw_growth_pct_night", "weather_implied_growth_pct_night",
                      "wx_adjusted_growth_pct_night", "wx_adjusted_growth_pct_day",
                      "wx_adjusted_growth_pct_all", "mw_total_change_night",
                      "mw_weather_explained_night", "mw_unexplained_night",
                      "night_minus_day_wx_growth_pts"]])
    per = per.join(B["scored"][["score", "rank"]].rename(
        columns={"score": "control_b_score", "rank": "control_b_rank"}))
    per = per.join(anchors.set_index("region")[["icaos", "stations", "n_stations",
                                                "anchor_to_centroid_km"]])
    per.sort_values("shipped_calendar_rank").to_csv(OUT / "regions.csv")

    res["runtime_sec"] = round(time.time() - t0, 1)
    (OUT / "weather_results.json").write_text(json.dumps(_j(res), indent=2))
    report(res, r_cal, r_ja, A, B, w, top10)
    return res


def report(res, r_cal, r_ja, A, B, w, top10):
    pd.set_option("display.width", 260)
    pd.set_option("display.max_columns", 40)
    print("\n" + "=" * 78)
    print("DOES THE FLAT-LOAD SIGNAL SURVIVE A WEATHER CONTROL?")
    print("=" * 78)
    d = res["degree_hours"]["mean_change_2019_2025"]
    print(f"\nIt did get warmer. Mean 2019->2025 change over the {len(r_ja)} scored regions, "
          f"Jan to late Aug:\n  all hours {d['temp_c_all']:+.2f} C, "
          f"overnight {d['temp_c_night']:+.2f} C, daytime {d['temp_c_day']:+.2f} C; "
          f"CDH(65F) {d['cdh_all']:+.3f} / {d['cdh_night']:+.3f} / {d['cdh_day']:+.3f} C-h per hour")
    print(f"  {res['degree_hours']['regions_that_warmed']} of {len(r_ja)} regions warmed.")

    a = res["control_a"]
    print(f"\nCONTROL A  how much of overnight demand growth is weather?")
    print(f"  overnight growth ~ d(CDH night) + d(HDH night):  R2 = "
          f"{a['overnight_growth_on_night_weather']['r2']:.4f}  "
          f"(adj {a['overnight_growth_on_night_weather']['adj_r2']:.4f}, "
          f"F p = {a['overnight_growth_on_night_weather']['f_p']:.4g})")
    print(f"  average   growth ~ d(CDH all)   + d(HDH all):    R2 = "
          f"{a['average_growth_on_all_hours_weather']['r2']:.4f}")

    b = res["control_b"]
    print(f"\nCONTROL B  per-region weather normalization, overnight window")
    print(f"  overnight demand across all {b['n_regions']} regions rose "
          f"{b['overnight_mw_change_all_regions']:,.0f} MW; the regions' own 2019 temperature "
          f"responses explain {b['overnight_mw_weather_explained']:,.0f} MW "
          f"({100 * b['weather_share_of_overnight_growth']:.1f}%).")
    g = b["growing_regions_only"]
    print(f"  restricted to the {g['n']} regions that grew more than 100 MW overnight: "
          f"{100 * g['weather_share']:.1f}% of {g['overnight_mw_change']:,.0f} MW, "
          f"median region {100 * g['median_per_region_share']:.1f}%.")
    nd = b["night_vs_day"]
    print(f"  night minus day, after each region's own weather response is removed: "
          f"mean {nd['mean_night_minus_day_pts']:+.1f} points, "
          f"night exceeds day in {nd['n_regions_night_exceeds_day']} of {b['n_regions']} "
          f"regions ({100 * nd['share_of_regions_night_exceeds_day']:.0f}%).")

    sp = res["rankings"]["spearman"]
    print(f"\nRANKING")
    print(f"  Jan-Aug window vs shipped calendar (no weather):  rho = "
          f"{sp['window_change_only_jan_aug_vs_shipped']['spearman_rho']:.3f}")
    print(f"  Control A vs shipped:                            rho = "
          f"{sp['control_a_vs_shipped']['spearman_rho']:.3f}")
    print(f"  Control B vs shipped:                            rho = "
          f"{sp['control_b_vs_shipped']['spearman_rho']:.3f}")

    cmp = pd.DataFrame({
        "shipped": r_cal["rank"], "jan_aug": r_ja["rank"],
        "A_rank": A["full"]["rank"], "A_score": A["full"]["score"].round(2),
        "B_rank": B["scored"]["rank"], "B_score": B["scored"]["score"].round(2),
        "wx_share_night": (w.mw_weather_explained_night
                           / w.mw_total_change_night).round(3),
        "night_minus_day": w.night_minus_day_wx_growth_pts.round(1),
    })
    print("\nTOP 10 as shipped:")
    print(cmp.loc[top10].to_string())
    print("\nPRE-REGISTERED VALIDATION REGIONS:")
    print(cmp.loc[C.VALIDATION].to_string())

    if "p_exact_mean_score" in res["permutation"].get("shipped_calendar", {}):
        print("\nPERMUTATION TEST (engine/stats), mean score / mean rank of the 4 "
              "pre-registered regions:")
        for k in ("shipped_calendar", "frozen_jan_aug", "control_a_full", "control_b"):
            p = res["permutation"][k]
            print(f"  {k:18s} p(score) = {p['p_exact_mean_score']:.4f}   "
                  f"p(rank) = {p['p_exact_mean_rank']:.4f}")

    print(f"\nSENSITIVITY")
    print(pd.DataFrame(res["sensitivity"]).drop(columns=["validation_ranks_b"])
          .to_string(index=False))
    print(f"\nruntime {res['runtime_sec']}s   seed {res['seed']}   "
          f"results -> engine/weather/results/")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    main(quick=ap.parse_args().quick)
