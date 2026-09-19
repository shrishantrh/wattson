# Wattson glossary

## Grid operators

| Code | Full name | Say it as |
|---|---|---|
| PJM | PJM Interconnection, LLC | the Mid-Atlantic grid, Chicago to New Jersey. Serves Data Center Alley. **Our headline finding.** |
| ERCO | Electric Reliability Council of Texas | ERCOT, the Texas grid |
| MISO | Midcontinent ISO | the Midwest grid |
| CISO | California ISO | CAISO |
| SWPP | Southwest Power Pool | SPP, the wind belt |
| BPAT | Bonneville Power Administration | federal hydro, Pacific Northwest |
| TVA | Tennessee Valley Authority | federal |
| NYIS / ISNE | New York ISO / ISO New England | |

## Utilities in the demo

| Code | Who | Why |
|---|---|---|
| AZPS | Arizona Public Service | Phoenix. Detector #3. Ticker PNW. Generation-side figures corrected. |
| TEPC | Tucson Electric Power | Detector #4. Ticker FTS (Fortis). |
| SC | South Carolina Public Service Authority | Santee Cooper. Google's site. State-owned, no ticker. |
| SCEG | South Carolina Electric & Gas | Holds the V.C. Summer nuclear that makes SC's own footprint look worse than the power available to it. |
| PACW | PacifiCorp West | Meta Prineville. The trap: naive geography says BPAT. |
| GCPD | Grant County PUD | Microsoft Quincy. The opposite trap. ~100% Columbia hydro. |
| SRP | Salt River Project | Phoenix. Reports the Palo Verde nuclear AZPS double-counted through 2019. |
| WACM | Western Area Power Admin, Rocky Mountain | Still unexplained. Excluded from alerts. |
| SOCO | Southern Company Services | Ticker SO. |
| DUK | Duke Energy Carolinas | Ticker DUK. |
| OPPD | Omaha Public Power District | A ZONE of SWPP, not a BA. Public power, no ticker. |

## Zones

A zone is a slice inside a balancing authority. **Zones report demand only** and inherit
the parent BA's generation figures (`cf_inherited_from_ba: true`).

| Zone | What |
|---|---|
| PJM/DOM | Dominion / Northern Virginia. Detector #6. |
| PJM/AEP | Central Ohio. #19, a named validation region. |
| ERCO/NRTH | ERCOT North. #1, +95% demand growth. |
| ERCO/FWES | ERCOT Far West. #2, +116%. Permian electrification, crypto, and AI conversion in one footprint. |
| ERCO/NCEN | Dallas. #91 — the miss we report rather than tune away. |
| SWPP/OPPD | Omaha. #7. Meta's Papillion campus. |
| CISO/SDGE | San Diego. #10. |

## Data and terms

| Term | Meaning |
|---|---|
| EIA | US Energy Information Administration, the federal source |
| EIA-930 | EIA's hourly grid dataset. Our raw material. |
| PUDL | Public Utility Data Liberation Project. Voloridge's dataset; cleaned EIA data on public S3. |
| BA | Balancing authority: who keeps supply equal to demand on a chunk of grid. **Organizational, not geographic** — that is the trap that flips verdicts. |
| CF share | Carbon-free share: nuclear + hydro + wind + solar + geothermal over total. Always 0-1. |
| CFE | Carbon-free energy. Google's term. Their disclosed hourly CFE is flat at ~65%. |
| REC | Renewable Energy Certificate. A paper claim to clean power, not electrons. |
| PPA | Power Purchase Agreement. A contract. We exclude these deliberately. |
| IRP | Integrated Resource Plan: what a utility tells regulators it intends to build. |
| TDU | Transmission and distribution utility (Texas term: wires only, no retail). |
| MW / GW | Megawatt / Gigawatt (1,000 MW). Power. |
| MWh | Megawatt-hour. Energy. |
| Overnight | 00:00-05:59 local. |
| Daytime | 10:00-15:59 local. |

## The distinction the whole project rests on

**Annual matching** says: over a year we bought as many clean megawatt-hours as we used.
**Hourly / 24-7 CFE** says: clean power was physically on the wire at 3am.

Companies report the first. Wattson measures the second. Both can be true at once, which
is why our verdicts say "true on paper, X physically" and never "they lied".
