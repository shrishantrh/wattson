"""Prompt assembly. The anchors go in verbatim and are never reworded.

The anchors are hand-written by a human and are the only reason a
falsifiability score means anything rather than encoding the model's own
priors. This module copies them in exactly as written; a test asserts every
anchor text, rationale and edge-case rule survives into the prompt.
"""
from __future__ import annotations

import json
from pathlib import Path

from .schema import GREENWASH_PATTERNS

REPO_ROOT = Path(__file__).resolve().parents[2]
ANCHORS_PATH = REPO_ROOT / "fixtures" / "falsifiability_anchors.json"


def load_anchors() -> dict:
    with ANCHORS_PATH.open() as fh:
        return json.load(fh)


def build_system_prompt() -> str:
    a = load_anchors()

    high = "\n".join(
        f"  score {x['score']}: \"{x['text']}\"\n    why: {x['why']}"
        for x in a["high"])
    low = "\n".join(
        f"  score {x['score']}: \"{x['text']}\"\n    why: {x['why']}"
        for x in a["low"])
    edges = "\n".join(
        f"  RULE: {x['rule']}\n    example: \"{x['example']}\"\n"
        f"    guidance: {x['guidance']}"
        for x in a["edge_cases"])

    return f"""\
You extract environmental and energy claims from corporate sustainability \
reports so they can be checked against grid data.

COPY, DO NOT WRITE. The `verbatim` field must be the claim copied \
character-for-character out of the chunk you are given. Do not correct \
spelling, spacing, line breaks, capitalisation or punctuation. Do not merge \
sentences or trim clauses. A quote that has been tidied is a fabricated \
citation once it is printed next to a page number. If you cannot reproduce \
the text exactly, omit the claim entirely.

THE CORPUS IS PARTLY CORRUPT. These chunks came out of multi-column PDFs and some are damaged: columns spliced so clauses interleave out of order, section headings landing mid-sentence, tables flattened into prose, subscripts displaced into the next sentence. Set chunk_quality.is_legible_prose to false and return NO claims when the text does not read as coherent English. Judge the text, not the company - a garbled chunk is our extractor's fault, never evidence of anything about the company. Quoting spliced text beside a page number would be a fabricated citation.

QUOTES MUST BE SELF-CONTAINED. A reader seeing only your verbatim and its page number must be able to check the claim. "That equals more than 4,000 acres." is not checkable alone: the subject is in the previous sentence. Either extend the quote backwards to include what it refers to - still copied exactly, still one continuous span of the source - or omit the claim. A fragment that depends on surrounding text is not more falsifiable because it contains a number.

PRECISION OVER RECALL. Most chunks contain no claim. Return an empty claims \
array for those. Headings, page furniture, contents listings, narrative \
colour and generic corporate description are not claims. Four solid claims \
are a better result than forty padded ones. Do not stretch to find something.

FALSIFIABILITY
{a['definition']}

Scale: {a['scale']}

Calibrate against these hand-written anchors. They are authoritative. Do not \
adjust them, average them away, or substitute your own intuition.

HIGH:
{high}

LOW:
{low}

EDGE CASES - these are the ones most often got wrong:
{edges}

Two of those edge rules matter enough to restate:
  - An EXCLUSION is not a hedge. When a company says its target excludes \
something, it is TIGHTENING its own standard. That raises falsifiability and \
must never be tagged as a greenwash pattern. Reading it as evasion is unfair \
to the company and we treat it as an error.
  - Scope narrowing raises falsifiability. "100% across owned-and-operated \
facilities" is MORE checkable than "100% renewable", not less. Tag \
hidden_tradeoff, but do not lower the score.

GREENWASH PATTERNS
Use only these tags: {", ".join(GREENWASH_PATTERNS)}.
Leave the array empty when none applies, which is the common case. A tag is a \
description of the language used, never an accusation of dishonesty.

Return only the structured object. No commentary.
"""


def build_user_prompt(chunk: dict) -> str:
    return (
        f"Company: {chunk['ticker']}\n"
        f"Document: {chunk['source_doc']}\n"
        f"Page: {chunk['page']}\n\n"
        f"CHUNK TEXT (copy quotes from here exactly):\n"
        f"<<<CHUNK\n{chunk['text']}\nCHUNK\n"
    )
