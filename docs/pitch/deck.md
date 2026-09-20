# Wattson — pitch deck (plain text)

Companion to `docs/pitch/deck.html`. Same content, slide by slide, with the timing budget,
the purpose of the slide, and the repo source for every number on it.

**The deck follows `docs/pitch/script.md`, which is the performance spine.** The script is
machine-timed from its word count at 130 wpm and lands its last word at 2:59. Its shape is:
**setup 0:00–0:42**, **app 0:42–2:34** (three beats), **close 2:34–2:59**. The deck is a
frame around that, so it is **7 running slides: 42 s of front, a holding slide for the
112 s in the app, 25 s of close.**

Revised twice on 2026-09-19: first against `docs/pitch/numbers.md` (52 figures checked),
then against `docs/pitch/script.md`. Where the fact-check and the older prose
(`README.md`, `CLAUDE.md`, `docs/numbers_checklist.md`) disagree, `web/public/api/` wins.

Paths: `api/` = `web/public/api/` (what the site actually serves); `dash/` =
`dashboard/public/data/regions.json` (the pipeline export).

Controls in `deck.html`: `→` / `space` forward, `←` back, `N` presenter notes (timing per
slide), **`B` jumps to the backup slides and back**, `F` full screen, click right/left half
to advance/go back. The counter reads "3 / 7" in the running order and "backup 2 / 3" past
the close.

**Stage vocabulary.** The script bans "balancing authority" on stage (say "grids"), bans
"carbon-free share of generation", "caused by", "lied", "greenwashing", "headroom",
"70 grid regions" and "0.15 for Phoenix". The written counts on slide 4 are there for
judges reading the screen, not to be read aloud. Three counts are in play and any one named
must say which: **70** balancing authorities in the hourly index, **124** published regions,
**111** scored by the detector.

---

## Slide 1 — Title · 5 s (0:00–0:05)

**Purpose:** name the project while the presenter's hands are off the laptop. Covers the
script's 0:00 ("I'm Shrishant. This is Wattson.") and 0:03 ("AI datacenters draw the same
power at 3am as at noon.").

> **Wattson**
> It follows the power, not the press release.
> Hourly carbon-free share of generation for 70 US balancing authorities · EIA-930 via PUDL · snapshot ends 2026-09-05
> Eyebrow: HackMIT 2026 · Voloridge, Signal in the Noise

| Number / fact | Source |
|---|---|
| tagline | `README.md` L3; script 2:55 |
| 70 balancing authorities | `data/processed/hourly_cf_index.parquet` `ba.nunique()` = 70 (numbers.md §2.4) |
| "snapshot ends 2026-09-05" | `api/regions.json` → `meta.data_snapshot_end` |
| "EIA-930 via PUDL", Voloridge dataset #6 | `README.md` L8–13; `docs/spec.md` L59 |

---

## Slide 2 — Decarbonization happened in daylight · 13 s (0:05–0:18)

**Purpose:** carries the script's 0:08 line ("37 percent to 47. At night: 40 to 40") and
0:18 ("Solar fixed the day. It did nothing for the night."). The script notes this is the
**only** pair of numbers quoted with no app behind it, so the slide has to hold them.

> **Decarbonization happened in daylight.**
> Clean share, midday: **37.2% → 46.5%** (10:00–15:59 local, 2019 to 2025)
> Clean share, overnight: **40.5% → 39.7%** (00:00–05:59 local, 2019 to 2025)
> A datacenter draws the same power at 3am in January as at noon in June.

| Number | Source |
|---|---|
| 37.2% → 46.5% daytime | `api/regions.json` → `meta.national.cf_share["2019"/"2025"].daytime` = 0.372 / 0.465 |
| 40.5% → 39.7% overnight | same field `.overnight` = 0.405 / 0.397; day **+9.3 pts**, night **−0.8 pts** |
| the two windows, local time | `api/regions.json` → `meta.overnight_hours_local`, `meta.daytime_hours_local` |
| "same power at 3am as at noon" | framing, not a measurement — the permitted phrasing (numbers.md §3) |

The slide shows one decimal; the presenter says "37 to 47, 40 to 40". Both are the same
fields. **Trap (numbers.md T8):** this is a **share**. Clean megawatts at night rose 14 GW
nationally (159,031 → 173,380) against 45 GW of new overnight **generation** (T7). 2025 is
the last complete year; 2026 is partial and must not be mixed in (T11).

---

## Slide 3 — The finding, as an increment · 12 s (0:18–0:30)

**Purpose:** sits under the script's 0:23 line, "'one hundred percent clean' is an annual
average — we wanted the hourly one". It **previews** the finding the presenter narrates in
the app at 2:04; he does not read the digits here. A preview before the app is fine; a
repeat after it is not, which is why the other back-half slides were cut.

> **PJM · the mid-Atlantic grid · overnight**
> **PJM added 8.7 GW of generation at night since 2019. None of it was clean.**
> **+8,701** avg MW more generation at night · **−81** avg MW clean at night (35,700 → 35,619)
> **−0.9%** of the increment was clean · **+10.7 GW** gas (coal −2.5) · **3.8 → 2.5 GW** night exports to neighbours
> Consistent with datacenter load being served by gas. Part of the gas rise is coal-to-gas switching. Average mix, not marginal.

| Number | Source |
|---|---|
| +8,701 avg MW overnight generation | `api/region/PJM.json` → `total_avg_mw` overnight 82,539 → 91,240 |
| 35,700 → 35,619, i.e. −81 MW | `api/region/PJM.json` → `cf_avg_mw[y].overnight`; −81 MW = 0.23% of the 2019 level |
| −0.9% of the increment was clean | −81 / 8,701 = −0.0093 (numbers.md §2.1) |
| gas +10.7 GW, coal −2.5 | `fuel_delta_overnight_gw`; deltas sum to +8.69 GW against +8.70 total |
| 3.8 → 2.5 GW overnight net export | `interchange["2019"/"2025"].overnight_net_export_mw` = 3814 / 2489 |

If gas (+10.7) exceeding the total (+8.7) is challenged: coal −2.5 and nuclear −0.9 close
it, and part of the gas rise is coal-to-gas switching (`numbers_checklist.md` DISC 3).

---

## Slide 4 — What it is · 12 s (0:30–0:42)

**Purpose:** the script's 0:29 line — what Wattson reads, and the two questions it asks.
Last slide before the app.

> **A clean-power number for every hour, every balancing authority.**
> **4,451,763** hourly rows, 70 balancing authorities, 2018-07-01 to 2026-09-05
> **111** regions scored for flat 24/7 load (68 zones + 43 balancing authorities) — from demand alone, no company list
> **52** balancing authorities ranked for where new flat load would run cleanest
> **10** claims from 4 companies, checked against the grids their sites draw from
> Flat load raises the overnight floor faster than the mean. That fingerprint is visible in demand data before anyone announces a building.

| Number | Source |
|---|---|
| 4,451,763 hourly rows; 70 BAs; 2018-07-01 to 2026-09-05 | `data/processed/hourly_cf_index.parquet` row count, `ba.nunique()`, `datetime_utc` min/max (numbers.md §2.4) |
| 111 scored = 68 zones + 43 BAs | `api/regions.json` → `meta.n_scored`; composition counted by `type` |
| 52 balancing authorities ranked | `api/region/PJM.json` → `siting.n_ranked` |
| 10 claims, 4 companies | counted across `api/company/*.json`; `api/companies.json` `count` = 4, `is_mock: false` |

**Caveat that travels with the first two figures:** they are reproducible but live only in a
**gitignored local parquet**. If a judge asks for the field: "it's the row count of the
hourly index; the published JSON carries the 124 regions built from it, not the raw rows."

---

## Slide 5 — HOLDING SLIDE, live demo · 112 s (0:42–2:34)

**Purpose:** stays on screen behind the presenter while he is in the app for all three
beats. No numbers on this slide by design.

> **Live** — **Wattson, running.**
> · Check a company's claim against its grid
> · Compare 300 MW of new flat load across three places
> · Watch where the load is already landing
> Static site, precomputed JSON, no backend to fail.

The three bullets are the script's three beats, in order:

| Beat | Clock | Route | What is spoken |
|---|---|---|---|
| 1 | 0:42–1:23 | `#/check/GOOGL` → `?evidence=1` | 100% claimed, true on paper, 6% on the Santee Cooper grid; then page 4 against page 94's ~65% hourly, five years |
| 2 | 1:23–1:59 | `#/compare?mw=300&metros=Phoenix\|Northern Virginia\|Omaha` | Omaha 52% and improving; **Phoenix 2nd on 10%, the double-count line is mandatory**; N. Virginia 39% and getting worse; 144 MW off fossil in Omaha, average mix |
| 3 | 1:59–2:34 | `#/found` | clean at night flat since 2019, +8.7 GW of which 10.7 gas, "consistent with, not caused by"; 111 regions, weights frozen, N. Virginia 6th, Dallas 91st |

**This is why the back half shrank.** Beats 2 and 3 now speak the Phoenix double count and
the frozen-weights/validation-ranks story out loud, in front of the screens that show them.
Slides repeating either after 2:34 would tell the audience something they heard 40 seconds
earlier. Both are now backup slides (below), where they are worth more.

"Static site, no backend": `docs/spec.md` L228; `api/index.json` (137 files, every one a
real endpoint response). If the presenter falls behind, the script cuts **beat 2 whole** —
the holding slide does not change.

---

## Slide 6 — What we do not claim · 10 s (2:34–2:44)

**Purpose:** the script's first close line, word for word, hands off the laptop. The
honesty constraints stated as a feature.

> **The limits are on the screen, not in a footnote.**
> · Generation inside a footprint, not consumption. Interchange is not allocated.
> · Average grid mix, not marginal emissions.
> · "Consistent with datacenter load being served by gas," never "caused by."
> · "True on paper, X physically," never "they lied." 9 of 10 claims true on paper, 1 we cannot verify — counted on screen.
> · Regions are coarse; PJM spans Chicago to New Jersey. Site and operator mapping is hand-curated.
> Every figure in the app traces to a file in the repo: docs/numbers_checklist.md

| Fact | Source |
|---|---|
| the five limits | `api/regions.json` → `meta.caveats`; `CLAUDE.md` Honesty rules; `docs/spec.md` L298–309 |
| 9 true on paper, 1 cannot_verify | counted across `api/company/*.json`; `api/companies.json` `cannot_verify_total` = 1 |
| every figure traced | `docs/numbers_checklist.md`, `docs/pitch/numbers.md`; `node web/test/smoke.mjs` |

Spoken line: *"Generation inside a footprint, not consumption. Average mix, not marginal.
Contracts excluded. Claims we can't check are counted on screen."*

---

## Slide 7 — Close · 15 s (2:44–2:59)

**Purpose:** carries the script's last three lines — the credit, the scale figure, the
tagline — so each has something behind it.

> **It follows the power, not the press release.**
> **4,451,763** hours of grid data, 70 US grids, 2018–2026 · **Yash** the data engine and the claims extraction · **Shrishant** the product you just used
> EIA-930 via PUDL (Voloridge dataset #6) · static site, no backend · every figure traces to a file in the repo

| Fact | Source |
|---|---|
| 4,451,763 hours | as slide 4; spoken as "four and a half million hours of grid data" (script 2:50) |
| credit split | script 2:44; `CLAUDE.md` ownership |
| tagline | script 2:55 |

The script marks "four and a half million hours" as the one line that may be dropped
anywhere if the clock is tight; the slide survives losing it.

---

## Timing summary — running order

| # | Slide | Seconds | Cumulative | Script anchor |
|---|---|---|---|---|
| 1 | Title | 5 | 0:05 | 0:00, 0:03 |
| 2 | Decarbonization happened in daylight | 13 | 0:18 | 0:08, 0:18 |
| 3 | The finding, as an increment (preview) | 12 | 0:30 | 0:23 |
| 4 | What it is | 12 | 0:42 | 0:29 |
| 5 | **Holding slide — live demo** | 112 | 2:34 | beats 1–3 |
| 6 | What we do not claim | 10 | 2:44 | 2:34 |
| 7 | Close | 15 | 2:59 | 2:44, 2:50, 2:55 |

Front **42 s** · app **112 s** · close **25 s** · **total 179 s**, last word at 2:59,
matching the script's own machine-timed total exactly.

### Why three slides were cut, not two

The back half had to land at about 25 s against 25 s of spoken words. Two candidate cuts
both satisfy the arithmetic:

- dropping the frozen-method and Phoenix slides leaves claims + limits + close = 10 + 9 + 5 = **24 s**;
- dropping frozen-method, Phoenix **and** the Google claims slide leaves limits + close = 10 + 15 = **25 s**.

The second was chosen because of *what* is spoken in those 25 seconds. The script's close
(2:34–2:59) contains no mention of Google: the words are the limits, the credit, the scale
figure and the tagline. A Google slide would therefore sit unnarrated for 10 of the 25
closing seconds, while the credit and the scale figure — which *are* spoken — would have
nothing behind them. Worse, the three Google numbers are spoken in beat 1 at 0:44–1:21, so
the slide is a repeat, not a preview. Moving it to backup and giving the close its own 15 s
fixes both ends.

Slide 3 stays despite covering the same finding as beat 3, because it comes **before** the
app: it plants the headline at 0:18 and the presenter narrates it at 2:04. That direction is
reinforcement, not repetition.

---

## Backup slides — NOT in the running order

Press **`B`** in `deck.html` to jump to them and `B` again to return. Each is badged
"BACKUP — NOT IN THE RUNNING ORDER" on screen so it cannot be mistaken for a live slide.
They exist for the question period; every one of them covers ground the presenter already
spoke while standing in the app.

### B1 — Frozen before we saw a single rank

**For judges' Q4:** "How do I know you didn't tune the detector to find Data Center Alley?"
Spoken live at 2:20 on `#/found`, pointing at the four ranks.

> **Frozen before we saw a single rank.**
> Weights, the 500 MW cut and the p99.5 peak were fixed first. Four validation regions were named in advance. Ranks are reported as they came out.
> **6th** N. Virginia (PJM/DOM) · **7th** Omaha (SWPP/OPPD) · **19th** AEP zone, Columbus out across five states (PJM/AEP) · **91st** Dallas (ERCO/NCEN) — the miss, kept on screen
> score = z(overnight excess) + z(neighbour divergence) + 0.5 z(load-factor delta), robust z · 111 regions scored · nothing re-tuned after the fact

| Number / fact | Source |
|---|---|
| the four regions, named in advance | `api/regions.json` → `meta.validation_named_in_advance` |
| rank 6 / score 7.71 / growth 31.8 | `api/region/PJM%2FDOM.json` → `detection` |
| rank 7 / 6.82 / 39.4 · rank 19 / 2.29 / 9.2 · rank 91 / −1.32 / 14.2 | `SWPP%2FOPPD`, `PJM%2FAEP`, `ERCO%2FNCEN` |
| formula, robust z, 500 MW cut, p99.5 peak | `api/regions.json` → `meta.detector_method` |
| the 500 MW cut holds | 13 regions unranked; largest excluded IID 434 MW, smallest ranked TPWR 518 MW |

Say "the AEP zone — Columbus and out across Ohio, Indiana, West Virginia, Virginia and
Kentucky", never "Central Ohio" as if it were a metro (numbers.md T9). Why Dallas is 91st:
growth 14.2% against a median ERCOT zone near 26%, so neighbour divergence is −12.2.

### B2 — Two operators were reporting the same nuclear plant

**For judges' Q5:** "Your own data shows Phoenix falling from 62% to 10. Did it collapse?"
Spoken live at 1:35 on `#/compare`, where the corrected ranking is already on screen.

> **Two operators were reporting the same nuclear plant.**
> Phoenix at night, as published: **62% → 10%** — a collapse, 2019 to 2025
> Like for like, corrected: **1.7% → 10.4%** — a rise. The published figure was wrong in direction, not just magnitude.
> **0.9948** correlation over 7,976 hours · **98.8%** of hours identical within 5 MW · **7,087 MW** combined, against a 3,937 MW nameplate
> Ends in a step on one date, 2019-12-04, not a decline. Published and corrected are shown side by side; the export is not rewritten. The demand-side detector rank (3rd) has no generation term and is untouched.

| Number | Source |
|---|---|
| published 2019 overnight 0.620 → corrected 0.017; 2025 = 0.104 uncorrected | `api/region/AZPS.json` → `corrections.corrections[0]` (numbers.md D1) |
| r = 0.9948 over 7,976 hours; 98.8% within 5 MW; 7,087 vs 3,937 MW; step on 2019-12-04 | same field; `judges_qa.md` Q11 |
| detector rank 3rd, unaffected | `api/region/AZPS.json` → `detection.rank` = 3 |

**Confidence tiers.** The double count is **proven**. That the plant is **Palo Verde** is a
*high-confidence inference*, not confirmed against EIA-860 — say "Arizona's only nuclear
station, and the magnitude matches the nameplate". The corrected siting rank (~32) is
*approximate, ±2*. **Why** the series steps on that date is *not established*. Say "a double
count we caught", never "Phoenix collapsed" (T2).

### B3 — Claims vs physics (Google)

**For judges' Q3:** "So 'true on paper' means they lied?" Spoken live at 0:44–1:21 on
`#/check/GOOGL`. Note the app rounds to 6%; this slide's 5.6% is the same number unrounded.

> "we again matched 100% of our electricity consumption with renewable energy purchases (on a global and annual basis)" — Alphabet, 2026 Environmental Report, page 4
> **100%** claimed, market-based, annual · **65%** hourly carbon-free, 2025 — their own page 94 · **5.6%** generated clean by the grid at their Moncks Corner site, 2025
> True on paper. 5.6% physically. That is the footprint, not the meter: grid-only, contracted power excluded — and it understates the site, because Santee Cooper's nuclear reports under a neighbouring balancing authority (SCEG, 42%).

| Number / quote | Source |
|---|---|
| verbatim, page 4, market-based, annual; magnitude 1.0; verdict `true_on_paper` | `api/company/GOOGL.json` → `claims[0]` |
| 65% hourly CFE, 2025 (page 94) | same → `claims[0].evidence[1].values` = [65,64,64,66,65], 2021–2025 |
| 5.6% on the SC grid, 2025 | same → `sites[0].cf_share_2025` = 0.056 = `dash/regions.json` SC `cf_share[2025].all`; gap **94.4 pts** |
| SCEG 42% (V.C. Summer) | `api/region/SCEG.json` → `cf_share.2025.all` = 0.421 |
| notes: grid-only, excludes PPAs, hand-curated mapping | `api/companies.json` → `notes` |

`sites[0].note` says "Never present 0.056 without this caveat." Never "Google's data centre
runs on 6% clean power" — it is the grid's generation inside the footprint, not the meter.
Across the four companies: **10 claims, 9 true on paper, 1 cannot_verify** (Amazon,
`kind: no_finding`, `talk_score: null` — do not render null as 0, T14).

---

## Numbers deliberately on no slide at all

- **Dominion's overnight growth.** +3,973 MW is **45.7% of PJM's overnight *generation*
  growth** but **60.6% of its overnight *demand* growth** (numbers.md D7). If it comes up,
  say which. The script carries the same instruction.
- **Alert counts.** `api/alerts.json` reports `count_before_ranking` = 14, a known bug; the
  real ratio is 162 raw → 14 ranked (D3). Not speakable while pointing at a field that says 14.
- **Talk-vs-walk scores.** `talk_score` is a language score; Amazon's is `null`, not 0.
- **"Half a datacenter's power is used at night."** Not measured (numbers.md §3). Slide 2
  uses the permitted phrasing.
- **EC2 reproducibility runtime.** Not run; `docs/ec2_runtime.csv` does not exist.

Q&A: `docs/judges_qa.md` (25 questions), `docs/pitch/script.md` §"Six questions judges will
ask" (the six most likely, under 25 s each), `docs/pitch/numbers.md` §4 (17 traps).
