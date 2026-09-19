"""Structural evidence class, computed from the model's own returned fields.

This is NOT a second opinion on falsifiability and it never changes the
model's score. It exists because the score alone is not safe to sort on: the
model rates specific-sounding activity statements highly even when they carry
no number and no date. For META, 37 of 124 claims scoring 0.8 or above had
neither.

The anchors have a rule for a number with an undefined metric, and no rule for
the inverse. Adding an anchor is a human's decision, explicitly not ours, so
the score is left untouched and this axis is offered beside it.
"""
from __future__ import annotations

import collections
import re

#: Years are not quantities. "In 2022, Amazon committed to..." carries a digit
#: and promises nothing measurable, so years are removed before looking for
#: one. Without this, 30% of qualitative claims look quantified.
_YEAR = re.compile(r"\b(?:19|20)\d{2}\b")
_DIGIT = re.compile(r"\d")


def has_quantity(verbatim: str) -> bool:
    """A number that is not merely a date.

    The model returns `magnitude: null` whenever a claim carries more than one
    number, which silently misfiled real targets ("Restore 200% ... and 100%
    ...") as qualitative. This recovers them without touching the score.
    """
    return bool(_DIGIT.search(_YEAR.sub(" ", verbatim or "")))

CLASSES = ("quantified", "dated_commitment", "qualitative")


def evidence_class(claim: dict) -> str:
    if claim.get("magnitude") is not None:
        return "quantified"
    if has_quantity(claim.get("verbatim", "")):
        return "quantified"
    if claim.get("timeframe"):
        return "dated_commitment"
    return "qualitative"


def annotate(claims) -> list:
    return [{**c, "evidence_class": evidence_class(c)} for c in claims]


def summarise(claims) -> dict:
    counts = collections.Counter(evidence_class(c) for c in claims)
    return {k: counts.get(k, 0) for k in CLASSES if counts.get(k, 0)} or \
        {k: 0 for k in CLASSES}
