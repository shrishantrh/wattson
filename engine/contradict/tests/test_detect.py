"""Precision is binding: a false contradiction accuses a named public company.

The guard test below is drawn from a real near-miss in the corpus. Meta page 18
says "matching 100% of our electricity use with clean and renewable energy" and,
separately on the same page, "we also apply additional Energy Attribute
Certificates (EACs) to our Scope 3 emissions". Those are two different subjects.
Pairing them on page co-occurrence would manufacture a contradiction that is not
there -- and because two-column PDF extraction interleaves columns, character
distance between them is not evidence of adjacency either. Only same-sentence
qualification counts.
"""

from engine.contradict.detect import find_findings, sentences


def rec(text, page, ticker="TEST"):
    return {"text": text, "page": page, "ticker": ticker, "year": 2025,
            "source_doc": "d.pdf", "source_url": "https://example.com/d.pdf"}


def test_splits_on_sentence_boundaries():
    assert sentences("One claim. Two claim! Three?") == [
        "One claim.", "Two claim!", "Three?"]


def test_flags_a_claim_qualified_in_the_same_sentence():
    r = rec("In FY25, we matched 100% of our annual global electricity "
            "consumption with renewable certificates.", 6)

    found = find_findings([r])

    # That sentence is legitimately both certificate-based and annual-scoped,
    # so both kinds are expected; the point is the certificate qualification.
    certs = [f for f in found if f["kind"] == "certificate_based"]
    assert len(certs) == 1
    assert certs[0]["page"] == 6
    assert "certificates" in certs[0]["qualifier"]


def test_does_not_pair_a_claim_with_a_hedge_in_a_different_sentence():
    """The Meta page 18 near-miss. Same page, different subjects, no finding."""
    r = rec("As a result of matching 100% of our electricity use with clean and "
            "renewable energy, we reduced operational emissions. "
            "We also apply additional Energy Attribute Certificates (EACs) to "
            "our Scope 3 emissions.", 18)

    found = [f for f in find_findings([r]) if f["kind"] == "certificate_based"]

    assert found == [], f"manufactured a contradiction: {found}"


def test_records_an_annual_scoped_claim_as_annual_not_as_a_contradiction():
    r = rec("Since 2020, we have matched 100% of our annual electricity use "
            "with clean and renewable energy.", 18)

    kinds = {f["kind"] for f in find_findings([r])}

    assert "annual_scope" in kinds
    assert "contradiction" not in kinds


def test_detects_a_24_7_hourly_claim_as_the_stronger_falsifiable_claim():
    r = rec("We aim to run on 24/7 carbon-free energy on every grid where we "
            "operate by 2030.", 4)

    found = [f for f in find_findings([r]) if f["kind"] == "hourly_claim"]

    assert len(found) == 1
    assert found[0]["page"] == 4


def test_every_finding_carries_a_page_and_verbatim_quote():
    r = rec("In FY25, we matched 100% of our electricity with renewable "
            "certificates.", 6)

    for f in find_findings([r]):
        assert isinstance(f["page"], int)
        assert f["quote"] in r["text"]
