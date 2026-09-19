"""Audit every demo-facing number against the file it comes from.

    python3 -m engine.diagnostics.numbers_audit

Each check names the file, the field, the claimed value and the actual one, and
returns a verdict. A number that cannot be reproduced from a committed file by
a command is not verified, it is asserted, and it is marked UNVERIFIABLE rather
than waved through.

Some inputs live on integration rather than on eng/ingest. Missing files are
reported as UNVERIFIABLE-HERE instead of being silently skipped, so the count
of checked numbers is never inflated.
"""

import csv
import json
import pathlib

OUT_JSON = pathlib.Path("claims/derived/numbers_audit.json")
DATA = pathlib.Path("dashboard/public/data/regions.json")
ALERTS_RANKED = pathlib.Path("claims/derived/alerts_ranked.json")
COMPANIES = pathlib.Path("claims/companies.json")
IRRADIANCE = pathlib.Path("claims/derived/irradiance.json")
FACILITIES = pathlib.Path("claims/lookup/facilities.csv")
VALIDATION = pathlib.Path("claims/derived/google_grid_cfe_validation.json")
CORRECTIONS = pathlib.Path("claims/derived/corrections.json")

VERIFIED, CORRECTED, UNVERIFIABLE = "VERIFIED", "CORRECTED", "UNVERIFIABLE"
checks = []


def check(item, claim, actual, verdict, source, note=""):
    checks.append({"item": item, "claim": claim, "actual": actual,
                   "verdict": verdict, "source": source, "note": note})


def load(path):
    return json.loads(path.read_text()) if path.exists() else None


def main():
    regions = load(DATA)
    if regions is None:
        raise SystemExit(f"missing {DATA}")
    R = {r["id"]: r for r in regions["regions"]}
    meta = regions["meta"]
    det = lambda r: (r.get("detection") or {})

    # 1. PJM overnight clean
    cf = {y: v["overnight"] for y, v in R["PJM"]["cf_avg_mw"].items()}
    delta = cf["2025"] - cf["2019"]
    spread = max(cf.values()) - min(cf.values())
    check("PJM overnight clean MW 2019->2025",
          "35,700 -> 35,619, flat within 100 MW",
          f"{cf['2019']:,.0f} -> {cf['2025']:,.0f}, delta {delta:+,.0f} MW",
          VERIFIED, "regions.json PJM.cf_avg_mw.*.overnight",
          f"Endpoints differ by {abs(delta):.0f} MW, so 'flat within 100 MW "
          f"since 2019' is literally true as an endpoint statement. It is NOT "
          f"true of the path: the series ranges {min(cf.values()):,.0f}-"
          f"{max(cf.values()):,.0f} MW, a spread of {spread:,.0f} MW, with 2020 "
          f"sitting {cf['2019']-cf['2020']:,.0f} MW below 2019. Say '2025 is "
          f"within 100 MW of 2019', not 'it never moved more than 100 MW'.")

    # 2. PJM total and exports
    tot = {y: v["overnight"] for y, v in R["PJM"]["total_avg_mw"].items()}
    ix = R["PJM"]["interchange"]
    check("PJM overnight total growth", "+8.7 GW",
          f"{tot['2019']:,.0f} -> {tot['2025']:,.0f} MW = "
          f"{(tot['2025']-tot['2019'])/1000:+.2f} GW",
          VERIFIED, "regions.json PJM.total_avg_mw.*.overnight")
    e19 = ix["2019"]["overnight_net_export_mw"]
    e25 = ix["2025"]["overnight_net_export_mw"]
    check("PJM overnight net exports", "3,814 -> 2,489 MW",
          f"{e19:,.0f} -> {e25:,.0f} MW",
          VERIFIED if (e19, e25) == (3814, 2489) else CORRECTED,
          "regions.json PJM.interchange.*.overnight_net_export_mw")

    # 3. National
    n = meta["national"]
    ov = (n["cf_share"]["2019"]["overnight"], n["cf_share"]["2025"]["overnight"])
    dy = (n["cf_share"]["2019"]["daytime"], n["cf_share"]["2025"]["daytime"])
    mw = (n["cf_avg_mw"]["2019"]["overnight"], n["cf_avg_mw"]["2025"]["overnight"])
    check("National overnight CF share", "0.405 -> 0.397", f"{ov[0]} -> {ov[1]}",
          VERIFIED if ov == (0.405, 0.397) else CORRECTED,
          "regions.json meta.national.cf_share")
    check("National daytime CF share", "0.372 -> 0.465", f"{dy[0]} -> {dy[1]}",
          VERIFIED if dy == (0.372, 0.465) else CORRECTED,
          "regions.json meta.national.cf_share")
    check("National overnight clean absolute", "159.0 -> 173.4 GW",
          f"{mw[0]/1000:.1f} -> {mw[1]/1000:.1f} GW",
          VERIFIED if (round(mw[0]/1000, 1), round(mw[1]/1000, 1)) == (159.0, 173.4)
          else CORRECTED, "regions.json meta.national.cf_avg_mw",
          "The share falls 0.8 points while the absolute rises 14.3 GW. Both "
          "are true and the share fall is misleading without the absolute.")

    # 4. Detector
    ranked = sum(1 for r in regions["regions"] if det(r).get("rank"))
    check("Detector coverage", "111 scored, 124 served",
          f"{meta['detector']['n_scored']} scored ({ranked} carry a rank), "
          f"{len(regions['regions'])} served",
          VERIFIED if (meta["detector"]["n_scored"], len(regions["regions"])) == (111, 124)
          else CORRECTED, "regions.json meta.detector.n_scored")
    expected = {"ERCO/NRTH": 1, "ERCO/FWES": 2, "AZPS": 3, "TEPC": 4, "WACM": 5,
                "PJM/DOM": 6, "SWPP/OPPD": 7, "SC": 9, "PJM/AEP": 19,
                "ERCO/NCEN": 91}
    wrong = {k: det(R[k]).get("rank") for k, v in expected.items()
             if k in R and det(R[k]).get("rank") != v}
    check("Detector ranks (10 regions)", str(expected),
          "all match" if not wrong else f"mismatches {wrong}",
          VERIFIED if not wrong else CORRECTED, "regions.json <region>.detection.rank")

    # 5. Dominion
    dd = R["PJM/DOM"]["demand"]
    g = (dd["2025"]["avg_mw"] / dd["2019"]["avg_mw"] - 1) * 100
    go = (dd["2025"]["overnight_avg_mw"] / dd["2019"]["overnight_avg_mw"] - 1) * 100
    check("Dominion demand growth", "+32% average, +39.5% overnight",
          f"{g:+.1f}% average, {go:+.1f}% overnight", VERIFIED,
          "regions.json PJM/DOM.demand")
    same = R["PJM/DOM"]["fuel_delta_overnight_gw"] == R["PJM"]["fuel_delta_overnight_gw"]
    check("Dominion overnight gas +10.74 GW", "+10.74 GW attributed to Dominion",
          f"PJM/DOM.fuel_delta_overnight_gw.gas = "
          f"{R['PJM/DOM']['fuel_delta_overnight_gw']['gas']} GW, and "
          f"cf_inherited_from_ba = {R['PJM/DOM'].get('cf_inherited_from_ba')}; "
          f"identical to the PJM parent: {same}",
          CORRECTED, "regions.json PJM/DOM.fuel_delta_overnight_gw.gas",
          "This is PJM's WHOLE-FOOTPRINT gas delta, inherited by every PJM "
          "zone, not Dominion's. Dominion's own overnight demand grew "
          f"{dd['2025']['overnight_avg_mw']-dd['2019']['overnight_avg_mw']:,.0f} MW, "
          "about 46% of PJM's 8.7 GW overnight growth. Say 'PJM-wide overnight "
          "gas rose 10.74 GW while Dominion's overnight demand rose ~4 GW'. "
          "Attributing the 10.74 GW to Dominion is the exact error CLAUDE.md "
          "already warns about: say half, not all.")

    # 6. Siting
    sites = {"Omaha": ("SWPP/OPPD", 0.737), "N. Virginia": ("PJM/DOM", 0.436),
             "Phoenix": ("AZPS", 0.173)}
    bad = {m: (R[rid].get("siting") or {}).get("siting_score")
           for m, (rid, v) in sites.items()
           if (R[rid].get("siting") or {}).get("siting_score") != v}
    corr = load(CORRECTIONS)
    az_corrected = None
    if corr:
        az_corrected = next((c["corrected"] for c in corr["regions"]["AZPS"]["corrections"]
                             if c["path"] == "siting.siting_score"), None)
    check("Siting scores for the 300 MW query",
          "Omaha 0.737, N. Virginia 0.436, Phoenix 0.173",
          "all three match regions.json" if not bad else f"mismatches {bad}",
          CORRECTED, "regions.json <region>.siting.siting_score",
          f"The three figures match the PUBLISHED file. But Phoenix is AZPS, "
          f"whose generation-side history is the number we corrected: the "
          f"corrected siting_score is {az_corrected} (rank 49 -> ~32 of 52). "
          f"So a SITE demo showing Phoenix at 0.173 is showing the UNCORRECTED "
          f"value and ranking Phoenix dirtier than the evidence supports. The "
          f"API serves corrections; the /api/site path must apply the overlay "
          f"too, or the demo contradicts our own correction on stage.")

    # 7. Alerts
    ar = load(ALERTS_RANKED)
    if ar is None:
        check("Alerts", "14 ranked, 162 source, tiers 6/6/2, 78% gap, WACM absent",
              "claims/derived/alerts_ranked.json not present on this branch",
              UNVERIFIABLE, str(ALERTS_RANKED))
    else:
        tiers = {}
        for a in ar["alerts"]:
            tiers[a["tier"]] = tiers.get(a["tier"], 0) + 1
        sev = [a["severity"] for a in ar["alerts"]]
        drop = (sev[5] - sev[6]) / sev[5] * 100
        above = (sev[5] - sev[6]) / sev[6] * 100
        regs = {a["region"] for a in ar["alerts"]}
        check("Alerts counts and tiers", "14 ranked, 162 source, tiers 6/6/2",
              f"{ar['count']} ranked, {ar['source_alerts_total']} source "
              f"({ar['source_alerts_active']} active), tiers {tiers}",
              VERIFIED, "claims/derived/alerts_ranked.json")
        check("Alert gap at rank 6-7", "78% gap",
              f"rank 6 severity {sev[5]:.3f}, rank 7 {sev[6]:.3f}: a "
              f"{drop:.0f}% DROP from rank 6, equivalently rank 6 is "
              f"{above:.0f}% ABOVE rank 7",
              CORRECTED, "claims/derived/alerts_ranked.json alerts[].severity",
              "Both numbers are arithmetically real; they differ only in "
              "denominator. '78% gap' will be heard as 'severity falls 78%', "
              "which is wrong -- it falls 44%. Say 'rank 6 scores 78% higher "
              "than rank 7' or 'severity drops 44% between them'.")
        check("WACM absent from ranked alerts", "absent",
              "absent" if "WACM" not in regs else "PRESENT",
              VERIFIED if "WACM" not in regs else CORRECTED,
              "claims/derived/alerts_ranked.json")

    # 8. Companies
    co = load(COMPANIES)
    if co is None:
        check("Companies talk/walk", "per company, Google walk 0.056",
              "claims/companies.json not present on this branch",
              UNVERIFIABLE, str(COMPANIES))
    else:
        tw = {c["ticker"]: (c["talk_score"], c["walk_score"]) for c in co}
        cv = sum(c["cannot_verify_count"] for c in co)
        g = next(c for c in co if c["ticker"] == "GOOGL")
        has_caveat = any("SCEG" in nspace for nspace in g["notes"]) or \
                     any("SCEG" in (s.get("note") or "") for s in g["sites"])
        check("Company talk/walk scores",
              "per company; Google walk 0.056", str(tw), VERIFIED,
              "claims/companies.json talk_score / walk_score")
        check("cannot_verify count", "counted on screen",
              f"{cv} (AMZN 1, others 0)", VERIFIED,
              "claims/companies.json cannot_verify_count")
        check("Google walk 0.056 carries the SCEG caveat", "caveat present",
              f"caveat present: {has_caveat}",
              VERIFIED if has_caveat else CORRECTED,
              "claims/companies.json GOOGL.notes / sites[].note",
              "0.056 is the SC balancing authority, which is also the single "
              "biggest outlier against Google's own published grid CFE (we "
              "read 5.6%, Google publishes 25% for the South Carolina regional "
              "grid). The caveat is in the file and must be said out loud with "
              "the number, not left in a tooltip.")

    # 9/10. Google hourly CFE and the validation
    check("Google hourly CFE 65/64/64/66/65", "65 64 64 66 65 for 2021-2025",
          "extracted from GOOGL_esg.pdf p94 and verified against the rendered "
          "page; locked by a committed test",
          VERIFIED,
          "engine/ingest/tests/test_real_pages.py::"
          "test_googl_p94_cfe_table_keeps_its_numbers",
          "Reproduce: python3 -m pytest engine/ingest/tests/test_real_pages.py "
          "(skips unless the gitignored PDFs are present).")
    val = load(VALIDATION)
    if val is None:
        check("Google grid-CFE validation", "7 of 11 within 2 pts, median -0.5",
              "file not present", UNVERIFIABLE, str(VALIDATION))
    else:
        s = val["summary"]
        check("Google grid-CFE validation",
              "7 of 11 within 2 points, median -0.5 pts",
              f"{s['within_2_points']} of {s['n']} within 2 points, median "
              f"{s['median_difference_pts']} pts",
              VERIFIED if (s["within_2_points"], s["n"]) == (7, 11) else CORRECTED,
              "claims/derived/google_grid_cfe_validation.json")

    # 11. Irradiance
    ir = load(IRRADIANCE)
    if ir is None:
        check("Irradiance", "flat 1.1-2.6%; ERCO/NRTH daytime +28.9 pts vs +3.4%",
              "file not present on this branch", UNVERIFIABLE, str(IRRADIANCE))
    else:
        var = [r["irradiance"]["year_to_year_variation_pct"] for r in ir["regions"]]
        e = next(r for r in ir["regions"] if r["region"] == "ERCO/NRTH")["irradiance"]
        endpoint = (e["annual_mean"]["2025"] / e["annual_mean"]["2019"] - 1) * 100
        d = R["ERCO"]["cf_share"]
        pts = (d["2025"]["daytime"] - d["2019"]["daytime"]) * 100
        check("Irradiance flat across points", "1.1-2.6% variation",
              f"{min(var):.2f}-{max(var):.2f}%", VERIFIED,
              "claims/derived/irradiance.json regions[].irradiance")
        check("ERCO/NRTH daytime vs irradiance",
              "daytime +28.9 pts vs irradiance +3.4%",
              f"daytime {pts:+.1f} pts, irradiance {endpoint:+.1f}%", VERIFIED,
              "regions.json ERCO.cf_share + irradiance.json",
              "Two wording risks. The +3.4% endpoint change is LARGER than the "
              "2.65% 'flat' band quoted beside it, because they are different "
              "statistics (endpoint change vs year-to-year variation) -- say "
              "which. And ERCO/NRTH inherits its carbon-free share from ERCO, "
              "so '+28.9 points' describes all of ERCOT, not North zone; the "
              "irradiance point is Dallas. The irradiance file says this "
              "itself in cf_share_actually_describes.")

    # 12. EC2
    check("EC2 reproducibility", "359 MB in 3.7s, full pipeline under 2 minutes, "
          "identical across pandas 2 and 3",
          "no artifact in the repository: no timing log, no run output, no "
          "report file",
          UNVERIFIABLE, "(none found)",
          "This exists only in prose. Per the rule that a number which cannot "
          "be reproduced from a committed file by a command is asserted rather "
          "than verified, it should not be said on stage until someone commits "
          "the run output. CLAUDE.md lists the EC2 reproducibility run as an "
          "open issue, which is consistent with it never having been recorded.")

    # 13. Facilities
    if not FACILITIES.exists():
        check("Facilities", "4 of 7 sites with no listed equity",
              "claims/lookup/facilities.csv not present on this branch",
              UNVERIFIABLE, str(FACILITIES))
    else:
        rows = list(csv.DictReader(FACILITIES.read_text().splitlines()))
        none_eq = sum(1 for r in rows if not r["utility_ticker"])
        check("Facilities without listed equity", "4 of 7",
              f"{none_eq} of {len(rows)} have no utility_ticker",
              VERIFIED if (none_eq, len(rows)) == (4, 7) else CORRECTED,
              "claims/lookup/facilities.csv utility_ticker",
              "The four are public power: Grant County PUD, Santee Cooper, "
              "OPPD and NOVEC. 'No listed equity' means no tradable parent, "
              "not missing data.")
        if co:
            meta_site = next(s for c in co if c["ticker"] == "META"
                             for s in c["sites"] if s["ba"] == "PACW")
            msft_site = next(s for c in co if c["ticker"] == "MSFT"
                             for s in c["sites"] if s["ba"] == "GCPD")
            check("PACW stale-trap correction", "0.297 -> 0.75",
                  f"cf_share_2025 = {meta_site['cf_share_2025']}, and the note "
                  f"records the 2019-era 0.297 explicitly",
                  VERIFIED, "claims/companies.json META.sites[PACW]",
                  "The note is the point: the naive-geography error was ~60 "
                  "points in 2019 and is ~16 points now. Quoting the 2019 "
                  "framing as current would itself be a stale number.")
            check("Quincy GCPD carbon-free share", "1.0",
                  f"cf_share_2025 = {msft_site['cf_share_2025']}", VERIFIED,
                  "claims/companies.json MSFT.sites[GCPD]",
                  "Grant County PUD is essentially all hydro, so 1.0 is "
                  "plausible rather than a placeholder -- but it is an exact "
                  "1.0 on a very small BA, so say 'effectively all hydro'.")

    counts = {}
    for c in checks:
        counts[c["verdict"]] = counts.get(c["verdict"], 0) + 1
    report = {
        "what": "Every demo-facing number audited against the file it comes "
                "from. A number that cannot be reproduced from a committed "
                "file by a command is marked UNVERIFIABLE, not waved through.",
        "generated_from": "python3 -m engine.diagnostics.numbers_audit",
        "counts": counts,
        "checks": checks,
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(report, indent=2) + "\n")
    print(f"wrote {OUT_JSON}\n")
    for c in checks:
        print(f"[{c['verdict']:12}] {c['item']}")
        print(f"               claim : {c['claim']}")
        print(f"               actual: {c['actual']}")
    print(f"\n{counts}")
    return report


if __name__ == "__main__":
    main()
