"""Verify the hand-mapped operator table; write claims/derived/operators_verified.json."""
from __future__ import annotations

from . import verify


def main() -> int:
    result = verify.build()
    path = verify.write(result)

    s = result["summary"]
    print(f"operator rows: {s['rows']}  "
          f"({s['with_ticker']} with ticker, {s['without_ticker']} without)")
    print(f"  by status: {s['by_status']}")
    print()

    for o in result["operators"]:
        if o["status"] == "corrected":
            c = o["correction"]
            print(f"CORRECTED  {o['ticker']}  {c['field']}: "
                  f"{c['old']!r} -> {c['new']!r}")
    for o in result["operators"]:
        if o.get("pending_change"):
            print(f"PENDING    {o['ticker']}  {o['utility']}")
    print()
    print(f"wrote {path.relative_to(verify.REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
