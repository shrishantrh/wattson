"""Items 1 (Business) and 1A (Risk Factors) are where environmental language
lives. Everything after Item 1B/Item 2 is noise for our purposes."""

from engine.ingest.sections import slice_items_1_and_1a


def test_keeps_only_text_between_item_1_and_item_1b():
    pages = [
        (1, "Item 1. Business\nWe operate data centers."),
        (2, "Item 1A. Risk Factors\nClimate regulation may increase costs."),
        (3, "Item 1B. Unresolved Staff Comments\nNone."),
        (4, "Item 2. Properties\nWe lease offices."),
    ]

    kept = slice_items_1_and_1a(pages)
    text = " ".join(t for _, t in kept)

    assert "data centers" in text
    assert "Climate regulation" in text
    assert "lease offices" not in text
    assert "Unresolved Staff Comments" not in text


def test_ignores_the_table_of_contents_occurrence():
    """A TOC lists every Item within a page or two; the real body span is longer."""
    pages = [
        (1, "TABLE OF CONTENTS\nItem 1. Business 4\nItem 1A. Risk Factors 12\n"
            "Item 1B. Unresolved Staff Comments 30\nItem 2. Properties 31"),
        (2, "Item 1. Business\n" + " ".join(f"body{i}" for i in range(400))),
        (3, "Item 1A. Risk Factors\n" + " ".join(f"risk{i}" for i in range(400))),
        (4, "Item 1B. Unresolved Staff Comments\nNone."),
    ]

    kept = slice_items_1_and_1a(pages)
    text = " ".join(t for _, t in kept)

    assert "body0" in text and "risk0" in text
    assert "TABLE OF CONTENTS" not in text


def test_page_numbers_survive_the_slice():
    pages = [
        (7, "Item 1. Business\nWe operate data centers."),
        (8, "Item 1A. Risk Factors\nClimate risk."),
        (9, "Item 2. Properties\nOffices."),
    ]

    kept = slice_items_1_and_1a(pages)

    assert [p for p, _ in kept] == [7, 8]


def test_falls_back_to_item_2_when_item_1b_is_absent():
    pages = [
        (1, "Item 1. Business\nWe operate data centers."),
        (2, "Item 2. Properties\nOffices."),
    ]

    kept = slice_items_1_and_1a(pages)
    text = " ".join(t for _, t in kept)

    assert "data centers" in text
    assert "Offices" not in text


def test_returns_empty_when_no_item_1_heading_exists():
    kept = slice_items_1_and_1a([(1, "Some unrelated document about nothing.")])

    assert kept == []
