"""Chunk page-preserving document text into JSONL-ready records.

Two design commitments, both driven by how the output is used downstream:

1. A chunk never spans a page. We print "page 14" on screen beside a verbatim
   quote, so every word in a chunk must really be on the page the chunk names.
   Packing several short pages into one ~2000-token chunk would produce bigger
   chunks at the cost of citations that are sometimes off by a page, and a wrong
   citation is worse than a small chunk.
2. Token counts are approximated by whitespace-delimited words. Coarse against a
   real BPE tokenizer, but deterministic, dependency-free, and only used to size
   chunks -- nothing downstream bills on it.
"""

TARGET_TOKENS = 2000
OVERLAP_TOKENS = 200


def chunk_pages(pages, *, source_doc, source_url, ticker, year,
                target_tokens=TARGET_TOKENS, overlap_tokens=OVERLAP_TOKENS):
    if overlap_tokens >= target_tokens:
        raise ValueError("overlap_tokens must be smaller than target_tokens")

    stride = target_tokens - overlap_tokens
    chunks = []
    for page_no, text in pages:
        if not text or not text.strip():
            continue
        tokens = text.split()
        start = 0
        while start < len(tokens):
            window = tokens[start:start + target_tokens]
            chunks.append({
                "text": " ".join(window),
                "page": page_no,
                "source_doc": source_doc,
                "source_url": source_url,
                "ticker": ticker,
                "year": year,
            })
            if start + target_tokens >= len(tokens):
                break
            start += stride
    return chunks
