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

## 4b. The detector score, formula and all

```
score  =  z(overnight_excess)  +  z(neighbor_divergence)  +  0.5 x z(load_factor_delta)
```

### The three inputs, in plain words

**`overnight_excess`** = how many percentage points faster a region's demand grew at NIGHT
than it grew ON AVERAGE, 2019 to 2025.

> A house peaks in the evening. A factory runs shifts. Both grow their peak faster than
> their trough. A datacenter grows both equally, so its region's nights start catching up
> with its days. Northern Virginia's is **+7.7 points**. ERCOT North's is **+13.4**.

**`neighbor_divergence`** = this region's average demand growth minus the MEDIAN growth of
the other zones on the same grid.

> This controls for the regional economy. If all of Texas is booming, a booming Dallas
> proves nothing. Northern Virginia's is **+32.9 points**, meaning it grew 33 points faster
> than the rest of PJM.

**`load_factor_delta`** = the change in (average demand ÷ peak demand) between 2019 and 2025.

> Load factor is how flat your demand curve is. A perfectly flat customer has a load factor
> of 1.0. Adding a 24/7 load pushes a region's load factor up. Dominion's rose **+0.042**.

### What `z()` means, and why robust

A z-score says "how many typical deviations from typical is this." It puts three quantities
measured in different units on one scale so they can be added.

We use a **robust** z: `(x - median) / (MAD x 1.4826)` rather than `(x - mean) / std`.

> Why it matters here: ERCOT's two zones grew **+94.6%** and **+116.1%**. With a normal
> z-score those two outliers inflate the standard deviation, which shrinks everyone else's
> score toward zero and hides real signal in the other 109 regions. The median and the
> median absolute deviation barely move when two points are extreme. The 1.4826 is the
> constant that makes MAD comparable to a standard deviation for normal data.

### Why 0.5 on the third term

Load factor is the noisiest of the three: it depends on a single peak hour, and one bad
hour of data moves it. It gets half weight for that reason, and the weight was fixed before
any ranking was computed.

### The two cuts

- Regions under **500 MW** average demand are excluded. Below that, one factory closing
  moves the percentages wildly.
- Peak is the **99.5th percentile hour**, not the maximum. PJM has one corrupt hour in 2019
  that would otherwise define its peak.

### Worked example: Northern Virginia

| input | value | robust z |
|---|---|---|
| overnight excess | +7.7 pts | ~1.4 |
| neighbor divergence | +32.9 pts | ~4.5 |
| load factor delta | +0.042 | ~1.6 |

`1.4 + 4.5 + 0.5 x 1.6 = 7.71` → **rank 6 of 111**.

**Note what carries it: neighbor divergence.** Dominion did not just grow, it grew far
faster than everything else on its own grid. That is the fingerprint.

---

## 4c. The market side: Generating Alpha

This is the screen most people skip and it is the one an investor cares about.

### The chain

A grid observation is useless to a fund until it ends at something tradeable. The chain has
four links:

```
flagged region  ->  serving utility  ->  its parent company  ->  ticker
```

**Worked example, ERCO/NRTH, our rank 1 region:**

- Demand grew **94.6%** since 2019, overnight excess **+13.4 points**
- Overnight generation there added **+6.62 GW gas** and **+5.53 GW wind**
- The utility serving that load is **AEP Texas**
- Parent: **American Electric Power**, ticker **AEP**, with the SEC filing linked
- Also exposed: **NRG**

Each instrument carries a `why` sentence and a source URL. Nothing is asserted without one.

### The honest part, and it is the strongest thing on the page

**42 of the 107 sites whose utility we could establish are served by public power, a
cooperative, or a state authority with no listed equity at all.** A further 27 have no
established serving utility.

> Say this out loud: "A third of the load we found lands on utilities you cannot buy. That
> is a real limit on this as a trade, and we put the number on the screen rather than
> quietly filtering those rows out."

### The Kalshi markets

Four event markets where the thesis is expressible:

| series | what it settles on |
|---|---|
| `KXUSADATACENTERS` | how many US datacenters actually get built |
| `KXDATACENTCON` | US private datacenter construction spending |
| `KXPOWERKWH` | US average retail electricity price |
| `KXRATEPAYERLAW` | whether federal datacenter power-cost standards pass |

### The frame, and do not soften it

The page says, in its own text:

> *"This is an input to a trade, not a trade."*
> *"We have no validation that this signal predicts any price. We have run no backtest and
> tested nothing against a price series."*

**Why that is the right call:** the mechanism is real — load growth hits a regulated
utility's rate base before it appears in filings — but we never measured the lead time, so
we do not quote one. A red-team pass killed an earlier "eighteen months" claim for exactly
that reason and we deleted it.

> "We stop at the physical input on purpose. We would rather concede the investment case
> than fake a regulatory model over a weekend."

---

## 4d. The machine learning, what each model was for

**Nothing here produces a number on the site.** Every figure on screen is arithmetic over
federal data. The models exist to attack our own result from outside. All four were
forbidden from using any detector output as an input.

### `engine/stats` — is the ranking better than chance?

| test | what it does | result |
|---|---|---|
| **Exact permutation** | Score all 5,989,005 possible four-region combinations. Where do our four pre-registered regions land? | p = **0.0488**. Marginal, and we say so |
| **Block bootstrap** | Resample the hourly data in 7-day blocks, 10,000 times, rebuild the ranking each time | Dominion 6th, 95% CI **3rd to 7th** |
| **Out-of-sample holdout** | Re-rank using 2026 data the method never saw | Spearman **0.877**, 8 of top 10 unchanged |
| **Placebo windows** | Run the same frozen method ending in each earlier year | p = 0.13, 0.14, 0.21, 0.10, then **0.049** at 2025. **Nothing before 2025 clears significance** |
| **FDR control** | Correct for testing 111 regions at once | 71 survive at q=0.05 |

**The placebo result is the one to quote.** The signal appears exactly when the datacenter
buildout happened and not before. If this were a methodology artifact it would show up in
every year.

### `engine/ml` — can a model find the same regions without our rule?

Gradient boosting and logistic regression over **17 features of demand shape only** —
load factor, summer/winter ratio, diurnal range, profile entropy, overnight-to-daytime
ratio. Labels come from our 134 mapped sites, which were built from utilities and filings,
never from the detector.

Repeated stratified 5-fold cross-validation, 100 fits. **AUC 0.727**, average precision
0.705, against floors of 0.500 and 0.441. Zero of 1,000 label shuffles beat it.

**The finding against us, which we publish:** `log(average demand)` alone scores **0.749**,
beating the shape model. Bigger regions carry more mapped sites because we mapped more
sites in bigger regions. So the claim is "shape adds information beyond size," not "shape
beats size."

**The useful reframe it produced:** the model leans on *static flatness*, the detector leans
on *change*. The detector's load-factor term ranks **last of 52** in the model's importance.
They measure different things. **The detector finds where flat load is ARRIVING; the model
finds where it already SITS.**

### `engine/shape` — do datacenter grids cluster? When did load go flat?

k-means and Ward clustering on normalized 24-hour demand profiles, with PCA.

**This came back negative and is published as negative.** 50 pre-declared tests; nothing
survives correction. Mapped-site regions are *depleted* in the flattest cluster, not
enriched. PELT changepoint detection found break dates that do not cluster in time either
(p = 0.310).

**Its one positive is post-hoc and about the detector, not datacenters:** an
overnight-ratio change computed here without ever reading the detector correlates **0.655**
with the shipped score.

### `engine/weather` — is it just hot summers?

Regression of demand growth on the change in cooling and heating degree hours, from 138
NOAA stations, 9.18 million station-hours.

Weather explains **7.8%**. The temperature model itself fits at median R-squared **0.733**,
so this is not a weak control failing to find an effect.


---

## 5. The product IS the argument: how to navigate it

You should never need a slide. Each screen answers one question and raises the next one,
and the handoff is the script. Follow the arrows.

```
  #/                    "Is there a problem?"
     |  the national gap: 64.7 GW to midday, 17.7 to 3am
     v
  #/data                "Prove it, don't tell me"
     |  NEVP: 1.8% at night, 55.8% by day. Two columns, one row
     v
  #/found               "Where does it actually bite?"
     |  PJM: clean flat since 2019, +8.7 GW total, gas +10.7
     v
  #/check/GOOGL         "So is anyone claiming otherwise?"
     |  matched 100% annually. Physically 5.6% to 91.3%
     v
  #/check/OPENAI        "Does this apply to the new buildout?"
     |  six Stargate sites, and one we cannot see at all
     v
  #/compare             "Fine, so what should they do?"
     |  any two grids or operators, side by side, at 300 MW
     v
  #/method              "Why should I believe your ranking?"
     |  frozen before results, three hits, one published miss
     v
  #/alpha               "Who is exposed to this?"
     |  region -> utility -> parent -> ticker, and what is not buyable
     v
  Cmd-K                 "Can I ask my own question?"
        anything, against the real data, as a table
```

### Screen 1 · `#/` — set the question

The globe, and the national line. **Say the gap, not the share.**

> "Since 2019 America added 64.7 gigawatts of clean power to the average midday hour, and
> 17.7 to the average hour at 3am. A datacenter buys both, equally, because it never stops."

**Handoff:** *"That's a national average, which is easy to assert. Let me show you the
underlying table."*

### Screen 2 · `#/data` — the evidence, unmediated

Regions sheet. **Night** and **Day** are adjacent columns. Find **NEVP**.

> "Las Vegas. Fifty-six percent carbon-free at midday, one point eight percent at 3am. Same
> grid, same year, ten hours apart."

Then **GCPD**, 100% both:

> "Same table. So this measures, it doesn't just indict. Where you build decides what gets
> burned for you."

**Handoff:** *"That's one region. The question is where it matters most."*

### Screen 3 · `#/found` — the finding, stepped

Four steps, arrow keys. PJM: clean flat → +8.7 GW total → gas +10.7 → exports fell.

> "PJM serves the largest datacenter cluster on earth. Its clean power at night has not
> grown since 2019. Thirty-five thousand seven hundred megawatts then, thirty-five six
> nineteen now. Everything they added at night, they added by burning gas."

> "At annual resolution this disappears completely."

**Handoff:** *"So what are the companies sitting on that grid saying?"*

### Screen 4 · `#/check/GOOGL` — the accusation, carefully

The claim verbatim with its page, then the ten sites.

> "Google's own words, page four: matched one hundred percent of our electricity
> consumption with renewable energy purchases, on a global and annual basis. True under the
> standard. We say true on paper."

> "Physically, those ten datacenters sit on grids from five point six to ninety-one percent
> carbon-free."

**Handoff:** *"That's the established players. The interesting question is the buildout
happening right now."*

### Screen 5 · `#/check/OPENAI` — the new build, and our blind spot

> "We built the ask layer on OpenAI's models, so let's point it at OpenAI. Six Stargate
> sites, each traced to the utility that serves it."

Santa Teresa: El Paso Electric, 34% at midday, 0.1% at night. Then:

> "And this one we can't see at all. A 700 to 900 megawatt gas microgrid that never touches
> the grid. Eleven of our sites are like that. A demand-only detector cannot see a
> datacenter that brought its own power plant."

**Handoff:** *"So if you're siting the next one, where should it go?"*

### Screen 6 · `#/compare` — the actionable turn

**This is where it stops being an exposé.** Open the overlay, pick two grids, or two
operators.

> "Any two of the 111 grids, any two of the 52 operators, any two of the 134 sites. Here's
> what 300 megawatts of round-the-clock load actually draws from fossil generation in each,
> at 3am."

> "That's the decision a developer is actually making, and it's the hour that decides it."

**Handoff:** *"All of that rests on our ranking being real, so let me show you why it is."*

### Screen 7 · `#/method` — earn the trust

> "The detector scores 111 regions from demand alone. It never reads a press release."

> "We fixed the weights and named four test regions before we looked at any ranking, in the
> same commit as the code. Three landed in the top twenty. **Dallas came 91st**, and we
> published the miss."

> "Then we re-ran the frozen method on 2026 data that didn't exist when we locked it. The
> ranking held at 0.877, eight of the top ten unchanged."

**Handoff:** *"So who's on the other side of this financially?"*

### Screen 8 · `#/alpha` — the exposure chain

> "Every flagged region resolves to the utility that serves it, its parent, and a ticker.
> ERCOT North, our rank one, ninety-five percent demand growth. Served by AEP Texas. Parent
> American Electric Power."

Then the limit, unprompted:

> "And a third of the load we found sits on public power and cooperatives with no listed
> equity at all. That number is on the screen. This is an input to a trade, not a trade.
> No backtest, and we don't claim one."

**Handoff:** *"And you don't have to take my route through this."*

### Screen 9 · ⌘K — hand them the wheel

> "Ask it anything."

Let a judge type it if they will. Otherwise:
**"Which five regions have the most clean power at 3am relative to their demand, and which
utility serves each?"**

> "Seven tool calls against the real data, and it structurally cannot show you a number the
> tools didn't return."

### If you get three minutes

Screens **2, 4, 7**. The table, the company, the freeze. That is the whole argument: here is
the evidence, here is the claim it contradicts, here is why you can trust the method.

### If a judge takes over

Let them. Good places to land: `#/check/NBIS` (a neocloud with sites and no documents read,
which shows the coverage honesty), `#/region/PJM/DOM`, or any ⌘K question. The one screen
to steer away from is deep in `#/explore` — it is exploratory, not narrative.


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
