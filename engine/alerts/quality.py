"""Data-quality withholding for the exported alert feed.

`data/` is absent on every machine in this run, so the pipeline cannot be
re-run and the exports are frozen inputs. Known-bad numbers therefore cannot
be fixed upstream. They are withheld from the demo list with a reason
attached, never deleted and never quietly corrected.

Sources for each entry are named so a human can re-check them.
"""
from __future__ import annotations

SUSPECT_GENERATION = "suspect_generation_reporting"

#: Regions whose GENERATION-side series contain a documented discontinuity.
#: Recorded in CLAUDE.md ("Known open issues") but NOT machine-readable
#: anywhere: regions.json carries data_flags for WACM only, AZPS has
#: data_flags: [], and alerts.json lists excluded_regions: ["WACM"]. Without
#: this list an 87% reporting artefact ranks first on the demo screen.
SUSPECT_GENERATION_REGIONS = {
    "AZPS": (
        "Overnight clean share reads ~0.15 in 2025 against 0.62 in 2019 and "
        "overnight clean generation ~356 MW against a 3,373 MW 2019 baseline. "
        "CLAUDE.md records this as almost certainly a reporting change, not a "
        "real collapse; no real grid loses 87% of its clean generation. "
        "AZPS's DEMAND-side numbers are sound and still rank: it holds "
        "detector rank 3 on demand evidence alone."
    ),
}

#: Rules that read the generation side of the grid.
GENERATION_RULES = {
    "cf_share_down_3pts",
    "clean_mw_below_2019",
    "gas_share_up_3pts_yoy",
}


def _partial_month_reason(latest: str) -> str:
    return "partial_month_" + latest.replace("-", "_")


def withhold_reason(alert: dict, feed_latest_month: str) -> str | None:
    """Machine-readable reason this alert is unfit to rank, or None."""
    if (alert.get("rule") in GENERATION_RULES
            and alert.get("region") in SUSPECT_GENERATION_REGIONS):
        return SUSPECT_GENERATION

    latest = alert.get("latest_month")
    if latest is not None and latest > feed_latest_month:
        return _partial_month_reason(latest)
    return None


def caveat_for(alert: dict, feed_latest_month: str) -> str | None:
    """Human-readable explanation matching withhold_reason, or None."""
    reason = withhold_reason(alert, feed_latest_month)
    if reason is None:
        return None
    if reason == SUSPECT_GENERATION:
        return SUSPECT_GENERATION_REGIONS[alert["region"]]

    latest = alert["latest_month"]
    return (
        f"Computed on a trailing-12 window ending {latest}, one month past "
        f"the {feed_latest_month} window every other rule uses. The data "
        f"snapshot ends 2026-09-05, so {latest} holds five days, and "
        "CLAUDE.md's frozen decisions drop partial months from trailing-12 "
        "series. A five-day number must not sit beside full-month numbers on "
        "one screen. Root cause is in scripts/export_json.py and cannot be "
        "fixed here: nothing on this machine can run the pipeline."
    )


def annotate(alerts, feed_latest_month: str) -> list:
    """Attach data_caveat and withheld_reason where they apply."""
    out = []
    for a in alerts:
        entry = dict(a)
        reason = withhold_reason(a, feed_latest_month)
        if reason is not None:
            entry["withheld_reason"] = reason
            entry["data_caveat"] = caveat_for(a, feed_latest_month)
        out.append(entry)
    return out


def should_withhold(alert: dict, feed_latest_month: str) -> bool:
    return withhold_reason(alert, feed_latest_month) is not None


def partition(alerts, feed_latest_month: str):
    """Split into (rankable, withheld_for_review), annotating both.

    Nothing is discarded: withheld alerts keep their full original content and
    carry both a machine-readable reason and a human-readable caveat.
    """
    kept, withheld = [], []
    for entry in annotate(alerts, feed_latest_month):
        (withheld if "withheld_reason" in entry else kept).append(entry)
    return kept, withheld
