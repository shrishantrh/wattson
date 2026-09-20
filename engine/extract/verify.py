"""Reconcile model output against the source chunk.

Every stored `verbatim` must be a character-for-character substring of the
chunk it came from. A model will silently tidy grammar; a tidied quote beside
a page number is a fabricated citation.

PDF text wraps mid-sentence, so a model that rejoins a wrapped line is not
paraphrasing. Those are repaired by locating the matching source span and
storing THE SOURCE'S characters, not the model's. Anything that cannot be
located is dropped and counted.
"""
from __future__ import annotations

import re

_WS = re.compile(r"\s+")


def _normalise(s: str) -> str:
    return _WS.sub(" ", s).strip()


def _find_span(needle: str, haystack: str) -> str | None:
    """Return the exact source substring matching `needle` ignoring whitespace."""
    target = _normalise(needle)
    if not target:
        return None

    # Map each non-space character of the haystack back to its index.
    idx = [i for i, ch in enumerate(haystack) if not ch.isspace()]
    dense = "".join(haystack[i] for i in idx)
    dense_target = target.replace(" ", "")
    at = dense.find(dense_target)
    if at == -1:
        return None
    start = idx[at]
    end = idx[at + len(dense_target) - 1] + 1
    return haystack[start:end]


def _citation(chunk: dict):
    """A citation a human can follow, or None.

    ESG PDFs carry a page. SEC 10-K filings are HTML with `page: null` and an
    html_anchor locator. Inventing a page number for an HTML filing would be
    fabricating provenance, so a chunk offering neither is not publishable.
    """
    if chunk.get("page") is not None:
        return {"type": "page", "page": chunk["page"]}
    locator = chunk.get("locator")
    if locator:
        return {**locator}
    return None


def reconcile(claims, chunk: dict):
    """Return (kept, dropped, stats).

    Provenance fields are taken from the chunk, never from the model.
    """
    text = chunk["text"]
    kept, dropped = [], []
    stats = {"exact": 0, "repaired": 0, "dropped": 0}

    citation = _citation(chunk)

    for claim in claims:
        quote = claim.get("verbatim") or ""
        repaired = False

        if citation is None:
            stats["dropped"] += 1
            dropped.append({
                "reason": "no_citation",
                "model_verbatim": quote,
                "source_doc": chunk.get("source_doc"),
            })
            continue

        if quote and quote in text:
            stats["exact"] += 1
        else:
            span = _find_span(quote, text)
            if span is None:
                stats["dropped"] += 1
                dropped.append({
                    "reason": "verbatim_not_in_source",
                    "model_verbatim": quote,
                    "page": chunk["page"],
                    "source_doc": chunk["source_doc"],
                })
                continue
            quote = span
            repaired = True
            stats["repaired"] += 1

        entry = {k: v for k, v in claim.items() if k != "page"}
        entry["verbatim"] = quote
        entry["verbatim_whitespace_repaired"] = repaired
        # Provenance from the chunk record, not the model.
        entry["page"] = chunk.get("page")
        entry["citation"] = citation
        entry["source_doc"] = chunk["source_doc"]
        entry["source_url"] = chunk["source_url"]
        entry["ticker"] = chunk["ticker"]
        entry["doc_year"] = chunk["year"]
        entry["doc_type"] = chunk.get("doc_type")
        if chunk.get("quality"):
            entry["chunk_quality_flag"] = chunk["quality"].get("flag")
        kept.append(entry)

    return kept, dropped, stats
