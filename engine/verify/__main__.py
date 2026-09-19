"""Build claims/companies.json from hand-verified findings joined to the grid index.

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

NAME = {"META": "Meta Platforms", "MSFT": "Microsoft", "GOOGL": "Alphabet (Google)",
        "AMZN": "Amazon"}

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


def build():
    out = []
    for ticker, block in FINDINGS.items():
        sites = [s for s in SITES if s["ticker"] == ticker]
        site_objs, ev_grid, shares = [], [], []
        for s in sites:
            share = cf_share(s["ba"])
            site_objs.append({
                "metro": s["metro"], "state": s["state"], "ba": s["ba"],
                # Both keys, same value: new web/ reads `zone`, frozen dashboard/ reads `pjm_zone`.
                "zone": s["zone"] or None, "pjm_zone": s["zone"] or None,
                "serving_utility": s["serving_utility"],
                "source_type": s["source_type"], "source_url": s["source_url"],
                "note": s["note"] or None,
                "cf_share_2025": share,
            })
            if share is not None:
                shares.append(share)
                ev_grid.append({"type": "grid", "ba": s["ba"], "year": 2025, "cf_share": share})

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

        talks = [talk(c["verbatim"], c["magnitude"]) for c in claims if c["verbatim"]]
        out.append({
            "company": NAME.get(ticker, ticker), "ticker": ticker,
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
            "notes": [
                "Grid-only. Excludes power purchase agreements and renewable energy certificates.",
                "Unweighted across sites; we do not know each site's load.",
                "Site mapping is hand-curated from serving utilities, never inferred from state.",
                "Annual matched claims are TRUE under the GHG Protocol market-based method. "
                "The verdict is 'true on paper, X physically', not an accusation.",
                "Every quote was read off the rendered PDF page or raw SEC HTML by a human.",
            ] + site_caveats(site_objs),
        })
    return out


if __name__ == "__main__":
    data = build()
    (CLAIMS / "companies.json").write_text(json.dumps(data, indent=1))
    for c in data:
        print(f"{c['ticker']:<6} sites={len(c['sites'])} claims={len(c['claims'])} "
              f"talk={c['talk_score']} walk={c['walk_score']} "
              f"cannot_verify={c['cannot_verify_count']}")
    print(f"\nwrote claims/companies.json  ({len(data)} companies)")
