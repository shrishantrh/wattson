# Demo runbook

Every number here is from `claims/derived/numbers_audit.md` (21 verified, 3 corrected,
1 unverifiable) or from a file you can open on stage. **The caveat column is not
optional** — each one exists because a judge who knows the sector will ask, and saying it
first is what makes the rest credible.

Run from a local build, not a URL:
`cd web && npm run build && cd dist && python3 -m http.server 8099`

---

## 0:00 — The hook, before any screen

> "Every company building AI datacenters says it runs on clean energy. We checked against
> federal metered data. Solar cleaned up the middle of the day. It did nothing for the
> middle of the night. **And a datacenter doesn't care what time it is.**"

---

## 0:30 — The finding · `#/found`

| Say | Number | Caveat you must include |
|---|---|---|
| PJM overnight clean generation | **35,700 → 35,619 MW** | "2025 is within 100 MW of 2019." **Not** "flat since 2019" — the path runs 34,316–36,299 and 2020 sits 1,384 MW low. A judge who plots it will see the dip. |
| Total overnight generation | **+8.7 GW** | — |
| Of which gas | **+10.7 GW** (coal −2.5) | This is **PJM's** figure, not Dominion's. Every PJM zone inherits it. |
| Net exports | **3,814 → 2,489 MW** | This is the control. Without it someone says "PJM just imported less." The opposite happened. |

**The line:** *"Every added gigawatt of overnight generation in PJM since 2019 was fossil."*
Say it once, slowly, then stop.

**National, if asked:** overnight share 0.405 → 0.397 while daytime went 0.372 → 0.465.
**Always pair the share fall with the absolute rise: overnight clean output grew 159.0 →
173.4 GW.** The share alone implies clean generation shrank. It grew 14.3 GW; demand grew
faster.

---

## 1:15 — The detector, including the miss

Same screen, "Named before the ranking was seen":

```
Northern Virginia   6th of 111
Omaha               7th of 111
Central Ohio       19th of 111
Dallas             91st of 111   <- say this one out loud
```

> "Four regions named before we saw the ranking. Two landed in the top seven, one at
> nineteen, **and we missed Dallas.** Neighbor divergence compares a zone against its
> neighbors, and every ERCOT zone is booming, so a booming Dallas looks unremarkable.
> That's a property of the method. We reported it rather than retuning."

**If asked what the detector can't do:** it finds flat 24/7 load, not datacenters. It
cannot tell a datacenter from a crypto mine. That's why West Texas ranks 2nd — and it
turns out to be the point, see below.

---

## 2:00 — The product · `#/compare?mw=300&metros=Phoenix|Northern Virginia|Omaha`

Type it live if you can.

```
#1 Omaha         52% clean at night, improving
#2 Phoenix       history corrected
#3 N. Virginia   39%, getting worse
```

**The question you will be asked:** *"why is the 10% option ranked above the 39% one?"*

> "We rank on where it's going, not just where it is. Phoenix is dirtier today and
> climbing. Northern Virginia is cleaner today and falling. If you're siting load for
> fifteen years, that's the trade."

**The one-sentence method:** *"How clean the overnight grid is today, whether it's getting
cleaner, and how much clean headroom is left relative to demand. Weights fixed before any
result was seen."*

---

## 2:45 — Wattson correcting itself · `#/region/AZPS`

This is the screen that separates us from a dashboard.

> "We published that Phoenix's clean share **fell** from 62% to 10%. It's wrong. Arizona
> Public Service and Salt River Project both reported the same nuclear plant — the same
> numbers, hour by hour, for 7,976 hours, and their combined output was **1.8× the plant's
> nameplate.** Corrected, Phoenix **rose from 2% to 10%.** Wrong in direction, not
> magnitude."

Then: **"So we swept all 69 balancing authorities for the same signature. 4,430 pairs,
580,000 window comparisons. This is the only one."**

**Confidence, stated precisely:** the duplication is **proven**. That the plant is Palo
Verde is a **high-confidence inference**, not confirmed against plant-level records. Why it
happened on that date is **not established**. Don't flatten those into one tone.

**The detector rank 3 is unaffected** — it's demand-only, no generation term.

---

## 3:30 — The claims layer · `#/check/GOOGL?evidence=1`

The module reads **"Says, and discloses, in the same report."**

| Page 4 | Page 94 |
|---|---|
| "we again matched 100% of our electricity consumption with renewable energy purchases (on a global and annual basis)" | CFE across Google data centers (hourly): **65, 64, 64, 66, 65** |

> "Both numbers are Google's. The headline is annual matching — a contract. The appendix is
> hourly carbon-free energy — physics. Five years, flat. We put their own two numbers next
> to each other and say nothing else."

**And, unprompted, on page 4:** *"our AI infrastructure buildout is currently accelerating
faster than the grid is decarbonizing."*

**The cross-document pair, if you have time:** Microsoft's sustainability report says it
matched 100%; its 10-K Item 1A says AI *"has and will likely continue to raise energy use
and emissions, making it harder to meet these goals."* Neither statement is false. Only one
is written to be read by a regulator.

**CAVEAT YOU MUST SAY with Google's 6%:** Santee Cooper's jointly-owned V.C. Summer nuclear
reports under the **SCEG** balancing authority, not SC. The 6% understates the carbon-free
content actually available to that site. It's on screen; say it anyway.

**Never say a company lied.** Annual matched claims are **true** under the GHG Protocol
market-based method. The verdict is "true on paper, X physically."

---

## 4:15 — Why they should believe the index

> "Google publishes grid carbon-free share per balancing authority — the same quantity we
> compute from EIA-930, calculated independently. **We match 7 of 11 within 2 points,
> median difference −0.5.**"

Three outliers are open questions, not errors. The clearest, SC, is us reading Santee
Cooper alone while Google appears to aggregate it with SCEG — which is the coarse-region
caveat we already publish, arguing for our honesty rather than against our accuracy.

---

## 4:45 — Limits, said out loud before anyone asks

- Generation within a footprint, not consumption. Interchange is not allocated.
- Average grid mix, not marginal emissions.
- Regions are coarse. PJM spans Chicago to New Jersey.
- Zones inherit the parent BA's generation figures.
- The detector can't distinguish a datacenter from a crypto mine.
- Facility and operator mapping is hand-curated.
- Hourly data updated with each release. PUDL is a snapshot ending 2026-09-05, not live.

---

# Answers to the questions they will actually ask

**"Is Dominion's growth datacenters or population?"**
+32% average demand in six years far exceeds demographic growth, and **overnight growing
faster than average is the discriminator** — residential and EV load is peakier, not
flatter. Dominion's overnight grew 39.5%.

**"Your detector can't tell crypto from AI."**
Correct, and in West Texas that stops being a weakness. Cipher is winding down bitcoin at
Black Pearl to redirect the same power and land to AI tenants. Black Pearl is in Winkler
County, inside ERCO/FWES — **which we rank 2nd, before anyone checked who was there.** Same
sites, same substations, converted. We say where to look; we never assign a megawatt.

**"Doesn't demand response bias your detector?"**
Yes, and we measured it: correlation +0.61 between score and the load-factor term. But
every region with a confirmed curtailing miner sits **above** the median on that term.
**Demand response is economically large and temporally tiny** — Riot curtailed >95% of load
at the 2023 peak and books millions, but a few dozen hours can't move a load factor
computed over 8,760. It's a standing caveat, not a correction.

**"Which ticker do I buy?"**
Careful — **5 of the 12 sites whose serving utility we could establish are public power,
cooperatives or state authorities with no listed equity.** Cheap hydro and wind sit
disproportionately with public power, so a material share of this buildout lands where
there's no stock to trade. Name the utilities serving rising-load regions and stop. No
backtests, no price claims.

**"How do I know your numbers are right?"**
Two answers. Google's independent figures match ours 7 of 11 within 2 points. And we ran
the whole pipeline on Voloridge's hardware — Python 3.9 and pandas 2 against our Python
3.14 and pandas 3 — and every headline figure reproduced exactly.

**"What did you get wrong?"**
Best question they can ask. Eight guards, and **not one of the eight worst failures was
caught by a test.** A page audit that couldn't see reading order. A verbatim guard that
couldn't see corruption. An acceptance test that passed while breaking the page four of our
findings cite. A ranking that silently became a tautology. A duplicate sweep that missed
the pair it was built to find. Every one was caught by reading an output and asking why it
looked the way it did.

---

# Do not say

- "flat since 2019" — say "2025 is within 100 MW of 2019"
- "Dominion's gas rose 10.7 GW" — that's PJM's figure
- "a 78% gap" between alert ranks 6 and 7 — severity **falls 44%**; rank 6 is 78% *above* rank 7
- "the overlay confirms our finding across regions" — it separates in 2 of 5
- "the sun got brighter" — irradiance is flat; that flatness is the finding
- "they lied," "greenwashing," "caused by" — the phrase is "consistent with"
