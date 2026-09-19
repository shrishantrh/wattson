"""Cliff vs ramp is the whole question: a step change on one date is a
reporting artefact, a decline over months is a real grid event."""

import pandas as pd

from engine.diagnostics.breaks import find_step_break


def series(values, start="2019-01-01"):
    return pd.Series(values, index=pd.date_range(start, periods=len(values), freq="D"))


def test_a_step_to_zero_on_one_day_is_a_break():
    s = series([4000] * 40 + [0] * 40)

    br = find_step_break(s)

    assert br is not None
    assert br["date"] == pd.Timestamp("2019-02-10")
    assert br["before"] > 3900 and br["after"] == 0


def test_a_gradual_decline_over_months_is_not_a_break():
    s = series([4000 - i * 45 for i in range(80)])

    assert find_step_break(s) is None


def test_a_step_into_missing_data_is_still_a_break():
    """AZPS did not report zero at first -- it stopped reporting at all, and
    only switched to a literal zero seventeen months later."""
    s = series([4000] * 40 + [float("nan")] * 40)

    br = find_step_break(s)

    assert br is not None
    assert br["date"] == pd.Timestamp("2019-02-10")
    assert br["after_is_missing"] is True


def test_normal_operating_variation_is_not_a_break():
    """Plants trip and come back. A dip that recovers is not a reporting change."""
    s = series([4000] * 30 + [0] * 5 + [4000] * 45)

    assert find_step_break(s) is None


def test_a_long_outage_that_recovers_is_not_a_break():
    """Nuclear refuelling outages run past thirty days, so a 30-day stable
    window alone flags them. BPAT, NYIS and SCEG all came back; only AZPS
    never did. Permanence is what separates a reporting change from an outage."""
    s = series([4000] * 40 + [0] * 45 + [4000] * 60)

    assert find_step_break(s) is None


def test_a_break_that_never_recovers_is_still_a_break():
    s = series([4000] * 40 + [0] * 105)

    assert find_step_break(s) is not None


def test_a_small_partial_recovery_does_not_excuse_a_break():
    """Coming back at 5% of the old level is not the plant returning."""
    s = series([4000] * 40 + [0] * 60 + [200] * 45)

    assert find_step_break(s) is not None
