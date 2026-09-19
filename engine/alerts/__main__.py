"""Build the ranked alert shortlist and write claims/derived/alerts_ranked.json."""
from __future__ import annotations

import sys

from . import pipeline
from .ranking import DEFAULT_LIMIT


def main(argv=None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    limit = int(argv[0]) if argv else DEFAULT_LIMIT

    result = pipeline.build(limit=limit)
    path = pipeline.write(result)

    print(f"alerts: {result['count']}")
    print(f"  from {result['source_alerts_active']} active "
          f"({result['source_alerts_total']} total) through {result['latest_month']}")
    print()

    width = max((len(a["region"]) for a in result["alerts"]), default=6)
    for i, a in enumerate(result["alerts"], 1):
        f = a["severity_factors"]
        flag = "  [caveat]" if a.get("data_caveat") else ""
        print(f"{i:3d}. {a['region']:<{width}}  severity {a['severity']:7.4f}"
              f"  = mag {f['magnitude']:.3f}"
              f" x per {f['persistence']:.3f}"
              f" x rec {f['recency']:.3f}"
              f"  {a['rule']}{flag}")

    print()
    print("dropped:")
    for reason, n in sorted(result["dropped"].items(), key=lambda kv: -kv[1]):
        if n:
            print(f"  {n:4d}  {reason}")

    if result["withheld_for_review"]:
        print()
        print(f"withheld for review ({len(result['withheld_for_review'])}) "
              f"- surfaced, not deleted:")
        for a in result["withheld_for_review"]:
            print(f"  {a['region']:<{width}}  {a['rule']}  "
                  f"severity {a['severity']:.4f} if ranked")

    print()
    print(f"wrote {path.relative_to(pipeline.REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
