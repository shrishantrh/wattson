# Codex brief — Elasticsearch retrieval over the Wattson corpus

## What this project is

Wattson checks what companies publicly claim about their electricity against what the
grid physically delivered, from federal hourly data. Two halves: a grid index built from
EIA-930 (4.45M hourly rows, 70 balancing authorities), and a text layer that reads
corporate documents.

**Your job is the text layer's retrieval.** We have 354 verified, citable passages from
four companies' sustainability reports and SEC 10-K filings. Right now they can only be
searched by grepping JSONL. We want real cross-document search.

**Why it matters to the product:** the strongest finding in the whole project is a
company contradicting itself across two documents. Microsoft's sustainability report says
it matched 100% of its electricity with renewable energy; its 10-K risk factors say AI
"has and will likely continue to raise energy use and emissions, making it harder to meet
these goals." Google says the same pair. Today we found those by reading. **A search that
surfaces both halves of that pair from one query is the feature.**

## Data

```
claims/raw/{META,MSFT,GOOGL,AMZN}_esg.jsonl   309 chunks, sustainability reports
claims/raw/{META,MSFT,GOOGL,AMZN}_10k.jsonl    45 chunks, SEC 10-K Items 1 and 1A
```

One JSON object per line:

```json
{
  "text": "...",
  "page": 4,
  "source_doc": "google-2026-environmental-report.pdf",
  "source_url": "https://sustainability.google/files/google-2026-environmental-report.pdf",
  "ticker": "GOOGL",
  "year": 2026,
  "quality": { "flag": "ok" | "tabular" | "suspect", "reasons": ["..."] }
}
```

**`quality` is an OBJECT, not a string.** Index `quality.flag` as a keyword.

10-K records carry a `locator` instead of a meaningful page, because EDGAR filings are
HTML and HTML has no pages: `{"type": "html_anchor", "item": "1A", "char_offset": n}`
with `page: null`. Handle both citation forms.

## What quality.flag means, and why you must respect it

Extracting text from PDFs is where this project nearly shipped a fabricated quote. An
earlier extractor read two-column pages straight across and spliced the left column into
the right mid-sentence, producing fluent English that appears nowhere in the document.
The flags are the result of fixing that:

- `ok` (341) — safe to quote as a sentence
- `tabular` (7) — a data table flattened to text. Surface the NUMBERS, never the row as
  a sentence
- `suspect` (6) — mechanically corrupt. Index it so search is complete, but **never
  present it as a quotable sentence**

## Build

1. **Ingestion script** into Elastic Cloud. One index with a `ticker` field, or an index
   per company. Credentials come from `~/.wattson.env` (`ELASTIC_CLOUD_ID`,
   `ELASTIC_API_KEY`) — read from env, never hardcode, never commit.

   Mapping must keep `page`, `source_doc`, `source_url`, `ticker`, `year`, `doc_type`
   (esg | 10k) and `quality.flag` retrievable. **A search hit without its citation is
   worthless to us** — every result must be traceable to a page a judge can open.

2. **Cross-company, cross-document search.** One query spans all four companies'
   sustainability reports AND their 10-Ks. Support filters on ticker, doc_type and
   quality.flag.

3. **`GET /api/search?q=...`** in `server/` (FastAPI, already exists — follow the
   conventions in `contracts/api.v1.yaml`). Return per hit:
   `{text, ticker, page, locator, source_doc, source_url, doc_type, quality_flag, score}`
   plus a total. Add optional `ticker`, `doc_type` and `limit` params.

4. **The demo query that must work:** `"100% renewable"` returns Microsoft's and Google's
   annual-matching claims from their sustainability reports **and** their 10-K risk
   language about AI making emissions harder — side by side, each with its citation.

## Constraints

- **Do not re-extract PDFs.** The corpus is verified; every page citation was checked
  against the rendered page. Re-extracting risks reintroducing the splicing bug.
- **Do not modify `scripts/` or `dashboard/`.** Both are frozen.
- **Never invent a page number.** If a record has `page: null`, cite the locator.
- **No credentials in the repo.** `.env` is gitignored; keys live in `~/.wattson.env`.
- Keep it working when Elastic is unreachable — the endpoint should return a clear error,
  not crash the server. The rest of the demo must not depend on this.

## Done when

`curl 'localhost:8000/api/search?q=100%25+renewable'` returns hits from both document
types with page numbers, and filtering by `ticker=MSFT&doc_type=10k` narrows correctly.
