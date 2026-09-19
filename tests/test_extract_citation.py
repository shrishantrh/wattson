"""Citations for a corpus with two source types.

ESG reports are paginated PDFs and carry a page. 10-K filings are SEC HTML
and carry `page: null` with an html_anchor locator instead. Inventing a page
number for an HTML filing would be fabricating provenance, which is the exact
failure this whole module exists to prevent.

So the invariant is not "every claim has a page". It is "every claim has a
citation a human can follow back to the source".
"""
from engine.extract import verify as V

PDF_CHUNK = {
    "text": "In 2024, 62% of our electricity came from carbon-free sources.",
    "page": 17, "source_doc": "report.pdf", "source_url": "https://x/report.pdf",
    "ticker": "META", "year": 2025, "quality": {"flag": "ok", "reasons": []},
}

HTML_CHUNK = {
    "text": "In 2024, 62% of our electricity came from carbon-free sources.",
    "page": None, "source_doc": "meta-20251231.htm",
    "source_url": "https://sec.gov/meta-20251231.htm",
    "ticker": "META", "year": 2025,
    "locator": {"type": "html_anchor", "item": "1", "char_offset": 0},
    "quality": {"flag": "ok", "reasons": []},
}


def claim():
    return {"verbatim": "In 2024, 62% of our electricity came from carbon-free sources.",
            "year": 2024, "metric": "cf share", "magnitude": 62.0,
            "unit": "percent", "timeframe": "2024", "scope": "global",
            "falsifiability": 0.95, "greenwash_patterns": []}


def test_pdf_claim_cites_a_page():
    kept, _, _ = V.reconcile([claim()], PDF_CHUNK)
    assert kept[0]["citation"] == {"type": "page", "page": 17}
    assert kept[0]["page"] == 17


def test_html_claim_cites_its_anchor_and_never_invents_a_page():
    kept, _, _ = V.reconcile([claim()], HTML_CHUNK)
    assert kept[0]["page"] is None
    assert kept[0]["citation"]["type"] == "html_anchor"
    assert kept[0]["citation"]["item"] == "1"


def test_every_claim_has_a_followable_citation():
    for chunk in (PDF_CHUNK, HTML_CHUNK):
        kept, _, _ = V.reconcile([claim()], chunk)
        assert kept[0]["citation"] is not None
        assert kept[0]["source_url"]


def test_a_chunk_with_neither_page_nor_locator_yields_no_claim():
    """Without provenance we do not publish the quote at all."""
    orphan = dict(HTML_CHUNK)
    orphan.pop("locator")
    kept, dropped, _ = V.reconcile([claim()], orphan)
    assert kept == []
    assert dropped[0]["reason"] == "no_citation"
