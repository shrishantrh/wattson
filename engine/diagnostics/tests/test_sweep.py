"""Classifying breaks across a whole BA.

The distinction that matters, learned from PJM: when every fuel stops on the
same date the BA stopped reporting, which is a coverage gap. When one fuel
stops while the others continue, the generation was reattributed -- the AZPS
signature, and the only kind that is a finding.
"""

import pandas as pd

from engine.diagnostics.sweep import (CATEGORY_SPLIT, classify,
                                      find_step_appearance, is_category_split)


def series(values, start="2019-01-01"):
    return pd.Series(values, index=pd.date_range(start, periods=len(values), freq="D"))


def test_every_fuel_breaking_together_is_a_coverage_gap():
    breaks = {"coal": "2020-03-14", "gas": "2020-03-14",
              "nuclear": "2020-03-14", "wind": "2020-03-15"}

    assert classify(breaks, n_fuels=4)["kind"] == "coverage_gap"


def test_one_fuel_breaking_alone_is_a_reattribution():
    """AZPS: nuclear vanished while coal and gas carried on."""
    breaks = {"nuclear": "2019-12-05"}

    result = classify(breaks, n_fuels=4)

    assert result["kind"] == "reattribution"
    assert result["fuels"] == ["nuclear"]


def test_no_breaks_is_clean():
    assert classify({}, n_fuels=5)["kind"] == "clean"


def test_the_2024_category_split_is_recognised_and_excluded():
    assert is_category_split("solar", "2024-07-01")
    assert is_category_split("wind", "2024-07-02")
    assert is_category_split("hydro", "2024-07-02")


def test_a_real_break_on_another_date_is_not_a_category_split():
    assert not is_category_split("nuclear", "2019-12-05")
    assert not is_category_split("solar", "2021-05-03")


def test_a_renamed_child_category_is_not_a_split_on_that_date():
    """Only the parent categories were retired; a child going dark is real."""
    assert not is_category_split("coal", "2024-07-02")


def test_generation_appearing_at_a_step_is_detected():
    """The inverse of AZPS: a double count being created rather than removed."""
    s = series([0] * 40 + [4000] * 40)

    found = find_step_appearance(s)

    assert found is not None
    assert found["date"] == pd.Timestamp("2019-02-09")
    assert found["after"] > 3900


def test_a_gradual_build_is_not_an_appearance():
    assert find_step_appearance(series([i * 45 for i in range(80)])) is None
