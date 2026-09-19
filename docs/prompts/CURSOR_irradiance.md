# Cursor brief — the irradiance screen

## What this project is

Wattson measures the carbon-free share of electricity generation for every US grid
region, every hour, from federal EIA-930 data via PUDL. 4.45 million hourly rows,
70 balancing authorities, 2018-2026.

**The finding:** since 2019 the US grid got dramatically cleaner *during the day* and
stood still *at night*. Nationally, daytime carbon-free share went 0.372 -> 0.465 while
overnight went 0.405 -> 0.397. A datacenter draws the same power at 3am in January as at
noon in June, so roughly half of AI's electricity lands in the hours that never improved.
In PJM, the grid serving the world's largest datacenter cluster, overnight clean
generation was 35,700 MW in 2019 and 35,619 MW in 2025 — flat — while total overnight
generation grew 8.7 GW. Every added overnight gigawatt was fossil.

**Your screen answers the obvious follow-up: why did the day improve and the night not?**
The answer is solar, and solar is driven by sunlight, which is measured from orbit. We
pulled NASA POWER satellite surface irradiance for five regions, 2019-2025, 2,557 days
per point.

**The result is a null result, and that is the point.** Irradiance is FLAT everywhere —
1.06% to 2.65% year-to-year variation, no trend. The sun did not change. That rules out
weather and leaves one explanation: we built solar, and solar only works in the day.

## Build

A screen titled something like "Why the day got clean and the night didn't".

**One chart, dual axis:**
- national DAYTIME carbon-free share by year (rising, 0.372 -> 0.465)
- national OVERNIGHT carbon-free share by year (flat/falling, 0.405 -> 0.397)
- satellite irradiance on the right axis (flat)

**One callout — ERCOT North, the clearest case:**
daytime clean share **+28.9 points** while irradiance moved **+3.4%** and overnight moved
**+1.4 points**. Same sun, opposite outcomes, day versus night.

**Then a Grok Voice API call** that narrates a region summary aloud on click. Generate the
script from the data, not hardcoded, so it works for any region in the file.

## Data

`claims/derived/irradiance.json` — already computed, do not recompute or re-fetch.

```
{ generated, source, parameter, units, baseline_year, compare_year,
  purpose, national_reference, conclusion, caveats,
  regions: [ {
    region: "PJM/DOM",
    name: "Dominion Virginia Power zone",
    point: { lat, lon, place, note: "representative point, not a centroid" },
    cf_inherited_from_ba: true,
    cf_share_actually_describes: "PJM",       // IMPORTANT, see constraints
    irradiance: {
      units: "kWh/m^2/day",
      years: ["2019", ... "2025"],
      annual_mean: { "2019": 4.0013, ... },
      mean, range,
      year_to_year_variation_pct: 1.16,
      is_flat: true,
      change_pct_2019_2025: 0.92
    },
    cf_share: {
      "2019": { daytime, overnight },
      "2025": { daytime, overnight },
      daytime_change_pts, overnight_change_pts
    },
    verdict: "supports" | "does_not_separate" | "contradicts" | "unusable",
    scale_mismatch_note: "..."
  } ] }
```

National series: `dashboard/public/data/regions.json` -> `meta.national.cf_share`,
keyed by year with `overnight`, `daytime` and `all`.

## Honesty constraints — hard requirements, not style notes

This project's credibility rests on not overclaiming. Violating any of these is worse
than not shipping the screen.

1. **Never say or imply the sun got brighter.** Irradiance is flat. The story is "the
   resource was always there in the day and never at night, and we built to catch it in
   the day." Flatness is the finding.

2. **Only 2 of 5 regions separate cleanly.** ERCOT North and Dominion support it. Omaha
   does not separate (SPP is wind-led, and wind is not diurnal, so both halves rose
   together). California contradicts it (overnight rose faster than daytime). Phoenix is
   unusable (its generation-side data is under correction). **Do not present this as "the
   overlay confirms our finding across regions."** Show ERCOT North as an illustration.
   Render the per-region `verdict` field honestly, including the failures.

3. **A single lat/lon is not a grid region.** Three of the five are zones whose carbon-free
   share is inherited from a much larger parent — `cf_share_actually_describes` tells you
   which. PJM spans Chicago to New Jersey while the irradiance point is Ashburn. Render
   `scale_mismatch_note` on screen, not just in a tooltip.

4. **Two different statistics.** `year_to_year_variation_pct` (the "flat" band) and
   `change_pct_2019_2025` (the endpoint change) are not comparable — for ERCOT North the
   endpoint change (+3.4%) is larger than the variation band (2.65%). If you show both,
   label them distinctly.

5. **No causal language.** No regressions presented as causal, no "X% explained by". This
   is an illustration of a mechanism, not an estimate of one. There is a test in the repo
   that fails on causal-sounding field names; do not work around it.

## Done when

The screen renders from `irradiance.json` with no hardcoded numbers, shows all five
regions including the two that fail, the Grok Voice narration plays and is generated from
the data, and nothing on screen says the sun changed.
