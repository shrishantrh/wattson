# Grid Truth: hourly carbon-free index for every US balancing authority

HackMIT 2026, Voloridge track. Built on PUDL's EIA-930 tables (Voloridge's listed dataset).

**The question.** Companies say "100% renewable" or "carbon-free" in their SEC filings.
That claim is usually annual and averaged. The grid their facilities actually draw from
has an hour-by-hour carbon-free share that we can compute for every US balancing
authority (BA), 2018 to today. We compare the two.

**The finding so far.** All of the US grid's decarbonization since 2021 has happened in
daylight hours. The overnight (midnight to 6am local) carbon-free share has been flat at
about 40% nationally for seven years, and in PJM (which serves the Northern Virginia data
center corridor) it has *fallen*. See "Results" below.

## Setup

```bash
python3 -m venv ~/hackmit-venv
source ~/hackmit-venv/bin/activate
pip install boto3 pandas pyarrow
```

Download the raw tables (anonymous S3, about 155 MB total, one-time):

```bash
python3 scripts/vendor/pudl_fetch.py --output-dir data/pudl \
  --table core_eia930__hourly_net_generation_by_energy_source \
  --table core_eia930__hourly_subregion_demand \
  --table out_eia930__hourly_subregion_demand \
  --table core_eia__codes_balancing_authorities \
  --table core_eia__codes_balancing_authority_subregions
```

Then run the pipeline in order (each step is a few minutes on a laptop):

```bash
python3 scripts/build_wide.py          # long -> wide table, drops 98M empty padding rows
python3 scripts/carbon_free_index.py   # hourly index for all 70 BAs + annual summary
python3 scripts/overnight_profile.py   # local-time night vs day analysis
```

`data/` is gitignored. Every teammate downloads and rebuilds locally.

## Data notes (verified against the actual files, not the docs)

**Source table:** `core_eia930__hourly_net_generation_by_energy_source`, 118M rows,
but 98M are empty padding (every BA x every fuel x every hour since 2015). Real data
starts 2018-07-01 and runs to 2026-09-05. 70 BAs report generation.

**Value column:** use `net_generation_adjusted_mwh`. It is populated in 20,364,407 of
20,364,465 real rows. The `reported` column is nearly identical and `imputed_eia` is
almost always empty.

**Fuel categories changed on 2024-07-01.** EIA split `hydro`, `solar`, `wind` into finer
buckets (`hydro_excluding_pumped_storage` + `pumped_storage`,
`solar_w/wo_integrated_battery_storage`, `wind_w/wo_integrated_battery_storage`) and
added `battery_storage`, `geothermal`, `unknown`, etc. We checked every hour: the old and
new buckets are **never both populated** for the same BA and hour, so summing parent plus
children is safe and never double counts.

**Carbon-free definition** (in `scripts/carbon_free_index.py`):

| group | categories | in numerator | in denominator |
|---|---|---|---|
| carbon-free | nuclear, hydro (both), wind (all 3), solar (all 3), geothermal | yes | yes |
| fossil | gas, coal, oil | no | yes |
| other | other, unknown (biomass, waste, petcoke, unclassified) | no | yes |
| storage | battery, pumped, other/unknown storage | excluded | excluded |

Storage is net of charging (negative a third of the time) and is not generation.
"Other" is counted against carbon-free on purpose; it is the conservative choice and is
only 1.7% of national generation. Small negative generation values (station load, and
pumping that was folded into `hydro` before 2024) are clipped to zero.

**Time zones:** all timestamps are UTC. `core_eia__codes_balancing_authorities` has a
`report_timezone` per BA (69 of 70 have one; SIKE is dropped). Overnight analysis converts
to local time first. Arizona BAs use America/Phoenix (no DST).

**Subregion demand:** `core_eia930__hourly_subregion_demand` has demand (not generation)
for zones inside 10 big BAs, including `DOM` = Dominion Virginia Power inside PJM. The raw
`core` table has garbage spikes (two hours in Oct 2021 report over a billion MWh). Use
`out_eia930__hourly_subregion_demand` and its `demand_imputed_pudl_mwh` column instead.

**Known gaps:** BAs report their own generation only, not imports. A BA like Homestead FL
(HST) generates nothing and reads 0%; its residents' power actually comes from FPL. For a
company sited in a small BA, use the parent BA. 193,824 hours (4%) have zero total
generation and an undefined share; they are almost all tiny generation-only BAs.

## Results

Sanity check: national generation-weighted carbon-free share matches EIA's published
numbers.

| year | national CF share | PJM CF share |
|---|---|---|
| 2019 | 37.7% | 39.2% |
| 2021 | 38.6% | 38.9% |
| 2023 | 39.5% | 39.8% |
| 2025 | 41.4% | 39.3% |
| 2026 YTD | 43.0% | 39.0% |

Night (00-05 local) vs day (10-15 local) carbon-free share:

| BA | 2019 night | 2019 day | 2025 night | 2025 day |
|---|---|---|---|---|
| National | 40.5% | 37.2% | 39.7% | 46.5% |
| PJM | 43.3% | 37.6% | 39.0% | 41.6% |
| MISO | 32.0% | 26.3% | 34.5% | 38.2% |
| ERCOT | 39.9% | 28.7% | 41.3% | 57.6% |
| CAISO | 49.5% | 68.9% | 45.8% | 64.1% |
| SPP | 46.7% | 35.7% | 51.9% | 41.4% |

In 2019 the grid was cleaner at night almost everywhere (nuclear and wind run all night,
gas peakers run in the day). Solar has since flipped that. Daytime is now much cleaner,
and the overnight share has not moved. A data center runs 24/7, so half its load lands in
the hours that have not decarbonized at all.

**Why PJM's overnight share fell.** Average overnight generation in PJM, MW:

| year | nuclear | gas | coal | wind | total |
|---|---|---|---|---|---|
| 2019 | 31,855 | 27,451 | 18,391 | 2,882 | 82,539 |
| 2022 | 31,070 | 31,747 | 17,429 | 3,803 | 85,874 |
| 2025 | 30,908 | 38,190 | 15,873 | 3,955 | 91,241 |

Overnight output grew 8.7 GW from 2019 to 2025. Gas supplied 10.7 GW of new overnight
generation, wind 1.1 GW; nuclear and coal both shrank. Every overnight megawatt of load
growth in PJM was met by gas, and then some.

**Where the load growth is.** Dominion Virginia's PJM zone (DOM, the Northern Virginia
data center corridor) grew average demand 32% from 2019 to 2025, from 11.7 GW to 15.4 GW,
and its overnight average rose 40%. The next fastest PJM zone grew 11%; 17 of 20 zones
were flat or shrinking. Source: `out_eia930__hourly_subregion_demand`, cleaned column.

Output files (all in `data/processed/`, regenerated by the scripts):

- `hourly_cf_index.parquet`: one row per UTC hour per BA, 4.45M rows. Columns:
  `carbon_free_mwh`, `fossil_mwh`, `other_mwh`, `storage_net_mwh`,
  `total_generation_mwh`, `carbon_free_share`.
- `annual_cf_by_ba.csv`: BA x year, generation-weighted share.
- `cf_by_local_hour.csv`: BA x year x local hour of day, for the 24-hour profile charts.
- `night_vs_day_by_ba_year.csv`: BA x year, night share, day share, gap.

## Balancing authority codes (for the company lookup table)

The 70 codes in the data, grouped by region, so the company-to-BA mapping uses real codes:

- **Eastern grid operators:** PJM, MISO, NYIS (NYISO), ISNE (ISO-NE), SWPP (SPP), ERCO (ERCOT)
- **Southeast:** SOCO (Southern Co), TVA, DUK (Duke Carolinas), CPLE (Duke Progress East),
  SC (Santee Cooper), SCEG (Dominion SC), FPL, FPC (Duke FL), TEC (Tampa), JEA, AEC, LGEE
- **West:** CISO (CAISO), BPAT (Bonneville), PACE/PACW (PacifiCorp), NEVP (NV Energy),
  AZPS (APS), SRP, PNM, PSCO (Xcel CO), LDWP (LA DWP), IPCO (Idaho), PGE (Portland),
  PSEI (Puget), SCL (Seattle), AVA, NWMT, WACM, WALC, BANC, TIDC, IID, TEPC, EPE
- **PJM zones with demand data:** DOM (Dominion VA), AEP, CE (ComEd), ATSI, AP, PS, PL,
  PE (PECO), BC (BGE), PEP (Pepco), DEOK, JC, DPL, DAY, PN, ME, EKPC, DUQ, AE, RECO

Full list with names and time zones: `core_eia__codes_balancing_authorities`.
