"""ESG report vs 10-K: the same company, the same subject, one document written
for marketing and one under legal liability."""

from engine.contradict.crossdoc import find_cross_doc, is_goal_risk


def esg(text, page):
    return {"text": text, "page": page, "ticker": "X", "year": 2026,
            "source_doc": "esg.pdf", "source_url": "https://e.example/esg.pdf"}


def tenk(text, item="1A"):
    return {"text": text, "page": None, "ticker": "X", "year": 2026,
            "source_doc": "x-10k.htm", "source_url": "https://sec.gov/x.htm",
            "locator": {"type": "html_anchor", "item": item, "char_offset": 0}}


def test_admitting_ai_makes_climate_goals_harder_is_a_goal_risk():
    assert is_goal_risk("AI development and deployment has and will likely "
                        "continue to raise energy use and emissions, making it "
                        "harder to meet these goals.")


def test_generic_natural_disaster_boilerplate_is_not_a_goal_risk():
    """Meta's only climate sentence in Item 1A. Every 10-K carries language
    like this; treating it as a contradiction would flag all four companies
    for saying nothing unusual."""
    assert not is_goal_risk("Global climate change could result in certain "
                            "types of natural disasters occurring more "
                            "frequently or with more intense effects.")


def test_pairs_the_esg_claim_with_the_10k_risk_language():
    found = find_cross_doc(
        "X",
        [esg("In FY25, we matched 100% of our annual global electricity "
             "consumption with renewable energy.", 6)],
        [tenk("AI development and deployment has and will likely continue to "
              "raise energy use and emissions, making it harder to meet these "
              "goals.")])

    assert len(found) == 1
    f = found[0]
    assert f["claim"]["page"] == 6
    assert f["counterpoint"]["page"] is None
    assert f["counterpoint"]["locator"]["item"] == "1A"
    assert "harder to meet these goals" in f["counterpoint"]["quote"]


def test_no_pairing_without_an_esg_claim():
    found = find_cross_doc("X", [esg("We like trees.", 1)],
                           [tenk("AI raises our energy use and emissions, "
                                 "making it harder to meet these goals.")])

    assert found == []


def test_a_regulatory_transition_risk_bullet_is_not_a_goal_risk():
    """Amazon's Item 1A lists transition risks: compliance costs, changed
    customer behaviour, reputational damage. That is a company listing what
    could go wrong in the world, not conceding its own energy use is rising.
    It matched on 'increased compliance costs' and had to be excluded."""
    frag = ("with the transition to a low-carbon economy; decreased demand for "
            "our products and services as a result of changes in customer "
            "behavior; increased compliance costs due to more extensive and "
            "global regulations and third-party requirements; and reputational "
            "damage resulting from perceptions of our environmental impact.")

    assert not is_goal_risk(frag)
