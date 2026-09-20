# The Arizona error we found in federal data

**The claim:** Arizona's clean share appears to collapse from 62% to 10% overnight. It is
not real. A nuclear plant was reported twice by two different grid operators.

## Why it cannot be real

Peak combined reported hour: **8,041 MW** from Palo Verde, whose nameplate is
**4,209.6 MW**. That is **1.91 times what the plant can physically produce.**

(3,937 MW, which we published for a while as the nameplate, is its net *summer* capacity.
We had that label wrong and corrected it.)

## Ownership: the mechanism

EIA-860, plant 6008. Seven owners, summing to exactly 1.0:

| owner | share |
|---|---|
| **Arizona Public Service** | **29.10%** |
| **Salt River Project** | **17.49%** |
| El Paso Electric | 15.80% |
| Southern California Edison | 15.80% |
| Public Service Co of New Mexico | 10.20% |
| Southern California Public Power | 5.91% |
| LA Dept of Water and Power | 5.70% |

APS and SRP each had a real claim to the plant, and **each reported the whole thing rather
than its share**. APS's share is 1,225 MW and SRP's is 736 MW, yet each reported about
3,620 MW.

## Three independent confirmations

1. **Hourly correlation.** AZPS and SRP reported the same generation hour by hour through 2019: correlation 0.9948 over 7,976 hours, identical within 5 MW in 98.8% of them, combined 7,087 MW against a 4,209.6 MW nameplate (3,937 MW net summer capacity), and a peak combined hour of 8,041...
2. **EIA-860 ownership**, above. Palo Verde is the only nuclear plant in Arizona, the only
   one anywhere recorded under SRP, and **no nuclear plant in any year is recorded under
   AZPS**. Arizona's entire AZPS carbon-free fleet in 2019 is 943.5 MW across 39 solar and
   wind plants.
3. **EPA smokestacks.** If the collapse were real, fossil plants would have fired up to
   replace it. Measured: fossil generation **flat** at 2,033 to 2,043 MW, and CO2 **down
   17.5%**. A clean fleet cannot vanish without carbon appearing.

## What we do not claim

Not reachable from EIA-860, which is annual: it records Palo Verde under SRP for every year from 2013 through 2026 and shows no change around 2019-12-04. The attribution never moved. What was corrected on that date was EIA-930, which had carried the AZPS duplicate from the first hour AZPS reported a fuel breakdown at all, 2018-07-01. That date rests on EIA-930 alone.

## Where to look

`claims/derived/corrections.json`, `engine/plants/`, `docs/PLANTS.md`. The site shows the
published and corrected numbers side by side on the Arizona region page.
