# Alert prioritisation

Turns the 105 active alerts in `dashboard/public/data/alerts.json` into a
ranked shortlist fit for a demo screen.

```bash
source ~/hackmit-venv/bin/activate
python3 -m engine.alerts          # writes claims/derived/alerts_ranked.json
python3 -m engine.alerts 15       # optional: a different cap
python3 -m pytest tests/ -q       # 57 tests
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

### Missing factors score at the population median

The detector alerts carry no time series: `first_crossed` and
`months_active_streak` are null. The first working version scored those
unknowns as 1.0, which handed structural alerts a free pass on two of the
three factors. All eight detector alerts took the top eight slots, their
severities were the detector rank restated (1.0, 0.9, 0.8 ...), and the
"prioritised" screen had silently become the detector ranking relabelled — a
plausible-looking screen that was secretly a tautology.

No test caught this. Every test passed. It was found by reading the output and
asking why the ordering looked so tidy. That is worth recording: the failure
mode this project cares about does not announce itself as a crash.

Unknown factors now score at the **median of the observed population**, so
missing data is never an advantage. `severity_factors.neutral_applied` on each
alert names which factors were imputed.

## Filters

Applied in order. Every input alert is accounted for in `dropped` plus
`withheld_for_review`; the totals reconcile to 162.

1. `active == false` — 57 dropped
2. `exclude_from_alerts` on the region — honoured for **every** flagged
   region, not just WACM. WACM is a frozen exclusion and is already absent
   from the feed.
3. `demand_record_high` unless the region is detector top 10 — 42 of 50 dropped
4. Withheld for data quality — 8 (see below)
5. Dedupe to the strongest alert per region — 22 dropped
6. Cap at 20 — 13 dropped

Note on the cap: withholding the 8 bad alerts did **not** shrink the list,
because the cap is binding. 33 regions remain eligible, so freed slots are
refilled from the waiting list and `over_limit` simply fell from 17 to 13.
Changing the shortlist length is a separate decision — pass a limit argument.

## Data problems found, reported, not fixed

`data/` is absent on every machine in this run, so the pipeline cannot be
re-run and these exports are frozen. Both problems below are in the exported
data. They are withheld with a reason attached, never deleted and never
quietly corrected.

### AZPS: generation-side numbers are suspect, demand-side rank 3 is sound

State this plainly to anyone reading the alert list, because the two halves of
AZPS have opposite standing:

- **Generation side — do not use.** Overnight clean share reads ~0.15 in 2025
  against 0.62 in 2019, and overnight clean generation ~356 MW against a
  3,373 MW 2019 baseline. That is an 87% collapse; no real grid does that.
  CLAUDE.md records it as almost certainly a reporting change.
- **Demand side — sound.** AZPS holds detector rank 3 on demand evidence
  alone, and it still ranks in this shortlist on that basis.

Unhandled, the artefact produces the largest magnitude in the whole feed and
lands at #1 on the demo screen. It was one predicate away from doing so.

The reason it nearly slipped through is the real finding: **the caveat exists
in CLAUDE.md prose and nowhere a program can see it.** `regions.json` gives
AZPS `data_flags: []` and `exclude_from_alerts: false`; `meta.data_flags` has
one key, `WACM`; `alerts.json` lists `excluded_regions: ["WACM"]`. Honouring
`exclude_from_alerts` generically — the correct instruction — could never have
caught this. The region list therefore lives in `quality.py`, with its source
named, until the export encodes it.

Withheld reason: `suspect_generation_reporting`.

### Gas rule is computed on a partial month

All six active `gas_share_up_3pts_yoy` alerts (LDWP, WALC, SCEG, PACW, AECI,
PNM) carry `latest_month` 2026-09. Every other active rule uses 2026-08. The
snapshot ends 2026-09-05, so that window holds **five days**, and CLAUDE.md's
frozen decisions drop partial months from trailing-12 series. A five-day
number beside full-month numbers on one screen is exactly the
clean-looking-wrong-number failure this project exists to avoid, and PACW was
ranking 7th.

**Root cause is in `scripts/export_json.py` and cannot be fixed here**, because
nothing on this machine can run the pipeline. Reported, not papered over.

Withheld reason: `partial_month_2026_09`.

## Validation

Three of the four regions named in advance as detector validation —
ERCO/FWES, SWPP/OPPD, PJM/DOM — land in the top 5, with ERCO/NRTH alongside
them. I did not tune for that.

Top magnitudes were cross-checked against `regions.json` rather than trusted:
ERCO/FWES overnight 3,404 -> 7,496 MW monotonic 2019-2026; SWPP/OPPD
1,160 -> 1,864 monotonic; PJM/DOM trailing-12 +47.2% against 2019 overnight,
consistent with `overnight_growth_pct` 39.5 for 2025 and with CLAUDE.md's +32%
(that figure is *average* demand, 31.8 — overnight runs faster, which is the
project's own discriminator). ERCO/FWES magnitude above 1.0 is correct, not a
bug: it sits a full 2019 baseline past its threshold.
