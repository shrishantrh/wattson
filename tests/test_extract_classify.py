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
