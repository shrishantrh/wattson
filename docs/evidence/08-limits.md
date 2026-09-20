# The limits, stated before anyone asks

Saying these unprompted is worth more than any single finding. Each one is real, each is
already on the site, and each has a reason.

## What we measure

**Generation inside a region, not consumption.** If a region imports clean power, it gets
no credit for it here. Interchange is not allocated.

**Average mix, not the marginal plant.** What actually fires up when a new datacenter
switches on is usually dirtier than the regional average, so if anything we understate the
problem.

**Regions are coarse.** PJM is one number covering Chicago to New Jersey.

**Zones report demand only** and inherit their parent grid's generation. A generation
figure on a zone row is the parent's. PJM's +10.74 GW of gas is never Dominion's gas.

## What the detector cannot separate

**Flat load is not only datacenters.** Crypto mining and oilfield electrification produce
the same signature. **ERCOT Far West is our rank 2 and is probably the Permian oilfield**,
not a datacenter. It also fails the weather night-versus-day test, which is consistent with
that reading.

**Below the top ten the ranking is not an ordering.** The median 95% rank interval is 29
places wide and 72 of 111 are wider than 20 places. Treat the top ten as a set, not a
sequence.

**Our rank intervals are too narrow.** They contain the out-of-sample rank only 71.8% of
the time against a nominal 95%. Window choice dominates the uncertainty, not sampling
noise. We measured this rather than assuming it.

**In-sample significance is marginal.** p = 0.0488 on mean score, 0.0571 on mean rank.
Dropping Dominion alone moves it to 0.137. Quote the out-of-sample result instead.

## What we cannot see

**Eleven of our 134 sites are behind the meter.** They generate their own power, which
never touches the grid, so federal demand data cannot see their load at all. For two of
them the operator's own fact sheet says so. OpenAI's Santa Teresa campus is one: a 700 to
900 MW gas microgrid that explicitly does not connect to El Paso Electric.

The uncomfortable part, which you should say anyway: **the largest and newest campuses are
exactly the ones most likely to be invisible to a demand-only detector.**

## Coverage

**48 of our 52 operators have sites mapped but no documents read.** Their cards say so in
words. That is a statement about our coverage, not a finding about them.

**Seven operators we searched for and could not honestly place**, including IBM,
Salesforce, Nvidia and Anthropic. Anthropic is the instructive one: its Fluidstack deal
names only "Texas and New York", and no source we opened puts Anthropic at either placeable
site, so both are filed under Fluidstack. Guessing would have been the exact error this
project exists to expose.

**The walk score is unweighted.** A company with one enormous site and nine small ones gets
a plain average. One large site could move it materially.

## Our labels are confounded

**Region size predicts our labels better than load shape does.** log(average demand) alone
scores AUC 0.749 against our facility labels; the shape model scores 0.727. Bigger regions
carry more mapped sites because we mapped more sites in bigger regions. The defensible
claim is that shape adds information beyond size, not that shape beats size.

## What we got wrong and published

**Dallas came 91st.** One of four pre-registered validation regions, and a miss.

**We published a wrong nameplate.** 3,937 MW is Palo Verde's net summer capacity, not its
nameplate (4,209.6 MW). It appeared in nine places before EIA-860 caught it.

**We said PJM "got dirtier."** Per megawatt-hour it did not: intensity fell from 334 to 321
kg CO2 per MWh. Total overnight CO2 still rose 3.96 million tons, because load growth ate
the entire benefit of the coal retirements and 4 million tons more.
