# Wattson, judges' Q&A, red-teamed

Six hostile experts were pointed at this project and told to find the questions that would
sink it. Every question below is one of theirs; every answer was written against the data
and carries what we concede. **72 questions: 26 rated fatal, 35 serious, 11 awkward.**

`verified: true` means the answer's figures were checked against the repo by the agent that
wrote it. Answers marked **[checked by hand]** were additionally re-verified directly , 
those are the ones that changed what we ship.

> One red-team claim was itself wrong and is corrected inline: see *"there is no
> pre-registration artifact"* under Honesty audit.


---

## Honesty audit

### `FATAL` Siting score is constant across a whole RTO, all 20 PJM zones 0.436, all 9 ERCOT 0.603, all 14 SPP 0.737. What does a metro input buy me?

You're right and the number is worse than you said: only 35 distinct siting scores exist across 111 regions, and 68 rows carry a parent's value. It is BA-level by construction, scripts/l4_supply.py's docstring literally says 'siting score per BA', because EIA-930 publishes generation at BA level and we never model transmission inside a footprint. What the metro does buy is real but smaller: local overnight demand (300 MW is 17.8% of OPPD's 1,682 MW night load versus 2.1% of Dominion's 14,033 MW), the named serving utility, and the detector rank, which IS zone-level and varies inside PJM from 6th to 76th. The card already says 'Generation is for the whole grid; demand is local' (Compare.jsx:130), but that disclosure is a footnote under a metro headline, and it should be the headline: the score should read 'SPP-wide' not 'Omaha'.

**We concede:** The siting recommendation is a BA lookup wearing a metro UI. 68 of 111 rows are duplicates of their parent; only 35 distinct scores exist. Recommending Omaha really is recommending SPP-wide Kansas/Oklahoma wind across a congested interface from OPPD's own coal-heavy system, and we never model that interface.

*Evidence:* `server/static_export/regions.json regions[].siting (35 distinct scores / 111 rows; PJM n=20 all 0.436 rank 34, ERCO n=9 all 0.603 rank 18, SWPP n=14 all 0.737 rank 10); scripts/l4_supply.py docstring L9-17; web/src/pages/Compare.jsx:130`

### `FATAL` The AZPS correction deletes 3,612 MW of overnight nuclear from 2019 and leaves a 3.9 GW hole in the energy balance. How is a physically impossible correction the centerpiece of your rigor story?

The balance failure is real, but run it every year and it acquits neither story. 2021 through 2024 close to within 0 to 4 MW. 2019 published misses by 323 MW. And 2020, the year AFTER the 2019-12-04 step, with no nuclear in the series at all, misses by 1,712 MW: 1,784 MW generated, 3,032 MW served, and a reported 464 MW export. So the AZPS interchange series in 2019-20 is itself broken and cannot arbitrate which generation series is spurious. What is proven is the duplicate: r = 0.9948 over 7,976 hours, identical within 5 MW in 98.8% of them, 7,087 MW combined against a 3,937 MW nameplate. What is not proven is whose books it belongs on, and you are right that 'the published figure is wrong in DIRECTION' overstates what we can support.

**We concede:** Two things I have to give you. First, the corrected 2019 does not balance: 1,824 MW of non-nuclear generation against 2,946 MW of demand and 2,813 MW of reported export. Second, worse, and you'd have found it, total_avg_mw.2019 is NOT in our correction list, so the served AZPS page shows a corrected 1.7% clean share next to a published 5,436 MW total, and 34.7/5,436 divides to 0.6%. Three numbers, one page. Both are fix-before-demo: correct the denominator, and downgrade the 'wrong in direction' sentence to 'we show published and corrected and we cannot yet settle which footprint owns the plant.'

*Evidence:* `server/static_export/region/AZPS.json total_avg_mw / demand / interchange by year (residual gen−dem−exp: 2019 −323, 2020 −1712, 2021 −4, 2022 0, 2023 +1, 2024 0); corrections_applied_paths omits total_avg_mw.2019; claims/derived/corrections.json AZPS paths; docs/numbers_checklist.md:69`

### `FATAL` Your national headline is a 0.8-point fall, your trailing-12 swings 0.395-0.413 and reads 0.401 rising, and your own uncorrected AZPS error is worth 0.5 of those 0.8 points. Is the finding bigger than your error bar?

No, and we should not say 'fell.' I ran it: pull AZPS's 3,373 MW of phantom overnight clean out of both sides of the national 2019 figure (159,031 / 392,186) and the share goes 0.4055 to 0.4003, the decline shrinks from 0.8 points to 0.3. You're also right that /api/regions passes meta.national through verbatim with no overlay, so the landing page still carries a double count we publicly disowned. The one defense I'll offer is that the UI already refuses your framing: findings.js:33 treats any move under 1 point as 'stood still at night', so the headline reads 'the grid cleaned up by day and stood still at night', and the subtitle says 'a smaller slice of a bigger night, not less clean power.' The claim we actually make is the output one, which survives everything: overnight clean rose 14.4 GW while daytime rose 61.4 GW, 4.3x more clean power added to the average daytime hour.

**We concede:** The share-fell framing is dead. One uncorrected BA eats two thirds of it, WACM's unexplained 1.5 GW is still in there, the trailing-12 has already reversed to 0.401 and rising, and data.public_meta() never sees the corrections overlay. Fix before demo: either correct meta.national or stamp it 'uncorrected' on the page.

*Evidence:* `server/static_export/regions.json meta.national.cf_share/cf_avg_mw/total_avg_mw and meta.national.trailing12 (87 months, min 0.395 @2019-06, max 0.413 @2020-11, last 0.401 @2026-08); recomputed (159031−3373)/(392186−3373)=0.4003; server/app.py:61 and server/data.py:49 public_meta(); web/src/lib/findings.js:33`

### `FATAL` Score correlates 0.875 with neighbor divergence and 0.814 with raw growth but only 0.681 with overnight excess. ERCO/FWES gets 95% of its score from growing faster than its neighbours. Where is the 24/7 fingerprint?

Your three correlations reproduce exactly, and so does the mechanism: MAD is 7.27 for neighbor divergence against 2.22 for overnight excess, so the nominally equal weights give the peer term roughly three times the pull. Two things cut against 'it's a growth leaderboard.' The score correlates 0.891 with OVERNIGHT growth, higher than the 0.814 with average growth, and its Spearman against a pure growth ranking is only 0.588. Concretely: TEPC is 18th on growth and 4th on score, lifted by the highest overnight excess of all 111 regions at 14.5 points; NYIS/ZONE is 107th on growth and 17th on score. But FWES is your case and it stands: overnight-excess z of 0.09, dead median, 95% of a 13.86 score from divergence. Fix: print the three z-components next to the score so the reader sees which term carried each row.

**We concede:** Yes, the weights are nominal, not effective, and we never checked the MADs before freezing. FWES at rank 2 is a growth result wearing a fingerprint label, and Permian oilfield electrification is the likely driver. I also concede the peer bases are not commensurable: zones are compared to sibling zones, BAs to their interconnection, and ERCO (alone in the Texas interconnect, so it takes the <3-peers branch at l3_detector.py:126) to the national median of all BAs. Three yardsticks, one rank column, and the Dallas miss is that method working as designed rather than a quirk.

*Evidence:* `server/static_export/regions.json detection[], recomputed Pearson r vs score: nd 0.875, growth 0.814, oe 0.681, overnight_growth 0.891; robust MADs nd 7.265 / oe 2.224 / lf 0.0267; Spearman(score rank, growth rank)=0.588; scripts/l3_detector.py:118-131`

### `FATAL` GOOGL claims 001-005 are the same verbatim sentence on the same page 4; Microsoft's three are all the same p.6 sentence. You have four distinct sentences, not ten. Why is your claim count not deduplicated?

Fully conceded, I checked and it is exactly as you describe. Across the four companies with documents read there are 10 claim records and 5 distinct (verbatim, source_doc, page) tuples, and one of those five, AMZN-2026-001, has a null verbatim, so it is four real sentences. GOOGL 001/002/004/005 are one page-4 sentence; MSFT 001/002/003 are one page-6 sentence. There is no dedup step in the extractor, and Companies.jsx:97 renders that as '5 claims read across 10 sites', which reads as five independent findings. Fix before demo: dedup on (verbatim, source_doc, page), say four sentences, and keep the greenwash pattern as an attribute of the sentence rather than a reason to emit another copy of it.

**We concede:** No dedup step exists, the count on screen is the inflated one, and it inflates exactly the deliverable a textual-analysis sponsor would grade. You are also right about the boilerplate: three of the four distinct sentences are variants of 'we matched 100% of our annual electricity consumption.' The verdicts and the physical grid evidence are per-company and unaffected, but the count is indefensible as shipped.

*Evidence:* `server/static_export/company/{GOOGL,MSFT,META,AMZN}.json claims[], 10 records, 5 distinct (verbatim, source_doc, page), AMZN verbatim null; claims/companies.json same; web/src/pages/Companies.jsx:97`

### `SERIOUS` regions.json says AZPS change_since_2019 = −0.517, rank 49; region/AZPS.json says +0.087, rank 32 of 52; Explore plots the published one and admits it in a comment. Which Phoenix is on screen?

Both, and you can screenshot both. /api/regions builds its rows from _summary() in app.py:44, which reads siting straight out of regions.json, so the list, the scatter and the globe carry the published −0.517 and rank 49. /api/region/AZPS applies the overlay at app.py:100 and returns +0.087 and rank 32. Explore.jsx:69's comment says it outright: 'the values plotted are the published ones.' A hollow ring is not a retraction, and you're right that the rank field is overloaded, detector rank is 1-of-111, siting rank is 1-of-52, so Phoenix reads 3rd, 32nd and 49th across three surfaces with no unit on any of them. The overlay architecture is correct; it is applied on the detail route and not the browse routes. Fix: run the overlay inside _summary() too, and label the two ranks distinctly.

**We concede:** We shipped a split brain, caught one instance of it (app.py's own comment records fixing the AZPS header-versus-load-shape mismatch), and did not sweep for the rest. The surfaces that still show the disowned number are the ones a judge browses first.

*Evidence:* `server/app.py:44 _summary() (no overlay) vs app.py:92-108 (overlay applied); server/static_export/regions.json AZPS siting change_since_2019 −0.517 rank 49 vs server/static_export/region/AZPS.json siting +0.087 rank 32 of 52; web/src/pages/Explore.jsx:69`

### `SERIOUS` Your tour says Northern Virginia's growth was 'filled by gas (+10.7 GW)', but that is PJM's number and it sits identically on all twenty PJM zone cards. Why does the halving rule apply to demand and not to fuel?

Because we wrote the rule for one sentence and never propagated it. 10.74 GW is PJM's overnight gas delta and it is on all 20 PJM zone cards; ERCOT's 6.62 is on all 9 ERCOT zones, so the Dallas-versus-Columbus fuel comparison is RTO versus RTO, exactly as you say. In our defense the caption does open 'Each card is one grid' (tour.js:37) and the PJM scene at tour.js:58 does say Dominion is 'about half of PJM's overnight growth, not all of it', so the discipline exists, it just never reached the fuel line. On your arithmetic point: +10.74 GW of gas against +8.70 GW of total overnight growth is real and reconciles, coal −2.52, nuclear −0.95, hydro −0.22, wind +1.07, other +0.41 sum to 8.69. Fix: say 'PJM-wide gas' in the fuel sentence and put the coal offset on the card, not in the README.

**We concede:** The scripted demo line attributes 100% of an RTO's gas build to one zone, in a project whose language rule exists to stop that. And DISC 3, one fuel appearing to supply 123% of the growth, is still on the card with its offset explained only in the README.

*Evidence:* `web/src/demo/tour.js:37 and :58; server/static_export/region/PJM.json fuel_delta_overnight_gw (gas 10.74, coal −2.52, nuclear −0.95) and total_avg_mw overnight 82,539→91,240 (+8,701); region/ERCO.json gas 6.62`

### `SERIOUS` Google at 6% next to Microsoft at 64%, both 'coverage 100%', when Google has exactly one mapped site, Moncks Corner, the dirtiest grid in your set. What is the denominator?

The premise is off the current data, and that is our fault for a different reason. Google now has 10 mapped sites including The Dalles at 0.913, and its walk score is 0.464, not 0.06, but tour.js:35 still narrates 'Google talks at 41 and walks at 6, on one mapped site.' That narration is stale against the data it describes and must not be recorded. Your structural point survives untouched: walk_score is an unweighted mean of BA lookups, so IREN, Riot, Cipher, Tesla and Galaxy all read exactly 0.461 because that is ERCOT's 2025 share, and the leaderboard ranks grids with company logos on them. Coverage is already worded honestly on the page, 'Share of this operator's sites with grid data behind them', but the denominator is our hand-curated list, not the fleet, and we should say sites-we-mapped, not 100%.

**We concede:** Two real defects. The demo narration is stale by a factor of eight on our headline company, catching that is on us, not on you. And walk_score is unweighted by site load, so co-located operators are indistinguishable and a single hand-picked site can carry a company; with n=1, as several of the 48 sites_only operators have, it is not a mean at all.

*Evidence:* `server/static_export/company/GOOGL.json, 10 sites, walk_score 0.464, coverage 1.0; IREN/RIOT/CIFR/TSLA/GLXY walk_score all 0.461 = ERCO cf_share_2025.all; web/src/demo/tour.js:35 (stale); web/src/pages/Companies.jsx:108 tooltip`

### `SERIOUS` Your Ask layer's grounding check lets ~70% of invented numbers through and only rejects when every figure fails. What is that guard catching?

Almost nothing, and I reproduced your experiment before answering. I built the index exactly as _grounding_index does from the top-ten regions payload: 132 distinct numbers became 629 entries after SCALES, and randomly invented values pass at 66% for shares, 77% for percentages and 65% for megawatt figures. GROUND_TOL is 0.02 and SCALES multiplies by 1, 100, 0.01, 1000 and 0.001, so the ±2% windows tile most of the plausible number line. _coerce_view only bails on len(unverified) == len(figures), and figures is row values plus chart points, headline and summary, the prose a judge reads aloud, are never checked at all. Our own comment at ai.py:445 already says 'a guard against invention, not a proof of provenance'; the honest move is to say that on screen rather than in a comment.

**We concede:** Shipping a ~1% power anti-hallucination check in a project whose pitch is 'we do not make numbers up' is the worst thing to be caught on, and nothing in the guard checks that a grounded number belongs to the entity in the sentence. Fix before demo: drop SCALES to 1.0, tighten the tolerance, reject on any unverified figure rather than all, and surface unverified_value_count in the UI.

*Evidence:* `server/ai.py:447-448 SCALES/GROUND_TOL, :455-477 _grounding_index/_grounded, :564-572 _coerce_view; reproduced independently on the top-10 regions payload: 132 raw numbers → 629 index entries, false-pass 0.659 / 0.768 / 0.645 over 20,000 draws each`

### `SERIOUS` Your hero says 'a greenwashing investigation' but your data says zero contradicted, nine of ten true_on_paper, and most companies with no document read. Is 'we never say they lied' a constraint or a verdict field?

You've found a contradiction inside our own repo: docs/pitch/script.md:204 explicitly bans the word 'greenwashing' on stage, and Landing.jsx:58 puts it in the hero anyway. The data is 9 true_on_paper, 1 cannot_verify, 0 contradicted, and 48 of 52 companies are sites_only with no document read. So the accusation is being delivered by the hero line and by three hidden_tradeoff pattern tags that carry no verdict and no burden of proof, while the verdict field stays clean, which is exactly the routing-around you describe. Fix, and it is a one-line fix we should have taken already: the hero is the measurement gap, not greenwashing. 'What's really powering it' is fine. 'A greenwashing investigation of datacenter operators' is not what our own data says.

**We concede:** The framing layer contradicts the verdict layer and our own style guide. With zero contradictions, calling this an investigation of greenwashing is positioning, not a finding, and a Companies grid where 48 of 52 cards are grid lookups reads at page level as 52 companies investigated, whatever the individual cards say.

*Evidence:* `web/src/pages/Landing.jsx:58 vs docs/pitch/script.md:204; server/static_export/companies.json count 52, count_with_claims 4, count_sites_only 48, cannot_verify_total 1; verdict tally across company/*.json: true_on_paper 9, cannot_verify 1, contradicted 0; greenwash_patterns hidden_tradeoff on GOOGL/MSFT/META`

### `AWKWARD` Your 'where flat 24/7 load is landing' top twenty includes NYIS/ZONE with demand DOWN 7.1% plus four more solar-suppression regions. Does the leaderboard say that?

The leaderboard does not, the label is on the row and in the table but the rank column doesn't encode it, and you're right that a region whose demand shrank 7.1% sitting at rank 17 is the most quotable screenshot against L3. Five of the top 21 carry 'possible midday solar suppression': SDGE 10, PGAE 12, NYIS/ZONE 17, ZONG 20, CISO 21. That is the cost of keeping the pattern labels strictly out of the score, which we'd make again, the alternative is tuning after seeing results. On DISC 2 specifically you're working from a stale note: data.js:44 now filters on pattern === 'flat-load growth' and drops a parent BA whose own zones are already listed, so new_leads returns exactly the README's five, ERCO/NRTH, ERCO/FWES, AZPS, TEPC, SC. The fixture agrees. Fix: colour or group the solar-suppression rows in the ranking itself.

**We concede:** A demand-only detector cannot distinguish 'flat load arrived' from 'rooftop solar ate the daytime denominator', and the ranking presents both as the same kind of hit. The reader has to click the row to find out which one they're looking at.

*Evidence:* `server/static_export/regions.json detection[] ranks 10/12/17/20/21 pattern 'possible midday solar suppression', NYIS/ZONE growth_pct −7.1; web/src/lib/data.js:43-47 newLeads (pattern filter + parent-BA drop); web/public/fixtures/opening.json new_leads = [ERCO/NRTH, ERCO/FWES, AZPS, TEPC, SC]; docs/numbers_checklist.md:178 (DISC 2, now closed)`

### `AWKWARD` What hypothesis could the NASA irradiance page have falsified, and why is a test that cannot fail presented as independent validation?

It could have falsified one thing and did not: if irradiance had moved materially between 2019 and 2025, the rise in daytime clean share would have had a second explanation and we would have had to apportion it. Variation is 1.06 to 2.65 percent with no trend, so the rise is capacity, not sunlight. That is a weak test and the page says so in its own words, 'flat irradiance is the expected and correct result here, not a failed test', and it names the three non-supporting regions rather than dropping them. But you're right that we should call it a mechanism illustration, not a cross-dataset validation, and three of five points are zones whose share describes a footprint hundreds of times the pixel. On Alpha: the no-backtest disclosure is correct and I'd keep it, but limits[1] is stale, it says '12 sites, 5 public power' while the page's own block says 42 of 107. Fix that before anyone reads both.

**We concede:** The page rules out a hypothesis nobody held and is positioned as validation. It should be relabelled. And the Alpha tab carries a stale sentence contradicting a number on the same page, which is precisely the kind of thing that makes a judge ask what else is described as more finished than it is.

*Evidence:* `server/static_export/irradiance.json conclusion (supporting PJM/DOM, ERCO/NRTH; non_supporting AZPS, SWPP/OPPD, CISO), caveats[2] and [4]; server/static_export/alpha.json no_prediction vs limits[1] ('12 sites… 5') vs no_listed_equity (count 42, resolved 107, total_sites 134)`


---

## Statistics & method

### `FATAL` Your PJM headline doesn't close. Generation rose 8.7 GW, demand rose 6.6 GW, yet exports FELL. Which number is wrong?

Your arithmetic is right and your diagnosis is wrong. I pulled the operations table: PJM overnight net_generation_adjusted is 82,539 MW in 2019 and 91,298 in 2025, plus 8,759, so the 8.7 GW is not a cross-table artifact, the by-fuel and operations tables agree to under 60 MW. The non-closure lives inside EIA's own adjusted series: PJM overnight net generation minus interchange minus demand has a median of minus 1,186 MW in 2019 and plus 126 MW in 2025, about one to two percent of PJM demand, and 8 of 108 BA-years blow past 500 MW. Every one of our four numbers is what EIA publishes; they simply do not form a closed balance. Fix before the demo: the README's '7 MW median residual' is a whole-table figure and is flatly wrong for PJM overnight, restate it and put the residual on screen.

**We concede:** We present four numbers as if they were an energy balance and they are not one, and our README claims a closure that does not hold for the region we lead with. The residual swing is 3,466 MW, 53% of the demand growth we narrate.

*Evidence:* `out_eia930__hourly_operations.parquet (fetched via scripts/vendor/pudl_fetch.py), PJM overnight 00-05 America/New_York; server/static_export/region/PJM.json total_avg_mw + demand + interchange; README L153-157`

### `FATAL` You corrected AZPS but meta.national still reads 159,031 MW. Why is the correction applied to one region page and not the aggregate you lead with?

You are right and it is the single worst thing in the project. Strip our own proven phantom, AZPS 2019 overnight clean 3,373 MW published against 34.7 MW corrected, and national 2019 goes to 155,693 over 388,848, so the headline is 0.400 to 0.397, not 0.405 to 0.397. That is 57% of the magnitude gone, and the 4.3x day-versus-night ratio becomes 3.66x. The finding survives in direction and in kind: overnight clean output still rose 17.7 GW while daytime rose 64.7 GW. But our own correction file says 'a caveat that is not machine-readable does not exist' and we then left the aggregate uncorrected. Apply the overlay to meta.national before we demo, or lead with the corrected number.

**We concede:** Fully conceded. The most-quoted number in the project is computed on a baseline we ourselves documented as wrong, and the overlay stops at the region level by design.

*Evidence:* `claims/derived/corrections.json regions.AZPS (cf_avg_mw.2019, confidence 'proven'); server/static_export/regions.json meta.national.cf_avg_mw/total_avg_mw; arithmetic recomputed`

### `FATAL` One gigawatt of flat load moves overnight_excess by 12.5 points in OPPD, 1.38 in Dominion, 0.145 in PJM. What are you actually ranking?

Confirmed, and worse than you said: across the 111 the spread runs from 32.7 points per gigawatt in Tacoma to 0.145 in PJM, a factor of 225, with your OPPD-to-PJM pair at 86. We never control for size and all 111 are standardized against one common MAD. The defence is only that the term is deliberately a share statistic, what reshapes a grid is datacenter load as a fraction of regional demand, not absolute megawatts, and the detector still put the largest known concentration, PJM Dominion, at rank 6 on 1.38 points per gigawatt. The blindness is real: 35 of our 43 BAs report no subregions, so TVA, Southern, Duke and Santee Cooper are each one diluted lump. Fix: publish megawatts-needed-to-move-one-z per region. It is one line of arithmetic and we have not shipped it.

**We concede:** Power is inversely proportional to region size, we do not correct for it, the 500 MW floor caps rather than fixes it, and 35 of 43 BAs get no zone resolution at all.

*Evidence:* `server/static_export/region/*.json demand.2019 (avg_mw, overnight_avg_mw); sensitivity = 100*X*(1/D_night − 1/D_avg); scripts/l3_detector.py MIN_MW=500`

### `FATAL` The freeze language and the four validation regions appear nine minutes AFTER the commit that produced the first ranking. What is the pre-registration artifact?

There isn't one, and I will not pretend otherwise. Two commits, 13:12:39 and 13:21:28 on 19 September, and the diff between them is the docstring plus a descriptive pattern-label function that never touches the score. So git proves one thing and not the other: the scoring function, the weights, the 500 MW cut, the p99.5 peak, the robust z, is byte-identical between the commit that produced the first ranking and everything after it. It does not prove the four regions were named in advance, and nothing in the repo does; the first code commit is 13:10 the same day. We should say 'the method was not changed after the ranking, and that is what git shows,' and cut 'before any ranking was seen' from judges_qa Q4. The Dallas miss we publish at rank 91 is the evidence a tuner would have deleted.

**We concede:** There is no pre-registration artifact. The marketing framing is stronger than the repo can support, and we should weaken it today rather than be caught with git log -S on stage.

*Evidence:* `git log --date=iso -- scripts/l3_detector.py (7dc87a0 13:12:39, c421061 13:21:28); git diff 7dc87a0 c421061 -- scripts/l3_detector.py; git log -S 'ERCO/NCEN' earliest hit c421061`


> **[checked by hand, the red-team is wrong here, and we should say so.]**
>
> `git show 7dc87a0:scripts/l3_detector.py`, the **first** detector commit, the one that
> produced the first ranking, already contains, in code:
>
> ```python
> r[r.region.isin(["PJM/DOM", "PJM/AEP", "SWPP/OPPD", "ERCO/NCEN", ...])]
> print("\n2026 Jan-Aug ranks for validation set:")
> ```
>
> All four validation regions are named in the script that computes the ranking, not added
> afterwards. And `git diff 7dc87a0 c421061 -- scripts/l3_detector.py` is 22 lines, none of
> which touch the score: it adds a docstring and a descriptive pattern label whose own
> comment says *"does not affect the score or rank."*
>
> **So the defensible claim, and the one to make on stage, is:** *"The four validation
> regions are named in the same commit as the code that first computed the ranking, and git
> shows the scoring function was never changed afterwards."* That is stronger than a vague
> "frozen before we saw results" and it survives `git log -S` on stage.
>
> What we still cannot claim is a separate timestamped pre-registration document. Do not
> imply one exists.

### `SERIOUS` 'Equal weights' is a statement about z-scores, not the world. The actual coefficients are set by the in-sample MADs. How is that frozen?

Every number you quoted reproduces. One over MAD is 0.450, 0.138 and 18.74, so per point of overnight growth the score moves plus 0.450, per point of total growth minus 0.312, and the load-factor term loads at 18.7 per unit. Standardize on BAs only and it is plus 0.337 and minus 0.241; zones only, plus 0.435 and minus 0.283. So you are right that 'frozen' covers the formula and not the scale, and the scale is in-sample. What was fixed a priori and is what the claim actually rests on is the sign structure: reward overnight growth above a region's own average, penalize being merely part of a booming neighbourhood. The effective 13-to-5-to-2 at the top of the list is a real property of the achievable ranges and we should print it rather than say 'one, one and a half.'

**We concede:** The physical weights are a function of the 2019-to-2025 sample. 'Frozen' protects the functional form, not the units, and we have been describing the units as if they were a design choice.

*Evidence:* `server/static_export/regions.json detection components across 111 regions; MAD*1.4826 = 2.2239 / 7.2647 / 0.0267; z ranges oe −3.8 to +5.2, nd −3.4 to +13.2, lf −3.7 to +3.9`

### `SERIOUS` Your number two has an overnight_excess z of 0.09 and 95% of its score from neighbor_divergence, which correlates 0.93 with plain growth. Isn't this a growth ranker?

The diagnostics are exact, 0.930 for divergence against growth, Spearman 0.583 of score against growth and 0.789 against overnight growth, and Far West at 95.4% divergence. So I ran the ranking you asked for. Delete divergence entirely, score on z(overnight excess) plus half z(load factor), and Dominion goes 6 to 7, OPPD 7 to 8, Phoenix 3 to 3, North Texas 1 to 2, Tucson 4 to 1, Spearman 0.818. What collapses is exactly what you'd predict: Far West 2 to 40, Santee Cooper 9 to 21, WACM 5 to 17. The flat-load core survives; the growth stories don't. On Far West specifically, its load factor was already 0.839 in 2019 against PJM's 0.651, the Permian was already maximally flat and then doubled. We score change in flatness, not level, so our delta term is structurally silent there. That is a genuine gap and the fix is to show load-factor level beside the delta.

**We concede:** The term that builds our top of list and the term that sinks Dallas to 91st are the same term, and it is a growth measure with a peer offset, not a load-shape measure. We also cannot detect a region that was already flat before the baseline.

*Evidence:* `recomputed from server/static_export/region/*.json detection; ERCO/FWES load_factor 0.839 (2019) → 0.854 (2025) vs PJM 0.656 → 0.651`

### `SERIOUS` 111 scores, no p-value, no permutation null, no multiple-comparison correction, and the 111 aren't independent. What does a robust z of 13 mean?

It means a rank, not a probability, and we should say exactly that. There is no permutation test, no bootstrap, no multiple-comparison correction and no stated false-positive rate anywhere in the repo, I grepped, there is nothing. Your distributional point checks out: divergence has skew 3.12 and excess kurtosis 14.1, with SD over MAD of 2.14 against 1.0 Gaussian, so the tail z-scores are inflated roughly twofold. And the reference pool double-counts the same electricity, 68 zones nested inside 8 parents that are themselves scored, so PJM's load enters the median and MAD twenty times. We present this as a ranked screen with a pre-named miss, not a hypothesis test. A block permutation null over region-years is an afternoon's work and we did not do it.

**We concede:** No null, no FPR, no correction, and a reference distribution that double-counts eight parent BAs against their own 68 zones. Eight validation regions cannot estimate precision.

*Evidence:* `server/static_export/regions.json detection; skew/kurtosis computed over 111; zone-parent map: CISO 3, ISNE 8, NYIS 10, SWPP 13, PJM 19, MISO 6, ERCO 8, PNM 1, all eight parents also scored; grep for permutation/bootstrap/p-value returns nothing`

### `SERIOUS` Your own rank_2026_jan_aug moves a top-ten region to rank 79. Why should I believe any rank on that board?

The churn is ours and it is real, San Diego 10 to 79, score 3.72 to minus 0.77, SRP 13 to 56, CISO 21 to 64, overall Spearman 0.877. But look at which regions move. Every collapse is a region our own label calls solar: San Diego and CISO are 'possible midday solar suppression', SRP is Phoenix solar. Every 'flat-load growth' region in the top twelve holds, North Texas 1 to 2, Far West 2 to 1, Phoenix 3 to 5, Tucson 4 to 4, Dominion 6 to 3, OPPD 7 to 6, ERCOT 8 to 8, Santee Cooper 9 to 7, and AEP 19 to 12. Median rank move in the top twenty is two places. So the window change removes the artifacts we already flagged and leaves the datacenter candidates in place, which is the label doing its job unprompted. We still have no confidence interval on any score and cannot tell you how much movement is noise.

**We concede:** No confidence intervals, no noise floor, and a top-ten region that falls to the bottom third on eight more months of data. The window choice demonstrably drives the CISO ranks.

*Evidence:* `server/static_export/region/*.json detection.rank_2026_jan_aug and score_2026_jan_aug; pattern labels from scripts/l3_detector.py pattern_label`

### `SERIOUS` There is no weather normalization anywhere. How does this separate a datacenter from rooftop solar, a heat pump, or a hot June?

It doesn't, and nothing in the repo claims it does, no degree days, no weather covariate, I grepped. Both detector components are raw demand-shape statistics. Behind-meter PV is invisible to EIA-930 and mechanically manufactures both of our fingerprints, which is precisely why San Diego and PG&E carry our solar label at ranks 10 and 12, descriptive and never scored. The only exogenous covariate we have is NASA POWER irradiance, and that tests the generation side, not the detector, and separates in just 2 of 5 regions by our own write-up. The closest thing to a control we have is the 2026 out-of-sample, which removes those solar regions from the top twelve while the flat-load ones hold. Precision is not quantified anywhere and we should say that on the slide rather than wait to be asked.

**We concede:** No covariate control of any kind. A mild summer alone raises our load-factor term by roughly one robust SD, and two regions we ourselves suspect are solar artifacts sit at ranks 10 and 12 of a board people will read as a datacenter board.

*Evidence:* `grep for degree day/HDD/CDD/weather across scripts and engine returns only unrelated hits; claims/derived/irradiance.json conclusion.non_supporting_regions = AZPS, SWPP/OPPD, CISO`

### `SERIOUS` Nine true_on_paper, one cannot_verify, zero contradicted. Can 'contradicted' ever fire?

Not for the claims we have, and we should say that before you do. Ten claims across four of 52 records, and an annual market-based claim is true by construction under the GHG Protocol, so the negative class is unreachable by design. The discriminating variable is not the label, it is the gap, and it is continuous and shipped: Meta's physical range runs 0.325 in Southern Company to 0.75 in PacifiCorp West, unweighted mean 0.463, against a claim of 1.0. The class that could fire is a site-level or hourly physical claim; the one hourly entry we have is Google's 24/7 target, which is an aspiration, not an achievement, and we score its falsifiability at 0.6. On whether the yardstick itself is sound: our 2025 shares match Google's own published Grid CFE within two points in 7 of 11 BAs, median difference minus 0.5.

**We concede:** The verdict taxonomy has one reachable class. The layer is a measurement of a gap, not a test of a claim, and we should label it that way on screen.

*Evidence:* `claims/companies.json: 52 records, 10 claims (META 1, MSFT 3, GOOGL 5, AMZN 1), verdicts 9 true_on_paper + 1 cannot_verify; META-2026-001 physical_min 0.325 / max 0.75 / mean 0.463; claims/derived/google_grid_cfe_validation.json summary`

### `AWKWARD` Your duplicate sweep was tuned until its one known positive appeared, and it flagged a second duplicate, PNM/TEPC, that you never corrected. Why is one a headline and the other invisible?

The calibration point stands: the first version swept one window, missed AZPS/SRP, and we added the sliding window to catch it. That is in-sample tuning on a single known positive and we cannot claim exhaustiveness from it. But the PNM/TEPC flag cannot touch anything we headline. It is solar, in spring, and overnight is midnight to 6am, TEPC's 2019 overnight solar is 0.0 megawatts and PNM's is 1. And the detector is demand-only: no generation figure enters a rank at all, so Tucson at rank 4 is untouched by any duplicate. The evidence tier is also far below AZPS, 51.5% of hours identical within 5 MW and a 17-megawatt mean difference, against 99.58% and 1.25. What it could inflate is TEPC's 2019 daytime and all-hours clean figure, 173 MW daytime, and we have not recomputed that.

**We concede:** In-sample calibration on the one positive we knew about, and a flagged pair we left uncorrected without putting its confidence tier on screen. A partial or scaled duplication of a jointly owned plant would pass straight through our 50 MW and 50%-identical floors.

*Evidence:* `claims/derived/pairwise_duplicates.json duplicates[1] (PNM/TEPC solar, 51.49%, 17.25 MW, combined 145.7 MW); server/static_export/region/TEPC.json overnight_fuel_mw.2019.solar = 0.0; scripts/l3_detector.py load_demand uses demand only`

### `AWKWARD` 2019 is your baseline for everything and there is no sensitivity run. Show me the top twenty with a 2021 base.

We had not run it, so I ran it now, reconstructing the detector from the shipped per-year demand table, which reproduces the published ranking to within two places and 0.10 of score. Rebasing on 2020, 2021 and 2022 against 2025: Dominion 5, 7, 6; OPPD 7, 6, 5; AEP 18, 18, 11; North Texas 1, 1, 1; Phoenix 4, 4, 2; and Dallas still misses at 71, 89, 94. Spearman against the 2019 base is 0.92, 0.86, 0.81. The unstable ones are Santee Cooper, which falls to 51 on a 2021 base, and Tucson, 17 on 2022. On the PJM claim you are right: 'flat within 100 MW' is an endpoint statement. The series dips to 34,316 in 2020, so the honest line is 'within 1.4 gigawatts across seven years, and 2025 sits 81 megawatts below 2019, while overnight generation rose 8.8.' The 2026 figure is Jan-to-August, not a calendar year, so it is not a like-for-like comparison either way.

**We concede:** No robustness table existed in the repo until now, and the headline 'flat within 100 MW since 2019' is an endpoint coincidence on a series that wanders by 1.4 GW. Two of our top-ten regions are baseline-fragile. This reconstruction is mine, from rounded shipped JSON, not a pipeline rerun, it belongs in the repo before we demo.

*Evidence:* `server/static_export/region/*.json demand.{2020,2021,2022,2025}; reconstruction validated against published detection (max rank error 2, max score error 0.10); PJM.json cf_avg_mw overnight 35,700 / 34,316 / 35,394 / 35,595 / 35,566 / 35,670 / 35,619 / 36,299`


---

## Power systems & data

### `FATAL` Pull up your Dallas / Columbus / Portland comparison. Dallas scores 0.603, siting rank 18, headroom 0.417, those are ERCOT's numbers. Columbus scores 0.436, rank 34, headroom 0.408, those are PJM's. I checked: all nineteen PJM zones carry byte-identical siting scores, and all eight ERCOT zones do too. So your siting product cannot tell Northern Virginia apart from Chicago, or Dallas apart from Houston. And the field is literally keyed 'headroom_overnight_clean_mw_over_demand' on a card that names a metro. What exactly is the Columbus card telling me when it says 10.74 GW of gas filled the growth, that's the whole PJM footprint's gas, thirteen states, next to a zone that grew nine percent.

You're right on both, and the key name is a bug we should fix before demo, Amendment 2 removed headroom and the JSON never got renamed. What the card does resolve per zone is the detector half: on that same Dallas/Columbus card, Dallas is rank 91 at score -1.32 and Columbus is rank 19 at +2.29, which is zone demand and nothing inherited. The siting half is the BA's, and the card says so in the payload, cf_inherited_from_ba is true and the flag string reads 'generation numbers are the parent BA's'. So the honest reading of the Columbus card is: this zone's demand shows the flat-load signature, and the grid that serves it added 10.74 GW of overnight gas across thirteen states. That is a real claim, but it is a PJM claim next to a zone number, and we should stop putting them on the same line without a divider.

**We concede:** Correct on all three counts. The siting score resolves at 43 balancing authorities, not 111 regions, 68 of our rows inherit their parent's siting verbatim, so two metros inside PJM are indistinguishable on that half of the card. And the JSON key still says 'headroom' after Amendment 2 removed capacity headroom. That key is wrong and we should rename it to clean_over_demand_overnight before anyone reads the API.

*Evidence:* `server/static_export/regions.json (43 unique siting rows behind 111 regions; PJM's 20 rows all read 0.436/34/0.408/0.390, ERCOT's 9 all read 0.603/18/0.417); server/static_export/site/300mw-dallas-columbus-portland.json (the literal key headroom_overnight_clean_mw_over_demand, and detector rank 91 score -1.32 for Dallas vs rank 19 score +2.29 for Columbus); web/src/pages/Screener.jsx:80 and web/src/components/WxProvenance.jsx:33 (column label and tooltip); scripts/l4_supply.py siting()`

### `FATAL` Your detector's fourth-ranked region in the country is Tucson Electric. Between 2019 and 2025 TEP added 218 megawatts of average demand. Number ten is San Diego, which added 74 megawatts. Number twelve is PG&E: 147 megawatts on an eleven-gigawatt base, one point three percent. Number eleven is PNM at 133 megawatts. Meanwhile Dominion, the one place on this continent everybody agrees is a datacenter buildout, added 3,714 megawatts and you rank it sixth. So your ranking of where the AI buildout is landing is essentially uncorrelated with how much load actually landed. Four of your top twelve added less than one hyperscale campus between them.

Your four numbers are exact, 218, 74, 133 and 147, 572 megawatts between them, and there is no magnitude term anywhere in the score. But 'essentially uncorrelated' is too strong: Spearman between score and absolute megawatts added is 0.534 across all 111 regions, and the top ten includes ERCOT at +11.9 GW, Far West at +4.1 GW, Dominion at +3.7 GW and WACM at +1.3 GW. The score answers 'did this region's load shape change', not 'who is biggest', because ranking by megawatts just returns a list of large grids. What we should have shipped, and did not, is absolute megawatts added as a column beside the rank, the number is already in the export, it is one column, and it would let you throw out rank four yourself in two seconds.

**We concede:** There is no magnitude term in the score, by design and now frozen, and your four numbers are exact: those four regions add 572 MW between them. A 500 MW region with a noisy percentage can and does outrank a 4 GW region that actually grew.

*Evidence:* `server/static_export/region/*.json demand.2019/2025 avg_mw: TEPC 1,435->1,653 (+218), CISO/SDGE 2,095->2,169 (+74), PNM/PNM 1,039->1,172 (+133), CISO/PGAE 10,887->11,034 (+147), PJM/DOM 11,681->15,395 (+3,714); Spearman(detector score, MW added) = 0.534 over 111 regions, computed from those files; scripts/l3_detector.py (no magnitude term in score)`

### `FATAL` EIA-930 reports utility-scale generation and net interchange. It cannot see a single rooftop panel. Behind-the-meter PV suppresses metered daytime demand and leaves the night alone, which is precisely and exactly your top-weighted term, overnight excess. Now look at your own ranking: NYISO Zone E ranks 17th with demand down seven point one percent and overnight excess plus 11.6. Zone G, 20th, demand down zero point seven. Zone C, 32nd, down six point six. ISO-NE 4001, PJM/JC, Zone B, Zone F, nine of your top thirty-six are shrinking coastal zones with heavy rooftop programs. Zone E outranks PJM/AEP, which is one of the four regions you pre-registered as a validation hit. And your 'possible midday solar suppression' label, by your own design, never touches the score.

It's worse than you said, ten of the top thirty-six carry the label, eleven have growth under five percent, and yes, Zone E at 17 beats a pre-registered validation region at 19. We have no BTM adjustment; EIA-930 cannot see a rooftop and neither can we. What the label does buy is separability: all thirteen labelled regions in the full 111 have demand growth under five percent, so one filter on that column clears the entire contaminated band and the top nine are untouched. The label is out of the score because the score was frozen before we saw the ranking, and unfreezing it now to exclude a category would be exactly the tuning the freeze was meant to prevent. What we should fix before demo is the screen: a one-click 'exclude solar-suppression' toggle, and the ten-of-thirty-six number said out loud, not left in a caption.

**We concede:** You undercounted. It is ten of the top thirty-six carrying the solar-suppression label and eleven with growth under five percent, and Zone E at 17 does outrank PJM/AEP at 19, which we pre-registered. We built the label, we knew the confound, and we deliberately kept it out of the score. There is no behind-the-meter adjustment anywhere in the repo.

*Evidence:* `server/static_export/regions.json detection: 10 of the top 36 carry pattern='possible midday solar suppression' (CISO/SDGE 10, CISO/PGAE 12, NYIS/ZONE 17, NYIS/ZONG 20, CISO 21, NYIS/ZONF 26, NYIS/ZONC 32, ISNE/4001 33, PJM/JC 34, NYIS/ZONB 36); 11 of the top 36 have growth_pct < 5; all 13 labelled regions in the full 111 have growth < 5%; PJM/AEP is rank 19. grep for 'behind-the-meter' across the repo returns one hit, README.md:97, the label rationale. No BTM adjustment exists.`

### `FATAL` Let's do the PJM arithmetic on stage. You say overnight generation rose 8,701 MW and overnight net exports fell from 3,814 to 2,489, that's 1,325 MW freed up. Generation up plus exports down means overnight load should be up ten thousand megawatts. Your own file says PJM overnight demand went 80,643 to 87,203. That's 6,560. Where are the other 3,466 megawatts? And check the identity directly: 2019 overnight, 82,539 generated minus 3,814 exported is 78,725 against 80,643 of demand, you're short 1,918. 2025: 91,240 minus 2,489 is 88,751 against 87,203, now you're long 1,548. The residual flips sign and swings 3.5 gigawatts across the exact two years your headline compares. Also, your Dominion share: 3,973 over 8,701 is a demand growth divided by a generation growth. Against the right denominator it's 61 percent, not 'about half.'

Your arithmetic is exact and your diagnosis is right: those three numbers are three different tables. Generation is the fuel-level table with storage stripped, demand is PUDL's imputed column, interchange is EIA-adjusted from operations, and the 7 MW median residual we quote is a check on demand_adjusted, which we don't publish. That citation should come out of the README today. The headline itself doesn't use the identity: clean 35,700 to 35,619, total 82,539 to 91,240, and the nine fuel deltas sum to +8.69 GW against that +8.70 GW total, one table, internally closed. And you're right about Dominion: 3,973 over 8,701 is a demand growth over a generation growth. It is 61% of PJM's overnight demand growth, and that correction has to land in the script and the Q&A before we record.

**We concede:** Your arithmetic reproduces exactly and your diagnosis is right. Those three numbers come from three different tables under three different conventions: generation is the fuel-level table with storage excluded, demand is PUDL's imputed column, interchange is EIA-adjusted from the operations table. The README's '7 MW median residual' is a check on demand_adjusted_mwh, a column we do not publish, citing it as if it validates these three numbers is misleading and should come out. And the Dominion denominator is wrong: 46% is demand growth over generation growth. The right figure is 61% of PJM's overnight demand growth. That error is in docs/judges_qa.md answer 5 and in the recorded demo line.

*Evidence:* `server/static_export/region/PJM.json: total_avg_mw.overnight 82,539->91,240; interchange.overnight_net_export_mw 3,814->2,489; demand.overnight_avg_mw 80,643->87,203. Residual -1,918 / +1,548, swing 3,466, reproduced exactly. scripts/l2_interchange.py:42-43 runs the identity on demand_adjusted_mwh; scripts/l3_detector.py load_demand() publishes demand_imputed_pudl_mwh; scripts/carbon_free_index.py + build_wide.py build total_avg_mw as the fuel-level sum of net_generation_adjusted_mwh with storage excluded. fuel_delta_overnight_gw sums to +8.69 GW against a +8.701 GW total. DOM overnight demand 10,060->14,033 = +3,973; 3,973/6,560 = 60.6%.`

### `SERIOUS` You have PNM in your ranking twice. 'PNM' the balancing authority is 46th, 4.6 percent growth, 1,596 MW average in 2019. 'PNM/PNM, System Firm Load' is 11th, 12.8 percent growth, 1,039 MW. Same utility, same wires, two rows, thirty-five ranks apart, and a 557 megawatt level gap because one is firm load and the other is BA demand. Then ERCOT, the whole interconnection, 43.8 gigawatts, sits at rank 8 competing against its own subregions, three of which are in your top sixteen. So what is the population of 111? It is not a partition. You have parents, their own children, a child that is a partial measure of its parent, and a BA whose only peer group is itself, all sharing one median and one MAD.

Not a partition, correct: 43 BA rows plus 68 zones, eight of those BAs sitting next to their own children, and PNM measured two different ways thirty-five ranks apart. The ERCOT fallback is confirmed by our own numbers, median growth across the 43 BAs is 4.60%, and ERCOT's 27.2% growth minus its 22.7 divergence gives 4.5, so it is being compared to the national median exactly as the fallback says. What I can show you is that it doesn't drive the answer: re-score with the eight duplicated parents removed, 111 down to 103, and the top seven are unchanged, Dominion is still sixth and Omaha still seventh. The fix that should land before demo is labelling, 'PNM firm load, partial measure' on that row, and the pool composition printed on the method screen rather than inferred.

**We concede:** It is not a partition, and PNM appearing twice thirty-five ranks apart with two incompatible demand definitions is visible without opening a file. That row should be relabelled 'PNM firm load (partial measure)' before the demo. The ERCOT fallback is exactly as you describe, it is the only BA in the Texas interconnection, so it is scored against the national BA median.

*Evidence:* `server/static_export/regions.json: 43 BA rows + 68 zone rows = 111; 8 BAs appear alongside their own children (CISO, ERCO, ISNE, MISO, NYIS, PJM, PNM, SWPP). PNM 1,596->1,669 MW rank 46; PNM/PNM 1,039->1,172 MW rank 11. Median growth of the 43 BA rows = 4.60%; ERCO growth 27.2 minus divergence 22.7 = 4.5, confirming the all-BA fallback in scripts/l3_detector.py. Re-scoring with the 8 duplicated parents dropped (111->103): top seven unchanged, PJM/DOM still 6th, SWPP/OPPD still 7th.`

### `SERIOUS` Everything you have rests on converting UTC to local hour, and PUDL gives you one report_timezone per balancing authority. Your export has MISO on America/New_York, MISO's load is majority Central: Minnesota, Iowa, Arkansas, Louisiana. PJM/CE is ComEd, Chicago, also on New_York. SWPP/SPS spans the Texas Panhandle and eastern New Mexico on one Central clock. And here is the one I'd lead with: WACM is on America/Phoenix, which never observes DST, while WAPA Rocky Mountain serves Colorado and Wyoming, which do, and WACM is your rank 5 and your flagged 'unexplained' region. PNM is on Phoenix too, and New Mexico observes DST. So for eight months a year, half your footprint's 'overnight' window is off by an hour, and your claim that 00:00 to 05:59 contains no solar anywhere is not true at the eastern edge of a Central-assigned BA in June. Show me the plus-or-minus-one-hour sensitivity run.

There is no sensitivity run, and the README line is weaker than the problem: seven BAs sit on America/Phoenix and four of them, PNM, WACM, El Paso and WAPA Desert Southwest, serve DST territory. Five of our top thirteen ranks are on that clock, including WACM at five. Here is the check I can run from the published hourly profiles right now: shift the overnight window to 01–06 or to 23–04 and PJM's overnight share moves by at most eight thousandths, and the 2019-to-2025 change is -0.042, -0.038, -0.043 across the three windows. Phoenix, our solar-heaviest grid, reads 0.098 to 0.109 overnight in 2025 under all three, no solar leaks in. That is a partial check on published profiles, not a rerun of the pipeline, and the rerun is the honest thing to do before this ships.

**We concede:** There is no sensitivity run in the repo. I grepped; the only DST line is README:164, and it says 'Arizona has no DST', which undersells the problem, four of the seven Phoenix-assigned BAs serve territory that does observe DST, and five of our top thirteen ranks are Phoenix-assigned. A constant offset largely cancels in a growth comparison, but it does not cancel for the generation-side day-vs-night split, and we did not check that.

*Evidence:* `server/static_export/region/*.json timezone: MISO and PJM America/New_York; seven BAs on America/Phoenix (AZPS, EPE, PNM, SRP, TEPC, WACM, WALC), of which PNM, WACM, EPE and WALC serve DST-observing territory; those Phoenix BAs hold detector ranks 3, 4, 5, 11 and 13. grep for DST/daylight/sensitivity across the repo returns one line, README.md:164. Window shift computed from published profile_24h: PJM overnight share 00-05 = 0.433->0.391, 01-06 = 0.432->0.394, 23-04 = 0.428->0.385 (delta -0.042 / -0.038 / -0.043); AZPS 2025 overnight = 0.103 / 0.098 / 0.109.`

### `SERIOUS` Your siting score puts BPA third and Grant County PUD seventh on clean-megawatts-over-demand above 1.2. I've dispatched that system. That surplus is contracted federal hydro with fish-passage and flood-control constraints; it is not available to a new 300 MW flat load. Put a datacenter on the mid-Columbia and in a low-water year you displace an export and the Northwest imports gas, the marginal resource is a combustion turbine, not a spillway. Same problem in the other direction: your overnight clean share is dominated by must-run nuclear that is already at 93 percent capacity factor, so the marginal megawatt-hour of new overnight load in PJM is gas at 100 percent, not 39 percent clean. And nowhere in this repo is there a renewable-curtailment term, the one place a new flat load genuinely absorbs clean energy that would otherwise be spilled, SPP overnight wind, you score on average share and miss entirely.

Conceded, and the file is more damning than your version. BPA's overnight clean surplus is 1,518 megawatts against 3,775 megawatts of overnight net export. Grant County's surplus is 256 megawatts against 259 of export, the entire apparent surplus is already contracted out the door. Both figures are in the same region file the siting score reads, and the score does not use them. The fix is one line: net the ratio of exports, or print the export beside it. On margin versus average you are right and it is not a caveat here, it is the product logic, the ratio says 'this footprint currently generates cleanly at night', and the UI asks it to answer a different question. And no, there is no renewable-curtailment term; SPP overnight wind is scored on average share and we miss the one case where new flat load genuinely absorbs spill.

**We concede:** Fully conceded, and the file makes your case harder than you made it. BPA's overnight clean surplus is 1,518 MW against 3,775 MW of overnight net export, the export is more than double the surplus. Grant County's surplus is 256 MW against 259 MW of export: the entire apparent surplus is already leaving. Both numbers sit in the same region file the score reads and the score ignores them. There is no curtailment term anywhere, and the slope we do compute, BPAT -0.044, GCPD -0.071, the two worst on the board, is shown and deliberately excluded.

*Evidence:* `server/static_export/region/BPAT.json: overnight clean 7,716 MW, overnight demand 6,198 MW (surplus 1,518 MW), overnight net export 3,775 MW. GCPD.json: clean 991 MW, demand 735 MW (surplus 256 MW), overnight net export 259 MW. SRP.json: surplus 141 MW against 3,103 MW of overnight export. Siting slopes: BPAT -0.0444, GCPD -0.0713 (worst two of 43), computed and excluded from the score per scripts/l4_supply.py siting(). grep for 'curtail' finds only a load-curtailment check on Riot, no renewable-curtailment term.`

### `SERIOUS` You describe the siting score as the mean percentile across three equal-weight components. I ran the correlation across your 43 scored BAs: overnight clean share 2025 and overnight-clean-MW-over-demand correlate at r = 0.81. Look at the rows, ERCOT 0.413 and 0.417, SCEG 0.380 and 0.404, MISO 0.345 and 0.341, LG&E 0.011 and 0.009. For any BA that doesn't import or export much, the second component is algebraically the first times a generation-to-demand ratio. So you have not weighted three things equally. You have weighted clean share two-thirds and change one-third, and change only correlates with level at 0.21.

Your numbers reproduce: 0.809 and 0.212. Two of three components are near-collinear and the effective weighting is roughly two-thirds level, one-third change, we should say that on the method screen instead of 'three equal components'. But the change component isn't decoration. Spearman between a share-only ranking and our composite is 0.82, not 1.0, and the disagreements are the interesting rows: Northwestern Energy moves from 19th to 4th, Public Service of Colorado 17th to 6th, SPP 13th to 5th, while NYISO drops 15th to 30th and CISO 16th to 29th. PNM ranks 4th almost entirely on a +0.372 change against a middling 0.507 ratio. So the one component you're calling a third of the weight is the one producing every result a level ranking wouldn't give you.

**We concede:** Your r = 0.81 reproduces to 0.809, and 0.21 reproduces to 0.212. Two of the three components are close to the same variable, so the effective weighting is roughly two-thirds level and one-third change. Describing it as three equal components is not accurate and the method line should say so.

*Evidence:* `Computed from server/static_export/regions.json over the 43 unique BA siting rows: r(share2025, clean_mw_over_demand) = 0.809, r(share2025, change) = 0.212, r(change, clean_mw_over_demand) = 0.122. Spearman(rank by share alone, rank by composite) = 0.820. Movers under the composite: NWMT 19->4, PSCO 17->6, PACE 29->18, SCEG 24->14, SWPP 13->5; NYIS 15->30, CISO 16->29. PNM ranks 4th on change_since_2019 = +0.372 with a middling ratio of 0.507.`

### `SERIOUS` 'PJM overnight clean generation has been flat within 100 megawatts since 2019.' Your own series says 35,700, 34,316, 35,394, 35,595, 35,566, 35,670, 35,619, that's a 1,384 megawatt spread. Flat within 100 is an endpoint statement, and one nuclear refueling outage in PJM is about 1,200 megawatts, so your stated precision is inside the noise of a single outage schedule. And what's actually underneath it: nuclear down 0.95 gigawatts, wind up 1.07. That's not stasis, that's Three Mile Island retiring and wind cancelling it out. Meanwhile overnight solar in PJM grew by ten megawatts in six years, which is what solar does at three in the morning. So what have you discovered that isn't 'nobody built nuclear'?

Endpoint statement, conceded, and we publish no error bars. But the 1,384 MW spread is one year: deviations from 2019 are -1,384 in 2020 and then -306, -105, -134, -30, -81. Drop the COVID year and every year since 2021 sits within 310 megawatts of 2019 on a 35.7 gigawatt base, which is a stronger claim than the one we're making badly. On mechanism you're right and it is the finding, not a dodge: nuclear down 0.95 gigawatts, wind up 1.07, solar up ten megawatts, and overnight gas up 10.74. Six years of buildout produced exactly enough overnight clean power to replace what retired, while the overnight load it was supposed to serve grew by 8.7 gigawatts. We should quote it as 'within 400 MW every year since 2021' and say the composition out loud.

**We concede:** 'Flat within 100 MW' is an endpoint statement and the spread is 1,384 MW. We publish no error bars, and you are right that a single refuelling outage is the same order as our stated precision. The composition, nuclear down, wind up, is the mechanism and it belongs in the headline, not underneath it.

*Evidence:* `server/static_export/region/PJM.json cf_avg_mw.overnight 2019-2025: 35,700 / 34,316 / 35,394 / 35,595 / 35,566 / 35,670 / 35,619. Spread 1,384 MW; deviations from 2019: -1,384 (2020), -306, -105, -134, -30, -81. fuel_delta_overnight_gw: nuclear -0.95, wind +1.07, solar +0.01, gas +10.74, coal -2.52. web/public/fixtures/opening.json headline. No error bars are published anywhere.`

### `SERIOUS` Where is the weather normalization? You compare two single calendar years, 2019 against 2025, with no heating or cooling degree day adjustment anywhere in the pipeline, I grepped, there is no HDD, no CDD, nothing. Your third term is load factor, mean over the 99.5th percentile hour, and that ratio moves directly with how severe the summer peak was: 2019 was a mild summer in the East, 2025 was not. PJM's own p99.5 went from 139,294 to 147,779. So part of every load-factor delta in your table is weather, and part of every growth percentage is weather. And on the peak choice, PJM's true 2019 max was 152,315 against a p99.5 of 139,294, a thirteen gigawatt haircut. You picked the 44th-highest hour to dodge one corrupt hour in PJM/PL. Why not fix the one bad hour instead of applying an eight-percent haircut to all 111 regions?

No weather normalization exists, I grepped, no HDD, no CDD, nothing, and that is a genuine hole. The partial mitigation is that our top-weighted term, overnight excess, is a difference between two growth rates inside the same region and the same year pair, so a uniform weather year largely cancels there; it does not cancel in the raw growth percentage or the load factor, and those are two of the three terms. On p99.5 I can answer directly, because both load factors are in the export. Re-score all 111 with the raw maximum instead: the mean rank moves 3.5 places, Dominion stays sixth, Omaha seventh, Dallas 91 to 94, and exactly one region moves a lot, PJM/PL, from 41st to 18th, which is the corrupt hour. It is not a tuning knob; turning it off changes the answer for the one region it existed for, and nothing else.

**We concede:** There is no weather normalization anywhere. I grepped: no HDD, no CDD, nothing. Endpoint-year comparison unadjusted is a real weakness and part of every growth percentage and every load-factor delta in the table is weather. We did not build it and cannot build it before the deadline.

*Evidence:* `grep for HDD/CDD/degree day/weather normal across the repo: zero hits. PJM demand p995 139,294 -> 147,779; max 152,315 -> 160,560 (8.5% and 8.0% haircut). Re-scoring all 111 regions with load_factor_max_delta in place of load_factor_delta (both are in the export): mean |rank move| 3.5, top ten changes only two adjacent swaps, PJM/DOM stays 6th, SWPP/OPPD stays 7th, ERCO/NCEN 91->94, and PJM/PL, the corrupt-hour region, moves 41->18.`

### `AWKWARD` Your detector's number one region is ERCOT North: 998 megawatts in 2019, 1,942 in 2025. That's bitcoin. Number two is ERCOT Far West, plus 4,087 megawatts, that's Permian oilfield electrification, compressors and electric frac. Numbers three, four, eleven and thirteen are APS, TEP, PNM and SRP, the highest distributed-PV territories outside California. So the top five hits of a product presented as a datacenter investigation are crypto, oil and gas, and rooftop solar, and the first place anyone would actually call a datacenter cluster is sixth. Why does the pitch lead with 'we found Data Center Alley sixth of 111' instead of 'ranks one through five are not datacenters'?

Because we wrote the line badly, and it should change before we record. Our own demo script names ranks three, six and seven and skips one, two, four and five, which is the worst possible version of a defensible fact. The honest line is stronger: ranks one and two are Bitcoin in North Texas and Permian electrification in Far West Texas, which is precisely what a flat-load detector is supposed to find, because a miner and a compressor station and a datacenter are electrically the same animal. We never claimed a datacenter detector, we claimed a flat 24/7 load detector, we said so before we saw the ranking, and the fact that it surfaces crypto and oilfield ahead of Data Center Alley is evidence it wasn't tuned toward the story. Say that on the slide, not in the caveat block.

**We concede:** The current recorded line names ranks 3, 6 and 7 and silently skips 1, 2, 4 and 5. That is the weakest framing available and it is ours, in web/src/demo/tour.js. We should change it.

*Evidence:* `server/static_export/regions.json + region files: ERCO/NRTH 998->1,942 MW at 94.6% growth (rank 1); ERCO/FWES 3,522->7,609 MW at 116.1% (rank 2); AZPS rank 3, TEPC rank 4, PNM/PNM rank 11, SRP rank 13. web/src/demo/tour.js scene 'found-night' say-line currently reads 'Phoenix ranks third, Northern Virginia sixth, Omaha seventh', skipping ranks 1, 2, 4 and 5.`

### `AWKWARD` The national number: overnight clean share 0.405 falling to 0.397. That is eight tenths of a point over six years, across 450 gigawatts, unadjusted for water year or nuclear outage schedule. Your own series is 0.405, 0.413, 0.405, 0.405, 0.403, 0.402, 0.397, that's a flat line with noise, and 2022 equals 2019 exactly. And the 2026 row in your own meta block reads 0.403, right back where it started. So you're reporting a decline that reverses in the most recent data you hold, using a 2025 endpoint. Why is 2025 the comparison year and not the Jan-to-August window you use everywhere else?

Fair, and our own 2026 row is the rebuttal, 0.403, essentially back to 0.405. Eight tenths of a point across 450 gigawatts, unadjusted for water year or refuelling, with 2022 sitting exactly on 2019, is a flat line with noise, and we should drop that sentence. The claim that survives is the megawatts: overnight clean generation added 14.3 gigawatts between 2019 and 2025 while daytime added 61.4, a factor of 4.3. Run it to the 2026 row, the one that kills the share framing, and it is 26.0 against 87.0 gigawatts, still a factor of 3.3. The ratio survives the reversal; the share does not. And you're right that the 2026 row is Jan-to-August against a calendar 2019, which isn't like-for-like, that table needs a Jan-to-August baseline before anyone quotes it.

**We concede:** The share framing is weak and our own 2026 row hands you the rebuttal. Eight tenths of a point over six years with 2022 equal to 2019 is a flat line with noise, unadjusted for water year or refuelling. We should drop the share sentence from the headline. And comparing a Jan–Aug 2026 row to a calendar 2019 is not like-for-like; the table should carry a Jan–Aug 2019 baseline and it does not.

*Evidence:* `server/static_export/regions.json meta.national.cf_share.overnight: 0.405, 0.413, 0.405, 0.405, 0.403, 0.402, 0.397, 0.403 (2019-2026), the 2026 row does read 0.403. meta.national.cf_avg_mw: overnight 159,031 -> 173,380 (+14.3 GW) and daytime 178,129 -> 239,533 (+61.4 GW) for 2025, ratio 4.28x; at the 2026 row, +26.0 GW overnight against +87.0 GW daytime, ratio 3.34x. The 2026 row is a Jan-Aug partial year against a calendar 2019, and no Jan-Aug national baseline is published in that table.`


---

## The claims layer

### `FATAL` Your own shipped file, server/static_export/facilities.json, carries ten Google sites, ten Meta sites, seven Microsoft and seven Amazon, each with a 2025 carbon-free share already attached. Average them and you get Google 46.4%, Meta 46.3%, Microsoft 45.8%, Amazon 46.1%, a six-tenths-of-a-point spread across all four of us. Your Companies page says Google is 5.6% and Microsoft is 64.2%. So which of your two files is the product, and why does your entire company finding disappear the moment you use the bigger one you already ship?

There is only one file now, and your averages are our shipped numbers. facilities.csv is 134 rows at HEAD and companies.json was rebuilt from it in the same commit: Google 0.464, Meta 0.463, Amazon 0.461, Microsoft 0.458, 5.6% and 64.2% came from the previous commit and are not in the product. But the part of your attack that matters survives the fix: the spread across the four of you is 0.006, six tenths of a point, because all four build in roughly the same eight balancing authorities. So the company-level Talk-vs-Walk ranking has no discriminating power at hyperscaler scale, and we should not present it as one. The finding is a site, not a company: Moncks Corner at 0.056 and The Dalles at 0.913 are the same company, and that 0.86 spread inside one logo is the actual result.

**We concede:** The company ranking is noise. A 0.006 spread across four operators is not a measurement of anything, and building the headline on a company ordering was wrong. The headline has to be rebuilt around a site. Separately: the repo is mid-merge with unresolved conflicts in web/src (App.jsx, CommandPalette.jsx, DetectorModule.jsx), confirm the deployed build serves the 134-site data before demoing.

*Evidence:* `claims/companies.json (52 operators); claims/lookup/facilities.csv (134 rows); git show 0864950:claims/companies.json for the old 0.056/0.642 values; server/static_export/companies.json count=52`

### `FATAL` You scored Google on exactly one site out of the ten you had already mapped, and that one site sits on SC, the third-dirtiest balancing authority out of all 111 you score, 0.056 all-hours and 0.007 overnight. The Dalles, at 0.913, was in the same CSV. Walk me through how that selection was made, because from where I sit you picked the worst grid in America for the company you wanted on the poster.

Your facts about SC are right, third-dirtiest of 111 on all hours at 0.056, fifth-dirtiest overnight at 0.007, and the one-site build was indefensible, which is why it is gone. At HEAD all ten Google sites are scored and the number is 0.464. The ordering is provable from git and I will put it on screen: facilities.csv had 20 rows through commit 0864950 at 00:09, and facilities_expanded.csv did not exist until 954c39e at 01:11, the single-site number predates the research rather than being selected out of it. Your 0.509 is the mean of the nine non-SC sites; the honest ten-site mean is 0.464.

**We concede:** While that build was live, Google's headline was one site out of ten we already had in hand, and it read exactly like cherry-picking whatever the commit timestamps say. Worse, docs/judges_qa.md Q14, Q17 and Q19 still say 6% and 'seven sites across four companies'. That document must be regenerated before the demo or a judge finds the old number in our own defence file.

*Evidence:* `git log --date=iso -- claims/lookup/facilities.csv (20 rows at 0864950, 134 at 954c39e); server/static_export/regions.json SC cf_share_2025 {all 0.056, overnight 0.007}, rank 3 of 111 all-hours; docs/judges_qa.md Q14/Q17/Q19`

### `FATAL` You advertise four verdicts, true_on_paper, contradicted, unfalsifiable, cannot_verify. In build_claims the verdict is literally `verdict = 'true_on_paper' if shares else 'cannot_verify'`. It never reads the quote, never reads the grid number, never reads the counterpoint. 'contradicted' is not assignable anywhere in engine/. So your verifier has produced zero negative verdicts in ten claims, and the one word that could ever hurt us is unreachable code. In what sense is this a verification pipeline rather than a join on whether you happened to map a site?

You are right, and I am not going to soften it: that line is exactly what it looks like. Grepping engine/, scripts/ and server/ for 'contradicted' returns zero producers, it exists only in four web/src files, so it is dead vocabulary that implies a falsification capability we did not build. Shipped verdicts are 9 true_on_paper and 1 cannot_verify, and both values are fully determined by whether sites mapped. So the verdict field is a coverage label, and the analytical content lives entirely in the counterpoint evidence, Google's page 94 hourly-CFE table read against page 4 of the same report.

**We concede:** The verdict field has no discriminating power. Fix before demo, and it is a UI change not a research change: rename it 'coverage' on screen and delete 'contradicted' from Check.jsx, findings.js and innovLadder.js. Shipping an enum with an unreachable member is precisely what we would fail a company for.

*Evidence:* `engine/verify/__main__.py build_claims (`verdict, reason = "true_on_paper", None` if shares else cannot_verify/no_site_mapping); grep -rn contradicted engine scripts server → 0 hits; web/src/pages/Check.jsx:31,66, web/src/lib/findings.js:77,113,149, web/src/lib/innovLadder.js:102,175`

### `FATAL` Meta's talk is 0.55 and its walk is 0.603. Microsoft's talk is 0.55 and its walk is 0.642. Your Companies page sorts on talk_score minus walk_score, so two of the three companies you actually read documents for have a negative gap, we out-walk our talk. You are subtracting a unitless rhetoric index from a physical generation fraction. What does negative 0.09 mean in any unit?

It means nothing, and I will not defend the arithmetic. At HEAD the signs have actually flipped: Meta is +0.087, Microsoft +0.092, Google -0.059, so Companies.jsx, which computes gapOf as talk_score minus walk_score on line 23 and sorts the page on it on line 71, now ranks Google last of the three. talk is magnitude times specificity times scope_breadth, a rhetoric index; walk is a physical generation fraction; they share a 0-1 range and nothing else. The two belong side by side as adjacent readings with no operator between them.

**We concede:** The difference is meaningless and it is the page's sort order, so the ranking a judge sees is driven by a quantity with no unit. This has to change before the demo: two readings, labelled, no subtraction, and the page sorted on something real like overnight carbon-free share or detector rank.

*Evidence:* `web/src/pages/Companies.jsx:23 gapOf, :71 sort; claims/companies.json talk/walk: META 0.55/0.463, MSFT 0.55/0.458, GOOGL 0.405/0.464`

### `SERIOUS` You say ten claims from four companies. Four of Google's five are the identical sentence from page 4, and all three of Microsoft's are the identical sentence from page 6. So it is four distinct quotes, not ten. And since talk_score is the unweighted mean across claim rows, counting that one Google sentence four times drags the mean from 0.338 to 0.405, a twenty percent inflation of the number you put on our chart. Is that a deliberate weighting or did nobody dedupe?

Nobody deduped, and your arithmetic reproduces exactly. GOOGL-001, -002, -004 and -005 are byte-identical page-4 quotes and MSFT-001/002/003 are byte-identical page-6 quotes, so it is four distinct quotes across four companies, not ten claims. I ran it: the 100%-purchases quote scores 0.45 and the CFE-moonshot quote 0.225, so Google's mean goes 0.405 to 0.338 on dedupe, your number. Microsoft's three are identical to each other, so its 0.55 is unaffected either way.

**We concede:** Not deliberate weighting, which is worse in one sense, it means the corpus size and the single number on Google's chart were both inflated by an oversight. The rows are really findings, one claim paired with a different counterpoint each time. Fix: dedupe by verbatim before taking the talk mean, and label the card '4 quotes, 10 findings' rather than '10 claims read'.

*Evidence:* `claims/companies.json GOOGL-2026-001/002/004/005 and MSFT-2026-001/002/003 verbatim fields; recomputed engine/verify/__main__.py talk(): 0.45 and 0.225, mean of 5 = 0.405, mean of 2 unique = 0.338`

### `SERIOUS` Your extract README has a whole section on human-written anchors, a cap that fires when the model contradicts itself, and a falsifiability_capped audit field. Then in engine/verify/__main__.py line 190 the shipped falsifiability is `0.85 if magnitude else 0.6`, where magnitude is `1.0 if '100%' in quote else None`. Nine of ten claims read 0.85. Your falsifiability score is a substring search for a percent sign. Which one is the system?

The constant is what ships and you should call it a substring test, because that is what it is: nine claims at 0.85, one at 0.6, two values and no variance. The anchored scoring is real work, human-written anchors in fixtures/falsifiability_anchors.json, a deterministic cap that fired on 171 claims and cut scores at or above 0.8 from 988 to 872, with falsifiability_model and falsifiability_capped both recorded, but it runs over claims/raw and never reaches companies.json. The hand-verified path and the extraction path are two pipelines that were never joined.

**We concede:** A field named falsifiability that takes two values from a substring search is mislabelled. Before the demo, rename the shipped field has_explicit_magnitude and present engine/extract separately as the thing it actually is. A README describing capability the shipped artefact does not have is the exact divergence we accuse others of.

*Evidence:* `engine/verify/__main__.py build_claims `"falsifiability": 0.85 if magnitude else 0.6` and `magnitude = 1.0 if "100%" in quote else None`; engine/extract/README.md lines 65-70, 163-183; claims/companies.json 9 claims at 0.85, GOOGL-2026-003 at 0.6`

### `SERIOUS` Your HEDGES table docks 0.30 for the word 'annual' and 0.20 for 'market-based'. Your extract README says, in bold, that scope narrowing raises falsifiability because a company tightening its own standard is being more checkable. So your extraction module rewards us for saying 'annual, market-based' and your scoring module punishes us for it. Which is it, is precise disclosure of scope good faith or is it hedging?

They measure different things and we have never said so on screen, which is our failure not yours. scope_breadth asks how much of the company the assertion covers; the README's rule asks how checkable the sentence is. 'Annual, market-based' genuinely does both, it makes the sentence more checkable and the assertion narrower, so it should raise falsifiability and lower breadth simultaneously. The problem is that we never wired falsifiability to respond to anything, so only the penalty ships and the credit does not.

**We concede:** As shipped, the talk score reads as a penalty for legal precision, and with falsifiability pinned at a constant there is literally nothing on the other side of the ledger to offset it. Two modules of ours are on record disagreeing and neither says which question it is answering. That sentence, breadth of assertion is not checkability of sentence, has to be printed next to the score.

*Evidence:* `engine/verify/__main__.py HEDGES {annual 0.30, market-based 0.20, certificates 0.15, matched 0.15, purchases 0.10}; engine/extract/README.md line 81 'Scope narrowing raises falsifiability'`

### `SERIOUS` Amazon is the only company you mark cannot_verify, and Amazon happens to sit on the dirtiest grid of the four at 0.393. Your own note says the quotable restatement exists on page 10 and that you used it for the cross-document check. So you found a falsifiable Amazon claim, checked it elsewhere, and then reported 'no falsifiable content' on the card. How is that not you deciding which company gets a verdict?

The note is ours and it says what you just said, so I will read it out rather than be caught holding it. The real reason is a schema constraint: a finding requires a counterpoint inside the same document, and nothing in Amazon's report qualifies the page-10 restatement in the same sentence, so the findings pipeline emitted nothing and the card fell through to the default. The reason string is wrong and should read no_intra_document_counterpoint, not no_falsifiable_content. And it is not a choice about which company gets a verdict, per the previous question the verdict is determined only by whether sites mapped, and Amazon has 7 sites at 100% coverage. On your premise: Amazon is no longer the dirtiest of the four either, it is 0.461 at HEAD, above Microsoft's 0.458.

**We concede:** 'No falsifiable content' is not what happened and our own note proves it. That string is a fix before demo. The underlying constraint, a finding needs an intra-document contradiction, is defensible and should be stated as the reason on the card.

*Evidence:* `claims/companies.json AMZN-2026-001 note and cannot_verify_reason='no_falsifiable_content'; engine/verify/__main__.py build_claims gap branch; AMZN walk_score 0.461 vs MSFT 0.458`

### `SERIOUS` On your scorecard xAI reads 48.7% carbon-free and Google reads 5.6%. xAI's Memphis campus runs roughly 495 MW of on-site gas turbines that EIA-930 cannot see at all, your own facilities note says so, and your expansion notes list eleven behind-the-meter sites you are structurally blind to. So your instrument ranks the operator with the most unmetered gas in the country as nine times cleaner than the one that publishes hourly CFE. Do you put that ranking on screen?

The structural point is entirely correct and it is our own finding, not yours, EXPANSION_NOTES finding 1 counts eleven wholly or mostly behind-the-meter sites EIA-930 cannot see, and the xAI Memphis row in facilities.csv carries the ~495 MW on-site turbine caveat in the note field. The specific numbers have inverted at HEAD: xAI reads 0.418 and Google 0.464, so Google is above xAI now. But that is luck, not a fix, a site burning its own gas still reads as whatever its balancing authority reads, so the more of its own gas it burns the cleaner it looks. Fix before demo: promote behind_the_meter from prose in the note field to a flag in the data, and refuse to rank flagged operators.

**We concede:** A demand-only, footprint-only instrument has this failure mode by construction and cannot be patched out of it. We already wrote down the general lesson in the AZPS work, 'a caveat that is not machine-readable does not exist', and then made the same mistake again here, with the caveat sitting in a CSV note that nothing parses.

*Evidence:* `claims/lookup/facilities.csv xAI Memphis row note ('reported around 495 MW... does not appear in EIA-930 at all'); claims/lookup/EXPANSION_NOTES.md finding 1 (eleven sites); claims/companies.json XAI walk 0.418, GOOGL 0.464; server/static_export/regions.json corrections.project_level_finding`

### `SERIOUS` Meta paid for Rattlesnake Creek, new wind built into SPP under a dedicated OPPD rate. That wind is physically in SPP's generation, so it lifts SWPP's 0.456, for Meta and for every competitor in the footprint equally. Google's Carolina contracts are invisible to you because of where the meters sit. So 'grid-only, no PPAs' does not treat us neutrally: it silently credits additionality that lands inside a mapped footprint and silently erases additionality that does not. What exactly is the principle?

You are right and judges_qa Q18 is too broad where it says 'contracts are not electrons'. Rattlesnake Creek is physically in SPP, so it is inside SWPP's 0.456 for Meta and equally for TierPoint sitting in the same Sarpy County footprint, our own facilities.csv note says the grid Meta draws from is still SPP. So the exclusion is not a principle about additionality; it is an accident of where the meter sits. The narrower statement that is actually true: this measures the carbon-free content of the grid a site draws from, and makes no attempt to attribute causation for what that grid contains, in either direction, no credit and no blame for having funded it.

**We concede:** 'Grid-only, no PPAs' implies a uniform exclusion and there is not one. New build inside a mapped footprint enters the numerator regardless of who paid for it, so the fairness claim across companies does not hold as written. That sentence in Q18 needs replacing before the demo.

*Evidence:* `claims/lookup/facilities.csv Meta Papillion row note ('Meta buys wind via a dedicated OPPD rate (Rattlesnake Creek); the grid it physically draws from is still SPP') and the TierPoint Papillion row in the same SWPP/OPPD zone; docs/judges_qa.md Q18`

### `SERIOUS` Google discloses 65% hourly CFE on page 94, audited, site-weighted, across its whole fleet, the exact class of metric you claim to invent. You then score the company at 5.6% from one unweighted grid average. Your number is coarser than the number you are checking it against. On what basis is yours the headline?

It is not the headline, and 5.6% is not in the product anymore, Google reads 0.464 at HEAD across ten sites. Even 0.464 is coarser than Google's audited, site-weighted hourly figure, because ours is unweighted: we do not know each site's load, and our own notes field says so. The finding that needs no number of ours at all is Google's own two pages, page 94 discloses hourly CFE of 65, 64, 64, 66 and 65 percent for 2021 through 2025, flat, while page 4 of the same report reports a 37% annual increase in electricity demand. That is the finding, it stands on Google's disclosure, and it is what belongs on screen.

**We concede:** Putting any grid average next to an audited, site-weighted 65% invites exactly the charge that we built a worse version of their number and called it truth. Our number describes a grid, not a company, and the page must say that in those words. Google's own disclosure is the strongest thing in the corpus precisely because it is better than ours.

*Evidence:* `claims/companies.json GOOGL claims[].evidence internal_contradiction (p.94 series 65/64/64/66/65) and p.4 quote; claims/companies.json GOOGL walk_score 0.464, notes[1] 'Unweighted across sites; we do not know each site's load.'`

### `AWKWARD` CoreWeave and Applied Digital both score 0.349, it is the same building in Ellendale, leased. IREN, Riot, Cipher and Oracle all score 0.461, which is just ERCOT. Amazon, Digital Realty and Equinix all score 0.393, which is just PJM. And every one of those cards reads 100% coverage. You have not scored fifteen companies; you have looked up eight grids and printed logos on them, using all-hours generation in a project whose entire thesis is that the night is what did not improve. What is the company-level information content here?

Mostly right, and the all-hours point is the sharpest thing in your list. Across 52 operators, nine share 0.461, five share 0.393 and four share 0.456, a single-BA operator's score is just that BA, so you are correct that we looked up grids and printed logos. CoreWeave and Applied Digital now differ at 0.401 and 0.349 only because CoreWeave has three sites, but both Ellendale rows are the same leased building and our own note says so. On all-hours: cf_share() reads the 'all' key in a project built on the night, and I ran the overnight version, the four hyperscalers go from a 0.006 spread to 0.035 (Amazon 0.457, Google 0.455, Meta 0.440, Microsoft 0.422). Better by six times, still not enough to rank companies.

**We concede:** 'Coverage: 100%' means 100% of the sites we mapped and a judge will read it as fleet coverage; that label is wrong and is a fix. The watchlist should ship as sites on grids, which is what it is, switched to the overnight window. Even the overnight fix does not rescue a company ranking for the big four, it only makes the sites legible.

*Evidence:* `claims/companies.json walk_score duplicates {0.461: 9, 0.393: 5, 0.456: 4, 0.325: 2}; engine/verify/__main__.py cf_share() `.get("all")`; claims/lookup/facilities.csv CoreWeave Ellendale note; recomputed overnight means from server/static_export/regions.json cf_share_2025.overnight`


---

## The investment case

### `FATAL` Your pitch says this gives an asset manager a demand signal on regulated utilities 'eighteen months before it shows up in a rate case.' Your own Generating Alpha page says you have no validation that this predicts any price and have run no backtest. Those cannot both be true. Show me one rate case where your data moved first, or strike the eighteen months.

You are right and we are striking it. The phrase appears in exactly two places, docs/spec.md line 40 and docs/DEVPOST.md line 258, and there is no rate-case docket, no FERC Form 1, no IRP and no utility load forecast anywhere in the pipeline; grep for them across scripts/, engine/ and the exports returns nothing but a TXNM merger note. We never measured a lead time, so we cannot quote one. The defensible version is the mechanism, not the number: EIA-930 publishes hourly with a roughly two-hour lag and a rate case is filed on a test year, so metered load must move first, by how much is an open question we did not answer. Fix before demo: delete the words 'eighteen months' from spec.md:40 and rewrite DEVPOST:258 as an untested hypothesis.

**We concede:** The single load-bearing investment claim in the pitch has no provenance in the repo. It was written for the pitch, not measured, and it directly contradicts alpha.json's own no_prediction line. It goes.

*Evidence:* `docs/spec.md:40; docs/DEVPOST.md:258; server/static_export/alpha.json no_prediction; grep -rn 'FERC|rate case|IRP|Form 1' scripts/ engine/ returns no data source`

### `FATAL` Region two on your list is Far West Texas. I computed its components off your own regions.json: overnight-excess z is 0.09, it is the median region in the country, and 95 percent of its score is neighbor divergence, which is just relative demand growth. Its load factor was already 0.839 in 2019, before any of this. So what did the 24/7 overnight fingerprint actually contribute to your top of book?

Your decomposition is right, I recomputed the frozen formula off the shipped file and get Far West at z_overnight_excess 0.09, z_neighbor_divergence 13.23, total 13.86 against a published 13.89. For Far West the fingerprint contributed essentially nothing. But it is region-by-region, not a property of the detector: San Diego ranks 10th on z_overnight_excess 3.42 with neighbor divergence of minus 0.14 and only 3.5% demand growth, PG&E ranks 12th on 1.3% growth, Tucson ranks 4th on 15% growth with divergence at 17% of its score. A pure growth screen never surfaces those three. Neighbor divergence is also not raw growth, it is growth minus the median of sibling zones inside the same parent BA. Fix: put the three z-components on screen next to every score so nobody has to recompute them to find this out.

**We concede:** In 7 of the top 9, relative demand growth dominates, and the number-two name is 95% growth. The hour-separation is not what produces most of the top of the ranking. Where it genuinely carries the project is the PJM overnight generation finding, which is not a ranking at all.

*Evidence:* `server/static_export/regions.json, recomputed robust z (median/MAD x 1.4826) over all 111 regions; scripts/l3_detector.py:114-131 for the peer-group definition`

### `FATAL` What is the trade? Long or short, which instrument, what horizon, what sizes it, and what makes you get out. You have handed me a ranking and a ticker. That is a screen, not a position, and a screen with no sign can never be wrong, which is also why nobody pays for it.

We did not build a trade and we will not invent one standing here. There is no direction, no holding period, no rebalance rule, no capacity estimate and no exit anywhere in the repo, alpha.json says 'an input to a trade, not a trade' and then stops, which is exactly the criticism. The one directional statement we would actually defend is physical, not equity: in PJM, overnight clean generation moved 35,700 to 35,619 MW between 2019 and 2025 while overnight generation rose 8,701 MW and overnight gas rose 10.74 GW. That is a falsifiable statement about regional overnight gas burn that the next data release can score. Turning it into a position needs a price series we never touched.

**We concede:** Complete. An unsigned, unhorizoned output is unfalsifiable and therefore unallocatable. This is a data product with an audit trail, not an alpha, and we should call it that rather than let 'Generating Alpha' imply otherwise.

*Evidence:* `server/static_export/alpha.json frame + no_prediction; web/public/api/region/PJM.json cf_avg_mw / total_avg_mw / fuel_delta_overnight_gw`

### `FATAL` Move your end date by eight months and San Diego goes from tenth to seventy-ninth, score 3.72 to minus 0.77. Sempra is the ticker in that chain. Salt River drops thirteen to fifty-six. Five of your top twenty turn over. How do you run money off a ranking where a top-ten name falls below the median on the next data release?

Your three numbers are exactly right off the region files, and so is 'five of the top twenty.' But the churn starts at rank 10, not at the top: ranks 1 through 9 in the 2025 window map to 2, 1, 5, 4, 3, 6, 8, 7 and 9 in the Jan–Aug 2026 window, so the maximum move inside the top nine is three places, and PJM sits at 52 in both. Max move over all 110 comparable regions is 69, and it is San Diego. The real problem you are pointing at is the middle: 53 of 111 regions have an absolute score under 1.0 against a score MAD of 1.54, so roughly half the list is not an ordering. Fix before demo: cut the displayed ranking where the scores separate, or band it, and show both windows side by side instead of burying the second one in the region files.

**We concede:** We shipped both rankings and never looked at the diff, which is how you found it before we did. Half the list is noise dressed as ordering, and with no turnover budget or rebalance rule that churn would eat any edge in costs.

*Evidence:* `web/public/api/region/*.json detection.rank vs detection.rank_2026_jan_aug (110 regions carry both; WACM does not); score median 0.33, MAD 1.04 raw / 1.54 scaled`

### `FATAL` Datacenter load is the single most covered story in the utility sector. Vistra, Constellation, Talen and Dominion have traded on it for two years and every one of them discloses its datacenter pipeline in megawatts on an earnings call. EIA-930 is free, public and published with a two-hour lag. What is in your 4.45 million rows that the sell side does not already have from the companies themselves?

The input is free and you are right that the transformation is cheap to replicate once described. Two things are not in a company pipeline disclosure. First, the supply side at hour resolution: nobody publishes that the US added 61.4 GW of clean power to the average daytime hour and 14.3 GW to the average overnight hour since 2019, or that PJM's overnight clean output is flat within 81 MW across six years. Second, the claim-to-meter join, 134 sites hand-mapped to a serving utility, 107 resolved, which is what turns a sustainability PDF into a grid. And your ticker point lands: Vistra appears in 4 of our 8 chains, AEP and Sempra in 3 each. Those are consensus.

**We concede:** The ranking is a z-score of six-year demand growth on free data, and its equity output is the most crowded names in the AI-power trade. The presentation edge decays the moment the method is on a Devpost page. The non-consensus output is the opposite of a trade: 42 of the 107 resolved sites are served by public power with no listed equity.

*Evidence:* `server/static_export/regions.json meta.national.cf_avg_mw; web/public/api/region/PJM.json; server/static_export/facilities.json count/resolved_count/no_listed_equity_count; alpha.json chains ticker frequency`

### `SERIOUS` Your number-four region added two hundred and eighteen megawatts in six years. Number ten added seventy-four. That is a rounding error on a single campus, not a buildout. Meanwhile PJM added nearly five gigawatts and ranks fifty-second. Why is a signal about capital formation denominated in percentages?

All four figures check out: Tucson rank 4 is 1,435 to 1,653 MW, San Diego rank 10 is 2,095 to 2,169, PJM rank 52 is 91,353 to 96,251, plus 4,898, and Spearman between score rank and MW-added rank is 0.528 over 110 regions. That is by design and it is the right design for the question we asked, which is 'which grid is being strained', where 218 MW on a 1.4 GW system is enormous. It is the wrong denomination for 'where does capex land', which is your question. On the PJM follow-up: rank 52 is consistent, not contradictory, PJM at 96 GW growing 5.4% is unremarkable at BA scale, the finding is inside it, at DOM rank 6 with plus 3,714 MW, and in a fuel mix the detector never scores. Fix: ship an absolute-MW column beside the score so both orderings are visible.

**We concede:** A 500 MW floor plus a percentage score systematically promotes small regions and buries the large ones, and nothing in the ordering maps to rate base, capex or revenue. We never computed the MW-ranked view until you asked.

*Evidence:* `web/public/api/region/{TEPC,CISO%2FSDGE,PJM,PJM%2FDOM}.json detection.avg_mw_2019/avg_mw_2025; Spearman computed over all 110 regions carrying both fields`

### `SERIOUS` Regulated utilities earn an authorized return on approved capital. More load means more capex, more rate base, more earnings. So when you flag Dominion, is that bullish or bearish, and does your score know the difference between a utility that gets its capex approved and one that does not?

It does not know the difference, and there is no version of the pipeline where it could, there is no ROE, no cost, no capital structure, no cost-allocation or large-load tariff input anywhere in scripts/ or engine/. The transmission channel from a metered megawatt to a price runs entirely through a regulatory outcome we do not observe. So the honest reading is conditional: the same measurement is bullish for a merchant generator, roughly bullish for a regulated utility with a supportive commission, and bearish only under disallowance or ratepayer backlash. We stop at the physical input on purpose, and we would rather concede the investment case than fake a regulatory model over a weekend.

**We concede:** This concedes the investment case. Spec section 0 frames the siting score as 'a capex question' and there is no capex anywhere in the pipeline, that framing overreaches what we built and should be softened.

*Evidence:* `scripts/l4_supply.py and scripts/l3_detector.py inputs (demand, generation, interchange only); docs/spec.md §0; no financial series in the repo`

### `SERIOUS` Walk me through the investable residue of your top nine. Three of them are the same Texas grid counted three times, Phoenix is a reporting artefact you caught yourself, the Rockies one you have flagged as unexplained, and Omaha and South Carolina are public power with no stock. What is left besides Dominion?

Almost all of that stands. One correction: the two ERCOT zones are not the same megawatts as the BA, North and Far West averaged 998 and 3,522 MW in 2019 against ERCOT's 43,798, so together about 10% of the parent, rising to 17% by 2025. They are distinct subsets that happen to sit inside a parent we also rank. Everything else is yours: AZPS is our own admitted double-count, shipped with a corrections overlay; WACM is flagged 'not explained by the data' and excluded from our alerts; OPPD and South Carolina have no listed equity; Tucson is Fortis on plus 218 MW. That leaves Dominion, the most-covered name in the sector, plus the parents in the ERCOT chains. Effective listed-equity breadth of the top nine is two or three names.

**We concede:** Yes, the breadth is two to three, not 111. Breadth that thin means no t-statistic can ever exist, so as an equity signal this is permanently unprovable no matter whether it is right. One factual repair to our own docs: CLAUDE.md line 105 still calls TXNM and FTS unverified, but alpha.json now carries both as verified with SEC and company source URLs.

*Evidence:* `web/public/api/region/{ERCO,ERCO%2FNRTH,ERCO%2FFWES}.json detection.avg_mw_*; regions.json meta.data_flags.WACM; corrections block; alpha.json verification_status; CLAUDE.md:105`

### `SERIOUS` You call the monthly run an early-warning system. Not one of your fourteen alerts first fired after December 2024, and your top alert has been continuously on for fifty-two months. Your latest data month is August 2026. What is the event I am supposed to act on?

Nothing. You are reading it correctly and the file agrees: 14 alerts, latest month 2026-08, and the most recent first-crossing in the whole set is PJM/DOM at 2024-12, twenty months of no new crossings. Far West first crossed 2022-05 and CPLW 2020-02, which is 79 months on. Five of the fourteen carry rule 'detector_top10' with a null first_crossed, meaning they restate the static ranking rather than report an event. These are state flags, not events, and the DEVPOST line calling the monthly run an early-warning system describes work we have not done. Fix before demo: split the screen into 'standing conditions' and 'new this month', and let the new-this-month count read zero. A zero that is honest is a better demo than fourteen rows that are not.

**We concede:** 'Early-warning system' is not supported by anything shipped. The alerts screen currently has no event content at all, and the same DEVPOST section that makes the claim also says everything here is retrospective.

*Evidence:* `server/static_export/alerts.json, count 14, latest_month 2026-08, first_crossed per alert; docs/DEVPOST.md:255-258`

### `SERIOUS` Your national headline, that the US added four times more clean power to the average daytime hour than to the average overnight hour, is a sum over whatever balancing authorities happened to report in each year. Your own code computes the reporting count and then drops it. What is n_bas in 2019 versus 2025, and how much of the four-point-three-x is just more reporters?

I cannot give you the two counts. You are right that l2_temporal.py line 45 computes n_bas and line 70 keeps it only conditionally, and grep confirms it reaches no export, no API and no screen, so the diagnostic that would close this was calculated and discarded, and the raw data is not on this machine to recompute it right now. What I can give you is the panel-free version of the same finding: inside PJM alone, one reporter across the whole window, overnight clean generation went 35,700 to 35,619 MW while daytime clean went 37,094 to 42,619. Same BA, same meter, plus 5.5 GW to the day and minus 0.08 GW to the night. The national 61.4 versus 14.3 GW is the composition-sensitive framing; PJM is not. Fix: print n_bas by year on the methods page before anyone else asks.

**We concede:** The national MW difference-of-differences is the quantity most exposed to panel composition, and we cannot currently size that exposure. Until n_bas ships, the headline should lead with the shares (0.405 to 0.397 overnight, 0.372 to 0.465 daytime) and with PJM, not with the 4.3x.

*Evidence:* `scripts/l2_temporal.py:45,70; grep -rn 'n_bas' scripts/ server/ engine/ web/src docs/, no hits outside l2_temporal.py; regions.json meta.national; web/public/api/region/PJM.json`

### `AWKWARD` Your limits box says five of twelve sites have no listed equity. The block directly below it in the same file says seven of seventeen. Your spec says five of seventeen. Three numbers for one fact, and it is in the honesty disclosure. What else on that page did nobody reconcile?

You are right that it is inconsistent, and in the current build it is worse than you found. The computed number is 42 of 107 resolved sites out of 134 total, with 27 unresolved, that comes straight from facilities.json and alpha.json's no_listed_equity block. But alpha.json's limits[1] still reads '12 sites, 5 public power' and docs/spec.md line 536 still reads '5 of the 17'. Those are hardcoded prose left behind when the facility corpus grew from 17 sites to 134; the computed field moved and the sentences did not. The correct figure is 42 of 107. It is a five-minute fix and it is going in before the demo, because sitting in the limitations box is the worst possible place for it.

**We concede:** Two stale hardcoded strings in the honesty disclosure, off by a factor of eight, and nobody caught them because the number beside them is generated. Any prose figure that duplicates a computed field is a future version of this bug, those should be templated from the data, not typed.

*Evidence:* `server/static_export/facilities.json (count 134, resolved_count 107, no_listed_equity_count 42, unresolved_utility_count 27); server/static_export/alpha.json limits[1] vs no_listed_equity; docs/spec.md:536`

### `AWKWARD` Look at the instruments themselves. TXNM in your Far West chain is being bought by Blackstone for sixty-one twenty-five in cash, that stock trades on a regulatory calendar, not on load growth. The most on-point market for your headline, PJM West power, has zero open contracts. And your datacenter-count markets quote two bid at ninety-eight offer. Where exactly does this get expressed?

Two of three land and we put all three in the file ourselves. TXNM carries a pending_change note saying Blackstone at $61.25, PUCT and FERC approved, New Mexico PRC and NRC outstanding, termination extended to 2027-05-31, a merger-arb name, not a load-growth expression, and it should be pulled from the demo chain or shown with that banner on screen. KXUTILITYPJMWEST and KXERCOTX are in series_with_no_open_contracts, so yes, the most on-point market is dead. The quote claim is only true of one series: KXUSADATACENTERS is 2 bid at 98, but KXDATACENTCON quotes 21 at 33 and 15 at 47, Henry Hub daily 9 at 35, the ratepayer-law market 8 at 15. Those are wide, not absent.

**We concede:** The utility-to-ticker map is a service-territory lookup, not an exposure model, Oncor inside Sempra, AEP Texas inside AEP, UNS inside Fortis are each a fraction of the parent, and we label it hand-mapped rather than model it. And where the physical fact is cleanly expressible, it is already consensus; where it is uncrowded, there is nothing trading.

*Evidence:* `server/static_export/alpha.json, pending_change on TXNM, event_markets.series_with_no_open_contracts, thesis_markets quotes across KXUSADATACENTERS / KXDATACENTCON / KXNATGASD / KXRATEPAYERLAW`


---

## Product & usefulness

### `FATAL` Your whole demo rests on one sentence: PJM overnight generation rose 8.7 GW, clean stayed flat, exports fell. So run the arithmetic with me. PJM overnight demand went 80,643 to 87,203, that's 6,560 MW. Generation went 82,539 to 91,240, 8,701 MW. And you say net exports FELL 1,325 MW. Where did 3,466 megawatts go? You generated 2.1 GW more than your own demand grew and exported less. That doesn't close.

You are right and I have the residual in front of me: gen minus demand minus export is −1,918 MW in 2019 and +1,548 MW in 2025, a 3,466 MW swing. It does not close because the 8.7 GW comes from the by-fuel table and demand and interchange come from the operations table, and the 7 MW residual we cite is computed entirely inside the operations table, so it vouches for the export figures and not for the fuel sum. The internally consistent number is smaller: demand +6,560 minus the 1,325 MW export fall means PJM's own overnight generation rose 5,235 MW, not 8,701. What survives is the load-bearing claim, overnight clean went 35,700 to 35,619 MW, down 81 MW, measured in the same table in both years, so the table-basis shift cannot manufacture it. Before we demo we should lead with 5.2 GW, say the 8.7 is the fuel-table figure, and stop quoting the +10.74 GW gas number to three significant figures because it carries the same 3.5 GW of basis uncertainty. Why the two tables disagree by that much we have not established.

**We concede:** The headline does not balance. The 7 MW residual proves nothing about the published 8.7 GW, the residual swing is 3,466 MW and systematic, and up to ~3.5 GW of the +10.74 GW gas delta could be table basis rather than physics. The correct overnight generation growth to quote is 5,235 MW.

*Evidence:* `server/static_export/region/PJM.json total_avg_mw / demand / interchange; scripts/l2_interchange.py lines 42-45 use ops.net_generation_adjusted_mwh; scripts/build_wide.py reads core_eia930__hourly_net_generation_by_energy_source`

### `FATAL` You call the siting score 'the actionable output.' Fine, I'm choosing between 300 MW in Loudoun County and 300 MW in Columbus, Ohio. What does your product tell me? Because PJM/DOM and PJM/AEP both return siting_score 0.436, siting_rank 34, headroom 0.408, identical to nine decimal places, along with all eighteen other PJM zones. Your score has 38 distinct values for 111 regions.

Confirmed, and it is structural, not a rounding artefact: scripts/l4_supply.py siting() indexes on ba and pulls demand from l3 filtered to zone.isna(), so it never sees zone demand at all, 20 PJM rows at 0.436, 14 SPP rows at 0.737, 9 ERCOT rows at 0.603, 35 distinct scores across 111 regions. On siting the tool genuinely cannot separate Loudoun from Columbus, because at RTO resolution the generation really is the same fleet. What does separate them is the detector block, which /api/site returns for every candidate: Loudoun is rank 6 with overnight demand up 39.5%, 10,060 to 14,033 MW, and Columbus is rank 19 at +12.6%, 12,954 to 14,585. So the honest pitch is 'which of these is already absorbing flat load,' not 'which grid is cleaner.' And the fix is embarrassing in its size, we have zone demand in l3 and the headroom term should use it; we should say 'BA-resolution' on the label rather than let a rank imply otherwise.

**We concede:** The siting score is BA-level with zones inheriting it, so every headroom, level, direction and rank component is the parent's. '#1 Omaha 0.737' is the Southwest Power Pool's number, shared with OKGE, GRDA, NPPD and SPS. We have the zone demand to do better and did not use it.

*Evidence:* `scripts/l4_supply.py siting() lines 58-88; server/static_export/regions.json siting blocks; server/data.py METRO_TO_REGION maps loudoun->PJM/DOM, columbus->PJM/AEP`

### `FATAL` You ship the AZPS correction as a badge of honesty, published 0.620, corrected 0.017, 3,338 MW of phantom overnight clean in 2019. Did you push that correction into your national headline? Because meta.national is a straight sum across BAs, AZPS included, and if I back it out your national overnight decline goes from 0.405→0.397 to about 0.401→0.397, and your '4.3x more clean power to daytime than overnight' becomes roughly 3.7x.

I ran your back-out and you are slightly more right than you said: correcting AZPS 2019 overnight from 3,373 to 34.7 MW takes national overnight from 0.4055 to 0.4004, so the series reads 0.400 to 0.397, and the ratio goes from 4.28x to 3.66x. l2_temporal.national() is a plain groupby-sum with no overlay, so the correction never reaches it. The 3.7x survives and is still the finding, daytime clean rose 64,738 MW against overnight's 17,687, but the 'share fell 0.8 points' line does not, because corrected it is 0.3 points and that is inside noise. We should cut the national share-decline sentence from the pitch and say 3.7x. In fairness to us, /api/site does apply the overlay, because ranking Phoenix on numbers we had proven wrong on the same screen was intolerable, we just never applied it to the roll-up, and the audit check compares the JSON to our claim rather than to our own correction, which makes it a tautology.

**We concede:** The correction we are proudest of is not in the front-page number. Corrected, the national overnight share decline shrinks from 0.008 to 0.003 and the headline multiple drops from 4.3x to 3.7x. The audit stamp 'VERIFIED' on 0.405→0.397 only checks the JSON matches the claim, not that the claim survives our own proven correction.

*Evidence:* `scripts/l2_temporal.py national() lines 43-52; server/static_export/regions.json meta.national + corrections.regions.AZPS; engine/diagnostics/numbers_audit.py lines 83-93; server/app.py post_site lines 136-150`

### `FATAL` Walk me through what stops the ask layer making up a number. Because reading server/ai.py, the grounding index only gates the second call, the rendered table. The prose is returned raw: `return {"answer": m.content or "", ...}`. If I type 'what's Palo Verde's capacity factor?' the model has no tool for it, tool_choice is 'auto' so it calls nothing, and you hand me a confident paragraph from pretraining in Wattson's voice with zero verification. What's the guard?

Today the guard is the tool trace, not a filter, ask() returns tools_used and the palette renders it, so a zero-tool answer is visible as zero tools, but nothing stops the paragraph rendering. You are also right that the table gate is weaker than it reads: _grounded uses a 2% relative tolerance across five scale multipliers against every number in a 24 KB tool dump, and _coerce_view only drops the view when 100% of the figures are unverified, so one real number out of six passes it. This is the one thing on the list I would fix tonight rather than answer: if trace is empty, replace the prose with 'no tool returned data for that, Wattson answers from the published tables only.' That is about four lines in ask(). Until it ships we do not take open-ended questions from the floor on the live layer; every rehearsed Cmd-K question hits a tool.

**We concede:** There is no guard on the prose. The docstring says so, 'The prose is always returned', and the prose is the product. The grounding index is a resemblance check across five scales at 2% tolerance, not a provenance proof, and it never touches the paragraph. One hallucinated figure on stage would cost us the thesis.

*Evidence:* `server/ai.py line 587 return {"answer": m.content or "", ...}; tool_choice="auto" line 581; SCALES/GROUND_TOL lines 395-396; _coerce_view line 517 `if figures and len(unverified) == len(figures)``

### `SERIOUS` Your deployed URL is a static GitHub Pages build pointed at a Fly machine with min_machines_running = 0 on a 256 MB shared CPU, and askAvailable() gives that machine 2,500 milliseconds to answer before it hides the AI from the UI. A judge opens your link cold after the demo. Does the ask layer exist?

Probably not on that first load, and worse than you said: askAvailable caches _status at module scope, so one cold miss hides the AI for the rest of that page session until the judge reloads. The rest is accurate too, post_ask has no try/except around ask_layer.ask so a 429 is an unhandled 500, the client waits 90 seconds, MAX_TURNS is 5, and app.py sets allow_origins=['*'] with no auth or rate limit on an endpoint whose base URL is in the public bundle. What survives is that the site is a static export and every screen, number, chart and correction renders with the API dead, ask.js line 1 says the layer is an enhancement, never a dependency, and that is enforced, not aspirational. Fixes before we hand out the link: min_machines_running = 1 for the judging window, raise the status timeout to about 8 seconds, and warm the machine. Separately, the wattson-mgr worktree is mid-merge right now with unresolved conflict markers in eight web/src files including CommandPalette.jsx, that has to be resolved before anything is built.

**We concede:** Four real failure modes and we have mitigated none of them in config. The module-level status cache makes the cold-start failure sticky for the whole session, not just the first second. The endpoint is unauthenticated and unthrottled with the key we need for the demo behind it.

*Evidence:* `fly.toml min_machines_running=0, shared-cpu-1x/256mb; web/src/lib/ask.js AbortSignal.timeout(2500) and module-level _status cache, post() 90_000; server/app.py line 19 allow_origins=["*"], post_ask lines 459-480 no try/except; `git status` shows UU on web/src/CommandPalette.jsx and 7 other files`

### `SERIOUS` You built a greenwashing investigation. How many companies did you find greenwashing? Because I count nine `true_on_paper` and one `cannot_verify` across ten claims, zero `contradicted`, and twelve of your sixteen company records have no claims at all, just a walk score. What is the Vantage card, with talk_score null and walk_score 1.0, actually telling me?

Your verdict count is right, the company count is stale: the current file is 52 companies, 4 with claims, 10 claims, 9 true_on_paper, 1 cannot_verify, 0 contradicted, and Vantage reads talk null, walk 0.556, 4 sites, coverage_status 'sites_only' with a written reason. The finding was never going to be a verdict, because an annual market-based claim is true under the GHG Protocol and we will not say otherwise. The finding is the gap inside the companies' own documents: Google claims 'matched 100%' on page 4 of its 2026 report and discloses 65% hourly CFE on page 94 of the same PDF, and Microsoft says 'matched 100%' on page 6 while disclosing Scope 2 rising from nearly 2% to 13% of total emissions on that same page. Those are recorded as internal_contradiction evidence with page numbers, and that is the deliverable. Where I concede is the taxonomy: 'contradicted' is structurally unreachable for a market-based claim, so we should either say that out loud or retire the verdict rather than leave a slot that has never fired.

**We concede:** Zero contradicted verdicts, and the verdict cannot fire given our own honesty rule, that is dead taxonomy. 48 of 52 cards are a grid lookup with a coverage note and no claim. The deliverable is a documented internal inconsistency, not a caught lie, and we should say that in the first sentence rather than let the word 'greenwashing' do work the data does not support.

*Evidence:* `claims/companies.json: 52 records, 10 claims, verdicts {true_on_paper:9, cannot_verify:1}; GOOGL-2026-001 internal_contradiction page 94 (65/64/64/66/65); MSFT-2026-002 page 6; server/static_export/companies.json count_with_claims=4, count_sites_only=48`

### `SERIOUS` Show me an alert that fired this month. Your alerts file: latest_month is 2026-08, it's September 20th, and the most recent first_crossed anywhere in the list is 2024-12. The top one has a 52-month streak. Five of the fourteen are `detector_top10`, which is just 'this region is still in a frozen ranking.' What is the monitoring product here?

There isn't one, and I'd rather say that than defend it. Verified: 14 alerts, count_before_ranking also 14 so the ranking filtered nothing, latest first_crossed 2024-12, and 5 of 14 are detector_top10, 36%, which is the ranking relabelled, exactly what our own spec section 7 already confesses. EIA-930 through PUDL refreshes monthly at best and every rule here measures a multi-year trend, so there is no state change to react to on a Tuesday. What the list actually is, is a persistence register: ERCO Far West has been at least 20% above its 2019 overnight baseline for 52 consecutive months, and the point is that it never cleared. Before demo we should drop detector_top10 from the file entirely and stop calling the screen Alerts.

**We concede:** Nothing in the list is new, nothing clears, the ranking filtered nothing, and a third of it is the detector wearing a different label. This is not a monitoring product and we should not present it as one.

*Evidence:* `server/static_export/alerts.json: count 14, count_before_ranking 14, latest_month 2026-08, rules Counter({detector_top10:5, demand_up_20pct:4, demand_record_high:2, cf_share_down_3pts:2, clean_mw_below_2019:1}), max first_crossed 2024-12`

### `SERIOUS` On your Compare screen, Columbus shows 'gas filled your growth: 10.74 GW.' Open Northern Virginia and it says 10.74 GW too. That's PJM's number, attributed in full to every one of twenty zones simultaneously. If I'm siting load, you've just told me the same 10.74 GW of gas is my fault in twenty different places.

Correct, and we caught it ourselves, engine/diagnostics/numbers_audit.py has a check named for this exact number and it returns CORRECTED, not VERIFIED, with the fix text written out. The figure is PJM's whole-footprint overnight gas delta inherited by all 20 zones, byte-identical on PJM, PJM/DOM and PJM/AEP. Dominion's own overnight demand grew 3,973 MW, from 10,060 to 14,033, which is 61% of PJM's 6,560 MW overnight demand growth, that is the number that belongs to the site. Where you have us is the display: we chip the inheritance on the clean share and not on the fuel delta, and the fuel delta in absolute gigawatts is the much stronger claim. Relabelling that card 'PJM-wide' is a demo-blocker-level fix and it should go in tonight.

**We concede:** A per-site consequence in absolute GW is presented for a number that is the whole RTO's, in twenty places at once, and the same is true of the 6.62 GW on the Dallas card. Our disclosure is inconsistent: inheritance is chipped on the share and not on the fuel delta.

*Evidence:* `server/static_export/region/PJM.json and PJM%2FDOM.json fuel_delta_overnight_gw.gas = 10.74 in both; engine/diagnostics/numbers_audit.py lines 118-133 status CORRECTED; PJM/DOM demand overnight 10,060 (2019) -> 14,033 (2025)`

### `SERIOUS` What are the units on your talk-vs-walk chart? talk_score is 'magnitude x specificity x scope_breadth', a rhetoric score. walk_score is a carbon-free generation share. You're plotting them on one axis and calling the difference a gap. And Meta walks 0.603 against talk 0.55, Microsoft 0.642 against 0.55, two of your four companies score better than they talk. What is the chart showing?

They are different quantities on one axis and I won't defend the arithmetic of subtracting them. Current numbers are Meta 0.55 talk against 0.463 walk, Microsoft 0.55 against 0.458, Google 0.405 against 0.464, Amazon talk null, so two of the three go the intended way and Google is inverted, for precisely the reason you gave: 'annual' and 'market-based' cut scope_breadth, so the loudest claim in the corpus scores lowest on talk and shows the smallest gap. The metric rewards the hedging it exists to expose. The defensible comparison is already on the claim record and needs no new scoring: Google's own 100% on page 4, against Google's own hourly 65% on page 94, against the physical range across its 10 mapped sites, 0.056 to 0.913, mean 0.464. We should show that triplet and drop the scatter.

**We concede:** The two scores are dimensionally incomparable and the gap is not a quantity. The scoring is inverted against our own thesis, hedging lowers talk and shrinks the apparent gap. Your Meta and Microsoft figures are from an older build, but the structural criticism holds at the current numbers too.

*Evidence:* `engine/verify/__main__.py lines 299-306 talk_score_method and walk_score_method; claims/companies.json talk/walk per ticker; GOOGL-2026-001 physical_min 0.056 / physical_max 0.913 / physical_mean_unweighted 0.464`

### `SERIOUS` Concretely: a datacenter operator reads your report on Tuesday morning. What do they change by Friday? Not 'they'd be more transparent', what decision flips? Because the siting tool can't distinguish their candidate county from the rest of the RTO, the detector tells them what they already know about their own load, and the claim verdict says their disclosure is true.

It does not flip a county-level siting decision and I will not claim it does, the siting score is BA-resolution and I have already conceded that. The decision it flips is procurement, and it is specific: a company publishing an annual matched claim can see, per mapped site, the overnight carbon-free share of the grid that site physically draws from, and the spread across its own fleet. Google's runs from 0.056 at Berkeley County to 0.913 at The Dalles, against a single company-wide 100%. That tells a procurement team which site the next hourly-matched contract goes behind, and that is a Friday decision made on a number the annual claim structurally hides. What I concede is the AI half: there are ten tools and no siting tool among them, siting appears only as a sort key on rank_regions with 20-way ties, so 'where should I put 300 MW' cannot be asked of the ask layer and we should not demo that question.

**We concede:** There is no county-resolution siting answer and the flagship 'where do I put 300 MW' question is not askable of the AI layer at all. The honest use case is per-site procurement prioritisation and disclosure quality, not site selection, and the product should be pitched that way rather than as a siting tool.

*Evidence:* `claims/companies.json GOOGL sites 0.056 (SC) .. 0.913 (BPAT), physical_mean_unweighted 0.464 against claim magnitude 1.0; server/ai.py TOOLS = rank_regions, region, compare_regions, national, company, companies, alerts, facilities, irradiance, search_corpus`

### `AWKWARD` Google's walk score is 0.056, built from exactly one mapped site, Moncks Corner. Google runs on the order of two dozen US datacenters. You've scored a company's entire fleet on one building, and it happens to be the one on the dirtiest cooperative grid in your set. How is that not cherry-picking, even accidentally?

That premise is a build behind: Google now has 10 mapped sites, coverage 1.0, and walk 0.464. The 0.056 is the single worst site, Berkeley County served by Berkeley Electric Cooperative, and it is carried on the claim record as physical_min next to physical_max 0.913 at Northern Wasco County PUD in BPAT, so the spread is the output, not the minimum. What is still true is that 10 sites is partial against Google's real US fleet and the mean is unweighted by site size, which the file states in its own notes; one large site could move it materially. So the label has to travel with the number, '10 mapped sites, unweighted' next to 0.464, not in a footnote. One thing we should fix: numbers_audit.py still hardcodes 'Google walk 0.056' as the expected string and stamps VERIFIED unconditionally, so that check currently verifies nothing.

**We concede:** Coverage is still partial and hand-curated, the mean is unweighted by site size, and the partial-coverage label is not rendered next to the number. And our own audit check on this exact figure is a no-op that always passes.

*Evidence:* `claims/companies.json GOOGL n_sites 10, coverage 1.0, walk_score 0.464, site shares 0.056 (SC) to 0.913 (BPAT); notes include 'unweighted across sites'; engine/diagnostics/numbers_audit.py lines 196-215 pass VERIFIED with no comparison`

### `AWKWARD` Who is number one on your siting leaderboard? I sorted your 111 regions and the best rank present is 3. There is no #1 and no #2, and only 38 of the 52 ranks have anything carrying them. What happened to the top of your own ranking?

They exist and they are both absurd, which is the actual answer. The siting rank is computed over 52 balancing authorities, n_ranked reads 52 in every region file, while regions.json serves 111 regions across only 43 BAs. Ranks 1 and 2 are Southwestern Power Administration at 0.962 and Imperial Irrigation District at 0.923, both dropped from the 111 because they fall under the detector's 500 MW demand cut. SPA's entire overnight demand is 21 megawatts; you cannot put 300 MW there, and IID is 336 MW. So the ranking population and the served population are two different sets, which is a real bug: apply the same 500 MW cut to the siting rank, recompute, and BPAT becomes a contiguous #1 at 0.827.

**We concede:** Two ranking populations, and the leaderboard the user sees starts at 3 because of it. The ranks were assigned over 52 BAs and never recomputed against the 43 we serve.

*Evidence:* `server/static_export/region/SPA.json siting_rank 1 score 0.962 overnight demand 21 MW; IID.json rank 2 score 0.923, 336 MW; n_ranked 52 in every region file vs 43 BA rows and 111 regions in regions.json; scripts/l3_detector.py MIN_MW = 500`
