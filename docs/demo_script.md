# Wattson demo script

*It follows the power, not the press release.*

Two cuts: 90 seconds (four screens) and three minutes (seven screens). Every sentence in
quotation marks below is the sentence the screen generates from the data, recomputed on
2026-09-19 by running the real generators (`web/src/lib/findings.js`, `shape.js`,
`metrics.js`) under node against the files the site serves (`web/public/api/**` and
`web/public/fixtures/opening.json`). If the pipeline re-runs before the demo, re-run
`node web/test/smoke.mjs` and re-read the sentences off the screen; do not trust this file
over the screen.

Where a screen says "N. Virginia", say "Northern Virginia". Where it says "PJM", say
"the mid-Atlantic grid". Never say "carbon-free share of generation" on stage: say "clean
power", "at night", "Northern Virginia's grid".

---

## Preflight (five minutes before)

1. Start the site (see "If the demo machine is offline" below) and open `http://localhost:8099/#/`
   in a fresh window at 1440 x 900. Let the globe finish loading once.
2. Open the four 90-second routes in background tabs so nothing loads cold:
   `#/check/GOOGL`, `#/compare?mw=300&metros=Phoenix|Northern%20Virginia|Omaha`,
   `#/found?s=sweep`, `#/found`.
3. Press `?` once to confirm the shortcuts sheet opens, then `Esc`.
4. Do **not** turn on demo mode (`d`) for the 90-second cut: its scripted scene 2 is
   `#/check/META`, not Google (`web/src/demo/scenes.js`). Demo mode is documented at the end.
5. If WebGL fails on the venue machine, the globe has a `2D` toggle; the cards are the demo,
   the globe is the backdrop.

---

## The 90-second cut

### 0:00 to 0:10 · Land on the globe · `#/`

**Click / type:** nothing yet. The page is the globe over the Pacific, the wordmark, one
box, two rows of chips.

**What appears:** the globe turning slowly · "What's really powering it?" · "Check a
company's clean-energy claim against its grid, or compare places to build on the cleanest
power." · box placeholder "Check a company or compare locations" · chips *Meta · Google ·
Microsoft · Amazon* and *300 MW: Phoenix vs Northern Virginia vs Omaha* · a three-line
"How it works" (1 Type a company or a place, or click an example. 2 Get one sentence and
three numbers from hourly grid data. 3 Open the evidence: the company's own pages, the
grid, the caveats.) · link "What we found in the grid data →" · footer "Grid-only. Excludes
contracted power. Average mix, not marginal. Hourly EIA-930 data via PUDL, through
2026-09-05."

**Say:** "Wattson reads what every US grid physically generated, every hour, and answers
two questions: what is really powering a company's sites, and where would new load run on
the cleanest power."

**If a judge leans in:** "It is grid-only and average mix: the power on the wire in that
footprint, not contracts, not marginal emissions. The footer says so on every screen."

### 0:10 to 0:40 · Check Google: their own p. 4 vs p. 94 · `#/check/GOOGL`

**Click:** the chip **Google**.

**What appears:** card "Alphabet (Google) · GOOGL", one sentence, three numbers, a note,
a button "Show the evidence". Globe pin "Moncks Corner (Berkeley County) · 6% clean".

> "Alphabet (Google) says 100% renewable. True on paper. The grid under its one mapped
> site generated 6% clean power."

Numbers: **100%** claimed · market based | **6%** actually clean at the site · grid
average, all hours | **1** site checked.

Note under the numbers (read it, do not paraphrase it away): "One mapped site, so this is
that grid, not the company: Santee Cooper's jointly-owned V.C. Summer nuclear reports under
the SCEG balancing authority (0.421 in 2025), not under SC (0.056). The SC footprint
understates the carbon-free content of power available to sites in this territory.
Grid-only, average mix; contracted clean power is not counted."

**Say:** "Google says 100% renewable. That is true on paper: it is an annual, market-based
claim. The one Google site we could map sits on Santee Cooper's grid, which generated 6%
clean power last year."

**Click:** **Show the evidence** (URL becomes `#/check/GOOGL?evidence=1`). The first module
is "Says, and discloses, in the same report".

**What appears:** left, **Says** with a page chip *p. 4*: "Despite this, we again
matched 100% of our electricity consumption with renewable energy purchases (on a global
and annual basis)". Right, **Discloses · CFE across Google data centers (hourly)** with a
page chip *p. 94*: five bars labelled 65% · 64% · 64% · 66% · 65% over 2021 to 2025.
Footer: "Same report, both pages, no other source. google-2026-environmental-report.pdf".
(No page images: `web/public/evidence/index.json` is empty, so it is the quote and the
bars.)

The other evidence modules, in order: *Where its sites draw power* (Moncks Corner
(Berkeley County) · Berkeley Electric Cooperative (power from Santee Cooper) · Santee
Cooper · press · **6%** · 1% at night, with a 2019–2025 night sparkline) · *What it claims,
and the verdict* (five claims, all chipped "true on paper", gap bars "claims 100% / its
grids 6%", "checkable 85% · market based", a "hidden tradeoff" chip on the second, and
under the first: "Contradicted in google-2026-environmental-report.pdf, p. 94: CFE across
Google data centers (hourly) — 2021: 65%, ...") · *Talk vs walk* (**41%** talk · **6%**
walk · **100%** coverage) · *What this number does not mean* (the six notes) · *Move one
site and watch the physics move* (a what-if that opens on the best move: "If Google's
Moncks Corner drew from Grant Co. WA instead, its physical figure would be 100% instead of
6%. The claim would not change; the physics would." Grant County PUD is all Columbia
hydro; the module's footer says it is a what-if on the grid only) · *Why night matters*
(off by default).

**Say:** "And Google's own report agrees with us. Page 4 says matched 100%. Page 94, same
document, says hourly carbon-free energy across its data centers has been flat at about
65% for five years. Annual matching and hourly clean power are different measurements, and
the company publishes both."

**If a judge leans in:** "6% is that grid's own generation, not Google's consumption. The
nuclear plant Santee Cooper co-owns reports next door under SCEG, which reads 42%, so the
physical figure understates what is available to that site. The card says so, and that is
why the verdict is 'true on paper', never 'they lied'."

### 0:40 to 1:05 · Compare Phoenix / Northern Virginia / Omaha · `#/compare?...`

**Click:** the card's close `×` (or press `Esc`), then the chip
**300 MW: Phoenix vs Northern Virginia vs Omaha**. Or type exactly
`300 MW: Phoenix vs Northern Virginia vs Omaha` in the box and press Enter.

**What appears:** card "Compare · 300 MW of flat load", the MW field (300), three place
chips, the shape picker (leave it on *24/7 flat*), one sentence, three numbers, a share
bar, a live line, a method line, a button "Show why". Globe: three pins, Omaha ringed.

> "Omaha is your cleanest option: 52% clean power at night and improving. Phoenix ranks
> 2nd on the score because its corrected history is rising from a very low base, but it
> runs on 10% clean at night today. N. Virginia is 39% and getting worse."

Numbers: **52%** 1. Omaha · improving | **10%** 2. Phoenix · history corrected |
**39%** 3. N. Virginia · getting worse.

Live line: "At 300 MW, Omaha would draw about 144 MW from fossil generation at night on the
2025 mix, versus 269 MW in Phoenix. Average mix, not marginal."

Method line: "Ranked on clean power at night, whether it is improving, and clean power
relative to demand. Equal weight, frozen before any result was seen."

**Say:** "Three hundred megawatts of flat load, three places. Omaha's grid ran 52% clean at
night last year and is improving; Northern Virginia's grid ran 39% and is getting worse.
At night, that 300 MW draws 144 MW from fossil plants in Omaha and 183 in Northern
Virginia." (183 is on the N. Virginia card under "Show why"; the live line compares against
Phoenix, 269.)

**If a judge leans in:** "Phoenix ranks second on the score, not on today's number: its
published 2019 figure counted a nuclear plant that SRP also reported, so we corrected it
from 62% to 2%, and from 2% to 10% is 'improving'. The sentence says exactly that. Omaha
and Northern Virginia are zones: their demand is local, their clean share is the whole
grid's, SPP and PJM."

### 1:05 to 1:30 · Why night matters, then the PJM finding · `#/found?s=sweep` → `#/found`

**Click:** **Show why**, scroll to the module **Why night matters**.

**What appears:** **47%** clean during the day, 2025 · 37.2% in 2019 | **40%** clean at
night, 2025 · 40.5% in 2019 | **½** of a datacenter's power is used at night. Note: "Solar
cleaned up the middle of the day and did nothing for the middle of the night. Flat load
lands half of itself in the hours that have not improved since 2019. See it →"

**Click:** **See it →** (lands on `#/found?s=sweep`, the sun sweeps across the globe for
seven seconds while the two numbers animate 2019 to 2025).

> "Since 2019 the grid cleaned up by day and stood still at night."

Pair: Clean during the day **46.5%** (37.2% → 46.5%) · Clean at night **39.7%**
(40.5% → 39.7%). Sub: "Daytime clean share 37.2% to 46.5% (+9.3 pts). Overnight 40.5% to
39.7% (−0.8 pts). A datacenter draws the same power at 3am as at noon, so half its load
lands in the hours that did not improve."

**Say:** "Nationally, since 2019 the grid cleaned up by day, 37 to 47 percent, and stood
still at night, 40 to 40. A datacenter draws the same power at 3am as at noon."

**Press:** `1` (keyboard 1–4 switch the four findings tabs) to open **The finding**.

> "The mid-Atlantic grid's (PJM) overnight clean generation has not moved since 2019."

Hero: **35,700 → 35,619 MW clean at night**. Sub: "35,700 MW then, 35,619 MW now.
Overnight generation rose 8.7 GW. Gas rose 10.7 GW while coal fell 2.5 GW. Net exports
fell from 3.8 GW to 2.5 GW, so the new generation served PJM's own load." Numbers:
**+8.7 GW** more power at night since 2019 · **+10.7 GW** of it from gas · **3.8 GW → 2.5 GW**
exports to neighbors. Globe marker: "Northern Virginia · +39% at night". Below:
"Named before the ranking was seen: Northern Virginia 6th of 111 · Omaha 7th · Central
Ohio 19th · Dallas 91st."

**Say:** "In the grid that serves Data Center Alley, clean generation at night has not
moved since 2019: 35,700 megawatts then, 35,619 now. Night-time generation rose 8.7
gigawatts, gas rose 10.7 while coal fell, and exports fell, so the new power served PJM's
own load. That is consistent with datacenter load being served by gas. And our detector,
frozen before we looked, found Northern Virginia from demand data alone, 6th of 111, with
Dallas missed at 91st, reported as is."

**If a judge leans in:** "We say 'consistent with', not 'caused by': the detector flags
flat load in general, datacenters, crypto, oilfield electrification. Dominion's roughly
4 GW of overnight demand growth is about half of PJM's overnight generation growth, half,
not all. And 10.7 GW of gas against 8.7 GW of growth is not an arithmetic error: coal fell
2.5 and nuclear 0.9, part of the gas rise is coal-to-gas switching."

---

## The 3-minute cut

Same four screens, with three insertions. Timings assume you keep the 90-second lines.

### After Compare (0:40 to 1:05), add 0:20 · The shape what-if · same Compare card

**Click:** in the shape picker, **business hours**. The sentence, numbers and live line
re-rank from each place's 24-hour profile (the frozen score is untouched: the picker note
says "What-if: ranked on the clean share over the hours a business hours load uses, from
each place's 24-hour profile.").

> "For a business hours load, Omaha is your cleanest option: 44% clean power over the
> hours it would use. N. Virginia is 40%. Phoenix is 36%."

**Click:** **flexible 20%** (with business hours still selected).

> "For a business hours, flexible 20% load, Omaha is your cleanest option: 46% clean power
> over the hours it would use. Phoenix is 44%. N. Virginia is 41%."

**Say:** "A load has a shape. Move the same 300 MW to business hours and Northern
Virginia's grid gets a little cleaner, 40%; let a fifth of it move into the cleanest six
hours and Phoenix jumps from 36 to 44, because Phoenix's clean power is solar and it is
all in the middle of the day."

**If a judge leans in:** "It is the 2025 hourly profile weighted by the load's hours,
average mix, no prices, no transmission. 'Flexible' greedily moves 20% of the energy from
the dirtiest hours the load uses into the cleanest, capped at doubling any hour. Set it
back to 24/7 flat before you leave the screen."

Click **24/7 flat** and un-click **flexible 20%** before moving on, so the frozen sentence
is what the next tab shows.

### After the PJM finding (1:05 to 1:30), add 0:30 · The detector map with the year slider · `#/found?s=detector`

**Press:** `4` (or click the tab **Where load is landing**).

> "111 regions scored from demand alone. 5 flagged regions are not known datacenter
> clusters."

Sub: "Validation named in advance: Northern Virginia 6th, Omaha 7th, Central Ohio 19th,
Dallas 91st. Flat 24/7 load raises the overnight floor faster than the mean, and the
detector reads that fingerprint without a company list."

**Click:** **Play** on the year slider ("clean power at night, by year", 2019 to 2025,
0.9 s per year). Pins recolour: ember under 30% clean at night, grey 30–60%, white over
60%, hollow = data flagged or corrected.

Sentence under the slider (at 2025): "In 2025 the US ran 39.7% clean at night. From 2019
to 2025 the biggest fall among grids was NYISO (65% to 46%), the biggest rise New Mexico
(22% to 60%). Zones are coloured with their grid's share, since zones report demand only.
Imperial Val., W. Oregon show a single-year step in the published data and are left out.
Press play."

Rows, "Named in advance, and the new leads": N. Texas · new #1 +95% · Permian · new #2
+116% · Phoenix · new #3 +31% · Tucson · new #4 +15% · Northern Virginia #6 +32% · Omaha #7
+39% · Santee Cooper · new #9 +28% · Central Ohio · mixed #19 +9% · Dallas #91 +14%.

**Say:** "Every one of the 111 regions, scored from demand alone, no company list. The
five it flags that are not known datacenter clusters are North Texas, the Permian,
Phoenix, Tucson and Santee Cooper. Press play and watch the country's nights: New York
dims after Indian Point closed, New Mexico brightens."

**If a judge leans in:** "The hollow pins are flagged or corrected: WAPA Rockies has an
unexplained 1.5 GW demand jump in 2022 and stays in the ranking but out of the alerts;
Phoenix is drawn from the corrected series. Two grids with a one-year step in the
published data are left off the slider."

### After the map, add 0:25 · One region page · `#/region/PJM%2FDOM`

**Click:** the row **Northern Virginia** in the list under the map.

**What appears:** card "N. Virginia · Northern Virginia (Loudoun / Fairfax), Dominion
zone".

> "N. Virginia's overnight demand grew 39% since 2019. The grid serving it (PJM) is
> 4.2 pts less clean at night."

Sub: "Average demand 11,681 MW to 15,395 MW; overnight 10,060 MW to 14,033 MW." Numbers:
**39.0%** clean power at night, 2025 · −4.2 pts since 2019 | **#6** of 111 for new flat
load · flat-load growth | **14,033** MW demand at night, 2025 · 10,060 in 2019. Chips:
"generation figures are the whole PJM grid" · "Compare 300 MW here".

Modules (drag to reorder; "Customize" lists them): *Clean share by hour, 2025* ·
*What your load shape would run on* (39.3% for a 24/7 flat load, 182 MW of 300 MW not
carbon-free; "The cleanest six hours are 10am to 4pm, 41.6% clean on average; the dirtiest
six (7pm to 1am) run 36.6%."; "2019 39.4% → 2025 39.3%") · *What changed at night since
2019* (**+8.4 GW** fossil: gas, coal, oil · **−0.1 GW** carbon-free; gas +10.7, coal −2.5,
oil +0.1, nuclear −0.9, hydro −0.2, wind +1.1, solar 0.0, other +0.4) · *Who serves the
load* (hand-mapped chip; Virginia Electric and Power (Dominion Energy Virginia) · Dominion
Energy · D; Northern Virginia Electric Cooperative (NOVEC) · member-owned) · *How the
detector scored it* ("Night demand grew faster than average demand +7.7 pts"; "Grew faster
than its neighbors +32.9 pts"; "Load got flatter +0.042"; "Detector rank #6 of 111, score
7.71"; "Demand growth since 2019 +31.8%") · *Alerts here* (night demand at a record since
Dec 2024 · 21 months · 14,807 MW vs 10,060 in 2019) · *Clean at night, year by year*
(43.3% → 39.0%).

**Say:** "Northern Virginia's night-time demand grew 39% in six years, 10 to 14
gigawatts. Residential and EV load is peakier, not flatter, so night growing faster than
average is the fingerprint. What changed at night on its grid: 8.4 gigawatts more fossil,
essentially no more clean. Who serves it: Dominion, hand-mapped, ticker unverified."

**If a judge leans in:** "The shape module's 39.3% is the 24-hour average of the profile;
the 39.0% at the top is midnight to 6am only. Both are PJM's generation, because a zone
reports demand only. Thirty-two percent average growth in six years is far beyond
demographics; the discriminator is overnight growing faster than average."

*Swap-in if a judge asks about Phoenix:* `#/region/AZPS`. Sentence: "Phoenix's overnight
demand grew 43% since 2019. Its grid is 8.7 pts cleaner at night. (from the corrected 2019
figure)". Numbers: 10.4% · +8.7 pts since 2019, corrected | #3 of 111 | 4,221 MW · 2,946 in
2019. A red banner states the correction, and the module **Published vs corrected** lists
it: clean share 2019 overnight 62.0% → 1.7% (proven); siting change −0.517 → +0.087;
siting rank 49 → 32 (high-confidence inference, ±2); nuclear delta −3.61 → 0.0 GW. The
evidence line: "correlation 0.9948 over 7,976 hours, identical within 5 MW in 98.8% of
them, combined 7,087 MW against a 3,937 MW plant nameplate. The series ends in a step on a
single date, 2019-12-04, not a decline."

---

## Numbers you will say

Cross-checked against `docs/numbers_checklist.md` (verified 2026-09-19, before the last
round of edits) and recomputed from the served files. "Checklist" says whether the
checklist row still matches the screen; several of its discrepancies have since been
fixed in the UI and are noted.

| Value | Screen | Source path | Checklist |
|---|---|---|---|
| "100% renewable", p. 4, market based, annual | Check GOOGL | `web/public/api/company/GOOGL.json` claims[0] (magnitude 1.0, page 4, scope market_based); verbatim in `claims/raw/GOOGL_esg.jsonl` p. 4 | not covered (checklist predates real Google claims) |
| 6% (0.056), Santee Cooper grid, 2025, all hours | Check GOOGL, sentence and number | `GOOGL.json` sites[0].cf_share_2025; `web/public/api/region/SC.json` cf_share.2025.all = 0.056 | not covered |
| 1% at night (0.007) | Check GOOGL, site row | `region/SC.json` cf_share.2025.overnight = 0.007 | not covered |
| 65 · 64 · 64 · 66 · 65 (2021–2025), p. 94 | Check GOOGL, "Says, and discloses" | `GOOGL.json` claims[0].evidence[1].values; text in `claims/raw/GOOGL_esg.jsonl` p. 94 ("CFE across Google data centers (hourly) % 65 64 64 66 65") | not covered |
| 42% (0.421) SCEG, V.C. Summer | spoken caveat; Check GOOGL note | `GOOGL.json` notes[5]; `region/SCEG.json` cf_share.2025.all = 0.421 | not covered |
| talk 41% (0.405) · walk 6% · coverage 100% | Check GOOGL, Talk vs walk | `GOOGL.json` talk_score, walk_score, coverage; `companies.json` | not covered; note JS `Math.round(40.5)` = 41 |
| 6% → 100% if Moncks Corner drew from Grant Co. WA | Check GOOGL, Move one site | `web/src/lib/relocate.js` bestMoves over `regions.json` (GCPD cf_share_2025.all = 1.0, all Columbia hydro) | not covered |
| 52% (0.519) Omaha, improving (+5.2 pts), siting rank 10 of 52 | Compare | `web/public/api/site/300mw-phoenix-nova-omaha.json` candidates[0].components; `region/SWPP.json` siting; README siting table SPP 0.519 / +0.052 | OK (§3) |
| 10% (0.104) Phoenix, +8.7 pts corrected, siting 32 of 52 (published 49) | Compare | `site.json` candidates[1].components and corrections_applied; `region/AZPS.json` corrections | §3 wording is stale ("data looks unreliable"); screen now says "corrected history is rising from a very low base" |
| 39% (0.39) N. Virginia, −4.2 pts, getting worse, siting 34 of 52 | Compare | `site.json` candidates[2]; `region/PJM.json` siting; README PJM 0.390 / −0.042 | §3 said "holding steady" (DISC 4); `trendWord` now reads change_since_2019, so "getting worse" |
| 144 · 269 · 183 MW from fossil at 300 MW | Compare live line and Show why | 300 × (1 − 0.519 / 0.104 / 0.39) | OK (§3) |
| wind +4.2 GW · gas +0.3 GW · gas +10.7 GW filled the last growth | Show why | `site.json` fuel_that_filled_growth; README L35 | OK |
| #7 +39% · #3 +31% · #6 +32% of 111 | Show why | `site.json` detector; README detector rows 7, 3, 6 | OK |
| 47% day (0.465; 37.2% in 2019) · 40% night (0.397; 40.5% in 2019) | Compare, Why night matters | `web/public/fixtures/opening.json` national = `regions.json` meta.national | OK; DISC 12 fixed (sub now "40.5% in 2019") |
| 37.2% → 46.5% (+9.3 pts) · 40.5% → 39.7% (−0.8 pts) | Found, Day vs night | same; README L28-31 | OK (§4.3) |
| 178,129 → 239,533 MW day · 159,031 → 173,380 MW night | Found, Day vs night KV | `opening.json` national.cf_avg_mw | OK |
| 35,700 → 35,619 MW · +8.7 GW · gas +10.7 · coal −2.5 · 3.8 → 2.5 GW exports | Found, The finding | `opening.json` pjm; `region/PJM.json` cf_avg_mw, total_avg_mw, fuel_delta_overnight_gw, interchange; README L17-20 | OK (§4.1); DISC 3 softened ("Gas rose 10.7 GW while coal fell 2.5 GW") |
| Northern Virginia +39% at night (10,060 → 14,033) | Found globe marker; Region | `opening.json` pjm.dom_overnight_demand_mw; `region/PJM%2FDOM.json` demand | DISC 7 fixed: the marker is now computed, not hard-coded |
| 6th · 7th · 19th · 91st of 111 | Found; Method | `opening.json` detector (validation); `regions.json` ERCO/NCEN rank 91; README L86 | OK |
| 111 scored · 5 not known clusters | Found, Where load is landing | `opening.json` detector.new_leads = NRTH, FWES, AZPS, TEPC, SC | DISC 2 fixed (was 7; now matches README's five) |
| "in 8 places" | Found, At night | top 10 minus WACM (flagged) minus San Diego (solar pattern) | DISC 8 framing still applies: it is 8 of the top 10 |
| 39.7% (2025) · NYISO 65% → 46% · New Mexico 22% → 60% · Imperial Val., W. Oregon left out | Found, year slider | `web/src/data/trajectory.json` summary; labels from `web/src/data/region_coords.json` | not covered |
| 39% · 4.2 pts · 11,681 → 15,395 · 10,060 → 14,033 · 39.0% · #6 · 7.71 · 7.7 · 32.9 · 0.042 · 31.8% | Region PJM/DOM | `region/PJM%2FDOM.json` demand, siting, detection; README L21, L41, row 6 | OK (§5); DISC 1 fixed (title and number both 4.2) |
| +8.4 GW fossil · −0.1 GW carbon-free | Region PJM/DOM, What changed | sums of `fuel_delta_overnight_gw` (10.74 − 2.52 + 0.15; −0.95 − 0.22 + 1.07 + 0.01) | not covered |
| 39.3% flat · 40.2% business · 40.5% daytime · 40.3% flexible; 10am–4pm 41.6% / 7pm–1am 36.6%; 182 of 300 MW | Region PJM/DOM, shape module | `region/PJM.json` profile_24h.2025 through `web/src/lib/shape.js` | not covered |
| Omaha 44% · N. Virginia 40% · Phoenix 36% (business hours); 46 / 44 / 41 with flexible 20% | Compare what-if | `region/SWPP.json`, `PJM.json`, `AZPS.json` profile_24h.2025 through `shape.js` | not covered |
| Phoenix 43% · 8.7 pts cleaner (corrected) · 10.4% · #3 · 4,221 / 2,946 · 62.0% → 1.7% · 49 → 32 · 0.9948 · 7,976 h · 98.8% · 7,087 vs 3,937 MW · 2019-12-04 | Region AZPS | `region/AZPS.json` corrections, demand, detection | DISC 5 superseded: caveat now on the region page and in the compare sentence; CLAUDE.md's "~0.15 in 2025" is stale, the export is 0.104 |
| 14 alerts · 6 primary · 5 new flat load · 3 nights dirtier · Permian first (7,544 MW vs 3,404, since May 2022, 52 months) | Alerts | `web/public/api/alerts.json` | not covered |
| Microsoft 64% · Google 6% walking, 41% talking · 4 companies · 10 claims · 1 can't verify · 7 sites · 4 no listed equity | Companies | `companies.json`; `facilities.json` no_listed_equity_count | not covered |
| Meta 46–75% · gap 40 points · Prineville 75% (72% at night), "generates 34% of what it uses" · Papillion 46% | Check META | `company/META.json`; `region/PACW.json` total_avg_mw 2025 all 797 vs demand 2,311 | §2 is the old mock (32–93%); DISC 6 (PACW 0.25 gen/demand) was 2024; 2025 is 0.34 and the row now says so |
| 41 grids, r = 0.89 (day vs night) · 109 regions, r = 0.17 (fingerprint) | Explore | `regions.json` through `web/src/lib/metrics.js` (flagged/corrected out; one point per grid for generation-side pairs) | not covered |
| through 2026-09-05 | Landing footer | `regions.json` meta.data_snapshot_end | §1: still a hard-coded string in `Landing.jsx` |

Numbers in this script that cannot be traced to grid data (say them as what they are):
the talk scores (engine output; method "magnitude x specificity x scope_breadth" is stated,
the arithmetic is not reproducible from the export); "½ of a datacenter's power is used at
night" (a framing of flat load over non-daytime hours, the window is 6 of 24 hours); the
operator tickers D and PNW (hand-mapped, unverified per CLAUDE.md); Google's own "37% annual
increase in electricity demand" (their p. 4 number, quoted, not checked). Two doc/export
mismatches to avoid on stage: README L89 says Dallas is 84th on the 2026 Jan–Aug basis, the
export says 81 (`region/ERCO%2FNCEN.json` rank_2026_jan_aug); README L40-42 says "17 of 20
zones", the export has 19 PJM zones with 16 under 3% (checklist DISC 10).

---

## Screen quirks to steer around (as of 2026-09-19, 17:37)

- **Phoenix sparklines are the published series.** On Compare's Phoenix module and on the
  AZPS region page's "Clean at night, year by year", the little chart still draws 62% for
  2019; the ring, the KV rows, the banner and "Published vs corrected" are corrected. Point
  at the banner, not the sparkline.
- **No "your load" row** under Show why: the site export carries no demand, so the "% of
  night demand" line in the numbers checklist does not appear.
- **The Found page reads `web/public/fixtures/opening.json`, not `api/`.** Its numbers equal
  `regions.json` today; after any pipeline re-run, regenerate it
  (`web/fixtures.provisional/_generate_provisional.py`, then `npm run build`) or the finding
  goes stale while the rest of the site moves.
- The MW field re-computes the live fossil line as you type (1,000 MW → "481 MW ... versus
  896 MW in Phoenix"); the ranking only re-runs on **Rank** or Enter, and a request other
  than the baked one is ranked client-side from the frozen score (card title gains
  "· ranked here from the frozen score").
- The picker note for the overnight shape reads "a overnight-heavy load"; use business
  hours on stage.
- Demo mode (`d`) scene 2 is Meta. To make the arrow-key walk match this script, change
  `check/META` to `check/GOOGL` in `web/src/demo/scenes.js` (two lines) and rebuild; not
  done here.

---

## If the demo machine is offline

Everything is static: the built site, its JSON, the globe textures
(`dist/textures/earth-day.jpg`, `earth-night.jpg`) and the fonts (bundled `@fontsource`
woff2 files). No external URL is referenced from `web/src`. Hash routing works from any
static server; it does **not** work from `file://` (module scripts and `fetch` of JSON).

```bash
cd /Users/shrishant/Code/hackmit/web/dist && python3 -m http.server 8099
# then open http://localhost:8099/#/
```

`web/dist` is gitignored and was last built 2026-09-19 17:37:27, seconds after the last
source edit (files were still being edited while this script was written). If any file
under `web/src`, `web/public` or `server/static_export` changes after that, rebuild before
the demo (needs `node_modules`, no network after install):

```bash
cd /Users/shrishant/Code/hackmit/web && npm run build     # prebuild copies api + fixtures
node test/smoke.mjs                                        # 0 failures expected
```

Fallback without python: `npm run preview` (Vite, http://localhost:4173). Fallback without
WebGL: the globe's `2D` toggle. Fallback without a working machine: `docs/screenshots/`.

---

## What not to say

- Not "caused by". Say "consistent with datacenter load being served by gas". The detector
  flags flat load in general: datacenters, crypto mining, oilfield electrification (the
  Permian is #2).
- Not "lied", "greenwashing", "false". Say "true on paper, X physically". Every scored
  claim in the data is `true_on_paper`; one is `cannot_verify`.
- Not "carbon-free share of generation" on stage. Say "clean power", "at night",
  "Northern Virginia's grid", "the grid under the site".
- Not "Google runs on 6% clean". Say "the one Google site we mapped sits on a grid that
  generated 6% clean power, and the nuclear it co-owns reports next door at 42%".
- Not "Phoenix collapsed from 62% to 10%". Say "the published 62% counted SRP's nuclear;
  corrected, Phoenix went from 2% to 10%".
- Not "Prineville is 75% clean" without "and that grid generates a third of what it uses".
- Not "consumption", "marginal", "headroom", "years remaining". It is generation within a
  footprint, average mix, and a slope.
- Not "Dominion is all of PJM's growth". Say "about half of PJM's overnight generation
  growth".
- Not "7 new regions" (the README and the screen both say 5), not "0.15" for Phoenix (the
  export says 0.104), not "17 of 20 zones".
- No tickers as an investment view, no backtests, no stock-price claims. "Who serves the
  load" is a hand-mapped table and the tickers are unverified.
- Not "the country got dirtier at night". Say "stood still": −0.8 points is within the
  rounding of the sentence rule (under 1 point reads "stood still").

---

## Appendix · Demo mode, for a hands-off walk

Press `d` (the HUD "demo 1 / 14" appears bottom right), then `→` / `space` / `PageDown`
forward, `←` / `PageUp` back, `Esc` exits. On the Found page `1`–`4` also switch tabs.
The scenes (`web/src/demo/scenes.js`):

| # | Scene | Route | Sentence on screen |
|---|---|---|---|
| 1 | Ask | `#/` | "What's really powering it?" |
| 2 | Check Meta | `#/check/META` | "Meta Platforms says 100% renewable. True on paper. Physically, its sites run on 46–75% clean power." · note "The gap: 40 points ... across 2 sites" (once the evidence is open the note becomes "One of its grids generates 34% of what it uses, the rest is imported, so its footprint share is not what the site consumes.") |
| 3 | The evidence | `#/check/META?evidence=1` | Prineville · W. Oregon 75% · 72% at night · "generates 34% of what it uses, the rest is imported"; Papillion · Omaha 46% · 52% at night |
| 4 | Four companies | `#/companies` | "Microsoft walks the most: 64% clean across its mapped sites. Alphabet (Google) walks the least at 6%, while talking at 41%." |
| 5 | Compare 300 MW | `#/compare?...` | the Omaha / Phoenix / N. Virginia sentence above |
| 6 | Why Omaha | `#/compare?...&evidence=1` | Show why modules |
| 7 | The screener | `#/screen?by=rising` | 111 regions, sortable, CSV |
| 8 | The fingerprint | `#/explore?preset=fingerprint` | "Across 109 regions (flagged and corrected regions left out), demand growth and overnight excess correlate only weakly, r = 0.17: places that grew fast also grew faster at night, but only a little." |
| 9 | What changed this month | `#/alerts` | "6 places are the story this month (8 more supporting or chronic), through Aug 2026. The most common signal is new flat load, detector top 10 (5); Permian ranks first." |
| 10 | What we found | `#/found?s=headline` | the PJM sentence |
| 11 | At night | `#/found?s=night` | "Night-time demand is rising faster than daytime demand in 8 places." |
| 12 | Day vs night | `#/found?s=sweep` | "Since 2019 the grid cleaned up by day and stood still at night." |
| 13 | Where load is landing | `#/found?s=detector` | "111 regions scored from demand alone. 5 flagged regions are not known datacenter clusters." |
| 14 | Method | `#/method` | "We measure what each grid physically generated, hour by hour." |

`#/explore?preset=solar` (not in demo mode) reads: "Across 41 grids (one point per grid,
since zones inherit their grid's generation figures; flagged and corrected grids left out),
clean share by day and clean share at night correlate strongly, r = 0.89: grids that are
clean by day are mostly clean at night too." Farthest below the fit: Las Vegas, Los
Angeles, El Paso, Tampa: solar by day, gone by midnight.
