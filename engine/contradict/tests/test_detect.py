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


# --- precision filters, each drawn from a real false positive in the corpus ---

from engine.contradict.detect import is_assertion, build_report


def test_a_table_of_contents_line_is_not_an_assertion():
    """Google p13: the contents page lists "24/7" section titles with page
    numbers. The document mentions 24/7; Google is not claiming anything here."""
    toc = ("Energy for our data centers 14 The AI stack: Our approach to "
           "innovation and efficiency 17 Building the supply: Scaling clean "
           "energy to meet the moment 19 Same time, same place: Using Granular "
           "Certificates to meet rising AI demand 24")

    assert not is_assertion(toc)


def test_an_academic_citation_is_not_an_assertion():
    """Google p115: an endnote citing papers about 24/7 procurement."""
    cite = ("Princeton University (System-Level Impacts of 24/7 Carbon-Free "
            "Electricity Procurement, 2021), TU Berlin (On the Means, Costs, "
            "and System-Level Impacts of 24/7 Carbon-Free Energy, 2022)")

    assert not is_assertion(cite)


def test_a_first_person_commitment_is_an_assertion():
    assert is_assertion("At the beginning of the decade, we set net zero and "
                        "24/7 carbon-free energy (CFE) goals.")


def test_report_keeps_one_finding_per_kind_per_company():
    recs = [rec("We matched 100% of our annual electricity use.", 6),
            rec("We matched 100% of our annual electricity use again.", 22),
            rec("We matched 100% of our annual electricity use once more.", 64)]

    report = build_report({"TEST": recs})

    kinds = [f["kind"] for f in report["TEST"]["findings"]]
    assert len(kinds) == len(set(kinds)), f"duplicated kinds: {kinds}"


def test_pairs_a_claim_with_a_same_document_emissions_growth_disclosure():
    """The real Microsoft page 6 juxtaposition, once extraction is correct."""
    recs = [rec("In FY25, we matched 100% of our annual global electricity "
                "consumption with renewable energy.", 6),
            rec("Our total emissions (Scopes 1, 2, and 3) increased 25% year "
                "over year, driven primarily by the expansion of our "
                "datacenter infrastructure.", 6)]

    report = build_report({"MSFT": recs})
    paired = [f for f in report["MSFT"]["findings"]
              if f["kind"] == "claim_vs_emissions_growth"]

    assert len(paired) == 1
    assert paired[0]["claim"]["page"] == 6
    assert paired[0]["counterpoint"]["page"] == 6
    assert "increased 25%" in paired[0]["counterpoint"]["quote"]


def test_an_exclusion_is_not_a_qualification():
    """Microsoft p64: "Our 2025 100% renewable target does not include ... RECs"
    is a STRICTER standard, not a hedge. Reporting it as one would invert the
    company's meaning."""
    r = rec("Our 2025 100% renewable target does not include purchases from "
            "short-term spot market renewable energy credits (RECs).", 64)

    assert [f for f in find_findings([r]) if f["kind"] == "certificate_based"] == []


def test_pausing_use_of_certificates_is_not_a_qualification():
    """Microsoft p6: pausing use of unbundled RECs is moving AWAY from them."""
    r = rec("We matched 100% of our electricity, pausing our use of "
            "non-additional, unbundled renewable energy certificates.", 6)

    assert [f for f in find_findings([r]) if f["kind"] == "non_additional"] == []


def test_a_bare_mention_of_carbon_free_energy_is_not_a_100_percent_claim():
    """Amazon p10: "131,000 GW-hours of carbon-free energy production annually"
    is a volume figure, not a matching claim."""
    r = rec("In 2025, we achieved 131,000 GW-hours (GWh) of carbon-free "
            "energy production annually.", 10)

    assert [f for f in find_findings([r]) if f["kind"] == "annual_scope"] == []


def test_a_claim_running_past_the_page_edge_is_still_found():
    """Google p4's strongest claim has its final period on the next page.
    Because a chunk never spans a page, the tail arrives unterminated -- and
    dropping it lost the best finding in the corpus."""
    tail = ("Despite this, we again matched 100% of our electricity "
            "consumption with renewable energy purchases (on a global and "
            "annual basis)")

    assert tail in sentences("Some earlier sentence. " + tail)


def test_a_short_trailing_scrap_is_not_treated_as_a_sentence():
    """Page furniture -- a header word, a folio -- must not become a quote."""
    assert sentences("A real sentence here. Overview 12") == ["A real sentence here."]


def test_pairs_a_claim_with_a_load_growth_disclosure():
    recs = [rec("Despite this, we again matched 100% of our electricity "
                "consumption with renewable energy purchases (on a global and "
                "annual basis).", 4),
            rec("In 2025, we navigated our largest load growth in history - a "
                "37% annual increase in electricity demand.", 4)]

    report = build_report({"GOOGL": recs})
    paired = [f for f in report["GOOGL"]["findings"]
              if f["kind"] == "claim_vs_demand_growth"]

    assert len(paired) == 1
    assert paired[0]["counterpoint"]["page"] == 4
