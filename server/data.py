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
