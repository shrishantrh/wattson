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

# A 100%/matching claim specifically. A bare mention of "carbon-free energy" is
# not a claim -- Amazon's "131,000 GWh of carbon-free energy production annually"
# is a volume figure, and treating it as a matching claim would misstate it.
CLAIM = re.compile(
    r"(match(?:ed|ing|)\s+100\s*%|100\s*%\s+(?:of\s+)?(?:our\s+)?(?:annual\s+)?"
    r"(?:global\s+)?electricity|100\s*%\s+renewable)", re.I)

# A qualifier only qualifies if the sentence is not DISCLAIMING it. "does not
# include RECs" and "pausing our use of unbundled certificates" are stricter
# standards, not hedges; reporting them as hedges inverts the company's meaning.
NEGATED = re.compile(
    r"\b(?:does not include|do not include|excludes?|excluding|without|"
    r"rather than|pausing our use of|no longer|stopped|ceased|"
    r"not rely(?:ing)? on|beyond)\b", re.I)

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
MIN_TAIL_CHARS = 40  # shorter trailing scraps are page furniture, not prose


def sentences(text):
    """Split into sentences. Crude but deterministic; good enough because we
    only need to know whether two phrases share a sentence.

    A chunk never spans a page, so a sentence continuing onto the next page
    arrives with no terminating period. Those tails are kept when they are long
    enough to be prose -- Google's strongest claim on page 4 ends past the page
    edge, and dropping it lost the best finding in the corpus."""
    matched = _SENT.findall(text or "")
    out = [m.strip() for m in matched if m.strip()]
    tail = (text or "")[sum(len(m) for m in matched):].strip()
    if len(tail) >= MIN_TAIL_CHARS:
        out.append(tail)
    return out


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
                negated = NEGATED.search(sent) is not None
                for kind, pat in QUALIFIERS.items():
                    q = pat.search(sent)
                    if not q:
                        continue
                    # "annual" states the claim's own scope, so a disclaimer
                    # elsewhere in the sentence does not neutralise it.
                    if negated and kind != "annual_scope":
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


# --- precision filters -------------------------------------------------------
#
# A document mentioning "24/7" is not the company asserting a 24/7 commitment.
# Contents pages, endnotes and methodology definitions all say the words. Under
# precision-over-recall they must not become findings: we would be telling a
# judge a company claimed something when it was a page-number listing.

FIRST_PERSON = re.compile(r"\b(we|our|us)\b", re.I)
# "… title 14 … title 17 …": contents pages carry bare page numbers between titles.
TOC_NUMBERS = re.compile(r"(?:\s\d{1,3}\s)")
CITATION = re.compile(
    r"\b(University|Institute|et al\.|Journal|Press)\b|,\s*20\d\d\s*\)", re.I)
MAX_SENTENCE_CHARS = 420

GROWTH = re.compile(
    r"\b(emissions[^.]{0,80}\bincreased\b[^.]{0,40}\d+\s*%"
    r"|\bincreased\b[^.]{0,40}\d+\s*%[^.]{0,80}emissions"
    r"|up from (?:nearly |about |roughly )?\d+\s*%"
    r"|\d+\s*%[^.]{0,40}\b(?:increase|growth)\b[^.]{0,40}"
    r"\b(?:electricity|demand|load|consumption)\b"
    r"|\b(?:electricity|demand|load|consumption)\b[^.]{0,60}"
    r"\b(?:grew|increased|rose)\b[^.]{0,30}\d+\s*%)", re.I)


def is_assertion(sentence):
    """True when the company is stating something, not listing or citing it."""
    if len(sentence) > MAX_SENTENCE_CHARS:
        return False
    if CITATION.search(sentence):
        return False
    if len(TOC_NUMBERS.findall(sentence)) >= 3:
        return False
    return bool(FIRST_PERSON.search(sentence))


def _growth_disclosures(records):
    out = []
    for rec in records:
        for sent in sentences(rec["text"]):
            m = GROWTH.search(sent)
            if m and is_assertion(sent):
                out.append((rec, sent, m.group(0)))
    return out


def build_report(corpus, verification=None):
    """corpus: {ticker: [records]}. One finding per kind per company, plus
    claim/counterpoint pairs where the same document discloses rising
    emissions alongside a matching claim."""
    report = {}
    for ticker, records in corpus.items():
        raw = [f for f in find_findings(records) if is_assertion(f["sentence"])]

        findings, seen = [], set()
        for f in sorted(raw, key=lambda f: (f["page"], len(f["sentence"]))):
            if f["kind"] in seen:
                continue
            seen.add(f["kind"])
            findings.append({
                "kind": f["kind"],
                "claim": {"page": f["page"], "quote": f["sentence"]},
                "counterpoint": None,
                "note": f["note"],
                "source_doc": f["source_doc"],
                "source_url": f["source_url"],
                "evidence": {"type": "internal_contradiction",
                             "source_doc": f["source_doc"],
                             "page": f["page"], "note": f["note"]},
            })

        growth = _growth_disclosures(records)
        claims = [f for f in raw if f["kind"] in ("annual_scope",
                                                  "certificate_based",
                                                  "market_based")]
        if growth and claims:
            claim = min(claims, key=lambda f: (f["page"], len(f["sentence"])))
            rec, sent, phrase = min(growth, key=lambda g: (g[0]["page"], len(g[1])))
            about_emissions = re.search(r"emissions", sent, re.I) is not None
            grew = "emissions" if about_emissions else "electricity consumption"
            kind = ("claim_vs_emissions_growth" if about_emissions
                    else "claim_vs_demand_growth")
            note = (f"The document states \"{claim['quote']}\" on page "
                    f"{claim['page']} and discloses \"{phrase}\" on page "
                    f"{rec['page']}, i.e. rising {grew}. Annual matching is an "
                    f"accounting result; it "
                    f"does not mean the load was served by clean power hour by "
                    f"hour, which is what an hourly grid index measures.")
            findings.append({
                "kind": kind,
                "claim": {"page": claim["page"], "quote": claim["sentence"]},
                "counterpoint": {"page": rec["page"], "quote": sent},
                "note": note,
                "source_doc": claim["source_doc"],
                "source_url": claim["source_url"],
                "evidence": {"type": "internal_contradiction",
                             "source_doc": claim["source_doc"],
                             "page": rec["page"], "note": note},
            })

        report[ticker] = {
            "findings": findings,
            "verification": verification or {
                "method": "not_yet_verified",
                "human_reread_rendered_page": False,
            },
        }
    return report
