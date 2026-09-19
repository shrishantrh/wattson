"""A trailing-12 window must not exist before twelve months of history.

pandas .rolling(12) silently produced a value at the very first month here, so
the "trailing 12" series began with a one-month average pretending to be a
twelve-month one. It was caught by calibrating against the published series,
not by reading the code.
"""

import pandas as pd

from engine.diagnostics.corrections import COL, NIGHT, trailing12


def synthetic_azps(months, mw_per_fuel):
    rows = []
    for m in months:
        for day in pd.date_range(f"{m}-01", periods=2, freq="D"):
            for hour in NIGHT:
                ts = day + pd.Timedelta(hours=hour)
                for fuel, mw in mw_per_fuel.items():
                    rows.append({"datetime_utc": ts, "local": ts,
                                 "generation_energy_source": fuel, COL: mw})
    return pd.DataFrame(rows)


MONTHS = [f"2019-{m:02d}" for m in range(1, 13)] + ["2020-01", "2020-02"]


def test_no_window_before_twelve_months_of_history():
    d = synthetic_azps(MONTHS, {"nuclear": 100.0, "gas": 100.0})

    out = trailing12(d, ex_nuclear=False, months=MONTHS)

    assert out["month"] == ["2019-12", "2020-01", "2020-02"]


def test_excluding_nuclear_changes_the_share():
    d = synthetic_azps(MONTHS, {"nuclear": 300.0, "gas": 100.0})

    with_nuc = trailing12(d, ex_nuclear=False, months=MONTHS)
    without = trailing12(d, ex_nuclear=True, months=MONTHS)

    assert with_nuc["overnight_share"][0] == 0.75
    assert without["overnight_share"][0] == 0.0


def test_a_month_absent_from_the_data_is_skipped_not_invented():
    d = synthetic_azps(MONTHS, {"gas": 100.0})

    out = trailing12(d, ex_nuclear=False, months=MONTHS + ["2099-01"])

    assert "2099-01" not in out["month"]
