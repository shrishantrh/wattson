"""Per-chunk extraction quality, so a consumer can refuse to quote bad text.

A substring check against the page cannot distinguish good text from bad:
garbled output is still "present on the page" that produced it. This is the
signal that makes a consumer-side gate accurate instead of heuristic.

Three outcomes:
  ok       prose, safe to quote verbatim
  tabular  real data, but a table read as a sentence -- quote the numbers,
           never the row as prose
  suspect  the extraction looks damaged; do not quote at all
"""

import re

WORD = re.compile(r"[^\s]+")
NUMERIC = re.compile(r"^[-+(]?[\d.,%$]+[)%]?$")
ALPHA = re.compile(r"[A-Za-z]")
# "apPituarlc", "ghoasoedds": two text layers merged per character leave case
# flipping inside a single word, which ordinary prose almost never does.
INNER_CASE_FLIP = re.compile(r"[a-z][A-Z][a-z]")

SHORT_ALPHA_LIMIT = 0.25
NUMERIC_LIMIT = 0.35
CASE_FLIP_LIMIT = 0.02


def assess(text):
    tokens = WORD.findall(text or "")
    reasons = []
    if len(tokens) < 5:
        return {"flag": "suspect", "reasons": ["too short to assess"]}

    alpha = [t for t in tokens if ALPHA.search(t)]
    short_alpha = [t for t in alpha if len(t) <= 2]
    numeric = [t for t in tokens if NUMERIC.match(t)]
    flips = [t for t in alpha if INNER_CASE_FLIP.search(t)]

    short_ratio = len(short_alpha) / max(1, len(alpha))
    numeric_ratio = len(numeric) / len(tokens)
    flip_ratio = len(flips) / max(1, len(alpha))

    if flip_ratio > CASE_FLIP_LIMIT:
        reasons.append(f"case flips inside {flip_ratio:.0%} of words: text "
                       f"layers may be interleaved per character")
    if short_ratio > SHORT_ALPHA_LIMIT:
        reasons.append(f"{short_ratio:.0%} of words are 1-2 characters: text "
                       f"may be shredded")
    if reasons:
        return {"flag": "suspect", "reasons": reasons}

    if numeric_ratio > NUMERIC_LIMIT:
        return {"flag": "tabular",
                "reasons": [f"{numeric_ratio:.0%} of tokens are numeric: "
                            f"a table, not prose"]}
    return {"flag": "ok", "reasons": []}
