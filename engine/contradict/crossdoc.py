"""Cross-document findings: the ESG report against the 10-K.

The ESG report is a marketing document; the 10-K is filed under legal
liability. Where the same company describes the same subject differently in the
two, the 10-K language is the more carefully lawyered of the pair -- and that
asymmetry is a stronger finding than anything inside one document.

What counts is narrow on purpose. Every 10-K on earth carries generic climate
boilerplate ("climate change could result in natural disasters"). Treating that
as a contradiction would flag all four companies for saying nothing unusual.
What we look for is the company conceding that its OWN energy use or emissions
are rising, or that its own climate goals have become harder -- typically
because of AI.
"""

import re

from engine.contradict.detect import (CITATION, CLAIM, MAX_SENTENCE_CHARS,
                                      TOC_NUMBERS, is_assertion, sentences)

SUBJECT = re.compile(r"\b(energy (?:use|usage|demands?|consumption)|emissions|"
                     r"carbon|electricity)\b", re.I)
# Only difficulty ABOUT THE COMPANY'S OWN EFFORT counts. "increased" alone
# matched Amazon's list of regulatory transition risks -- increased compliance
# costs, changed customer behaviour, reputational damage -- which is a company
# listing what could go wrong in the world, not conceding its own footprint is
# growing. Microsoft still qualifies via "harder to meet these goals", Google
# via "more complex and challenging".
DIFFICULTY = re.compile(r"\b(harder|more difficult|more complex|challenging|"
                        r"impede|hinder|may not (?:be able to )?(?:meet|achieve)|"
                        r"unable to (?:meet|achieve))\b", re.I)
OWN_GOALS = re.compile(r"\b(our|we|these goals|our goals|our targets)\b", re.I)
# Boilerplate about the physical weather, not about the company's own footprint.
PHYSICAL_RISK = re.compile(r"\b(natural disasters?|extreme weather|flood|"
                           r"wildfire|hurricane|sea level|water scarcity)\b", re.I)


def is_goal_risk(sentence):
    """True when the filing concedes rising energy/emissions or harder goals.

    Deliberately does NOT require first person. Microsoft's concession reads
    "AI development and deployment has and will likely continue to raise energy
    use and emissions, making it harder to meet these goals" -- no "we" in it
    at all. Ownership is carried by "these goals", which OWN_GOALS matches.
    """
    if len(sentence) > MAX_SENTENCE_CHARS:
        return False
    if CITATION.search(sentence):
        return False
    if len(TOC_NUMBERS.findall(sentence)) >= 3:
        return False
    if PHYSICAL_RISK.search(sentence):
        return False
    return bool(SUBJECT.search(sentence)
                and DIFFICULTY.search(sentence)
                and OWN_GOALS.search(sentence))


def find_cross_doc(ticker, esg_records, tenk_records):
    """Pair an ESG matching claim with 10-K language conceding the pressure."""
    claims = []
    for rec in esg_records:
        for sent in sentences(rec["text"]):
            if CLAIM.search(sent) and is_assertion(sent):
                claims.append((rec, sent))
    if not claims:
        return []

    risks = []
    for rec in tenk_records:
        for sent in sentences(rec["text"]):
            if is_goal_risk(sent):
                risks.append((rec, sent))
    if not risks:
        return []

    claim_rec, claim_sent = min(claims, key=lambda c: (c[0]["page"], len(c[1])))
    risk_rec, risk_sent = min(risks, key=lambda r: len(r[1]))

    item = risk_rec["locator"]["item"]
    note = (f"The sustainability report states \"{claim_sent}\" on page "
            f"{claim_rec['page']}, while the 10-K states, in Item {item} under "
            f"legal liability: \"{risk_sent}\"")
    return [{
        "kind": "esg_claim_vs_10k_risk_language",
        "ticker": ticker,
        "claim": {"page": claim_rec["page"], "quote": claim_sent,
                  "source_doc": claim_rec["source_doc"],
                  "source_url": claim_rec["source_url"]},
        "counterpoint": {"page": None, "quote": risk_sent,
                         "locator": risk_rec["locator"],
                         "source_doc": risk_rec["source_doc"],
                         "source_url": risk_rec["source_url"]},
        "note": note,
        "source_doc": claim_rec["source_doc"],
        "source_url": claim_rec["source_url"],
        "evidence": {"type": "internal_contradiction",
                     "source_doc": risk_rec["source_doc"],
                     "page": None, "note": note},
    }]
