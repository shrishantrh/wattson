Project was renamed to Wattson on Sept 19.

# Grid Truth: team sync brief

HackMIT 2026, Sept 19-20. Team: Yash + Shri. Last updated Saturday afternoon.

This file is the single source of truth. If your Claude chat or your memory disagrees with it, raise it with your teammate, then edit this file. Section 10 has a prompt Yash pastes into his Claude chat to check we are aligned.

---

## 1. What we are building (one paragraph)

A **monitoring dashboard** that tracks how clean the US power grid actually is, hour by hour, in every grid region, and uses that to (a) detect the AI data-center buildout from electricity load data alone, and (b) check company "100% renewable / carbon-free" claims against the physical grid their facilities draw from. It is **not** a chatbot and **not** a paste-text-get-answer tool. The Voloridge reps said they want a monitor, so nobody types anything to get value: it opens on results, charts, and alerts.

One-line pitch: *Companies report clean energy on an annual paper basis. We built the monitor that shows what the grid was physically doing every hour, and it shows the AI load landing in the hours that never got cleaner.*

## 2. Prize priority

1. **Voloridge, "Signal in the Noise"** (primary). $5k first place only, plus interview fast-track per member. Judged on originality, technical excellence, insight, execution. Reps reacted well to the idea at the booth.
2. **Arrowstreet, "Best Textual Analysis Hack"** (secondary). $1k first only, plus research interview per member. Judged on evidence retrieved with sources, sophistication of textual analysis, conclusion confidence, presentation. Needs a likelihood-of-greenwashing output starting from corporate text.
3. **Elastic, "Find the Signal"**: only if we genuinely use Elasticsearch for filing retrieval.
4. Cheap extras only if free: The Token Company (LLM cost savings), OpenAI (needs OpenAI API plus real Codex use).

Skipping: Long Lake, Dropbox, Deepgram, SpaceXAI, Maximor, everything hardware.

**Unconfirmed:** HackMIT's rule on how many sponsor challenges one project can enter, and the main track list. Someone must check the submission form or ask an organizer.

## 3. What is already built and verified (Shri's machine, via Claude Code)

Data source: PUDL's EIA-930 tables, which is dataset #6 on Voloridge's list. Pulled from `s3://pudl.catalyst.coop/stable/` using Voloridge's own fetch script.

Working scripts in the repo:
- `scripts/carbon_free_index.py`: hourly carbon-free share for all 70 US balancing authorities, July 2018 to Sept 2026, 4.45M rows.
- `scripts/overnight_profile.py`: converts to each region's local time, compares overnight (00:00-05:59) vs midday (10:00-15:59).

Definition of carbon-free: nuclear, hydro, wind, solar, geothermal. Fossil: gas, coal, oil. "Other/unknown" counts in the total but not as carbon-free (conservative). Storage is excluded from both sides. Small negative values clipped to zero. Value column used: `net_generation_adjusted_mwh`.

Data traps already found and handled:
- EIA split hydro/solar/wind into sub-categories on 2024-07-01. Old and new categories never overlap in the same hour, so summing all of them is safe.
- Raw Dominion demand has two garbage hours in Oct 2021 (over a billion MWh). Use `out_eia930__hourly_subregion_demand` and its `demand_imputed_pudl_mwh` column.
- 98M of the 118M rows in the generation table are empty padding. Real data starts 2018-07-01.
- Small regions that generate nothing read 0% or undefined. Map companies to the parent region.

## 4. Findings so far (these are the demo)

Baseline year is **2019**. 2018 is a half year. **2026 is Jan to early Sept only and is not comparable to full years** until the same-months fix lands.

| Metric | 2019 | 2025 |
|---|---|---|
| National carbon-free share, daytime | 37.2% | 46.5% |
| National carbon-free share, overnight | 40.5% | 39.7% |
| PJM carbon-free share, overnight | 43.3% | 39.0% |
| Dominion zone (N. Virginia) average demand | 11,681 MW | 15,395 MW (+32%) |
| Dominion zone overnight average demand | 10,060 MW | 14,033 MW (+39%) |

- Every other PJM zone's demand is flat or down over the same period (range: -7% to +11%).
- PJM overnight generation 2019 to 2025: total +8.7 GW. Gas +10.7 GW, coal -2.5 GW, nuclear about flat, wind +1.1 GW, solar zero.

Plain-English version: all of the grid's cleanup since 2019 happened in daylight, thanks to solar. Overnight has not improved nationally, and in the region hosting the biggest data-center cluster it got dirtier. Data centers run flat 24/7, so half their load sits in hours that have not decarbonized. The load growth is visible in one zone only, and its overnight growth outpaces its average growth, which is the fingerprint of flat 24/7 load.

**Wording rules for these findings (do not break these in front of judges):**
- Say "consistent with data-center load being met by gas," not "caused by." Part of the gas rise is coal-to-gas switching, and PJM generation includes exports.
- Dominion's roughly +4 GW overnight is about half of PJM's overnight growth. Say that, not "all of it."
- Say national figures are "consistent with EIA's published mix" unless we cite a specific EIA number.

## 5. Open fixes (in progress with Shri's Claude Code)

1. `scripts/build_wide.py` does not exist yet; the wide table was built by a temp script. Pipeline is not reproducible on Yash's machine until this lands.
2. Add same-months (Jan-Aug) and trailing-12-month comparisons so 2026 is usable.
3. Load-factor table: average demand divided by peak demand, per PJM zone per year. Expectation: rising in Dominion only. Hand math gives Dominion about 0.59 (2019) to 0.62 (2025). This could come back weak; if so we lean on the demand-growth table instead.
4. Commit and push to GitHub, add Yash.
5. Export dashboard-ready JSON.

## 6. The product: what is on screen

Static React + Plotly page reading precomputed JSON. No backend, so nothing crashes mid-demo.

1. **Region overview**: every grid region with its current carbon-free share and night-vs-day gap.
2. **Region detail**: 365-day by 24-hour heatmap of carbon-free share; night vs day trend since 2019; overnight fuel mix by year; for PJM, zone demand growth and load factor.
3. **Alerts panel**: simple threshold rules on the series. Examples: "Dominion overnight demand at a new high," "PJM overnight gas share up X points year over year."
4. **Company watchlist**: each tracked company, the regions its facilities sit in, its claimed number, the physical grid number, and a "Talk vs. Walk" chart (see section 7).

Stretch: live tail from the free EIA API so the monitor shows data through yesterday. PUDL is a snapshot ending 2026-09-05. Build on PUDL first; add the API only after everything else works.

## 7. The text side (Arrowstreet), and who has not started it

This is the piece with nobody on it yet.

- **Lookup table** (hand-written CSV): company, facility metro, balancing authority code, PJM zone if applicable. Use the real codes: PJM, ERCO, MISO, CISO, SWPP, BPAT, PACW, SOCO, DUK, AZPS, SRP, NYIS, ISNE, TVA. Hyperscalers publish data-center locations; neoclouds disclose capacity in filings. State in the demo that this is hand-curated.
- **Filing ingestion**: pull 10-K environmental sections from SEC EDGAR for the watchlist companies, several years each.
- **Claim extraction**: one LLM call per chunk returning JSON: verbatim claim, source and page, metric, magnitude, timeframe, scope, falsifiability score, and greenwashing pattern (vague wording, no proof, hidden trade-off, irrelevant claim, and so on, per an established taxonomy such as TerraChoice or the FTC Green Guides).
- **Internal-contradiction evidence**: many reports headline "100% renewable" while an appendix reports location-based Scope 2 emissions far from zero. Retrieve and cite that.
- **Output**: a likelihood of greenwashing, a confidence level, citations, and an explicit "cannot verify" state when there is no evidence.
- **Talk vs. Walk**: per company per year, a score for how bold and specific the environmental language is, plotted against the physical carbon-free share of the regions it operates in. Words rising while physics stays flat is the visual.
- **Stretch**: run the extractor over 100+ companies for a vague-vs-checkable distribution by sector.

## 8. Honesty rules for the whole project

- "100% renewable on an annual matched basis" is **true as stated**. Our verdict is "true on paper, X% physically," never "they lied."
- Every company result is labeled **grid-only, excludes the company's contracted clean power (PPAs)**.
- Regions are coarse. PJM spans Chicago to New Jersey. Say so.
- We measure average grid mix, not marginal emissions. Say so if asked.
- Validation: compare against Google's published **grid carbon intensity** per region, not Google's CFE%, which includes their contracts and will not match.
- No backtests, no "this predicts stock prices." If a quant judge asks about trading it, name which utilities and power producers serve the rising-load regions and stop.
- The company lookup is hand-curated and we say so.

## 9. Proposed ownership (not yet agreed; confirm or change)

| Owner | Work |
|---|---|
| Shri | Grid pipeline (done), open fixes in section 5, JSON export, dashboard UI |
| Yash | Company lookup CSV, EDGAR ingestion, claim extraction prompts, Talk vs. Walk scoring, Elastic if used |
| Both | Agree the JSON schema for a company card before either builds against it. Booth visits. Two separate write-ups (Voloridge leads with the data finding; Arrowstreet leads with text analysis and cited evidence). |

Shared rules: freeze the demo path about six hours before judging. Write submissions with hours to spare, not in the last one. One claim working end to end beats five half-built features.

Explicitly cut, do not re-add: wind-direction control, EPA CEMS smokestack data, OpenAQ, NOAA weather, GDELT news lead-lag, Deepgram audio, Dropbox, SpaceXAI.

## 10. Prompt for Yash to paste into his Claude chat

Attach this file, then send:

> I've attached GRID_TRUTH_SYNC.md. It is the current state of my HackMIT project with my teammate Shri, and it supersedes the earlier plans in this conversation wherever they differ. Read it fully, then do the following, in order, and be blunt:
>
> 1. In five sentences or fewer, state back what we are building, who it is for, and what the demo shows. Do not copy the file's wording.
> 2. List every place where this file conflicts with what you and I previously planned in this chat (examples: paste-a-claim tool vs. monitor dashboard, Arrowstreet-first vs. Voloridge-first, wind control, Deepgram, GDELT, the Google CFE validation, dataset-as-output). For each conflict, say which version you think is right and why. Do not just defer to the file.
> 3. Check the findings in section 4 for anything that looks wrong, overstated, or likely to get challenged by a quant researcher. Flag anything in the wording rules you think is still too strong or too weak.
> 4. Section 7 is my half and is not started. Give me a concrete build order for it with time estimates, the exact JSON schema you propose for a company card (so Shri's dashboard can consume it), and a first list of 8 to 10 companies with their US data-center metros and balancing authority codes using only the codes listed in the file. Mark any mapping you are not sure of.
> 5. List the open questions you need answered by me or Shri before building, such as the stacking rule, the frontend stack, whether we use Elastic, and which LLM API does extraction.
>
> Do not write code yet. End with a short "sync status" line: either "aligned" or a list of the specific disagreements Shri and I need to settle.

After Yash runs it, he sends the reply (especially parts 2, 4, and 5) back to Shri. Shri pastes it into his chat for a cross-check, and this file gets updated with whatever you both settle.
