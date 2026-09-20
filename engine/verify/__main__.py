"""Build claims/companies.json from the site lookup, joined to the grid index, with
hand-verified claims attached where we have read documents.

EVERY operator in claims/lookup/facilities.csv gets a record, not just the four with
documents. An operator we have mapped but read nothing from still has checkable sites:
a serving utility, a balancing authority, that grid's carbon-free share and its detector
rank. What it lacks is a claim to hold against them, and that absence is stated with an
enumerated reason rather than a silent empty array -- a company with no claims is a
coverage statement about US, not a finding about them.

Operators we deliberately did not map at all (claims/lookup/coverage_gaps.json) get a
record too, for the same reason: a gap we chose should read as a decision, not a 404.

Deliberately NOT built from bulk LLM extraction. Every claim here was read off a
rendered PDF page or raw SEC HTML by a human. Fewer claims, all citable.

Verdicts are grid-only and exclude contracted clean power. We never say a company lied:
annual matched claims are true under the GHG Protocol market-based method, so the
verdict is "true on paper, X physically".
"""
from __future__ import annotations
import csv, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DATA = ROOT / "dashboard/public/data"
CLAIMS = ROOT / "claims"

REGIONS = {r["id"]: r for r in json.loads((DATA / "regions.json").read_text())["regions"]}
FINDINGS = json.loads((CLAIMS / "derived/contradictions.json").read_text())
SITES = list(csv.DictReader(open(CLAIMS / "lookup/facilities.csv")))
_GAPS = CLAIMS / "lookup/coverage_gaps.json"
GAPS = json.loads(_GAPS.read_text())["companies"] if _GAPS.exists() else []

NAME = {"META": "Meta Platforms", "MSFT": "Microsoft", "GOOGL": "Alphabet (Google)",
        "AMZN": "Amazon"}

# What we hold on an operator, as one of three values. Rendered on screen verbatim by key;
# the UI must never have to infer coverage from an empty list.
COVERAGE_STATUS = {
    "sites_and_claims": "Sites mapped to grids, and claims read from its own documents.",
    "sites_only": "Sites mapped to grids. No documents read, so no claim to check.",
    "no_site_resolved": "No site we could tie to a serving utility, so no grid to check.",
}
# Why claims[] is empty. Always one of these when it is empty; never omitted.
CLAIMS_ABSENT_REASON = {
    "no_documents_ingested": ("We have ingested no sustainability report or filing from this "
                             "operator, so there is nothing of its own to hold against the "
                             "grid. This is a gap in our coverage, not a finding about them."),
    "no_site_resolved": ("No site could be tied to a named serving utility from public "
                         "sources, so there is no grid to hold a claim against. Recorded as "
                         "an unmapped operator rather than given a grid it may not draw from."),
}

# Narrowing qualifiers. Each reduces scope_breadth: the claim covers less than it sounds.
HEDGES = {
    "annual": 0.30, "annually": 0.30, "on an annual basis": 0.30,
    "market-based": 0.20, "certificates": 0.15, "rec": 0.10,
    "owned-and-operated": 0.20, "owned and operated": 0.20,
    "purchases": 0.10, "matched": 0.15,
}


def cf_share(ba: str, year: str = "2025"):
    r = REGIONS.get(ba)
    if not r:
        return None
    return ((r.get("cf_share") or {}).get(year) or {}).get("all")


def region_id_of(row) -> str:
    """The region a site sits in: the zone when we have one, else the balancing authority.

    Generation figures still come from the BA -- zones have demand only and inherit the
    parent's generation -- but the DETECTOR ranks the zone, and that is the rank that
    describes the load landing where the site is.
    """
    z = (row.get("zone") or "").strip()
    if not z:
        return row["ba"]
    return z if "/" in z else f"{row['ba']}/{z}"


def detection_of(region_id: str) -> dict:
    d = (REGIONS.get(region_id) or {}).get("detection") or {}
    return {"detector_rank": d.get("rank"), "detector_score": d.get("score"),
            "detector_pattern": d.get("pattern")}


def route_key(row) -> str:
    """The key the URL and the static export use, uppercase because the router uppercases it.

    A listed operator routes on its ticker. One with no listed equity routes on the first
    word of its name, and its `ticker` stays null: we never print a symbol that does not
    trade.
    """
    t = (row.get("ticker") or "").strip().upper()
    if t:
        return t
    word = re.split(r"[^A-Za-z0-9]+", (row.get("company") or "").strip())[0]
    return word.upper() or "UNKNOWN"


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def talk(quote: str, magnitude):
    """magnitude x specificity x scope_breadth, 0-1.

    How big the number is, how precisely it is stated, and how little it is hedged.
    """
    q = quote.lower()
    mag = magnitude if magnitude is not None else 0.5
    # specificity: an explicit percentage or number is checkable; prose is not.
    specificity = 1.0 if re.search(r"\d+\s*%|\b100\b", q) else 0.45
    breadth = 1.0
    for h, penalty in HEDGES.items():
        if h in q:
            breadth -= penalty
    breadth = max(0.15, breadth)
    return round(min(1.0, mag * specificity * breadth), 3)


# Balancing-authority boundaries split generation that physically serves a site.
# Stating the share without the caveat is a number that does not mean what it looks like.
BA_CAVEATS = {
    "SC": ("Santee Cooper's jointly-owned V.C. Summer nuclear reports under the SCEG balancing "
           "authority (0.421 in 2025), not under SC (0.056). The SC footprint understates the "
           "carbon-free content of power available to sites in this territory."),
    "PACW": ("PacifiCorp West rose from 0.297 in 2019 to 0.75 in 2025. A 2019-era framing of this "
             "site as far dirtier than its neighbours is no longer current."),
}


def site_caveats(site_objs):
    return [BA_CAVEATS[s["ba"]] for s in site_objs if s["ba"] in BA_CAVEATS]


def build_claims(ticker, block, ev_grid, shares):
    """The hand-verified claims for one operator. Unchanged from the four-company build."""
    claims = []
    for i, f in enumerate(block.get("findings", []), 1):
        quote = f["claim"]["quote"]
        magnitude = 1.0 if "100%" in quote else None
        cp = f.get("counterpoint")
        evidence = list(ev_grid)
        # The counterpoint goes FIRST. Consumers take the first contradiction they
        # find, and for a disclosed-table finding the table IS the evidence -- the
        # finding's own prose note mostly restates the claim.
        cp_first = bool(cp and cp.get("values"))
        if not cp_first:
            evidence.append({k: v for k, v in f["evidence"].items()})
        if cp:
            # A counterpoint is usually a quote. Sometimes it is a disclosed TABLE --
            # Google's hourly CFE row is the strongest finding in the corpus and it has
            # no sentence to quote. Render the numbers, and fall back to the finding's
            # own note rather than emitting a null.
            if cp.get("quote"):
                cp_note = cp["quote"]
            elif cp.get("values"):
                years, vals = cp.get("years") or [], cp["values"]
                series = ", ".join(f"{y}: {v}{cp.get('unit', '')}"
                                   for y, v in zip(years, vals))
                cp_note = f"{cp.get('label', 'Disclosed figures')} — {series}"
            else:
                cp_note = f.get("note")
            evidence.append({"type": "internal_contradiction",
                             "source_doc": cp.get("source_doc") or f["source_doc"],
                             "page": cp.get("page"), "note": cp_note,
                             "values": cp.get("values"), "years": cp.get("years"),
                             "label": cp.get("label")})
            if cp_first:
                evidence.append({k: v for k, v in f["evidence"].items()})
        if shares:
            verdict, reason = "true_on_paper", None
        else:
            verdict, reason = "cannot_verify", "no_site_mapping"
        claims.append({
            "claim_id": f"{ticker}-2026-{i:03d}",
            "verbatim": quote,
            "source_doc": f["source_doc"], "source_url": f["source_url"],
            "page": f["claim"].get("page"),
            "year": 2026, "metric": "renewable_electricity_share",
            "magnitude": magnitude, "unit": "fraction",
            "timeframe": "annual", "scope": "market_based",
            "falsifiability": 0.85 if magnitude else 0.6,
            "greenwash_patterns": ["hidden_tradeoff"] if f["kind"] == "annual_scope" else [],
            "kind": f["kind"],
            "verdict": verdict, "cannot_verify_reason": reason,
            "physical_min": min(shares) if shares else None,
            "physical_max": max(shares) if shares else None,
            "physical_mean_unweighted": round(sum(shares) / len(shares), 3) if shares else None,
            "confidence": "high",
            "verification": f.get("verification"),
            "evidence": evidence,
        })

    gap = block.get("gap")
    if not claims and gap:
        claims.append({
            "claim_id": f"{ticker}-2026-001", "verbatim": None,
            "source_doc": None, "source_url": None, "page": None, "year": 2026,
            "metric": None, "magnitude": None, "unit": None, "timeframe": None,
            "scope": None, "falsifiability": None, "greenwash_patterns": [],
            "kind": "no_finding",
            "verdict": "cannot_verify", "cannot_verify_reason": "no_falsifiable_content",
            "physical_min": None, "physical_max": None,
            "physical_mean_unweighted": None, "confidence": "high",
            "note": gap if isinstance(gap, str) else None, "evidence": [],
        })

    return claims


def group_sites():
    """Operators in the order facilities.csv first names them, each with its sites.

    Keyed on the route key, so two rows for the same ticker under different legal names
    (TeraWulf and the TeraWulf / Fluidstack JV) are one operator with two sites.
    """
    groups = {}
    for row in SITES:
        k = route_key(row)
        g = groups.setdefault(k, {"key": k, "ticker": (row.get("ticker") or "").strip().upper() or None,
                                  "names": [], "rows": []})
        g["names"].append(row["company"])
        g["rows"].append(row)
    return list(groups.values())


def display_name(key, names):
    """The four with documents keep their hand-written names; everyone else takes the
    shortest string the CSV uses for them, which is the operator without the JV or the
    parenthetical."""
    if key in NAME:
        return NAME[key]
    return min(names, key=len)


def build():
    out = []
    for g in group_sites():
        key, ticker = g["key"], g["ticker"]
        site_objs, ev_grid, shares = [], [], []
        for s in g["rows"]:
            share = cf_share(s["ba"])
            rid = region_id_of(s)
            site_objs.append({
                "metro": s["metro"], "state": s["state"], "ba": s["ba"],
                # Both keys, same value: new web/ reads `zone`, frozen dashboard/ reads `pjm_zone`.
                "zone": s["zone"] or None, "pjm_zone": s["zone"] or None,
                "region_id": rid,
                "serving_utility": s["serving_utility"] or None,
                "utility_parent": s.get("utility_parent") or None,
                "utility_ticker": s.get("utility_ticker") or None,
                "source_type": s["source_type"], "source_url": s["source_url"],
                "note": s["note"] or None,
                "lat": _num(s.get("lat")), "lng": _num(s.get("lon")),
                # The BA's generation, because zones inherit it; the rank is the zone's own.
                "cf_share_2025": share,
                "cf_inherited_from_ba": bool(s["zone"]),
                **detection_of(rid),
            })
            if share is not None:
                shares.append(share)
                ev_grid.append({"type": "grid", "ba": s["ba"], "year": 2025, "cf_share": share})

        block = FINDINGS.get(key)
        claims = build_claims(key, block, ev_grid, shares) if block else []
        if claims:
            status, absent = "sites_and_claims", None
        else:
            status, absent = "sites_only", "no_documents_ingested"

        talks = [talk(c["verbatim"], c["magnitude"]) for c in claims if c["verbatim"]]
        notes = [
            "Grid-only. Excludes power purchase agreements and renewable energy certificates.",
            "Unweighted across sites; we do not know each site's load.",
            "Site mapping is hand-curated from serving utilities, never inferred from state.",
            "Annual matched claims are TRUE under the GHG Protocol market-based method. "
            "The verdict is 'true on paper, X physically', not an accusation.",
        ]
        if claims:
            notes.append("Every quote was read off the rendered PDF page or raw SEC HTML by a human.")
        else:
            notes.append(CLAIMS_ABSENT_REASON[absent])
        out.append({
            "company": display_name(key, g["names"]), "ticker": ticker, "id": key,
            "listed_equity": ticker is not None,
            "coverage_status": status,
            "coverage_status_note": COVERAGE_STATUS[status],
            "claims_absent_reason": absent,
            "claims_absent_note": CLAIMS_ABSENT_REASON[absent] if absent else None,
            "sites": site_objs, "claims": claims,
            "talk_score": round(sum(talks) / len(talks), 3) if talks else None,
            "talk_score_method": ("magnitude x specificity x scope_breadth, 0-1. How big the number "
                                  "is, how precisely it is stated, and how little it is hedged. "
                                  "Narrowing qualifiers (annual, market-based, certificates, "
                                  "owned-and-operated) reduce scope_breadth."),
            "walk_score": round(sum(shares) / len(shares), 3) if shares else None,
            "walk_score_method": ("mean physical carbon-free share across mapped sites, calendar "
                                  "2025, all hours, grid-only, unweighted by site size."),
            "coverage": round(len([s for s in site_objs if s["cf_share_2025"] is not None])
                              / len(site_objs), 3) if site_objs else 0.0,
            "cannot_verify_count": sum(1 for c in claims if c["verdict"] == "cannot_verify"),
            "notes": notes + site_caveats(site_objs),
        })

    # Operators we chose not to map. A recorded decision, not a 404.
    #
    # A gap entry is a statement about OUR coverage at the time it was written, so it goes
    # stale the moment the lookup gains a site for that operator. Emitting it anyway would
    # overwrite a real, sourced mapping with "we could not find one" -- the exact failure
    # this file exists to prevent. So a gap whose company now has sites is dropped.
    mapped = {(c.get("ticker") or c.get("id") or "").upper() for c in out if c.get("sites")}
    for gap in GAPS:
        gap_key = (gap.get("ticker") or gap.get("key") or "").upper()
        if gap_key in mapped:
            print(f"{gap_key:<8} gap record DROPPED: the lookup now has sites for it")
            continue
        absent = gap.get("claims_absent_reason", "no_site_resolved")
        out.append({
            "company": gap["company"], "ticker": gap.get("ticker"), "id": gap["key"],
            "listed_equity": bool(gap.get("ticker")),
            "coverage_status": gap.get("coverage_status", "no_site_resolved"),
            "coverage_status_note": COVERAGE_STATUS[gap.get("coverage_status", "no_site_resolved")],
            "claims_absent_reason": absent,
            "claims_absent_note": CLAIMS_ABSENT_REASON[absent],
            "sites": [], "claims": [],
            "talk_score": None, "talk_score_method": None,
            "walk_score": None,
            "walk_score_method": ("mean physical carbon-free share across mapped sites; no site "
                                  "was mapped, so there is nothing to average."),
            "coverage": 0.0, "cannot_verify_count": 0,
            "unmapped_reason": gap.get("note"),
            "unmapped_searched": gap.get("searched") or [],
            "notes": [n for n in [
                CLAIMS_ABSENT_REASON[absent],
                gap.get("note"),
                "Listed here on purpose. An operator we could not map should read as a decision "
                "we made and can defend, not as a company the product has never heard of.",
            ] if n],
        })
    return out


if __name__ == "__main__":
    data = build()
    (CLAIMS / "companies.json").write_text(json.dumps(data, indent=1))
    for c in data:
        print(f"{c['id']:<8} {c['coverage_status']:<17} sites={len(c['sites'])} "
              f"claims={len(c['claims'])} talk={c['talk_score']} walk={c['walk_score']} "
              f"cannot_verify={c['cannot_verify_count']}"
              f"{'' if c['claims'] else '  <- ' + str(c['claims_absent_reason'])}")
    n_claims = sum(1 for c in data if c["claims"])
    n_sites = sum(len(c["sites"]) for c in data)
    print(f"\nwrote claims/companies.json  ({len(data)} operators, {n_sites} sites, "
          f"{n_claims} with documents read, {len(data) - n_claims} without)")
