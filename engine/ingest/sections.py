"""Slice a 10-K down to Items 1 (Business) and 1A (Risk Factors).

The table of contents names every Item too, so the first "Item 1" match is
usually the TOC, not the body. We pick the candidate span that contains the most
text: a TOC entry is followed by the next TOC line within a few words, while the
real Item 1 is followed by pages of prose.
"""

import re

START = re.compile(r"item\s*1\s*[.\-–:]?\s*(business\b|\n)", re.I)
END = re.compile(r"item\s*(1b|2)\s*[.\-–:]?", re.I)


def _flatten(pages):
    """Concatenate pages, remembering the character offset each page starts at."""
    parts, offsets, cursor = [], [], 0
    for page_no, text in pages:
        text = text or ""
        offsets.append((cursor, page_no))
        parts.append(text)
        cursor += len(text) + 1
    return "\n".join(parts), offsets


def slice_items_1_and_1a(pages):
    """Return [(page_number, text)] covering Items 1 and 1A only."""
    doc, offsets = _flatten(pages)

    best = None
    for m in START.finditer(doc):
        end = END.search(doc, m.end())
        stop = end.start() if end else len(doc)
        if best is None or (stop - m.start()) > (best[1] - best[0]):
            best = (m.start(), stop)
    if best is None:
        return []

    lo, hi = best
    kept = []
    for idx, (page_start, page_no) in enumerate(offsets):
        page_end = offsets[idx + 1][0] - 1 if idx + 1 < len(offsets) else len(doc)
        if page_end <= lo or page_start >= hi:
            continue
        segment = doc[max(lo, page_start):min(hi, page_end)].strip()
        if segment:
            kept.append((page_no, segment))
    return kept
