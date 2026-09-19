from __future__ import annotations

from server import search


def test_corpus_summary_matches_verified_manifest():
    assert search.corpus_summary() == {
        "corpus": {"total": 354, "esg": 309, "10k": 45},
        "quality": {"ok": 341, "tabular": 7, "suspect": 6},
    }


def test_search_preserves_edgar_locator_and_builds_companion_query(monkeypatch):
    class FakeClient:
        def search(self, **kwargs):
            self.kwargs = kwargs
            return {"hits": {"total": {"value": 1}, "hits": [{"_score": 3.0, "_source": {
                "text": "Risk disclosure", "ticker": "MSFT", "page": None,
                "locator": {"type": "html_anchor", "item": "1A", "char_offset": 42},
                "source_doc": "msft.htm", "source_url": "https://www.sec.gov/example",
                "doc_type": "10k", "quality": {"flag": "ok"},
            }}]}}

    fake = FakeClient()
    monkeypatch.setattr(search, "client", lambda: fake)
    result = search.search("100% renewable", ticker="msft", doc_type="10k")

    assert result["hits"] == [{
        "text": "Risk disclosure", "ticker": "MSFT", "page": None,
        "locator": {"type": "html_anchor", "item": "1A", "char_offset": 42},
        "source_doc": "msft.htm", "source_url": "https://www.sec.gov/example",
        "doc_type": "10k", "quality_flag": "ok", "score": 3.0,
    }]
    bool_query = fake.kwargs["query"]["bool"]
    assert bool_query["filter"] == [
        {"term": {"ticker": "MSFT"}}, {"term": {"doc_type": "10k"}},
    ]
    assert len(bool_query["should"]) == 2
