"""Items 1 (Business) and 1A (Risk Factors) are where environmental language
lives. Everything after Item 1B/Item 2 is noise for our purposes."""

from engine.ingest.sections import slice_items_1_and_1a, split_items


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


# --- patterns taken from the four real filings -------------------------------

def test_ignores_running_page_headers_that_repeat_the_item_number():
    """Microsoft's 10-K repeats a bare "Item 1A" header on every page of the
    risk factors. Only the titled heading starts the section."""
    pages = [(1, "ITEM 1. BUSINESS\n" + " ".join(f"b{i}" for i in range(300))),
             (2, "Item 1A\n" + " ".join(f"x{i}" for i in range(50))),
             (3, "ITEM 1A. RISK FACTORS\n" + " ".join(f"r{i}" for i in range(300))),
             (4, "Item 1A\n" + " ".join(f"y{i}" for i in range(50))),
             (5, "ITEM 1B. UNRESOLVED STAFF COMMENTS\nNone.")]

    text = " ".join(t for _, t in slice_items_1_and_1a(pages))

    assert "b0" in text and "r0" in text
    assert "Unresolved" not in text


def test_handles_a_heading_with_no_space_after_the_period():
    """Google and Meta render headings as "ITEM 1.BUSINESS"."""
    pages = [(1, "ITEM 1.BUSINESS\n" + " ".join(f"b{i}" for i in range(300))),
             (2, "ITEM 1A.RISK FACTORS\n" + " ".join(f"r{i}" for i in range(300))),
             (3, "ITEM 1B.UNRESOLVED STAFF COMMENTS\nNone.")]

    text = " ".join(t for _, t in slice_items_1_and_1a(pages))

    assert "b0" in text and "r0" in text
    assert "Unresolved" not in text


def test_a_bare_item_marker_with_no_title_does_not_start_the_section():
    """Contents pages list "Item 1." with the title on another line."""
    pages = [(1, "Item 1.\nItem 1A.\nItem 1B.\nItem 2."),
             (2, "Item 1. Business\n" + " ".join(f"b{i}" for i in range(300))),
             (3, "Item 1B. Unresolved Staff Comments\nNone.")]

    text = " ".join(t for _, t in slice_items_1_and_1a(pages))

    assert "b0" in text
    assert text.count("Item 1A.") == 0


def test_an_inline_cross_reference_does_not_start_the_section():
    """Google's 10-K says "...described in Item 1 Business and Note 15 of the
    Notes..." mid-paragraph, far below the real heading. Starting there ran the
    slice to the end of the filing, signature page included."""
    pages = [(1, "ITEM 1.BUSINESS\n" + " ".join(f"b{i}" for i in range(300))),
             (2, "ITEM 1A.RISK FACTORS\n" + " ".join(f"r{i}" for i in range(300))),
             (3, "ITEM 1B.UNRESOLVED STAFF COMMENTS\nNone."),
             (4, "Refer to Item 1 Business and Note 15 for detail. "
                 + " ".join(f"z{i}" for i in range(900)))]

    text = " ".join(t for _, t in slice_items_1_and_1a(pages))

    assert "b0" in text and "r0" in text
    assert "z0" not in text, "slice ran past Item 1B into later sections"


def test_an_inline_reference_does_not_end_the_section_early():
    """Amazon's forward-looking-statements paragraph mentions a later Item,
    which truncated Items 1 and 1A to 367 words of a 42,000-word filing."""
    pages = [(1, "Item 1. Business\nSee Item 2 for our properties. "
                 + " ".join(f"b{i}" for i in range(300))),
             (2, "Item 1A. Risk Factors\n" + " ".join(f"r{i}" for i in range(300))),
             (3, "Item 1B. Unresolved Staff Comments\nNone.")]

    text = " ".join(t for _, t in slice_items_1_and_1a(pages))

    assert "b299" in text and "r0" in text


def test_split_items_uses_the_titled_heading_not_a_running_header():
    """Microsoft repeats "Item 1A" as a page header; taking the last one left
    Item 1A with 759 words instead of eleven thousand."""
    text = ("ITEM 1. BUSINESS\n" + " ".join(f"b{i}" for i in range(300))
            + "\nITEM 1A. RISK FACTORS\n" + " ".join(f"r{i}" for i in range(300))
            + "\nItem 1A\n" + " ".join(f"t{i}" for i in range(50)))

    items = dict(split_items(text))

    assert "r0" in items["1A"] and "t0" in items["1A"]
    assert "b0" in items["1"] and "r0" not in items["1"]
