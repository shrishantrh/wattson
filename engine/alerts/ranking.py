"""Rank active grid alerts by severity = magnitude x persistence x recency.

Every factor is dimensionless and bounded, so alerts from different rules
(MW, 0-1 shares, detector rank) are comparable on one axis.

magnitude   how far past its own threshold an alert sits, expressed relative
            to that region's own scale. 500 MW in a 2 GW region outranks
            500 MW in PJM.
persistence sustained crossings beat one-month spikes; saturates at 24 months
            so a chronic alert cannot dominate on age alone.
recency     recent crossings outrank old ones; three-year half-life.

Structural alerts (the flat-load detector) carry no time series, so their
persistence and recency are neutral 1.0 and severity reduces to magnitude.
"""
from __future__ import annotations

# Latest complete month in the exported feed. Overridden by the caller.
DEFAULT_AS_OF_MONTH = "2026-08"

PERSISTENCE_SATURATION_MONTHS = 24
RECENCY_HALF_LIFE_YEARS = 3.0
DEFAULT_LIMIT = 20

DETECTOR_RANK_CUTOFF = 10


def _months(ym: str) -> int:
    year, month = ym.split("-")
    return int(year) * 12 + int(month)


def _pos(x: float) -> float:
    """Clamp at zero: an alert cannot sit a negative distance past itself."""
    return x if x > 0.0 else 0.0


def magnitude(a: dict) -> float:
    """Distance past threshold, normalised to the region's own scale."""
    rule = a["rule"]
    current = a["current_value"]
    baseline = a.get("baseline_2019")
    threshold = a.get("threshold")

    if rule == "detector_top10":
        # current_value is the detector rank; rank 1 is the strongest signal.
        return _pos((DETECTOR_RANK_CUTOFF + 1 - current) / DETECTOR_RANK_CUTOFF)

    if rule == "gas_share_up_3pts_yoy":
        # threshold is a year-over-year DELTA, not a level. current_value is
        # the gas share itself, so comparing it to the threshold would
        # overstate the exceedance by the whole level.
        return _pos(a["current_value_yoy_delta"] - threshold)

    if rule == "cf_share_down_3pts":
        # Shares are 0-1 fractions; the drop below baseline is already
        # dimensionless and comparable across regions.
        return _pos(baseline - current)

    if rule == "clean_mw_below_2019":
        return _pos((threshold - current) / baseline)

    if rule == "demand_record_high":
        # No threshold on a record high; measure growth over the 2019 baseline.
        return _pos((current - baseline) / baseline)

    # demand_up_20pct and any future MW rule.
    return _pos((current - threshold) / baseline)


def persistence(a: dict) -> float:
    streak = a.get("months_active_streak")
    if streak is None:
        return 1.0
    return min(1.0, streak / PERSISTENCE_SATURATION_MONTHS)


def recency(a: dict, as_of_month: str = DEFAULT_AS_OF_MONTH) -> float:
    crossed = a.get("first_crossed")
    if crossed is None:
        return 1.0
    years = max(0.0, (_months(as_of_month) - _months(crossed)) / 12.0)
    return 0.5 ** (years / RECENCY_HALF_LIFE_YEARS)


def severity(a: dict, as_of_month: str = DEFAULT_AS_OF_MONTH) -> float:
    return float(magnitude(a) * persistence(a) * recency(a, as_of_month))


def rank(alerts, regions, limit: int = DEFAULT_LIMIT,
         as_of_month: str = DEFAULT_AS_OF_MONTH) -> dict:
    """Filter, score, dedupe by region and cap.

    regions maps region id -> region record from regions.json.
    Returns {"alerts": [...], "dropped": {reason: count}}.
    """
    dropped = {
        "inactive": 0,
        "excluded_region": 0,
        "record_high_not_top10": 0,
        "deduped_same_region": 0,
        "over_limit": 0,
    }
    scored = []
    for a in alerts:
        if not a.get("active"):
            dropped["inactive"] += 1
            continue

        region = regions.get(a["region"], {})
        if region.get("exclude_from_alerts"):
            dropped["excluded_region"] += 1
            continue

        if a["rule"] == "demand_record_high" and not _is_top10(region):
            dropped["record_high_not_top10"] += 1
            continue

        entry = dict(a)
        entry["severity"] = severity(a, as_of_month)
        entry["severity_factors"] = {
            "magnitude": magnitude(a),
            "persistence": persistence(a),
            "recency": recency(a, as_of_month),
        }
        scored.append(entry)

    strongest = {}
    for entry in scored:
        held = strongest.get(entry["region"])
        if held is None:
            strongest[entry["region"]] = entry
        else:
            dropped["deduped_same_region"] += 1
            if entry["severity"] > held["severity"]:
                strongest[entry["region"]] = entry

    ordered = sorted(strongest.values(),
                     key=lambda e: (-e["severity"], e["region"]))
    if len(ordered) > limit:
        dropped["over_limit"] = len(ordered) - limit
        ordered = ordered[:limit]

    return {"alerts": ordered, "dropped": dropped}


def _is_top10(region: dict) -> bool:
    detection = region.get("detection") or {}
    rank_ = detection.get("rank")
    return rank_ is not None and rank_ <= DETECTOR_RANK_CUTOFF
