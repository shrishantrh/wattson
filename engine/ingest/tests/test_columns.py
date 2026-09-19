"""Multi-column pages must not be read straight across.

Reading across splices the columns together mid-sentence and fabricates text
that appears nowhere in the document. This is the defect that made Meta's
"matched 100% of our annual electricity use" unfindable.
"""

import pytest
from reportlab.pdfgen import canvas

from engine.ingest.pdf import extract_pages

LEFT = ("Since 2020 we have matched 100 percent of our annual electricity use "
        "with clean and renewable energy every single year without exception.")
RIGHT = ("Energy attribute certificates are applied separately to our scope 3 "
         "emissions including fuel and energy related activities and travel.")


@pytest.fixture
def two_column_pdf(tmp_path):
    """Two genuine text columns, side by side, interleaved line for line."""
    path = tmp_path / "twocol.pdf"
    c = canvas.Canvas(str(path))
    left_words, right_words = LEFT.split(), RIGHT.split()
    y = 720
    # 6 words per line per column, so each visual line spans both columns.
    for i in range(0, max(len(left_words), len(right_words)), 6):
        c.drawString(60, y, " ".join(left_words[i:i + 6]))
        c.drawString(330, y, " ".join(right_words[i:i + 6]))
        y -= 18
    c.showPage()
    c.save()
    return path


def test_each_column_is_read_as_continuous_prose(two_column_pdf):
    text = extract_pages(two_column_pdf)[0][1]
    flat = " ".join(text.split())

    assert LEFT in flat, f"left column was spliced:\n{flat}"
    assert RIGHT in flat, f"right column was spliced:\n{flat}"


def test_the_claim_phrase_survives_contiguously(two_column_pdf):
    """The concrete regression: this is what the detector needs to match."""
    flat = " ".join(extract_pages(two_column_pdf)[0][1].split())

    assert "100 percent of our annual electricity use" in flat
