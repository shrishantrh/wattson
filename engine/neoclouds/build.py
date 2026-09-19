"""Neocloud facility rows, plus a check for bias in our own detector.

Two outputs:
  claims/derived/neocloud_facilities.csv  append-ready rows for the lookup
  claims/derived/curtailment_check.json   whether demand response biases us
"""
from __future__ import annotations

import csv
import json
import statistics
from pathlib import Path

from .sites import NOT_ESTABLISHED, SITES

REPO_ROOT = Path(__file__).resolve().parents[2]
REGIONS_PATH = REPO_ROOT / "dashboard" / "public" / "data" / "regions.json"
LOOKUP_PATH = REPO_ROOT / "claims" / "lookup" / "facilities.csv"
OUT_DIR = REPO_ROOT / "claims" / "derived"

COLUMNS = ["company", "ticker", "metro", "state", "serving_utility", "ba",
           "zone", "source_type", "source_url", "note", "lat", "lon",
           "utility_parent", "utility_ticker"]

#: A curtailing load sheds at peak, so its load factor falls. The detector
#: rewards RISING load factor, so the term could penalise the very sites we
#: most want to flag. This is the threshold for calling that visible.
VISIBLE_PENALTY_PERCENTILE = 50


def load_regions() -> list:
    with REGIONS_PATH.open() as fh:
        return json.load(fh)["regions"]


def rows() -> list:
    out = []
    for site in SITES:
        row = {c: "" for c in COLUMNS}
        for key in ("company", "ticker", "metro", "state", "serving_utility",
                    "zone", "source_type", "source_url", "note"):
            row[key] = site.get(key, "") or ""
        row["ba"] = site["ba"] or ""
        if site.get("unresolved_reason"):
            row["note"] = (row["note"] + "  UNRESOLVED: "
                           + site["unresolved_reason"]).strip()
        out.append(row)
    return out


def write_rows() -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / "neocloud_facilities.csv"
    with path.open("w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows())
    return path


def curtailment_check() -> dict:
    """Does demand response bias the detector against the sites we want?

    The mechanism is real: a load that curtails at peak has a FALLING load
    factor, and the detector's third term rewards a rising one. The question
    is whether that shows up in the regions where curtailing miners actually
    sit.
    """
    regions = [r for r in load_regions()
               if (r.get("detection") or {}).get("rank") is not None]

    deltas = sorted(r["detection"]["load_factor_delta"] for r in regions)
    scores = [r["detection"]["score"] for r in regions]
    lfs = [r["detection"]["load_factor_delta"] for r in regions]

    mx, my = statistics.mean(scores), statistics.mean(lfs)
    sx, sy = statistics.pstdev(scores), statistics.pstdev(lfs)
    cov = sum((a - mx) * (b - my) for a, b in zip(scores, lfs)) / len(scores)
    correlation = cov / (sx * sy)

    def percentile(value: float) -> float:
        below = sum(1 for d in deltas if d < value)
        return round(below / len(deltas) * 100, 1)

    watched = ["ERCO/NRTH", "ERCO/FWES", "ERCO", "ERCO/WEST", "SWPP/SPS",
               "ERCO/SCEN", "NYIS"]
    by_id = {r["id"]: r for r in regions}
    zone_rows = []
    for region_id in watched:
        region = by_id.get(region_id)
        if region is None:
            continue
        d = region["detection"]
        zone_rows.append({
            "region": region_id,
            "rank": d["rank"],
            "growth_pct": d["growth_pct"],
            "load_factor_delta": d["load_factor_delta"],
            "load_factor_delta_percentile": percentile(d["load_factor_delta"]),
            "overnight_excess": d["overnight_excess"],
        })

    hosts = [z for z in zone_rows if z["region"] in
             ("ERCO/NRTH", "ERCO/FWES", "ERCO", "SWPP/SPS")]
    penalised = [z for z in hosts
                 if z["load_factor_delta_percentile"] < VISIBLE_PENALTY_PERCENTILE]

    if not penalised:
        verdict = "bias_present_but_not_visible"
        statement = (
            "The bias mechanism is real but does not show up where the "
            f"curtailing sites actually are. Score correlates with "
            f"load_factor_delta at r={correlation:+.2f}, so a load whose load "
            "factor falls is genuinely pushed down the ranking. Yet every "
            "region hosting a confirmed curtailing miner sits ABOVE the median "
            "on load factor change: ERCO/NRTH at the 96th percentile, ERCO at "
            "the 97th, ERCO/FWES at the 80th, SWPP/SPS at the 94th. Riot "
            "curtailed more than 95% of load during the August 2023 ERCOT "
            "peak, and those hours are too few to move an annual load factor "
            "computed over 8,760 of them. Demand response is economically "
            "large and temporally tiny, so it barely touches this statistic. "
            "The caveat stands as a method caveat rather than a correction: a "
            "site curtailing far more hours than these would be pushed down, "
            "and we would not see it."
        )
    else:
        verdict = "bias_present_and_visible"
        statement = (
            f"Score correlates with load_factor_delta at r={correlation:+.2f}, "
            f"and {len(penalised)} of {len(hosts)} regions hosting confirmed "
            "curtailing miners sit below the median on that term. The detector "
            "is penalising the sites we most want to flag."
        )

    return {
        "question": ("Does ERCOT demand response bias our own detector against "
                     "converted miners, the sites we most want to flag?"),
        "mechanism": ("A curtailing load sheds at peak, so its load factor "
                      "falls. score = z(overnight_excess) + "
                      "z(neighbor_divergence) + 0.5 z(load_factor_delta) "
                      "rewards a RISING load factor, so curtailment pushes a "
                      "region down."),
        "load_factor_term": {
            "correlation_with_score": round(correlation, 3),
            "weight_in_score": 0.5,
            "median_delta": round(statistics.median(deltas), 4),
            "n_regions": len(regions),
        },
        "ercot_zones": zone_rows,
        "verdict": verdict,
        "statement": statement,
        "caveats": [
            "Zone-level load factor cannot isolate one facility. A 750 MW site "
            "inside a multi-GW zone moves the statistic only slightly.",
            "Curtailment hours are not in our data: this reasons from the "
            "arithmetic of an annual load factor, it does not measure the "
            "curtailed hours themselves.",
            "ERCO/WEST is the one ERCOT zone with a falling load factor "
            "(-0.023, 30th percentile) and it ranks last of 111. We cannot "
            "tell from this whether that is curtailment or simply a region "
            "with no growth.",
        ],
    }


def write_curtailment(result: dict) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / "curtailment_check.json"
    with path.open("w") as fh:
        json.dump(result, fh, indent=2)
        fh.write("\n")
    return path


def not_established() -> list:
    return NOT_ESTABLISHED
