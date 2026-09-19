"""Run extraction over a company's chunks and write claims/extracted/<T>.json.

Three guards, each covering a DIFFERENT failure. None of them subsumes another:

  gate.assess           mechanical corruption in the chunk (overlaid glyphs,
                        per-character layer merges, displaced subscripts,
                        flattened tables). Runs before any API call.
  chunk_quality         column splicing, which reads as ordinary words in the
  (model judgement)     wrong order and no regex here detects. The model is
                        asked whether the text is coherent English.
  verify.reconcile      model paraphrase. Proves the quote matches the chunk.
                        It CANNOT prove the chunk matches the document.
"""
from __future__ import annotations

import collections
import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from .classify import annotate, summarise
from .client import MODEL, extract_chunk
from .gate import assess
from .verify import reconcile

REPO_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = REPO_ROOT / "claims" / "raw"
OUT_DIR = REPO_ROOT / "claims" / "extracted"

LONG_RUN_WORDS = 45


DOC_TYPES = ("esg", "10k")


def load_chunks(ticker: str) -> list:
    """Both source types. ESG reports are PDFs; 10-Ks are SEC HTML."""
    chunks = []
    for doc_type in DOC_TYPES:
        path = RAW_DIR / f"{ticker}_{doc_type}.jsonl"
        if not path.exists():
            continue
        with path.open() as fh:
            for line in fh:
                if line.strip():
                    chunks.append({**json.loads(line), "doc_type": doc_type})
    return chunks


def _longest_run_words(text: str) -> int:
    return max((len(p.split()) for p in re.split(r"[.!?]\s", text)), default=0)


def run(ticker: str, limit: int | None = None, workers: int = 6,
        model: str = MODEL) -> dict:
    chunks = load_chunks(ticker)
    if limit:
        chunks = chunks[:limit]

    gate_issues = collections.Counter()
    upstream_flags = collections.Counter()
    passed, gated_out = [], []
    for chunk in chunks:
        # Honour the ingest layer's own quality verdict first: D1 flags
        # tabular and suspect chunks with reasons, and re-deriving that here
        # would just be a second opinion on someone else's measurement.
        flag = (chunk.get("quality") or {}).get("flag", "ok")
        if flag != "ok":
            upstream_flags[flag] += 1
            gated_out.append({"page": chunk.get("page"),
                              "doc_type": chunk["doc_type"],
                              "issues": [f"upstream_{flag}"]})
            continue

        verdict = assess(chunk["text"])
        if verdict["usable"]:
            passed.append(chunk)
        else:
            gated_out.append({"page": chunk.get("page"),
                              "doc_type": chunk["doc_type"],
                              "issues": verdict["issues"]})
            for issue in verdict["issues"]:
                gate_issues[issue] += 1

    def one(chunk):
        return chunk, extract_chunk(chunk, model=model)

    kept_all, dropped_all = [], []
    illegible = []
    totals = {"exact": 0, "repaired": 0, "dropped": 0}

    if passed:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            for chunk, body in pool.map(one, passed):
                quality = body["chunk_quality"]
                if not quality["is_legible_prose"]:
                    illegible.append({"page": chunk.get("page"),
                                      "doc_type": chunk["doc_type"],
                                      "issue": quality["issue"]})
                    continue
                kept, dropped, stats = reconcile(body["claims"], chunk)
                kept_all.extend(kept)
                dropped_all.extend(dropped)
                for k in totals:
                    totals[k] += stats[k]

    kept_all = annotate(kept_all)
    # 10-K claims carry page None; sort them after the paginated ones.
    kept_all.sort(key=lambda c: (c["page"] is None, c["page"] or 0,
                                 -c["falsifiability"]))
    long_runs = sum(1 for c in chunks
                    if len(c["text"]) > 300
                    and _longest_run_words(c["text"]) > LONG_RUN_WORDS)

    return {
        "ticker": ticker,
        "model": model,
        "corpus": {
            "chunks_total": len(chunks),
            "chunks_by_doc_type": dict(collections.Counter(
                c["doc_type"] for c in chunks)),
            "chunks_flagged_by_ingest": dict(upstream_flags),
            "chunks_gated_out": len(gated_out),
            "chunks_sent_to_model": len(passed),
            "chunks_model_called_illegible": len(illegible),
            "chunks_yielding_claims": len({
                (c["doc_type"], c["page"], c["source_doc"]) for c in kept_all}),
            "gate_issues": dict(gate_issues),
            "gated_out_pages": gated_out,
            "illegible_pages": illegible,
            "long_run_chunks": long_runs,
            "long_run_chunks_note": (
                f"Count of chunks containing a {LONG_RUN_WORDS}+ word run with "
                "no sentence terminator. This OVER-COUNTS and is NOT a splice "
                "count: real tables produce long runs legitimately. It is a "
                "rough corpus-health signal only and must never be quoted as "
                "the number of spliced chunks. We do not know that number."
            ),
        },
        "guards": {
            "gate": "Mechanical corruption in the chunk. Runs before any API call.",
            "chunk_quality": ("Column splicing, which reads as ordinary words "
                              "in the wrong order. Model judgement."),
            "verbatim": ("Model paraphrase. Proves the quote matches the chunk. "
                         "CANNOT prove the chunk matches the document."),
        },
        "claims": len(kept_all),
        "claims_by_doc_type": dict(collections.Counter(
            c["doc_type"] for c in kept_all)),
        "evidence_class": summarise(kept_all),
        "evidence_class_note": (
            "Computed from the model's own returned fields; it never changes "
            "the model's falsifiability score. The score alone is not safe to "
            "sort on: the model rates specific-sounding activity statements "
            "highly even with no number and no date. Filter to 'quantified' "
            "for anything shown next to a grid figure."
        ),
        "verbatim_check": {
            "exact": totals["exact"],
            "whitespace_repaired": totals["repaired"],
            "dropped_not_in_source": totals["dropped"],
            "rule": ("Every stored verbatim is a character-for-character "
                     "substring of its source chunk. Whitespace-repaired "
                     "entries store the SOURCE span, not the model's string."),
        },
        "dropped": dropped_all,
        "extracted": kept_all,
    }


def write(result: dict) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f"{result['ticker']}.json"
    with path.open("w") as fh:
        json.dump(result, fh, indent=2)
        fh.write("\n")
    return path


def reclassify(ticker: str) -> dict:
    """Recompute derived fields on an existing output. No API calls."""
    path = OUT_DIR / f"{ticker}.json"
    with path.open() as fh:
        result = json.load(fh)
    result["extracted"] = annotate(result["extracted"])
    result["evidence_class"] = summarise(result["extracted"])
    result.setdefault("evidence_class_note", (
        "Computed from the model's own returned fields; it never changes the "
        "model's falsifiability score."))
    return result
