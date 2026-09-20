"""Tests for the ask layer's render step: the view it hands the interface.

The render step is the one place in this project where a model produces a TABLE rather
than a sentence, and a table is read as measurement. So the guards here are honesty
guards, not shape guards: a view may only carry figures the tools actually returned in
the same conversation, and anything that fails that is dropped in favour of the prose.

No network. Everything below runs against _coerce_view and the grounding index directly.
"""
import pytest

from server import ai


def msgs_with(*payloads):
    """A conversation whose tool results contain these JSON blobs."""
    return [{"role": "system", "content": ai.SYSTEM}] + [
        {"role": "tool", "tool_call_id": f"t{i}", "content": p} for i, p in enumerate(payloads)]


@pytest.fixture
def idx():
    # What compare_regions returns for two regions, overnight clean share, 2019 vs 2025.
    return ai._grounding_index(msgs_with(
        '{"metric": "cf_share_overnight", "rows": [{"region": "PJM", "values": {"2019": 0.433,'
        ' "2025": 0.390}}, {"region": "ERCO", "values": {"2019": 0.399, "2025": 0.413}}]}'))


GOOD = {
    "headline": "PJM fell at night while ERCOT rose",
    "summary": "PJM went from 43.3% to 39.0% overnight; ERCOT from 39.9% to 41.3%.",
    "kind": "comparison",
    "columns": [{"key": "y2019", "label": "clean at night, 2019", "unit": "%"},
                {"key": "y2025", "label": "clean at night, 2025", "unit": "%"}],
    "rows": [{"label": "PJM", "href": "#/region/PJM", "values": {"y2019": 43.3, "y2025": 39.0}},
             {"label": "ERCOT", "href": "#/region/ERCO", "values": {"y2019": 39.9, "y2025": 41.3}}],
    "chart": {"type": "lines", "series": [
        {"label": "PJM", "points": [{"x": "2019", "y": 43.3}, {"x": "2025", "y": 39.0}]}]},
    "caveats": ["A share falling is not clean generation shrinking."],
    "sources": ["compare_regions"],
}


def test_a_view_built_from_tool_numbers_survives(idx):
    v = ai._coerce_view(GOOD, "compare PJM and ERCOT at night", idx)
    assert v["kind"] == "comparison"
    assert [r["label"] for r in v["rows"]] == ["PJM", "ERCOT"]
    assert v["rows"][0]["values"]["y2019"] == 43.3
    assert v["chart"]["type"] == "lines"
    # 0.433 -> 43.3 is the one conversion the render step is allowed, so it is grounded.
    assert v["values_checked"] == 6 and v["unverified_value_count"] == 0


def test_invented_figures_lose_to_the_paragraph(idx):
    made_up = {**GOOD, "chart": None, "rows": [
        {"label": "PJM", "values": {"y2019": 71.2, "y2025": 68.4}},
        {"label": "ERCOT", "values": {"y2019": 88.9, "y2025": 91.5}}]}
    assert ai._coerce_view(made_up, "q", idx) is None


def test_one_stray_figure_is_counted_not_hidden(idx):
    mixed = {**GOOD, "chart": None, "rows": [
        {"label": "PJM", "values": {"y2019": 43.3, "y2025": 39.0}},
        {"label": "ERCOT", "values": {"y2019": 39.9, "y2025": 77.7}}]}
    v = ai._coerce_view(mixed, "q", idx)
    assert v["values_checked"] == 4 and v["unverified_value_count"] == 1


def test_prose_returns_no_view(idx):
    assert ai._coerce_view({**GOOD, "kind": "prose"}, "q", idx) is None
    assert ai._coerce_view({**GOOD, "kind": "something_else"}, "q", idx) is None


def test_rows_without_values_return_no_view(idx):
    assert ai._coerce_view({**GOOD, "rows": [{"label": "PJM"}, {"label": "ERCOT"}]}, "q", idx) is None


def test_only_in_app_links_survive(idx):
    hostile = {**GOOD, "chart": None, "rows": [
        {"label": "PJM", "href": "javascript:alert(1)", "values": {"y2019": 43.3}},
        {"label": "ERCOT", "href": "https://example.com", "values": {"y2019": 39.9}}]}
    v = ai._coerce_view(hostile, "q", idx)
    assert all("href" not in r for r in v["rows"])


def test_a_column_that_restates_the_row_name_is_dropped(idx):
    dupe = {**GOOD, "chart": None,
            "columns": [{"key": "region", "label": "region", "unit": ""},
                        {"key": "y2019", "label": "clean at night, 2019", "unit": "%"}],
            "rows": [{"label": "PJM", "values": {"region": "PJM", "y2019": 43.3}},
                     {"label": "ERCOT", "values": {"region": "ERCOT", "y2019": 39.9}}]}
    v = ai._coerce_view(dupe, "q", idx)
    assert [c["key"] for c in v["columns"]] == ["y2019"]
    assert all("region" not in r["values"] for r in v["rows"])


def test_values_outside_the_declared_columns_are_dropped(idx):
    stray = {**GOOD, "chart": None,
             "rows": [{"label": "PJM", "values": {"y2019": 43.3, "mystery": 12.0}},
                      {"label": "ERCOT", "values": {"y2019": 39.9}}]}
    v = ai._coerce_view(stray, "q", idx)
    assert all(set(r["values"]) <= {"y2019", "y2025"} for r in v["rows"])


def test_grounding_accepts_rounding_and_rescaling(idx):
    assert ai._grounded(43.3, idx)        # 0.433 as a percentage
    assert ai._grounded(0.39, idx)        # the share itself, rounded
    assert not ai._grounded(61.7, idx)    # nothing like it was ever returned


def test_summarize_asks_for_no_view(monkeypatch):
    seen = {}

    def fake_ask(question, page_context=None, max_turns=ai.MAX_TURNS, render=True):
        seen["render"] = render
        return {"answer": "", "view": None, "tools_used": []}

    monkeypatch.setattr(ai, "ask", fake_ask)
    ai.summarize({"route": "region"})
    assert seen["render"] is False
