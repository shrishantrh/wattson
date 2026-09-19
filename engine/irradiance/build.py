"""Overlay NASA POWER surface irradiance on daytime vs overnight clean share.

What this module is for: the headline finding is that daytime carbon-free
share rose while overnight stayed flat. The proposed reason is solar. Solar
depends on surface irradiance, which is measured from orbit and owes nothing
to our data pipeline, so it is an independent check on the shape of the story.

What it is NOT: a causal estimate. No share of the change is attributed to
irradiance, and no coefficient is reported.

The expected result is that irradiance is FLAT. That is the point. The
resource was always there in the day and never at night; what changed is the
capacity built to catch it. Flat irradiance is the finding, not a null result.
"""
from __future__ import annotations

import json
import statistics
from pathlib import Path

from ..alerts.quality import SUSPECT_GENERATION_REGIONS
from .aggregate import MONTHLY_PATH, annual_means, monthly_means  # noqa: F401
from .points import POINTS, SOURCE, UNITS

REPO_ROOT = Path(__file__).resolve().parents[2]
REGIONS_PATH = REPO_ROOT / "dashboard" / "public" / "data" / "regions.json"
OUTPUT_PATH = REPO_ROOT / "claims" / "derived" / "irradiance.json"

BASELINE_YEAR = "2019"
COMPARE_YEAR = "2025"

#: Below this, year-to-year variation is noise rather than a trend.
FLAT_CV_PCT = 5.0
#: Points of carbon-free share; below this a move is not worth naming.
MATERIAL_PTS = 3.0

#: Read AFTER seeing the result, not predicted before it. Recorded because a
#: counterexample with no explanation invites the reader to invent one, but
#: flagged post_hoc so it is never mistaken for a test the data passed.
NON_SUPPORT_READING = {
    "SWPP/OPPD": (
        "SWPP's overnight carbon-free share is HIGHER than its daytime share "
        "in every year (0.467 vs 0.357 in 2019), which is the signature of "
        "wind rather than solar. Wind is not diurnal, so both halves of the "
        "day rose together (+5.7 daytime, +5.2 overnight) and the two cannot "
        "separate. This is what the overlay should look like on a wind-led "
        "grid."
    ),
    "CISO": (
        "CISO's overnight share rose far more than its daytime share from "
        "2020 onward (+9.5 vs +0.7 points), and its overnight fuel deltas show "
        "wind up 0.63 GW while hydro fell 0.59 GW. Its 2019 daytime share was "
        "also an unusually high starting point, with a step down in 2020. A "
        "hydro-exposed, wind-adding grid is not where a solar signal shows up "
        "cleanly."
    ),
}

CAVEATS = [
    "Each region is represented by a single hand-picked point. That point is "
    "not a centroid, not a load-weighted average, and not the region. A "
    "balancing authority is a large, irregular, multi-state footprint: PJM "
    "alone spans Chicago to New Jersey.",

    "This is an illustration of a mechanism, not a causal estimate. No share "
    "of the change in carbon-free generation is attributed to irradiance, and "
    "no coefficient is reported.",

    "Irradiance barely changes from year to year. Installed solar capacity is "
    "what changed. Flat irradiance is the expected and correct result here, "
    "not a failed test.",

    "Carbon-free includes nuclear, hydro, wind and geothermal as well as "
    "solar. Only solar is diurnal, so a region's daytime-versus-overnight "
    "split is not a pure solar signal. A wind-heavy region can raise its "
    "overnight share without any solar at all.",

    "Three of the five regions are zones whose carbon-free share is inherited "
    "from the parent balancing authority, so for those the share describes a "
    "much larger footprint than the irradiance point does.",

    "Generation within a footprint, not consumption; interchange is not "
    "allocated.",
]


def load_monthly() -> dict:
    with MONTHLY_PATH.open() as fh:
        return json.load(fh)


def load_regions() -> dict:
    with REGIONS_PATH.open() as fh:
        data = json.load(fh)
    return {"regions": {r["id"]: r for r in data["regions"]},
            "meta": data["meta"]}


def _flatness(annual: dict) -> dict:
    values = [annual[y] for y in sorted(annual)]
    mean = statistics.mean(values)
    sd = statistics.pstdev(values)
    cv = sd / mean * 100.0
    return {
        "years": sorted(annual),
        "annual_mean": {y: round(annual[y], 4) for y in sorted(annual)},
        "mean": round(mean, 4),
        "range": round(max(values) - min(values), 4),
        "year_to_year_variation_pct": round(cv, 2),
        "is_flat": cv < FLAT_CV_PCT,
        "change_pct_2019_2025": round(
            (annual[COMPARE_YEAR] / annual[BASELINE_YEAR] - 1) * 100, 2),
    }


def _verdict(region_id: str, day_delta: float, night_delta: float) -> str:
    if region_id in SUSPECT_GENERATION_REGIONS:
        return "unusable"
    if day_delta <= 0:
        return "contradicts"
    if day_delta < MATERIAL_PTS:
        return "does_not_separate"
    if day_delta - night_delta < MATERIAL_PTS:
        return "does_not_separate"
    return "supports"


def build() -> dict:
    monthly = load_monthly()
    loaded = load_regions()
    regions, meta = loaded["regions"], loaded["meta"]

    rows = []
    for region_id, point in POINTS.items():
        region = regions[region_id]
        annual = monthly["regions"][region_id]["annual"]
        cf = region["cf_share"]

        day_delta = (cf[COMPARE_YEAR]["daytime"] - cf[BASELINE_YEAR]["daytime"]) * 100
        night_delta = (cf[COMPARE_YEAR]["overnight"] - cf[BASELINE_YEAR]["overnight"]) * 100

        inherited = bool(region["cf_inherited_from_ba"])
        describes = region["ba"] if inherited else region_id

        row = {
            "region": region_id,
            "name": region["name"],
            "point": {**point, "note": "representative point, not a centroid"},
            "cf_inherited_from_ba": inherited,
            "cf_share_actually_describes": describes,
            "irradiance": {"units": UNITS, **_flatness(annual)},
            "cf_share": {
                BASELINE_YEAR: {"daytime": cf[BASELINE_YEAR]["daytime"],
                                "overnight": cf[BASELINE_YEAR]["overnight"]},
                COMPARE_YEAR: {"daytime": cf[COMPARE_YEAR]["daytime"],
                               "overnight": cf[COMPARE_YEAR]["overnight"]},
                "daytime_change_pts": round(day_delta, 1),
                "overnight_change_pts": round(night_delta, 1),
            },
            "verdict": _verdict(region_id, day_delta, night_delta),
        }
        if inherited:
            row["scale_mismatch_note"] = (
                f"{region_id} is a zone and reports demand only; its "
                f"carbon-free share is {region['ba']}'s. The irradiance point "
                f"is {point['place']}, inside the zone, while the share "
                f"describes the whole of {region['ba']}. Treat the pairing as "
                f"illustrative."
            )
        if region_id in SUSPECT_GENERATION_REGIONS:
            row["data_caveat"] = SUSPECT_GENERATION_REGIONS[region_id]
        if region_id in NON_SUPPORT_READING:
            row["why_it_does_not_support"] = {
                "post_hoc": True,
                "reading": NON_SUPPORT_READING[region_id],
            }
        rows.append(row)

    supporting = [r["region"] for r in rows if r["verdict"] == "supports"]
    non_supporting = [r["region"] for r in rows if r["verdict"] != "supports"]
    flat_cvs = [r["irradiance"]["year_to_year_variation_pct"] for r in rows]

    statement = (
        f"Surface irradiance is flat at all five points: year-to-year "
        f"variation is {min(flat_cvs)}-{max(flat_cvs)}% with no trend, so the "
        f"solar resource available in {COMPARE_YEAR} is the same resource that "
        f"was there in {BASELINE_YEAR}. Any change in daytime carbon-free "
        f"share is therefore about the capacity built to catch that resource, "
        f"not about the sunlight itself. The pattern of daytime share rising "
        f"while overnight does not appears cleanly in "
        f"{len(supporting)} of {len(rows)} regions ({', '.join(supporting)}). "
        f"The others are reported as they are, not dropped."
    )

    return {
        "generated": meta["generated"],
        "source": SOURCE,
        "parameter": monthly["parameter"],
        "units": UNITS,
        "baseline_year": BASELINE_YEAR,
        "compare_year": COMPARE_YEAR,
        "purpose": (
            "Independent check on the shape of the headline finding. Satellite "
            "irradiance owes nothing to our pipeline, so it can show that the "
            "daytime resource did not change while the daytime clean share did."
        ),
        "national_reference": {
            BASELINE_YEAR: meta["national"]["cf_share"][BASELINE_YEAR],
            COMPARE_YEAR: meta["national"]["cf_share"][COMPARE_YEAR],
            "note": ("National figures are for context. Five points do not test "
                     "a national claim."),
        },
        "conclusion": {
            "statement": statement,
            "irradiance_is_flat_everywhere": all(r["irradiance"]["is_flat"] for r in rows),
            "supporting_regions": supporting,
            "non_supporting_regions": non_supporting,
        },
        "caveats": CAVEATS,
        "regions": rows,
    }


def write(result: dict) -> Path:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w") as fh:
        json.dump(result, fh, indent=2)
        fh.write("\n")
    return OUTPUT_PATH
