"""Generating Alpha: the chain from a metered grid measurement to a market.

What this is: for each region our detector ranks highly, the evidenced chain
  region -> the fuel that filled its growth -> the serving utility -> its
  parent -> its ticker -> the markets where that region's tightness is priced.

What this is NOT: a forecast, a backtest, or a recommendation. We have no
validation that this signal predicts any price, and every reason attached to
an instrument must cite a number from our own data rather than an opinion.
The frame is INPUT, not ANSWER.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

from . import kalshi

REPO_ROOT = Path(__file__).resolve().parents[2]
REGIONS_PATH = REPO_ROOT / "dashboard" / "public" / "data" / "regions.json"
OPERATORS_PATH = REPO_ROOT / "claims" / "derived" / "operators_verified.json"
FACILITIES_PATH = REPO_ROOT / "claims" / "lookup" / "facilities.csv"
FACILITIES_EXPORT = REPO_ROOT / "server" / "static_export" / "facilities.json"

#: Regions to show: the detector's top ranks, plus PJM because the headline
#: finding is PJM's. Kept short so every row can be read and checked.
FEATURED = ["ERCO/NRTH", "ERCO/FWES", "AZPS", "TEPC", "PJM/DOM", "SWPP/OPPD",
            "ERCO", "PJM"]

#: Event series that apply to every region, not to one grid.
NATIONAL_SERIES = ["KXNATGASD", "KXNATGASMON", "KXPOWERKWH",
                   "KXDATACENTCON", "KXUSADATACENTERS", "KXRATEPAYERLAW"]

#: Event series tied to a specific grid.
REGIONAL_SERIES = {
    "ERCO": ["KXTXERCOTPEAK", "KXERCOTX"],
    "PJM": ["KXUTILITYPJMWEST", "KXMARCELLUSGAS", "KXTLNA", "KXILNUCLEAR"],
}

LIMITS = [
    "We have no validation that this signal predicts prices. None. Nothing on "
    "this page has been tested against a price series, and we have run no "
    "backtest. What we measure is physical: metered generation and demand.",

    "A material share of this buildout lands where there is nothing to trade. "
    "Of the 12 sites whose serving utility we could establish, 5 are served by "
    "public power, a cooperative or a state authority with no listed equity.",

    "Regions are coarse. PJM spans Chicago to New Jersey, and a utility's "
    "exposure to one zone is not its whole business. A ticker appearing here "
    "means that company serves load in that footprint, not that the footprint "
    "drives the company.",

    "This is not investment advice, and nobody who built this is licensed to "
    "give it. The page shows a physical input and stops there.",

    "We measure generation inside a footprint, not consumption, and we do not "
    "allocate interchange. Average grid mix, not marginal emissions.",
]


def load_regions() -> dict:
    with REGIONS_PATH.open() as fh:
        return {r["id"]: r for r in json.load(fh)["regions"]}


def load_operators() -> list:
    with OPERATORS_PATH.open() as fh:
        return json.load(fh)["operators"]


def load_facilities() -> list:
    with FACILITIES_PATH.open() as fh:
        return list(csv.DictReader(fh))


def load_facilities_summary() -> dict:
    with FACILITIES_EXPORT.open() as fh:
        return json.load(fh)


def _fuel_sentence(region: dict) -> tuple[str, dict, str | None]:
    """Name the fuels that actually moved, largest first.

    Zones report demand only and inherit the parent BA's generation, so a zone's
    fuel figures are the whole BA's. Saying so inline is not optional: a line
    reading "gas +6.62 GW" under ERCO/NRTH otherwise looks like that zone's own
    mix rather than all of ERCOT's.
    """
    inherited = region["ba"] if region.get("cf_inherited_from_ba") else None
    suffix = ("" if not inherited else
              f" These are {inherited}'s figures: {region['id']} reports demand "
              f"only and inherits its parent BA's generation.")
    deltas = {k: v for k, v in (region.get("fuel_delta_overnight_gw") or {}).items()
              if v is not None and abs(v) >= 0.1}
    if not deltas:
        return ("Overnight fuel mix did not move by more than 0.1 GW on any "
                "single fuel between 2019 and 2025." + suffix, {}, inherited)
    top = sorted(deltas.items(), key=lambda kv: -abs(kv[1]))[:3]
    parts = [f"{k} {v:+.2f} GW" for k, v in top]
    return (f"Overnight generation 2019 to 2025: {', '.join(parts)}." + suffix,
            dict(top), inherited)


def _equities(region_id: str, operators: list, facilities: list) -> list:
    """Serving utilities and their parents, from the verified table only."""
    out, seen = [], set()
    for op in operators:
        if region_id not in op.get("regions", []) or not op.get("ticker"):
            continue
        if op["ticker"] in seen:
            continue
        seen.add(op["ticker"])
        # Use the corrected name where the verification table corrected one:
        # "AEP Texas North" merged into AEP Texas Inc. in 2016 and rendering
        # the stale name would put a defunct company on a public page.
        utility = op["utility"]
        correction = op.get("correction") or {}
        if correction.get("field") == "utility":
            utility = correction["new"]
        row = {
            "class": "equity",
            "symbol": op["ticker"],
            "name": op["parent"],
            "role": f"{utility} serves load in {region_id}",
            "exchange": op.get("exchange"),
            "source_url": op["source_url"],
            "verification_status": op["status"],
            "why": "",
        }
        if op.get("pending_change"):
            row["pending_change"] = op["pending_change"]
        out.append(row)

    for f in facilities:
        rid = f.get("zone") or f.get("ba")
        if rid != region_id or not f.get("utility_ticker"):
            continue
        if f["utility_ticker"] in seen:
            continue
        seen.add(f["utility_ticker"])
        out.append({
            "class": "equity",
            "symbol": f["utility_ticker"],
            "name": f.get("utility_parent") or f["serving_utility"],
            "role": f"{f['serving_utility']} serves the {f['company']} "
                    f"{f['metro']} site",
            "exchange": None,
            "source_url": f["source_url"],
            "verification_status": "facility_lookup",
            "why": "",
        })
    return out


def _commodities(region_id: str, region: dict, fuels: dict) -> list:
    out = []
    gas = fuels.get("gas")
    if gas and gas > 0:
        out.append({
            "class": "commodity",
            "symbol": "NG (Henry Hub)",
            "name": "US natural gas benchmark",
            "why": (f"Gas supplied the largest overnight generation increase in "
                    f"{region_id}: {gas:+.2f} GW between 2019 and 2025. Henry "
                    f"Hub and regional basis price that fuel."),
            "source_url": None,
        })
    coal = fuels.get("coal")
    if coal is not None and coal < 0 and gas and gas > 0:
        out[-1]["why"] += (f" Coal fell {abs(coal):.2f} GW over the same hours, "
                           f"so gas replaced retiring baseload as well as "
                           f"serving growth.")
    det = region.get("detection") or {}
    growth = det.get("growth_pct")
    if growth is not None and growth >= 20:
        out.append({
            "class": "commodity",
            "symbol": "Regional power",
            "name": f"Wholesale power in {region_id}",
            "why": (f"{region_id} demand grew {growth:+.1f}% against 2019 with "
                    f"an overnight excess of {det.get('overnight_excess', 0):+.1f} "
                    f"points, which is where scarcity shows up in price first."),
            "source_url": None,
        })
    return out


def _events(region_id: str, region: dict, snapshot: dict) -> list:
    if not snapshot.get("available"):
        return []
    det = region.get("detection") or {}
    ba = region_id.split("/")[0]
    wanted = list(REGIONAL_SERIES.get(ba, [])) + NATIONAL_SERIES

    out = []
    for series_ticker in wanted:
        series = (snapshot.get("series") or {}).get(series_ticker)
        if not series or not series["markets"]:
            continue
        out.append({
            "class": "event",
            "series": series_ticker,
            "name": series["label"],
            "venue": "Kalshi",
            "markets": series["markets"][:4],
            "why": _event_why(series_ticker, region_id, det),
            "source_url": f"https://kalshi.com/markets/{series_ticker.lower()}",
        })
    return out


def _event_why(series_ticker: str, region_id: str, det: dict) -> str:
    rank = det.get("rank")
    growth = det.get("growth_pct", 0)
    base = f"{region_id} ranks {rank} of 111 on our detector with {growth:+.1f}% demand growth"
    return {
        "KXTXERCOTPEAK": f"{base}; this market settles on ERCOT's annual peak system load.",
        "KXERCOTX": f"{base}; this market settles on the renewable share of Texas generation.",
        "KXUTILITYPJMWEST": f"{base}; this market settles on PJM West power prices.",
        "KXMARCELLUSGAS": f"{base}, and gas filled it; Marcellus is the supply basin feeding PJM.",
        "KXTLNA": f"{base}; Talen is a verified PJM generator in our operator table.",
        "KXILNUCLEAR": f"{base}; Illinois nuclear sits inside the PJM footprint.",
        "KXNATGASD": f"{base}, and gas filled that growth; this settles on the daily Henry Hub price.",
        "KXNATGASMON": f"{base}, and gas filled that growth; this settles on the monthly Henry Hub price.",
        "KXPOWERKWH": f"{base}; this settles on the US average retail electricity price.",
        "KXDATACENTCON": f"{base}; this settles on US datacenter construction spending.",
        "KXUSADATACENTERS": f"{base}; this settles on the number of US datacenters.",
        "KXRATEPAYERLAW": f"{base}; this settles on whether federal datacenter power-cost standards become law.",
    }.get(series_ticker, base + ".")


def build() -> dict:
    regions = load_regions()
    operators = load_operators()
    facilities = load_facilities()
    summary = load_facilities_summary()
    snapshot = kalshi.load()

    chains = []
    for region_id in FEATURED:
        region = regions.get(region_id)
        if region is None:
            continue
        det = region.get("detection") or {}
        sentence, fuels, inherited = _fuel_sentence(region)

        equities = _equities(region_id, operators, facilities)
        for e in equities:
            e["why"] = (f"{e['role']}, a region ranked {det.get('rank')} of 111 "
                        f"with {det.get('growth_pct', 0):+.1f}% demand growth "
                        f"against 2019.")

        instruments = equities + _commodities(region_id, region, fuels) \
            + _events(region_id, region, snapshot)

        chains.append({
            "region": region_id,
            "name": region.get("name"),
            "rank": det.get("rank") or 999,
            "growth_pct": det.get("growth_pct"),
            "overnight_excess": det.get("overnight_excess"),
            "pattern": det.get("pattern"),
            "fuel_sentence": sentence,
            "fuel_inherited_from": inherited,
            "fuel_delta_gw": fuels,
            "instruments": instruments,
        })

    chains.sort(key=lambda c: c["rank"])

    empty_series = sorted(t for t, s in (snapshot.get("series") or {}).items()
                          if not s["markets"])

    return {
        "generated": json.loads(REGIONS_PATH.read_text())["meta"]["generated"],
        "frame": (
            "This is an input to a trade, not a trade. We measure where flat "
            "24/7 load is arriving and which grids tighten first, from federal "
            "metered data, ahead of company guidance. The page shows the "
            "physical input and stops where our evidence stops."
        ),
        "limits": LIMITS,
        "no_listed_equity": {
            "count": summary["no_listed_equity_count"],
            "resolved": summary["resolved_count"],
            "unresolved": summary["unresolved_utility_count"],
            "total_sites": summary["count"],
            "note": (
                f"{summary['no_listed_equity_count']} of the "
                f"{summary['resolved_count']} sites whose serving utility we "
                f"could establish are served by public power, a cooperative or "
                f"a state authority with no listed equity. A further "
                f"{summary['unresolved_utility_count']} sites have no "
                f"established serving utility at all, which is a gap in our "
                f"coverage rather than a finding about the grid."
            ),
        },
        "event_markets": {
            "available": bool(snapshot.get("available")),
            "venue": "Kalshi",
            "fetched_at": snapshot.get("fetched_at"),
            "message": (None if snapshot.get("available") else
                        "Event markets were unreachable when this page was "
                        "built. Equities and commodities below are unaffected."),
            "series_with_no_open_contracts": empty_series,
            "series_note": (
                "These Kalshi series exist but currently have no open "
                "contracts. Shown rather than hidden: a market that exists and "
                "is not being traded is information about liquidity, not a "
                "reason to pretend the market is absent."
            ),
        },
        "chains": chains,
    }
