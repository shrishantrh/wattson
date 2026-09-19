"""A flag on every chunk, so a consumer can refuse to quote bad text.

A substring check cannot tell good text from bad: garbled output is still
"present on the page" it came from. These strings are taken from real defects.
"""

from engine.ingest.quality import assess

GARBLED = ("632%3% C apPituarlc ghoasoedds goods and service s C apPituarlc "
           "ghoasoedds and s ervice s")
TABLE = ("CFE across Google data centers (hourly) % 65 64 64 66 65 CFE across "
         "Google offices (hourly) % - 54 56 60 64 North America % 69 68 70 68")
PROSE = ("Since 2020, we have matched 100% of our annual electricity use with "
         "clean and renewable energy. As a voluntary buyer, we prioritize "
         "supporting high quality, innovative energy projects around the globe.")


def test_prose_is_ok():
    assert assess(PROSE)["flag"] == "ok"


def test_character_interleaved_text_is_suspect():
    assert assess(GARBLED)["flag"] == "suspect"


def test_a_data_table_is_flagged_tabular_not_suspect():
    """Tables are not corrupt, but they must not be quoted as a sentence."""
    assert assess(TABLE)["flag"] == "tabular"


def test_the_reason_is_recorded_so_a_consumer_can_explain_itself():
    assert assess(GARBLED)["reasons"]
    assert assess(PROSE)["reasons"] == []


def test_empty_text_is_suspect_rather_than_silently_ok():
    assert assess("")["flag"] == "suspect"


def test_every_chunk_from_both_paths_carries_a_quality_flag():
    """Both the PDF path and the 10-K path, so a consumer never meets a chunk
    with no flag and has to guess."""
    from engine.ingest.chunker import chunk_pages, chunk_text

    meta = dict(source_doc="d", source_url="u", ticker="T", year=2026)
    paged = chunk_pages([(1, " ".join(f"word{i}" for i in range(40)))], **meta)
    html = chunk_text(" ".join(f"word{i}" for i in range(40)), item="1A", **meta)

    for rec in paged + html:
        assert rec["quality"]["flag"] in {"ok", "tabular", "suspect"}
