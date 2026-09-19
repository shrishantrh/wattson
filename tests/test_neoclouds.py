"""Neocloud facility rows and the curtailment check on our own detector."""
import json
import pytest

from engine.neoclouds import build, sites

REGION_IDS = {r["id"] for r in build.load_regions()}
SOURCE_TYPES = {"company_disclosure", "sec_filing", "press", "inferred"}


def test_every_site_has_identity_and_a_source():
    for s in sites.SITES:
        assert s["company"] and s["ticker"] and s["metro"] and s["state"]
        assert s["source_url"].startswith("http")
        assert s["source_type"] in SOURCE_TYPES


def test_every_ba_is_a_real_region_or_explicitly_null():
    for s in sites.SITES:
        if s["ba"] is not None:
            assert s["ba"] in REGION_IDS, f"{s['metro']}: unknown BA {s['ba']}"


def test_a_site_without_a_serving_utility_says_why():
    for s in sites.SITES:
        if not s["serving_utility"]:
            assert s["unresolved_reason"], f"{s['metro']} has no utility and no reason"


def test_no_site_is_mapped_from_its_state_alone():
    """Texas is not a balancing authority. Every BA needs a stated basis."""
    for s in sites.SITES:
        if s["ba"] is not None:
            assert s["ba_basis"], f"{s['metro']} has a BA with no stated basis"


def test_the_two_boundary_traps_are_recorded_in_opposite_directions():
    by_metro = {s["metro"]: s for s in sites.SITES}
    childress = by_metro["Childress"]
    abernathy = by_metro["Abernathy"]
    # Panhandle site that looks like SPP but is ERCOT.
    assert childress["state"] == "TX" and childress["ba"] == "ERCO"
    # Texas site that looks like ERCOT but is SPP.
    assert abernathy["state"] == "TX" and abernathy["ba"] == "SWPP"
    assert "trap" in childress["note"].lower()
    assert "trap" in abernathy["note"].lower()


def test_columns_match_the_existing_facility_lookup():
    assert build.COLUMNS[:9] == [
        "company", "ticker", "metro", "state", "serving_utility", "ba",
        "zone", "source_type", "source_url"]


def test_rows_render_with_every_lookup_column():
    for row in build.rows():
        assert set(row) == set(build.COLUMNS)


# --- the curtailment check -------------------------------------------------

@pytest.fixture(scope="module")
def curtailment():
    return build.curtailment_check()


def test_curtailment_check_reports_the_detector_correlation(curtailment):
    r = curtailment["load_factor_term"]["correlation_with_score"]
    assert -1.0 <= r <= 1.0


def test_curtailment_check_covers_the_two_top_ranked_ercot_zones(curtailment):
    zones = {z["region"] for z in curtailment["ercot_zones"]}
    assert {"ERCO/NRTH", "ERCO/FWES"} <= zones


def test_curtailment_verdict_is_stated_either_way(curtailment):
    assert curtailment["verdict"] in {"bias_present_and_visible",
                                      "bias_present_but_not_visible",
                                      "no_bias_mechanism"}
    assert curtailment["statement"]
