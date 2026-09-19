"""The page number is the load-bearing property: we print "page 14" on screen
next to a verbatim quote, so a chunk that loses its page is worthless."""

from engine.ingest.chunker import chunk_pages

META = dict(source_doc="test.pdf", source_url="https://example.com/test.pdf",
            ticker="META", year=2025)


def words(n, tag):
    return " ".join(f"{tag}{i}" for i in range(n))


def test_every_chunk_carries_a_page_number():
    pages = [(1, words(50, "a")), (2, words(50, "b")), (3, words(50, "c"))]

    chunks = chunk_pages(pages, **META)

    assert chunks, "expected at least one chunk"
    assert all(isinstance(c["page"], int) for c in chunks)
    assert all(c["page"] >= 1 for c in chunks)


def test_long_page_splits_into_several_chunks_all_keeping_that_page():
    pages = [(14, words(5000, "w"))]

    chunks = chunk_pages(pages, target_tokens=2000, **META)

    assert len(chunks) > 1, "5000 tokens at target 2000 must split"
    assert {c["page"] for c in chunks} == {14}


def test_no_chunk_greatly_exceeds_the_target_token_count():
    pages = [(1, words(5000, "w"))]

    chunks = chunk_pages(pages, target_tokens=2000, **META)

    assert max(len(c["text"].split()) for c in chunks) <= 2000


def test_consecutive_chunks_of_one_page_overlap():
    pages = [(1, words(5000, "w"))]

    chunks = chunk_pages(pages, target_tokens=2000, overlap_tokens=200, **META)

    first_tail = chunks[0]["text"].split()[-200:]
    second_head = chunks[1]["text"].split()[:200]
    assert first_tail == second_head


def test_a_chunk_never_mixes_text_from_two_pages():
    """Guarantees the printed citation is exactly true: every word in a chunk
    really is on the page the chunk names."""
    pages = [(7, words(20, "seven")), (8, words(20, "eight"))]

    chunks = chunk_pages(pages, target_tokens=2000, **META)

    for c in chunks:
        tag = "seven" if c["page"] == 7 else "eight"
        assert all(w.startswith(tag) for w in c["text"].split()), c


def test_metadata_is_passed_through_to_every_chunk():
    chunks = chunk_pages([(1, words(30, "w"))], **META)

    for c in chunks:
        assert c["source_doc"] == "test.pdf"
        assert c["source_url"] == "https://example.com/test.pdf"
        assert c["ticker"] == "META"
        assert c["year"] == 2025
