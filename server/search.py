"""Elasticsearch-backed retrieval for the verified Wattson document corpus.

The corpus is intentionally read-only here: citations were verified before these JSONL
files were committed.  This module only indexes the existing records and returns their
stored citation fields verbatim.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any, Iterator

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "claims" / "raw"
INDEX_NAME = os.environ.get("WATTSON_ELASTIC_INDEX", "wattson-corpus-v1")
DEFAULT_LIMIT = 12
MAX_LIMIT = 50

MAPPING: dict[str, Any] = {
    "dynamic": "strict",
    "properties": {
        "text": {"type": "text"},
        "page": {"type": "integer"},
        "locator": {
            "properties": {
                "type": {"type": "keyword"},
                "item": {"type": "keyword"},
                "char_offset": {"type": "integer"},
            }
        },
        "source_doc": {"type": "keyword"},
        "source_url": {"type": "keyword", "index": False},
        "ticker": {"type": "keyword"},
        "year": {"type": "integer"},
        "doc_type": {"type": "keyword"},
        "quality": {
            "properties": {
                "flag": {"type": "keyword"},
                "reasons": {"type": "keyword", "index": False},
            }
        },
    },
}


class SearchUnavailable(RuntimeError):
    """Raised when retrieval is not configured or Elastic cannot be reached."""


def load_local_env(path: Path | None = None) -> None:
    """Load ~/.wattson.env without overwriting variables supplied by the process."""
    path = path or Path.home() / ".wattson.env"
    if not path.exists():
        return
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def client():
    """Build a short-timeout cloud client only when retrieval is actually used."""
    load_local_env()
    cloud_id = os.environ.get("ELASTIC_CLOUD_ID")
    # ELASTICSEARCH_URI is supported for the existing TypeScript-style setup;
    # URL is the spelling used in the README.
    endpoint = os.environ.get("ELASTICSEARCH_URL") or os.environ.get("ELASTICSEARCH_URI")
    api_key = os.environ.get("ELASTIC_API_KEY")
    if not api_key or not (cloud_id or endpoint):
        raise SearchUnavailable(
            "Elasticsearch is not configured. Set ELASTIC_CLOUD_ID (or ELASTICSEARCH_URL/URI) and "
            "ELASTIC_API_KEY in ~/.wattson.env."
        )
    try:
        from elasticsearch import Elasticsearch
    except ImportError as exc:
        raise SearchUnavailable("Elasticsearch client is not installed. Run: pip install -r requirements.txt") from exc
    kwargs: dict[str, Any] = {"api_key": api_key, "request_timeout": 4, "retry_on_timeout": False}
    if cloud_id:
        kwargs["cloud_id"] = cloud_id
    else:
        kwargs["hosts"] = [endpoint]
    return Elasticsearch(**kwargs)


def _doc_type(path: Path) -> str:
    if path.name.endswith("_esg.jsonl"):
        return "esg"
    if path.name.endswith("_10k.jsonl"):
        return "10k"
    raise ValueError(f"unexpected corpus file: {path.name}")


def corpus_records(raw_dir: Path = RAW_DIR) -> Iterator[tuple[str, dict[str, Any]]]:
    """Yield deterministic ids and validated, citation-bearing corpus records."""
    for path in sorted(raw_dir.glob("*.jsonl")):
        doc_type = _doc_type(path)
        for line_number, line in enumerate(path.read_text().splitlines(), 1):
            if not line.strip():
                continue
            record = json.loads(line)
            quality = record.get("quality")
            if not isinstance(quality, dict) or not quality.get("flag"):
                raise ValueError(f"{path}:{line_number}: quality must be an object with flag")
            if not record.get("text") or not record.get("source_doc") or not record.get("source_url"):
                raise ValueError(f"{path}:{line_number}: missing text or source citation")
            # PDFs cite a page; SEC HTML cites a locator.  One of them must be present.
            if record.get("page") is None and not record.get("locator"):
                raise ValueError(f"{path}:{line_number}: missing page and locator")
            record["doc_type"] = doc_type
            identity = f"{path.name}:{line_number}".encode()
            yield hashlib.sha256(identity).hexdigest(), record


def corpus_summary(raw_dir: Path = RAW_DIR) -> dict[str, Any]:
    counts: dict[str, int] = {"total": 0, "esg": 0, "10k": 0}
    quality: dict[str, int] = {}
    for _, record in corpus_records(raw_dir):
        counts["total"] += 1
        counts[record["doc_type"]] += 1
        flag = record["quality"]["flag"]
        quality[flag] = quality.get(flag, 0) + 1
    return {"corpus": counts, "quality": quality}


def ensure_index(es, *, recreate: bool = False) -> None:
    if recreate and es.indices.exists(index=INDEX_NAME):
        es.indices.delete(index=INDEX_NAME)
    if not es.indices.exists(index=INDEX_NAME):
        es.indices.create(index=INDEX_NAME, mappings=MAPPING)


def index_corpus(*, recreate: bool = False) -> dict[str, Any]:
    """Create the index if needed and bulk-index all checked corpus records."""
    es = client()
    try:
        ensure_index(es, recreate=recreate)
        from elasticsearch.helpers import streaming_bulk
        actions = ({"_index": INDEX_NAME, "_id": record_id, "_source": record}
                   for record_id, record in corpus_records())
        success = failed = 0
        for ok, result in streaming_bulk(es, actions, raise_on_error=False):
            if ok:
                success += 1
            else:
                failed += 1
                if failed == 1:
                    first_error = result
        es.indices.refresh(index=INDEX_NAME)
        result = {**corpus_summary(), "indexed": success, "failed": failed, "index": INDEX_NAME}
        if failed:
            result["first_error"] = first_error
        return result
    except SearchUnavailable:
        raise
    except Exception as exc:
        raise SearchUnavailable(f"Elasticsearch is unreachable: {exc}") from exc


def _companion_clauses(query: str) -> list[dict[str, Any]]:
    """Include the risk half of clean-power claims, without hiding literal results.

    A matching/renewable search is commonly used to inspect the tension between annual
    procurement claims and AI-driven energy/emissions risk disclosures.  This weak
    companion clause keeps that cross-document evidence in the same result set.
    """
    terms = query.casefold()
    if "renewable" in terms or "100%" in terms or "100 percent" in terms:
        return [{"bool": {
            # This deliberately targets the SEC risk half of an annual-matching claim.
            # The terms cover both Microsoft's "harder to meet" disclosure and
            # Alphabet's "more complex and challenging" disclosure.
            "filter": [{"term": {"doc_type": "10k"}}],
            "must": [{"simple_query_string": {
                "query": ('"energy use" | "energy demands" | emissions | "climate goals" | '
                          '"harder to meet" | "more complex and challenging"'),
                "fields": ["text"], "default_operator": "or",
            }}],
            "boost": 8,
        }}]
    return []


# ---- local fallback -----------------------------------------------------------------
#
# The corpus itself lives in claims/raw and is committed: 354 documents, every record
# already carrying its ticker, page and source URL. Elasticsearch adds ranking quality,
# not the documents. So when no cluster is configured, search the records directly rather
# than telling the user there is no corpus: a demo that cannot quote a filing because an
# env var is unset is a worse failure than a simpler ranker.
#
# This is deliberately NOT presented as Elasticsearch. status() reports which engine
# answered, and the ask layer says so, because claiming a cluster we are not running is
# exactly the kind of thing this project exists to catch.

_WORD = re.compile(r"[a-z0-9%.]+")


def _tokens(text: str) -> list[str]:
    return _WORD.findall(text.lower())


def _score_record(rec_text: str, terms: list[str], phrase: str) -> float:
    """Term overlap, with a large bonus for the whole phrase appearing."""
    low = rec_text.lower()
    if not terms:
        return 0.0
    hits = sum(1 for t in terms if t in low)
    if not hits:
        return 0.0
    score = hits / len(terms)
    if phrase and phrase in low:
        score += 3.0
    # Prefer passages that are mostly about the query rather than long pages that mention it.
    return score + min(len(terms), hits) / max(len(_tokens(rec_text)) or 1, 1) * 2


def _local_search(query: str, *, ticker=None, doc_type=None, quality_flag=None,
                  limit: int = DEFAULT_LIMIT) -> dict[str, Any]:
    terms = [t for t in _tokens(query) if len(t) > 2]
    phrase = query.strip().lower()
    scored = []
    for _, rec in corpus_records():
        if ticker and (rec.get("ticker") or "").upper() != ticker.upper():
            continue
        if doc_type and rec.get("doc_type") != doc_type:
            continue
        flag = (rec.get("quality") or {}).get("flag")
        if quality_flag and flag != quality_flag:
            continue
        text = rec.get("text") or ""
        sc = _score_record(text, terms, phrase)
        if sc > 0:
            scored.append((sc, rec, flag))
    scored.sort(key=lambda x: -x[0])
    hits = [{
        "text": rec.get("text"), "ticker": rec.get("ticker"), "page": rec.get("page"),
        "locator": rec.get("locator"), "source_doc": rec.get("source_doc"),
        "source_url": rec.get("source_url"), "doc_type": rec.get("doc_type"),
        "quality_flag": flag, "score": round(sc, 3),
    } for sc, rec, flag in scored[:limit]]
    return {"total": len(scored), "hits": hits, "engine": "local"}


def search(query: str, *, ticker: str | None = None, doc_type: str | None = None,
           quality_flag: str | None = None, limit: int = DEFAULT_LIMIT) -> dict[str, Any]:
    if not query.strip():
        raise ValueError("q must not be blank")
    if doc_type and doc_type not in {"esg", "10k"}:
        raise ValueError("doc_type must be esg or 10k")
    limit = max(1, min(limit, MAX_LIMIT))
    filters: list[dict[str, Any]] = []
    if ticker:
        filters.append({"term": {"ticker": ticker.upper()}})
    if doc_type:
        filters.append({"term": {"doc_type": doc_type}})
    if quality_flag:
        filters.append({"term": {"quality.flag": quality_flag}})
    direct = {"bool": {"should": [
        {"multi_match": {"query": query, "fields": ["text^2"], "type": "best_fields"}},
        # Annual-matching language often has words between "100%" and "renewable".
        {"match_phrase": {"text": {"query": query, "slop": 12, "boost": 6}}},
    ], "minimum_should_match": 1}}
    body = {
        "size": limit,
        "track_total_hits": True,
        "_source": ["text", "ticker", "page", "locator", "source_doc", "source_url",
                    "doc_type", "quality.flag"],
        "query": {"bool": {"filter": filters, "should": [direct, *_companion_clauses(query)],
                            "minimum_should_match": 1}},
    }
    try:
        response = client().search(index=INDEX_NAME, **body)
    except SearchUnavailable:
        return _local_search(query, ticker=ticker, doc_type=doc_type,
                             quality_flag=quality_flag, limit=limit)
    except Exception:
        return _local_search(query, ticker=ticker, doc_type=doc_type,
                             quality_flag=quality_flag, limit=limit)
    total = response["hits"]["total"]
    total_value = total["value"] if isinstance(total, dict) else total
    hits = []
    for hit in response["hits"]["hits"]:
        source = hit["_source"]
        hits.append({
            "text": source["text"], "ticker": source["ticker"], "page": source.get("page"),
            "locator": source.get("locator"), "source_doc": source["source_doc"],
            "source_url": source["source_url"], "doc_type": source["doc_type"],
            "quality_flag": (source.get("quality") or {}).get("flag"), "score": hit.get("_score"),
        })
    return {"total": total_value, "hits": hits}


def status() -> dict[str, Any]:
    """Return index counts for demo measurement without exposing credentials."""
    summary = corpus_summary()
    try:
        es = client()
        exists = es.indices.exists(index=INDEX_NAME)
        indexed = es.count(index=INDEX_NAME)["count"] if exists else 0
        return {"available": True, "index": INDEX_NAME, "indexed": indexed, **summary}
    except SearchUnavailable as exc:
        return {"available": False, "index": INDEX_NAME, "error": str(exc), **summary}
