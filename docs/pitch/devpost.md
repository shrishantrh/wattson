# Wattson — HackMIT 2026 submission copy

Paste each block into the matching field. Every figure here is traced to exported data in
`docs/pitch/numbers.md`. Nothing is rounded up and nothing is claimed that the data cannot settle.

---

## Inspiration

Every large technology company says its data centers run on one hundred percent renewable energy,
and on paper every one of them is telling the truth. They buy certificates over a year to match
what they consume over a year.

But a data center is not an annual thing. It draws the same power at three in the morning as at
noon. So we went looking for what was actually on the wire at 3am, and found the gap that annual
accounting is built to hide: since 2019 the American grid got substantially cleaner during the
day, because of solar, and did not improve at all overnight. Nationally the daytime carbon-free
share rose from 37.2% to 46.5% while the overnight share slipped from 40.5% to 39.7%.

A flat, round-the-clock load puts half of itself in the hours that never got better. That is the
entire AI buildout, landing on the one part of the grid that decarbonization skipped.

## What it does

Wattson checks clean-energy claims and siting decisions against what the grid physically generated,
hour by hour.

It reads the federal hourly generation record for every US balancing authority, computes the
carbon-free share of generation for every hour since 2019, and uses that index to do three things.

**Check a company.** Type a company name. Wattson maps its data center sites to the grids that
actually serve them and reports what those grids generated, beside what the company claims. Google
states 100% renewable; across its ten mapped sites those grids generated 46% carbon-free power,
a 54-point gap. The range is the point: one of its sites sits on a grid at 5.6% and another at 91.3%.
The verdict is phrased "true on paper, X physically", never as an accusation, and the company's own
report page is shown alongside with the claimed sentence highlighted where it was printed.

**Compare places.** Ask where 300 MW of round-the-clock load would run cleanest. Wattson ranks
candidate grids on clean power at night, its trend, and clean power against demand, and tells you
how many megawatts of fossil generation that load pulls at each one.

**Find where the load already landed.** A detector scores 111 regions using demand data alone, with
no company list and no press releases, looking for the fingerprint of flat load: night demand
rising faster than daytime demand, divergence from geographic neighbours, and a flattening load
curve.

The headline finding: PJM, the grid that serves Data Center Alley, added 8,701 MW of overnight
generation since 2019 while its overnight clean generation fell 81 MW. Gas rose 10.7 GW, more than
the growth itself, because it also replaced retiring coal. Net exports fell, so the new power
stayed inside PJM. The increment was, in round terms, zero percent clean.

## How we built it

The data is EIA-930, the federal hourly electric grid monitor, pulled through PUDL from a public S3
bucket: 4,451,763 hourly rows across 70 balancing authorities from July 2018 to September 2026.
Carbon-free is nuclear, hydro, wind, solar and geothermal; storage is excluded; "other" stays in the
denominator. Overnight means 00:00–05:59 local and daytime 10:00–15:59, in each region's own time
zone.

On top of that index sit five layers: a temporal layer splitting day from night and computing
trailing series and interchange; the demand-only detector; a fuel decomposition that says what
filled each year's overnight growth, plus a siting score; a claims layer that extracts page-cited
statements from companies' own published reports; and a verification layer that holds each claim
against the grids at that company's sites.

The front end is React and Vite with no UI framework, a globe rendered as an instanced dot field
over three.js, and a hash-routed interface that works from a live API, a static export, or bundled
fixtures. That last part matters: the whole thing runs offline from a static build, so a demo
cannot fail because a server did.

**The detector's parameters were frozen before we saw any ranking.** The weights, the 500 MW
exclusion and the peak definition were fixed in advance, and we named four regions as the test
before running it. Northern Virginia came 6th and Omaha 7th, which is what we predicted. The AEP
zone came 19th and Dallas came 91st, which we did not, and both misses are printed on screen beside
the hits.

## Individual Contributions

**Shrishant** built the product surface: the investigation interface, the globe, the answer and
evidence screens, the region, screener, explore and findings pages, the static export path and the
offline build, the page-crop renderer that shows each claim highlighted on the company's own page,
the deployment, and the demo film pipeline.

**Yash** built the data engine and everything behind it: the acquisition and index build, the
temporal and fuel layers, the detector, the siting score, the alerts, the claims extraction from
corporate reports, the ask layer over typed tools, and the two market-facing screens.

We worked on separate branches into a shared integration branch and neither of us pushed to master.

## Challenges we ran into

**The data lies in places, and we had to prove it rather than assume it.** Phoenix's published
record says its overnight carbon-free share collapsed from 62% in 2019 to 10% in 2025. It never
happened. The region was reporting the output of the Palo Verde nuclear plant at the same time as a
neighbouring operator reported the same output. The two series correlate at 0.9948 across 7,976
hours, are identical within 5 MW in 98.8% of them, and together claim 7,087 MW from a plant rated
3,937 MW. The series does not decline into 2020; it steps down on a single day. Corrected, Phoenix
rose from 1.7% to 10.4%. The published figure was wrong in direction, not just in magnitude. We show
published and corrected side by side rather than silently substituting our number.

**Saying the right thing is harder than computing it.** We measure generation inside a footprint,
not consumption, and we use a grid's average mix rather than its marginal emissions. Both limits are
real, and both make it tempting to overstate. We wrote the constraints down as rules and enforced
them in the interface: "consistent with datacenter load being served by gas", never "caused by";
"true on paper, X physically", never "they lied"; and claims that cannot be checked are counted on
screen rather than quietly dropped.

**Two people improving the same interface in opposite directions.** One of us was making every
number explain why it matters, which makes text longer. The other was cutting text because the
interface had become dense. Reconciling that across sixteen conflicted files, without losing either
person's work, took real care, and it surfaced four crashes that had been hiding on one side.

## Accomplishments that we're proud of

**We found something.** PJM added 8.7 GW of overnight generation since 2019 and none of it was
clean. That is two stored fields and one subtraction, and it is a real fact about the grid that
serves the largest concentration of data centers in the world.

**We found the datacenters in the demand data, without being told where they are.** No company
list, no announcements, no press releases: just the shape of demand across 111 regions.

**We caught an error in the federal record and diagnosed its cause,** rather than dismissing it as
noise or quietly deleting it.

**We predicted before we measured.** The parameters were frozen and the test regions were named in
advance, so the detector could have failed publicly. It partly did, and we print the misses.

**We were careful about what we do not know.** Every screen states its limits, unverifiable claims
are counted rather than hidden, and no company is called a liar anywhere in the product.

## What we learned

**How the federal grid record is actually assembled, and where it bends.** EIA-930 is not one
table. There is a raw feed, an adjusted feed, an imputed feed, and a partner-level interchange table
that disagrees with the operations table. We learned to use the adjusted operations figures for net
flows because the partner table has sign flips before 2020, and to treat interchange as unallocated
rather than pretend we know where power went. Every region reports in its own local time, so
"overnight" is only meaningful after converting 4.45 million rows to 70 different local clocks
first. And the same generator can be reported by two operators at once, which is how a nuclear
plant ended up counted twice.

**How to draw a hundred thousand points at 60 frames per second.** The globe is land rendered as a
hexagonal dot field, indexed with H3 at resolution 4 over the US and 3 elsewhere. The naive version,
one mesh per dot, dies instantly. The working version is a single instanced mesh where every dot is
one instance sharing one geometry and one material, so the whole planet is one draw call and
brightness is driven by a shader uniform rather than by touching objects. We also learned that
geometry libraries throw on malformed input: one country outline whose ring collapsed to four
identical vertices raised an exception that escaped the loop and silently prevented every country
after it from drawing.

**How a language model is stopped from inventing numbers.** The ask layer is an OpenAI
tool-calling loop over eleven typed tools. The model never sees a database and cannot write a query;
it can only call named functions with typed arguments, and every figure in an answer comes back from
one of them. The tools it used are printed under the answer, which is how we noticed that one answer
we liked was standing on three tools and not on retrieval, so we stopped claiming otherwise. The
lesson generalises: constrain the model's surface area and provenance becomes a property of the
system rather than a promise.

**Why retrieval has to be chunked at the passage, not the document.** We indexed our corpus in
Elasticsearch as 354 passages drawn from 8 documents rather than 8 documents. A sustainability report
is a hundred pages; retrieving the document tells you nothing and blows the context window. Passage
chunking is also what makes page citation possible at all, because the page number travels with the
chunk. Codex wrote that retrieval layer, which is the most concrete thing it did for us.

**That a CSS transform silently captures `position: fixed`.** Our full-page image viewer kept
opening at 346 pixels, clipped inside its card, and we spent hours treating it as an overflow bug.
The drag-and-drop library puts a `transform` on every sortable card, and a transformed ancestor
becomes the containing block for `fixed` descendants. `filter`, `perspective`, `will-change` and
`contain` all do the same. Portal the overlay to the body and it works.

**That a collapsed `<details>` still has geometry.** Chrome returns bounding rectangles for children
of a closed disclosure, projected where layout would have put them. Our automated overlap audit
reported a text block colliding with a chart 2,350 pixels from anything painted. Visually hidden is
not geometrically absent, so we replaced the folds with a component that mounts its body only when
open.

**That content-hashed chunks make every deploy a breaking change for open tabs.** A deploy renames
every JavaScript file. A tab loaded before it still holds the old entry bundle, so the first
navigation to a lazily imported route requests a filename that no longer exists and dies with
"Failed to fetch dynamically imported module". We now catch that specific rejection and reload once,
guarded so a genuinely missing chunk cannot loop. Every app doing route-level code splitting behind
a CDN has this and mostly does not know.

**That bundle budgets have to be measured.** Our entry chunk started near 5 MB because a 3D globe
and a plotting library were reachable from the first import. Splitting the globe, React, the UI and
the charts into separate chunks and importing the charts dynamically brought the entry to 178 kB,
and switching from the full plotting distribution to its Cartesian-only build cut that dependency
from 4.6 MB to 1.4 MB. None of it was visible from the source, only from the build's chunk table.

**How screen recording actually works, and how it lies.** The demo film is driven over the Chrome
DevTools Protocol, which emits a frame only when something changes, so a long gap between frames
means the capture went quiet, not the page. We also lost two takes at exactly 180.6 seconds to
Puppeteer's default 180-second protocol timeout, which presents as the film hanging rather than as a
timeout. And synthesised narration must have its numerals expanded before synthesis or "8.7 GW"
comes out mangled; "eight point seven gigawatts" is the fix.

**That robust statistics matter more than the model.** The detector normalises with the median and
median absolute deviation rather than mean and standard deviation, so a handful of very large regions
cannot dominate. Peak demand is the 99.5th percentile hour rather than the maximum, because one
corrupt hour in 2019 would otherwise define a region's whole load factor. Both were fixed before we
saw any ranking, along with the weights and a 500 MW cut, and four test regions were named in advance
so the method could fail in public. Two landed where we predicted, two did not, and the miss taught
us a real limitation: our neighbour-divergence term penalises a zone inside a region that is booming
overall, because it has no quiet neighbours to stand out against.

## What's next for our project

Marginal emissions rather than average mix, so the question becomes what an additional megawatt
actually causes to burn rather than what the grid happened to be generating.

Allocating interchange, so a region's imports are attributed rather than left out, which is the
single largest caveat in the current work.

Finer geography. Regions are coarse; PJM alone spans Chicago to New Jersey, and a grid that size
averages away most of what is interesting inside it.

Broadening the claims layer from four companies to the whole sector, and tracking claims over time
so a company's statements can be checked against the grid of the year it made them.

---

## Links

- **Code:** https://github.com/shrishantrh/wattson
- **Live site:** https://shrishantrh.github.io/wattson/
- **Video demo:** upload `docs/wattson-demo.mp4` to YouTube and paste the watch URL

## Fields still to fill on the form

- Project thumbnail: use a frame from the findings screen or the globe; `docs/screenshots/` has candidates.
- Sponsor challenges: add the ones being entered.
- Location and power: logistics, not content.
