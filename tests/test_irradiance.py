"""Tests for the NASA POWER irradiance overlay.

This module illustrates a mechanism. The tests exist mostly to stop it
overclaiming: flat irradiance must be reported as flat, a region whose
generation series is broken must not be presented as evidence, and the
zone/BA mismatch must travel with the numbers.
"""
import json
import pytest

from engine.irradiance import build


@pytest.fixture(scope="module")
def result():
    return build.build()


# --- aggregation -----------------------------------------------------------

def test_annual_mean_ignores_nasa_fill_values():
    daily = {"20190101": 5.0, "20190102": -999.0, "20190103": 7.0}
    assert build.annual_means(daily) == {"2019": 6.0}


def test_monthly_means_are_grouped_by_calendar_month():
    daily = {"20190101": 2.0, "20190131": 4.0, "20190201": 9.0}
    assert build.monthly_means(daily) == {"2019-01": 3.0, "2019-02": 9.0}


def test_a_year_with_no_valid_readings_is_omitted_not_zero():
    daily = {"20190101": -999.0, "20200101": 4.0}
    assert build.annual_means(daily) == {"2020": 4.0}


# --- the flatness finding --------------------------------------------------

def test_irradiance_is_reported_as_flat_when_it_is_flat(result):
    """The expected result. Reporting a trend here would be manufacturing one."""
    for r in result["regions"]:
        assert r["irradiance"]["is_flat"] is True
        assert r["irradiance"]["year_to_year_variation_pct"] < 5.0


def test_every_region_reports_irradiance_change_alongside_share_change(result):
    for r in result["regions"]:
        assert "change_pct_2019_2025" in r["irradiance"]
        assert "daytime_change_pts" in r["cf_share"]
        assert "overnight_change_pts" in r["cf_share"]


def test_headline_conclusion_is_about_capacity_not_sunlight(result):
    conclusion = result["conclusion"]["statement"].lower()
    assert "capacity" in conclusion or "built" in conclusion
    assert "brighter" not in conclusion


# --- honesty guards --------------------------------------------------------

def test_output_carries_the_point_is_not_a_region_caveat(result):
    joined = " ".join(result["caveats"]).lower()
    assert "not a" in joined and "centroid" in joined


def test_caveats_travel_in_the_output_not_only_the_readme(result):
    assert len(result["caveats"]) >= 4


def _all_keys(node):
    if isinstance(node, dict):
        for k, v in node.items():
            yield k
            yield from _all_keys(v)
    elif isinstance(node, list):
        for item in node:
            yield from _all_keys(item)


def test_no_causal_coefficients_are_emitted(result):
    """An illustration, not a causal estimate.

    Scoped to emitted FIELD NAMES, not prose: a caveat saying "no coefficient
    is reported" is the opposite of a violation.
    """
    banned = ("r_squared", "coefficient", "explained_by", "caused_by",
              "attribution", "correlation", "slope")
    for key in _all_keys(result):
        low = key.lower()
        for b in banned:
            assert b not in low, f"causal-sounding field emitted: {key}"


def test_regions_with_inherited_generation_say_whose_numbers_these_are(result):
    inherited = [r for r in result["regions"] if r["cf_inherited_from_ba"]]
    assert inherited, "expected zones among the demo-path regions"
    for r in inherited:
        assert r["cf_share_actually_describes"] != r["region"]
        assert r["scale_mismatch_note"]


def test_region_with_a_known_reporting_break_is_excluded_from_the_verdict(result):
    azps = next(r for r in result["regions"] if r["region"] == "AZPS")
    assert azps["verdict"] == "unusable"
    assert azps["data_caveat"]
    assert "AZPS" not in result["conclusion"]["supporting_regions"]


def test_verdicts_come_from_the_allowed_set(result):
    allowed = {"supports", "does_not_separate", "contradicts", "unusable"}
    assert all(r["verdict"] in allowed for r in result["regions"])


def test_regions_that_do_not_support_the_overlay_are_named_not_dropped(result):
    """Counterexamples must survive into the output."""
    named = (result["conclusion"]["supporting_regions"]
             + result["conclusion"]["non_supporting_regions"])
    assert len(named) == len(result["regions"])


def test_non_supporting_regions_carry_a_labelled_post_hoc_reading(result):
    """Interpretation is allowed, but must be marked as after-the-fact."""
    for r in result["regions"]:
        if r["verdict"] in {"does_not_separate", "contradicts"}:
            note = r["why_it_does_not_support"]
            assert note["post_hoc"] is True
            assert note["reading"]
