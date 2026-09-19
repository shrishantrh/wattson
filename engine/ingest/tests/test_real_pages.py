"""Regression tests against the real report pages, one per defect class.

These need the source PDFs, which are gitignored (claims/raw/pdf/). They skip
when absent rather than fail. Synthetic fixtures already passed while three of
four real 10-K slices were wrong, so the real pages are the ones that count.
"""

import pathlib
import pytest

from engine.ingest.pdf import extract_pages

PDFS = pathlib.Path("claims/raw/pdf")
_cache = {}


def page_text(ticker, number):
    pdf = PDFS / f"{ticker}_esg.pdf"
    if not pdf.exists():
        pytest.skip(f"{pdf} not downloaded")
    if ticker not in _cache:
        _cache[ticker] = dict(extract_pages(pdf))
    return " ".join(_cache[ticker][number].split()).replace("↗", "")


def test_meta_p18_matching_claim_is_contiguous():
    """The acceptance sentence. It exists on the page; it must come out whole."""
    assert ("Since 2020, we have matched 100% of our annual electricity use "
            "with clean and renewable energy.") in page_text("META", 18)


def test_meta_p18_full_width_header_is_not_fragmented():
    """Defect 1: column banding split the full-width header and dropped words,
    yielding "Advancing the technologies that will connection - including the
    next wave electric grids to expand and embrace and renewable energy."."""
    assert ("Advancing the technologies that will build the future of human "
            "connection") in page_text("META", 18)


def test_meta_p12_subscripts_do_not_displace_into_the_next_sentence():
    """Defects 2 and 4: character-level layer interleaving and a subscript 2
    landing inside the following sentence."""
    text = page_text("META", 12)

    assert "8.2 M MT of CO2e" in text or "8.2 M MT of CO₂e" in text
    assert "and 2 methodology details" not in text
    assert "apPituarlc" not in text, "two text layers merged per character"


def test_googl_p94_cfe_table_keeps_its_numbers():
    """Defect 3: the hourly CFE table flattened to prose, losing every value.
    This is the most quotable data in the corpus."""
    text = page_text("GOOGL", 94)

    assert "CFE across Google data centers (hourly) % 65 64 64 66 65" in text


def test_amzn_p11_reads_as_prose():
    text = page_text("AMZN", 11)

    assert "150,000 metric tons of CO₂e annually" in text


def test_googl_p4_columns_are_not_spliced():
    """The page four findings rest on. A heading block whose right edge touches
    the start of the next column merged the two columns together, producing
    "Furthermore, the emissions again matched 100% of our electricity
    consumption with we successfully avoided in 2025 represent seven times".

    This page was NOT in the original acceptance set and regressed silently,
    which is the same lesson as the Item slicer: the tests only cover the
    failures someone thought of."""
    text = page_text("GOOGL", 4)

    assert ("In 2025, we navigated our largest load growth in history"
            in text)
    assert ("again matched 100% of our electricity consumption with renewable "
            "energy purchases (on a global and annual basis)" in text)
    assert ("we set net zero and 24/7 carbon-free energy2 (CFE) moonshots"
            in text)
    assert "consumption with we successfully avoided" not in text


def test_googl_p10_reads_as_prose_not_navigation_furniture():
    text = page_text("GOOGL", 10)

    assert "running on 24/7 carbon-free energy" in text
