"""Extraction must report the page each block of text really came from."""

import pytest
from reportlab.pdfgen import canvas

from engine.ingest.pdf import extract_pages


@pytest.fixture
def three_page_pdf(tmp_path):
    path = tmp_path / "sample.pdf"
    c = canvas.Canvas(str(path))
    for n, line in enumerate(["alpha on one", "bravo on two", "charlie on three"], 1):
        c.drawString(72, 720, line)
        c.showPage()
    c.save()
    return path


def test_returns_one_entry_per_page_numbered_from_one(three_page_pdf):
    pages = extract_pages(three_page_pdf)

    assert [p for p, _ in pages] == [1, 2, 3]


def test_text_is_attributed_to_the_page_it_appears_on(three_page_pdf):
    pages = dict(extract_pages(three_page_pdf))

    assert "alpha" in pages[1]
    assert "bravo" in pages[2]
    assert "charlie" in pages[3]
    assert "bravo" not in pages[1]
