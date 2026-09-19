"""A company's own HOURLY carbon-free figure, beside its own ANNUAL claim.

This is the strongest thing the corpus can show, because it requires no
inference at all. Google states on page 4 that it matched 100% of its
electricity consumption with renewable energy purchases "on a global and annual
basis", and discloses in its own appendix that carbon-free energy across its
data centers, measured hourly, was 65% in 2021 and 65% in 2025. Both numbers
are Google's. Put them next to each other and say nothing else.

The row is TABULAR text. Per our own rule it is never emitted as a prose quote:
we publish the parsed label, unit, years and values, so the UI renders a table
rather than a sentence that was never written.
"""

import re

from engine.contradict.detect import CLAIM, is_assertion, sentences

# The label carries no digits, which is what stops it swallowing the year
# header that sits immediately before it in the flattened table.
HOURLY_ROW = re.compile(
    r"(?P<label>[A-Za-z][A-Za-z ,&()\-]{0,70}?\(hourly\))\s*(?P<unit>%)"
    r"\s*(?P<values>(?:-|\d+)(?:\s+(?:-|\d+))*)")
YEAR_HEADER = re.compile(r"((?:19|20)\d{2})")


def parse_hourly_row(text):
    """Pull the year header and the first hourly row out of a flattened table."""
    m = HOURLY_ROW.search(text or "")
    if not m:
        return None
    years = [int(y) for y in YEAR_HEADER.findall(text[:m.start()])]
    raw = m.group("values").split()
    values = [None if v == "-" else int(v) for v in raw]
    if years and len(values) > len(years):
        values = values[:len(years)]
    if years and len(years) > len(values):
        years = years[-len(values):]
    return {"label": " ".join(m.group("label").split()),
            "unit": m.group("unit"),
            "years": years,
            "values": values}


def find_disclosed_hourly_cfe(ticker, records):
    """Pair an annual matching claim with a disclosed hourly CFE table row."""
    claims = []
    for rec in records:
        if (rec.get("quality") or {}).get("flag") == "suspect":
            continue
        for sent in sentences(rec["text"]):
            if CLAIM.search(sent) and is_assertion(sent):
                claims.append((rec, sent))

    tables = []
    for rec in records:
        parsed = parse_hourly_row(rec["text"])
        if parsed and parsed["values"]:
            tables.append((rec, parsed))

    if not claims or not tables:
        return []

    claim_rec, claim_sent = min(claims, key=lambda c: (c[0]["page"], len(c[1])))
    table_rec, parsed = tables[0]

    pairs = ", ".join(f"{y}: {v}%" for y, v in zip(parsed["years"], parsed["values"])
                      if v is not None)
    note = (f"The report claims, on page {claim_rec['page']}: \"{claim_sent}\". "
            f"The same report discloses, on page {table_rec['page']}, "
            f"{parsed['label']} of {pairs}. Annual matching and hourly "
            f"carbon-free supply are different measurements, and the company "
            f"publishes both.")
    return [{
        "kind": "annual_claim_vs_disclosed_hourly_cfe",
        "ticker": ticker,
        "claim": {"page": claim_rec["page"], "quote": claim_sent},
        # Tabular data, never a prose quote: the UI renders the values.
        "counterpoint": {"page": table_rec["page"],
                         "label": parsed["label"],
                         "unit": parsed["unit"],
                         "years": parsed["years"],
                         "values": parsed["values"],
                         "source_doc": table_rec["source_doc"],
                         "source_url": table_rec["source_url"]},
        "note": note,
        "source_doc": claim_rec["source_doc"],
        "source_url": claim_rec["source_url"],
        "evidence": {"type": "internal_contradiction",
                     "source_doc": table_rec["source_doc"],
                     "page": table_rec["page"], "note": note},
    }]
