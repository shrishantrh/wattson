# Wattson · judges' Q&A

Twenty-five questions we expect, two sentences each, every number traced in brackets to a
file in this repo. Paths are relative to the repo root; `api/` means `web/public/api/`.
Verified against the served files on 2026-09-19.

House rules for every answer: "consistent with", never "caused by"; "true on paper, X
physically", never "lied"; generation within a footprint, not consumption; average mix, not
marginal; contracted power excluded; the detector was frozen before results.

---

## Method

**1. You report an average clean share. Why not marginal emissions?**
We report the average carbon-free share of what a grid physically generated in each hour,
because EIA-930 carries generation by fuel and interchange, not dispatch order or prices,
so a marginal figure would be a model, not a measurement [`api/regions.json` meta.caveats;
README "Honesty rules"]. So "39% at night" means 39% of PJM's overnight generation was
nuclear, hydro, wind, solar or geothermal, not that a new datacenter's next megawatt-hour is
39% clean [`api/region/PJM.json` cf_share.2025.overnight = 0.39].

**2. Generation or consumption?**
Generation within a balancing-authority footprint; imports are not allocated, so an
importing grid's share describes what it generated, not what its customers consumed
[`api/regions.json` meta.caveats[0]]. Where that bites we say so on screen: PacifiCorp West
generated 797 MW against 2,311 MW of demand in 2025 and the Meta site row reads "generates
34% of what it uses, the rest is imported" [`api/region/PACW.json` total_avg_mw, demand],
and Google's Santee Cooper grid (0.056) sits next to SCEG (0.421), which holds the nuclear
Santee Cooper co-owns [`api/company/GOOGL.json` notes].

**3. Why 00:00 to 05:59 local for "night"?**
Those six hours have no solar anywhere in the country, so they isolate the part of the day
that solar-led decarbonization has not reached, and they sit inside the same local window
in every zone (Arizona has no DST, one BA without a time zone was dropped)
[`api/regions.json` meta.overnight_hours_local; README L23, L163-164]. Daytime is 10:00 to
15:59 for the mirror reason, and the two series diverge exactly as expected: day 0.372 to
0.465, night 0.405 to 0.397, 2019 to 2025 [`api/regions.json` meta.national.cf_share].

**4. Why freeze the detector before looking at results?**
The weights (1, 1, 0.5 on robust z-scores), the 500 MW cut and the p99.5 peak were fixed,
and four validation regions were named, before any ranking was seen, so the ranks could not
be tuned toward the story [`api/regions.json` meta.detector_method,
meta.validation_named_in_advance; README L67-70]. The cost is visible on screen: Northern
Virginia came 6th and Omaha 7th, but Central Ohio 19th and Dallas 91st, reported as they
came out [`api/regions.json` PJM/DOM, SWPP/OPPD, PJM/AEP, ERCO/NCEN detection.rank].

**5. What does "zones inherit the grid's generation" mean, and is Dominion the whole PJM story?**
EIA-930 subregions report demand only, so a zone like Dominion carries PJM's clean share
with `cf_inherited_from_ba: true` and a chip that says "generation figures are the whole
PJM grid"; its demand, growth and detector score are its own [`api/region/PJM%2FDOM.json`].
Dominion's overnight demand rose 3,973 MW (10,060 to 14,033), which is 46% of PJM's
8,701 MW overnight generation growth, so we say "about half", never "all"
[`api/region/PJM%2FDOM.json` demand; `api/region/PJM.json` total_avg_mw; numbers_checklist
DISC 11].

**6. Why is 2019 the baseline?**
Real EIA-930 generation in PUDL starts 2018-07-01 (98M of the 118M generation rows before
that are empty padding), so 2019 is the first full calendar year, and it is pre-COVID
[README L149-150]. The snapshot ends 2026-09-05, so 2026 is compared on Jan–Aug
same-months or trailing-12 series with partial months dropped [`api/regions.json`
meta.data_snapshot_end; README L161-162].

**7. Why the 500 MW cut?**
Regions under 500 MW of average demand were excluded because robust z-scores on tiny
footprints amplify reporting noise into top ranks, leaving 111: 68 zones and 43 balancing
authorities [README L54-58; `api/regions.json` meta.n_scored = 111]. The cut was set with
the weights and the p99.5 peak before the ranking was looked at, and the region page says
"Not scored: regions under 500 MW of average demand are left out" when it applies
[`web/src/components/modules/DetectorModule.jsx`].

**8. You missed Dallas. Why show that?**
ERCOT North Central grew 14.2% but the median ERCOT zone grew about 26%, so its neighbor
divergence is −12.2 points and its score −1.32, rank 91 of 111: the detector penalises a
zone inside a grid that is booming everywhere [`api/region/ERCO%2FNCEN.json` detection;
README L91-93]. That is a property of the method, and Dallas was named in advance
precisely so the miss could not be quietly dropped; the screen reads "Dallas 91st" next to
"Northern Virginia 6th" [`web/public/fixtures/opening.json` detector].

## Data traps

**9. What was broken in the data and how did you handle it?**
Five traps, all handled in code: EIA split hydro, solar and wind into finer buckets on
2024-07-01 (parent and child buckets are never both populated in one hour, so summing never
double-counts); 98M of 118M generation rows are empty padding before 2018-07-01; raw
Dominion demand has two October 2021 hours over a billion MWh (we use
`out_eia930__hourly_subregion_demand` and the imputed column); the partner-level
interchange table is unusable for PJM before 2020; and PJM/PL has one corrupt 2019 demand
hour (11.6 GW against a 7.6 GW p99.5) that would have faked a +0.18 load-factor jump, which
is why the peak is the 99.5th percentile [README L145-164]. Two more we caught late are the
next two questions: Arizona Public Service and PacifiCorp West.

**10. How do you trust the PJM export figures if the interchange table is unreliable?**
The partner-level table flips the sign of the PJM–MISO tie between 2019 and 2020 and its
partner sum correlates only 0.45 with EIA's adjusted net, so the headline overnight exports,
3,814 MW in 2019 and 2,489 MW in 2025, come from the operations table, which closes
generation − interchange = demand to a 7 MW median residual [README L153-157;
`api/region/PJM.json` interchange]. The partner table is used only for the 2020+ breakdown
and never on the demo screens, a frozen decision [CLAUDE.md "PJM overnight net export"].

**11. Phoenix: your own data says it fell from 62% to 10% clean. Did it?**
No: the published 2019 figure counts a nuclear plant that SRP reported at the same hours;
the two series correlate 0.9948 over 7,976 hours, match within 5 MW in 98.8% of them, and
sum to 7,087 MW against a 3,937 MW nameplate, ending in a step on 2019-12-04
[`api/region/AZPS.json` corrections]. Corrected, Phoenix rose from 1.7% to 10.4% clean at
night, its siting rank moves from 49 to about 32 (±2), and its detector rank (3rd) is
untouched because the detector has no generation term; the screen shows published and
corrected side by side rather than rewriting the export [`api/region/AZPS.json`
corrections, unaffected; `api/site/300mw-phoenix-nova-omaha.json` corrections_applied].

**12. Meta's Prineville site reads 75% clean. Is that real?**
PacifiCorp West did clean up (0.297 in 2019 to 0.75 in 2025, all hours), but it generated
only 797 MW against 2,311 MW of demand in 2025, so 75% describes a third of what Prineville
actually draws and the site row says "generates 34% of what it uses, the rest is imported"
[`api/company/META.json` notes[5]; `api/region/PACW.json`]. It also carries a one-year
step (0.51 in 2022 to 0.93 in 2023), so the time-machine map leaves it out with Imperial
Valley [`web/src/data/trajectory.json` summary.excluded_step_changes].

**13. What is the hollow pin in the Rockies?**
WAPA Rocky Mountain's demand rose about 1.5 GW during 2022 while its generation stayed near
4 GW and net exports fell from 1.5 GW to zero with no change in partners; the engine
re-checked it with the Phoenix method and found a six-month ramp, not a step, so it is
flagged as unexplained rather than corrected [`api/regions.json` meta.data_flags;
`api/region/WACM.json` corrections.summary]. It stays 5th in the frozen ranking, is drawn
hollow, and is not among the 14 alerts [`api/alerts.json`].

## Companies

**14. Google says 100% renewable and you say 6%. Which is it?**
Both: "100%" is a market-based, annual claim (over a year Google bought renewable
certificates and contracts equal to its consumption, true under the GHG Protocol), and 6%
is what the grid under its one mapped site physically generated in 2025 [`api/company/GOOGL.json`
claims[0] scope market_based; notes[3]]. Annual matching and hourly clean power are
different measurements, which is why the verdict is "true on paper, X physically"
[GLOSSARY "The distinction the whole project rests on"].

**15. So "true on paper" is a polite way of saying they lied?**
No: no claim in the data is "contradicted" and nothing on screen is an accusation; nine of
the ten extracted claims are `true_on_paper` and one is `cannot_verify`
[`api/companies.json`; `api/company/*.json` verdicts]. The gap between talk and walk
measures what annual matching does and does not buy at 3am on a specific grid, and the
Companies page says so: "not a verdict on honesty: annual matching is true under the
market-based method" [`web/src/pages/Companies.jsx`].

**16. What does "cannot verify" mean and why is it counted?**
`cannot_verify` is explicit with a reason code and is counted on every card, because a
verifier that hides what it could not check is not a verifier: Amazon's one claim is
`no_falsifiable_content`, its headline "100% matched" sits in a p. 5 infographic that
extracts as fragments, with nothing in the same sentence to test [`api/company/AMZN.json`
cannot_verify_reason, note]. The other codes the UI renders are no_site_mapping,
ba_out_of_coverage and year_out_of_range [`web/src/pages/Check.jsx` REASON].

**17. Why does Google read 6%, and what is that number not?**
Google's one mapped site, Moncks Corner SC, is served by Berkeley Electric Cooperative from
Santee Cooper, whose balancing authority generated 5.6% carbon-free in 2025 (0.7% at
night), while the V.C. Summer nuclear it co-owns reports under the neighboring SCEG
authority at 42.1% [`api/company/GOOGL.json` sites[0]; `api/region/SC.json`;
`api/region/SCEG.json`]. So 6% is that grid's own generation, not Google's consumption,
not its fleet (one site of many), and not its hourly CFE, which Google itself reports as 65%
on p. 94 [`api/company/GOOGL.json` claims[0].evidence].

**18. Why exclude PPAs and RECs? They are real clean power.**
They are contracts, not electrons on the wire at a given hour in a given footprint, and
EIA-930 does not carry them, so the walk score is grid-only by design and every card says
"Grid-only. Excludes power purchase agreements and renewable energy certificates."
[`api/company/GOOGL.json` notes[0]; `web/src/pages/Check.jsx` talk-vs-walk note]. Counting
them would reproduce the company's own market-based number, which is the thing being
checked; a diff view with contracted power is on the later list, blocked on PPA data
[`docs/ui_plan.md` item 38].

**19. How did you map sites to grids?**
By hand, from the serving utility outward and never from the state, with a source URL and a
`source_type` of `company_disclosure` or `press` for each of the seven sites across four
companies; four of them are on public power or co-ops with no listed equity
[`api/facilities.json`]. Two mappings are traps that flip a naive answer: Prineville is
PacifiCorp West, not BPA (a 60-point error in 2019, 16 in 2025), and Quincy is Grant County
PUD at 100% Columbia hydro, not BPA [`api/company/META.json` sites[0].note;
`api/company/MSFT.json` sites[0].note].

**20. What exactly does Google's page 94 show?**
Google's 2026 Environmental Report, p. 94, discloses "CFE across Google data centers
(hourly)" of 65, 64, 64, 66 and 65 percent for 2021 through 2025, flat, while p. 4 says
"we again matched 100% of our electricity consumption with renewable energy purchases (on a
global and annual basis)" and, on the same page, reports a 37% annual increase in
electricity demand [`claims/raw/GOOGL_esg.jsonl` pages 4 and 94;
`api/company/GOOGL.json` claims[0].evidence]. Every quote was re-read by a human off the
rendered page, and the side-by-side module shows the two with their page numbers
[`api/company/GOOGL.json` verification.pages_checked = [4, 94]].

## Product

**21. What does the load-shape simulator compute, and what are its limits?**
Each place's 2025 clean-share-by-hour profile is weighted by a load shape (24/7 flat;
business hours, 8am to 6pm at full and a quarter otherwise; overnight-heavy, 10pm to 6am;
daytime-following, a bell at 1pm), and "flexible 20%" greedily moves a fifth of the energy
from the dirtiest hours the load uses into the cleanest, capped at doubling any hour
[`web/src/lib/shape.js`]. In Northern Virginia a flat 300 MW runs on 39.3%, business hours
40.2%, flexible 40.3%, and in Omaha overnight-heavy reaches 47.8%; the limits are average
mix, generation within the footprint, one year's profile, no prices, no transmission, and
hour weights that are illustrative rather than measured [`api/region/PJM.json`,
`api/region/SWPP.json` profile_24h.2025].

**22. Why does Phoenix rank 2nd when it runs on 10%, and how is the siting score built?**
The siting score is the mean percentile across three equal-weight components, overnight
clean share 2025, its change since 2019, and overnight clean MW over overnight demand,
frozen before results; the per-year slope is shown but not scored and there is no "years
remaining" [README L111-116; `api/site/300mw-phoenix-nova-omaha.json` method]. Phoenix's
corrected change since 2019 is +8.7 points from a 2% base, which lifts its score to 0.449
and rank 32 of 52 above Northern Virginia's 0.436 and 34, and the sentence says so out
loud: "ranks 2nd on the score because its corrected history is rising from a very low base,
but it runs on 10% clean at night today" [`api/site/300mw-phoenix-nova-omaha.json`
candidates; `web/src/lib/findings.js` compareAnswer].

**23. What does the r on the Explore page mean, and what does it not?**
It is a Pearson correlation over independent points only: flagged or corrected regions are
left out, and when both axes are generation-side, zones collapse to one point per grid
because they inherit it, so "Where solar hides the night" is 41 grids with r = 0.89 while
the demand-side fingerprint is 109 regions with r = 0.17, and no r is quoted under 40 points
[`web/src/lib/metrics.js` GENERATION_SIDE, pearson; `web/src/pages/Explore.jsx`]. It
describes a cross-section, not a cause, and with n = 41 one grid moves it; the page's own
footnote says "Correlation across regions is not causation; the detector reads demand only".

## Sponsor-specific

**24. Voloridge: what is new here, technically?**
An hourly carbon-free index for 70 balancing authorities from 4.45M EIA-930 rows, split by
local-time night and day, which surfaces a fact no annual series shows: all of the grid's
decarbonization since 2019 happened in daylight, and in PJM overnight clean generation is
flat within 100 MW while overnight generation rose 8.7 GW and exports fell [CLAUDE.md L1;
`api/region/PJM.json`; `api/regions.json` meta.national]. On top of it, a demand-only
detector with pre-registered validation found Data Center Alley 6th of 111 with no company
list and named five places nobody lists as datacenter clusters, and the dataset traps we
documented (the SRP double-count, the PJM–MISO sign flip, Dominion's billion-MWh hours) are
findings about PUDL's EIA-930 tables in their own right [`web/public/fixtures/opening.json`
detector.new_leads; `api/region/AZPS.json` corrections; README L145-164].

**25. Arrowstreet: what is the textual analysis, concretely?**
Ten claims from four companies' own sustainability reports and 10-Ks (Google 118 pages,
Meta 75, Microsoft 67, Amazon 52 read), each verbatim with a page number, re-read by a
human off the rendered page, scored for falsifiability (0.85 for "matched 100%", 0.6 for
the "24/7 moonshot" language), tagged with scope (market-based, annual) and greenwash
patterns (hidden trade-off), and paired, where the same document discloses a contradicting
figure, with that page too: Google p. 4 vs p. 94; Microsoft p. 6 "matched 100%" beside
Scope 2 rising to 13% of emissions from nearly 2% [`web/src/data/ingest_status.json`;
`api/company/GOOGL.json`, `MSFT.json` claims]. `cannot_verify` is explicit with a reason
code and counted on screen, and the 10-K quotes are checked against the raw SEC HTML and
re-runnable with `python3 -m engine.contradict.verify_tenk` [`api/company/AMZN.json`;
`api/company/GOOGL.json` claims[4].verification.tenk_quote].
