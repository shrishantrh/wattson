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

## Precision over recall

Most chunks contain no claim and the correct output for them is an empty array.
The gate drops visibly corrupt chunks, the model drops illegible ones, and the
verbatim check drops paraphrases. `claims/extracted/{TICKER}.json` reports every
one of those counts, so the ratio of claims to source chunks is visible rather
than implied.

Quotes must also be self-contained: a reader seeing only the verbatim and its
page must be able to check it. A fragment whose subject sits in the previous
sentence is either extended backwards into one continuous exact span or omitted.
