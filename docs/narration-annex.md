# Wattson — demo film narration annex

**This is the canonical record of where every spoken number comes from and why each line is worded
the way it is. `docs/narration.md` is the reading copy, regenerated from `web/src/demo/film.js` by
`web/scripts/narrate.mjs` on every run — edit the `say` lines in `film.js`, never in that file, and
keep the sourcing here, where narrate cannot overwrite it.**

Every figure cites a file and a field, so it can be re-derived without asking anyone. API paths are
relative to `web/public/api/`; region files nest their payload under a top-level `region` key,
company files are flat.

## The shape of the film

The film used to be an investigation: an absence, some evidence, five findings, some refusals. A
viewer had no model of the product, so every screen was a surprise and every number an assertion.
It is now built the other way round.

**Say what it is, then walk it, then show one result.**

1. **What it is** (shots 1–3). The absence, the four-step method in plain words, and why the hour
   is the unit.
2. **Walk it** (shots 4–14). Every screen is an instance of a step the viewer already understands.
   The Google check *is* steps one to four. The evidence drawer *is* where the claim came from. The
   detector *is* the same reading with the company list taken away.
3. **One finding** (shots 10–11), **one refusal** (15), **one close** (16).

### The four steps, as spoken in shot 2

> Here's how it works. A company publishes a claim. We find the buildings it operates. Each sits on
> a grid we can name. We read what that grid generated hour by hour. Then we compare.

That is the spine. Shot 16 repeats it as a list so it closes on the same four beats it opened on.

### Written for the mouth

Short sentences, one clause each. Contractions throughout. No two consecutive sentences open with
the same construction (checked mechanically; the only survivor is the deliberate four-beat list in
shot 16). No sentence's meaning depends on a comma, because a synthetic voice will not give you
that pause — where a clause needed one, it became two sentences.

## Timing

- **Narration: 437 words over 18 shots = 200.8 s**, at `words / 2.3 + 0.6 s` per shot.
- Interaction adds about **36 s** — ~12 s on the live model call in `ask`, ~4 s of typing in `type`,
  2.6 s of title card, and 0.6–1.5 s per shot of veil, caption-out and gap, all outside the hold.
- **Realistic running time: about 3:56.**
- This is over the 150 s narration target by design. The coordinator took the length in exchange for
  keeping the clean result (`clean`) and the Stargate utility split, on the grounds that a shorter
  film that implies a company lied by omission is worse in every way. Do not cut the explanation
  (`what`), the method line (`method`), the ask-layer line (`askhow`) or the gas line (`gas`) to hit
  a number: the first two are the shape the film exists for, the third carries three sponsor claims,
  and the fourth carries the "consistent with, not caused by" phrasing the honesty rules require.

## Recording conditions

- **1440x900.** The expect check requires each element to be inside the viewport; on a short
  viewport `.ans-gap`, `.wx-stepbody`, `[data-module="sbs"]`, the site tables and `.ans-figs` all
  fall below the fold and their shots fail for that reason alone.
- **`VITE_API_BASE=https://wattson-api-ivory-seastar-408.fly.dev`.** Without it the two ask shots
  render "running without the ask layer" and fail.
- **Record in a VISIBLE, foreground window. This is not optional, and it is the single biggest
  source of false failures.** A hidden or backgrounded tab throttles both `requestAnimationFrame`
  and smooth scrolling to a standstill, and the film depends on both:
  - the `night` slide's big numbers are a rAF ticker — throttled, they stay at 37.2 / 40.5 while the
    labels already read 2025, so the slide is *wrong on screen*. The `46.5%` / `39.7%` expect
    catches exactly that;
  - Film.jsx's `scroll` action uses `scrollTo({ behavior: 'smooth' })`, which in a hidden tab is a
    complete no-op. Measured on the Google check page at 1440x900: an instant
    `column.scrollTop = 861` moves the evidence module from top 941 to top 80, while the identical
    smooth `scrollTo` leaves it at 0/941 indefinitely. Every shot that scrolls (`claims`,
    `stargate`, `clean`) therefore fails in a hidden tab and passes in a visible one.
  - **Fixed upstream.** Film.jsx's `scroll` action no longer uses smooth behaviour; it steps the
    scroll on a timer with its own easing, so it looks the same on camera and cannot stall in a
    backgrounded window. The defensive waits and second scroll pass in the shot list are kept as
    belt and braces; they cost nothing, since action time is absorbed by the narration.
- **Build the app, then regenerate the narration, in that order.** Building first and narrating
  second leaves the recorded app pacing to the previous voice's clip lengths.

## Hard rules held throughout

Never "caused by" — always "consistent with". Never "they lied" — the verdict is "true on paper,
X physically". No share stated as falling without the absolute in the same breath. "Balancing
authority" is glossed as "the grid operator" the first time (shot 10). Every superlative is scoped
to what we actually read. Reported facts are attributed as reporting, never as measurement. If a
number on screen disagrees with this page, the screen is right.

---

## Shot by shot

### 1 · `open` — slide `flat` — 14 words · 6.7 s
**Screen.** "AI datacenters draw the same power at 3am as at noon", over a 24-hour strip.
> Fast fashion has a greenwashing watchdog. Airlines have one. Datacenters don't.

*Figures:* none. *Check:* `.film-slide.show` contains "3am".

### 2 · `what` — `#/` — 35 words · 15.8 s
**Screen.** The landing globe and hero: "A greenwashing investigation of datacenter operators" /
"What's really powering it?". The caption plate carries the four steps as text.
> Here's how it works. A company publishes a claim. We find the buildings it operates. Each sits on
> a grid we can name. We read what that grid generated hour by hour. Then we compare.

*Figures:* none — this shot is the explanation, deliberately.
**Visual note:** the landing screen does not literally show buildings or grids, so this is narration
over a title screen. That is the trade for stating the method once, up front, and the caption sub
spells the four steps out in text underneath.
*Check:* `.hero-q` contains "What's really powering it?".

### 3 · `why` — slide `night` — 25 words · 11.5 s
**Screen.** 46.5% clean by day, 39.7% at night, 2025, with the 2019 ticks (37.2% / 40.5%).
> Why hours? Since twenty nineteen America added sixty-five gigawatts of clean power to the average
> daytime hour. Overnight it added eighteen. Datacenters run on both.

*Figures:* **from the corrected 2019 baseline.** Published 2019 carries the Arizona nuclear double
count — a phantom 3,333.8 MW daytime and 3,338.3 MW overnight
(`regions.json` → `corrections.regions.AZPS.corrections[]` where `path == "cf_avg_mw.2019"`:
`published` 3,736 / 3,373 against `corrected` 402.2 / 34.7). Corrected 174,795 → 239,533 MW by day
= **+64,738**; 155,693 → 173,380 MW overnight = **+17,687**; ratio 3.66. Published values are
`meta.national.cf_avg_mw.{2019,2025}.{daytime,overnight}`; the on-screen shares are
`meta.national.cf_share.{2019,2025}.{daytime,overnight}`.
**Do not say 61.4 and 14.3.** Those are the uncorrected figures.
*Honesty:* the slide shows a falling night share, so the spoken absolutes must stay in this shot.
*Check:* `.film-slide.show` contains "46.5%" and "39.7%".

### 4 · `type` — `#/` — silent · 0.6 s
The cursor types **Google** into the inline palette and lands on the check.
*Check:* `.ans-sticky` contains "Alphabet (Google)".

### 5 · `google` — `#/check/GOOGL` — 18 words · 8.4 s
**Screen.** "100% claimed on paper · 6–91% on its grids"; the answer line reads "True on paper."
> Start with Google. First the claim. Google says a hundred percent renewable. Then the buildings.
> We've mapped ten.

*Figures:* `company/GOOGL.json` → `claims[0].magnitude` = 1.0, `.scope` = `market_based`,
`.timeframe` = `annual`, `.verdict` = `true_on_paper`; `sites` array length 10.
**Visual note:** "ten" is rendered in the gap block ("across 10 sites"), which the cursor only
reaches in shot 6. At this moment the number is on screen but not under the cursor.
*Check:* `.ans-rest` contains "True on paper".

### 6 · `grids` — `#/check/GOOGL` — 30 words · 13.6 s
**Screen.** The gap block: says 100% / its grids 6–91% / 54 points apart, across 10 sites.
> Now the grids. They ran six to ninety-one percent clean last year. That averages forty-six. So
> the claim is true on paper under the GHG Protocol. Not a lie. A contract against a meter.

*Figures:* `company/GOOGL.json` → `claims[0].physical_min` 0.056, `.physical_max` 0.913, and
`claims[0].physical_mean_unweighted` 0.464. The on-screen "54 points apart" is 100 − 46.4. The GHG
Protocol framing is `notes[3]`.
**The pair is 100 against 46, not 100 against 5.6.** Google has ten mapped sites; 5.6% is the low
end of a range, not the company's figure, and the old one-site framing is dead. The narration gives
the range and then the mean explicitly, so "six" cannot be misheard as Google's number. The deck
carries the same pair.
*Check:* `.ans-gap` contains "100%", "6–91%", "54 points apart, across 10 sites.".

### 7 · `claims` — `#/check/GOOGL` — 20 words · 9.3 s
**Screen.** "Same report, both numbers": the p. 4 sentence beside the p. 94 hourly CFE table, each
with its rendered page behind a "full page" button.
> Here's the claim we read. Page four of their own report. Their page ninety-four discloses the
> hourly figure. Sixty-five percent.

*Figures:* `company/GOOGL.json` → `claims[0].verbatim`, `.page` = 4, `.source_doc`, `.source_url`;
the 65% is `claims[0].evidence[]` where `type == "internal_contradiction"`, `page` = 94, `values` =
[65, 64, 64, 66, 65] for `years` 2021–2025. Both pages human-checked:
`claims[0].verification.pages_checked`.
*Check:* `[data-module="sbs"]` contains "p. 4", "p. 94", "65%".

### 8 · `detector` — `#/found?s=detector` — 29 words · 13.2 s
**Screen.** "The demand data finds the datacenters by itself: 111 regions ranked with no company
list…"
> That works when we know the company. This answers a harder question. Where is new round-the-clock
> load landing when nobody tells us? It reads demand alone. No company list.

*Figures:* `regions.json` → `meta.n_scored` = 111.
*Check:* `.fd-say` contains "111 regions".

### 9 · `method` — `#/found?s=detector` — 34 words · 15.4 s
**Screen.** The year-by-year map playing; the note reads "Northern Virginia 6th, Omaha 7th, Central
Ohio 19th, Dallas 91st … the miss stands".
> A hundred and eleven regions get a score. The scoring uses medians instead of means. One big
> region can't swamp it. It was frozen before we looked. Dallas came ninety-first. We print the miss.

*Figures:* `regions.json` → `meta.detector_method` verbatim: "score = z(overnight_excess) +
z(neighbor_divergence) + 0.5 z(load_factor_delta), robust z; 500 MW cut; p99.5 peak; frozen before
results". Pre-registered regions: `meta.validation_named_in_advance`; ranks from
`regions[].detector_rank`.
**No model is claimed.** No gradient boosting, logistic regression, k-means, PCA, scikit-learn or
xgboost exists in the repo, so none is mentioned and it is not hedged.
*Note:* no hit count is spoken. The screen says "3 landed in the top 20"; a stricter reading is two
hits. Saying nothing keeps the film consistent with whatever the screen prints.
*Check:* `.fd-scene .note` contains "Northern Virginia 6th" and "Dallas 91st".

### 10 · `pjm` — `#/found` — 26 words · 11.9 s
**Screen.** Step 1 of 4: **35,700 → 35,619** MW of clean power at night.
> Now run that reading on PJM. That's the grid operator for the biggest datacenter cluster on earth.
> Clean power at night hasn't moved since twenty nineteen.

*Figures:* `region/PJM.json` → `region.cf_avg_mw.{2019,2025}.overnight`. The gloss of "balancing
authority" lands here.
*Check:* `.wx-stepfig` contains "35,700 → 35,619".

### 11 · `gas` — `#/found` — 24 words · 11.0 s
**Screen.** Stepped twice: **+10.7 GW** gas at night, with the page's own "Consistent with new
round-the-clock load being served by gas" line.
> The night got eight point seven gigawatts bigger. Gas supplied ten point seven. Consistent with
> round-the-clock load served by gas. Not caused by it.

*Figures:* `region/PJM.json` → `region.total_avg_mw.{2019,2025}.overnight` (82,539 → 91,240) and
`region.fuel_delta_overnight_gw.gas` = 10.74.
*Check:* `.wx-stepbody` contains "+10.7 GW" and "Consistent with".

### 12 · `stargate` — `#/check/OPENAI` — 36 words · 16.3 s
**Screen.** The cursor opens the evidence drawer, walks the six mapped Stargate sites, then opens
the "material caveat" on Santa Teresa: "the source states the campus will run on a 700-900 MW gas
microgrid that explicitly does NOT connect to El Paso Electric's grid".
> We built the ask layer on OpenAI's models. So point it at OpenAI. Six Stargate sites. Each mapped
> to a grid. Only three to a named utility. One we can't see at all. Reporting says it runs on its
> own gas plant.

*Figures:* `company/OPENAI.json` → `sites` length 6, `walk_score` 0.369, `coverage` 1.0. The
microgrid is **reporting, not measurement**: `sites[1].note` (confidence=medium),
`sites[1].source_type` = `press`, `sites[1].source_url` (elpasomatters.org). Say "reporting says",
never "our data shows".
**Visual note — resolved.** An earlier cut said only "each mapped to a grid", which is true (all six
have a `region_id`) but left three rows reading "utility unknown" uncontradicted on screen. "Only
three to a named utility" now states the split the screen shows. Verified against the live rows:
Ohio Edison, We Energies and AEP Ohio are named; Shackelford County, Santa Teresa and Milam County
read "utility unknown".
*Check:* `[data-module="sites"] .site-note .note` contains "700-900 MW gas microgrid" and
"does NOT connect".

### 13 · `blind` — `#/check/OPENAI?evidence=1` — 15 words · 7.1 s
**Screen.** The same open caveat, held: "…so this load will not appear in EPE demand."
> Ten of our mapped sites are behind the meter. A demand-only detector can't see them.

*Figures:* **ten**, counted by hand across `company/*.json` → `sites[].note`, matching on the phrase
"behind the meter": Crusoe (Laramie County, Childress County), Hut 8 (Vega), Keel (Nesquehoning,
Venango County), Oracle (Shackelford County, Santa Teresa), Poolside (Pecos County), Soluna (Briscoe
County), Vulcan (Torrey / Dresden). A looser match on on-site generation of any kind — microgrids,
co-located plants, mobile turbines — gives fifteen.
**Do not say eleven.** That figure is not reproducible from anything in the repo. Say ten, or "about
a dozen". The method limit is also written into `facilities.json` → `notes[5]`
("SOME SITES BURN GAS WE CANNOT SEE").
*Why it is here:* the Santa Teresa caveat is one site; this generalises it into the limitation, on
screen, in the product's own words. It is the film stating its own blind spot out loud.
*Check:* `[data-module="sites"] .site-note .note` contains "will not appear in EPE demand" — a
different string from shot 12's, so the two checks are independent rather than duplicated.

### 14 · `ask` — `#/ask?q=…` — 26 words · 11.9 s
**Screen.** The live answer, headlined close to "Google sits on the lowest overnight clean share
among 100% renewable claimants", with **0.7% clean at night, 2025** and **14 clean MW**.
> You can also just ask it. Which claimant sits on the dirtiest grid at night? It answers Google.
> Moncks Corner. Zero point seven percent clean overnight.

*Figures:* the answer's own, and they check out: `region/SC.json` →
`region.cf_share.2025.overnight` = 0.007, `region.cf_avg_mw.2025.overnight` = 14.0 MW of
`region.total_avg_mw.2025.overnight` = 1,906.0 MW.
*Scoping:* "dirtiest" is scoped to hundred-percent-renewable claimants, which is what the screen
says. It is false globally — El Paso Electric is at 0.1% overnight, Arizona at 10%.
*Volatility:* a model answer, so wording moves. Stable across three runs: Google, Santee Cooper /
Moncks Corner, `kind: "single"`, and the V.C. Summer caveat. The expect looks only for "Google".
*Check:* `.ask-headline` contains "Google". **Verified live.**

### 15 · `askhow` — `#/ask?q=…` — 31 words · 14.1 s
**Screen.** The caveat list and the provenance line: "Every figure here came from companies,
company, region over the published EIA-930 index. All 2 figures match numbers those tools returned."
> That's an OpenAI tool-calling loop over eleven typed tools. One searches three hundred fifty-four
> passages in Elasticsearch. They come from the companies' own reports and filings. Codex wrote that
> retrieval layer.

*Tools:* **eleven**, from the live `/api/ask/status`: alerts, companies, company,
compare_companies, compare_regions, facilities, irradiance, national, rank_regions, region,
search_corpus. Model `gpt-4.1`. `server/ai.py` in this repo is stale at ten; trust the service.

*Corpus — the unit is **passages**, not documents.* `/api/search/status` reports 354 records in
`wattson-corpus-v1` (309 esg, 45 10k). Those 354 are extracted passages from **8 source documents
across 4 companies**, counted line by line in `claims/raw/*.jsonl`:

| Company | ESG report | 10-K |
|---|---|---|
| Google | 118 | 9 |
| Meta | 74 | 19 |
| Microsoft | 66 | 11 |
| Amazon | 51 | 6 |
| **Total** | **309** | **45** |

**Never say "354 filings."** It overstates the document count more than forty-fold.

*Codex:* the team used Codex to implement the Elasticsearch retrieval layer. That is the only Codex
claim in the film.
*Honesty:* the sentence describes what the layer is made of, not what this answer used. This
question answers from the numeric tools; its provenance line reads "companies, company, region" and
does not include `search_corpus`.
*Check:* `.ask-prov` contains "over the published EIA-930 index". **Verified live.**

### 16 · `refuse` — `#/check/CRUSOE` — 23 words · 10.6 s
**Screen.** "sites mapped 2 — grid is the operator's own attribution; no serving utility
established", with the "no documents ingested" reason in full.
> Last thing. Watch what it won't say. We couldn't tie a single Crusoe building to a named utility.
> So the record says that.

*Figures:* `company/CRUSOE.json` → `sites` length 2, both `sites[].serving_utility` = null,
`coverage_status` = `sites_only`. Coverage totals, if you need them:
`companies.json` → `count` = 52, `count_sites_only` = 48.
*Correction to the original script:* it named **Nebius**, which is wrong — both Nebius sites name a
utility (Vineland Municipal Electric Utility, Independence Power and Light); what is true of Nebius
is that neither utility has listed equity. It also said twelve operators have no documents read; it
is 48 of 52.
*Check:* `.ans-figs` contains "no serving utility established".

### 16 · `end` — slide `end` — 24 words · 11.0 s
**Screen.** The wordmark, the tagline, "Built at HackMIT 2026 on PUDL EIA-930 data".
> A claim. The buildings behind it. The grid under each one. The hour that decides it. It follows
> the power, not the press release.

*Figures:* none. The four beats deliberately echo shot 2.
*Check:* `.film-slide.show` contains "HackMIT 2026".

### 17 · `clean` — `#/check/VANTAGE?evidence=1` — 20 words · 9.3 s
**Screen.** First row: Quincy · Grant County PUD · Grant Co. WA · **100% · 100% at night**.
> Vantage's Quincy, Washington site sits on a grid a hundred percent carbon-free at 3am. Columbia
> River hydro. The method distinguishes.

*Figures:* `region/GCPD.json` → `region.cf_share.2025.overnight` = 1.0, being
`region.cf_avg_mw.2025.overnight` = 991.0 MW of `region.total_avg_mw.2025.overnight` = 991.0 MW.
The site row is `company/VANTAGE.json` → `sites[0]`, `serving_utility` = "Grant County PUD".
*Why it is here:* the product's claim to be an instrument rather than an accusation rests on it
distinguishing. A grid that is fully carbon-free at 3am on hydro is as much a finding as one that is
not. Without this shot nothing on screen comes out well.
*Timing note:* the sparkline caption that carries "100% at night" renders a couple of seconds after
the module mounts, once the per-region series loads. The shot waits 2.2 s before scrolling and
scrolls a second time afterwards.
*Check:* `[data-module="sites"] .rows` contains "Quincy", "Grant County PUD", "100% at night".

### 18 · `end` — slide `end` — 24 words · 11.0 s
(unchanged; the four beats echo shot 2)

## Shots cut in the restructure, and what went with them

| Cut shot | What it said | What was lost |
|---|---|---|
| `openai` + `sites` | OpenAI 37% across six sites, and the three-of-six utility split | Folded into `stargate`, split included. The 37% figure is no longer spoken; it is still on the answer header. |
| `epe` | El Paso Electric 34.1% by day, 1 clean MW of 655 at night | No honesty issue — no EPE share is stated any more. The figure is still on screen in the site row. |
| `jupiter` | The blind-spot admission as its own beat, plus "ten mapped sites are behind the meter" | Nothing. The microgrid admission lives in `stargate` and the behind-the-meter count is restored as `blind` (shot 13). |
| `clean` | — | **Restored.** Cutting it left nothing on screen that comes out well, which made the film read as an accusation rather than an instrument. |

---

## Every figure spoken, and where it comes from

Shot numbers match the current 16-shot list. API paths are under `web/public/api/`; region files
nest under a top-level `region` key, company files are flat. Live endpoints are on
`https://wattson-api-ivory-seastar-408.fly.dev`.

| Figure | Shot | File | Field |
|---|---|---|---|
| +65 GW clean added to the average daytime hour | 3 `why` | `regions.json` | `meta.national.cf_avg_mw.2025.daytime` (239,533) minus `.2019.daytime` (178,129) corrected by `corrections.regions.AZPS.corrections[path="cf_avg_mw.2019"]` (−3,333.8) |
| +18 GW clean added to the average overnight hour | 3 `why` | `regions.json` | `meta.national.cf_avg_mw.2025.overnight` (173,380) minus `.2019.overnight` (159,031) corrected by the same block (−3,338.3) |
| 46.5% / 39.7% on the slide | 3 `why` | `regions.json` | `meta.national.cf_share.2025.{daytime,overnight}`; also `film.js` `NATIONAL` |
| Google claims 100%, annual, market-based | 5 `google` | `company/GOOGL.json` | `claims[0].magnitude`, `.timeframe`, `.scope`, `.verdict` |
| ten mapped buildings | 5 `google` | `company/GOOGL.json` | `sites` array length |
| 6–91% physically, averaging 46 | 6 `grids` | `company/GOOGL.json` | `claims[0].physical_min` 0.056, `.physical_max` 0.913, `.physical_mean_unweighted` 0.464 |
| 54 points apart (on screen) | 6 `grids` | `company/GOOGL.json` | 100 − `claims[0].physical_mean_unweighted` (0.464) |
| p. 4 claim sentence | 7 `claims` | `company/GOOGL.json` | `claims[0].verbatim`, `.page`, `.source_doc`, `.source_url` |
| p. 94, 65% hourly CFE | 7 `claims` | `company/GOOGL.json` | `claims[0].evidence[type="internal_contradiction"]`: `page` 94, `values` [65,64,64,66,65] |
| 111 regions | 8 `detector`, 9 `method` | `regions.json` | `meta.n_scored` |
| medians instead of means, 500 MW cut, p99.5 peak, frozen | 9 `method` | `regions.json` | `meta.detector_method` |
| Dallas ninety-first | 9 `method` | `regions.json` | `meta.validation_named_in_advance`; `regions[].detector_rank` |
| PJM clean at night 35,700 → 35,619 MW (on screen) | 10 `pjm` | `region/PJM.json` | `region.cf_avg_mw.{2019,2025}.overnight` |
| PJM overnight generation +8.7 GW | 11 `gas` | `region/PJM.json` | `region.total_avg_mw.{2019,2025}.overnight` (82,539 → 91,240) |
| PJM overnight gas +10.7 GW | 11 `gas` | `region/PJM.json` | `region.fuel_delta_overnight_gw.gas` = 10.74 |
| six Stargate sites, each mapped to a grid | 12 `stargate` | `company/OPENAI.json` | `sites` length 6; `sites[].region_id` all non-null; `coverage` = 1.0 |
| Project Jupiter gas plant, no interconnection | 12 `stargate` | `company/OPENAI.json` | `sites[1].note`, `.source_type` = press, `.source_url` — **reported, not measured** |
| ten mapped sites behind the meter | 13 `blind` | `company/*.json` | `sites[].note` matching "behind the meter": 10 sites. A looser match on on-site generation of any kind gives 15. **Not eleven.** Limit also stated in `facilities.json` `notes[5]` |
| Google / Santee Cooper 0.7% clean overnight | 14 `ask` | `region/SC.json` | `region.cf_share.2025.overnight` = 0.007; `region.cf_avg_mw` 14 MW of `region.total_avg_mw` 1,906 MW |
| Eleven typed tools, model gpt-4.1 | 15 `askhow` | live `/api/ask/status` | `tools[]` (11 names), `model`. The repo's `server/ai.py` `TOOLS` is stale at ten |
| 354 **passages** from their own reports and filings | 15 `askhow` | live `/api/search/status` | `indexed` = 354, `corpus.esg` = 309, `corpus.10k` = 45, `index` = `wattson-corpus-v1` |
| 8 source documents, 4 companies | 15 `askhow` | `claims/raw/*.jsonl` | one JSONL per document, one passage per line: GOOGL 118+9, META 74+19, MSFT 66+11, AMZN 51+6. `server/search.py` `_doc_type()` maps `*_esg.jsonl` → esg, `*_10k.jsonl` → 10k |
| Codex wrote the Elasticsearch retrieval layer | 15 `askhow` | — | confirmed by the team; no repo artifact records it |
| Crusoe: no building tied to a named utility | 16 `refuse` | `company/CRUSOE.json` | `sites` length 2, both `sites[].serving_utility` = null; `coverage_status` = `sites_only` |
| Quincy 100% carbon-free at 3am | 17 `clean` | `region/GCPD.json` | `region.cf_share.2025.overnight` = 1.0 (991 of 991 MW); site row `company/VANTAGE.json` `sites[0]` |
| only three of six sites to a named utility | 12 `stargate` | `company/OPENAI.json` | `sites[].serving_utility`: Ohio Edison, We Energies, AEP Ohio named; three null |

### On screen but no longer spoken

Still rendered by the app, still correct, and worth knowing if a judge asks. These were spoken in
the previous cut and were dropped in the restructure.

| Figure | Where it still appears | File | Field |
|---|---|---|---|
| 48 of 52 operators have no documents read | the Crusoe card's coverage block | `companies.json` | `count` 52, `count_sites_only` 48, `count_with_claims` 4 |
| OpenAI 37% across its grids | the OpenAI answer header | `company/OPENAI.json` | `walk_score` = 0.369 |
| El Paso Electric 34.1% by day, 1 MW of 655 at night | the Santa Teresa site row ("16% · 0% at night") | `region/EPE.json` | `region.cf_share.2025.daytime`; `region.cf_avg_mw` / `region.total_avg_mw`, 2025 overnight |

## Figures deliberately not spoken

- **"354 filings"** — it is 354 *passages* from 8 documents across 4 companies. The unit has to be
  said out loud.
- **+61.4 / +14.3 GW and "four times"** — measured from the contaminated 2019 baseline. Superseded
  by +64.7 / +17.7 GW and 3.66x.
- **"Six percent physically"** for Google, and **94 points apart** — superseded by the merge.
- **Eleven behind-the-meter sites** — not reproducible from the repo. Ten is what the notes say, and ten is what shot 13 speaks.
- **"100% against 5.6%"** for Google — the one-site framing is dead. It is 100 against 46, a 54-point gap across ten sites.
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
