"""PDF text extraction that keeps the page number attached to the text and
reconstructs the reading order of a laid-out report page.

Reading a report page straight across splices its columns together mid
sentence and produces text that appears nowhere in the document. Since every
quote we show on screen is meant to be verbatim, that is unusable.

An earlier version of this module clustered individual WORDS by x coordinate.
That fixed plain two-column body text and failed on everything else: word
boxes do not separate cleanly when columns sit close together, a full-width
header gets torn across the bands and loses words, tables flatten into a wall
of orphaned numbers, and a page with two text layers interleaves per character
("632%3% C apPituarlc ghoasoedds").

PyMuPDF hands back layout BLOCKS -- paragraphs and table rows already grouped
by the renderer -- which removes all four failure modes at once. What is left
is ordering the blocks, which is what this module does: a block spanning most
of the page width is a banner that separates one horizontal section from the
next, and within a section the blocks are read column by column.
"""

import pymupdf

FULL_WIDTH_FRACTION = 0.60  # a block this wide spans the columns: a banner
COLUMN_X0_GAP = 30          # difference in LEFT EDGE that starts a new column
TEXT_BLOCK = 0              # PyMuPDF block type; 1 is an image


def _order_blocks(blocks, page_width):
    """Reading order: banners split the page, columns are read left to right."""
    ordered, pending = [], []

    def flush():
        if not pending:
            return
        # Cluster on the LEFT EDGE, not on the gap to the previous block's
        # right edge. Columns share a left margin, whereas right edges are
        # ragged: on Google's executive summary one heading block ends exactly
        # where the next column begins, and gap-on-right-edge merged the two
        # columns into one, splicing every sentence on the page.
        columns, current = [], []
        for block in sorted(pending, key=lambda b: b[0]):
            if current and block[0] - current[-1][0] > COLUMN_X0_GAP:
                columns.append(current)
                current = [block]
            else:
                current.append(block)
        if current:
            columns.append(current)
        for column in columns:
            ordered.extend(sorted(column, key=lambda b: b[1]))
        pending.clear()

    for block in sorted(blocks, key=lambda b: b[1]):
        if (block[2] - block[0]) > FULL_WIDTH_FRACTION * page_width:
            flush()
            ordered.append(block)
        else:
            pending.append(block)
    flush()
    return ordered


INNER_GUTTER_PT = 20   # a gap this wide INSIDE one block is a real column gap
MIN_COLUMN_LINES = 2   # ...but only if both sides are more than a stray label


def _split_wide_block(block, words):
    """Some PDFs emit two columns as a single full-width block. Split it when
    its own words fall into separated x-clusters that are each several lines
    deep; a genuine banner heading is one cluster and passes through."""
    x0, top, x1, bottom = block[:4]
    inside = [w for w in words
              if w[0] >= x0 - 1 and w[2] <= x1 + 1
              and w[1] >= top - 1 and w[3] <= bottom + 1]
    if not inside:
        return None

    clusters, current = [], [inside[0]]
    for w in sorted(inside, key=lambda w: w[0])[1:]:
        if w[0] - max(c[2] for c in current) > INNER_GUTTER_PT:
            clusters.append(current)
            current = [w]
        else:
            current.append(w)
    clusters.append(current)
    if len(clusters) < 2:
        return None
    if any(len({round(w[1]) for w in c}) < MIN_COLUMN_LINES for c in clusters):
        return None

    out = []
    for c in clusters:
        lines = {}
        for w in c:
            lines.setdefault(round(w[1]), []).append(w)
        out.append(" ".join(" ".join(w[4] for w in sorted(ws, key=lambda w: w[0]))
                            for _, ws in sorted(lines.items())))
    return out


def page_text(page):
    blocks = [b for b in page.get_text("blocks") if b[6] == TEXT_BLOCK]
    if not blocks:
        return ""

    words = page.get_text("words")
    width = page.rect.width
    parts = []
    for b in _order_blocks(blocks, width):
        if (b[2] - b[0]) > FULL_WIDTH_FRACTION * width:
            split = _split_wide_block(b, words)
            if split:
                parts.extend(split)
                continue
        if b[4].strip():
            parts.append(b[4].strip())
    return "\n".join(parts)


def extract_pages(path):
    """Return [(page_number, text)] with page numbers 1-indexed as printed."""
    with pymupdf.open(str(path)) as doc:
        return [(i, page_text(page)) for i, page in enumerate(doc, 1)]
