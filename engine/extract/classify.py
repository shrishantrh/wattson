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

#: A quantity is a STANDALONE number, optionally with separators, a decimal,
#: a percent sign or a magnitude suffix. Digits welded into a word are not
#: quantities: the "2" in C2ES and a footnote marker glued to "Alliance3"
#: between them exempted a list of trade-association memberships from the cap.
_QUANTITY = re.compile(r"(?<![A-Za-z0-9])\d[\d,.]*\s*(?:%|[KMB]\b)?(?![A-Za-z0-9])")


def has_quantity(verbatim: str) -> bool:
    """A number that is not merely a date.

    The model returns `magnitude: null` whenever a claim carries more than one
    number, which silently misfiled real targets ("Restore 200% ... and 100%
    ...") as qualitative. This recovers them without touching the score.
    """
    return bool(_QUANTITY.search(_YEAR.sub(" ", verbatim or "")))

CLASSES = ("quantified", "dated_commitment", "qualitative")

#: Ceiling for a claim the model's own fields say is uncheckable. Matches the
#: anchors' activity-statement rule ("score at or below 0.25").
UNCHECKABLE_CAP = 0.25


def apply_cap(claim: dict) -> dict:
    """Cap falsifiability when the model contradicts its own structured output.

    Falsifiability is defined as how checkable a claim is against physical or
    public data. A claim with no quantity and no date is uncheckable by that
    definition - there is no figure or deadline that could be found wrong. So
    when the model returns magnitude: null, timeframe: null, a verbatim with no
    quantity, AND a high falsifiability on the same object, it is contradicting
    itself. Catching that is arithmetic, not a second opinion.

    Two rounds of anchor work cut this from 30% of high scores to 15% and then
    plateaued, because the model reads specificity of LANGUAGE where the rubric
    means checkability of CONTENT. Named partners and named technologies make a
    sentence sound precise while committing to no measurable amount.

    The override is never silent: the model's own score is preserved as
    `falsifiability_model` and `falsifiability_capped` records that it fired.
    """
    # Idempotent: once capped, `falsifiability` holds 0.25, so reading it back
    # on a second pass would overwrite the only record of the model's score.
    model_score = claim.get("falsifiability_model", claim.get("falsifiability"))
    uncheckable = evidence_class(claim) == "qualitative"
    capped = uncheckable and model_score is not None and model_score > UNCHECKABLE_CAP
    return {
        **claim,
        "falsifiability": UNCHECKABLE_CAP if capped else model_score,
        "falsifiability_model": model_score,
        "falsifiability_capped": capped,
    }


def evidence_class(claim: dict) -> str:
    if claim.get("magnitude") is not None:
        return "quantified"
    if has_quantity(claim.get("verbatim", "")):
        return "quantified"
    if claim.get("timeframe"):
        return "dated_commitment"
    return "qualitative"


def annotate(claims) -> list:
    return [{**apply_cap(c), "evidence_class": evidence_class(c)}
            for c in claims]


def summarise(claims) -> dict:
    counts = collections.Counter(evidence_class(c) for c in claims)
    return {k: counts.get(k, 0) for k in CLASSES if counts.get(k, 0)} or \
        {k: 0 for k in CLASSES}
