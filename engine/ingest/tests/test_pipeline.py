"""End to end over a real PDF: pages in, citable records out."""

import pytest
from reportlab.pdfgen import canvas

from engine.ingest.pipeline import ingest_pdf


@pytest.fixture
def report_pdf(tmp_path):
    path = tmp_path / "report.pdf"
    c = canvas.Canvas(str(path))
    for n in range(1, 4):
        c.drawString(72, 720, f"page {n} says we matched 100 percent renewable energy")
        c.showPage()
    c.save()
    return path


def test_produces_records_covering_every_page(report_pdf):
    records = ingest_pdf(report_pdf, ticker="META", year=2025,
                         source_doc="report.pdf",
                         source_url="https://example.com/report.pdf")

    assert sorted({r["page"] for r in records}) == [1, 2, 3]


def test_every_record_is_citable_and_carries_provenance(report_pdf):
    records = ingest_pdf(report_pdf, ticker="META", year=2025,
                         source_doc="report.pdf",
                         source_url="https://example.com/report.pdf")

    assert records
    for r in records:
        assert isinstance(r["page"], int) and r["page"] >= 1
        assert r["text"].strip()
        assert r["source_url"] == "https://example.com/report.pdf"
        assert r["ticker"] == "META"
        assert r["year"] == 2025
