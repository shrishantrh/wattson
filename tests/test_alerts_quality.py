"""Tests for data-quality caveats on alerts.

Two known problems in the exported feed:
  1. A region whose generation reporting breaks mid-series produces a huge,
     entirely artificial magnitude that would top the ranking.
  2. One rule's trailing-12 window ends on a partial month while every other
     rule ends on the last complete month.
Neither is fixable here (the pipeline cannot be re-run), so both are
annotated, and the clearly-artificial ones are withheld rather than deleted.
"""
from engine.alerts import quality as q


def alert(**kw):
    base = dict(
        region="XX", rule="demand_up_20pct", threshold=1200.0,
        baseline_2019=1000.0, unit="MW", first_crossed="2024-01",
        active=True, months_active_streak=12, latest_month="2026-08",
        current_value=1300.0, name="Example", description="desc",
        severity=0.5,
    )
    base.update(kw)
    return base


# --- suspect generation reporting -----------------------------------------

def test_generation_alert_in_suspect_region_is_caveated():
    a = alert(region="AZPS", rule="clean_mw_below_2019",
              baseline_2019=3373.0, threshold=3306.0, current_value=355.0)
    assert q.caveat_for(a, feed_latest_month="2026-08") is not None


def test_demand_alert_in_suspect_region_is_not_caveated():
    """AZPS demand-side numbers are sound; only its generation side broke."""
    a = alert(region="AZPS", rule="demand_up_20pct")
    assert q.caveat_for(a, feed_latest_month="2026-08") is None


def test_generation_alert_in_ordinary_region_is_not_caveated():
    a = alert(region="DUK", rule="clean_mw_below_2019")
    assert q.caveat_for(a, feed_latest_month="2026-08") is None


def test_suspect_generation_alerts_are_withheld_not_deleted():
    suspect = alert(region="AZPS", rule="cf_share_down_3pts",
                    baseline_2019=0.62, threshold=0.59, current_value=0.146)
    ordinary = alert(region="DUK")
    kept, withheld = q.partition([suspect, ordinary], feed_latest_month="2026-08")
    assert [a["region"] for a in kept] == ["DUK"]
    assert [a["region"] for a in withheld] == ["AZPS"]


def test_withheld_alert_keeps_its_original_content_and_gains_a_reason():
    suspect = alert(region="AZPS", rule="cf_share_down_3pts",
                    description="Overnight carbon-free share below 2019",
                    first_crossed="2020-04")
    _, withheld = q.partition([suspect], feed_latest_month="2026-08")
    assert withheld[0]["description"] == "Overnight carbon-free share below 2019"
    assert withheld[0]["first_crossed"] == "2020-04"
    assert withheld[0]["data_caveat"]


# --- partial-month window --------------------------------------------------

def test_alert_computed_past_the_feeds_latest_month_is_caveated():
    a = alert(region="LDWP", rule="gas_share_up_3pts_yoy",
              latest_month="2026-09", threshold=0.03,
              current_value_yoy_delta=0.20, baseline_2019=None)
    assert "2026-09" in q.caveat_for(a, feed_latest_month="2026-08")


def test_alert_on_the_feeds_latest_month_is_not_caveated():
    a = alert(latest_month="2026-08")
    assert q.caveat_for(a, feed_latest_month="2026-08") is None


def test_partial_month_alerts_are_caveated_but_still_ranked():
    """A different window is questionable, not clearly artificial."""
    a = alert(region="LDWP", rule="gas_share_up_3pts_yoy",
              latest_month="2026-09", threshold=0.03,
              current_value_yoy_delta=0.20, baseline_2019=None)
    kept, withheld = q.partition([a], feed_latest_month="2026-08")
    assert [x["region"] for x in kept] == ["LDWP"]
    assert withheld == []
    assert kept[0]["data_caveat"]


def test_structural_alert_without_a_month_is_not_caveated():
    a = alert(rule="detector_top10", latest_month=None,
              first_crossed=None, months_active_streak=None,
              threshold=10, baseline_2019=None, current_value=3)
    assert q.caveat_for(a, feed_latest_month="2026-08") is None


def test_clean_alert_gets_no_caveat_field():
    kept, _ = q.partition([alert()], feed_latest_month="2026-08")
    assert "data_caveat" not in kept[0]


def test_partition_does_not_mutate_inputs():
    a = alert(region="AZPS", rule="clean_mw_below_2019")
    q.partition([a], feed_latest_month="2026-08")
    assert "data_caveat" not in a
