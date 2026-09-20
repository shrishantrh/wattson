# Palo Verde: closing the plant-level gap in the AZPS correction

Wattson works at balancing-authority resolution, from the EIA-930 hourly tables. That is
enough to prove two balancing authorities reported the same generation, and not enough to
say which physical plant it was. So our published correction carried a gap, in our own
words, in `claims/derived/corrections.json`:

> High-confidence inference, not proof: the plant is Palo Verde (the only nuclear station
> in Arizona, magnitude matches its nameplate, profile flat across all hours), and EIA
> corrected the attribution so it counts once, under SRP. **Not confirmed against
> plant-level EIA-860 data.**

This adds a second PUDL dataset, EIA-860, which is one row per plant, per generator and
per owner, and closes that sentence.

Code: `engine/plants/`. Run `python3 -m engine.plants` (under 2 seconds) or
`python3 -m engine.plants --json` to also write `engine/plants/evidence.json`.
Tests: `python3 -m pytest engine/plants/tests/` (8 passing).

---

## Verdict

**CONFIRMED**, with one clause EIA-860 structurally cannot reach, and **one number of ours
is mislabeled.**

| Clause we published | EIA-860 says | Status |
|---|---|---|
| The plant is Palo Verde | plant_id_eia **6008**, Wintersburg, Maricopa County, AZ | confirmed |
| The only nuclear station in Arizona | the only nuclear plant in AZ in any year of EIA-860 | confirmed |
| Magnitude matches its nameplate | nameplate **4,209.6 MW**, net summer 3,937 MW | confirmed, but see below |
| EIA corrected it so it counts once, **under SRP** | EIA-860 records the plant in the **SRP** balancing authority, and has never recorded it under any other | confirmed |
| (not claimed) Why both had a claim to it | **jointly owned: APS 29.10%, SRP 17.49%**, APS operates, SRP owns the transmission | new, and stronger than magnitude matching |
| `...on a single date, 2019-12-04` | EIA-860 is annual and shows no change around that date | **not reachable in EIA-860** |
| `...a 3,937 MW plant nameplate` | 3,937 MW is the **net summer capacity**. Nameplate is 4,209.6 MW | **our label is wrong** |

The ownership finding is the one that matters. Before today the argument was "this is about
the size of the only nuclear plant in the state." Now it is "both utilities own the plant,
so both had a reason to report it, and EIA-860 says only one of them is its balancing
authority." That is a mechanism, not a coincidence of magnitude.

---

## The question

Through 2019, AZPS and SRP each reported a nuclear generation series in EIA-930. The two
series correlate at 0.9948 over 7,976 hours and are identical within 5 MW in 98.8% of them.
One of them stops on 2019-12-04 and never returns. We published that this was one plant
counted twice, inferred it was Palo Verde, and said so as an inference.

Three things had to be true and were untested: that Palo Verde is what the magnitude points
to, that something links both utilities to it, and that SRP is the right place to count it.

---

## Tables used

Fetched from `s3://pudl.catalyst.coop`, release `stable`, whose objects are dated
2026-09-12 UTC. Spot-checked against the pinned releases: `stable/core_eia860__scd_plants`
has the same ETag and size as `v2026.9.0/core_eia860__scd_plants` and a different one from
`v2026.8.0`, so `stable` is v2026.9.0 as of this fetch. Anonymous access, no credentials,
via the Voloridge fetch script `scripts/vendor/pudl_fetch.py`. Nine tables were fetched
for this, 31 MB together; the EIA-930 table was already part of the pipeline.

| Table | Rows read | What it gave |
|---|---:|---|
| `core_eia__entity_plants` | 19,904 | plant name, state, county, coordinates |
| `core_eia860__scd_plants` | 252,168 | **balancing authority code** by plant-year, operator, T&D owner |
| `core_eia860__scd_generators` | 666,422 | **nameplate**, net summer and winter capacity, fuel, status |
| `core_eia860__scd_ownership` | 106,281 | ownership shares, read through its denormalized twin, which carries identical rows |
| `out_eia860__yearly_ownership` | 106,281 | **owner shares with names**, the table quoted below |
| `core_eia__entity_generators` | 43,227 | generator operating dates |
| `core_eia__entity_utilities` | 17,429 | utility names for the owner IDs |
| `core_eia930__hourly_net_generation_by_energy_source` | 196,080 | filtered read (AZPS and SRP, nuclear only) to hold reported MW against plant capacity |

Two more tables were fetched and not needed for the finding: `out_eia__yearly_plants`,
`out_eia__yearly_generators`. Every table named in the task brief exists in this release;
none had to be substituted.

---

## 1. The plant

`core_eia__entity_plants` has exactly two US plants whose name contains "Palo Verde":

| plant_id_eia | name | city | county | state |
|---|---|---|---|---|
| 57773 | Palo Verde College | Blythe | Riverside | CA |
| **6008** | **Palo Verde** | Wintersburg | Maricopa | **AZ** |

Plant 6008 it is. Three generators, all nuclear, from `core_eia860__scd_generators` for
report year 2019:

| generator_id | nameplate MW | net summer MW | net winter MW | fuel | ownership code | operating date |
|---|---:|---:|---:|---|---|---|
| 1 | 1,403.2 | 1,311 | 1,333 | NUC | J (jointly owned) | 1986-01-01 |
| 2 | 1,403.2 | 1,314 | 1,336 | NUC | J | 1986-09-01 |
| 3 | 1,403.2 | 1,312 | 1,334 | NUC | J | 1988-01-01 |
| **total** | **4,209.6** | **3,937.0** | **4,003.0** | | | |

Nameplate has been 4,209.6 MW since 2014 and 4,209.3 MW before that. Net summer capacity
has been 3,937 MW every year since 2010. The `ownership_code` of `J` is EIA-860 flagging
the plant as jointly owned, which is the next section.

## 2. Our 3,937 MW figure is net summer capacity, not nameplate

`engine/diagnostics/azps.py:24` hardcodes `PALO_VERDE_NAMEPLATE_MW = 3937`, and the
sentence built from it appears in `claims/derived/corrections.json` **nine** times: in
`confidence_tiers.proven` and in the `evidence` of eight of the ten AZPS corrections. The
two that escape it, `siting.siting_score` and `siting.siting_rank`, have their own
evidence text.

3,937 MW is real and it is in EIA-860, but it is the **net summer capacity**. The nameplate
is **4,209.6 MW**. The ratio in the argument moves from 7,087 / 3,937 = 1.80 to
7,087 / 4,209.6 = 1.68. The argument is unchanged, since either number is far below what
two BAs jointly reported. The label is wrong, and it is wrong in nine places.

This is our own kind of error: a number that is real, that came from somewhere, and that
nobody traced to a source. It is the second time on this project that a figure survived
because it looked plausible, and it was caught by going to the plant-level table, which is
the whole point of the exercise.

## 3. Ownership: the mechanism

This is the table the task asked for, from `out_eia860__yearly_ownership`, plant 6008,
report year 2019. Shares are identical across all three units and sum to exactly 1.0.

| owner_utility_id_eia | owner_utility_name_eia | owner_state | fraction_owned |
|---:|---|---|---:|
| **803** | **Arizona Public Service Co** | AZ | **0.2910** |
| **16572** | **Salt River Project** | AZ | **0.1749** |
| 5701 | El Paso Electric Co | TX | 0.1580 |
| 17609 | Southern California Edison Co | CA | 0.1580 |
| 15473 | Public Service Co of NM | NM | 0.1020 |
| 17513 | Southern California P P A | CA | 0.0591 |
| 11208 | Los Angeles Department of Water & Power | CA | 0.0570 |
| | | | **1.0000** |

Operator: `utility_id_eia` 803, Arizona Public Service, the same utility that is AZPS.
Every share is unchanged from 2017 through 2025, so no ownership transfer happened in 2019.

**APS and SRP both own Palo Verde.** APS operates it and owns 29.10%. SRP owns 17.49%.
That is the mechanism for a double count: two utilities, each with a real claim on the
plant, each reporting it into EIA-930 as generation in their own footprint.

One correction to how this should be phrased. Each BA reported roughly the **whole** plant,
not its ownership share. APS's 29.10% of nameplate is 1,225 MW and SRP's 17.49% is 736 MW,
yet AZPS averaged 3,620 MW and SRP averaged 3,622 MW over the 7,976 overlapping hours. So
joint ownership explains why both parties believed the plant was theirs to report; it does
not mean the reports were shares that happened to overlap. Both reported all of it.

## 4. Balancing authority attribution

From `core_eia860__scd_plants`, plant 6008:

| report year | balancing_authority_code_eia | operator utility_id_eia | transmission and distribution owner |
|---|---|---|---|
| 2013 through 2026 | **SRP** | 803 (Arizona Public Service) | **Salt River Project** (16572) |
| 2001 through 2012 | (null: the field did not exist) | 803 | |

`SRP` is the only balancing authority code EIA-860 has **ever** assigned to Palo Verde.
The field is null before 2013 because EIA did not collect it, not because it was something
else. EIA-860 also records SRP as the plant's transmission and distribution owner in 2018,
2019 and 2020.

So the direction of our correction is right: the plant belongs in SRP, and the AZPS series
was the erroneous one. Note what this changes about the story. We wrote that "EIA corrected
the attribution." EIA-860 says the attribution was never in doubt: SRP, before and after.
What EIA fixed on 2019-12-04 was EIA-930, and it had carried the duplicate from the first
hour AZPS reported a fuel breakdown at all. The fuel-level table starts 2015-07-01; AZPS's
own fuel values start 2018-07-01; AZPS reported nuclear in every one of those hours until
2019-12-04. SRP's nuclear series starts 2018-07-25 and runs to the present.

**What EIA-860 cannot do.** It is an annual survey. It has one row per plant per year. It
cannot place a change on 2019-12-04, and it shows none around it. The date stands on the
EIA-930 evidence alone, which is where it always stood. Anyone reading our correction
should understand that EIA-860 confirms *which* attribution is correct and says nothing
about *when* EIA-930 was brought into line. `engine/plants/tests/test_palo_verde.py`
asserts this limit explicitly so it does not get quietly forgotten.

## 5. Ruling out the alternatives

The brief asked for elimination rather than confirmation of the first candidate.

**Nuclear.** Palo Verde is the only nuclear plant in Arizona in EIA-860, in any year. It is
the only nuclear plant anywhere whose EIA-860 balancing authority is SRP. And **no nuclear
plant anywhere in the United States is recorded under AZPS in any year EIA-860 carries a
balancing authority code at all**, which is 2013 onward: no plant of any fuel has that
field before 2013, so the null years are a collection gap and not a different answer. The
AZPS nuclear series in EIA-930 has no plant-level basis.

**Anything else large enough.** Every Arizona plant at or above 400 MW nameplate operating
in 2019, from `core_eia860__scd_generators` joined to the plant record:

| plant_id_eia | plant | BA | nameplate MW | fuel |
|---:|---|---|---:|---|
| 6008 | Palo Verde | SRP | 4,209.6 | nuclear |
| 8223 | Springerville | TEPC | 1,779.2 | coal, solar |
| 8068 | Santan | SRP | 1,326.0 | gas |
| 55372 | Harquahala Generating Project | HGMA | 1,325.1 | gas |
| 153 | Glen Canyon Dam | WALC | 1,312.0 | hydro |
| 117 | West Phoenix | AZPS | 1,207.4 | gas |
| 55455 | Red Hawk | SRP | 1,140.3 | gas |
| 8902 | Hoover Dam (AZ) | WALC | 1,039.4 | hydro |
| 116 | Ocotillo | AZPS | 915.7 | gas |
| 113 | Cholla | AZPS | 839.9 | coal |
| 6177 | Coronado | SRP | 821.8 | coal |

and 17 more, all below 730 MW and all gas or coal by primary fuel (one, Agua Fria, has a
small solar component). The full list is in the CLI output and in
`engine/plants/evidence.json`.

Nothing else fits. The duplicated series is **nuclear** in EIA-930's fuel breakdown, which
eliminates every gas, coal and hydro plant on the list by fuel alone. The two next largest
carbon-free plants in Arizona are Glen Canyon Dam (1,312 MW) and Hoover Dam (1,039 MW),
both hydro, both recorded under WALC, and neither is within a factor of three of the
3,620 MW each BA was reporting. The largest carbon-free plant EIA-860 does put under AZPS
is Solana Generating Station at 280 MW.

**The one near miss, checked and rejected.** Four Corners (plant 2442, Fruitland, New
Mexico) is a 2,269.6 MW station that EIA-860 places in the AZPS balancing authority and
that is jointly owned by APS, SRP, PNM, Tucson Electric and El Paso Electric. It has the
same ownership pattern as Palo Verde, so it is the honest alternative to test. It fails on
fuel: EIA-860 records it as coal, and the duplicated EIA-930 series is nuclear.

## 6. Holding the reported MW against the capacity

With the nameplate established at 4,209.6 MW, the EIA-930 series can be read against a real
physical limit rather than against a number we typed.

| | MW | as a multiple of 4,209.6 MW nameplate |
|---|---:|---:|
| AZPS mean, 2019 overlap | 3,620 | 0.86 |
| SRP mean, 2019 overlap | 3,622 | 0.86 |
| **combined mean, 2019-06-01 to 12-03** | **7,087** | **1.68** |
| **peak combined single hour** | **8,041** | **1.91** |
| combined mean, 2020-01-01 to 06-30 (after) | 3,637 | 0.86 |

Each BA on its own reports a number a single Palo Verde can produce. Together they report
up to 8,041 MW in one hour from a plant whose nameplate is 4,209.6 MW. A plant cannot
produce 1.91 times its nameplate. After 2019-12-04 the total drops to exactly one plant's
worth and stays there. That is the double count, closed against a physical limit.

A coherence check on the corrected figures, not a claim. Our overlay puts AZPS 2019
overnight clean generation at 34.7 MW against a published 3,373 MW. EIA-860's entire AZPS
carbon-free fleet in 2019 is **943.5 MW across 39 plants, all solar and wind**: no nuclear,
no hydro, no geothermal. Of that, 164 MW is wind (Perrin Ranch 99.2 MW, Poseidon 65.1 MW),
and the largest plant is Solana Generating Station at 280 MW, which EIA-860 labels "Solar
Thermal with Energy Storage". A fleet that small, that solar-heavy, cannot average
3,373 MW overnight; a few tens of MW is the right order of magnitude.

---

## What `claims/derived/corrections.json` should now say

**Not changed by this work. Three edits are recommended; the call is the maintainer's.**

**1. Fix the mislabeled capacity, in nine places.** `confidence_tiers.proven` and the
`evidence` field of eight of the ten AZPS corrections currently end with:

> combined 7,087 MW against a 3,937 MW plant nameplate

It should read:

> combined 7,087 MW against a 4,209.6 MW nameplate (3,937 MW net summer capacity),
> EIA-860 plant 6008

`engine/diagnostics/azps.py:24` should change with it: `PALO_VERDE_NAMEPLATE_MW = 3937`
is the net summer capacity. That file is in `engine/diagnostics/`, not mine, so it is
flagged and not touched.

**2. Promote the inference and keep its one honest limit.**
`confidence_tiers.high_confidence_inference` currently ends "NOT CONFIRMED AGAINST
PLANT-LEVEL EIA-860 DATA." Suggested replacement:

> Confirmed against EIA-860 (`engine/plants/`, PUDL release v2026.9.0): the plant is Palo
> Verde, plant_id_eia 6008, the only nuclear station in Arizona in any year of EIA-860 and
> the only nuclear plant anywhere recorded in the SRP balancing authority. It is jointly
> owned, Arizona Public Service 29.10% and Salt River Project 17.49% among seven owners,
> and operated by Arizona Public Service, which is why both utilities had a claim to
> report it. EIA-860 records the plant under the SRP balancing authority for every year
> from 2013 to 2026 and under no other, so counting it once under SRP is the correct
> treatment. Not confirmed by EIA-860: the date. EIA-860 is annual, shows no change around
> 2019-12-04, and cannot date the moment EIA-930 was brought into line. The date rests on
> the EIA-930 step alone.

**3. A wording change, optional.** "EIA corrected the attribution so it counts once, under
SRP" implies the attribution moved. EIA-860 says it never did. More precisely: EIA-930 had
carried an AZPS nuclear duplicate from the first hour AZPS reported a fuel breakdown,
2018-07-01, and it was removed on 2019-12-04. EIA-860's answer was SRP the whole time.

---

## Honesty notes

- EIA-860 is an annual survey. Every fact here is a year-resolution fact.
- EIA-860 says who owns and operates a plant and which balancing authority it sits in. It
  has no field for a reporting error, so it cannot say why EIA-930 carried one, or who
  noticed.
- The 0.9948 correlation, the 7,976 hours and the 2019-12-04 step are EIA-930 facts, not
  EIA-860 facts. This work reproduced all three exactly from the same table the original
  investigation used; it did not re-derive them from a new source.
- Reporting an ownership share is not what EIA-930 asks for. EIA-930 is generation inside a
  balancing authority footprint, so SRP reporting the whole plant is correct under the
  survey's own convention, and is consistent with the honesty rule we already publish: we
  measure generation within a footprint, not consumption.
- The AZPS demand-side detector rank of 3 is untouched by any of this. The detector has no
  generation term. That was true before this work and remains true.
