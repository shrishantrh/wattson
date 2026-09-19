"""Slice a 10-K down to Items 1 (Business) and 1A (Risk Factors).

The table of contents names every Item too, so the first "Item 1" match is
usually the TOC, not the body. We pick the candidate span that contains the most
text: a TOC entry is followed by the next TOC line within a few words, while the
real Item 1 is followed by pages of prose.
"""

import re

# A real heading starts a line AND carries its title. Both halves matter:
#   - Microsoft repeats a bare "Item 1A" as a running page header on every page
#     of the risk factors, so the title is what separates heading from header.
#   - Google writes "...described in Item 1 Business and Note 15..." mid
#     paragraph, so the line start is what separates heading from cross
#     reference. Starting there ran the slice to the signature page.
#   - Amazon's forward-looking paragraph mentions a later Item inline, which
#     truncated Items 1 and 1A to 367 words of a 42,000-word filing.
# Contents pages list the items with their titles on the following line, so
# they fail the same-line test; where they do not, the longest-span rule below
# still prefers the body over the few words of a contents entry.
START = re.compile(r"^[ \t]*item\s*1\s*[.\-–:]?\s*business\b", re.I | re.M)
END = re.compile(
    r"^[ \t]*item\s*(?:1b|2)\s*[.\-–:]?\s*(?:unresolved|properties)\b",
    re.I | re.M)


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


ITEM_1A = re.compile(r"^[ \t]*item\s*1a\s*[.\-–:]?\s*risk\s*factors\b",
                     re.I | re.M)


def split_items(text):
    """Split an Items 1--1A span into [("1", text), ("1A", text)].

    Uses the titled heading, not a running page header: Microsoft repeats a
    bare "Item 1A" atop every page of its risk factors, and taking the last
    such marker left Item 1A with 759 words instead of eleven thousand.
    Whichever part is absent is simply omitted rather than guessed at.
    """
    m = ITEM_1A.search(text)
    if m is None:
        return [("1", text.strip())] if text.strip() else []

    first, second = text[:m.start()].strip(), text[m.start():].strip()
    out = []
    if first:
        out.append(("1", first))
    if second:
        out.append(("1A", second))
    return out
