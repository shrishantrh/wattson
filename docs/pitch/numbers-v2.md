# Pitch numbers v2: the new batch, traced

Verified 2026-09-20 against the files the product actually serves, read-only. No pipeline
script was re-run, no git command was run. Companion to `docs/pitch/numbers.md` (52 figures,
2026-09-19), which stands and is not redone here.

Sources, in order of authority:

- `api/` = `web/public/api/` — what the live site serves. **Authority for anything on screen.**
- `dash/` = `dashboard/public/data/` — the pipeline export.
- `claims/companies.json` — Yash's deliverable, the upstream of `api/facilities.json`.
- Prose (`docs/*.md`, `README.md`, `CLAUDE.md`) is **not** authority.

**12 claims checked (10 new + 2 reused). 7 MATCH. 4 DIFFER. 1 is real but must be attributed,
not presented as a Wattson measurement.**

---

## 1. DIFFERS — fix before you record

| # | Claim as scripted | Verified value | Source / computation |
|---|---|---|---|
| **X1** | "Twelve operators have sites mapped and no documents read." | **48.** Of 52 operators, **4** have claims checked and **48** are sites-only, every one with `claims_absent_reason: "no_documents_ingested"`. | `api/companies.json` `count_sites_only` = 48; `count_with_claims` = 4; recounted over `companies[].coverage_status` → `{sites_only: 48, sites_and_claims: 4}` | 
| **X2** | "Nebius has no site tied to a named serving utility." | **False — both Nebius sites name one.** Vineland NJ → **Vineland Municipal Electric Utility** (PJM/AE); Independence MO → **Independence Power and Light** (SWPP). What *is* true: neither has a listed-equity owner (`utility_ticker: null` on both), because both are municipal utilities. | `api/facilities.json` facilities[] where `operator_key == "NBIS"`; also `api/company/NBIS.json` |
| **X3** | OpenAI's six sites are "Abilene, Milam County, Lordstown, Pike County, Port Washington and Santa Teresa". | **Abilene is not one of OpenAI's six.** The six are **Shackelford County TX, Santa Teresa / Doña Ana County NM, Milam County TX, Lordstown (Trumbull County) OH, Port Washington (Ozaukee County) WI, Pike County OH.** Abilene TX is filed under operator **ORCL**, company label "Crusoe / Stargate (Oracle, OpenAI)". Swap **Abilene → Shackelford County**, or say "Abilene, which we file under Oracle". | `api/company/OPENAI.json` `sites[].metro` (6 rows); `api/facilities.json` Abilene row has `operator_key: "ORCL"` |
| **X4** | "11 mapped sites are behind the meter and therefore invisible to the federal demand data." | **No such field exists and 11 is not reproducible.** There is no `behind_the_meter` flag anywhere in `api/`, `claims/`, or `web/src`. Counting free-text site notes: **10** contain the phrase "behind the meter"; **15** describe on-site or non-interconnected generation of any kind. Neither is 11. Say **"about a dozen of the 134, from the site notes"**, or pick 10 and say "ten site notes say the load sits behind the meter". | `api/facilities.json` facilities[].note, regex over 134 rows. The 10: Oracle Shackelford, Oracle Santa Teresa, Crusoe Laramie County, Crusoe Childress County, Poolside Pecos County, Hut 8 Vega, Keel/Stronghold Nesquehoning, Keel/Stronghold Venango County, Vulcan/Greenidge Torrey NY, Soluna Briscoe County. The extra 5 in the broad count: xAI Memphis, Crusoe/Stargate Abilene, xAI Southaven, Nebius Independence, Fermi America Amarillo. |

### Bonus defect found while checking (not in your list, but it is on screen)

`api/alpha.json` → `limits[1]` still reads **"Of the 12 sites whose serving utility we could
establish, 5 are served by public power"**. The real figures, in the same file two keys
down (`no_listed_equity`), are **107 resolved, 42 no-listed-equity, 27 unresolved, 134
total**. This is a stale pre-merge string on the Alpha page. Do not point a camera at that
paragraph, and do not read "12 / 5" aloud. (This may also be where the script's "twelve"
in X1 came from — it is a **site** count from a stale string, not an operator count.)

---

## 2. MATCHES — safe to speak exactly as stated

### 2.1 The central new claim — national daytime vs overnight clean megawatts

| Figure as stated | Verified | Source |
|---|---|---|
| Daytime clean **178.1 → 239.5 GW** | 178,129 → 239,533 MW | `api/regions.json` `meta.national.cf_avg_mw.2019.daytime` / `.2025.daytime` |
| Daytime added **61.4 GW** | 239,533 − 178,129 = **61,404 MW** | subtraction |
| Overnight clean **159.0 → 173.4 GW** | 159,031 → 173,380 MW | same, `.overnight` |
| Overnight added **14.3 GW** | 173,380 − 159,031 = **14,349 MW** | subtraction |
| Ratio **4.3 times** | 61,404 / 14,349 = **4.279** | division; rounds to 4.3 ✓ |

**Direction is correct as the script has it.** `cf_avg_mw` is an **absolute megawatt average**
per hour-class, not a share. The share series lives in a different field (`cf_share`: day
0.372 → 0.465, night 0.405 → 0.397) and is what falls at night. The script's distinction —
"we added four times as much clean power to the daytime hour as to the overnight hour, in
megawatts" — is exactly what this field supports. Baseline 2019, latest complete year 2025.
Both are *generation*, national sum, not demand and not consumption.

One wording note: say **"to the average daytime hour"** or "to the average hour between 10am
and 4pm", not "to the daytime". These are averages over the 10:00–15:59 and 00:00–05:59
local windows, not totals.

### 2.2 El Paso Electric

| Figure as stated | Verified | Source |
|---|---|---|
| 34.1% carbon-free in the daytime | **0.341** | `api/region/EPE.json` `cf_share.2025.daytime` |
| 0.1% overnight | **0.001** | same, `.overnight` |
| 1 MW clean out of 655 MW total | **1.0 MW** clean, **655.0 MW** total | `cf_avg_mw.2025.overnight` = 1.0; `total_avg_mw.2025.overnight` = 655.0 |

Confirmed in the fuel detail: EPE's 2025 overnight is **654 MW gas + 1 MW solar**, nothing
else. `overnight_fuel_mw.2025`. All four numbers MATCH.

### 2.3 Grant County

| Figure as stated | Verified | Source |
|---|---|---|
| Overnight carbon-free share exactly 1.0 | **1.000** | `api/region/GCPD.json` `cf_share.2025.overnight` |

Confirmed in the fuel detail: overnight 2025 is **991 MW hydro and zero of everything else**
(`overnight_fuel_mw.2025` — every other fuel is `null`). Day, night and all-hours are all
1.0. Columbia River hydro, Public Utility District No. 2 of Grant County, Washington.

### 2.4 OpenAI

| Figure as stated | Verified | Source |
|---|---|---|
| 6 sites | **6** | `api/company/OPENAI.json` `sites` length; `api/companies.json` `n_sites` |
| Walk score 0.369 | **0.369** | same file, `walk_score` |
| Coverage 1.0 | **1.000** | same file, `coverage` |
| "37% carbon-free across them" | mean of (0.461, 0.158, 0.461, 0.393, 0.349, 0.393) = **0.36917** → 37% | `sites[].cf_share_2025`; matches `walk_score` to 3 dp |
| Site names on screen? | **Yes.** Each site carries a human `metro` string, and the UI renders it (`web/src/components/modules/RelocateModule.jsx` uses `site.metro`; `web/src/lib/findings.js` prints `best.metro`). You can show place names, not just BA codes. | — |

**But see X3: Abilene is not in this six.** Also worth knowing for the shot: of the six,
Shackelford, Santa Teresa and Milam have **no serving utility recorded** (`serving_utility:
null`), so the grid assignment there is BA-level. The other three name Ohio Edison, We
Energies and AEP Ohio.

Method string, if a judge asks: *"mean physical carbon-free share across mapped sites,
calendar 2025, all hours, grid-only, unweighted by site size"* (`walk_score_method`).
Unweighted — we do not know each site's load. Grid-only — excludes PPAs and RECs.

### 2.5 Scale of the watchlist

| Figure as stated | Verified | Source |
|---|---|---|
| 52 operators | **52** | `api/companies.json` `count` = 52; 52 distinct `operator_key` in `api/facilities.json`; 52 files in `api/company/` |
| 134 sites | **134** | `api/facilities.json` `count` = 134, and the array is 134 long |
| 4 with claims checked | **4** (META, MSFT, GOOGL, AMZN) | `count_with_claims` = 4 |
| 48 sites-only | **48** | `count_sites_only` = 48 |

All four MATCH. Three companion figures from the same file that are worth having in your
pocket: **107** sites have an established serving utility, **27** do not (a coverage gap, not
a finding), and **42 of the 107** are served by public power, cooperatives or state
authorities with **no listed equity**.

### 2.6 Vantage at Quincy

| Figure as stated | Verified | Source |
|---|---|---|
| Vantage has a site in Quincy, Washington | **Yes** — Vantage Data Centers, Quincy WA | `api/facilities.json`, `operator_key: "VANTAGE"` |
| Served by a grid that is 100% carbon-free at 3am | serving utility **Grant County PUD**, BA **GCPD**, `cf_share_2025` **1.0**; overnight (00:00–05:59) share **1.000** | facility row + `api/region/GCPD.json` |

MATCHES. Vantage has 4 mapped sites total: Quincy WA (GCPD, 1.000), Phoenix/Goodyear AZ
(AZPS, 0.285), Santa Clara CA (CISO, 0.546) and Columbus/New Albany OH (PJM/AEP, 0.393) —
a good spread if you want to show one operator across four very different grids.

### 2.7 The two figures reused from the earlier work — both still agree

| Figure | Verified | Source |
|---|---|---|
| PJM overnight generation up **8.7 GW** | 91,240 − 82,539 = **8,701 MW** | `api/region/PJM.json` `total_avg_mw` overnight, 2019 vs 2025 |
| Gas supplied **10.74 GW** of it | **+10.74 GW** | same file, `fuel_delta_overnight_gw.gas` |
| Overnight net export **3,814 → 2,489 MW** | **3,814.0 → 2,489.0** | same file, `interchange.2019.overnight_net_export_mw` / `.2025` |

Unchanged by the merge. The clean-flat companion still holds too: overnight clean
35,700 → 35,619 MW, **−81 MW**. Do not use the 2026 interchange value (1,56x MW, partial year).

---

## 3. Real, but not a Wattson measurement — attribute it on screen

**Project Jupiter, 700–900 MW gas microgrid, not connected to El Paso Electric.**

It **is** in the exported data — but as a hand-written research note attached to a site, not
as anything we measured:

- `api/company/OPENAI.json` → `sites[1]` (Santa Teresa / Doña Ana County, NM) → `note`
- Same string in `api/facilities.json` and in `claims/companies.json`
- `source_type: "press"`, `source_url:` an El Paso Matters article dated 2025-09-25
- The note's own words: *"the source states the campus will run on a 700-900 MW gas
  microgrid that explicitly does NOT connect to El Paso Electric's grid, so this load will
  not appear in EPE demand"*, prefixed `confidence=medium`

**Say it as:** "El Paso Matters reports a 700-to-900 megawatt gas microgrid that does not
connect to El Paso Electric. If that's right, none of this load will ever show up in the
federal data we use." Put the El Paso Matters attribution on screen.

**Never say:** "we found a 700-megawatt gas plant", "our data shows", or any phrasing where
the number sounds metered. We did not measure it; we read it and wrote it down. The
megawatt figure, the fuel and the non-interconnection are all the reporter's, and the whole
point of the beat is that this is the load we *cannot* see.

---

## 4. Traps in this batch — the wrong sentence and the right one

| # | Wrong on camera | Right on camera | Why |
|---|---|---|---|
| **N1** | "Since 2019 the grid got 4 times cleaner by day than by night." | "Since 2019 we added **61 gigawatts of clean power to the average daytime hour and only 14 to the average overnight hour** — four times as much, in megawatts. The night **share** actually slipped, 40.5% to 39.7%, because night generation grew 45 GW at the same time." | The house trap, in its purest form. 61.4 vs 14.3 is a **level** comparison; "cleaner" is a **share** word, and the night share moved the *other way*. If you say either number, say both in the same breath. |
| **N2** | "Clean power at night barely grew." | "Clean power at night grew 14.3 gigawatts — real, and about a Dominion-and-a-half. It just lost the race to 45 gigawatts of new night generation." | 14.3 GW is not "barely". Understating it invites a judge to correct you, and the honest version is the stronger story: clean grew and still lost. |
| **N3** | "El Paso Electric is basically zero percent clean at night." | "The generation **inside El Paso Electric's footprint** was 1 megawatt clean out of 655 at night in 2025. EPE also **imports** — it generated 655 MW against 853 MW of overnight demand — so this describes its own plants, not everything its customers drew." | EPE is a net importer overnight (`demand.2025.overnight_avg_mw` 853 vs `total_avg_mw` 655). Footprint-generation, not consumption. Interchange is not allocated. |
| **N4** | "El Paso's grid collapsed to zero clean." | "El Paso's overnight footprint was **0.0% in 2019 and 0.1% in 2025**. It never had overnight clean generation to lose." | `cf_share.2019.overnight` = 0.0. There is no decline here — it is a flat line at the floor, which is a different and simpler story. Do not let it sound like the AZPS correction. |
| **N5** | "Grant County runs on 100% clean power." | "The Grant County PUD footprint **generated** 991 megawatts overnight in 2025, all of it Columbia River hydro — a 1.000 share. It generates more than it uses at night (735 MW of demand), so it exports; the share is still a footprint figure, not a meter reading at the Vantage building." | Exporter artifact. 1.000 is genuinely clean, but "runs on" is a consumption word and this is a generation number. The honest version survives the follow-up question. |
| **N6** | "Vantage's Quincy datacenter is 100% carbon-free." | "Vantage's Quincy site sits on Grant County PUD, which generated 100% carbon-free at 3am. That's the grid, not their meter — and it's the same trap as Microsoft's Quincy site: naive geography would have put it on BPAT at 91% and made it look *worse* than it is." | Same grid, same trap as T13 in `numbers.md`. Running the mapping trap in the favourable direction is a credibility gain, so take it. |
| **N7** | "OpenAI is 37% carbon-free." | "The six OpenAI sites we could map sit on grids that generated **37% carbon-free across 2025, all hours, unweighted** — we don't know each site's load. And one of the six, Santa Teresa, may not touch the grid at all." | `walk_score_method` says unweighted and grid-only. Also: coverage 1.0 means *of the sites we mapped*, not of OpenAI's estate. |
| **N8** | "We track 52 companies and check their claims." | "We hold 52 operators and 134 sites. We've read documents for **four** of them. The other 48 are mapped to grids with nothing of their own held against them — that's our coverage gap, not a finding about them." | See X1. The product already says this in `claims_absent_note`; saying it out loud is the honest-by-construction beat. Understating 48 as 12 is the only way to get this wrong. |
| **N9** | "11 sites are invisible to us." | "A dozen or so of the 134 site notes describe load behind the meter or on an on-site plant — xAI's Memphis turbines, Soluna's Briscoe wind farm, Stronghold's two waste-coal plants. EIA-930 never sees those, so for those rows we understate fossil use." | See X4: no flag, no reproducible 11. "Ten site notes say so" is defensible; "11 sites" is not, because someone will ask which field. |
| **N10** | "Project Jupiter is a 700-megawatt gas plant we found." | "El Paso Matters reports a 700-to-900 megawatt gas microgrid there that doesn't connect to El Paso Electric." | §3. Press, `confidence=medium`, not measured. |
| **N11** | "OpenAI's Abilene site." | "The Abilene Stargate site — we file it under Oracle, because Oracle holds the lease." | X3. If you say "OpenAI, Abilene" and then click through to OpenAI, Abilene will not be on the screen. |
| **N12** | "42 of our sites are on grids with no stock to trade." | "42 of the **107 sites whose serving utility we could establish** are on public power, co-ops or state authorities with no listed equity. A further 27 sites have no utility recorded at all, and we count those separately so they can't inflate the number." | The denominator is 107, not 134. `api/facilities.json` `notes[2]` and `notes[3]` already phrase it correctly — read theirs. |

---

## 5. Lead with these — ranked, from this batch only

1. **"Since 2019 America added 61 gigawatts of clean power to the average daytime hour — and
   14 to the average overnight hour. Four times as much sunlight-shaped power as
   around-the-clock power, while the load being built is flat around the clock."** Two
   fields and one subtraction, absolute megawatts, no modelling, no share sleight of hand.
   This is the strongest thing in the batch and it earns the whole premise. `api/regions.json`
   `meta.national.cf_avg_mw`.
2. **"El Paso Electric at 3am: one megawatt of clean generation out of 655."** A number a
   human can hold. 34.1% by day, 0.1% at night — the day/night gap in one balancing
   authority, and it lands right next to the national figure above. `api/region/EPE.json`.
3. **"Grant County at 3am: 991 megawatts, all of it Columbia River hydro. 100.0%."** The
   counterexample, and it proves the index isn't just finding gas everywhere. Pairs with
   Vantage and Microsoft both sitting on it, and with the naive-geography trap running in
   the *favourable* direction. `api/region/GCPD.json`.
4. **"52 operators, 134 sites — and documents for four of them. We say which."** Scale plus
   an out-loud coverage gap. The 48 sites-only rows each carry their own printed reason.
   `api/companies.json`.
5. **"OpenAI's six mapped sites average 37% carbon-free — and one of them may never touch
   the grid at all."** Good, but third-tier: the 37% needs three caveats (unweighted,
   grid-only, mapped-sites-only) and the Jupiter line needs an attribution card. Strong on
   screen, expensive in narration seconds.
6. **The behind-the-meter limit, stated as a limit.** "Some of this load we cannot see —
   xAI's Memphis turbines, Soluna's Briscoe wind farm. On-site generation isn't in EIA-930,
   so for those sites we understate fossil use. We found it while mapping and we print it."
   Do not count it precisely (X4). Its value is candour, not arithmetic.

Everything in §2.7 (PJM 8.7 GW / 10.74 GW gas / 3,814 → 2,489) is unchanged and still the
headline of the whole film; this batch supports it, it does not replace it.
