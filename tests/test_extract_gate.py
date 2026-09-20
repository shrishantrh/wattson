"""Tests for the chunk-quality gate.

The verbatim check proves a quote matches its chunk. It cannot prove the
chunk matches the document. These are the second line: refuse to quote from
text the PDF extractor destroyed.
"""
from engine.extract import gate as G
from engine.extract import schema as S

CLEAN = ("In 2024, 62% of the electricity consumed by our US data centers "
         "came from carbon-free sources on an hourly basis. We continue to "
         "expand our portfolio of wind and solar projects.")


def test_clean_prose_passes():
    verdict = G.assess(CLEAN)
    assert verdict["usable"] is True
    assert verdict["issues"] == []


def test_doubled_glyph_overlay_is_rejected():
    verdict = G.assess("Water Stewardship 22002255 MMeettaa SSuussttaaiinnaabbiilliittyy RReeppoorrtt")
    assert verdict["usable"] is False
    assert "doubled_glyphs" in verdict["issues"]


def test_character_level_layer_interleaving_is_rejected():
    text = ("632%3% C apPituarlc ghoasoedds goods and service s "
            "5,517,6114,920,413 <16%3% F uelC aanpdit ael ngeorogdys")
    verdict = G.assess(text)
    assert verdict["usable"] is False
    assert "interleaved_layers" in verdict["issues"]


def test_subscript_displacement_is_rejected():
    text = ("Our programs avoided nearly 1.2 million metric tons of CO e. "
            "In 2025, the 2 program reached significant milestones across "
            "our operations and supply chain partners worldwide.")
    verdict = G.assess(text)
    assert verdict["usable"] is False
    assert "subscript_displacement" in verdict["issues"]


def test_flattened_table_is_rejected():
    text = ("Global average carbon-free energy CFE Unit % CFE 64% 66% 64% "
            "Regional 12% 18% 22% 91% 4% 7% 13% 88% 2% 5% 9% 77% 3% 6%")
    verdict = G.assess(text)
    assert verdict["usable"] is False
    assert "numeric_density" in verdict["issues"]


def test_very_short_chunk_is_not_worth_quoting():
    assert G.assess("Contents")["usable"] is False


def test_issue_names_are_stable_identifiers():
    for text in ("22002255 MMeettaa SSuussttaaiinnaabbiilliittyy RReeppoorrtt",
                 "Contents"):
        for issue in G.assess(text)["issues"]:
            assert issue in G.ISSUES


# --- the model-side legibility judgement -----------------------------------

def test_schema_asks_the_model_whether_the_chunk_is_legible():
    props = S.CLAIM_SCHEMA["schema"]["properties"]
    assert "chunk_quality" in props
    assert "is_legible_prose" in props["chunk_quality"]["properties"]


def test_chunk_quality_is_required_so_the_model_cannot_skip_it():
    assert "chunk_quality" in S.CLAIM_SCHEMA["schema"]["required"]


def test_prompt_tells_the_model_the_corpus_may_be_garbled():
    from engine.extract import prompt as P
    text = P.build_system_prompt().lower()
    assert "garbl" in text or "spliced" in text or "column" in text


def test_prompt_requires_self_contained_quotes():
    from engine.extract import prompt as P
    text = P.build_system_prompt().lower()
    assert "self-contained" in text
