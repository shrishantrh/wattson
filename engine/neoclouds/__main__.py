"""Neocloud sites + the curtailment check on our own detector."""
from __future__ import annotations

import textwrap

from . import build


def main() -> int:
    rows_path = build.write_rows()
    check = build.curtailment_check()
    check_path = build.write_curtailment(check)

    print(f"neocloud sites: {len(build.rows())}")
    print(f"{'company':26s} {'metro':28s} {'ba':6s} serving utility")
    for r in build.rows():
        print(f"  {r['company']:24s} {r['metro']:28s} {r['ba'] or '-':6s} "
              f"{r['serving_utility'] or '(unresolved)'}")

    print()
    print("not established, deliberately omitted:")
    for n in build.not_established():
        print(f"  {n['company']} ({n['ticker']})")

    print()
    print("CURTAILMENT CHECK ON OUR OWN DETECTOR")
    lf = check["load_factor_term"]
    print(f"  r(score, load_factor_delta) = {lf['correlation_with_score']:+.3f} "
          f"over {lf['n_regions']} regions, term weight {lf['weight_in_score']}")
    print()
    print(f"  {'region':11s} {'rank':>4s} {'growth%':>8s} {'lf_delta':>9s} {'pctile':>7s}")
    for z in check["ercot_zones"]:
        print(f"  {z['region']:11s} {z['rank']:4d} {z['growth_pct']:8.1f} "
              f"{z['load_factor_delta']:+9.3f} {z['load_factor_delta_percentile']:6.1f}%")
    print()
    print(f"  verdict: {check['verdict']}")
    for line in textwrap.wrap(check["statement"], 86):
        print(f"    {line}")
    print()
    for c in check["caveats"]:
        for i, line in enumerate(textwrap.wrap(c, 84)):
            print(("    - " if i == 0 else "      ") + line)

    print()
    print(f"wrote {rows_path.relative_to(build.REPO_ROOT)}")
    print(f"wrote {check_path.relative_to(build.REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
