"""PDF text extraction that keeps the page number attached to the text."""

import pdfplumber


def extract_pages(path):
    """Return [(page_number, text)] with page numbers 1-indexed as printed."""
    pages = []
    with pdfplumber.open(str(path)) as pdf:
        for i, page in enumerate(pdf.pages, 1):
            pages.append((i, page.extract_text() or ""))
    return pages
