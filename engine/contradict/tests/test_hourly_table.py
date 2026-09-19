"""A disclosed hourly CFE figure is the strongest evidence we can show: the
company's own hourly number, next to its own annual claim, both published."""

from engine.contradict.hourly import find_disclosed_hourly_cfe, parse_hourly_row

ROW = ("Global average carbon-free energy (CFE) Unit 2021 2022 2023 2024 2025 "
       "CFE across Google data centers (hourly) % 65 64 64 66 65 "
       "CFE across Google offices (hourly) % - 54 56 60 64")


def rec(text, page, flag="tabular"):
    return {"text": text, "page": page, "ticker": "GOOGL", "year": 2026,
            "source_doc": "g.pdf", "source_url": "https://g.example/g.pdf",
            "quality": {"flag": flag, "reasons": []}}


def test_parses_the_years_and_values_from_the_row():
    got = parse_hourly_row(ROW)

    assert got["label"] == "CFE across Google data centers (hourly)"
    assert got["unit"] == "%"
    assert got["years"] == [2021, 2022, 2023, 2024, 2025]
    assert got["values"] == [65, 64, 64, 66, 65]


def test_pairs_the_hourly_disclosure_with_the_annual_claim():
    found = find_disclosed_hourly_cfe("GOOGL", [
        rec("Despite this, we again matched 100% of our electricity "
            "consumption with renewable energy purchases (on a global and "
            "annual basis)", 4, flag="ok"),
        rec(ROW, 94)])

    assert len(found) == 1
    f = found[0]
    assert f["claim"]["page"] == 4
    assert f["counterpoint"]["page"] == 94
    assert f["counterpoint"]["values"] == [65, 64, 64, 66, 65]


def test_no_finding_without_an_hourly_table():
    found = find_disclosed_hourly_cfe("GOOGL", [
        rec("We matched 100% of our annual electricity consumption.", 4, "ok")])

    assert found == []


def test_the_row_is_never_emitted_as_a_prose_quote():
    """Tabular text must not be shown as a sentence -- our own rule."""
    found = find_disclosed_hourly_cfe("GOOGL", [
        rec("We again matched 100% of our electricity consumption (on a "
            "global and annual basis)", 4, "ok"),
        rec(ROW, 94)])

    assert "quote" not in found[0]["counterpoint"]
