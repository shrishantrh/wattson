# Wattson — pitch deck (plain text)

Companion to `docs/pitch/deck.html`. Same content, slide by slide, with the timing budget,
the purpose of the slide, the repo source for every number on it, and what was cut off the
slide into the presenter notes.

**The deck follows `docs/pitch/script.md`, which is the performance spine.** The script is
machine-timed from its word count at 130 wpm and lands its last word at 2:59. Its shape is:
**setup 0:00–0:42**, **app 0:42–2:34** (three beats), **close 2:34–2:59**. The deck is a
frame around that: **7 running slides — 42 s of front, a holding slide for the 112 s in the
app, 25 s of close** — plus **3 backup slides** for the question period.

## The one rule this file enforces

**No slide carries more than 15 words of body text, headline included.** A slide is one idea,
stated once. The previous version ran 35 / 46 / 77 / 89 / 35 / 93 / 53 / 82 / 102 / 89 words
per slide; a room reads about ten to fifteen words off a screen while someone is talking over
it, so six of those slides communicated nothing and competed with the speaker. Everything
longer than a label now lives in `data-notes` behind the **N** key, where the audience never
sees it and the presenter always can.

Most slides are now a **picture of a number**, drawn in inline SVG — no libraries, no
external requests, no images. `deck.html` is self-contained and opens offline by double-click.

Rebuilt 2026-09-20 against `docs/pitch/numbers.md` (52 figures checked) and
`docs/pitch/script.md`. No figure was invented or changed; every number below already appears
in one of those two files. Where the fact-check and the older prose (`README.md`, `CLAUDE.md`,
`docs/numbers_checklist.md`) disagree, `web/public/api/` wins.

Paths: `api/` = `web/public/api/` (what the site actually serves); `dash/` =
`dashboard/public/data/regions.json` (the pipeline export).

**Design.** Palette is lifted from `web/src/styles/tokens.css` so the deck and the product read
as one thing: `--clean` #4fd4d0 is carbon-free generation, `--fossil` #ff7a4a is fossil
generation, `--warn` #e8b43f is data that is flagged or corrected. None of the three is ever
used decoratively — on B1 the two detector misses are `--warn`, not `--fossil`, because
`--fossil` means a fuel.

**Controls** (unchanged): `→` / `space` forward, `←` back, `N` presenter notes with per-slide
timing, **`B` jumps to the backup slides and back**, `F` full screen, click right/left to
advance/go back. The counter reads "3 / 7" in the running order and "backup 2 / 3" past the
close. Each backup slide is badged **BACKUP — NOT IN THE RUNNING ORDER** on screen.

**Stage vocabulary.** The script bans "balancing authority" on stage (say "grids"), bans
"carbon-free share of generation", "caused by", "lied", "greenwashing", "headroom",
"70 grid regions" and "0.15 for Phoenix". Three counts are in play and any one named must say
which: **70** balancing authorities in the hourly index, **124** published regions, **111**
scored by the detector.

---

## Slide 1 — Title · 5 s (0:00–0:05) · **11 words**

**Purpose:** name the project while the presenter's hands are off the laptop. Covers the
script's 0:00 and 0:03.

> HACKMIT 2026
> **Wattson**
> It follows the power, not the press release.

| Number / fact | Source |
|---|---|
| tagline | `README.md` L3; script 2:55 |

**Cut into the notes:** the whole provenance line — hourly carbon-free share of generation for
70 US balancing authorities, EIA-930 via PUDL, snapshot ends 2026-09-05
(`api/regions.json` → `meta.data_snapshot_end`; `README.md` L8–13; `docs/spec.md` L59) — and
the Voloridge track name. None of it is spoken at 0:00, so none of it belongs on screen.

---

## Slide 2 — Decarbonization happened in daylight · 13 s (0:05–0:18) · **12 words**

**Purpose:** carries the script's 0:08 ("37 percent to 47. At night: 40 to 40") and 0:18
("Solar fixed the day. It did nothing for the night."). The script notes this is the **only**
pair of numbers quoted with no app behind it, so the slide has to hold them.

**Now a drawing, not a sentence.** Two lines from 2019 to 2025 — the daytime series rising, the
overnight series flat — each drawn as a join between its two measured endpoints, with a dot at
each end. The two end values sit at display size (104 px) to the right of the plot: **47% Day**
and **40% Night**. Start values are 30 px in the margin.

> **Decarbonization happened in daylight.**
> plot: 37% → **47%** Day · 40% → **40%** Night · axis 2019, 2025

| Number | Source |
|---|---|
| 37% → 47% daytime | `api/regions.json` → `meta.national.cf_share["2019"/"2025"].daytime` = 0.372 / 0.465 |
| 40% → 40% overnight | same field `.overnight` = 0.405 / 0.397; day **+9.3 pts**, night **−0.8 pts** |
| the two windows, local time | `api/regions.json` → `meta.overnight_hours_local`, `meta.daytime_hours_local` |

The slide shows the rounded figures the presenter speaks; the exact ones are in the notes.

**Cut into the notes:** 37.2 / 46.5 / 40.5 / 39.7 to one decimal with their local-time windows;
+9.3 pts vs −0.8 pts; the sentence "a datacenter draws the same power at 3am in January as at
noon in June" (framing, not a measurement — permitted phrasing, numbers.md §3, spoken at 0:03);
**trap T8** (this is a *share* — clean megawatts at night rose 14 GW nationally, 159,031 →
173,380, against 45 GW of new overnight *generation*, T7); **trap T11** (2025 is the last
complete year; never mix in partial 2026).

---

## Slide 3 — The finding, as an increment · 12 s (0:18–0:30) · **14 words**

**Purpose:** sits under the script's 0:23 line, "'one hundred percent clean' is an annual
average — we wanted the hourly one". It **previews** the finding the presenter narrates in the
app at 2:04; he does not read the digits here.

**Now one very large bar against one invisible one.** The bars are to scale: 81 is 0.93% of
8,701, so the clean bar is a 3.35-unit sliver under the baseline against a 360-unit column
above it. That ratio *is* the argument. `+8,701` is set in `--fossil` at 136 px, `−81` in
`--clean` at 86 px.

> PJM OVERNIGHT, 2019–2025
> **None of it was clean.**
> **+8,701** generation · **−81** clean · avg MW

| Number | Source |
|---|---|
| +8,701 avg MW overnight generation | `api/region/PJM.json` → `total_avg_mw` overnight 82,539 → 91,240 |
| −81 avg MW clean (35,700 → 35,619) | `api/region/PJM.json` → `cf_avg_mw[y].overnight`; −81 MW = 0.23% of the 2019 level |

**Cut into the notes:** 35,700 → 35,619 in full; **−0.9%** of the increment was clean
(−81 / 8,701, numbers.md §2.1); **gas +10.7 GW**, coal −2.5, nuclear −0.9
(`fuel_delta_overnight_gw`; deltas sum +8.69 against +8.70); **overnight net exports 3.8 →
2.5 GW** (`interchange["2019"/"2025"].overnight_net_export_mw` = 3814 / 2489, EIA-adjusted
operations table, positive = export); "consistent with datacenter load being served by gas",
never "caused by"; part of the gas rise is coal-to-gas switching (`numbers_checklist.md`
DISC 3); average mix, not marginal; say "the mid-Atlantic grid", not "PJM", out loud.

---

## Slide 4 — What it is · 12 s (0:30–0:42) · **13 words**

**Purpose:** the script's 0:29 line — what Wattson reads. Last slide before the app.

**Now three numerals at display size** (118 px) with a three-word label under each, and nothing
else. The two questions are spoken, not printed.

> **Every hour, every grid.**
> **4.45M** hourly rows · **70** balancing authorities · **111** regions scored

| Number | Source |
|---|---|
| 4.45M hourly rows (4,451,763) | `data/processed/hourly_cf_index.parquet` row count (numbers.md §2.4) |
| 70 balancing authorities | same file, `ba.nunique()` = 70 |
| 111 regions scored | `api/regions.json` → `meta.n_scored` |

**Caveat that travels with the first two figures:** they are reproducible but live only in a
**gitignored local parquet**. If a judge asks for the field: "it's the row count of the hourly
index; the published JSON carries the 124 regions built from it, not the raw rows."

**Cut into the notes:** the exact row count and the date range 2018-07-01 → 2026-09-05; the
composition 68 zones + 43 balancing authorities and "from demand alone, no company list";
**52** balancing authorities ranked for siting (`api/region/PJM.json` → `siting.n_ranked`);
**10** claims from **4** companies (`api/companies.json` `count` = 4, `is_mock: false`); the
sentence about flat load raising the overnight floor faster than the mean; and trap T16 — the
three counts (70 / 124 / 111) must never be blurred.

---

## Slide 5 — HOLDING SLIDE, live demo · 112 s (0:42–2:34) · **3 words**

**Purpose:** stays on screen behind the presenter while he is in the app for all three beats.
**No numbers on this slide by design** — and now no bullets either, because the three beats
were a list the audience had to read while watching a demo.

> ● LIVE
> **Wattson, running.**

The three beats, in order, now live only in the notes:

| Beat | Clock | Route | What is spoken |
|---|---|---|---|
| 1 | 0:42–1:23 | `#/check/GOOGL` → `?evidence=1` | 100% claimed, true on paper, 6% on the Santee Cooper grid; then page 4 against page 94's ~65% hourly, five years |
| 2 | 1:23–1:59 | `#/compare?mw=300&metros=Phoenix\|Northern Virginia\|Omaha` | Omaha 52% and improving; **Phoenix 2nd on 10%, the double-count line is mandatory**; N. Virginia 39% and getting worse; 144 MW off fossil in Omaha, average mix |
| 3 | 1:59–2:34 | `#/found` | clean at night flat since 2019, +8.7 GW of which 10.7 gas, "consistent with, not caused by"; 111 regions, weights frozen, N. Virginia 6th, Dallas 91st |

**Cut into the notes:** those three lines in full, with the routes and the clicks; "static
site, precomputed JSON, no backend to fail" (`docs/spec.md` L228; `api/index.json`, 137 real
endpoint responses) — say it only if something stalls; and the fallback rule, cut **beat 2
whole**, never just the Phoenix line.

---

## Slide 6 — What we do not claim · 10 s (2:34–2:44) · **10 words**

**Purpose:** the script's first close line. One sentence, 64 px, alone on the slide. The five
limits were a five-item list nobody could read in ten seconds while the presenter recited four
of them from memory; they are the thing he *says*, so they are now notes.

> **The limits are on the screen, not in a footnote.**

| Fact | Source |
|---|---|
| the five limits | `api/regions.json` → `meta.caveats`; `CLAUDE.md` Honesty rules; `docs/spec.md` L298–309 |
| 9 true on paper, 1 cannot_verify | `api/companies.json` `cannot_verify_total` = 1 |
| every figure traced | `docs/numbers_checklist.md`, `docs/pitch/numbers.md`; `node web/test/smoke.mjs` |

Spoken line: *"Generation inside a footprint, not consumption. Average mix, not marginal.
Contracts excluded. Claims we can't check are counted on screen."*

**Cut into the notes:** all five limits verbatim, including "9 of 10 claims true on paper, 1
cannot_verify — Amazon, no falsifiable sentence, `talk_score` is null not zero (T14)" and
"PJM spans Chicago to New Jersey"; and the `docs/numbers_checklist.md` pointer.

---

## Slide 7 — Close · 15 s (2:44–2:59) · **14 words**

**Purpose:** carries the script's last three lines — the credit, the scale figure, the tagline.
The scale figure is now on slide 4 rather than repeated here, which is what freed the room for
the credit to be legible.

> WATTSON
> **It follows the power, not the press release.**
> **Yash** data engine · **Shrishant** product

| Fact | Source |
|---|---|
| credit split | script 2:44; `CLAUDE.md` ownership |
| tagline | script 2:55 |
| "four and a half million hours" (spoken, shown on slide 4) | as slide 4; script 2:50 |

**Cut into the notes:** EIA-930 via PUDL (Voloridge dataset #6), "static site, no backend",
"every figure traces to a file in the repo", and the reminder that "four and a half million
hours" is the one line that may be dropped anywhere if the clock is tight — the slide survives
losing it, because the number is no longer printed here.

---

## Timing summary — running order

| # | Slide | Words | Seconds | Cumulative | Script anchor |
|---|---|---|---|---|---|
| 1 | Title | 11 | 5 | 0:05 | 0:00, 0:03 |
| 2 | Decarbonization happened in daylight | 12 | 13 | 0:18 | 0:08, 0:18 |
| 3 | None of it was clean (PJM preview) | 14 | 12 | 0:30 | 0:23 |
| 4 | Every hour, every grid | 13 | 12 | 0:42 | 0:29 |
| 5 | **Holding slide — live demo** | 3 | 112 | 2:34 | beats 1–3 |
| 6 | The limits are on the screen | 10 | 10 | 2:44 | 2:34 |
| 7 | Close | 14 | 15 | 2:59 | 2:44, 2:50, 2:55 |

Front **42 s** · app **112 s** · close **25 s** · **total 179 s**, last word at 2:59, matching
the script's own machine-timed total exactly. **77 words across the seven running slides**,
against 419 before.

Timing is unchanged from the previous version; only what is on the slides changed.

---

## Backup slides — NOT in the running order

Press **`B`** in `deck.html` to jump to them and `B` again to return. Each is badged
"BACKUP — NOT IN THE RUNNING ORDER" on screen, in `--warn`, so it cannot be mistaken for a live
slide. They exist for the question period; every one of them covers ground the presenter
already spoke while standing in the app.

### B1 — Frozen before any rank · **15 words**

**For judges' Q4:** "How do I know you didn't tune the detector to find Data Center Alley?"
Spoken live at 2:20 on `#/found`.

**Now a rank axis, 1 to 111, with the four pre-registered regions placed where they actually
landed.** The two hits (6th, 7th) are white dots above and below the line; the two misses (19th,
91st) are `--warn` rings struck through with an ×, and the word **misses** sits under them. The
prediction and the outcome are the same picture.

> **Frozen before any rank.**
> **6th** N. Virginia · **7th** Omaha · **19th** AEP (miss) · **91st** Dallas (miss) · axis to 111

| Number / fact | Source |
|---|---|
| the four regions, named in advance | `api/regions.json` → `meta.validation_named_in_advance` |
| rank 6 N. Virginia | `api/region/PJM%2FDOM.json` → `detection.rank` |
| rank 7 · rank 19 · rank 91 | `SWPP%2FOPPD`, `PJM%2FAEP`, `ERCO%2FNCEN` → `detection.rank` |
| 111 scored, ranks 1..111 contiguous | `api/regions.json` → `meta.n_scored` |

**Cut into the notes:** the method string in full — score = z(overnight excess) +
z(neighbour divergence) + 0.5 z(load-factor delta), robust z (median/MAD), 500 MW cut, p99.5
peak, frozen before results (`api/regions.json` → `meta.detector_method`); scores and growth
(7.71 / 31.8%, 6.82 / 39.4%, 2.29 / 9.2%, −1.32 / 14.2%); that the 500 MW cut holds (13
unranked, largest excluded IID 434 MW, smallest ranked TPWR 518 MW); why Dallas is 91st
(growth 14.2% against a median ERCOT zone near 26%, neighbour divergence −12.2); and T9 — say
"the AEP zone" or "Columbus and out across five states", never "Central Ohio".

### B2 — Two operators, one nuclear plant · **14 words**

**For judges' Q5:** "Your own data shows Phoenix falling from 62% to 10%. Did it collapse?"
Spoken live at 1:35 on `#/compare`.

**Now the two lines, because "wrong in direction, not just magnitude" is a shape.** The
published series falls from 62% in `--warn` (dotted — flagged data); the corrected series rises
from 1.7% in `--clean`; they meet at the shared, uncorrected 2025 value, **10.4%**, set at 96 px.

> PHOENIX OVERNIGHT
> **Two operators, one nuclear plant.**
> published **62%** ↘ · corrected **1.7%** ↗ · both → **10.4%** · axis 2019, 2025

| Number | Source |
|---|---|
| published 2019 overnight 0.620 → corrected 0.017 | `api/region/AZPS.json` → `corrections.corrections[0]` (numbers.md D1) |
| 2025 = 0.104, uncorrected — the level is real | same file → `cf_share.2025.overnight` |

**Cut into the notes:** r = **0.9948** over **7,976** hours; **98.8%** of hours identical within
5 MW; **7,087 MW** combined against a **3,937 MW** nameplate; the step on **2019-12-04**, not a
decline; published and corrected shown side by side, the export not rewritten; the demand-side
detector rank (**3rd**) has no generation term and is untouched; the confidence tiers — the
double count is **proven**, Palo Verde is a **high-confidence inference** ("Arizona's only
nuclear station, and the magnitude matches the nameplate"), the corrected siting rank (~32) is
**approximate ±2**, and *why* it steps on that date is **not established**; say "a double count
we caught", never "Phoenix collapsed" (T2); never say 0.15 (D5).

### B3 — True on paper · **13 words**

**For judges' Q3:** "So 'true on paper' means they lied?" Spoken live at 0:44–1:21 on
`#/check/GOOGL`. The app rounds to 6%; this slide's 5.6% is the same number unrounded.

**Now the claimed figure against the measured one, to scale.** Three bars on a 100% axis: the
claim is a dashed outline (paper), the two measurements are filled (`--clean-dim` for Google's
own hourly figure, `--clean` for the grid). 5.6% renders as a 50-unit stub against the 900-unit
claim.

> ALPHABET
> **True on paper.**
> **100%** claimed · **65%** their own report · **5.6%** the grid

| Number | Source |
|---|---|
| 100% claimed, market-based, annual, page 4; verdict `true_on_paper` | `api/company/GOOGL.json` → `claims[0]` |
| 65% hourly CFE, 2025 (their page 94) | same → `claims[0].evidence[1].values` = [65,64,64,66,65], 2021–2025 |
| 5.6% on the SC grid, 2025 | same → `sites[0].cf_share_2025` = 0.056 = `dash/regions.json` SC `cf_share[2025].all`; gap **94.4 pts** |

**Cut into the notes:** the verbatim quote ("we again matched 100% of our electricity
consumption with renewable energy purchases (on a global and annual basis)" — Alphabet, 2026
Environmental Report, page 4); the five-year series 65/64/64/66/65; the mandatory caveat from
`sites[0].note` — never present 0.056 without it: footprint not meter, grid-only, contracted
power excluded, and it *understates* the site because Santee Cooper's share of V.C. Summer
nuclear reports under a neighbouring authority, **SCEG at 42%** (`api/region/SCEG.json`
`cf_share.2025.all` = 0.421); T4 — never "Google's data centre runs on 6% clean power"; and the
four-company totals, 10 claims, 9 true on paper, 1 cannot_verify (Amazon, `talk_score: null`,
not 0 — T14).

---

## Numbers deliberately on no slide at all

- **Dominion's overnight growth.** +3,973 MW is **45.7% of PJM's overnight *generation*
  growth** but **60.6% of its overnight *demand* growth** (numbers.md D7). If it comes up,
  say which. The script carries the same instruction.
- **Alert counts.** `api/alerts.json` reports `count_before_ranking` = 14, a known bug; the
  real ratio is 162 raw → 14 ranked (D3). Not speakable while pointing at a field that says 14.
- **Talk-vs-walk scores.** `talk_score` is a language score; Amazon's is `null`, not 0.
- **"Half a datacenter's power is used at night."** Not measured (numbers.md §3).
- **EC2 reproducibility runtime.** Not run; `docs/ec2_runtime.csv` does not exist.

Q&A: `docs/judges_qa.md` (25 questions), `docs/pitch/script.md` §"Six questions judges will
ask" (the six most likely, under 25 s each), `docs/pitch/numbers.md` §4 (17 traps).
