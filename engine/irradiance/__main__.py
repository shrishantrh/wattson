"""Print the irradiance overlay and write claims/derived/irradiance.json."""
from __future__ import annotations

import textwrap

from . import build as B


def main() -> int:
    result = B.build()
    path = B.write(result)

    print(f"NASA POWER {result['parameter']} ({result['units']}), "
          f"{result['baseline_year']} vs {result['compare_year']}")
    print()
    print(f"{'region':11s} {'point':20s} "
          f"{'irr19':>6s} {'irr25':>6s} {'irr Δ%':>7s} {'var%':>5s} | "
          f"{'day19':>6s} {'day25':>6s} {'Δpts':>6s} | "
          f"{'ngt19':>6s} {'ngt25':>6s} {'Δpts':>6s} | verdict")
    for r in result["regions"]:
        irr, cf = r["irradiance"], r["cf_share"]
        a = irr["annual_mean"]
        b, c = result["baseline_year"], result["compare_year"]
        print(f"{r['region']:11s} {r['point']['place']:20s} "
              f"{a[b]:6.3f} {a[c]:6.3f} {irr['change_pct_2019_2025']:+6.1f}% "
              f"{irr['year_to_year_variation_pct']:5.1f} | "
              f"{cf[b]['daytime']:6.3f} {cf[c]['daytime']:6.3f} "
              f"{cf['daytime_change_pts']:+6.1f} | "
              f"{cf[b]['overnight']:6.3f} {cf[c]['overnight']:6.3f} "
              f"{cf['overnight_change_pts']:+6.1f} | {r['verdict']}")

    print()
    nat = result["national_reference"]
    b, c = result["baseline_year"], result["compare_year"]
    print(f"national reference  daytime {nat[b]['daytime']:.3f} -> {nat[c]['daytime']:.3f}"
          f"   overnight {nat[b]['overnight']:.3f} -> {nat[c]['overnight']:.3f}")
    print(f"  {nat['note']}")

    print()
    print("CONCLUSION")
    for line in textwrap.wrap(result["conclusion"]["statement"], 88):
        print(f"  {line}")

    print()
    for r in result["regions"]:
        if r["verdict"] != "supports":
            print(f"  {r['verdict']:17s} {r['region']}")

    print()
    print("CAVEATS (these travel in the JSON, not just the README):")
    for caveat in result["caveats"]:
        for i, line in enumerate(textwrap.wrap(caveat, 84)):
            print(("  - " if i == 0 else "    ") + line)

    print()
    print(f"wrote {path.relative_to(B.REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
