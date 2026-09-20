"""Load the committed exports. Read-only. No grid physics is recomputed here.

Every number served by this API originates in EIA-930 via PUDL and was computed by the
frozen pipeline in scripts/. This module reads the JSON that pipeline emitted.
"""
from __future__ import annotations
import json, os, functools
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "dashboard" / "public"
DATA = PUBLIC / "data"
CLAIMS = ROOT / "claims"

# Metro -> region id. Explicit and hand-written on purpose: geographic inference produces
# confidently wrong BA mappings (Prineville and Quincy both resolve to BPAT and both are wrong).
METRO_TO_REGION = {
    "phoenix": "AZPS",
    "n. virginia": "PJM/DOM", "northern virginia": "PJM/DOM", "ashburn": "PJM/DOM",
    "loudoun": "PJM/DOM", "virginia": "PJM/DOM",
    "omaha": "SWPP/OPPD",
    "dallas": "ERCO/NCEN", "dfw": "ERCO/NCEN",
    "west texas": "ERCO/FWES", "far west texas": "ERCO/FWES", "midland": "ERCO/FWES",
    "north texas": "ERCO/NRTH", "abilene": "ERCO/NRTH",
    "san antonio": "ERCO/SCEN", "austin": "ERCO/SCEN",
    "tucson": "TEPC",
    "portland": "PGE", "hillsboro": "PGE",
    "columbus": "PJM/AEP", "central ohio": "PJM/AEP",
    "berkeley county": "SC", "south carolina": "SC",
    "san diego": "CISO/SDGE",
}


@functools.lru_cache(maxsize=1)
def regions_doc() -> dict:
    return json.loads((DATA / "regions.json").read_text())


@functools.lru_cache(maxsize=1)
def regions_by_id() -> dict:
    return {r["id"]: r for r in regions_doc()["regions"]}


@functools.lru_cache(maxsize=1)
def meta() -> dict:
    return regions_doc()["meta"]


def public_meta() -> dict:
    """The subset of meta every response carries. caveats are an honesty requirement:
    the UI cannot render a warning the API dropped."""
    m = meta()
    return {
        "generated": m["generated"],
        "data_snapshot_end": m["data_snapshot_end"],
        "baseline_year": m["baseline_year"],
        "overnight_hours_local": m["overnight_hours_local"],
        "daytime_hours_local": m["daytime_hours_local"],
        "caveats": m["caveats"],
    }


def heatmap_available(uri: str | None) -> bool:
    """heatmap_uri is NOT a promise. All 124 regions carry one; AEC, OVEC and SWPW point at
    files that do not exist. Clients read this flag instead of fetching and failing."""
    return bool(uri) and (PUBLIC / uri).exists()


@functools.lru_cache(maxsize=1)
def alerts_doc() -> dict:
    ranked = CLAIMS / "derived" / "alerts_ranked.json"
    if ranked.exists():
        d = json.loads(ranked.read_text()); d["is_ranked"] = True
        return d
    d = json.loads((DATA / "alerts.json").read_text()); d["is_ranked"] = False
    return d


@functools.lru_cache(maxsize=1)
def companies_doc() -> dict:
    """Real companies.json when it exists, else the mock. is_mock drives the MOCK DATA banner;
    it must never be wrong, because the banner is the honesty guarantee."""
    real = CLAIMS / "companies.json"
    if real.exists():
        return {"is_mock": False, "companies": json.loads(real.read_text())}
    mock = CLAIMS / "companies.mock.json"
    if mock.exists():
        return {"is_mock": True, "companies": json.loads(mock.read_text())}
    return {"is_mock": True, "companies": []}


def company_list() -> list:
    d = companies_doc()
    cs = d["companies"]
    return cs if isinstance(cs, list) else cs.get("companies", [])


def operator_key(row: dict) -> str:
    """The route key for a facilities.csv row: the operator's ticker, or the first word of
    its name when it has no listed equity. Mirrors engine/verify's route_key so a site and
    its company page agree on one identifier."""
    import re
    t = (row.get("ticker") or "").strip().upper()
    if t:
        return t
    word = re.split(r"[^A-Za-z0-9]+", (row.get("company") or "").strip())[0]
    return word.upper() or "UNKNOWN"


def company_key(c: dict) -> str:
    """The identifier the URL and the static export use.

    A listed operator routes on its ticker. One with no listed equity (xAI, Vantage) has
    a null ticker and routes on the `id` the engine wrote, so we never print a symbol
    that does not trade. Falls back to the ticker for the mock file, which has no id.
    """
    return str(c.get("id") or c.get("ticker") or "").upper()


@functools.lru_cache(maxsize=1)
def corrections() -> dict:
    """Published values we know to be wrong, with corrected values and evidence.

    Applied at serve time rather than rewritten into the exports, so the UI can show
    published and corrected side by side. A project about numbers that look clean and
    are wrong should show its own corrections in place.
    """
    p = CLAIMS / "derived" / "corrections.json"
    if not p.exists():
        return {}
    return json.loads(p.read_text())


def corrections_for(region_id: str) -> dict | None:
    return (corrections().get("regions") or {}).get(region_id)


@functools.lru_cache(maxsize=1)
def irradiance_doc() -> dict:
    """NASA POWER irradiance overlay. Precomputed; never re-fetched here."""
    p = CLAIMS / "derived" / "irradiance.json"
    if not p.exists():
        raise FileNotFoundError(str(p))
    return json.loads(p.read_text())


@functools.lru_cache(maxsize=1)
def facilities() -> list:
    """Hand-built datacenter site lookup: operator -> site -> serving utility -> BA.

    Built from the serving utility outward, never inferred from the state. Geographic
    inference produces confidently wrong BA mappings -- Prineville and Quincy both
    resolve to BPAT and both are wrong, in opposite directions.
    """
    import csv
    p = CLAIMS / "lookup" / "facilities.csv"
    if not p.exists():
        return []
    with open(p) as f:
        return list(csv.DictReader(f))
