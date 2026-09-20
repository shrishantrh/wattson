"""Run both shape questions and print the result. Writes engine/shape/shape.json.

    source ~/hackmit-venv/bin/activate
    python3 -m engine.shape
"""
from __future__ import annotations

import textwrap

from . import build as B
from . import changepoint as CP
from . import cluster as C
from . import figure as FIG

FOCUS_TABLE = ["PJM/DOM", "PJM/AEP", "ERCO/NCEN", "ERCO/NRTH", "ERCO/FWES",
               "SWPP/OPPD", "PJM", "ERCO", "SWPP"]


def main() -> int:
    r = B.build()
    path = B.write(r)
    meta, q1, q2 = r["meta"], r["q1_clustering"], r["q2_changepoints"]

    print("=" * 92)
    print(f"engine/shape   n = {meta['n_regions']} regions   seed = {meta['seed']}   "
          f"detector inputs used: {meta['detector_outputs_used_as_input']}")
    sl = meta["site_labels"]
    print(f"site labels: {sl['facilities_csv_rows']} sites in "
          f"{sl['distinct_regions_in_csv']} of {meta['n_regions']} regions "
          f"({sl['rows_mentioning_detector_in_note']} rows mention the detector in their note, "
          f"{sl['rows_flagged_invisible_to_eia930']} are invisible to EIA-930)")

    # ------------------------------------------------------------------------ Q1
    print("\n" + "=" * 92)
    print("Q1  do datacenter grids cluster together on load shape alone?")
    print("=" * 92)
    print("\nsilhouette (pooled region-years 2019-2025, n = %d):" % q1["primary"]["n_rows"])
    for c in q1["silhouette_curve"]:
        mark = "  <- chosen" if c["k"] == q1["primary"]["k"] else ""
        print(f"   k={c['k']:2d}  k-means {c['silhouette_kmeans']:.4f}   "
              f"ward {c['silhouette_ward']:.4f}   ARI {c['ari_kmeans_vs_ward']:.3f}{mark}")

    print("\nprincipal components (what they physically are):")
    for name, d in list(q1["pca"]["components"].items())[:3]:
        top = sorted(d["corr_with"].items(), key=lambda kv: -abs(kv[1]))[:3]
        print(f"   {name}  {100 * d['explained_variance_ratio']:5.1f}% of variance   "
              + "   ".join(f"corr({k}) {v:+.2f}" for k, v in top))

    print(f"\nclusters (k = {q1['clusters']['k']}, cluster 0 = flattest centroid):")
    for c in q1["clusters"]["centroids"]:
        print(f"   cluster {c['cluster']}  overnight {c['overnight_ratio']:.3f}  "
              f"daytime {c['daytime_ratio']:.3f}  peak/trough {c['peak_to_trough']:.3f}  "
              f"peak {c['peak_hour']:02d}:00  trough {c['trough_hour']:02d}:00")
    print("\n   members by year:")
    for y, row in q1["clusters"]["membership_by_year"].items():
        print(f"     {y}  " + "  ".join(f"c{c}={n:3d}" for c, n in sorted(row.items())))

    print("\nenrichment of mapped-site regions, 2025 slice (hypergeometric, "
          f"Bonferroni over k={q1['clusters']['k']}):")
    for e in q1["primary"]["enrichment_2025"]:
        print(f"   cluster {e['cluster']}  n={e['n_regions']:3d}  with sites={e['n_with_sites']:3d}  "
              f"expected {e['expected_with_sites']:5.1f}  p={e['p_hypergeometric_one_sided']:.4f}  "
              f"Bonferroni {e['p_hypergeometric_bonferroni']:.4f}  "
              f"Fisher(2-sided) {e['p_fisher_two_sided']:.4f}")
    print("\n   2019 placebo (same clusters, baseline year):")
    for e in q1["primary"]["enrichment_2019_placebo"]:
        print(f"   cluster {e['cluster']}  n={e['n_regions']:3d}  with sites={e['n_with_sites']:3d}  "
              f"expected {e['expected_with_sites']:5.1f}  p={e['p_hypergeometric_one_sided']:.4f}")

    g = q1["enrichment_grid"]
    print(f"\nfull grid: {g['n_tests']} tests (4 profile specs x 5 label sets x every cluster)")
    print(f"   smallest uncorrected p = {g['min_p_uncorrected']:.4f}  "
          f"({g['min_p_cell']['spec']} / {g['min_p_cell']['label_set']} / "
          f"cluster {g['min_p_cell']['cluster']})")
    print(f"   Bonferroni over the whole family = {g['min_p_bonferroni_over_family']:.3f}")

    print("\ncontinuous version (PC1 = flatness; lower PC1 = flatter):")
    for k, d in q1["pc1_continuous_test"].items():
        p = d.get("mannwhitney_p_site_flatter") or d.get("mannwhitney_p_site_flattened_more")
        print(f"   {k:16s}  site median {d['median_site']:+.4f} (n={d['n_site']})  "
              f"other {d['median_other']:+.4f} (n={d['n_other']})   p={p:.4f}")

    # ------------------------------------------------------------------------ Q2
    print("\n" + "=" * 92)
    print("Q2  when did each region's load go flat?")
    print("=" * 92)
    t = q2["timing"]
    nreg = sum(1 for v in q2["regions"].values() if v["n_changepoints"])
    print(f"\n{nreg} of {q2['n_regions']} regions carry at least one changepoint; "
          f"{t['direction']['positive']} of {t['direction']['positive'] + t['direction']['negative']} "
          "breaks raise the overnight ratio")
    cv = t["covid_h1_2020"]
    print(f"2020 H1 (COVID window): {cv['all_breaks']} of {cv['all_breaks_total']} breaks, "
          f"{cv['primary_breaks']} of {t['n_primary']} primary breaks -- flagged, not counted")
    print(f"edge-of-window breaks: {t['edge_of_window']['all_breaks']} of "
          f"{cv['all_breaks_total']} ({t['edge_of_window']['primary_breaks']} primary)")

    mw = t["max_in_any_6_month_window"]
    print(f"\ndo the primary breaks cluster in calendar time?")
    print(f"   most in any 6-month window: {mw['observed']} observed vs "
          f"{mw['null_mean']:.1f} expected under a seeded uniform null "
          f"({mw['n_sim']} sims)   p = {mw['p_value']:.3f}")
    print(f"   KS vs uniform relative position: D={t['ks_uniform_relative_position']['D']:.3f}  "
          f"p={t['ks_uniform_relative_position']['p_value']:.4f}")
    print(f"   site vs non-site break DATE  Mann-Whitney p = "
          f"{t['site_vs_nonsite_break_date_mwu_p']:.3f}")
    print(f"   site vs non-site MAGNITUDE   Mann-Whitney p = "
          f"{t['site_vs_nonsite_magnitude_mwu_p_greater']:.3f}")

    print("\nprimary breaks by half-year (site-region share in brackets):")
    for hy, n in t["primary_by_half_year"].items():
        s = t["primary_by_half_year_site"].get(hy, 0)
        print(f"   {hy}  {'#' * n:16s} {n:2d}  [{s}]")

    if t["shared_dates"]:
        print(f"\ndates shared by >= {CP.SHARED_DATE_MIN} regions (a shared date is a warning, "
              "not a finding):")
        for s in t["shared_dates"]:
            tag = " COVID" if s["covid_suspect"] else ""
            tag += " EDGE-OF-WINDOW" if s["any_edge_of_window"] else ""
            print(f"   {s['date']}  {s['n_regions']:2d} regions{tag}")
            print("      " + textwrap.fill(", ".join(s["regions"]), 84,
                                           subsequent_indent="      "))

    print("\nfocus regions:")
    for k in FOCUS_TABLE:
        reg = q2["regions"].get(k)
        if not reg:
            continue
        print(f"\n   {k}   overnight ratio {reg['ratio_2019_mean']:.4f} (2019) -> "
              f"{reg['ratio_2025_mean']:.4f} (2025)   sites mapped: {reg['n_sites']}")
        for c in reg["changepoints"]:
            d = c["decomposition"]
            extra = (f"night {d['overnight_mw_delta']:+8.0f} MW ({d['overnight_pct']:+5.1f}%)  "
                     f"avg {d['avg_mw_delta']:+8.0f} MW ({d['avg_pct']:+5.1f}%)  {d['story']}"
                     if d.get("usable") else "(window truncated)")
            flags = " COVID" if c["covid_suspect"] else ""
            flags += " EDGE" if c["edge_of_window"] else ""
            print(f"      {c['date']}  {c['magnitude_pts']:+6.2f} pts  "
                  f"{c['magnitude_sigma']:+5.1f} sigma{flags:6s}  {extra}")
        p = reg["primary"]
        if p:
            print(f"      primary: {p['date']}  {p['magnitude_pts']:+.2f} pts   "
                  f"binseg agrees: {p['binseg_agrees']} ({p['binseg_date']})")

    print("\ncross-check against years named in facilities.csv notes "
          "(prose, not a schema field -- read the note):")
    for c in q2["announced_year_cross_check"]:
        if c["nearest_break"] is None:
            print(f"   {c['company'][:20]:22s} {c['metro'][:22]:24s} {c['region']:11s} "
                  f"note {c['note_year']}  -> no changepoint in this region")
            continue
        inv = " [invisible to EIA-930]" if c["invisible_to_eia930"] else ""
        print(f"   {c['company'][:20]:22s} {c['metro'][:22]:24s} {c['region']:11s} "
              f"note {c['note_year']}  nearest break {c['nearest_break']} "
              f"({c['gap_months']:+d} months, {c['magnitude_pts']:+.2f} pts){inv}")

    # ------------------------------------------------- post-hoc detector comparison
    dc = r["detector_comparison"]
    print("\n" + "=" * 92)
    print("POST-HOC comparison with the shipped detector (no detector number entered any fit)")
    print("=" * 92)
    for key, label in [("score_vs_overnight_ratio_change", "detector score vs 2019->2025 overnight-ratio change"),
                       ("score_vs_primary_changepoint_magnitude", "detector score vs primary changepoint magnitude"),
                       ("score_vs_pc1_2025", "detector score vs PC1 2025 (flatness)"),
                       ("score_vs_pc1_change", "detector score vs PC1 change 2019->2025")]:
        d = dc[key]
        print(f"   {label:56s} rho {d['spearman_rho']:+.3f}  p {d['p_value']:.2e}  n {d['n']}")
    print("\n   detector top 10, with what this module independently says about them:")
    for t in dc["detector_top10"]:
        print(f"     #{t['rank']:2d} {t['region']:11s} shape cluster {t['shape_cluster_2025']}   "
              f"break {str(t['primary_changepoint']):8s} {t['primary_magnitude_pts']:+6.2f} pts   "
              f"ratio {t['overnight_ratio_change_pts']:+5.2f} pts 2019->2025")
    print("\n   mean detector rank by shape cluster (cluster 0 = flattest):")
    for c, d in dc["mean_detector_rank_by_shape_cluster"].items():
        print(f"     cluster {c}  n={d['n']:3d}  mean rank {d['mean_rank']:5.1f}  "
              f"median {d['median_rank']:5.1f}")

    fig = FIG.render(r)
    print(f"\nwrote {path.relative_to(B.P.REPO_ROOT)} and "
          f"{fig.relative_to(B.P.REPO_ROOT)}")
    print(f"reproduce: source ~/hackmit-venv/bin/activate && python3 -m engine.shape "
          f"(seed {C.SEED})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
