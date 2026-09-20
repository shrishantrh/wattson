"""Extract claims for one company: python3 -m engine.extract --ticker META"""
from __future__ import annotations

import argparse
import sys

from . import run as R
from .client import MODEL, ExtractionError

TICKERS = ["META", "MSFT", "GOOGL", "AMZN"]


def report(result: dict) -> None:
    c = result["corpus"]
    v = result["verbatim_check"]
    print(f"{result['ticker']}  model={result['model']}")
    print(f"  chunks              {c['chunks_total']}")
    print(f"    gated out         {c['chunks_gated_out']}  {c['gate_issues']}")
    print(f"    sent to model     {c['chunks_sent_to_model']}")
    print(f"    model: illegible  {c['chunks_model_called_illegible']}")
    print(f"    yielded claims    {c['chunks_yielding_claims']}")
    print(f"  claims              {result['claims']}  {result.get('evidence_class', {})}")
    print(f"    verbatim exact    {v['exact']}")
    print(f"    ws-repaired       {v['whitespace_repaired']}")
    print(f"    DROPPED           {v['dropped_not_in_source']}")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="engine.extract")
    parser.add_argument("--ticker", required=True,
                        help=f"one of {', '.join(TICKERS)}, or ALL")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--model", default=MODEL)
    parser.add_argument("--reclassify", action="store_true",
                        help="recompute derived fields on existing output; no API calls")
    args = parser.parse_args(argv)

    tickers = TICKERS if args.ticker.upper() == "ALL" else [args.ticker.upper()]
    try:
        for ticker in tickers:
            if args.reclassify:
                result = R.reclassify(ticker)
            else:
                result = R.run(ticker, limit=args.limit, workers=args.workers,
                               model=args.model)
            path = R.write(result)
            report(result)
            print(f"  wrote {path.relative_to(R.REPO_ROOT)}")
            print()
    except ExtractionError as exc:
        print(f"extraction failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
