"""Strict JSON schema for claim extraction.

`strict: true` plus `additionalProperties: false` is what stops the model
returning prose, commentary or invented fields. `page` is deliberately absent:
it comes from the chunk record, so the model has no opportunity to attach a
quote to the wrong page.
"""
from __future__ import annotations

#: Closed vocabulary. An open string field here would become a free-text
#: channel and the tags would stop being comparable across companies.
GREENWASH_PATTERNS = [
    "vague_commitment",       # no metric, scope or date
    "unbounded_timeframe",    # "over time", "in the coming years"
    "undefined_baseline",     # a percentage against nothing stated
    "hidden_tradeoff",        # narrowed scope, carve-outs that flatter
    "offset_dependence",      # the claim rests on certificates, not supply
    "aspirational_verb",      # strive, aim, explore, work toward
    "selective_boundary",     # a subset presented as the whole
    "unattributed_superlative",  # leader, world-class, industry-leading
]

CLAIM_SCHEMA = {
    "name": "claim_extraction",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["chunk_quality", "claims"],
        "properties": {
            "chunk_quality": {
                "type": "object",
                "additionalProperties": False,
                "required": ["is_legible_prose", "issue"],
                "description": (
                    "This corpus was extracted from multi-column PDFs and "
                    "parts of it are corrupt. Judge the TEXT, not the company."
                ),
                "properties": {
                    "is_legible_prose": {
                        "type": "boolean",
                        "description": (
                            "True only if the text reads as coherent English "
                            "sentences. False if clauses are interleaved out "
                            "of order, a heading sits mid-sentence, or the "
                            "text is a flattened table."
                        ),
                    },
                    "issue": {
                        "type": ["string", "null"],
                        "enum": ["column_splicing", "flattened_table",
                                 "interleaved_layers", "truncated", None],
                        "description": "Null when the text is legible.",
                    },
                },
            },
            "claims": {
                "type": "array",
                "description": (
                    "Environmental or energy claims in this chunk. Empty when "
                    "the chunk contains none, which is the common case."
                ),
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["verbatim", "year", "metric", "magnitude",
                                 "unit", "timeframe", "scope", "falsifiability",
                                 "greenwash_patterns"],
                    "properties": {
                        "verbatim": {
                            "type": "string",
                            "description": (
                                "The claim copied character-for-character from "
                                "the chunk. Do not fix grammar, spacing, "
                                "capitalisation or punctuation. Do not join or "
                                "shorten sentences. If you cannot copy it "
                                "exactly, do not emit the claim."
                            ),
                        },
                        "year": {
                            "type": ["integer", "null"],
                            "description": "Year the claim is ABOUT, null if unstated.",
                        },
                        "metric": {
                            "type": ["string", "null"],
                            "description": "What is measured, null if none is.",
                        },
                        "magnitude": {
                            "type": ["number", "null"],
                            "description": "The number, null if there is none.",
                        },
                        "unit": {
                            "type": ["string", "null"],
                            "description": "percent, MWh, tCO2e, etc. null if none.",
                        },
                        "timeframe": {
                            "type": ["string", "null"],
                            "description": "Period or deadline as stated, null if none.",
                        },
                        "scope": {
                            "type": ["string", "null"],
                            "description": (
                                "Boundary as stated: global, US data centers, "
                                "owned-and-operated facilities. null if unstated."
                            ),
                        },
                        "falsifiability": {
                            "type": "number", "minimum": 0, "maximum": 1,
                            "description": "Calibrate against the anchors exactly.",
                        },
                        "greenwash_patterns": {
                            "type": "array",
                            "description": "Empty when none apply. Most claims are empty.",
                            "items": {"type": "string", "enum": GREENWASH_PATTERNS},
                        },
                    },
                },
            }
        },
    },
}
