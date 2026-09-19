"""Ingest company disclosure documents into citable JSONL chunks.

    python3 -m engine.ingest --ticker META
    python3 -m engine.ingest --all
"""

import argparse
import json
import pathlib
import sys

from engine.ingest.pipeline import ingest_pdf
from engine.ingest.writer import write_jsonl

RAW = pathlib.Path("claims/raw")
MANIFEST = RAW / "sources.json"
TICKERS = ("META", "MSFT", "GOOGL", "AMZN")


def load_manifest():
    if not MANIFEST.exists():
        sys.exit(f"missing {MANIFEST}. Run the download step first.")
    return json.loads(MANIFEST.read_text())["documents"]


def ingest_ticker(ticker, manifest, target_tokens, overlap_tokens):
    entry = manifest.get(ticker)
    if entry is None:
        sys.exit(f"{ticker} is not in {MANIFEST}")

    pdf = pathlib.Path(entry["local_path"])
    if not pdf.exists():
        sys.exit(
            f"{pdf} is missing. It is gitignored on purpose, so re-download it "
            f"from the recorded source_url:\n  {entry['source_url']}"
        )

    records = ingest_pdf(
        pdf, ticker=ticker, year=entry["year"],
        source_doc=pathlib.Path(entry["source_url"]).name,
        source_url=entry["source_url"],
        target_tokens=target_tokens, overlap_tokens=overlap_tokens,
    )
    out = RAW / f"{ticker}_{entry['doc']}.jsonl"
    n = write_jsonl(out, records)
    pages = {r["page"] for r in records}
    print(f"{ticker:6} {n:5} chunks  {len(pages):4} pages  -> {out}")
    return n


def main(argv=None):
    ap = argparse.ArgumentParser(prog="engine.ingest")
    ap.add_argument("--ticker", help="one of " + ", ".join(TICKERS))
    ap.add_argument("--all", action="store_true", help="every ticker")
    ap.add_argument("--target-tokens", type=int, default=2000)
    ap.add_argument("--overlap-tokens", type=int, default=200)
    args = ap.parse_args(argv)

    if not args.ticker and not args.all:
        ap.error("pass --ticker TICKER or --all")

    manifest = load_manifest()
    targets = TICKERS if args.all else [args.ticker.upper()]
    total = sum(ingest_ticker(t, manifest, args.target_tokens,
                              args.overlap_tokens) for t in targets)
    print(f"total {total} chunks")


if __name__ == "__main__":
    main()
