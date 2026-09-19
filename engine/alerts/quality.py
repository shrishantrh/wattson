"""Data-quality caveats for the exported alert feed.

`data/` is absent on every machine in this run, so the pipeline cannot be
re-run and the exports are frozen inputs. Known-bad numbers therefore cannot
be fixed upstream; they are annotated here instead, and the clearly
artificial ones are withheld from the demo list rather than deleted.

Sources for each entry below are named so a human can re-check them.
"""
from __future__ import annotations

#: Regions whose GENERATION-side series contain a documented discontinuity.
#: Recorded in CLAUDE.md ("Known open issues") but NOT machine-readable in
#: regions.json, which carries a data_flags entry for WACM only. Without this
#: list a reporting artefact ranks first on the demo screen.
SUSPECT_GENERATION_REGIONS = {
    "AZPS": (
        "Overnight clean share reads ~0.15 in 2025 against 0.62 in 2019 and "
        "overnight clean generation reads ~356 MW against a 3,373 MW 2019 "
        "baseline. CLAUDE.md records this as almost certainly a reporting "
        "change, not a real collapse. Demand-side AZPS numbers are sound and "
        "are still ranked."
    ),
}

#: Rules that read the generation side of the grid.
GENERATION_RULES = {
    "cf_share_down_3pts",
    "clean_mw_below_2019",
    "gas_share_up_3pts_yoy",
}


def caveat_for(alert: dict, feed_latest_month: str) -> str | None:
    """Return a human-readable caveat for this alert, or None if it is clean."""
    region = alert.get("region")
    if alert.get("rule") in GENERATION_RULES and region in SUSPECT_GENERATION_REGIONS:
        return SUSPECT_GENERATION_REGIONS[region]

    latest = alert.get("latest_month")
    if latest is not None and latest > feed_latest_month:
        return (
            f"Computed on a trailing-12 window ending {latest}, one month past "
            f"the {feed_latest_month} window every other rule uses. The data "
            f"snapshot ends 2026-09-05, so {latest} is a partial month, and "
            "CLAUDE.md's frozen decisions drop partial months from "
            "trailing-12 series. Value is likely biased."
        )
    return None


def is_artificial(alert: dict) -> bool:
    """True when the alert's magnitude is an artefact rather than a signal."""
    return (alert.get("rule") in GENERATION_RULES
            and alert.get("region") in SUSPECT_GENERATION_REGIONS)


def partition(alerts, feed_latest_month: str):
    """Split into (ranked, withheld_for_review), annotating both.

    Nothing is discarded: withheld alerts keep their full original content and
    carry the reason they were held back.
    """
    kept, withheld = [], []
    for a in alerts:
        entry = dict(a)
        caveat = caveat_for(a, feed_latest_month)
        if caveat is not None:
            entry["data_caveat"] = caveat
        (withheld if is_artificial(a) else kept).append(entry)
    return kept, withheld
