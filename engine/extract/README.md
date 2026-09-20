# Claim extraction

Pulls checkable environmental and energy claims out of the ESG corpus, one
structured-output call per chunk, so each claim carries a verbatim quote, a
page, and a source URL.

```bash
set -a; . ~/.wattson.env; set +a          # OPENAI_API_KEY, never in the repo
source ~/hackmit-venv/bin/activate
python3 -m engine.extract --ticker META
python3 -m engine.extract --ticker ALL
```

Reads `claims/raw/{TICKER}_esg.jsonl` and `fixtures/falsifiability_anchors.json`.
Writes `claims/extracted/{TICKER}.json`. Model pinned to a dated snapshot
(`gpt-5-mini-2025-08-07`) so a rerun cannot silently change behaviour.

## The lesson this module exists to record

> My verbatim guard proves the quote matches the chunk. It cannot prove the
> chunk matches the document.

The first extraction run returned a claim scored 0.90 falsifiability that read:

> "This report outlines some of the ways Meta is our goals to achieve net zero
> emissions across working to minimize the impact of our energy our value chain
> and become water"

That passed the character-for-character verbatim check, because it **is** in
the chunk. The chunk is two PDF columns spliced together. The guard was working
perfectly and the output was garbage, because the guard checked the direction
we had already thought about.

This is the same failure as the page-fidelity audit, one layer apart: **a
self-consistent check cannot detect a bias in the instrument it checks with.**
It is why there are now three guards covering three different failures, and why
each one's limits are written down rather than assumed.

## Three guards, three different failures

| Guard | Catches | Does NOT catch | Cost |
|---|---|---|---|
| `gate.assess` | Mechanical corruption: overlaid glyph layers (`22002255 MMeettaa`), per-character layer merges, displaced subscripts (`CO e` with the 2 landing a sentence later), tables flattened into prose | **Column splicing** — ordinary words in the wrong order, which no regex here detects | Free, pre-API |
| `chunk_quality.is_legible_prose` | Column splicing and anything else that reads as incoherent English | Corruption that still reads fluently | One field on an existing call |
| `verify.reconcile` | Model paraphrase — an LLM silently tidying grammar | **Anything wrong with the chunk itself** | Free, post-API |

No guard subsumes another. The gate ran clean on the spliced META page 3; the
model caught it. The model cannot be trusted to quote exactly; the verbatim
check catches that. Each covers the others' blind spot only partially, and the
table above is the honest map of what is still uncovered.

## Provenance is never model-supplied

`page`, `source_doc`, `source_url` and `ticker` are injected from the chunk
record after the call. The JSON schema has no `page` property at all, so the
model cannot attach a quote to the wrong page even if it wants to. A test
asserts the field's absence.

Whitespace repair: PDF text wraps mid-sentence, and a model rejoining a wrapped
line is not paraphrasing. Those quotes are located in the source and stored as
**the source's characters**, not the model's, flagged
`verbatim_whitespace_repaired: true`. Anything that cannot be located exactly
is dropped and counted in `verbatim_check.dropped_not_in_source`.

## The anchors are copied in, not summarised

`fixtures/falsifiability_anchors.json` is hand-written by a human and is the
only reason a falsifiability score means anything rather than encoding the
model's own priors. The prompt includes all four high anchors, all four low
anchors, all three edge-case rules, and each one's stated rationale, verbatim.
Tests assert every one of those strings survives into the prompt, so a future
edit that "tidies" them fails the suite.

Two edge rules are restated in the prompt because they are the ones most often
got wrong:

- **An exclusion is not a hedge.** A company saying its target excludes
  short-term spot-market RECs is *tightening* its own standard. That raises
  falsifiability and is never tagged as greenwash. Reading it as evasion is
  unfair to the company and we treat it as an error.
- **Scope narrowing raises falsifiability.** "100% across owned-and-operated
  facilities" is *more* checkable than "100% renewable". Tag
  `hidden_tradeoff`; do not lower the score.

## A number we refuse to stand behind

`corpus.long_run_chunks` counts chunks containing a 45+ word run with no
sentence terminator. It is a rough corpus-health signal and it **over-counts**,
because real tables produce long runs legitimately. It is **not** a count of
spliced chunks. We do not know that number, we have no reliable detector for
splicing, and the field carries that warning inline so it cannot be quoted out
of context.

A number we cannot defend is worse than no number. That is this project's whole
thesis, applied to ourselves.

## The model inflates falsifiability for activity statements

On META, **124 of 194 claims scored 0.8 or above, but 37 of those carried
neither a number nor a date.** They are activity descriptions that merely sound
specific:

> "We announced an agreement with CarbonBuilt to upgrade additional concrete
> masonry plants and scale production of its low carbon concrete." — scored 0.90

The anchors have a rule for the inverse case ("a number alone does not make a
claim falsifiable if the metric is undefined", mid-range ~0.4). They have **no
rule for a specific-sounding statement with no quantity at all.** That is a gap
in the anchors, and filling it is a human's decision — the anchors are
hand-written on purpose and this module is forbidden from adding to them.

So the model's score is left exactly as returned, and a structural axis is
offered beside it, computed from the model's own fields:

| `evidence_class` | Rule | META |
|---|---|---|
| `quantified` | has a magnitude | 72 |
| `dated_commitment` | has a timeframe, no magnitude | 26 |
| `qualitative` | neither | 96 |

**Filter to `quantified` for anything displayed next to a grid figure.** Sorting
on falsifiability alone would put "we announced an agreement" level with "62% of
electricity from carbon-free sources".

## The guards were tested against a clean corpus

The first run used a corpus that was still column-spliced. D1 then replaced the
PDF extractor with PyMuPDF and regenerated everything. **Chunk counts were
identical at 309, so matching counts proved nothing** — the text changed
underneath. Re-running the same code over both is a direct test of whether the
guards detect real corruption or just fire on hard text.

Same 309 ESG chunks, same model, same code:

| | spliced corpus | clean corpus |
|---|---|---|
| gated out (mechanical) | 36 | 20 |
| flagged illegible by the model | **52** | **16** |
| claims extracted | 1,179 | 1,305 |

The legibility guard fell by 69% and claim yield rose 11%, which is what you
would expect if splicing was both triggering the guard and suppressing real
claims. The 16 that remain were checked by hand and are genuine: seven are
still column splices, seven are navigation rails flattened into the text
(`Overview Progress Appendix Climate and Energy Water Waste...` repeated on
AMZN pages 14, 15, 24, 36), two are truncated. **No false positives found.**

## A bug this found in our own classifier

The model returns `magnitude: null` whenever a claim carries more than one
number. `evidence_class` keyed on `magnitude`, so real quantitative targets
were being filed as `qualitative`:

> "Restore 200% of the water we consume in high water stress regions and 100%
> of the water we consume in medium water stress regions."

30% of claims classed `qualitative` contained a numeral. A bare digit test
over-corrects, because a year is not a quantity — "In 2022, Amazon committed
to reducing deforestation risks" promises nothing measurable. Years are
therefore stripped before looking for a number. That recovered **186 real
quantified claims** (655 -> 841) without touching a single score.

## The deterministic cap, and why it is not overruling the model

Two rounds of anchor work cut over-scoring from 30% of high scores to 15% and
then **plateaued**. The remaining cases are not a prompting problem, so they
are handled with arithmetic instead.

**The rule:** if `magnitude` is null AND `timeframe` is null AND the verbatim
contains no quantity once years are stripped, then falsifiability cannot exceed
**0.25**, whatever the model returned. The model's own value is preserved as
`falsifiability_model` and `falsifiability_capped` records that it fired. The
override is never silent.

This is not a second opinion. Falsifiability is defined as *how checkable a
claim is against physical or public data*. A claim with no quantity and no date
is uncheckable by that definition — there is no figure or deadline that could
be found wrong. When the model returns `magnitude: null` and
`falsifiability: 0.90` on the same object, it is **contradicting its own
structured output**, and catching that is arithmetic.

Effect across all four companies: **171 claims capped**, claims scoring >=0.8
fell from 988 to 872, and genuine escapes are now **zero**.

### The real finding, which is about LLM-scored rubrics

The classifier reads **specificity of language** where the rubric means
**checkability of content**. Named partners, named technologies and named
sites make a sentence sound precise while committing to no measurable amount:

> "The selected mix has been poured in our newest data centers, including in
> slab-on-grade applications that require stringent performance requirements."
> — scored 0.90 against an anchor that says 0.25, twice, after two anchor
> revisions aimed directly at it.

This is documented as a **known limitation handled by a deterministic guard**,
not as a solved problem. An LLM asked to score a rubric will track surface
specificity unless something outside the model holds it to the definition.

### A quantity is a standalone number

The first version of the cap tested for any digit after stripping years, and a
list of trade-association memberships escaped it — because of the "2" inside
**C2ES** and a footnote marker glued to **"Alliance3"**. Neither is a quantity.
Digits welded into a word no longer count.

### The cap must be idempotent

`--reclassify` re-reads its own output, and the first version read the
already-capped `falsifiability` back into `falsifiability_model` on a second
pass — destroying the only record of what the model actually said. It showed up
as `capped` falling from 163 to 8 and the count of model scores >=0.8 changing
from 988 to 880, a number that cannot legitimately change. The data was
restored from the pre-cap commit and the operation is now a fixed point, with a
test asserting it.

## Residual anchor non-compliance, reported not fixed

After the anchor author added a fifth low anchor and a fourth edge rule for
activity statements, META claims scoring >=0.8 with neither a number nor a date
fell from **37 of 124 (30%) to 21 of 143 (15%)**. Halved, not eliminated:

> "The selected mix has been poured in our newest data centers, including in
> slab-on-grade applications..." — still 0.90, against an anchor that says
> score at or below 0.25.

The anchor is working and the model still overshoots on some activity
statements. This is reported rather than patched, for the same reason as
before: calibration belongs to the anchor author, and `evidence_class` already
gives the demo a structural filter that does not depend on the score.

## Two source types, two kinds of citation

ESG reports are paginated PDFs and carry a `page`. 10-K filings are SEC HTML:
they carry `page: null` and an `html_anchor` locator with the Item number and a
character offset.

The invariant is therefore **not** "every claim has a page". It is **every
claim has a citation a human can follow**. Inventing a page number for an HTML
filing would be fabricating provenance, which is the failure this module exists
to prevent. A chunk offering neither a page nor a locator yields no claims at
all, dropped with reason `no_citation`.

The ingest layer's own `quality.flag` is honoured before this module's gate
runs. D1 flags `tabular` and `suspect` chunks with stated reasons; re-deriving
that here would only be a second opinion on someone else's measurement.

Their reasons — *"35% of tokens are numeric: a table, not prose"*, *"case flips
inside 2% of words: text layers may be interleaved per character"* — are the
same heuristics this module's gate arrived at independently, written by a
different agent against the same corpus. Convergence is not proof, but two
independent passes reaching the same signatures is mild evidence both are
measuring something real rather than each inventing a plausible test.

## Worktree hazard: a "local" git exclude is not local

While keeping files owned by other branches out of these commits, the obvious
move is `.git/info/exclude`. **In a linked worktree that is a trap.** `.git` is
a file pointing at the common git dir, so the exclude lands in the *shared*
repository directory and applies to every other worktree — it would have
silently hidden another agent's own files from their `git add`, and the
symptom would have looked like that agent forgetting to commit.

Use explicit paths with `git add` instead. Nothing in this module's commits
relies on an exclude.

## Precision over recall

Most chunks contain no claim and the correct output for them is an empty array.
The gate drops visibly corrupt chunks, the model drops illegible ones, and the
verbatim check drops paraphrases. `claims/extracted/{TICKER}.json` reports every
one of those counts, so the ratio of claims to source chunks is visible rather
than implied.

Quotes must also be self-contained: a reader seeing only the verbatim and its
page must be able to check it. A fragment whose subject sits in the previous
sentence is either extended backwards into one continuous exact span or omitted.
