"""Mechanical chunk-quality gate.

The verbatim check proves a quote matches its chunk. It cannot prove the
chunk matches the document. PDF extraction destroyed text in this corpus in
four distinct ways, and a spliced quote printed beside a page number is a
fabricated citation that passes every verbatim test.

This gate refuses to quote from visibly destroyed text. It is deliberately
cheap and runs before any API call. It catches mechanical corruption; it
does NOT reliably catch column splicing, which reads as ordinary words in
the wrong order. The model-side `chunk_quality.is_legible_prose` judgement is
the second line for that.
"""
from __future__ import annotations

import re

ISSUES = (
    "doubled_glyphs",          # overlaid text layer: "22002255 MMeettaa"
    "interleaved_layers",      # per-character merge: "apPituarlc ghoasoedds"
    "subscript_displacement",  # CO2e split, the 2 landing in a later sentence
    "numeric_density",         # a table flattened into a line of prose
    "too_short",               # headings and page furniture
)

MIN_CHARS = 120
MAX_NUMERIC_TOKEN_RATIO = 0.25
MAX_MIDWORD_CAPS_RATIO = 0.04

_DOUBLED = re.compile(r"(?:([A-Za-z0-9])\1){4,}")
_SUBSCRIPT = re.compile(r"\b(?:CO|H|NO|SO)\s+(?:e|O|x)\b")
# A lower-case run followed by a capital inside a word: "apPituarlc".
_MIDWORD_CAP = re.compile(r"[a-z]{2}[A-Z][a-z]")
_NUMERIC = re.compile(r"^[<>~]?[\d,.]+%?$")


def _numeric_ratio(tokens) -> float:
    if not tokens:
        return 0.0
    return sum(1 for t in tokens if _NUMERIC.match(t)) / len(tokens)


def _midword_cap_ratio(tokens) -> float:
    if not tokens:
        return 0.0
    return sum(1 for t in tokens if _MIDWORD_CAP.search(t)) / len(tokens)


def assess(text: str) -> dict:
    """Return {"usable": bool, "issues": [...], "metrics": {...}}."""
    tokens = text.split()
    issues = []

    if len(text) < MIN_CHARS:
        issues.append("too_short")
    if _DOUBLED.search(text):
        issues.append("doubled_glyphs")
    if _SUBSCRIPT.search(text):
        issues.append("subscript_displacement")

    numeric = _numeric_ratio(tokens)
    if numeric > MAX_NUMERIC_TOKEN_RATIO:
        issues.append("numeric_density")

    midword = _midword_cap_ratio(tokens)
    if midword > MAX_MIDWORD_CAPS_RATIO:
        issues.append("interleaved_layers")

    return {
        "usable": not issues,
        "issues": issues,
        "metrics": {
            "chars": len(text),
            "tokens": len(tokens),
            "numeric_token_ratio": round(numeric, 3),
            "midword_cap_ratio": round(midword, 3),
        },
    }
