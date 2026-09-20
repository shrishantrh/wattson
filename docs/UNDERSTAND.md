# Wattson, explained from scratch

For reading end to end before a demo. It builds the argument one step at a time, and for
every number it says what the number *means*, where it comes from, and what it proves.
If you can explain section 2 out loud, you can defend the whole project.

---

## 1. The vocabulary, in plain words

You need five terms. Everything else is built from them.

**Grid region (balancing authority).** The US grid is cut into about 70 areas. Each has one
organization responsible for keeping supply and demand matched, minute to minute. PJM is
one. ERCOT is Texas. They are *organizational*, not geographic: PJM stretches from Chicago
to New Jersey. Some have sub-zones, like Dominion inside PJM, and a zone reports how much
power it *used* but not what generated it. That matters later.

**Carbon-free share.** Of all the electricity generated in one region in one hour, the
fraction that came from sources that burn nothing: nuclear, hydro, wind, solar, geothermal.
If a region generated 100 MW that hour and 40 came from those, its carbon-free share is
0.40. We never call this "clean energy the company bought." It is what the wires in that
area physically carried.

**Overnight and daytime.** Overnight is midnight to 5:59am, local time where the power is.
Daytime is 10am to 3:59pm. Local time is the whole point: 3am in Texas is not 3am in Maine.

**Talk score.** How bold a company's public claim is: how big the number, how precisely
stated, how little hedged. "100% renewable" scores high. "100% of annual consumption
matched with market-based certificates" scores lower, because every qualifier narrows it.

**Walk score.** What the grids under that company's datacenters actually generated. No
contracts, no certificates. Just the power on the wire.

The project is the gap between talk and walk.

---

## 2. The argument, one step at a time

This is the part to know cold. Each step is a claim, and each claim has evidence.

### Step 1 — A datacenter is the only big customer with flat demand.

A house peaks in the evening when people come home. A factory runs on shifts. A datacenter
draws **the same power at 3am in January as at noon in June.** Servers do not sleep.

*Why it matters:* every other customer can be partly served by power that is only available
sometimes. A datacenter cannot.

### Step 2 — Almost all the clean power built since 2019 is solar, and solar only works in daylight.

*Evidence:* since 2019 the US added **64.7 GW** of clean generation to the average midday
hour and **17.7 GW** to the average overnight hour. Nearly four times as much to the hours
the sun is up.

*Where that comes from:* the hourly generation table, summed across every reporting region,
split by local hour, 2019 against 2025. Corrected for one double-counting error we found
(section 5).

### Step 3 — So at 3am, a datacenter runs on whatever the grid has left, and that is mostly gas.

*Evidence, the sharpest one we have:* in PJM, the grid serving the largest datacenter
cluster on earth, overnight clean generation was **35,700 MW in 2019 and 35,619 MW in 2025.**
It did not move. Meanwhile total overnight generation rose **8,701 MW**, and gas rose
**10,739 MW** while coal fell 2,518.

Read that again slowly, because it is the whole project: **the extra power PJM generates at
night, it generates by burning gas.** Not one net megawatt of the growth was clean.

### Step 4 — But companies report their clean energy annually, which hides this.

A company buys enough clean energy over a **year** to match its total consumption. That is
a real accounting standard, the GHG Protocol market-based method, and it is legitimate.

But annual matching averages over the hours. A megawatt of solar bought at noon cancels a
megawatt of gas burned at 3am, on paper, because both are just numbers in an annual total.

*Why this is the crux:* the mismatch is **invisible at annual resolution and obvious at
hourly resolution.** We did not find new data. We refused to average over the hours.

### Step 5 — So the claim can be completely true and still describe a facility that ran on gas every night.

This is why we never say a company lied. The claim is true under the standard. Our verdict
is **"true on paper, X% in reality."**

*Evidence:* Google says 100% renewable. Its ten mapped sites sit on grids that ran between
**6% and 91%** carbon-free. Same company, same annual claim, a fifteen-fold spread in what
is physically behind it.

### Step 6 — And you can only check it if you know which grid each datacenter is on.

This is the unglamorous part that makes the rest possible, and it is hand-built. Which grid
a site draws from is **not** a map lookup. IREN's site in the Texas Panhandle sits in a
county where most neighbors are on the regional grid, but it wires directly into ERCOT.
One wrong row flips a verdict. All 134 sites are traced through the utility that actually
serves them, each with a cited source.

---

## 3. Say it like a person

The version that is a fact and means nothing:

> "The US added 64.7 GW of clean power to midday and 17.7 GW to 3am. A datacenter runs both."

The version that explains itself:

> "When a company buys clean power for a datacenter, it is mostly buying solar, because
> solar is what got built. But the datacenter keeps running after dark, and after dark the
> grid burns gas. The annual accounting lets the midday solar cancel out the 3am gas,
> because it only compares yearly totals. Our numbers say how lopsided that is: since 2019
> America added 64.7 gigawatts of clean power to the average midday hour and only 17.7 to
> the average hour at 3am."

Then the proof:

> "And in PJM, which serves the biggest datacenter cluster in the world, clean power at
> night has not grown at all since 2019. It was 35,700 megawatts then. It is 35,619 now.
> Everything they added at night, they added by burning gas."

---

## 4. Every headline number: what it is, where it lives

| Number | In plain words | Where it comes from |
|---|---|---|
| **4.45 million hours** | every hour, for every US grid region, 2018 to 2026 | rows in the hourly generation table |
| **70 / 111** | 70 grid regions report generation; 111 regions (including sub-zones) get scored | `api/regions.json` → `count` |
| **64.7 GW vs 17.7 GW** | clean power added to the average midday hour vs the average 3am hour since 2019 | `regions.json` → `meta.national.cf_avg_mw`, corrected for the Arizona error |
| **35,700 → 35,619 MW** | PJM's clean power at night, 2019 vs 2025. Flat | `api/region/PJM.json` → `cf_avg_mw` |
| **+8,701 MW / +10,739 gas** | PJM's extra night generation, and the gas that supplied it | `fuel_delta_overnight_gw` |
| **6% to 91%** | Google's dirtiest and cleanest site grids at night | `api/company/GOOGL.json` → `sites[].cf_share_2025` |
| **52 operators, 134 sites** | how many companies and datacenters we mapped | `claims/lookup/facilities.csv` |
| **0.1%** | El Paso Electric's clean share at 3am. 1 MW of 655 | `api/region/EPE.json` |
| **100%** | Grant County PUD at 3am, all year. Columbia River hydro | `api/region/GCPD.json` |
| **Spearman 0.877** | our 2019-2025 ranking still matches when re-run on 2026 data | `engine/stats/results/` |
| **7.8%** | how much of overnight demand growth is explained by weather | `engine/weather/results/` |
| **1.91×** | two grid operators reported the same nuclear plant, totalling 1.91 times what it can physically produce | `engine/plants/` |

---

## 5. The error we found in the federal data

Worth knowing in detail, because it is the most impressive thing we did and it is easy to
tell.

Arizona's clean share appeared to collapse, from 62% of overnight generation in 2019 to 10%
in 2025. That would be an enormous story. **It is not real.**

Palo Verde is the only nuclear plant in Arizona. It is **jointly owned**: Arizona Public
Service owns 29.1%, Salt River Project owns 17.5%, five others hold the rest. Both APS and
SRP reported the plant's output to the federal government, and **each reported the whole
plant rather than its share.** For 18 months the same electricity was counted twice.

How we know, three separate ways:

1. **The two reports match hour for hour.** Correlation 0.9948 over 7,976 hours, identical
   within 5 MW in 98.8% of them. Then it stops on a single day, 2019-12-04, in a step.
2. **The combined total is physically impossible.** Peak combined hour: 8,041 MW from a
   plant whose nameplate is 4,209.6 MW. **1.91 times what it can produce.**
3. **The smokestacks agree.** If the clean collapse were real, fossil plants would have had
   to fire up to replace it. Measured CO2 from EPA monitors: Arizona's fossil generation
   flat at about 2,040 MW, and CO2 **down 17.5%.** A clean fleet cannot vanish without a
   ton of carbon appearing.

We found this in our own output, and the site shows **both** the published number and the
corrected one, side by side.

---

## 6. See it yourself in the raw data

The federal table is `core_eia930__hourly_net_generation_by_energy_source`. Six columns:

| column | what it holds |
|---|---|
| `datetime_utc` | the hour |
| `balancing_authority_code_eia` | which grid region, e.g. `PJM` |
| `generation_energy_source` | `nuclear`, `gas`, `coal`, `solar`, `wind`, ... |
| `net_generation_adjusted_mwh` | megawatt hours from that fuel, that hour. **The one we use** |
| `net_generation_reported_mwh` | what the operator first submitted |
| `net_generation_imputed_eia_mwh` | EIA's gap fill |

`docs/headline_from_raw.py` reproduces the PJM headline from that file in about fifteen
lines: filter to PJM, drop storage, shift to local time, keep hours 0 to 5, sum by year.
It prints:

```
  2019 overnight:  clean    35,744 MW   of total    82,506 MW   = 43.3%
  2025 overnight:  clean    35,573 MW   of total    90,265 MW   = 39.4%
```

Those are within about 0.4% of our published figures. The small gap is real and worth
understanding: the quick script uses a fixed five-hour offset, while the shipped pipeline
handles daylight saving properly and drops partial months. **If a judge asks whether you
can reproduce your own result, run this.**

---

## 7. What we do not claim

Say these before you are asked. They make everything else more believable.

- **We never say a company lied.** Annual claims are true under the standard.
- **We measure generation inside a region, not consumption.** A region importing clean
  power gets no credit for it.
- **Average mix, not the marginal plant.** What actually fires up when a new datacenter
  switches on is usually dirtier than the average, so if anything we understate.
- **Regions are coarse.** PJM is one number from Chicago to New Jersey.
- **Flat load is not only datacenters.** Crypto and oilfield electrification look the same,
  and one of our own top regions, ERCOT Far West, is probably the Permian oilfield.
- **Eleven of our sites make their own power**, so federal data cannot see them at all.
- **We got one of our four test regions wrong.** Dallas came 91st. We published it.
