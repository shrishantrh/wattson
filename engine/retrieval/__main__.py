"""Command line entry point for indexing the verified Wattson corpus."""
from __future__ import annotations

import argparse
import json

from server.search import SearchUnavailable, corpus_summary, index_corpus


def main() -> int:
    parser = argparse.ArgumentParser(description="Index Wattson's verified document corpus in Elastic Cloud.")
    parser.add_argument("--recreate", action="store_true", help="Delete and rebuild only wattson-corpus-v1.")
    parser.add_argument("--dry-run", action="store_true", help="Validate records and print corpus counts; do not connect.")
    args = parser.parse_args()
    try:
        result = corpus_summary() if args.dry_run else index_corpus(recreate=args.recreate)
    except (SearchUnavailable, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps(result, indent=2, sort_keys=True, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
