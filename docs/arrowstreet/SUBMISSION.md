# Wattson — Arrowstreet Capital submission

**Best Textual Analysis Hack: evaluating corporate greenwashing from public text.**

---

## What we built

A system that reads what companies say about their electricity and checks it against
what the grid physically delivered, hour by hour, from federal metered data.

Four companies. 354 citable passages from sustainability reports and SEC 10-K filings.
**Nine verified contradiction findings, every one re-read by a human against the rendered
PDF page or raw SEC HTML before it was allowed into the output.**

Everything is live in the product. Search a ticker, get the claim, the page cite, the
grid number, and the verdict.

---

## The strongest finding: a company contradicting itself with its own two numbers

Google's 2026 Environmental Report, page 4:

> "Despite this, we again matched 100% of our electricity consumption with renewable
> energy purchases (on a global and annual basis)"

The same report, page 94, in the data appendix:

| CFE across Google data centers (hourly), % | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|
| | 65 | 64 | 64 | 66 | 65 |

**Both numbers are Google's own.** The headline is annual matching — a contract claim.
The appendix is hourly carbon-free energy — a physical claim. **Five years, flat.**

We put the two side by side and say nothing else. No modelling, no inference, no
accusation. The gap between a contract and the physics is disclosed by the company itself,
in the same document, ninety pages apart.

And on page 4, unprompted, Google states our thesis in its own words:

> "our AI infrastructure buildout is currently accelerating faster than the grid is
> decarbonizing."

---

## The second structure: same company, two registers

A sustainability report is marketing. A 10-K carries legal liability. Reading them
together is where the evidence is.

**Microsoft**
> Sustainability report, p6: "In FY25, we matched 100% of our annual global electricity
> consumption with renewable energy."
> 10-K, Item 1A: "AI development and deployment has and will likely continue to raise
> energy use and emissions, **making it harder to meet these goals**."

**Alphabet**
> Environmental report, p4: "we again matched 100% of our electricity consumption with
> renewable energy purchases (on a global and annual basis)"
> 10-K, Item 1A: "**AI's energy and water demands have made efforts to reduce our
> emissions more complex and challenging across every level.**"

Neither company is lying in either document. **That is what makes it usable.** The
brochure says solved; the filing, written to be read by a regulator, says AI is making it
harder. Both describe the same physical situation.

---

## Conclusion confidence, which is a judging criterion

**Verdicts:** `true_on_paper | contradicted | unfalsifiable | cannot_verify`

We never say a company lied. Annual matched claims are **true** under the GHG Protocol
market-based method. The verdict is "true on paper, X physically", labelled grid-only and
explicitly excluding power purchase agreements.

`cannot_verify` carries an enumerated reason — `no_falsifiable_content`, `no_site_mapping`,
`ba_out_of_coverage`, `year_out_of_range` — and the count is rendered on screen. A gap we
name is a limitation; a gap we hide is a hole someone else finds.

**Amazon reports zero contradictions.** Nothing in its documents qualifies or undercuts its
claim. That is a result, not a gap, and it is recorded as one.

---

## Why the evidence holds: the failures we caught

The judging criterion is quality of evidence with sources cited. Here is what it took.

**A fabricated quote, caught before it shipped.** Our PDF extractor read two-column pages
straight across, splicing the left column into the right mid-sentence and producing fluent
English that appears nowhere in the document. We had already circulated this as our best
finding:

> "…pausing our use of non-additional, unbundled renewable energy. In FY25, we matched
> 100%…"

Microsoft never wrote that sentence. Read properly, "certificates" belongs to the adjacent
column, and Microsoft is **pausing** its use of unbundled RECs and accepting higher
reported emissions to do it — a company tightening its own standard, close to the opposite
of a hedge. **Had we shown that on a slide, the first person to open page 6 would have
found us not merely wrong but unfair.** An exclusion is not a qualification; that rule now
has regression tests.

**The audit that could not see it.** We had verified all 309 page citations against the
source: zero mismatches. But that check compared each chunk against *the same extraction
that produced it*. It proved the chunk came from that page; it could not prove the
extraction had preserved reading order. **A self-consistent check cannot detect a
systematic bias in the instrument it checks with.** Every finding here was subsequently
re-read against the rendered page — a different instrument.

**A false negative, which is the same failure mirrored.** Our first independent check of
the Microsoft 10-K quote used a general page fetcher, which truncated the 8.6 MB filing and
reported the sentence absent. We nearly discarded a true finding on a tool's say-so.
Verification now uses a throwaway tag-stripper against raw SEC HTML rather than our own
parser, so one bug cannot hide itself twice.

**A parser that passed every test while being wrong.** Our 10-K Item slicer passed all
synthetic tests while three of four real filings sliced wrong — a repeated page header left
Microsoft's Item 1A at 759 words instead of 11,754; a mid-paragraph cross-reference ran
Alphabet's to 52,000; Amazon truncated to 367. Regression tests now come from the real
text, with a guard refusing any slice under 3,000 words.

**Precision over recall, enforced.** Unfiltered, Alphabet alone produced 30 contradiction
hits: table-of-contents lines, an endnote citing Princeton and TU Berlin, a methodology
definition. Those are the document mentioning "24/7", not Google asserting anything. Six
survive. Every filter is backed by a test written from the specific false positive it kills.

**A calibration gap in our own scoring.** Our falsifiability classifier rated 37 activity
statements at ≥0.8 with neither a number nor a date — "we announced an agreement to upgrade
additional plants" scoring level with "62% of electricity from carbon-free sources". The
gap was in our hand-written anchors, not the model. Named partners and technologies create
an impression of specificity while committing to no measurable quantity.

---

## Where AI is used, and where it is deliberately not

AI does two jobs: extracting atomic claims with structured output, and retrieving
contradictions. **Everything else is deterministic arithmetic over federal metered data.**

The AI reads the text. The physics comes from EIA-930. That division is why the verdicts
are defensible: no model is asked to judge whether a company is greenwashing — it is asked
what the company said, and the grid answers the rest.

AI is kept out of the facility lookup entirely, because it produces confidently wrong
balancing-authority mappings. Naive geography puts Meta's Prineville site and Microsoft's
Quincy site both in BPAT. Both are wrong, in opposite directions, and both would flip a
verdict. That table is built by hand from serving-utility tariffs and company disclosures,
with a source URL per row.

---

## Scale

| | |
|---|---|
| Documents | 4 sustainability reports + 4 SEC 10-K filings |
| Citable passages | 354, every one with a page number or an Item locator |
| Claims extracted | 1,179, of which **531 quantified** — the usable set |
| Dropped for paraphrase | 20, by a guard that requires character-exact quotes |
| Verified contradiction findings | **9, zero unverified** |
| Grid rows behind the verdicts | 4.45 million hourly, 70 balancing authorities |
