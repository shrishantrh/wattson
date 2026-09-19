"""Wire extraction and chunking together."""

from engine.ingest.chunker import chunk_pages
from engine.ingest.pdf import extract_pages


def ingest_pdf(path, *, ticker, year, source_doc, source_url,
               target_tokens=2000, overlap_tokens=200):
    pages = extract_pages(path)
    return chunk_pages(pages, ticker=ticker, year=year, source_doc=source_doc,
                       source_url=source_url, target_tokens=target_tokens,
                       overlap_tokens=overlap_tokens)
