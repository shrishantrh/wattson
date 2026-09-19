"""Wire extraction and chunking together."""

from engine.ingest.chunker import chunk_pages
from engine.ingest.pdf import extract_pages


def ingest_pdf(path, *, ticker, year, source_doc, source_url,
               target_tokens=2000, overlap_tokens=200):
    pages = extract_pages(path)
    return chunk_pages(pages, ticker=ticker, year=year, source_doc=source_doc,
                       source_url=source_url, target_tokens=target_tokens,
                       overlap_tokens=overlap_tokens)


# Items 1 and 1A of a large-cap 10-K run to five figures of words. Anything
# far below that means the section boundaries were misread, which is how
# Amazon's slice silently came back as 367 words of a 42,000-word filing.
MIN_ITEMS_WORDS = 3000


def _filing_text(ticker):
    from engine.ingest import edgar
    return edgar.filing_text(ticker)


def ingest_10k(ticker):
    """Fetch the latest 10-K and chunk Items 1 and 1A. Records carry a locator
    and a null page, because an HTML filing has no pages."""
    from engine.ingest.chunker import chunk_text
    from engine.ingest.sections import split_items

    text, url, year = _filing_text(ticker)
    words = len(text.split())
    if words < MIN_ITEMS_WORDS:
        raise ValueError(
            f"{ticker}: Items 1 and 1A sliced to {words} words, too short to be "
            f"real -- the section headings were probably misread. Refusing to "
            f"emit rather than ship a truncated filing. {url}")

    records = []
    for item, body in split_items(text):
        records.extend(chunk_text(body, item=item, ticker=ticker, year=year,
                                  source_doc=url.rsplit("/", 1)[-1],
                                  source_url=url))
    return records, url, year
