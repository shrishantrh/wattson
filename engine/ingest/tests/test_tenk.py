"""10-K filings are HTML and have no pages, so a chunk carries a locator
instead. page stays null rather than being invented."""

import json
import pytest

from engine.ingest.chunker import chunk_text
from engine.ingest.sections import split_items
from engine.ingest.writer import write_jsonl

META = dict(source_doc="msft-10k.htm", source_url="https://sec.gov/x.htm",
            ticker="MSFT", year=2026)


def test_splits_the_span_into_item_1_and_item_1a():
    text = ("Item 1. Business\nWe operate data centers.\n"
            "Item 1A. Risk Factors\nClimate regulation may increase costs.")

    items = dict(split_items(text))

    assert "data centers" in items["1"]
    assert "Climate regulation" in items["1A"]
    assert "data centers" not in items["1A"]


def test_chunks_carry_a_locator_and_a_null_page():
    chunks = chunk_text(" ".join(f"w{i}" for i in range(50)), item="1A", **META)

    assert chunks
    for c in chunks:
        assert c["page"] is None
        assert c["locator"]["type"] == "html_anchor"
        assert c["locator"]["item"] == "1A"
        assert isinstance(c["locator"]["char_offset"], int)


def test_char_offsets_advance_across_chunks():
    chunks = chunk_text(" ".join(f"w{i}" for i in range(6000)), item="1",
                        target_tokens=2000, overlap_tokens=200, **META)

    offsets = [c["locator"]["char_offset"] for c in chunks]
    assert len(offsets) > 1
    assert offsets == sorted(offsets)
    assert offsets[0] == 0


def test_writer_accepts_a_null_page_when_a_locator_is_present(tmp_path):
    out = tmp_path / "MSFT_10k.jsonl"
    rec = {"text": "t", "page": None, "source_doc": "d", "source_url": "u",
           "ticker": "MSFT", "year": 2026,
           "locator": {"type": "html_anchor", "item": "1A", "char_offset": 0}}

    write_jsonl(out, [rec])

    got = json.loads(out.read_text().splitlines()[0])
    assert got["page"] is None
    assert got["locator"]["item"] == "1A"


def test_writer_still_refuses_a_null_page_with_no_locator():
    with pytest.raises(ValueError, match="page"):
        write_jsonl("/dev/null", [{"text": "t", "page": None, "source_doc": "d",
                                   "source_url": "u", "ticker": "M", "year": 1}])


def test_a_implausibly_short_slice_is_rejected(monkeypatch):
    """Amazon's slice silently came back as 367 words of a 42,000-word filing.
    A bad slice must fail loudly, not ship."""
    from engine.ingest import pipeline

    monkeypatch.setattr(pipeline, "_filing_text",
                        lambda t: ("Item 1. Business\nToo short.",
                                   "https://sec.gov/x.htm", 2026))

    with pytest.raises(ValueError, match="too short"):
        pipeline.ingest_10k("AMZN")
