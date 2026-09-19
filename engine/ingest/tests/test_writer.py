"""The JSONL contract: one object per line, page always present."""

import json
import pytest

from engine.ingest.writer import write_jsonl

REC = dict(text="hello", page=3, source_doc="d.pdf",
           source_url="https://example.com/d.pdf", ticker="META", year=2025)


def test_writes_one_json_object_per_line(tmp_path):
    out = tmp_path / "META_esg.jsonl"

    write_jsonl(out, [REC, {**REC, "page": 4}])

    lines = out.read_text().splitlines()
    assert len(lines) == 2
    assert [json.loads(l)["page"] for l in lines] == [3, 4]


def test_every_written_line_carries_the_six_contract_fields(tmp_path):
    out = tmp_path / "x.jsonl"

    write_jsonl(out, [REC])

    got = json.loads(out.read_text().splitlines()[0])
    assert set(got) == {"text", "page", "source_doc", "source_url", "ticker", "year"}


def test_refuses_to_write_a_record_with_no_page():
    """A chunk without a page number is worthless downstream -- fail loudly
    rather than emit a line the UI cannot cite."""
    with pytest.raises(ValueError, match="page"):
        write_jsonl("/dev/null", [{**REC, "page": None}])
