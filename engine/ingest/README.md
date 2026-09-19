# engine/ingest

Turns company disclosure PDFs into citable JSONL chunks for claim extraction.

```bash
source ~/hackmit-venv/bin/activate
python3 -m engine.ingest --ticker META    # one company
python3 -m engine.ingest --all            # all four
```

Output: `claims/raw/{TICKER}_esg.jsonl`, one JSON object per line:

```json
{"text": "...", "page": 10, "source_doc": "...pdf", "source_url": "https://...", "ticker": "META", "year": 2025}
```

## What `page` means, exactly

`page` is the **1-indexed position of the page in the PDF file** — the number a PDF
viewer shows in its page box, so "page 10" lands a reader on the right page.

It is *not* necessarily the printed folio in the page's own footer. Reports with
unnumbered covers or roman-numeral front matter can have a folio that differs by a
page or two. If the UI ever shows the citation next to the words "as printed in the
report", that wording is wrong; "page 10 of the PDF" is right.

Verified over all 309 chunks of the four 2025/2026 reports: every chunk's text is
verbatim present on the page it cites, 0 mismatches.

## Design commitments

- **A chunk never spans a page.** Packing short pages together would give fuller
  2000-token chunks at the cost of citations that are sometimes off by a page. A
  wrong citation discredits every other number on screen, so exact pages win.
  Graphic-heavy report pages therefore produce small chunks. That is intended.
- **Token counts are whitespace words**, not BPE. Coarse, but deterministic and
  dependency-free, and only used to size chunks.
- **A record with no page is unwritable.** `write_jsonl` raises rather than emit a
  line the UI cannot cite.

## Provenance

`claims/raw/sources.json` records, per ticker, the real `source_url` downloaded
from, the title, the year, the byte size and the sha256. The PDFs themselves are
gitignored (`claims/raw/pdf/`, ~66 MB); re-download them from the recorded URLs.

## SEC EDGAR

`engine/ingest/edgar.py` is written and unit-tested but **deliberately unexercised**.
It reads the contact address from `EDGAR_UA_EMAIL` and raises, naming the variable,
when unset — SEC blocks requests without a contact email and an IP ban would block
the whole team. The address is never hardcoded and never committed.

Two things are unresolved before EDGAR output can be written, see the handoff notes:
10-K filings on EDGAR are HTML and have **no page numbers**, so they cannot satisfy
the `page` contract without inventing one.

## Extraction

Text comes from PyMuPDF layout **blocks**, not from clustering individual
words. Blocks are paragraphs and table rows already grouped by the renderer.
Ordering them is all this module does: a block spanning >60% of the page width
is a banner that separates one horizontal section from the next, and within a
section blocks are grouped into columns **by their left edge** and read top to
bottom, column by column.

An earlier version clustered words by x coordinate. It fixed plain two-column
body text and failed on everything else — full-width headers torn across bands
and losing words, tables flattened into orphaned numbers, and pages with two
text layers interleaving per character ("632%3% C apPituarlc ghoasoedds").

Clustering is on the LEFT edge rather than the gap to the previous block's
right edge, because columns share a left margin while right edges are ragged.
On Google's executive summary a heading block ends exactly where the next
column begins; gap-on-right-edge merged the columns and spliced every sentence
on the page.

`claims/raw/pdf/` is gitignored, so `tests/test_real_pages.py` skips when the
PDFs are absent. Those are the tests that matter: run the download first.

**Licence note:** PyMuPDF is AGPL-3.0. Fine for a hackathon; someone should
decide deliberately before this ships as a product.

## Quality flags

Every chunk carries `quality`: `ok`, `tabular`, or `suspect`, with reasons.
A substring check against the page cannot tell good text from bad — garbled
output is still "present on the page" that produced it — so a consumer needs
an explicit signal. Current corpus: 341 ok, 7 tabular, 6 suspect of 354.
Never quote a `suspect` chunk; quote numbers but not prose from a `tabular`
one.

## Two lessons worth keeping

**A self-consistent check cannot find a systematic bias in the instrument it
checks with.** The first page audit compared every chunk against the same
extraction that produced it. It proved provenance — the text really did come
from that page — and was structurally incapable of noticing that the extraction
had scrambled reading order across columns. Necessary, not sufficient. The
audit that actually caught it re-read the *rendered* page: a different
instrument. Five spot-checks on two-column pages would have found it on day one.

**A result that looks tidy, or looks empty, is data about your pipeline.** The
contradiction detector returned five findings for Microsoft and zero for Meta,
although Meta makes the same annual-matching claim in plainer language. That
asymmetry made no sense, and chasing it — rather than accepting the output —
is what surfaced the column-splicing bug. The null result diagnosed the
upstream defect.

**Corollary, learned the hard way twice.** The acceptance set for the
extraction rewrite was META p3, META p18, GOOGL p94 and AMZN p11. All four
passed while GOOGL p4 — the page four of the eight findings rest on — silently
regressed into spliced text. It was not in the set because nobody had seen it
break. Any page a finding cites belongs in the regression set, automatically.
