"""Tests for claim extraction.

The load-bearing guarantee is that a stored `verbatim` is character-for-
character present in the source chunk. A model will silently tidy grammar,
and a tidied quote printed beside a page number is a fabricated citation.
"""
import json
import pytest

from engine.extract import prompt as P
from engine.extract import schema as S
from engine.extract import verify as V

CHUNK = {
    "text": ("In 2024, 62% of the electricity consumed by our US data centers "
             "came from carbon-free sources on an hourly basis. We strive to "
             "be a leader in environmental responsibility."),
    "page": 17,
    "source_doc": "Meta_2025-Sustainability-Report.pdf",
    "source_url": "https://example.com/report.pdf",
    "ticker": "META",
    "year": 2025,
}


def claim(**kw):
    base = {
        "verbatim": "In 2024, 62% of the electricity consumed by our US data centers came from carbon-free sources on an hourly basis.",
        "year": 2024, "metric": "carbon-free electricity share",
        "magnitude": 62.0, "unit": "percent", "timeframe": "2024",
        "scope": "US data centers", "falsifiability": 0.95,
        "greenwash_patterns": [],
    }
    base.update(kw)
    return base


# --- the verbatim guarantee ------------------------------------------------

def test_exact_quote_is_kept():
    kept, dropped, stats = V.reconcile([claim()], CHUNK)
    assert len(kept) == 1
    assert dropped == []
    assert kept[0]["verbatim"] in CHUNK["text"]


def test_paraphrase_is_dropped():
    bad = claim(verbatim="In 2024, 62 percent of electricity used by our US "
                         "datacenters was carbon free hourly.")
    kept, dropped, stats = V.reconcile([bad], CHUNK)
    assert kept == []
    assert len(dropped) == 1
    assert dropped[0]["reason"] == "verbatim_not_in_source"


def test_every_kept_claim_is_a_real_substring_of_the_chunk():
    claims = [claim(), claim(verbatim="We strive to be a leader in environmental responsibility.")]
    kept, _, _ = V.reconcile(claims, CHUNK)
    for k in kept:
        assert k["verbatim"] in CHUNK["text"]


def test_whitespace_variant_is_repaired_to_the_exact_source_span():
    """PDF text wraps mid-sentence; a model rejoining it is not paraphrasing.

    The stored string must still be the exact source span, not the model's.
    """
    wrapped = dict(CHUNK, text="In 2024, 62% of the electricity consumed by our US\ndata centers came from carbon-free sources.")
    c = claim(verbatim="In 2024, 62% of the electricity consumed by our US data centers came from carbon-free sources.")
    kept, dropped, stats = V.reconcile([c], wrapped)
    assert len(kept) == 1
    assert kept[0]["verbatim"] in wrapped["text"]
    assert kept[0]["verbatim_whitespace_repaired"] is True
    assert stats["repaired"] == 1


def test_stats_count_each_outcome():
    good, bad = claim(), claim(verbatim="nowhere near the source text")
    _, _, stats = V.reconcile([good, bad], CHUNK)
    assert stats == {"exact": 1, "repaired": 0, "dropped": 1}


# --- provenance ------------------------------------------------------------

def test_page_comes_from_the_chunk_not_the_model():
    kept, _, _ = V.reconcile([claim(page=999)], CHUNK)
    assert kept[0]["page"] == 17


def test_page_is_never_null():
    kept, _, _ = V.reconcile([claim()], CHUNK)
    assert kept[0]["page"] is not None


def test_source_doc_and_url_are_carried_through():
    kept, _, _ = V.reconcile([claim()], CHUNK)
    assert kept[0]["source_doc"] == CHUNK["source_doc"]
    assert kept[0]["source_url"] == CHUNK["source_url"]


# --- the anchors -----------------------------------------------------------

def test_every_anchor_text_appears_verbatim_in_the_prompt():
    anchors = P.load_anchors()
    text = P.build_system_prompt()
    for group in ("high", "low"):
        for a in anchors[group]:
            assert a["text"] in text, f"anchor missing: {a['text'][:50]}"
            assert a["why"] in text


def test_every_edge_case_rule_appears_verbatim_in_the_prompt():
    anchors = P.load_anchors()
    text = P.build_system_prompt()
    for e in anchors["edge_cases"]:
        assert e["rule"] in text
        assert e["example"] in text
        assert e["guidance"] in text


def test_anchor_definition_and_scale_are_in_the_prompt():
    anchors = P.load_anchors()
    text = P.build_system_prompt()
    assert anchors["definition"] in text
    assert anchors["scale"] in text


def test_exclusion_is_not_a_hedge_rule_is_present():
    text = P.build_system_prompt()
    assert "An EXCLUSION is not a hedge." in text


def test_prompt_states_precision_over_recall():
    text = P.build_system_prompt().lower()
    assert "empty" in text and ("precision" in text or "no claim" in text)


# --- schema ----------------------------------------------------------------

def test_schema_is_strict_and_forbids_extra_fields():
    s = S.CLAIM_SCHEMA
    assert s["schema"]["additionalProperties"] is False
    assert s["strict"] is True


def test_schema_requires_every_documented_field():
    props = S.CLAIM_SCHEMA["schema"]["properties"]["claims"]["items"]
    required = set(props["required"])
    assert required == {"verbatim", "year", "metric", "magnitude", "unit",
                        "timeframe", "scope", "falsifiability",
                        "greenwash_patterns"}


def test_schema_does_not_let_the_model_supply_a_page():
    props = S.CLAIM_SCHEMA["schema"]["properties"]["claims"]["items"]["properties"]
    assert "page" not in props, "page must come from the chunk, not the model"


def test_falsifiability_is_bounded_zero_to_one():
    f = S.CLAIM_SCHEMA["schema"]["properties"]["claims"]["items"]["properties"]["falsifiability"]
    assert f["minimum"] == 0 and f["maximum"] == 1


def test_greenwash_patterns_are_a_closed_vocabulary():
    g = S.CLAIM_SCHEMA["schema"]["properties"]["claims"]["items"]["properties"]["greenwash_patterns"]
    assert g["items"]["enum"]
    assert "hidden_tradeoff" in g["items"]["enum"]
