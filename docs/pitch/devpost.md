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
states 100% renewable; the grid at the site we could map generated 5.6% carbon-free power in 2025.
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

**A CSS transform silently captures `position: fixed`.** Our full-page image viewer kept opening at
346px wide, clipped inside its card. We spent hours treating it as a layout overflow. The real cause:
the drag-and-drop library puts a `transform` on every sortable card, and a transformed ancestor
becomes the containing block for `fixed` descendants, so the overlay was anchored to the card instead
of the viewport. `transform`, `filter`, `perspective`, `will-change` and `contain` all do this. The
fix is to portal the overlay to `document.body`. If something `fixed` is behaving as though it is
`absolute`, walk up the tree looking for those properties rather than debugging the overlay.

**A collapsed `<details>` still has geometry.** We wrote an automated audit that walks the DOM and
flags any text box intersecting a chart box. It reported a collision 2,350px from anything painted.
Chrome still returns `getBoundingClientRect()` for children of a closed `<details>`, and they project
wherever the layout would have put them. Visually hidden is not geometrically absent. We replaced the
folds with a component that mounts its body only while open, which fixed the audit and removed the
dead nodes. Any geometry-based test needs conditional mounting, not `display: none` thinking.

**Content-hashed chunks make every deploy a breaking change for open tabs.** A deploy renames every
JavaScript chunk. A tab loaded before it still holds the old entry bundle, so the first navigation to
a lazily imported route requests a filename that no longer exists and dies with "Failed to fetch
dynamically imported module". The site is fine; the tab is stale. We now catch that specific rejection
in the lazy loader and reload once, guarded by a `sessionStorage` flag so a genuinely missing chunk
cannot loop, and skipped where that storage throws. Any app doing route-level code splitting behind a
CDN has this bug and usually does not know it.

**Our worst failure mode was a fallback that worked.** The front end resolves data from a live API,
then a static export, then bundled fixtures, which is what lets the whole thing run offline. That also
means a broken data export produces a site that looks completely normal and is quietly serving
placeholder numbers. Green build, green tests, wrong product. We made it a hard failure instead: the
deploy greps the build log for the line that proves the export synced, asserts specific files exist in
the output, and runs 77 data-shape checks. A graceful degradation you cannot see is worse than a crash.

**Automate the verification, not just the action.** Our demo video is a real screen recording driven
by a headless browser clicking real elements. The first version silently recorded nothing being typed,
and looked plausible. Now every shot declares what must be on screen at that moment, the recorder
prints a pass/fail table, tiles one frame per shot into a contact sheet, and refuses to write a file
it cannot vouch for: it fingerprints the shot list into the narration so stale audio cannot be muxed
against renamed shots, detects hot-module reloads that splice two takes together, and probes the
output with ffmpeg for a real, non-silent audio track. It has already aborted on a take that would
have looked fine.

**Bundle budgets have to be measured, not assumed.** Our entry chunk started at roughly 5 MB, mostly
because a 3D globe and a plotting library were reachable from the first import. Splitting the globe,
React, the UI and the charts into separate chunks and importing the charts dynamically brought the
entry to 178 kB. Switching from the full plotting distribution to its Cartesian-only build cut that
dependency from 4.6 MB to 1.4 MB. None of this was visible from the source; it took reading the
build's chunk table.

**One malformed polygon can take out every polygon after it.** Rendering land as a hexagonal dot
field threw about 90 errors per page load. The cause was a single country outline in the source
topology whose ring collapsed to four identical vertices; the indexing library threw on it, and
because the throw escaped the loop, every country after it in iteration order was never drawn. Guard
per feature, not per batch, and validate geometry before handing it to a library that throws.

**Robust statistics matter more than the model.** The detector uses median and median-absolute-
deviation rather than mean and standard deviation, because a handful of very large regions otherwise
dominate the normalization. Peak demand is the 99.5th percentile hour rather than the maximum, because
one corrupt hour in 2019 would otherwise define a region's entire load factor. Both choices were made
before we saw any ranking, along with the weights and a 500 MW exclusion, and we named four test
regions in advance. Two landed where we predicted and two did not, and the miss taught us a real
limitation: our neighbour-divergence term penalizes a zone inside a region that is booming overall,
because it has no quiet neighbours to stand out against.

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
