"""Evidence class is computed from the model's own fields, never a re-score.

The model inflates falsifiability for specific-sounding activity statements
("We announced an agreement with X") that carry no number and no date. The
anchors cover the inverse case (a number with an undefined metric) but have
no anchor for this one, and adding anchors is a human's decision. So the
score is left exactly as returned and a structural axis is added beside it.
"""
from engine.extract import classify as C


def claim(**kw):
    base = {"verbatim": "x", "magnitude": None, "unit": None,
            "timeframe": None, "metric": None, "falsifiability": 0.9}
    base.update(kw)
    return base


def test_number_with_unit_is_quantified():
    c = claim(magnitude=62.0, unit="percent", metric="carbon-free share")
    assert C.evidence_class(c) == "quantified"


def test_date_without_number_is_a_dated_commitment():
    c = claim(timeframe="by 2030", metric="24/7 carbon-free energy")
    assert C.evidence_class(c) == "dated_commitment"


def test_neither_number_nor_date_is_qualitative():
    assert C.evidence_class(claim(metric="partnerships")) == "qualitative"


def test_classification_never_changes_the_models_score():
    c = claim(magnitude=5.0, unit="MW", falsifiability=0.31)
    out = C.annotate([c])
    assert out[0]["falsifiability"] == 0.31


def test_annotate_adds_the_field_without_dropping_claims():
    claims = [claim(magnitude=1.0, unit="MW"), claim(), claim(timeframe="2030")]
    out = C.annotate(claims)
    assert len(out) == 3
    assert all("evidence_class" in c for c in out)


def test_summary_counts_every_class():
    claims = [claim(magnitude=1.0, unit="MW"), claim(timeframe="2030"), claim()]
    assert C.summarise(claims) == {"quantified": 1, "dated_commitment": 1,
                                   "qualitative": 1}


def test_a_magnitude_with_no_unit_still_counts_as_quantified():
    """'27 owned data center locations' has a number and no unit."""
    assert C.evidence_class(claim(magnitude=27.0, metric="locations")) == "quantified"


# --- multi-number claims ---------------------------------------------------

def test_claim_with_two_numbers_is_still_quantified():
    """The model leaves `magnitude` null when a claim carries more than one
    number, which silently misfiled real targets as qualitative."""
    c = claim(verbatim="Restore 200% of the water we consume in high water "
                       "stress regions and 100% in medium stress regions.")
    assert C.evidence_class(c) == "quantified"


def test_a_bare_year_is_not_a_quantity():
    c = claim(verbatim="In 2022, Amazon committed to reducing deforestation "
                       "risks from products containing palm oil and soy.")
    assert C.evidence_class(c) == "qualitative"


def test_percentages_in_prose_count_as_quantities():
    c = claim(verbatim="Select Kindle Scribe models featured 100% recycled "
                       "cobalt in batteries and 85% recycled tin.")
    assert C.evidence_class(c) == "quantified"


def test_a_year_plus_a_real_quantity_is_quantified():
    c = claim(verbatim="In 2025 we delivered 131,000 GWh of carbon-free energy.")
    assert C.evidence_class(c) == "quantified"


def test_explicit_magnitude_still_wins():
    assert C.evidence_class(claim(magnitude=5.0, verbatim="no digits here")) == "quantified"


def test_timeframe_only_claim_stays_a_dated_commitment():
    c = claim(verbatim="We will reach this goal by the end of the decade.",
              timeframe="end of the decade")
    assert C.evidence_class(c) == "dated_commitment"


# --- deterministic falsifiability cap --------------------------------------

def test_uncheckable_claim_is_capped():
    """No quantity, no date: uncheckable by the definition of falsifiability."""
    c = claim(verbatim="The selected mix has been poured in our newest data "
                       "centers, including in slab-on-grade applications.",
              falsifiability=0.9)
    out = C.apply_cap(c)
    assert out["falsifiability"] == C.UNCHECKABLE_CAP
    assert out["falsifiability_model"] == 0.9
    assert out["falsifiability_capped"] is True


def test_cap_never_raises_a_score_that_was_already_low():
    c = claim(verbatim="We strive to be a leader.", falsifiability=0.05)
    out = C.apply_cap(c)
    assert out["falsifiability"] == 0.05
    assert out["falsifiability_capped"] is False


def test_claim_with_a_quantity_is_not_capped():
    c = claim(verbatim="We matched 100% of our electricity with renewables.",
              falsifiability=0.95)
    assert C.apply_cap(c)["falsifiability"] == 0.95


def test_claim_with_a_magnitude_is_not_capped():
    c = claim(magnitude=62.0, verbatim="no digits", falsifiability=0.95)
    assert C.apply_cap(c)["falsifiability"] == 0.95


def test_dated_commitment_without_a_number_is_not_capped():
    """A deadline can be missed, so it is checkable."""
    c = claim(verbatim="We will operate on carbon-free energy by then.",
              timeframe="by 2030", falsifiability=0.8)
    assert C.apply_cap(c)["falsifiability"] == 0.8


def test_the_original_score_is_always_preserved():
    for f in (0.9, 0.05):
        c = claim(verbatim="Concrete nouns, no quantity.", falsifiability=f)
        assert C.apply_cap(c)["falsifiability_model"] == f


def test_capping_is_applied_by_annotate():
    c = claim(verbatim="We partnered with a named vendor on a named project.",
              falsifiability=0.9)
    assert C.annotate([c])[0]["falsifiability"] == C.UNCHECKABLE_CAP


def test_cap_matches_the_qualitative_class_exactly():
    """The cap fires on precisely the claims evidence_class calls qualitative."""
    cases = [claim(verbatim="No quantity here at all.", falsifiability=0.9),
             claim(verbatim="We hit 100%.", falsifiability=0.9),
             claim(timeframe="2030", verbatim="No number.", falsifiability=0.9)]
    for c in cases:
        capped = C.apply_cap(c)["falsifiability_capped"]
        assert capped == (C.evidence_class(c) == "qualitative")


# --- quantity detection must ignore digits inside words --------------------

def test_digit_inside_an_organisation_name_is_not_a_quantity():
    """'C2ES' and a footnote marker exempted a membership list from the cap."""
    v = ("This includes membership in the: - Beyond Alliance - Clean Energy "
         "Buyers Alliance - American Council on Renewable Energy (ACORE) - C2ES")
    assert C.has_quantity(v) is False


def test_footnote_marker_glued_to_a_word_is_not_a_quantity():
    assert C.has_quantity("Members of the Clean Grid Alliance3") is False


def test_standalone_number_is_a_quantity():
    assert C.has_quantity("saved over 1,420 kilograms of plastic") is True


def test_percentage_is_a_quantity():
    assert C.has_quantity("We matched 100% of our electricity") is True


def test_decimal_is_a_quantity():
    assert C.has_quantity("avoided 41.2 million metric tons") is True


def test_membership_list_is_now_capped():
    v = ("This includes membership in the: - Beyond Alliance - Clean Energy "
         "Buyers Alliance - C2ES - Clean Grid Alliance3")
    out = C.apply_cap(claim(verbatim=v, falsifiability=0.9))
    assert out["falsifiability"] == C.UNCHECKABLE_CAP


def test_capping_is_idempotent():
    """Reclassify runs repeatedly; the model's original score must survive.

    A second pass that reads the already-capped `falsifiability` back into
    `falsifiability_model` destroys the only record of what the model said.
    """
    c = claim(verbatim="Concrete nouns, no quantity, no date.", falsifiability=0.9)
    once = C.apply_cap(c)
    twice = C.apply_cap(once)
    assert twice["falsifiability_model"] == 0.9
    assert twice["falsifiability"] == C.UNCHECKABLE_CAP
    assert C.apply_cap(twice) == twice
