# Wattson — demo film narration

The readable copy of `web/src/demo/film.js`: same shot ids, same order, same words, plus what is
on screen and the source of every figure spoken.

> **This path is also written by `web/scripts/narrate.mjs`.** That script regenerates
> `docs/narration.md` from `film.js` on every run and will overwrite this file. The reading copy it
> produces stays correct, because it reads the same `say` lines; what is lost is the sourcing and
> the correction notes below. If you run narrate before the take, restore this file afterwards, or
> move the sourcing annex to a filename narrate does not own.

## Timing — read this before you cut anything

- **Narration: 377 words over 18 shots = 174.7 s**, at `words / 2.3 + 0.6 s` per shot.
- **Running time is NOT that.** A shot's hold is `max(holdMs, narration + 600 ms − time already
  spent on its actions)`, so actions are absorbed into the narration — but route changes, the
  caption fade and the 400 ms inter-shot gap sit *outside* it, and two shots have work no narration
  covers at all.
- Measured against Film.jsx's constants that overhead is **about 37 s**: ~12 s waiting on the live
  model call in `ask`, ~4 s of typing in `type`, 2.6 s of title card, and 0.6–1.5 s per shot of
  veil, caption-out and gap.
- **Realistic running time: about 210 s (3:30)**, against a 2:30 target.
- Levers, in order: **pre-warm the ask answer** in the recording browser before starting the film
  (visit the `#/ask?q=…` URL once so the store is populated — saves ~12 s), then cut words from
  `jupiter`, `askhow` and `detector`. Never raise `holdMs`.

## Recording conditions

- **1440x900.** The expect check requires each element to be inside the viewport; on a short
  viewport `.ans-gap`, `.wx-stepbody`, `.fd-scene .note`, the site tables and `.ans-figs` all fall
  below the fold and their shots fail for that reason alone.
- **`VITE_API_BASE=https://wattson-api-ivory-seastar-408.fly.dev`.** Without it the two ask shots
  render "running without the ask layer" and fail.
- **Foreground, visible tab.** The `night` slide's big numbers are a `requestAnimationFrame`
  ticker. In a hidden or throttled tab rAF never runs, the values stay at 37.2 / 40.5 while the
  labels already read 2025, and the slide is wrong on screen. The `46.5%` / `39.7%` expect exists
  to catch exactly that.

## Hard rules held throughout

Never "caused by" — always "consistent with". Never "they lied" — the verdict is "true on paper,
X physically". No share stated as falling without the absolute in the same breath. "Balancing
authority" is glossed as "the grid operator" the first time (shot 3). Every superlative is scoped
to what we actually read. Reported facts are attributed as reporting, never as measurement. If a
number on screen disagrees with this page, the screen is right.

---

## PROBLEM

### 1 · `open` — 17 words · 8.0 s
**Screen.** Slide `flat`: "AI datacenters draw the same power at 3am as at noon", over a 24-hour
strip with the overnight hours marked.

> There's a greenwashing watchdog for fast fashion. For airlines. For oil majors. There isn't one
> for datacenters.

*Figures:* none. *Check:* `.film-slide.show` contains "3am".
*Note:* a slide cannot carry a custom title — Film.jsx does not pass `title` to a slide — so this
is the `flat` slide, not a card of its own.

### 2 · `night` — 21 words · 9.7 s
**Screen.** Slide `night`: 46.5% clean by day, 39.7% at night, 2025, with the 2019 ticks
(37.2% / 40.5%) on both bars.

> Since twenty nineteen America added sixty-five gigawatts of clean power to the average daytime
> hour, eighteen overnight. Nearly four times more.

*Figures:* **measured from the corrected 2019 baseline, not the published one.** The published 2019
national averages carry the Arizona nuclear double count that shot 8 is about: a phantom 3,333.8 MW
in the daytime average and 3,338.3 MW overnight (`regions.json` → `corrections.regions.AZPS`,
`cf_avg_mw.2019` published 3,736 / 3,373 against corrected 402.2 / 34.7). Corrected:
174,795 → 239,533 MW by day = **+64,738**; 155,693 → 173,380 MW overnight = **+17,687**; ratio
**3.66**. Recomputed from `web/public/api/regions.json`.
**Do not say 61.4 and 14.3.** Those are the uncorrected figures, and quoting them in a film that
also boasts about finding the error would be indefensible.
*Honesty:* the spoken figures are **megawatts added**, so the night's falling share (on screen as
40.5% → 39.7%) is never stated without its rising absolute.
*Check:* `.film-slide.show` contains "46.5%" and "39.7%".

---

## EVIDENCE

### 3 · `pjm` — 22 words · 10.2 s
**Screen.** `#/found`, step 1 of 4: **35,700 → 35,619** MW of clean power at night, 2019 then 2025.

> In PJM — the grid operator for the largest datacenter cluster on earth — clean night generation
> hasn't moved since twenty nineteen.

*Figures:* `region/PJM.json` → `cf_avg_mw.2019.overnight` / `.2025.overnight`, rendered by the
page. The gloss of "balancing authority" lands here.
*Check:* `.wx-stepfig` contains "35,700 → 35,619".

### 4 · `gas` — 22 words · 10.2 s
**Screen.** Same page, stepped twice: **+10.7 GW** gas at night, with the page's own "Consistent
with new round-the-clock load being served by gas" line.

> Overnight generation rose eight point seven gigawatts, ten point seven gas. Consistent with
> round-the-clock load served by gas, not caused by it.

*Figures:* +8.7 GW = 82,539 → 91,240 MW (`total_avg_mw`); +10.74 GW gas
(`fuel_delta_overnight_gw.gas`). Both `region/PJM.json`.
*Check:* `.wx-stepbody` contains "+10.7 GW" and "Consistent with".

---

## PRODUCT — the deck's live order: check, detector, OpenAI, ask layer

### 5 · `type` — silent · 0.6 s (plus ~4 s of typing)
**Screen.** `#/`, the cursor types **Google** into the inline palette and lands on the check.
*Check:* `.ans-sticky` contains "Alphabet (Google)".

### 6 · `google` — 21 words · 9.7 s
**Screen.** `#/check/GOOGL`: "100% claimed on paper · 6–91% on its grids", and the gap block
**says 100% / its grids 6–91% / 54 points apart, across 10 sites.**

> True on paper — genuinely true under the GHG Protocol's market-based method. Physically its ten
> sites run six to ninety-one percent.

*Figures:* rendered by the page from `company/GOOGL.json`.
*Correction to the script:* it says "six percent physically" from the old one-site record. After
the merge Google has ten mapped sites and the screen reads 6–91% / 54 points. Do not say 6% or
94 points.
*Check:* `.ans-gap` contains "100%", "6–91%", "54 points apart, across 10 sites.".

### 7 · `claims` — 21 words · 9.7 s
**Screen.** Evidence drawer open, "Same report, both numbers": the quoted sentence from p. 4
("we again matched 100% of our electricity consumption with renewable energy purchases") beside the
p. 94 hourly CFE table, each with its rendered page behind a "full page" button.

> Every claim is quoted from their own PDF with its page: page four, a hundred percent matched;
> page ninety-four, sixty-five percent.

*Figures:* `google-2026-environmental-report.pdf`, cited on screen.
*Check:* `[data-module="sbs"]` contains "p. 4", "p. 94", "65%".

### 8 · `detector` — 28 words · 12.8 s
**Screen.** `#/found?s=detector`, the year-by-year map playing; the note reads "Northern Virginia
6th, Omaha 7th, Central Ohio 19th, Dallas 91st … the miss stands", and the legend carries "data
flagged or corrected".

> Signal out of noise: one hundred eleven regions from demand alone, frozen before we looked. We
> print the Dallas miss, and the error that corrected our own headline.

*Figures:* 111 regions and the four pre-registered ranks, `regions.json` → `meta.n_scored` and
`meta.validation_named_in_advance`, rendered. The error is the AZPS/Palo Verde double count
(`regions.json` → `corrections`), which is also the baseline shot 2 measures from — that is the
point of the line: we corrected our own headline downward rather than keep the better number.
*Note:* the narration deliberately states **no hit count.** The screen says "3 landed in the top
20"; a stricter reading is two hits and two misses. Saying nothing keeps the film consistent with
whatever the screen prints.
*Check:* `.fd-scene .note` contains "Northern Virginia 6th" and "Dallas 91st".

### 9 · `method` — 22 words · 10.2 s
**Screen.** Same scene, the method paragraph: "111 regions ranked with no company list… Flat 24/7
load lifts a region's night-time floor faster than its average, and that is the only thing the
detector reads."

> Robust statistics throughout — median and absolute deviation, not mean and standard deviation,
> so a few huge regions cannot swamp the score.

*Figures:* `regions.json` → `meta.detector_method`: "robust z; 500 MW cut; p99.5 peak; frozen
before results", and the same in CLAUDE.md's frozen decisions and on the Method page. Peak is the
99.5th percentile hour because one corrupt 2019 hour in PJM/PL would otherwise define a region's
load factor.
**No model is claimed.** There is no gradient boosting, logistic regression, k-means, PCA,
scikit-learn or xgboost in the repo, so none is mentioned and it is not hedged either. The
pre-registration and the published miss are the answer on technical rigour.
*Check:* `.fd-say` contains "111 regions".

### 10 · `openai` — 20 words · 9.3 s
**Screen.** `#/check/OPENAI`: "no claim of its own read · 37% on its grids", "sites mapped 6 —
3 traced from the serving utility, 3 with none established", "claims read 0".

> We built the ask layer on OpenAI's models, so let's point it at OpenAI. Six Stargate sites,
> thirty-seven percent clean.

*Figures:* `company/OPENAI.json` → `walk_score` 0.369, 6 sites, coverage 1.0.
*Check:* `.ans-sticky` contains "OpenAI" and "37% on its grids".

### 11 · `sites` — 17 words · 8.0 s
**Screen.** The site table: Shackelford County, Santa Teresa / Doña Ana County, Milam County,
Lordstown, Port Washington, Pike County — each with its utility or "utility unknown", its grid, its
detector rank and its night-time share.

> Six sites, six grids. Three traced to a named utility; three not, and the row says so.

*Figures:* `company/OPENAI.json` → `sites`; the three named utilities are Ohio Edison, We Energies
and AEP Ohio.
*Correction to the script:* Abilene is **not** one of OpenAI's six sites and will not appear on
camera. The Texas rows are Shackelford County and Milam County.
*Check:* `[data-module="sites"] .rows` contains "Shackelford County", "AEP Ohio",
"utility unknown".

### 12 · `epe` — 17 words · 8.0 s
**Screen.** Scrolled to the Santa Teresa row — "16% · 0% at night" — with its collapsed "material
caveat" disclosure directly under it.

> El Paso Electric: thirty-four percent carbon-free at midday, one clean megawatt of six hundred
> fifty-five at night.

*Figures:* `region/EPE.json` → `cf_share.2025.daytime` = 0.341; `cf_avg_mw.2025.overnight` = 1 MW
over `total_avg_mw.2025.overnight` = 655 MW.
*Honesty:* speak the megawatts, not "0.1%", because the row rounds to **0% at night** on screen.
Do **not** call this the dirtiest grid — El Paso is lower than Arizona, and "dirtiest" appears only
in shot 14 where it is scoped to hundred-percent-renewable claimants.
*Check:* `[data-module="sites"] .site-note` contains "material caveat".

### 13 · `jupiter` — 31 words · 14.1 s
**Screen.** The caveat opens: "the source states the campus will run on a 700-900 MW gas microgrid
that explicitly does NOT connect to El Paso Electric's grid, so this load will not appear in EPE
demand", marked confidence=medium with its press source.

> And this one we cannot see. Reporting says a gas microgrid that never connects to El Paso
> Electric, so that load never reaches federal data. Ten sites are behind the meter.

*Figures:* the 700–900 MW microgrid is **reporting, not measurement** — a hand-written note on the
Santa Teresa site sourced to elpasomatters.org at medium confidence. Say "reporting says", never
"our data shows". "Ten" is the count of site notes stating behind-the-meter generation
(`docs/pitch/numbers-v2.md`); the script's "eleven" is not reproducible from the repo.
*Check:* `[data-module="sites"] .site-note .note` contains "700-900 MW gas microgrid",
"does NOT connect", "will not appear in EPE demand".

### 14 · `ask` — 22 words · 10.2 s (plus ~12 s for the live call)
**Screen.** `#/ask?q=Which company claims 100% renewable but sits on the dirtiest grid at night?`
The live answer, run three times on 2026-09-20, headlines close to *"Google sits on the lowest
overnight clean share among 100% renewable claimants"*, with the stat block **0.7% clean at night,
2025** and **14 clean MW at night**, and a link through to the South Carolina region.

> Ask which hundred-percent-renewable claimant sits on the dirtiest grid at night. Google: Moncks
> Corner, Santee Cooper, zero point seven percent clean overnight.

*Figures:* the answer's own — and they check out: `region/SC.json` → `cf_share.2025.overnight` =
0.007, `cf_avg_mw` 14 MW of `total_avg_mw` 1,906 MW.
*Scoping:* "dirtiest" is scoped to hundred-percent-renewable claimants, which is what the screen
says. It is **false globally** — El Paso Electric is at 0.1% overnight and Arizona at 10%.
*Volatility:* it is a model answer, so the wording moves. What did not move across three runs:
Google, the Santee Cooper / Moncks Corner site, `kind: "single"`, and the V.C. Summer caveat. The
expect therefore looks only for "Google".
*Correction to the brief:* the live answer names **Google**, not Microsoft, and does not mention
Goodyear, Arizona or a detector rank. Quote the screen.
*Check:* `.ask-headline` contains "Google". **Verified live** against the Fly API.

### 15 · `askhow` — 32 words · 14.5 s
**Screen.** Scrolled to the caveat list and the provenance line: *"Reported clean share excludes
V.C. Summer nuclear, so actual may be higher. / Annual 100% renewable claims are true on paper
under the GHG Protocol."* then *"Every figure here came from companies, company, region over the
published EIA-930 index. All 2 figures match numbers those tools returned."*

> An OpenAI tool-calling loop over eleven typed tools, including Elasticsearch retrieval across
> three hundred fifty-four passages from their own reports and filings — the layer Codex wrote. It
> flags its own caveat.

*Tools:* **eleven**, from the live `/api/ask/status`: alerts, companies, company,
compare_companies, compare_regions, facilities, irradiance, national, rank_regions, region,
search_corpus. Model `gpt-4.1`. Eleven is what the running service reports; `server/ai.py` in this
repo is stale at ten, and the demo runs against the service, so trust the service.

*Corpus — the unit is **passages**, not documents.* `/api/search/status` reports 354 indexed
records in `wattson-corpus-v1` (309 esg, 45 10k). Those 354 are extracted passages from **8 source
documents across 4 companies**, counted line by line in `claims/raw/*.jsonl`:

| Company | ESG report | 10-K |
|---|---|---|
| Google | 118 | 9 |
| Meta | 74 | 19 |
| Microsoft | 66 | 11 |
| Amazon | 51 | 6 |
| **Total** | **309** | **45** |

**Never say "354 filings."** It overstates the document count more than forty-fold and the first
judge who asks *which* filings will catch it. If you want the stronger framing, the honest one is
that every claim in the product traces to a page in one of those eight documents.

*Codex:* the team used Codex to implement the Elasticsearch retrieval layer. That is the one
concrete Codex contribution, and it is the only Codex claim made anywhere in the film.
*Honesty:* the sentence describes **what the layer is made of**, not what this particular answer
used. This question answers from the numeric tools; its provenance line reads "companies, company,
region" and does not include `search_corpus`. Do not say this answer stands on the corpus.
*Note:* `README.md` still says ten tools and says Elastic is not claimable. Both are stale.
*Check:* `.ask-prov` contains "over the published EIA-930 index". **Verified live.**

---

## REFUSALS

### 16 · `refuse` — 23 words · 10.6 s
**Screen.** `#/check/CRUSOE`: "no claim of its own read · 40% on its grids", "sites mapped 2 — grid
is the operator's own attribution; no serving utility established", and the "no documents ingested"
block giving the reason in full.

> We're proudest of what it refuses to say. Crusoe: no site tied to a named utility. Forty-eight of
> fifty-two have no documents read.

*Figures:* Crusoe's 2 sites, both `serving_utility: null` (`company/CRUSOE.json`); 48 of 52
operators are `sites_only` (`companies.json` → `count_sites_only`).
*Corrections to the script:* it names **Nebius**, which is wrong — both Nebius sites name a utility
(Vineland Municipal Electric Utility, Independence Power and Light); what is true of Nebius is that
neither utility has listed equity. And it says **twelve** operators have no documents read; it is
48 of 52.
*Check:* `.ans-figs` contains "no serving utility established".

### 17 · `clean` — 20 words · 9.3 s
**Screen.** `#/check/VANTAGE?evidence=1`, first row: Quincy · Grant County PUD · Grant Co. WA ·
**100% · 100% at night**.

> Vantage's Quincy, Washington site sits on a grid a hundred percent carbon-free at 3am. Columbia
> River hydro. The method distinguishes.

*Figures:* `region/GCPD.json` → `cf_share.2025.overnight` = 1.0 (991 MW of 991 MW).
*Why it is here:* without it the film sounds like a prosecutor. With it, it is an instrument.
*Check:* `[data-module="sites"] .rows` contains "Quincy", "Grant County PUD", "100% at night".

---

## CLOSE

### 18 · `end` — 21 words · 9.7 s
**Screen.** Slide `end`: the wordmark, the tagline, "Built at HackMIT 2026 on PUDL EIA-930 data".

> A claim, the grid under the site, and the hour that decides it. It follows the power, not the
> press release.

*Check:* `.film-slide.show` contains "HackMIT 2026".

---

## Every figure spoken, and where it comes from

| Figure | Shot | Source |
|---|---|---|
| +65 GW clean added to the average daytime hour since 2019 | 2 | 174,795 → 239,533 MW: `regions.json` national, minus the AZPS 2019 phantom 3,333.8 MW |
| +18 GW clean added to the average overnight hour since 2019 | 2 | 155,693 → 173,380 MW, same, minus 3,338.3 MW |
| nearly 4x (3.66) | 2 | the two above |
| PJM clean at night flat, 35,700 → 35,619 MW (on screen) | 3 | `region/PJM.json` `cf_avg_mw.*.overnight` |
| PJM overnight generation +8.7 GW | 4 | `region/PJM.json` `total_avg_mw` 82,539 → 91,240 |
| PJM overnight gas +10.7 GW | 4 | `region/PJM.json` `fuel_delta_overnight_gw.gas` = 10.74 |
| Google 100% claimed, 6–91% physically, 10 sites | 6 | `company/GOOGL.json`, rendered |
| Google report p. 4 claim, p. 94 65% hourly CFE | 7 | the PDF, cited on screen |
| 111 regions, the Dallas miss, the AZPS correction | 8 | `regions.json` `meta.n_scored`, `corrections` |
| median/MAD, 500 MW cut, p99.5 peak, frozen in advance | 9 | `regions.json` `meta.detector_method`; CLAUDE.md |
| OpenAI 37% across 6 Stargate sites | 10 | `company/OPENAI.json` `walk_score` 0.369 |
| 3 of 6 sites traced to a named utility | 11 | `company/OPENAI.json` `sites[].serving_utility` |
| El Paso Electric 34% by day, 1 MW of 655 at night | 12 | `region/EPE.json` 2025 daytime / overnight |
| Project Jupiter gas microgrid, no interconnection | 13 | press note on the Santa Teresa site, confidence=medium — **reported, not measured** |
| ~10 mapped sites behind the meter | 13 | site notes, per `numbers-v2.md` |
| Google / Santee Cooper, 0.7% clean overnight | 14 | the live answer; checks against `region/SC.json` (14 MW of 1,906 MW) |
| Eleven typed tools, gpt-4.1 | 15 | live `/api/ask/status` (the repo's `server/ai.py` is stale at ten) |
| 354 **passages** from their own reports and filings | 15 | live `/api/search/status`, index `wattson-corpus-v1`; 8 source documents, 4 companies, counted in `claims/raw/*.jsonl` (309 ESG + 45 10-K) |
| Codex wrote the Elasticsearch retrieval layer | 15 | confirmed by the team |
| Crusoe: no site tied to a named utility | 16 | `company/CRUSOE.json`, both sites null |
| 48 of 52 operators with no documents read | 16 | `companies.json` `count_sites_only` |
| Quincy 100% carbon-free at 3am | 17 | `region/GCPD.json` `cf_share.2025.overnight` = 1.0 |

## Figures deliberately not spoken

- **"354 filings"** — it is 354 *passages* from 8 documents across 4 companies. The unit has to be
  said out loud.
- **+61.4 / +14.3 GW and "four times"** — measured from the contaminated 2019 baseline. Superseded
  by +64.7 / +17.7 GW and 3.66x.
- **"Six percent physically"** for Google, and **94 points apart** — superseded by the merge.
- **Eleven behind-the-meter sites** — not reproducible from the repo; "ten" is used.
- **Twelve operators with no documents read** — it is 48.
- **Nebius has no named utility** — false; both its sites name one.
- **Abilene as a Stargate site** — not in OpenAI's six.
- **Microsoft / Goodyear / Arizona at 10% as the ask answer** — the live layer returns Google and
  Santee Cooper.
- **A hit count for the pre-registered regions** — the screen says three of four in the top 20, a
  stricter reading says two; the narration states no count.
- **Any machine-learning method** — none is in the repo, and it is not hedged.
- **The Arizona detector rank** — in the project notes but in neither verified-numbers file.
- **Ten tools** — the running service reports eleven.
- **The alpha file's "12 sites … 5 served by public power" paragraph** — stale text in the data;
  the real figures are 134 sites, 107 resolved, 42 with no listed equity, 27 unresolved. Do not
  point a camera at it.
- **Search as the thing this answer stands on** — retrieval exists and is claimable, but this
  question answers from the numeric tools; its provenance line does not list `search_corpus`.
