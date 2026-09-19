"""Reduce the raw NASA POWER daily series to a small committed monthly file.

The raw daily pull lives under data/, which is gitignored and absent on every
machine in this run. Aggregating to monthly here keeps the build reproducible
without a network call and without committing 230 kB of daily readings.
"""
from __future__ import annotations

import json
from pathlib import Path

from .points import NASA_FILL_VALUE, PARAMETER, POINTS

REPO_ROOT = Path(__file__).resolve().parents[2]
RAW_CACHE = REPO_ROOT / "data" / "irradiance_cache"
MONTHLY_PATH = Path(__file__).resolve().parent / "monthly.json"


def _valid(daily: dict) -> dict:
    return {k: v for k, v in daily.items()
            if v is not None and v > NASA_FILL_VALUE + 1.0}


def monthly_means(daily: dict) -> dict:
    buckets: dict[str, list] = {}
    for day, value in _valid(daily).items():
        buckets.setdefault(f"{day[:4]}-{day[4:6]}", []).append(value)
    return {k: sum(v) / len(v) for k, v in sorted(buckets.items())}


def annual_means(daily: dict) -> dict:
    buckets: dict[str, list] = {}
    for day, value in _valid(daily).items():
        buckets.setdefault(day[:4], []).append(value)
    return {k: sum(v) / len(v) for k, v in sorted(buckets.items())}


def build_monthly() -> dict:
    out = {"parameter": PARAMETER, "source": "NASA POWER daily point API",
           "regions": {}}
    for region in POINTS:
        path = RAW_CACHE / (region.replace("/", "_") + ".json")
        with path.open() as fh:
            daily = json.load(fh)["properties"]["parameter"][PARAMETER]
        out["regions"][region] = {
            "monthly": monthly_means(daily),
            "annual": annual_means(daily),
            "days": len(_valid(daily)),
            "days_dropped_as_fill": len(daily) - len(_valid(daily)),
        }
    return out


def write_monthly() -> Path:
    with MONTHLY_PATH.open("w") as fh:
        json.dump(build_monthly(), fh, indent=1, sort_keys=True)
        fh.write("\n")
    return MONTHLY_PATH


if __name__ == "__main__":
    print(f"wrote {write_monthly()}")
