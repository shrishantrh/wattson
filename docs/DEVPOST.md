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

**The hard part was the text, not the map.** A sustainability report does not contain a
claim you can check. It contains a sentence like "we match 100% of our annual global
electricity consumption with renewable energy purchases," and almost every word in it is
load-bearing. We built a pipeline that reads 354 documents, 309 sustainability reports and
45 SEC filings, and turns each claim into a record: the number, how precisely it is stated,
how heavily it is qualified, and the page it came from.

**Then we score the hedging, because that is where the meaning hides.** "100% renewable"
and "100% of annual consumption matched with market-based certificates" are the same
number and completely different claims. Each narrowing qualifier costs the claim scope:
"annual" is the expensive one, because averaging over a year is exactly what hides the
night. That gives a talk score: how big the claim is, how specific, and how little it is
hedged. The walk score comes from the grid. The gap between them is the finding.

**Getting an LLM to do this without inventing things was most of the work.** Our first PDF
reader parsed two-column reports straight across the page and spliced sentences together
into fluent quotes that did not exist. Every claim now carries a verbatim quote and a page
number you can open and check. Documents are indexed and searchable, so the ask layer can
pull a company's exact words with the citation attached.

**The ask layer can only report what the data returned.** It answers questions through ten
typed tools that query the real numbers, and before anything renders we check every figure
on screen against what those tools actually returned. A figure that does not match is
discarded and the answer falls back to prose. The model cannot put a number on screen that
the data did not produce.

**No AI in the measurement, deliberately.** Every grid figure is plain arithmetic over
government data, which is why it reproduces exactly on a fresh machine. AI reads documents
and answers questions. It never produces a number.

**Knowing which grid a site is on is the quiet trap.** IREN's site in the Texas Panhandle
looks like it belongs to the regional grid covering most of those counties, but it wires
directly into ERCOT. One wrong row flips a verdict, so all 134 are hand-checked against a
cited source.

## Individual contributions

**Yash** built the investigation side: reading company documents, extracting claims,
mapping every datacenter to the utility that serves it, and the API and ask layer.

**Shri** built the grid engine and the interface: the hourly clean-power index, the
detector, the siting score, and the whole front end.

We agreed the data format between the two halves before either of us started, which is why
they actually joined at the end.

---

## Challenges we ran into

**We published a number that was wrong.** Arizona's clean power looked like it collapsed
between 2019 and 2025. It had not. One nuclear plant was being reported twice, once by each
of two neighboring grid operators, which inflated the 2019 baseline. Corrected, Arizona's
clean share actually rose. We found it in our own checks rather than having it pointed out,
and the site now shows the published figure and the corrected one side by side instead of
quietly swapping them.

**Our PDF parser made up quotes.** It read two-column reports straight across the page
instead of down each column, so it stitched the end of one sentence onto the start of
another. The results read perfectly well and were not in the document. We had already
repeated one before we caught it. We switched parsers, and every claim now carries a page
number so any quote can be checked against the original.

**Missing data displayed as zero.** A company we had not read any documents for showed a
score of 0% rather than a blank, which made it look like we had measured something and
found nothing. Blanks now render as blanks everywhere.

**The pipeline is hourly, and almost nothing else is.** Company reports are annual, grid
regions are drawn for markets rather than geography, and time zones mean "overnight" is a
different set of hours in Texas than in New England. Most of the engineering went into
keeping those aligned so a night in one region is comparable to a night in another.

## Accomplishments that we're proud of

**We committed to the method before seeing the answer.** Weights fixed, four test regions
named in advance, in the same commit as the code that produced the ranking. Three landed in
the top twenty. Dallas came 91st and we published it rather than retuning until it went away.

**It held on data that did not exist when we locked it.** Re-run against 2026, three of
those four scored better, not worse. Northern Virginia went 6th to 3rd.

**Every gap is written down.** 48 of our 52 companies have no documents read yet and each
one says so. Seven more we could not place honestly are listed with what we searched for.

**It distinguishes rather than just indicts.** One site we checked, in Quincy, Washington,
runs on a grid that is 100% carbon-free at 3am.

## What we learned

**Time resolution was the whole argument.** The same data says nothing yearly and something
new hourly. We did not find new data, we refused to average away the hours that matter.

**A percentage falling is not an amount shrinking.** Confusing the two is the easiest way
to say something false using entirely true numbers.

**The dangerous bugs look correct.** A crash is easy to find. A parser writing believable
fake quotes, a blank rendering as a zero, a ranking quietly feeding on its own output: all
three produced screens that looked completely fine.

## What's next

**Measure the marginal plant, not the average.** What matters is which generator fires up
when a datacenter switches on, and that is usually dirtier than the average.

**See behind the meter.** Eleven sites we mapped make their own power, so government data
cannot see them at all, and those are exactly the biggest new campuses.

**Run it forward.** Everything here looks backwards. Run monthly against fresh data and the
same detector becomes an early warning for where the next buildout lands.
