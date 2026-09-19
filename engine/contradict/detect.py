"""Deterministic, sentence-scoped findings about clean-energy claims.

Why sentence-scoped and not page-scoped: two-column PDF extraction interleaves
columns, so two phrases can be adjacent in the extracted string while sitting in
different columns about different subjects. Page co-occurrence and character
distance are therefore both unsafe. A qualifier only counts when it is in the
same sentence as the claim it qualifies.

The kinds are deliberately not all called "contradiction". Most of what is here
is a company qualifying its own claim in the open, which is disclosure, not
deceit. Calling that a contradiction on stage would be unfair and wrong. What is
material is the SCOPE of the claim: annual, market-based matching is a much
weaker statement than hour-by-hour clean supply, and that difference is exactly
what an hourly grid index can test.
"""

import re

CLAIM = re.compile(
    r"(matched?\s+100\s*%|100\s*%\s+(?:of\s+)?(?:our\s+)?(?:annual\s+)?"
    r"(?:global\s+)?electricity|100\s*%\s+renewable|carbon[- ]free\s+energy)",
    re.I)

QUALIFIERS = {
    "certificate_based": re.compile(
        r"\b(renewable\s+certificates?|certificates?|RECs?|EACs?|"
        r"energy\s+attribute\s+certificates?)\b", re.I),
    "market_based": re.compile(r"market[- ]based", re.I),
    "annual_scope": re.compile(r"\bannual(?:ly)?\b|\bon an annual basis\b", re.I),
    "non_additional": re.compile(r"\bnon-?additional\b|\bunbundled\b", re.I),
}

HOURLY = re.compile(r"\b(24\s*/\s*7|hourly|round-the-clock)\b", re.I)

_SENT = re.compile(r"[^.!?]*[.!?]")


def sentences(text):
    """Split into sentences. Crude but deterministic; good enough because we
    only need to know whether two phrases share a sentence."""
    return [s.strip() for s in _SENT.findall(text or "") if s.strip()]


def _finding(kind, rec, sentence, quote, qualifier, note):
    return {
        "kind": kind,
        "ticker": rec.get("ticker"),
        "page": rec["page"],
        "source_doc": rec.get("source_doc"),
        "source_url": rec.get("source_url"),
        "quote": quote,
        "sentence": sentence,
        "qualifier": qualifier,
        "note": note,
    }


def find_findings(records):
    found = []
    for rec in records:
        for sent in sentences(rec["text"]):
            claim = CLAIM.search(sent)

            if claim:
                for kind, pat in QUALIFIERS.items():
                    q = pat.search(sent)
                    if not q:
                        continue
                    found.append(_finding(
                        kind, rec, sent, claim.group(0), q.group(0),
                        f"The claim \"{claim.group(0)}\" is qualified in the same "
                        f"sentence by \"{q.group(0)}\"."))

            hourly = HOURLY.search(sent)
            if hourly and (claim or re.search(r"carbon[- ]free|clean", sent, re.I)):
                found.append(_finding(
                    "hourly_claim", rec, sent, hourly.group(0), hourly.group(0),
                    "States an hourly / 24-7 clean-energy claim, which is "
                    "stronger and more falsifiable than annual matching."))
    return found
