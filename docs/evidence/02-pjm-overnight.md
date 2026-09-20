# The PJM finding

**The claim:** in PJM, overnight clean generation has not grown since 2019, while total
overnight generation rose 8.7 GW and gas supplied more than all of it.

## The numbers

| | 2019 | 2025 | change |
|---|---|---|---|
| Overnight clean generation | 35,700 MW | 35,619 MW | **-81 MW** |
| Overnight total generation | 82,539 MW | 91,240 MW | **+8,701 MW** |
| Overnight carbon-free share | 0.433 | 0.390 | |

## Which fuel supplied the growth

| fuel | change, GW |
|---|---|
| gas | +10.74 |
| wind | +1.07 |
| other | +0.41 |
| oil | +0.15 |
| solar | +0.01 |
| hydro | -0.22 |
| nuclear | -0.95 |
| coal | -2.52 |

**Why gas exceeds the total:** coal fell and nuclear fell. Gas replaced those *and*
supplied the growth. It is coal-to-gas switching plus new load, and we say so.

## Where it comes from

`server/static_export/region/PJM.json` → `cf_avg_mw`, `total_avg_mw`,
`fuel_delta_overnight_gw`. Reproduce from the raw federal table with
`docs/headline_from_raw.py`.

## The cross-check nobody asks for but you should give

EPA smokestack monitors measured PJM's overnight CO2 independently: **66,643,207 short
tons in 2019, 70,601,199 in 2025**, a rise of 3.96 million tons. But carbon *intensity*
**fell**, from 334 to 321 kg per MWh. So the correct sentence is not "it got dirtier":
coal retirements saved 3.03 million tons, extra generation added 6.99 million, and **load
growth ate the entire decarbonisation benefit and 4 million tons more**.
