"""Kalshi event-market snapshot, cached into the repo.

Kalshi's read API is public and needs no auth. It is still pulled at BUILD
time and cached, never at render time: the demo has to work with the server
dead and with no network, and a page that calls a third-party API while a
judge is watching is a page that fails while a judge is watching.

Series were chosen by searching Kalshi's own series list for our findings, not
by guessing tickers. Series that exist but currently have no open contracts are
kept in the output with an empty market list, because "this market exists and
nobody is trading it" is information.
"""
from __future__ import annotations

import json
import ssl
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import certifi

API = "https://api.elections.kalshi.com/trade-api/v2"
CACHE_PATH = Path(__file__).resolve().parent / "kalshi_cache.json"
SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())

#: series ticker -> why it is linked to something we measured.
#: Every string here must be checkable against a number in our own data.
SERIES = {
    "KXTXERCOTPEAK": "ERCOT annual peak system load",
    "KXNATGASD": "Henry Hub natural gas, daily settle",
    "KXNATGASMON": "Henry Hub natural gas, monthly settle",
    "KXMARCELLUSGAS": "Marcellus dry gas production",
    "KXPOWERKWH": "US average retail electricity price",
    "KXDATACENTCON": "US private datacenter construction spending",
    "KXUSADATACENTERS": "Number of US datacenters",
    "KXRATEPAYERLAW": "Federal datacenter power-cost standards",
    "KXTLNA": "Talen Energy annual generation",
    "KXILNUCLEAR": "Illinois nuclear generation",
    "KXUTILITYPJMWEST": "PJM West electricity prices",
    "KXERCOTX": "Texas share of electricity from renewables",
}


def _get(url: str) -> dict:
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=45, context=SSL_CONTEXT) as r:
        return json.loads(r.read())


def _market(m: dict) -> dict:
    return {
        "ticker": m.get("ticker"),
        "title": m.get("title"),
        "strike": m.get("yes_sub_title"),
        "yes_bid": m.get("yes_bid_dollars"),
        "yes_ask": m.get("yes_ask_dollars"),
        "last": m.get("last_price_dollars"),
        "close_time": m.get("close_time"),
    }


def fetch() -> dict:
    """Pull open markets for each series. Never raises: a failure is recorded."""
    snapshot = {
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": API,
        "available": True,
        "error": None,
        "series": {},
    }
    for ticker, label in SERIES.items():
        try:
            body = _get(f"{API}/markets?series_ticker={ticker}&status=open&limit=20")
            markets = [_market(m) for m in body.get("markets", [])]
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            snapshot["series"][ticker] = {"label": label, "markets": [],
                                          "error": type(exc).__name__}
            continue
        snapshot["series"][ticker] = {"label": label, "markets": markets,
                                      "error": None}

    if all(s["markets"] == [] and s["error"] for s in snapshot["series"].values()):
        snapshot["available"] = False
        snapshot["error"] = "Kalshi unreachable at build time."
    return snapshot


def load() -> dict:
    """The cached snapshot, or an explicit unavailable marker."""
    if not CACHE_PATH.exists():
        return {"fetched_at": None, "available": False,
                "error": "No cached Kalshi snapshot in the repo.", "series": {}}
    with CACHE_PATH.open() as fh:
        return json.load(fh)


def write(snapshot: dict) -> Path:
    with CACHE_PATH.open("w") as fh:
        json.dump(snapshot, fh, indent=1)
        fh.write("\n")
    return CACHE_PATH


if __name__ == "__main__":
    snap = fetch()
    write(snap)
    live = sum(1 for s in snap["series"].values() if s["markets"])
    print(f"kalshi: {len(snap['series'])} series, {live} with open markets")
    for t, s in snap["series"].items():
        print(f"  {t:20s} {len(s['markets']):3d} markets  {s['label']}")
