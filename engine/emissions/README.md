# engine/emissions

Measured CO2 per grid region, from EPA CEMS, placed beside Wattson's carbon-free share.

The shipped carbon-free index measures the *share of generation* that came from
nuclear, hydro, wind, solar or geothermal. That is a proxy for emissions. This module
measures the emissions, using hourly stack data from EPA's Continuous Emissions
Monitoring Systems, which lives in PUDL next to the EIA-930 tables the project already
uses. The frozen detector and the frozen index are not touched.

Full write-up with every number, caveat and coverage figure: **`docs/EMISSIONS.md`**.

## Running it

```bash
source ~/hackmit-venv/bin/activate
python3 -m engine.emissions.cems     # ~150s: pulls the 2019 and 2025 CEMS slice
python3 -m engine.emissions          # build the tables, print the full report
python3 -m engine.emissions --report # report only, reuse the built tables
```

`cems.py` needs `data/pudl/` for EIA-860 and the frozen pipeline's
`data/processed/gen_by_source_wide.parquet` and `l3_detector.csv` to exist first.

## Files

| File | What it does |
|---|---|
| `cems.py` | Reads only the 704 row groups of `core_epacems__hourly_emissions` that cover 2019 and 2025 out of a 1.02-billion-row remote parquet file, aggregates unit-hours to plant-hours, records provenance. |
| `build.py` | Attributes plants to balancing authorities from EIA-860, converts to local time, cuts the overnight and daytime windows, joins the EIA-930 generation denominator, computes intensity and coverage, assigns the publish/drop tier, and verifies the mass unit against EPA emission factors. |
| `analyze.py` | Correlates the proxy against the measurement, fits the null model and reads off residuals, finds rank disagreement, restates PJM, finds where CEMS and EIA-930 disagree about the direction of fossil output, joins the 134 datacenter sites. |
| `__main__.py` | Runs build plus analyze and prints everything `docs/EMISSIONS.md` reports. |
| `emissions.json` | Provenance artifact: tables, row counts, date ranges, the unit check, coverage thresholds, timezone sensitivity. |

## Things worth knowing before you change anything

- **`co2_mass_tons` is short tons.** Verified empirically, not assumed. See
  `build.check_units()` and section 2 of the write-up. Never publish a CO2 number
  without its unit.
- **Coverage gates publication.** CEMS covers fossil units that report to EPA. A region
  whose CEMS gross generation is not between 0.70 and 1.40 of its EIA-930 net fossil
  generation is dropped, not published. Thresholds were set before any result was seen.
  Pooled coverage on the published set is 1.008 to 1.050, which is the expected
  gross-to-net gap and is the main evidence that the join is right.
- **Local time comes from the BA's `report_timezone`,** the same conversion the frozen
  detector uses, so the CO2 numerator and the generation denominator cover the same
  hours. A plant-own-timezone variant is computed as a sensitivity.
- **Zones inherit the parent BA,** flagged `co2_inherited_from_ba`, mirroring
  `cf_inherited_from_ba` in the shipped pipeline.
- **"Consistent with", never "caused by".** Nothing here shows that a datacenter caused
  a ton of CO2.
