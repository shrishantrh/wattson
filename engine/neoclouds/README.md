# Neoclouds and converted miners

The four hyperscalers are the obvious list. The companies actually adding flat
24/7 load in 2025-26 are the neoclouds, and most of them are **converted
bitcoin miners** operating in the two regions our detector already ranks first
and second.

```bash
source ~/hackmit-venv/bin/activate
python3 -m engine.neoclouds
```

Writes `claims/derived/neocloud_facilities.csv` (same columns as
`claims/lookup/facilities.csv`, append-ready) and
`claims/derived/curtailment_check.json`.

The rows are written to a separate file rather than appended in place, because
`claims/lookup/facilities.csv` belongs to another branch. Merging is
`tail -n +2 claims/derived/neocloud_facilities.csv >> claims/lookup/facilities.csv`.

## Eight sites, mapped serving-utility outward

| company | metro | state | BA | serving utility |
|---|---|---|---|---|
| IREN | Childress | TX | **ERCO** | AEP Texas |
| TeraWulf / Fluidstack | Abernathy | TX | **SWPP** | Xcel / Southwestern Public Service |
| Riot Platforms | Rockdale | TX | ERCO | Oncor |
| Riot Platforms | Corsicana | TX | ERCO | Oncor |
| Cipher Digital | Wink (Winkler Cty) | TX | ERCO | *unresolved* |
| TeraWulf | Barker (Lake Mariner) | NY | NYIS | NYSEG + NYPA |
| Applied Digital | Ellendale | ND | MISO | *unresolved* |
| CoreWeave | Ellendale (leased) | ND | MISO | *unresolved* |

Nebius, Core Scientific and IREN's Sweetwater/Oklahoma sites are **deliberately
omitted**: no individual site could be tied to a serving utility from public
sources, and coverage without a source is what this table exists to prevent.
Three sites carry a blank utility with a stated reason rather than a guess.

`zone` is blank on every row, matching the existing lookup. ERCOT weather zones
are geographic, and deriving one from a county is the state-level inference
this table exists to avoid.

## Two boundary traps, 120 miles apart, pointing opposite ways

**Childress, TX is ERCOT** — our own spec flagged it as "naive SWPP, likely
ERCO, VERIFY". Most of the Texas Panhandle genuinely *is* SPP, so geography
argues for SWPP. IREN interconnects directly to ERCOT at 345 kV under an AEP
connection agreement. Geography loses.

**Abernathy, TX is SPP** — a Texas site that is *not* ERCOT, served by
Xcel/SPS. A "Texas implies ERCOT" rule gets this one wrong in the other
direction.

Both are in the Panhandle. Either rule of thumb — "Panhandle means SPP" or
"Texas means ERCOT" — gets one of them wrong. Only the serving utility settles
it.

## The load shape stayed; the owner and the purpose changed

Our stated limitation is that the detector "cannot distinguish a datacenter
from a crypto mine." For these companies **that distinction does not exist**:
Cipher is winding down bitcoin at Black Pearl to redirect the same power and
land to AI tenants, and IREN's Horizon 1 is an AI build on the Childress
bitcoin campus. Same substations, same interconnects, same 24/7 shape.

So the limitation becomes the finding: **the detector flagged the region where
crypto is converting to AI before anyone checked who was there.** ERCO/FWES
ranks 2nd on +116% overnight demand growth and contains Black Pearl.

This is not an attribution. We cannot assign a megawatt to a company, and West
Texas load is oilfield electrification *and* crypto *and* the AI conversion in
one footprint. The honest claim is about where to look, not about who caused
what.

**CoreWeave illustrates why sites beat companies:** it owns no grid connection
at Ellendale. It leases the whole 400 MW campus from Applied Digital, so the
load appears as Applied Digital's. A company-level view misses it entirely.

## Curtailment: a bias in our own method, checked and reported

Riot curtailed **more than 95% of load** during the August 2023 ERCOT peak and
books demand-response credits. Their load is therefore *not* purely flat, and
the detector's third term rewards a **rising** load factor. A curtailing load
should be pushed down the ranking — penalising exactly the sites we most want
to flag.

**The mechanism is real.** Score correlates with `load_factor_delta` at
**r = +0.61** across 111 regions, at a term weight of 0.5.

**It does not show up where the curtailing sites are.** Every region hosting a
confirmed curtailing miner sits *above* the median on load factor change:

| region | rank | growth | load_factor_delta | percentile |
|---|---|---|---|---|
| ERCO/NRTH | 1 | +94.6% | +0.069 | 96th |
| ERCO/FWES | 2 | +116.1% | +0.015 | 80th |
| ERCO | 8 | +27.2% | +0.071 | 97th |
| SWPP/SPS | 23 | +11.4% | +0.078 | 98th |

The arithmetic explains it: demand response is **economically large and
temporally tiny**. A few dozen curtailed hours cannot move a load factor
computed over 8,760 of them, however much money those hours are worth.

**The caveat stands as a method caveat, not a correction.** A site curtailing
far more hours than these would be pushed down the ranking and we would not see
it. ERCO/WEST is the only ERCOT zone with a falling load factor (−0.023, 30th
percentile) and it ranks last of 111 — we cannot tell from this data whether
that is curtailment or simply a region that is not growing.

This reasons from the arithmetic of an annual load factor. It does not measure
curtailed hours, which are not in our data.
