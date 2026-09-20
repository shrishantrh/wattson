# Wattson — Devpost answers

*Draft. Every number here is traceable to `server/static_export/` or `claims/companies.json`.
Edit the voice freely; do not edit the figures without re-checking them.*

---

## Project description

**Wattson is a greenwashing investigation of datacenter operators — we settle every
"100% renewable" claim against 4.45 million hours of federal meter data, and hand asset
managers the named utility on the other side of the gap.**

Greenwashing analysis is a mature field for fast fashion, airlines and oil majors. It does
not exist for datacenters, which are now the fastest-growing industrial electricity load in
the United States. Wattson takes a company's published claim with a page cite, resolves
which grid each of its datacenters physically draws from, and puts its own words next to
what the meter recorded.

---

## Inspiration

Every company building AI datacenters says it runs on clean power. Nobody had checked,
and we wanted to know why not.

The answer turned out to be a format problem, not an interest problem. The claim is a
sentence in a sustainability PDF. The evidence is nine years of hourly generation data
across all seventy US balancing authorities. Nobody was joining them, so the claim went
unchecked — not because it was hard to doubt, but because it was hard to *check*.

What made us think there was something real there was a hunch about **hours**. Solar
transformed the middle of the day over the last decade. It did nothing at all for the
middle of the night. And a datacenter is the one load that does not care what time it is —
it draws the same power at 3am in January as at noon in June. If that hunch held, then an
annual "100% renewable" claim could be completely true on paper and still describe a
facility that ran on gas every single night for seven years.

It held, and the size of it surprised us. **Since 2019 the US added 61.4 GW of clean
power to the average daytime hour and 14.3 GW to the average overnight hour** — 4.3 times
as much to the hours a datacenter does not care about.

---

## What it does

Wattson computes the hourly carbon-free share of generation for every US balancing
authority from EIA-930, then uses it four ways:

**1. It checks a company's claim against its own grids.** Type a ticker. You get the claim
verbatim with a page citation, the grid share the company's mapped sites actually ran on,
a verdict, and the contradiction where there is one. We hold **52 operators across 134
sites** — hyperscalers, the bitcoin-to-AI converts (IREN, TeraWulf, Riot, Cipher, Applied
Digital, Hut 8, Core Scientific, MARA), neoclouds (CoreWeave, Nebius, Lambda, Crusoe,
Fluidstack), and the colocation REITs (Equinix, Digital Realty, Vantage, QTS, Switch,
CyrusOne, STACK, Aligned). Every site carries a source URL and a confidence grade.

**2. It finds datacenters without a list of datacenters.** A demand-only detector scores
111 regions on the *signature* of flat 24/7 load: overnight demand growing faster than
average, divergence from neighbors, and the load factor flattening. It never looks at a
press release. ERCOT North ranks 1st at +94.6% growth; Fort West 2nd at +116.1%; Northern
Virginia 6th; Omaha 7th.

**3. It says where the next gigawatt should go.** A siting score ranks regions on clean
power available *at 3am* — level, direction, and headroom — because that is the hour that
decides whether new load is served by existing clean capacity or by new gas.

**4. It answers questions in plain English.** ⌘K takes any typed question, runs it through
ten typed tools against the real data, and returns a table, a chart and links — not a
paragraph of prose. Every figure it shows has to trace back to a tool result; the model is
structurally unable to introduce a number the data did not produce.

**The finding:** nationally, clean power was added to the day and not the night — 61.4 GW
to the average daytime hour since 2019 against 14.3 GW to the average overnight hour. And
in PJM — the grid serving the largest datacenter cluster on earth —
overnight clean generation has not increased since 2019. Overnight generation rose 8.7 GW.
Gas supplied 10.7 GW of it. Net exports to neighbors fell from 3,814 MW to 2,489 MW, so
the extra power stayed inside PJM. **At annual resolution this finding does not exist.**

**What we never say:** that a company lied. Annual matched claims are genuinely true under
the GHG Protocol market-based method — a legitimate accounting standard, not a loophole.
Our verdict is *"true on paper, X% physically."* We are not measuring honesty. We are
measuring the gap between a contract and a meter. A greenwashing accusation is arguable;
two of a company's own published numbers side by side are not.

---

## How we built it

**The data.** EIA-930 via PUDL — 4.45 million hourly rows across 70 balancing authorities,
July 2018 to September 2026. Carbon-free is defined as nuclear + hydro + wind + solar +
geothermal; storage is excluded because it is not generation; other/unknown stays in the
denominator so we never flatter a grid by dropping what we cannot classify.

**The detector.** Robust z-scores (median/MAD, not mean/σ, because this distribution has
real outliers we do not want to let set the scale) over three signals: overnight excess,
neighbor divergence, and load-factor change at half weight. Regions under 500 MW average
demand are excluded. **Weights and cutoffs were frozen before we looked at the ranking,
and four validation regions were named in advance.** Three landed (Northern Virginia 6th,
Omaha 7th, AEP 19th). One missed: Dallas came 91st, because neighbor divergence compares a
zone against its neighbors and *every* ERCOT zone is booming, so a booming Dallas looks
unremarkable. We report the miss rather than re-tuning until it disappeared.

**The claims layer.** PDFs and SEC filings in, structured claims out — each with magnitude,
specificity, scope and a page cite. Verdicts are one of four: `true_on_paper`,
`contradicted`, `unfalsifiable`, or `cannot_verify` with an enumerated reason. The
`cannot_verify` count is displayed on screen rather than hidden, because a verification
tool that never says "I don't know" is not a verification tool.

**The facility lookup is the part that decides everything,** and it is hand-curated on
purpose. Which grid a datacenter draws from is not a geography problem. IREN's Childress
site sits in the Texas Panhandle, where most counties are SPP — naive geography maps it to
SPP and gets the wrong grid. It interconnects directly to ERCOT. One wrong row flips a
verdict, so every row carries a source URL and a confidence grade.

**The stack.** Python + pandas/pyarrow for the engine, FastAPI for the API, React + Vite
for the front end, deployed as a static export so the whole thing runs with no server if
the network dies during judging. The ask layer is an OpenAI tool-calling loop over ten
typed tools.

**How we worked.** We ran a fleet of parallel coding agents against isolated git worktrees,
with one session acting as merge gatekeeper — nothing reached the main branch without a
clean-clone build and an adversarial review pass whose only job was to find what was wrong
with the work, not to agree with it. That review caught several things listed below.

---

## Individual contributions

**Yash** owned the investigation layer: the claims pipeline (`claims/`), document ingestion
and extraction, the company verdict schema and `companies.json`, the facility-to-utility
lookup, the API and ask layer, and the Voloridge reproducibility run on EC2.

**Shri** owned the grid engine and the interface: the L0–L4 data pipeline (`scripts/`),
the carbon-free index, the flat-load detector, the siting score, the fuel decomposition,
the export/alerts layer, and the front end.

**Shared:** the JSON schema for a company card was agreed between us before either side
built against it, which is what let the two halves develop in parallel and still join.
Both write-ups and the honesty rules were argued out jointly — most of the rules in the
spec exist because one of us tried to make a claim the other could not verify.

---

## Challenges we ran into

**Our own published number was wrong, in direction.** Arizona's overnight clean share reads
0.62 in 2019 and 0.15 in 2025 — an apparent collapse. It is an artifact: a reporting change
double-counts part of the footprint. The real trend is the opposite. We caught it in our own
diagnostics, and rather than silently patching the export we built a correction overlay that
shows **both** the published and the corrected value. Then we swept all 69 other BAs and all
4,430 BA pairs to prove Arizona was the only one.

**A PDF parser that fabricated quotes.** `pdfplumber` reads two-column sustainability
reports straight across the page, splicing the left column into the right and producing
sentences that read fluently and do not exist in the document. We had already repeated one
of those fabricated quotes out loud before we caught it. Fixed by switching to PyMuPDF with
column-aware extraction. This was the most frightening bug of the weekend: it does not look
like a bug, it looks like a finding.

**A ranking that was secretly a tautology.** Our first alert-prioritization pass scored
missing values as passes, so regions with incomplete data swept the top eight slots and the
"prioritized" screen turned out to be the detector ranking wearing a different label.

**A null that rendered as a zero.** Amazon's talk score is legitimately `null` — we could
not verify its claim. `(talk_score ?? 0)` drew that as a 0% bar, and a screen that says
"Amazon talks at zero" is a lie assembled from correct JSON. Null handling is now a rule:
an absent value renders as an em-dash or a sentence, never a number.

**Five agents, one checkout.** We ran parallel agents against what we thought were isolated
worktrees and discovered they shared a checkout, so they were overwriting each other. Also
a deploy race where two branches' pushes were cancelling each other's builds.

**Claiming a build passed that hadn't.** A `git add -A` ran before an edit was finished, so
the commit captured a stale index and the tree that built locally was not the tree that got
committed. The rule now is that verification means a fresh `git clone` and `npm ci`, not a
green build in the directory you were just editing.

---

## Accomplishments that we're proud of

**We froze the method before we saw the answer.** Weights, cutoffs and four named
validation regions were committed in advance. Three hit, one missed, and we published the
miss with the reason. That is the difference between a finding and a story.

**We found our own worst bug and shipped the correction as a feature.** The Arizona overlay
shows the published number and the corrected number side by side, with the method note. Most
projects would have quietly fixed the export.

**The honesty rules held under pressure.** We never say a company lied, we never say
"caused by" when we mean "consistent with", and `cannot_verify` is counted on screen. We
had every incentive to write a punchier claim and did not.

**Every gap is a recorded decision, not a 404.** 48 of our 52 operators have sites mapped
but no documents read, and each says `no_documents_ingested` in words: *a gap in our
coverage, not a finding about them*. Seven operators we searched for and could not honestly
place — IBM, Salesforce, Nvidia, Together AI, Anthropic among them — are written down with
what we looked for and why we stopped. Anthropic is the instructive one: its $50bn
Fluidstack deal names only "Texas and New York," and no source we opened puts Anthropic at
either placeable Fluidstack site, so both sites are filed under **Fluidstack**, not
Anthropic. Guessing there would have been the exact error this project exists to expose.

**The counterexample.** Vantage's Quincy, Washington site runs on Grant County PUD — 100%
carbon-free at 3am, all year, Columbia River hydro. The method isn't "everyone is dirty."
It distinguishes.

**It reproduces.** The full pipeline was re-run end to end on a clean EC2 box across a
pandas major version, and produced identical output.

---

## What we learned

**Resolution is the whole argument.** The same dataset at annual resolution says nothing
and at hourly resolution says something nobody had said. We did not find new data; we
refused to average over the hours that mattered.

**A share falling is not the same as a quantity shrinking,** and conflating them is the
easiest way to write something false out of true numbers. National overnight clean share
fell from 0.405 to 0.397 — while overnight clean output *rose* from 159.0 GW to 173.4 GW.
Demand simply grew faster. Every screen that shows a share now has the absolute beside it.

**Organizational boundaries are not geographic ones.** Balancing authority zones nest
inside parents and report demand only, inheriting the parent's generation. PJM's +10.74 GW
of gas is never Dominion's gas. Getting this wrong would have produced a headline we could
not defend.

**The most dangerous bugs produce plausible output.** A crash is free to find. A PDF parser
that splices columns into fluent fake quotes, a null that draws as a zero, a ranking that
is secretly its own input — all three produced screens that looked right. We now verify
from a clean clone and have an agent whose only job is to attack the result.

**Say what you cannot verify.** The `cannot_verify` counter, the coverage-gap records and
the Dallas miss all make the project *more* credible, not less. Judges and quants both
probe for what you are hiding; the fastest way through is to have hidden nothing.

---

## What's next

**See behind the meter.** Eleven of our mapped sites are behind-the-meter — powered by
generation that never touches the grid — so EIA-930 cannot see their load at all, and for
two of them the operator's own fact sheet says so in writing. That is a structural blind
spot in a demand-only detector: the largest, newest, most vertically integrated campuses
are precisely the ones most likely to be invisible to it. We state it rather than wait to
be caught by it, but closing it needs interconnection and permit data, not EIA-930.

**Marginal emissions, not average.** We report the average grid mix. The question a siting
decision actually turns on is what the *marginal* generator is when your load arrives —
which is almost always dirtier than the average. That needs dispatch-level modeling.

**Allocate interchange.** We measure generation inside a footprint, not consumption. A
region importing clean power gets no credit and a region exporting fossil power takes no
blame. Allocating flows across ties would close the largest single gap in the method.

**Finer geography.** PJM spans Chicago to New Jersey as one number. Nodal LMP data would
let us resolve to the substation a datacenter actually connects at, instead of a region
the size of six states.

**Automate the facility lookup — carefully.** It is hand-curated because it is the row that
flips verdicts. Interconnection queues, FERC filings and utility IRPs could do it at scale,
but only with a confidence grade attached to every row and a human on anything low.

**Scale the claims corpus.** Four operators have documents read; forty-eight have sites
mapped and nothing ingested. The pipeline is built and the bottleneck is now just documents through it.

**Track it forward.** Everything here is retrospective. The same detector run monthly
against fresh EIA-930 becomes an early-warning system — flat load showing up on a utility's
system eighteen months before it shows up in a rate case.
