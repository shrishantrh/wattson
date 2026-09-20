# Wattson, understood completely

Read this end to end and you will be able to explain every number on the site, why it was
computed that way, and what it proves. Nothing here is a slogan. Section 5 is the demo,
click by click.

---

## 1. What this project is

Every company building AI datacenters publishes a clean-energy claim. The wording is
careful, and the care is the point. Google: *"we again matched 100% of our electricity
consumption with renewable energy purchases (on a global and annual basis)"*. Microsoft:
*"we matched 100% of our annual global electricity consumption with renewable energy"*.
Meta: *"we have matched 100% of our annual electricity use with clean and renewable
energy"*.

Notice what none of them say. Not one claims to RUN on clean power. Each says it MATCHED
its consumption, over a YEAR, with purchases. That is an accounting statement and it is
accurate. The physical statement, what actually came out of the wires at 3am, is a
different question and nobody had answered it, because the claim is one sentence in a PDF and the proof is nine years of
hourly federal data across seventy grid regions. The two live in different formats.

**Wattson joins them.** It takes a company's published claim, works out which electricity
grid each of its datacenters physically plugs into, and puts the claim next to the meter
reading, hour by hour.

The output is a verdict: *"true on paper, X% in reality."*

The reason this is worth doing is that datacenters are now the fastest-growing user of
electricity in the United States, and unlike fast fashion or airlines, they have no
watchdog at all.

The reason it is *possible* is that a datacenter is a fixed address drawing from one
specific grid, and the US government publishes what every grid generated, every hour,
broken down by fuel, going back to 2018.

---

## 2. The five words you need

**Grid region (balancing authority).** The US grid is cut into about 70 areas, each with
one organization responsible for matching supply and demand minute by minute. PJM is one,
covering Chicago to New Jersey. ERCOT is Texas. They are organizational, not geographic.
Some contain sub-zones, like Dominion inside PJM. **A zone reports how much power it used
but not what generated it** — that matters when you read a zone's numbers.

**Carbon-free share.** Of all electricity generated in one region in one hour, the fraction
from sources that burn nothing: nuclear, hydro, wind, solar, geothermal. 40 MW of 100 MW
means a share of 0.40. This is what the wires physically carried. It is **not** what any
company bought.

**Overnight / daytime.** Overnight is midnight to 5:59am **local time where the power is**.
Daytime is 10am to 3:59pm. Local time is essential: 3am in Texas is not 3am in Maine.

**Talk score.** How bold a company's claim is. Three things multiplied: how big the number,
how precisely stated, and how little hedged. Each narrowing qualifier cuts it — "annual"
costs the most, because averaging over a year is exactly what hides the night.

**Walk score.** The plain average of the carbon-free share of every grid that company's
mapped datacenters sit on. No contracts, no certificates.

---

## 3. The argument, step by step

Each step is a claim with a number behind it. This is the part to know cold.

### Step 1. A datacenter is the only large customer with flat demand.

A house peaks in the evening. A factory runs shifts. **A datacenter draws the same power at
3am in January as at noon in June.** Servers do not sleep.

Every other customer can be partly served by power that is only sometimes available. A
datacenter cannot.

### Step 2. Nearly all clean power built since 2019 is solar, and solar only works in daylight.

**The number: since 2019 the US added 64.7 GW of clean generation to the average midday
hour, and 17.7 GW to the average overnight hour.** Roughly four times as much to the hours
the sun is up.

**How that was computed:** take every hour between 10am and 4pm local across all reporting
regions in 2019, sum the generation from nuclear, hydro, wind, solar and geothermal, divide
by the number of hours. That gives the average midday clean power in 2019: 174.8 GW. Do the
same for 2025: 239.5 GW. The difference is 64.7 GW. Repeat for midnight-to-6am: 155.7 GW
rising to 173.4 GW, a difference of 17.7 GW.

**Scale check so the number means something:** a large nuclear reactor is about 1 GW. So
America added the equivalent of roughly 65 reactors' worth of clean power to its midday
hours, and about 18 reactors' worth to its 3am hours.

### Step 3. So at 3am, a datacenter runs on whatever is left, and that is mostly gas.

**The number, and it is the strongest one we have:** in PJM, the grid serving the largest
datacenter cluster on earth, overnight clean generation was **35,700 MW in 2019 and
35,619 MW in 2025**. It moved by 81 megawatts, which is 0.2%. Flat.

Meanwhile PJM's **total** overnight generation rose from 82,539 MW to 91,240 MW, an
increase of 8,701 MW. Broken down by fuel: **gas +10,739 MW**, coal −2,518, nuclear −950,
wind +1,070, hydro −220, solar +10.

**Read that slowly, because it is the entire project:** PJM generates 8.7 GW more power at
night than it did in 2019, and not one net megawatt of that increase is clean. They built
gas, and retired coal underneath it.

### Step 4. Annual accounting hides this completely.

A company buys enough clean energy across a **year** to match its total consumption. That
is the GHG Protocol market-based method. It is a real standard and it is legitimate.

But an annual total averages over all 8,760 hours. A megawatt-hour of solar bought at noon
cancels a megawatt-hour of gas burned at 3am, because both are just entries in a yearly
sum. **The mismatch is invisible at annual resolution and obvious at hourly resolution.**

We did not find new data. We refused to average over the hours that matter.

### Step 5. So a claim can be entirely true and still describe a facility that ran on gas every night.

This is why we never say a company lied.

**The number:** Google matched 100% of its consumption with renewable purchases on an
annual basis. Its ten mapped datacenters sit on grids that ran between **5.6% and 91.3%**
carbon-free in 2025. Same company, same annual claim, a sixteen-fold spread in what is
physically behind it. The claim is true. The spread is also true.

### Step 6. None of this works unless you know which grid each datacenter is on.

This is the unglamorous foundation. Which grid a site draws from is **not** a map lookup.

IREN's datacenter in Childress, Texas sits in the Panhandle, where most surrounding
counties are served by the SPP grid. Naive geography puts it in SPP. **It wires directly
into ERCOT instead.** One wrong row flips a verdict from clean to dirty.

All 134 sites are traced through the utility that actually serves them, each with a cited
source and a confidence grade.

---

## 4. Every number, fully explained

### The national day/night gap

| | |
|---|---|
| **What it says** | 64.7 GW added to the average midday hour since 2019; 17.7 GW to the average 3am hour |
| **How it is built** | Sum clean generation across all reporting regions for each hour, split by local hour of day, average within the window, compare 2019 to 2025 |
| **Why it matters** | It quantifies the mismatch a datacenter is exposed to: the country improved the hours a datacenter only half-uses |
| **The catch we correct** | The published 2019 baseline contains a double-counted nuclear plant. Corrected, 2019 midday is 174.8 GW rather than 178.1, and 2019 overnight is 155.7 rather than 159.0. We use corrected |

**Note the share did not fall.** Overnight carbon-free share was 39.7% in 2019 and 39.7% in
2025. Flat. Clean output *rose* 17.7 GW, and demand rose faster. **Never say the share
fell without saying output rose** — that is the easiest way to state something false using
true numbers.

### PJM overnight

| | |
|---|---|
| **What it says** | Clean generation flat at ~35,700 MW; total up 8,701 MW; gas up 10,739 MW |
| **How it is built** | Filter the hourly table to PJM, drop storage, convert to Eastern local time, keep hours 0 to 5, average by year, split by fuel |
| **Why gas exceeds the total** | Coal fell 2,518 MW and nuclear 950 MW. Gas replaced those *and* supplied the growth. It is coal-to-gas switching plus new load |
| **Cross-check** | EPA smokestack monitors independently measured PJM's overnight CO2 rising 3.96 million short tons over the same period |

### Talk and walk

**Walk score, worked example.** Google has 10 mapped sites. Each sits in a grid region, and
each region has a 2025 carbon-free share:

```
0.056  Moncks Corner, SC     Berkeley Electric Cooperative
0.349  Council Bluffs, IA    MidAmerican Energy
0.349  Pine Island, MN       Northern States Power
0.393  Fort Wayne, IN        Indiana Michigan Power
0.456  Pryor, OK             Grand River Dam Authority
0.461  Midlothian, TX        ERCOT North Central
0.487  Bridgeport, AL        Tennessee Valley Authority
0.575  Lenoir, NC            Duke Energy Carolinas
0.599  Mesa, AZ              Salt River Project
0.913  The Dalles, OR        Northern Wasco County PUD
```

Plain average of those ten = **0.464**. That is the entire calculation. No weighting by
site size, which is a limitation we state: one very large site could move it.

**Talk score** = magnitude × specificity × scope. Google's is 0.405, not 1.0, and the
reason is exactly the hedging above. "100%" scores high on magnitude and specificity, then
loses most of its scope to four qualifiers: *matched*, *purchases*, *annual*, *global*.
A company that said plainly "our datacenters run on renewable energy" would score far
higher, and none of them say that.

### The detector

| | |
|---|---|
| **What it does** | Scores 111 regions on how much their demand looks like flat 24/7 load, using demand data only. It never reads a press release |
| **The formula** | `z(overnight excess) + z(neighbor divergence) + 0.5 × z(load factor change)` |
| **Overnight excess** | How much faster demand grew at night than on average. Homes and EVs are peaky; datacenters are not |
| **Neighbor divergence** | How much faster than its neighbors on the same grid. Controls for regional economic growth |
| **Load factor change** | How much the daily demand curve flattened. A 24/7 load flattens it |
| **Why robust z** | Median and MAD rather than mean and standard deviation, because ERCOT's two zones grew +94.6% and +116.1% and would otherwise set the scale for all 111 |
| **Results** | Northern Virginia 6th, Omaha 7th, Central Ohio 19th, Dallas **91st** |

**Dallas is the miss and you should volunteer it.** Neighbor divergence compares a zone to
its neighbors, and every ERCOT zone is booming, so a booming Dallas looks unremarkable.
Drop that term and Dallas moves to 48th. We published the 91st because the weights were
fixed before we saw where anything would land.

### The statistical tests

| Test | Number | What it means in plain words |
|---|---|---|
| **Out-of-sample** | Spearman **0.877** | We ranked 111 regions on 2019-2025 data, then re-ranked on 2026 data the method never saw. Spearman measures how alike two rankings are: 1.0 identical, 0 random. 0.877 means it held |
| **Top-10 overlap** | **8 of 10** | Eight of the top ten regions are the same in both rankings. Chance would give 0.91 of them |
| **Permutation** | p = 0.049 | We fixed four test regions in advance. Of all 5,989,005 possible four-region combinations, only 4.9% score as well. Marginal, and we say so |
| **Rank interval** | Dominion 6th, CI 3rd-7th | Resample the underlying hours 10,000 times; Dominion lands between 3rd and 7th in 95% of them |
| **Weather** | **7.8%** | Of all the overnight demand growth nationally, temperature explains 7.8%. The temperature model itself fits well, median R² 0.733, so this is not a weak control failing to find an effect |
| **Night beats day** | **96 of 111** | After removing each region's own temperature response, nights still grew faster than days in 96 regions. Cooling peaks in the afternoon, so if this were air conditioning, days would have grown more |

### The carbon-free share is a proxy, and we measured how good

EPA continuous emissions monitors read CO2 from the smokestack directly. Comparing them to
our share across 49 regions: Spearman **−0.868**, explaining roughly half the variance.

**Where the proxy fails, concretely:** PACE has a 0.255 carbon-free share and emits 0.715
short tons of CO2 per MWh. FPL has 0.263 — essentially the same share — and emits 0.268.
**A 2.7× difference at the same share**, because the share cannot see whether the fossil
half is gas or coal.

---

## 5. The demo, click by click

### Open on the landing page

On screen: the globe, and the line about clean power added to midday versus 3am.

Say: *"Every company building AI datacenters says it runs on clean power. Nobody checked
against the meter, because the claim is a sentence in a PDF and the answer is nine years of
hourly federal data. We joined them."*

### Click 1 — a company. Type `GOOGL`.

On screen: Google's claim with a page citation, the verdict, 10 sites with their utilities.

Say: *"Google says it matched 100% of its electricity consumption with renewable energy
purchases, on a global and annual basis. That is true, and it is careful. What it does not
say is what came out of the wire. Its ten datacenters sit on grids that ran from six
percent to ninety-one percent carbon-free. One annual claim, ten different physical
realities."*

**Do not paraphrase this as "Google says 100% renewable."** The quote is on page 4 and a
judge can pull it up. Quote it, do not summarise it.

If asked how: *"Plain average of the ten grids. No weighting, no contracts."*

### Click 2 — type `openai`.

On screen: six Stargate sites.

Say: *"We built the question layer on OpenAI's models, so let's point it at OpenAI. Six
Stargate sites, each mapped to the utility that serves it."*

Open the New Mexico one: *"El Paso Electric is 34% carbon-free at midday and one tenth of
one percent at night. One megawatt of clean generation out of 655."*

Then the confession, and do not skip it: *"And this campus we cannot see at all. It runs on
a 700 to 900 megawatt gas microgrid that never touches the grid, so federal demand data is
blind to it. Eleven of our sites are like that. A demand-only detector cannot see a
datacenter that brought its own power plant."*

### Click 3 — ⌘K, and type a real question.

Type: **"Which five regions have the most clean power at 3am relative to their demand, and
which utility serves each?"**

On screen: a table with links, built from seven tool calls.

Say: *"That is running against the real data. It cannot show you a number the tools did not
return."*

Good backups: `compare NBIS and CRWV`, `what did Google say about 24/7 carbon free energy`
(that one pulls the quote with its page number out of 354 documents).

### Click 4 — Method.

Say: *"Four regions named before we saw any ranking, in the same commit as the code. Three
landed in the top twenty. Dallas came 91st and here is exactly why, and we published it
rather than retuning until it went away."*

### Close

Say: *"We never say a company lied. Their claim is true under the standard. We measure the
gap between a contract and a meter, and we publish what we got wrong alongside it."*

---

## 6. The error we found in federal data

This is the most impressive thing in the project and the easiest to tell.

Arizona's clean share appeared to collapse, from 62% of overnight generation in 2019 to 10%
in 2025. **It is not real.**

Palo Verde is the only nuclear plant in Arizona. It is jointly owned: **Arizona Public
Service 29.1%, Salt River Project 17.5%**, five others hold the rest. Both APS and SRP
reported the plant to the federal government, and **each reported the whole plant rather
than its share.** For eighteen months the same electricity was counted twice.

Three independent confirmations:

1. **The two reports match hour for hour.** Correlation 0.9948 across 7,976 hours,
   identical within 5 MW in 98.8% of them. Then it stops on one day, 2019-12-04, in a step.
2. **The total is physically impossible.** Peak combined hour 8,041 MW from a plant whose
   nameplate is 4,209.6 MW. **1.91 times what it can produce.**
3. **The smokestacks agree.** If the collapse were real, fossil plants would have fired up
   to replace it. Measured: Arizona's fossil generation flat at about 2,040 MW and CO2
   **down 17.5%.** A clean fleet cannot vanish without carbon appearing.

We found it in our own output and the site shows the published and corrected numbers side
by side.

---

## 7. Reproduce it yourself

The federal table is `core_eia930__hourly_net_generation_by_energy_source`:

| column | what it holds |
|---|---|
| `datetime_utc` | the hour |
| `balancing_authority_code_eia` | the grid region, e.g. `PJM` |
| `generation_energy_source` | `nuclear`, `gas`, `coal`, `solar`, `wind`, ... |
| `net_generation_adjusted_mwh` | megawatt-hours from that fuel that hour. **The column we use** |

`docs/headline_from_raw.py` reproduces the PJM result in about fifteen lines and prints:

```
  2019 overnight:  clean 35,744 MW  of total 82,506 MW  = 43.3%
  2025 overnight:  clean 35,573 MW  of total 90,265 MW  = 39.4%
```

Within 0.4% of our published figures. The gap is real: the quick script uses a fixed
five-hour offset while the pipeline handles daylight saving properly and drops partial
months. **If anyone asks whether you can reproduce your own result, run this.**

---

## 8. What we do not claim

Say these before you are asked.

- **We never say a company lied.** Annual matched claims are true under the standard.
- **We measure generation inside a region, not consumption.** A region importing clean
  power gets no credit for it.
- **Average mix, not the marginal plant.** What actually fires up when a datacenter
  switches on is usually dirtier than the average, so we likely understate.
- **Regions are coarse.** PJM is one number from Chicago to New Jersey.
- **Flat load is not only datacenters.** Crypto and oilfield electrification look identical.
  ERCOT Far West, our rank 2, is probably the Permian oilfield.
- **Eleven sites make their own power**, so federal data cannot see them.
- **Below the top ten, the ranking is not an ordering.** The median rank interval is 29
  places wide. Treat the top ten as a set.
- **Region size predicts our labels better than load shape does.** We report it.
- **We got one of four test regions wrong.** Dallas, 91st. Published.
