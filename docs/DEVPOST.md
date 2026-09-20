# Wattson, Devpost answers

*Every number here is traceable to `server/static_export/` or `claims/companies.json`.
Edit the voice freely; re-check any figure before changing it.*

---

## Project description

**Wattson is a greenwashing investigation of datacenter operators. We settle every
"100% renewable" claim against 4.45 million hours of federal meter data, and hand asset
managers the named utility on the other side of the gap.**

Greenwashing analysis is mature for fast fashion, airlines and oil majors. It does not
exist for datacenters, now the fastest-growing industrial electricity load in the United
States. Wattson takes a company's published claim with a page cite, resolves which grid
each of its datacenters physically draws from, and puts its own words next to what the
meter recorded.

---

## Inspiration

We wanted to build a quantitative model on something real, and we started where everyone
starts: ordinary companies. Greenwashing in consumer brands is a well-covered field, with
watchdogs, ratings agencies and standardized frameworks pulling claims apart. It is also
crowded, and mostly a text problem. Reading a sustainability report and deciding whether
you believe it is not a measurement.

Then we looked at datacenters and two things landed at once.

**Nobody is watching them.** They are the fastest-growing industrial electricity load in
the country and the entire apparatus that exists for fast fashion does not exist here.

**And unlike a consumer brand, their claim is physically checkable.** A datacenter is a
fixed address drawing power from one specific grid, and the US government publishes what
that grid burned, hour by hour, going back nine years. So a claim that would be an opinion
about a clothing company becomes an arithmetic problem about a datacenter.

That is when it became a quant problem instead of an essay. The claim is a sentence in a
PDF; the evidence is 4.45 million hourly rows across seventy balancing authorities. Nobody
had joined them, because the two halves live in different formats. We built the join.

The hunch that made it worth doing was about hours. Solar transformed the middle of the
day over the last decade and did nothing for the middle of the night, and a datacenter is
the one load that does not care what time it is. If that held, an annual "100% renewable"
claim could be completely true on paper and still describe a facility that ran on gas
every night for seven years.

It held. Since 2019 the US added **64.7 GW** of clean power to the average daytime hour
and **17.7 GW** to the average overnight hour, 3.7x more to the hours a datacenter does
not use.

---

## What it does

Wattson computes the hourly carbon-free share of generation for every US balancing
authority, then uses it four ways.

**It checks a company's claim against its own grids.** Type a ticker: the claim verbatim
with a page citation, the grid share its mapped sites actually ran on, a verdict, and the
contradiction where there is one. We hold **52 operators across 134 sites**, from the
hyperscalers to the bitcoin-to-AI converts (IREN, TeraWulf, Core Scientific, Hut 8) to the
neoclouds (CoreWeave, Nebius, Crusoe) and the colocation REITs.

**It finds datacenters without a list of datacenters.** A demand-only detector scores 111
regions on the signature of flat 24/7 load: nights growing faster than days, divergence
from neighbors, the load curve flattening. It never reads a press release. ERCOT North
ranks 1st at +94.6% growth, Northern Virginia 6th, Omaha 7th.

**It says where the next gigawatt should go.** A siting score ranks regions on clean power
available *at 3am*, the hour that decides whether new load is served by existing clean
capacity or by new gas.

**It answers questions in plain English.** ⌘K runs any typed question through ten typed
tools and returns a table, a chart and links. Every figure must trace to a tool result, so
the model cannot introduce a number the data did not produce.

**The finding:** in PJM, the grid serving the largest datacenter cluster on earth,
overnight clean generation has not increased since 2019. Overnight generation rose 8.7 GW;
gas supplied 10.7 of it. Net exports fell from 3,814 MW to 2,489 MW, so the extra power
stayed inside PJM. **At annual resolution this finding does not exist.**

**What we never say is that a company lied.** Annual matched claims are genuinely true
under the GHG Protocol market-based method. Our verdict is *"true on paper, X% physically."*
We measure the gap between a contract and a meter. A greenwashing accusation is arguable;
two of a company's own published numbers side by side are not.

---

## How we built it

**The data.** EIA-930 via PUDL: 4.45 million hourly rows, 70 balancing authorities, July
2018 to September 2026. Carbon-free is nuclear + hydro + wind + solar + geothermal. Storage
is excluded because it is not generation; unknown fuel stays in the denominator so we never
flatter a grid by dropping what we cannot classify.

**The detector.** Robust z-scores (median/MAD, not mean/σ, because ERCOT's two zones are
real outliers at +94.6% and +116.1% and would otherwise set the scale for everyone else)
over overnight excess, neighbor divergence, and load-factor change at half weight. Regions
under 500 MW are excluded. **Weights and cutoffs were frozen before we saw the ranking, and
four validation regions were named in advance, in the same commit as the code that produced
it.** Three landed: Northern Virginia 6th, Omaha 7th, AEP 19th. One missed: Dallas came
91st, because neighbor divergence compares a zone against its neighbors and every ERCOT
zone is booming. We publish the miss rather than re-tuning until it disappeared.

**The claims layer.** 354 documents indexed and searchable with page cites. Each claim
carries magnitude, specificity and scope. Verdicts are `true_on_paper`, `contradicted`,
`unfalsifiable`, or `cannot_verify` with an enumerated reason, and the count is displayed
rather than hidden.

**The facility lookup decides everything, and it is hand-curated on purpose.** Which grid a
datacenter draws from is not a geography problem. IREN's Childress site sits in the Texas
Panhandle where most counties are SPP; naive geography maps it to SPP and gets the wrong
grid. It interconnects directly to ERCOT. One wrong row flips a verdict, so every row
carries a source URL and a confidence grade.

**No ML in the measurement, deliberately.** Every figure is deterministic arithmetic over
federal meter data, which is why it reproduces byte-for-byte on a clean box. The LLM is
confined to reading text and never touches a number.

**The stack.** Python with pandas/pyarrow, FastAPI, React + Vite, deployed as a static
export so the demo runs with no server if the network dies.

**How we worked.** Parallel coding agents in isolated git worktrees, with one session as
merge gatekeeper. Nothing reached the main branch without a clean-clone build and an
adversarial review whose only job was to find what was wrong.

---

## Individual contributions

**Yash** owned the investigation layer: the claims pipeline, document ingestion and
extraction, the company verdict schema, the facility-to-utility lookup, the API, the ask
layer, and the reproducibility run on EC2.

**Shri** owned the grid engine and the interface: the L0–L4 pipeline, the carbon-free
index, the flat-load detector, the siting score, fuel decomposition, exports and alerts,
and the front end.

**Shared:** we agreed the JSON schema for a company card before either side built against
it, which let the two halves develop in parallel and still join. Most of the honesty rules
in the spec exist because one of us tried to make a claim the other could not verify.

---

## Challenges we ran into

**Our own published number was wrong, in direction.** Arizona's overnight clean share reads
0.62 in 2019 and 0.15 in 2025, an apparent collapse. It is an artifact: Palo Verde nuclear
counted once under Arizona and once under its neighbor. The real trend is the opposite. We
caught it in our own diagnostics and, rather than quietly patching the export, built a
correction overlay showing **both** values. Then we swept the other 69 BAs and all 4,430 BA
pairs to prove Arizona was the only one.

**A PDF parser that fabricated quotes.** `pdfplumber` reads two-column sustainability
reports straight across, splicing the left column into the right and producing sentences
that read fluently and do not exist. We had repeated one out loud before catching it. Fixed
with column-aware extraction. It was the most frightening bug of the weekend, because it
does not look like a bug, it looks like a finding.

**A ranking that was secretly a tautology.** Our first alert-prioritization pass scored
missing values as passes, so regions with incomplete data swept the top eight slots and the
"prioritized" screen was the detector ranking wearing a different label.

**A null that rendered as a zero.** Amazon's talk score is legitimately null. `(talk_score
?? 0)` drew it as a 0% bar, and a screen saying "Amazon talks at zero" is a lie assembled
from correct JSON.

**Claiming a build passed that hadn't.** A `git add -A` ran before an edit finished, so the
commit captured a stale index. Verification now means a fresh clone, not a green build in
the directory you were editing.

---

## Accomplishments that we're proud of

**We froze the method before we saw the answer.** Weights, cutoffs and four named
validation regions committed in advance. Three hit, one missed, and we published the miss
with the reason. That is the difference between a finding and a story.

**It held up out of sample.** The same commit that fixed the weights also asked for a
second window: 2019 against 2026 January to August, data that did not exist when we froze
it. Three of the four pre-registered regions improved on it: Northern Virginia 6th to 3rd,
Omaha 7th to 6th, Central Ohio 19th to 12th. Dallas stayed a miss.

**We found our own worst bug and shipped the correction as a feature**, showing the
published and corrected numbers side by side.

**Every gap is a recorded decision, not a 404.** 48 of 52 operators have sites mapped but
no documents read, and each says so in words. Seven operators we could not honestly place
are written down with what we looked for and why we stopped. Anthropic is the instructive
one: its Fluidstack deal names only "Texas and New York," so both sites are filed under
Fluidstack, not Anthropic. Guessing there would have been the exact error this project
exists to expose.

**The counterexample.** Vantage's Quincy site runs on Grant County PUD: 100% carbon-free at
3am, all year, Columbia River hydro. The method isn't "everyone is dirty." It distinguishes.

**It reproduces.** The full pipeline re-ran end to end on a clean EC2 box across a pandas
major version and produced identical output.

---

## What we learned

**Resolution is the whole argument.** The same dataset says nothing annually and something
nobody had said hourly. We did not find new data; we refused to average over the hours that
mattered.

**A share falling is not a quantity shrinking,** and conflating them is the easiest way to
write something false out of true numbers. The national overnight share held flat while
overnight clean output rose 17.7 GW. Every screen showing a share now shows the absolute
beside it.

**Organizational boundaries are not geographic ones.** Balancing authority zones report
demand only and inherit the parent's generation. PJM's +10.74 GW of gas is never Dominion's.

**The most dangerous bugs produce plausible output.** A crash is free to find. A parser that
splices columns into fluent fake quotes, a null that draws as a zero, a ranking that is
secretly its own input: all three produced screens that looked right.

**Say what you cannot verify.** The `cannot_verify` counter, the coverage gaps and the
Dallas miss make the project more credible, not less.

---

## What's next

**Marginal emissions, not average.** A siting decision turns on what the *marginal*
generator is when your load arrives, which is almost always dirtier than the average. That
needs dispatch-level modeling.

**See behind the meter.** Eleven of our sites are powered by generation that never touches
the grid, so EIA-930 cannot see them, and for two the operator's own fact sheet says so.
The largest, newest campuses are exactly the ones most likely to be invisible to a
demand-only detector. Closing that needs interconnection and permit data.

**Allocate interchange.** We measure generation inside a footprint, not consumption. A
region importing clean power gets no credit and one exporting fossil power takes no blame.

**Finer geography.** PJM spans Chicago to New Jersey as one number. Nodal data would
resolve to the substation a datacenter actually connects at.

**Automate the facility lookup, carefully.** Interconnection queues, FERC filings and
utility IRPs could do it at scale, but only with a confidence grade on every row and a
human on anything low.

**Track it forward.** Everything here is retrospective. The same detector run monthly
against fresh EIA-930 becomes an early-warning system on flat load arriving.
