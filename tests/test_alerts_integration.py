"""End-to-end checks against the real exported feed.

These assert the acceptance criteria for the demo screen, plus the frozen
decision that WACM never appears in alerts.
"""
import json
import pytest

from engine.alerts import pipeline


@pytest.fixture(scope="module")
def result():
    return pipeline.build()


def test_produces_at_most_twenty_alerts(result):
    assert len(result["alerts"]) <= 20


def test_produces_a_useful_number_of_alerts(result):
    """A shortlist that collapsed to nothing would also satisfy '<= 20'."""
    assert len(result["alerts"]) >= 10


def test_every_alert_carries_a_numeric_severity(result):
    for a in result["alerts"]:
        assert isinstance(a["severity"], float)
        assert a["severity"] > 0.0


def test_alerts_are_sorted_by_severity_descending(result):
    sev = [a["severity"] for a in result["alerts"]]
    assert sev == sorted(sev, reverse=True)


def test_wacm_never_appears_in_alerts(result):
    everywhere = result["alerts"] + result["withheld_for_review"]
    assert all(a["region"] != "WACM" for a in everywhere)


def test_no_region_excluded_from_alerts_appears(result):
    regions = pipeline.load_regions()
    excluded = {r["id"] for r in regions if r.get("exclude_from_alerts")}
    assert excluded, "fixture sanity: expected at least one excluded region"
    assert all(a["region"] not in excluded for a in result["alerts"])


def test_no_region_appears_twice(result):
    ids = [a["region"] for a in result["alerts"]]
    assert len(ids) == len(set(ids))


def test_record_high_alerts_survive_only_for_detector_top10(result):
    regions = {r["id"]: r for r in pipeline.load_regions()}
    for a in result["alerts"]:
        if a["rule"] == "demand_record_high":
            assert regions[a["region"]]["detection"]["rank"] <= 10


def test_all_shares_remain_zero_to_one_fractions(result):
    for a in result["alerts"]:
        if a.get("unit") == "share":
            assert 0.0 <= a["current_value"] <= 1.0


def test_original_alert_text_is_preserved(result):
    source = {(a["region"], a["rule"]): a for a in pipeline.load_alerts()["alerts"]}
    for a in result["alerts"]:
        original = source[(a["region"], a["rule"])]
        assert a["description"] == original["description"]
        assert a["first_crossed"] == original["first_crossed"]
        assert a["current_value"] == original["current_value"]


def test_drop_counts_account_for_every_input_alert(result):
    total_in = len(pipeline.load_alerts()["alerts"])
    accounted = (len(result["alerts"])
                 + len(result["withheld_for_review"])
                 + sum(result["dropped"].values()))
    assert accounted == total_in


def test_suspect_generation_alerts_are_withheld_not_silently_dropped(result):
    withheld = result["withheld_for_review"]
    assert withheld, "expected AZPS generation-side alerts to be withheld"
    assert all(a["data_caveat"] for a in withheld)
    assert all(a["withheld_reason"] for a in withheld)


def test_no_ranked_alert_is_computed_past_the_feeds_latest_month(result):
    """Every survivor shares one trailing-12 window."""
    latest = result["latest_month"]
    for a in result["alerts"]:
        if a.get("latest_month") is not None:
            assert a["latest_month"] <= latest


def test_all_six_partial_month_gas_alerts_are_withheld(result):
    held = [a for a in result["withheld_for_review"]
            if a["withheld_reason"] == "partial_month_2026_09"]
    assert {a["region"] for a in held} == {
        "LDWP", "WALC", "SCEG", "PACW", "AECI", "PNM"}


def test_every_ranked_alert_carries_a_tier(result):
    assert all(a["tier"] in {"primary", "supporting", "chronic"}
               for a in result["alerts"])


def test_tier_counts_match_the_observed_severity_breaks(result):
    import collections
    counts = collections.Counter(a["tier"] for a in result["alerts"])
    assert counts == {"primary": 6, "supporting": 6, "chronic": 2}
