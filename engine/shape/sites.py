"""The mapped-datacenter-site label, used ONLY to score results, never as an input.

`claims/lookup/facilities.csv` is 134 sites hand-mapped from serving utilities and
public filings. This module turns it into a set of region ids. Nothing here reads
`data/processed/l3_detector.csv`, `dashboard/public/data/regions.json` or any other
detector product: the clustering and the changepoint search never see these labels,
they are joined on at the very end to ask whether the unsupervised structure lines
up with sites we knew about independently.

Honest caveat, applied as a sensitivity rather than hidden in prose: 9 of the 134
rows mention the detector in their free-text `note`, which means the curation of the
lookup was not perfectly blind to the detector's ranking. `label_sets()` therefore
also returns a detector-blind subset (those 9 rows dropped) and a
validation-excluded subset (the four regions that were named in advance as the
detector's validation set dropped entirely). If the enrichment survives those, the
result is not an artefact of how the lookup was built.
"""
from __future__ import annotations

import csv
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
FACILITIES = REPO_ROOT / "claims" / "lookup" / "facilities.csv"

# Regions the shipped detector named in advance as its validation set. Listed here
# only so they can be REMOVED for a sensitivity run.
VALIDATION_REGIONS = ("PJM/DOM", "PJM/AEP", "SWPP/OPPD", "ERCO/NCEN")

# A site whose note says the load runs behind its own meter, is interruptible, or has
# not energised yet is a site EIA-930 cannot see. Those rows are dropped in the
# "visible" sensitivity: they are real datacenters but they are not demand.
INVISIBLE = re.compile(
    r"behind[- ]the[- ]meter|behind the meter|self-generat|interruptible|"
    r"demand response|curtail|never (?:sees|see) the load|"
    r"little load yet|first power|will power the campus independently",
    re.I,
)
DETECTOR_MENTION = re.compile(r"detector", re.I)


def rows() -> list[dict]:
    with FACILITIES.open(newline="") as fh:
        return list(csv.DictReader(fh))


def region_of(row: dict) -> str:
    """The region id a site sits in. `zone` already carries the full 'BA/ZONE' id."""
    return (row.get("zone") or "").strip() or (row.get("ba") or "").strip()


def label_sets(universe) -> dict:
    """Region-level site labels, plus the pre-specified sensitivity variants.

    universe: the region ids actually scored (so a site in a region below the 500 MW
    floor, or one that does not report a full year, is counted as out of scope
    rather than silently as a negative).
    """
    universe = set(universe)
    all_rows = rows()

    def regions_from(rs):
        counts: dict[str, int] = {}
        for r in rs:
            reg = region_of(r)
            if reg in universe:
                counts[reg] = counts.get(reg, 0) + 1
        return counts

    blind = [r for r in all_rows if not DETECTOR_MENTION.search(r.get("note", ""))]
    visible = [r for r in all_rows if not INVISIBLE.search(r.get("note", ""))]

    counts_all = regions_from(all_rows)
    out = {
        "all": counts_all,
        "detector_blind": regions_from(blind),
        "visible_load": regions_from(visible),
        "heavy": {k: v for k, v in counts_all.items() if v >= 3},
        "validation_excluded": {k: v for k, v in counts_all.items()
                                if k not in VALIDATION_REGIONS},
    }
    out["_meta"] = {
        "facilities_csv_rows": len(all_rows),
        "rows_mentioning_detector_in_note": len(all_rows) - len(blind),
        "rows_flagged_invisible_to_eia930": len(all_rows) - len(visible),
        "rows_outside_scored_universe": sum(
            1 for r in all_rows if region_of(r) not in universe),
        "distinct_regions_in_csv": len({region_of(r) for r in all_rows}),
        "heavy_threshold_sites": 3,
    }
    return out


def announced_years() -> list[dict]:
    """Sites whose free-text note names a year, for the changepoint cross-check.

    The note is prose, not a schema field, so this is a best-effort extraction and is
    reported as such: every row it returns is printed with its note so a human can see
    what the year actually refers to. Some are build dates, some are acquisitions, some
    are grid-mix figures for a year. Nothing downstream trusts them blindly.
    """
    out = []
    for r in rows():
        note = r.get("note", "")
        years = sorted({int(y) for y in re.findall(r"\b(?:19|20)\d{2}\b", note)})
        years = [y for y in years if 2015 <= y <= 2030]
        if years:
            out.append({
                "company": r["company"], "metro": r["metro"], "region": region_of(r),
                "years": years, "note": note,
                "invisible_to_eia930": bool(INVISIBLE.search(note)),
            })
    return out
