"""Load the exported feed, rank it, and write the demo shortlist.

Inputs under dashboard/public/data are READ ONLY and are never written to.
"""
from __future__ import annotations

import json
from pathlib import Path

from . import quality
from .ranking import DEFAULT_LIMIT, rank

REPO_ROOT = Path(__file__).resolve().parents[2]
ALERTS_PATH = REPO_ROOT / "dashboard" / "public" / "data" / "alerts.json"
REGIONS_PATH = REPO_ROOT / "dashboard" / "public" / "data" / "regions.json"
OUTPUT_PATH = REPO_ROOT / "claims" / "derived" / "alerts_ranked.json"


def load_alerts() -> dict:
    with ALERTS_PATH.open() as fh:
        return json.load(fh)


def load_regions() -> list:
    with REGIONS_PATH.open() as fh:
        return json.load(fh)["regions"]


def build(limit: int = DEFAULT_LIMIT) -> dict:
    feed = load_alerts()
    regions = {r["id"]: r for r in load_regions()}
    feed_latest_month = feed["latest_month"]

    # Withhold known artefacts BEFORE deduplication, so they surface with a
    # reason instead of vanishing into the dedupe count.
    ranked = rank(feed["alerts"], regions, limit=limit,
                  as_of_month=feed_latest_month,
                  withhold=lambda a: quality.should_withhold(a, feed_latest_month))

    kept = quality.annotate(ranked["alerts"], feed_latest_month)
    withheld = quality.annotate(ranked["withheld"], feed_latest_month)

    return {
        "generated_from": feed.get("generated"),
        "latest_month": feed_latest_month,
        "method": (
            "severity = magnitude x persistence x recency. magnitude is the "
            "distance past each rule's threshold normalised to that region's "
            "own scale; persistence saturates at 24 months; recency decays "
            "with a 3-year half-life. Deduplicated to the strongest alert per "
            "region. Ranking and filtering only: alert text, thresholds and "
            "first_crossed dates are unchanged."
        ),
        "source_alerts_total": len(feed["alerts"]),
        "source_alerts_active": sum(1 for a in feed["alerts"] if a["active"]),
        "limit": limit,
        "count": len(kept),
        "alerts": kept,
        "withheld_for_review": withheld,
        "dropped": ranked["dropped"],
    }


def write(result: dict) -> Path:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w") as fh:
        json.dump(result, fh, indent=2)
        fh.write("\n")
    return OUTPUT_PATH
