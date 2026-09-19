"""Tests for alert ranking. Severity = magnitude x persistence x recency."""
import pytest

from engine.alerts import ranking as rk


def alert(**kw):
    """Minimal active alert; override per test."""
    base = dict(
        region="XX", rule="demand_up_20pct", threshold=1200.0,
        baseline_2019=1000.0, unit="MW", first_crossed="2024-01",
        active=True, months_active_streak=12, latest_month="2026-08",
        current_value=1300.0, name="Example", description="desc",
    )
    base.update(kw)
    return base


def region(**kw):
    base = dict(id="XX", ba="XX", zone=None, type="ba", name="Example",
                exclude_from_alerts=False, detection={"rank": 50})
    base.update(kw)
    return base


# --- magnitude -------------------------------------------------------------

def test_magnitude_normalises_mw_to_region_own_scale():
    """500 MW past threshold in a small region beats 500 MW in a huge one."""
    small = rk.magnitude(alert(baseline_2019=2000.0, threshold=2000.0, current_value=2500.0))
    huge = rk.magnitude(alert(baseline_2019=80000.0, threshold=80000.0, current_value=80500.0))
    assert small > huge


def test_magnitude_of_gas_share_uses_yoy_delta_not_level():
    """gas_share_up_3pts_yoy threshold is a DELTA; current_value is the level.

    Comparing the 0.68 level against the 0.03 threshold would report a ~0.65
    exceedance instead of the true ~0.17.
    """
    a = alert(rule="gas_share_up_3pts_yoy", unit="share", threshold=0.03,
              baseline_2019=None, current_value=0.68, current_value_yoy_delta=0.20)
    assert rk.magnitude(a) == pytest.approx(0.17, abs=1e-9)


def test_magnitude_of_cf_share_drop_is_distance_below_baseline():
    a = alert(rule="cf_share_down_3pts", unit="share", threshold=0.59,
              baseline_2019=0.62, current_value=0.50)
    assert rk.magnitude(a) == pytest.approx(0.12, abs=1e-9)


def test_magnitude_of_clean_mw_shortfall_is_relative_to_baseline():
    a = alert(rule="clean_mw_below_2019", unit="MW", threshold=980.0,
              baseline_2019=1000.0, current_value=900.0)
    assert rk.magnitude(a) == pytest.approx(0.08, abs=1e-9)


def test_magnitude_of_record_high_uses_baseline_when_threshold_is_null():
    a = alert(rule="demand_record_high", threshold=None,
              baseline_2019=1000.0, current_value=1200.0)
    assert rk.magnitude(a) == pytest.approx(0.20, abs=1e-9)


def test_magnitude_of_detector_rank_is_higher_for_better_rank():
    r1 = rk.magnitude(alert(rule="detector_top10", unit="rank", threshold=10,
                            baseline_2019=None, current_value=1))
    r9 = rk.magnitude(alert(rule="detector_top10", unit="rank", threshold=10,
                            baseline_2019=None, current_value=9))
    assert r1 > r9


def test_magnitude_is_never_negative():
    a = alert(current_value=1150.0, threshold=1200.0)  # below threshold
    assert rk.magnitude(a) >= 0.0


# --- persistence -----------------------------------------------------------

def test_persistence_sustained_beats_one_month_spike():
    assert rk.persistence(alert(months_active_streak=30)) > \
           rk.persistence(alert(months_active_streak=1))


def test_persistence_saturates_so_one_chronic_alert_cannot_dominate():
    assert rk.persistence(alert(months_active_streak=200)) == \
           rk.persistence(alert(months_active_streak=24))


def test_persistence_of_structural_alert_without_streak_is_neutral():
    assert rk.persistence(alert(rule="detector_top10", months_active_streak=None)) == 1.0


# --- recency ---------------------------------------------------------------

def test_recency_2025_crossing_outranks_2021_crossing():
    assert rk.recency(alert(first_crossed="2025-03")) > \
           rk.recency(alert(first_crossed="2021-03"))


def test_recency_of_structural_alert_without_date_is_neutral():
    assert rk.recency(alert(rule="detector_top10", first_crossed=None)) == 1.0


# --- severity --------------------------------------------------------------

def test_severity_is_product_of_three_factors():
    a = alert()
    assert rk.severity(a) == pytest.approx(
        rk.magnitude(a) * rk.persistence(a) * rk.recency(a), abs=1e-12)


def test_severity_is_a_float():
    assert isinstance(rk.severity(alert()), float)


# --- filtering -------------------------------------------------------------

def test_region_marked_exclude_from_alerts_is_dropped():
    out = rk.rank(
        [alert(region="WACM")],
        {"WACM": region(id="WACM", exclude_from_alerts=True, detection={"rank": 4})},
    )
    assert out["alerts"] == []
    assert out["dropped"]["excluded_region"] == 1


def test_exclusion_applies_to_every_flagged_region_not_just_wacm():
    out = rk.rank(
        [alert(region="ZZZ")],
        {"ZZZ": region(id="ZZZ", exclude_from_alerts=True)},
    )
    assert out["alerts"] == []


def test_inactive_alerts_are_dropped():
    out = rk.rank([alert(active=False)], {"XX": region()})
    assert out["alerts"] == []
    assert out["dropped"]["inactive"] == 1


def test_record_high_dropped_when_region_is_not_detector_top10():
    out = rk.rank(
        [alert(rule="demand_record_high", threshold=None)],
        {"XX": region(detection={"rank": 40})},
    )
    assert out["alerts"] == []
    assert out["dropped"]["record_high_not_top10"] == 1


def test_record_high_kept_when_region_is_detector_top10():
    out = rk.rank(
        [alert(rule="demand_record_high", threshold=None)],
        {"XX": region(detection={"rank": 3})},
    )
    assert len(out["alerts"]) == 1


# --- dedupe and ordering ---------------------------------------------------

def test_dedupe_keeps_only_the_strongest_alert_per_region():
    weak = alert(region="XX", rule="demand_up_20pct", current_value=1210.0)
    strong = alert(region="XX", rule="demand_up_20pct", current_value=1900.0)
    out = rk.rank([weak, strong], {"XX": region()})
    assert len(out["alerts"]) == 1
    assert out["alerts"][0]["current_value"] == 1900.0
    assert out["dropped"]["deduped_same_region"] == 1


def test_output_is_sorted_by_severity_descending():
    alerts = [alert(region=f"R{i}", current_value=1200.0 + i * 100) for i in range(5)]
    regions = {f"R{i}": region(id=f"R{i}") for i in range(5)}
    sev = [a["severity"] for a in rk.rank(alerts, regions)["alerts"]]
    assert sev == sorted(sev, reverse=True)


def test_output_is_capped_at_the_limit():
    alerts = [alert(region=f"R{i}", current_value=1200.0 + i) for i in range(40)]
    regions = {f"R{i}": region(id=f"R{i}") for i in range(40)}
    out = rk.rank(alerts, regions, limit=20)
    assert len(out["alerts"]) == 20
    assert out["dropped"]["over_limit"] == 20


def test_every_returned_alert_carries_a_numeric_severity():
    out = rk.rank([alert(region="A"), alert(region="B")],
                  {"A": region(id="A"), "B": region(id="B")})
    assert all(isinstance(a["severity"], float) for a in out["alerts"])


# --- preservation ----------------------------------------------------------

def test_ranking_preserves_original_text_and_first_crossed():
    a = alert(description="Overnight demand at least 20% above 2019",
              first_crossed="2024-01", name="Example BA")
    out = rk.rank([a], {"XX": region()})
    got = out["alerts"][0]
    assert got["description"] == "Overnight demand at least 20% above 2019"
    assert got["first_crossed"] == "2024-01"
    assert got["name"] == "Example BA"


def test_ranking_does_not_mutate_the_input_alert():
    a = alert()
    rk.rank([a], {"XX": region()})
    assert "severity" not in a
