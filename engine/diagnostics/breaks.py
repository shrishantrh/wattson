"""Distinguish a reporting break from a real grid event.

A step change on a single date is an artefact of how the data is collected: a
respondent change, a footprint reassignment, a double count being removed. A
decline over months is the grid actually changing. That single distinction
decides how a number should be treated, so it is worth computing explicitly
rather than eyeballing a chart.
"""

import pandas as pd

MIN_DROP_FRACTION = 0.80   # the level must essentially disappear
MIN_STABLE_DAYS = 30       # ...and stay gone, so an outage does not qualify
MAX_TRANSITION_DAYS = 3    # ...having fallen within a few days, not over months


def find_step_break(series, min_drop=MIN_DROP_FRACTION,
                    stable_days=MIN_STABLE_DAYS,
                    transition_days=MAX_TRANSITION_DAYS):
    """Return {date, before, after, after_is_missing} for the first sustained
    step down, or None if the series only declines gradually or recovers."""
    if len(series) < 2 * stable_days:
        return None

    filled = series.astype(float)
    for i in range(stable_days, len(filled) - stable_days):
        before = filled.iloc[max(0, i - stable_days):i]
        after = filled.iloc[i:i + stable_days]
        if before.isna().all():
            continue
        level = before.mean(skipna=True)
        if not level or level <= 0:
            continue

        after_missing = bool(after.isna().all())
        zeroed = after.fillna(0)
        threshold = (1 - min_drop) * level
        # EVERY value after the step must be down, not just the average. A
        # mean, or even a high quantile, fires a few days early because the
        # window still holds pre-break values and they average away -- which
        # would misdate the break. Requiring the maximum to be down is strict,
        # and strict is the right bias when the output is a claim that a
        # published number is wrong.
        if zeroed.max() > threshold:
            continue
        after_level = 0.0 if after_missing else zeroed.mean()

        # A step falls within a few days; a ramp takes longer to get there.
        window = filled.iloc[max(0, i - transition_days):i].fillna(0)
        if (window > 0.5 * level).sum() < 1:
            continue

        return {"date": filled.index[i],
                "before": float(level),
                "after": float(after_level),
                "after_is_missing": after_missing}
    return None
