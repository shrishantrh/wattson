# Grid Truth

Measuring and acting on the environmental impact of the AI datacenter buildout.

HackMIT 2026 | Yash and Shri | Technical specification

---

## Amendments (from Shri's review; these override the text below where they conflict)

1. **Develop and run locally.** The grid pipeline already runs on a laptop in minutes. Do not migrate it to EC2. Once L2-L4 are final, clone the repo on the EC2 instance and rerun end to end inside tmux as a reproducibility check, and record the runtime for the write-up. The instance is mainly for Yash's filing ingestion. `scripts/build_wide.py` already exists. Never put credentials in the repo.
2. **Headroom is redefined.** "Clean nameplate minus realized overnight clean output" is physically wrong: solar nameplate is unavailable at night and wind nameplate is not dispatchable. Replace with a **siting score** per BA: overnight CF share in 2025, its change since 2019, and overnight clean MW divided by overnight demand. EIA-860 operators and any capacity-based headroom are stretch goals, after the dashboard works.
3. **PJM zones have demand data only, no generation.** In `regions.json` a zone inherits its parent BA's carbon-free numbers and must be labeled as inherited. The example below shows DOM with its own `cf_share`; that figure is PJM's.
4. **IRPs: exactly one, by hand.** Dominion's IRP, for one cited cross-document contradiction. No IRP ingestion pipeline.
5. **Timeline.** Submission deadline is 11:00am Sunday. Target a working demo Saturday night. Arrowstreet gate: if one company is not fully through extraction and the contradiction check by early evening, skip the Arrowstreet submission and keep the watchlist as a dashboard feature.

---

## Thesis

The AI buildout is adding enormous, permanently flat electricity load to a grid that has only decarbonized during daylight hours. We measure where that load is landing, what is being burned to serve it, how much clean headroom remains, and whether the companies responsible describe it accurately in their own filings.

The environmental story of AI is normally told in annual totals, which hide the actual problem. Solar cleaned up the middle of the day and did nothing for the middle of the night. A datacenter draws the same power at 3am in January as at noon in June, so roughly half of AI's electricity demand lands in hours that have not improved in seven years and in some regions have gotten worse. That is a measurable claim and the federal data to settle it is public.

## System overview: seven layers

| Layer | Name | Input | Output | Owner | Est |
|---|---|---|---|---|---|
| L0 | Data acquisition | PUDL S3, EDGAR, ESG PDFs, IRPs | Raw files | Both | done / 1h |
| L1 | Grid index | EIA-930 hourly | Hourly CF share, 70 BAs, 4.45M rows | Shri | DONE |
| L2 | Temporal analysis | L1 | Night vs day, absolute MWh, same-months | Shri | 2h |
| L3 | Load detection | L1 + subregion demand | Signature score per region per year | Shri | 2h |
| L4 | Supply attribution | L1 (+ EIA-860 as stretch) | Fuel decomposition, siting score, operators (stretch) | Shri | 2.5h |
| L5 | Claim extraction | EDGAR + ESG + one IRP | Structured claims JSON | Yash | 5h |
| L6 | Verification | L5 + L1 + lookup CSV | Verdicts, contradictions, Talk vs Walk | Yash | 3h |
| L7 | Dashboard | JSON from L2-L6 | React + Plotly static site | Shri | 4h |

### Data flow

```
PUDL S3
  -> L1 grid index
       -> L2 temporal   -\
       -> L3 detection   -+-> regions.json   -> L7
       -> L4 supply     -/

EDGAR / ESG / IRP
  -> L5 extraction -> L6 verify -> companies.json -> L7
```

The two JSON files are the only contract between the halves. Agree their schemas before either side builds.

## L0: Data acquisition

| Source | Access | Notes |
|---|---|---|
| PUDL | `s3://pudl.catalyst.coop/stable/` | One parquet per table, ~440 tables. Voloridge dataset #6. Use their `fetch.py` from `s3://voloridge-hack-mit-2026/src`. |
| SEC EDGAR | Full-text search API + submissions endpoints | 10-K Item 1 and 1A. Free, rate-limited, needs a User-Agent header. |
| ESG reports | Manual download from IR sites | PDFs. The bold claims live here, not in the 10-K. |
| Utility IRP | State PUC site or utility IR | One document only (Dominion). The contradiction source. |

Key PUDL tables: `core_eia930__hourly_net_generation_by_energy_source`, `out_eia930__hourly_operations`, `out_eia930__hourly_subregion_demand` (use `demand_imputed_pudl_mwh`), `core_eia930__hourly_interchange`, `core_eia__codes_balancing_authorities`. Stretch: `core_eia860__scd_plants`, `core_eia860__scd_generators`, `core_eia__entity_utilities`, `core_pudl__*` crosswalks.

Do not pull: `core_epacems__hourly_emissions` (4.9 GB), `out_vcerare__*` (3.6 GB). Not needed.

## L1: Grid index (built and verified)

Hourly carbon-free share for all 70 US balancing authorities, July 2018 to September 2026, 4.45M rows. Script: `scripts/carbon_free_index.py`.

**Definitions.** Carbon-free = nuclear + hydro + wind + solar + geothermal. Fossil = gas + coal + oil. Other/unknown counts in the denominator but not as carbon-free (conservative). Storage excluded from both sides. Small negatives clipped to zero. Value column: `net_generation_adjusted_mwh`.

CF share = carbon_free_mwh / total_generation_mwh, expressed 0 to 1.

### Data traps found and handled

- EIA split hydro, solar and wind into sub-categories on 2024-07-01. Old and new categories never co-occur in the same hour, so summing all of them is safe.
- Raw Dominion demand has two corrupt hours in Oct 2021 (values over a billion MWh). Use `out_eia930__hourly_subregion_demand` and `demand_imputed_pudl_mwh`.
- 98M of 118M rows in the generation table are empty padding. Real coverage starts 2018-07-01.
- Small BAs that generate nothing read 0% or undefined. Map facilities to the parent region.
- 2018 is a half year, 2026 runs to 2026-09-05. Use same-months (Jan-Aug) and trailing-12-month comparisons.

These traps go in the write-up. Voloridge rewards teams that found and handled them.

## L2: Temporal analysis

Script: `scripts/overnight_profile.py` plus additions. Converts to each region's local time, splits overnight (00:00-05:59) from midday (10:00-15:59).

| Metric | 2019 | 2025 |
|---|---|---|
| National CF share, daytime | 0.372 | 0.465 |
| National CF share, overnight | 0.405 | 0.397 |
| PJM CF share, overnight | 0.433 | 0.390 |
| Dominion zone avg demand | 11,681 MW | 15,395 MW (+32%) |
| Dominion zone overnight avg demand | 10,060 MW | 14,033 MW (+39%) |

PJM overnight generation change 2019 to 2025: total +8.7 GW; gas +10.7, coal -2.5, nuclear roughly flat (-0.9), wind +1.1. No other PJM zone exceeded +11% demand growth. AEP (central Ohio) is +9% and is the second known datacenter cluster.

### Required addition: absolute vs share

Overnight CF share fell. Whether overnight CF generation in MWh rose or fell must be computed, nationally and per BA. In PJM the fuel table already suggests overnight clean generation was roughly flat (nuclear -0.9 GW, hydro -0.2, wind +1.1) while total generation grew 8.7 GW. A technical judge will ask this.

Compute overnight clean generation (average MW) by year alongside the share. The precise statement is stronger than the current wording: clean supply did not keep up, demand grew, the share went backwards. Must exist before judging.

Also required: PJM overnight net interchange by year, with the sign convention stated.

## L3: Load detection

A scoring function over L1 and subregion demand. No company list required: the detector finds flat 24/7 load from its electrical fingerprint alone. This is what makes the project generalize instead of being a case study.

| Component | Definition | Rationale |
|---|---|---|
| Overnight excess | Overnight demand growth % minus average demand growth % | Flat 24/7 load raises the floor faster than the mean |
| Load factor trend | Mean demand / peak demand, YoY delta | Rises where flat load arrives. Diluted at whole-zone resolution; supporting evidence only |
| Neighbor divergence | Growth minus median growth of other zones in the same BA (for BAs: same interconnection) | Controls for weather and macro cycle |

Exclude zones under roughly 500 MW average demand.

**Validation:** the detector must fire on Northern Virginia (DOM) and central Ohio (AEP), the known clusters. Also check Omaha (OPPD, in SWPP) and Dallas (ERCOT NCEN). That is what licenses trusting it elsewhere. Any region it flags that is not a known cluster gets named on screen as a finding.

Hand math gives Dominion load factor roughly 0.59 (2019) to 0.62 (2025). If it comes back inside noise, cut it silently and lean on demand growth and neighbor divergence.

Upgrade if time allows: weather-normalize demand with NOAA ISD temperature for a sturdier version of the same signal.

## L4: Supply attribution and siting

- **Fuel decomposition.** Year-over-year change in overnight generation by fuel. In PJM this is overwhelmingly gas.
- **Siting score (replaces headroom; see Amendment 2).** Per BA: overnight CF share in 2025, its change since 2019, and overnight clean MW divided by overnight demand. Answers where new flat load would be served cleanly and where it would be served by gas.
- **Operators (stretch).** Which utilities and IPPs own the generation serving each region, via EIA-860 plant and ownership tables joined through PUDL crosswalks.

## L5: Claim extraction (not started)

**Why three document types.** A 10-K carries legal liability so its environmental language is hedged. An ESG report has no such constraint, so the bold claims live there. An IRP is a utility's regulatory filing stating what generation it actually intends to build. Reading a claim and a plan together is where the strongest evidence comes from.

| Step | Detail |
|---|---|
| Chunking | Split on section boundaries, ~2k token chunks with overlap. Index in Elastic if built. |
| Extraction call | One LLM call per chunk returning a JSON array of atomic claims. Structured output mode. |
| Falsifiability scoring | 0 to 1. Four hand-written anchor examples per extreme in the prompt. Needs no physical data, so it exists for every company including unverifiable ones. |
| Pattern tagging | Vague wording, no proof, hidden trade-off, irrelevant claim, lesser of two evils. Per TerraChoice / FTC Green Guides. |
| Contradiction retrieval | Intra-document: a 100% renewable headline against a non-zero location-based Scope 2 figure in the appendix. Cross-document: a decarbonization claim against an IRP scheduling new gas (Dominion only). Highest value single feature for Arrowstreet. Protect it. |

## L6: Verification

Joins extracted claims to the grid index through the facility lookup table.

Verdict vocabulary: `true_on_paper | contradicted | unfalsifiable | cannot_verify`

We never say a company lied. Annual matched renewable claims are true as stated under the GHG Protocol market-based method. The verdict is "true on paper, X physically," and every result is labelled grid-only, excluding contracted clean power. `cannot_verify` is explicit with a stated reason and its count is visible on screen.

**Talk vs Walk:** per company per year, a language boldness and specificity score (0 to 1) plotted against the physical CF share (0 to 1) of the regions it operates in. Words rising while physics stays flat is the visual.

### Facility mapping: the trap that flips verdicts

Balancing authorities are organizational, not geographic. Small utility-run BAs nest inside large ones, so mapping by state produces wrong answers that look right.

| Site | Naive | Correct | Effect |
|---|---|---|---|
| Meta, Prineville OR | BPAT | PACW (Pacific Power) | BPAT ~91% clean, PACW far lower |
| Microsoft, Quincy WA | BPAT | GCPD (Grant County PUD) | GCPD essentially 100% hydro |
| IREN, Childress TX | SWPP | likely ERCO, verify in filings | Different grid entirely |

Every row in the lookup CSV is built from the serving utility outward, never from the state, and carries `source_type` (`utility_tariff | company_disclosure | press | inferred`) and `source_url`.

Allowed BA codes: PJM, ERCO, MISO, CISO, SWPP, BPAT, PACW, GCPD, SOCO, DUK, AZPS, SRP, NYIS, ISNE, TVA.

This trap belongs in the write-up: naive geographic mapping would have scored two of these sites materially wrong, in opposite directions.

## JSON contracts

### companies.json (Yash delivers, in `claims/`). All shares are 0 to 1 fractions.

```json
{
  "company": "Meta Platforms", "ticker": "META",
  "sites": [
    {"metro": "Prineville, OR", "ba": "PACW", "pjm_zone": null,
     "serving_utility": "Pacific Power",
     "source_type": "utility_tariff", "source_url": "..."}
  ],
  "claims": [{
    "claim_id": "META-2024-003", "verbatim": "...",
    "source_doc": "2024 Sustainability Report", "page": 14, "year": 2024,
    "metric": "renewable_electricity_share", "magnitude": 1.0, "unit": "fraction",
    "timeframe": "2020-present", "scope": "market_based",
    "falsifiability": 0.9, "greenwash_patterns": ["hidden_tradeoff"],
    "verdict": "true_on_paper",
    "physical_min": 0.31, "physical_max": 0.98, "physical_mean_unweighted": 0.62,
    "confidence": "high",
    "evidence": [
      {"type": "grid", "ba": "PACW", "year": 2024, "cf_share": 0.31},
      {"type": "internal_contradiction", "source_doc": "...", "page": 61,
       "note": "location-based Scope 2 reported non-zero"}
    ]
  }],
  "talk_score": 0.82, "walk_score": 0.62,
  "coverage": 0.71, "unverifiable_share": 0.38,
  "notes": ["grid-only, excludes PPAs", "unweighted across sites, no capacity data"]
}
```

Numeric values in this example are placeholders, not measured results.

### regions.json (Shri delivers)

```json
{
  "ba": "PJM", "zone": "DOM", "name": "Dominion (N. Virginia)",
  "cf_inherited_from_ba": true,
  "cf_share": {"2019": {"overnight": 0.433, "daytime": 0.376, "all": 0.392}, "2025": {}},
  "cf_avg_mw": {"2019": {"overnight": null, "daytime": null}, "2025": {}},
  "demand":   {"2019": {"avg_mw": 11681, "overnight_avg_mw": 10060, "peak_mw": 19803}, "2025": {}},
  "detection": {"overnight_excess": null, "load_factor_delta": null,
                "neighbor_divergence": null, "score": null, "rank": null},
  "fuel_delta_overnight_gw": {"gas": 10.7, "coal": -2.5, "nuclear": -0.9, "wind": 1.1, "solar": 0.0},
  "siting": {"overnight_cf_share_2025": 0.390, "change_since_2019": -0.043,
             "overnight_clean_mw_over_demand": null},
  "operators": [],
  "heatmap_uri": "data/heatmaps/PJM.json"
}
```

Nulls are values that do not exist yet. For a zone, `cf_share`, `cf_avg_mw`, `fuel_delta_overnight_gw`, `siting` and the heatmap are the parent BA's, flagged by `cf_inherited_from_ba`.

## L7: Dashboard

Static React + Plotly reading precomputed JSON. No backend, nothing to crash mid-demo.

| Screen | Contents | Source |
|---|---|---|
| Region overview | All regions ranked by detection score, CF share, night-day gap. Landing screen. | regions.json |
| Region detail | 365x24 CF heatmap, 24-hour profile 2019 vs 2025, night vs day trend since 2019, overnight fuel mix by year, siting score. For PJM: zone demand growth and load factor. | regions.json + heatmap_uri |
| Alerts | Threshold rules. "Dominion overnight demand at a new high." "PJM overnight gas share up X points YoY." | regions.json |
| Company watchlist | Claimed figure, physical range, verdict, citations, Talk vs Walk chart, cannot-verify count. | companies.json |

Stretch, only after everything works: live tail from the free EIA API so the monitor runs through yesterday. PUDL is a snapshot ending 2026-09-05.

## Tech stack by layer

| Layer | Stack |
|---|---|
| L0 | boto3, Voloridge fetch.py, requests (EDGAR), pdfplumber (ESG/IRP PDFs) |
| L1-L4 | Python 3, pandas + pyarrow, numpy. Local; reproduced once on Voloridge EC2. |
| L5 | OpenAI API structured output (or Claude, decide), tiktoken for chunking, Elasticsearch if built |
| L6 | pandas joins, hand-built lookup CSV |
| L7 | React, Plotly, static JSON. No server. |
| Infra | git + GitHub; Voloridge EC2 (Amazon Linux 2023) with tmux for ingestion and the reproducibility run |

## Sponsor mapping

| Sponsor | Layers shown | The pitch | Prize |
|---|---|---|---|
| Main track (sustainability/energy, if it exists) | L1-L7 | The whole project. Measuring and acting on the environmental impact of the AI buildout, with siting as the actionable output. | Track prize, TBA |
| Voloridge, Signal in the Noise | L1-L4, L7 | A detector and monitor built on their dataset, generalizing across all regions, validated against known clusters, with the data traps we found and handled. Mention their EC2 and the runtime. | $5,000 (1st only) + interview fast-track per member |
| Arrowstreet, Best Textual Analysis | L5, L6 | Falsifiability scoring, cross-document contradiction with cited sources and page numbers, physical grounding, explicit cannot-verify. Lead with signal extraction from vague corporate text at scale, not with ESG. | $1,000 (1st only) + research interview per member |
| Elastic, Find the Signal | L5 retrieval | Retrieval across 10-Ks and ESG PDFs powering the contradiction engine. Only submit if actually built. | Quest 3S or Bose per member |
| OpenAI | L5 | Extraction runs on their API plus one real Codex-assisted feature. Keep a screenshot and the commit Codex produced. | ChatGPT Pro tiers |

Unconfirmed, someone must check the submission form: how many sponsor challenges one project may enter, and the main track list. Historically HackMIT allows one main track plus unlimited sponsor challenges. All code must be written inside the 24-hour window.

Not pursuing: Long Lake, Dropbox, Deepgram, SpaceXAI, Maximor, Meta, Visa, Cognition, all hardware.

## Ownership and build order

**Shri:** L1 (done), L2, L3, L4, L7. Order: L2 absolute MW and 2026 fix first (blocks a known challenge), then L3 detection (show the top 20 before anything else), then siting score, then JSON export, then dashboard with a mocked company card.

**Yash:** L0 text sources, L5, L6. Order:

1. Lookup CSV with sources (1.5h)
2. Confirm schema with Shri (0.25h)
3. EDGAR ingestion (1.5h)
4. ESG PDFs (1h)
5. Extraction prompt (2h)
6. Contradiction retrieval (1.5h)
7. Talk vs Walk (1h)
8. companies.json export (0.75h)
9. Elastic (1h, cut first)

Get one company completely through steps 1 to 8 before starting a second. Meta first: it spans four balancing authorities and will surface schema problems immediately.

Repo layout: Shri works in `scripts/` and `dashboard/`. Yash works in `claims/`. Pull before starting a session, push when something works.

## Compute

Voloridge granted EC2 access. See Amendment 1: the grid pipeline stays local; the instance is for filing ingestion and one end-to-end reproducibility run.

```bash
sudo dnf install -y python3-pip
pip3 install boto3 pandas pyarrow
aws s3 sync --no-sign-request s3://voloridge-hack-mit-2026/src ./src
```

Run everything in tmux, because a dropped SSH session kills a long job. Use SSH keys, not the password. Check disk before pulling large tables.

The dashboard does not run on EC2. Anything produced on the instance gets copied down early so a lost instance cannot take the demo with it.

## Honesty rules

- "Consistent with datacenter load being served by gas," never "caused by." Part of the gas rise is coal-to-gas switching.
- Dominion's roughly +4 GW overnight is about half of PJM's overnight growth. Say half, not all.
- We measure generation within a footprint, not consumption. Net interchange is not allocated, and overnight is when interchange is largest relative to load.
- Average grid mix, not marginal emissions. Say so if asked.
- Regions are coarse. PJM spans Chicago to New Jersey.
- Validate against published grid carbon intensity per region, not Google's CFE%, which embeds their contracts and will not match a grid-only figure.
- National figures are "consistent with EIA's published mix" unless a specific EIA number is cited.
- The facility lookup is hand-curated. Say so unprompted.
- No backtests, no claims about stock prices. If asked about investment relevance, name the utilities and IPPs serving the rising-load regions and stop.
- Pre-empt the obvious challenge: is Dominion growth datacenters or population? +32% in six years far exceeds plausible demographic growth, and overnight-faster-than-average is the discriminator, since residential and EV load is peakier, not flatter.

## Open items

- Compute overnight carbon-free generation in absolute terms. Blocks a predictable challenge.
- Decide which LLM API runs extraction. If OpenAI, their challenge is free; if not, drop that entry.
- Decide Elastic in or out. Default out unless the text half finishes early.
- Same-months and trailing-12-month comparisons so 2026 is usable.
- Confirm stacking rules and the main track list on the submission form.
- Freeze the demo path roughly six hours before the deadline. Write both submissions with hours to spare.
