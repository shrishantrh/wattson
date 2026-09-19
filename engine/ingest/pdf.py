"""PDF text extraction that keeps the page number attached to the text, and
reads multi-column pages one column at a time.

pdfplumber's default extract_text() reads straight across the page, so on a
two-column layout it splices the columns together mid-sentence and produces text
that appears nowhere in the document. Since every quote we show on screen is
meant to be verbatim, that is unusable: we assemble the columns ourselves.

A gutter is a vertical strip where word density collapses relative to the rest of
the page. It is a density trough rather than a strictly empty strip, because a
real report almost always has a few elements straddling the gap -- a rule,
a caption, a banner -- and requiring perfect emptiness finds no gutter at all.
Troughs are only looked for in the middle of the page, so page margins do not
register, and a page whose text is too sparse to have a reliable density profile
is treated as a single column.
"""

import pdfplumber

MIN_GUTTER_PT = 14         # narrower than this is word spacing, not a column gap
FULL_WIDTH_FRACTION = 0.4  # a word this wide spans columns: a banner, not body
LINE_TOLERANCE_PT = 3.0    # words within this vertical distance share a line
TROUGH_FRACTION = 0.12     # density this far below the page's peak reads as a gap
MIN_PEAK_DENSITY = 3       # below this the page is too sparse to profile
EDGE_MARGIN = 0.15         # ignore troughs in the outer 15% -- those are margins


def _gutters(words, page_width):
    """x-ranges where word density collapses: the gaps between columns."""
    density = [0] * (int(page_width) + 2)
    for w in words:
        if (w["x1"] - w["x0"]) > FULL_WIDTH_FRACTION * page_width:
            continue
        for x in range(max(0, int(w["x0"])), min(len(density), int(w["x1"]) + 1)):
            density[x] += 1

    peak = max(density)
    if peak < MIN_PEAK_DENSITY:
        return []
    threshold = max(1, TROUGH_FRACTION * peak)
    low, high = EDGE_MARGIN * page_width, (1 - EDGE_MARGIN) * page_width

    gaps, x = [], 0
    while x < len(density):
        if density[x] > threshold:
            x += 1
            continue
        start = x
        while x < len(density) and density[x] <= threshold:
            x += 1
        if x - start >= MIN_GUTTER_PT and start > low and x < high:
            gaps.append((start, x))
    return gaps


def _band_edges(words, page_width):
    edges = [0.0]
    for start, end in _gutters(words, page_width):
        edges.append((start + end) / 2.0)
    edges.append(float(page_width) + 1)
    return edges


def _lines(words):
    """Group words into visual lines, then read each line left to right."""
    out, current, current_top = [], [], None
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        if current_top is None or abs(w["top"] - current_top) <= LINE_TOLERANCE_PT:
            current.append(w)
            current_top = w["top"] if current_top is None else current_top
        else:
            out.append(current)
            current, current_top = [w], w["top"]
    if current:
        out.append(current)
    return [" ".join(w["text"] for w in sorted(line, key=lambda w: w["x0"]))
            for line in out]


def page_text(page):
    words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
    if not words:
        return ""

    edges = _band_edges(words, page.width)
    bands = [[] for _ in range(len(edges) - 1)]
    for w in words:
        mid = (w["x0"] + w["x1"]) / 2.0
        for i in range(len(edges) - 1):
            if edges[i] <= mid < edges[i + 1]:
                bands[i].append(w)
                break

    return "\n".join("\n".join(_lines(b)) for b in bands if b)


def extract_pages(path):
    """Return [(page_number, text)] with page numbers 1-indexed as printed."""
    with pdfplumber.open(str(path)) as pdf:
        return [(i, page_text(p)) for i, p in enumerate(pdf.pages, 1)]
