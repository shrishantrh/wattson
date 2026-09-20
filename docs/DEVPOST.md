# Wattson, Devpost answers

*Every figure traces to `server/static_export/` or `claims/companies.json`.*

---

## Project description

**Wattson is a greenwashing investigation of datacenter operators. We check every
"100% renewable" claim against 4.45 million hours of federal power-plant data, and name
the utility on the other side of the gap.**

Watchdogs exist for fast fashion, airlines and oil majors. None exist for datacenters,
now the fastest-growing user of electricity in the country. We take a company's published
claim, work out which grid each of its datacenters actually plugs into, and put its own
words next to what that grid burned.

---

## Inspiration

We wanted to build a quantitative model on something real, and we started where everyone
starts: ordinary companies. Greenwashing in consumer brands is well covered, and it is
mostly a reading problem. Deciding whether you believe a sustainability report is not a
measurement.

Then we looked at datacenters, and two things landed at once. **Nobody is watching them**,
even though they are the fastest-growing electricity load in the US. **And their claim is
physically checkable**, because a datacenter is a fixed address plugged into one specific
grid, and the government publishes what that grid burned every hour for the last nine
years.

That turned it from an essay into arithmetic. The claim is a sentence in a PDF; the answer
is 4.45 million rows of meter data. Nobody had joined them, so we did.

The hunch that made it worth doing was about time of day. Solar transformed the middle of
the day and did nothing for the middle of the night, and a datacenter is the one customer
that does not care what time it is. If that held, a company could be telling the truth on
paper and still run on gas every night for seven years.

It held. Since 2019 the US added **64.7 GW** of clean power to the average midday hour and
**17.7 GW** to the average 3am hour.

---

## What it does

**Check a company.** Type a ticker. You get its claim word-for-word with a page number,
how clean the grids under its datacenters actually were, and a verdict. **52 operators,
134 sites**, from Google and Microsoft to CoreWeave, Nebius, IREN and OpenAI's Stargate.

**Find datacenters without a list of datacenters.** Our detector scores 111 US grid
regions purely on how demand behaves: nights growing faster than days, growth outpacing
neighbors, the daily curve flattening. It never reads a press release. Northern Virginia
ranks 6th, Omaha 7th.

**Say where the next one should go.** We rank regions by clean power available at 3am,
which decides whether new demand is met by existing clean plants or by building more gas.

**Ask it anything.** ⌘K takes a plain English question and answers with a table you can
click into. It can only show numbers the data produced.

**The finding:** in PJM, the grid serving the world's biggest datacenter cluster, clean
power at night has not grown since 2019. Night-time generation rose 8.7 GW. Gas supplied
10.7 of it. Look at yearly averages and this disappears entirely.

**We never say a company lied.** Annual "100% renewable" claims are legitimately true
under the accounting standard everyone uses. Our verdict is *"true on paper, X% in
reality."* Two of a company's own numbers side by side are not arguable.

---

## How we built it

**The detector.** Three signals, combined with fixed weights: how much faster demand grew
overnight than on average, how much a region diverged from its neighbors, and how much its
daily demand curve flattened. **We locked the weights and named four test regions before
we ever looked at the ranking.** Three landed in the top twenty. One missed badly, Dallas
at 91st, and we publish the miss and the reason rather than quietly retuning.

**The hard part is knowing which grid a site is on.** It is not a map lookup. IREN's site
in the Texas Panhandle looks like it should be on the regional grid that covers most of
those counties, but it wires directly into ERCOT instead. One wrong row flips a verdict,
so every site is hand-checked against a source we cite.

**No machine learning in the measurement, on purpose.** Every number is plain arithmetic
over government data, which is why it reproduces exactly on a fresh machine. We use AI
only to read documents and answer questions, never to produce a figure.

---

## Individual contributions

**Yash** built the investigation side: reading company documents, extracting claims,
mapping every datacenter to the utility that serves it, and the API and ask layer.

**Shri** built the grid engine and the interface: the hourly clean-power index, the
detector, the siting score, and the whole front end.

We agreed the data format between the two halves before either of us started, which is why
they actually joined at the end.

---

## Challenges we ran into

**Our own number was wrong, backwards.** Arizona looked like its clean power collapsed. It
had not: one nuclear plant was being counted twice. We caught it ourselves and now show
both the published and corrected figure rather than quietly fixing it.

**A PDF reader that invented quotes.** Our first parser read two-column reports straight
across, splicing sentences together into fluent quotes that did not exist. We had repeated
one out loud before noticing. That was the scariest bug of the weekend, because it does not
look like a bug, it looks like a discovery.

**A missing value that displayed as zero**, producing a screen saying a company "talks at
zero" from entirely correct data.

---

## Accomplishments that we're proud of

**We committed to the method before seeing the answer**, named four test regions in
advance, and published the one we got wrong.

**It held up on data that did not exist when we locked it.** Re-run on 2026 data, three of
those four regions scored better, not worse. Northern Virginia went from 6th to 3rd.

**Every gap is written down.** 48 of our 52 companies have no documents read yet, and each
says so. Seven more we could not honestly place are listed with what we searched.

**It is not just an accusation.** One site we checked, in Quincy, Washington, runs on a
grid that is 100% carbon-free at 3am. The method distinguishes; it does not just indict.

---

## What we learned

**Time resolution was the whole argument.** The same data says nothing yearly and something
new hourly. We did not find new data, we just refused to average away the hours that matter.

**A percentage falling is not the same as an amount shrinking**, and confusing the two is
the easiest way to say something false using true numbers.

**The dangerous bugs look correct.** A crash is easy. A parser writing believable fake
quotes, a blank rendering as a zero, a ranking feeding on itself: all three produced screens
that looked completely fine.

---

## What's next

**Measure the marginal plant, not the average.** What actually matters is which generator
fires up when your datacenter switches on, and that is usually dirtier than the average.

**See behind the meter.** Eleven sites we mapped make their own power, so government data
cannot see them at all. The biggest new campuses are exactly the ones most likely to be
invisible.

**Run it forward.** Everything here looks backwards. Run monthly against fresh data, the
same detector becomes an early warning system for where the next buildout lands.
