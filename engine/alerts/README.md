# Alert prioritisation

Turns the 105 active alerts in `dashboard/public/data/alerts.json` into a
shortlist of 20 fit for a demo screen.

```bash
source ~/hackmit-venv/bin/activate
python3 -m engine.alerts          # writes claims/derived/alerts_ranked.json
python3 -m pytest tests/ -q
```

Reads `dashboard/public/data/{alerts,regions}.json` **read only**. Writes only
`claims/derived/alerts_ranked.json`.

## Severity

`severity = magnitude x persistence x recency`, all dimensionless so MW,
0-1 share and detector-rank rules compare on one axis.

| Factor | Definition |
|---|---|
| magnitude | Distance past the rule's own threshold, divided by that region's own 2019 baseline. 500 MW in a 2 GW region outranks 500 MW in PJM. |
| persistence | `min(1, streak_months / 24)`. Saturates so a chronic alert cannot win on age alone. |
| recency | Three-year half-life on `first_crossed`. A 2025 crossing outranks a 2021 one. |

Per-rule magnitude differs because the fields mean different things:

- `gas_share_up_3pts_yoy` — threshold is a year-over-year **delta**, while
  `current_value` is the gas share **level**. Scoring the level against the
  delta would overstate exceedance by the whole level (0.65 instead of 0.17).
- `demand_record_high` — `threshold` is null; growth over the 2019 baseline
  is used instead.
- `detector_top10` — `current_value` is a rank; rank 1 scores 1.0.

### Missing factors are scored at the population median

The detector alerts carry no time series (`first_crossed`,
`months_active_streak` are null). Scoring an unknown factor as 1.0 hands them
a free pass on two of three factors: the first run put all eight detector
alerts in the top eight slots and the "prioritised" screen became the detector
ranking relabelled. Unknowns are now scored at the median of the observed
population, so a missing factor is never an advantage.

## Filters

Applied in order; every input alert is accounted for in `dropped`.

1. `active == false` — 57 dropped
2. `exclude_from_alerts` on the region — honoured for **every** flagged
   region. WACM is a frozen exclusion and is absent from the feed already.
3. `demand_record_high` unless the region is detector top 10 — 42 dropped
4. Dedupe to the strongest alert per region — 24 dropped
5. Cap at 20 — 17 dropped

## Data problems found, not fixed here

`data/` is absent on every machine in this run, so the pipeline cannot be
re-run and these exports are frozen. Both issues are annotated in the output
rather than silently corrected.

**AZPS generation break — withheld.** Overnight clean share reads ~0.15
against 0.62 in 2019, and clean generation ~356 MW against a 3,373 MW
baseline. CLAUDE.md records this as almost certainly a reporting change, not a
real collapse. Unhandled it produces the largest magnitude in the feed and
tops the screen. Its two generation-side alerts go to `withheld_for_review`
with the reason attached; nothing is deleted, and AZPS's sound demand-side
alerts still rank. `regions.json` carries a `data_flags` entry for WACM only,
so this is **not** machine-readable and is listed in `quality.py`.

**Gas rule uses a partial month — caveated, still ranked.** All six active
`gas_share_up_3pts_yoy` alerts carry `latest_month` 2026-09 while every other
rule uses 2026-08. The snapshot ends 2026-09-05, so September holds five days,
and CLAUDE.md's frozen decisions drop partial months from trailing-12 series.
Values are likely biased. Questionable rather than clearly artificial, so
these stay ranked with `data_caveat` set.
