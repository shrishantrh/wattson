"""Exhaustive pairwise cross-BA duplicate detection over the full EIA-930 record.

WHY THIS EXISTS. Wattson publishes a claim: Arizona Public Service and Salt River
Project were the only pair of balancing authorities reporting the same generation as
each other, and that double-count is why our own AZPS figure was wrong in DIRECTION --
we said overnight clean share fell 0.620 to 0.104 when it actually rose from 0.017.
That was established by investigating AZPS and then checking its neighbour. It was never
tested exhaustively. Nobody had asked whether some OTHER pair does the same thing.

This tests it. Every unordered pair of balancing authorities, every fuel, every hour they
both report. If a second duplicated pair exists anywhere, this finds it. A clean negative
makes the AZPS finding stronger, not weaker.

Scale: C(n,2) pairs x 9 fuels x ~74,000 hours. Parallel by fuel; the matrices are built
once in the parent and inherited by fork.
"""
from __future__ import annotations
import json, os, time
from itertools import combinations
from multiprocessing import Pool
import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

WIDE = "data/processed/gen_by_source_wide.parquet"
OUT = "claims/derived/pairwise_duplicates.json"

# EIA split hydro/solar/wind into sub-categories on 2024-07-01. Old and new never
# co-occur in the same hour, so summing parent and children is safe -- and summing only
# the old names silently truncates everything after July 2024. Same handling as the
# carbon-free index.
GROUPS = {
    "nuclear": ["nuclear"], "coal": ["coal"], "gas": ["gas"], "oil": ["oil"],
    "geothermal": ["geothermal"], "other": ["other", "unknown"],
    "hydro": ["hydro", "hydro_excluding_pumped_storage"],
    "solar": ["solar", "solar_w_integrated_battery_storage",
              "solar_wo_integrated_battery_storage"],
    "wind": ["wind", "wind_w_integrated_battery_storage",
             "wind_wo_integrated_battery_storage"],
}

MIN_OVERLAP_HOURS = 1000      # per WINDOW, not per series
MIN_MEAN_MW = 50
CORR_FLAG = 0.90
IDENTICAL_TOL_MW = 5.0
NEAR_ZERO_MW = 1.0            # see ZERO-INFLATION below
WINDOW_DAYS = 90
STEP_DAYS = 30
WINDOW_HOURS = WINDOW_DAYS * 24
STEP_HOURS = STEP_DAYS * 24

MATS = {}   # fuel -> (matrix, ba list)


def load():
    t = pq.read_table(WIDE)
    fields, changed = [], False
    for f in t.schema:
        if pa.types.is_dictionary(f.type):
            fields.append(pa.field(f.name, f.type.value_type, f.nullable)); changed = True
        else:
            fields.append(f)
    if changed:
        t = t.cast(pa.schema(fields))
    df = t.to_pandas().reset_index()
    return df[df["datetime_utc"] >= pd.Timestamp("2019-01-01")]


def sweep_fuel(fuel):
    """Sliding windows, because a duplication that STOPS is invisible to a whole-period test.

    The first version of this swept 2019-2026 in one window and missed AZPS/SRP -- the very
    pair it was written to find -- because the duplication ended on 2019-12-04 and the
    post-break period, where AZPS reads zero against SRP's 3,900 MW, destroys the
    correlation. It also produced a false positive on BANC/PACW solar, which is "53%
    identical" only because solar is zero at night for both and any two solar series match
    trivially in the dark.

    So: 90-day windows stepped 30 days, and hours where BOTH series are near zero are
    dropped before comparing.
    """
    M, bas, idx = MATS[fuel]
    hits, tested = [], 0
    starts = range(0, max(1, len(idx) - WINDOW_HOURS), STEP_HOURS)
    for i, j in combinations(range(len(bas)), 2):
        col_a, col_b = M[:, i], M[:, j]
        best = None
        for s0 in starts:
            a, b = col_a[s0:s0 + WINDOW_HOURS], col_b[s0:s0 + WINDOW_HOURS]
            both = ~np.isnan(a) & ~np.isnan(b)
            if both.sum() < MIN_OVERLAP_HOURS:
                continue
            x, y = a[both], b[both]
            # ZERO-INFLATION GUARD: drop hours where both are dark/idle. Without this,
            # every pair of solar series scores ~50% identical for the trivial reason
            # that the sun is down.
            live = (x > NEAR_ZERO_MW) | (y > NEAR_ZERO_MW)
            if live.sum() < MIN_OVERLAP_HOURS:
                continue
            x, y = x[live], y[live]
            if x.mean() < MIN_MEAN_MW or y.mean() < MIN_MEAN_MW:
                continue
            if x.std() == 0 or y.std() == 0:
                continue
            corr = float(np.corrcoef(x, y)[0, 1])
            if not np.isfinite(corr):
                continue
            diff = np.abs(x - y)
            pct = float((diff <= IDENTICAL_TOL_MW).mean() * 100)
            cand = {
                "fuel": fuel, "ba_a": bas[i], "ba_b": bas[j],
                "window_start": str(idx[s0].date()),
                "window_end": str(idx[min(s0 + WINDOW_HOURS, len(idx) - 1)].date()),
                "hours_compared": int(len(x)),
                "correlation": round(corr, 6),
                "mean_abs_diff_mw": round(float(diff.mean()), 2),
                "pct_identical_within_5mw": round(pct, 2),
                "mean_a_mw": round(float(x.mean()), 1), "mean_b_mw": round(float(y.mean()), 1),
                "combined_mean_mw": round(float((x + y).mean()), 1),
            }
            if best is None or pct > best["pct_identical_within_5mw"]:
                best = cand
        if best is None:
            continue
        tested += 1
        if best["correlation"] >= CORR_FLAG:
            hits.append(best)
    return fuel, hits, tested


if __name__ == "__main__":
    t0 = time.time()
    print("loading wide generation table...", flush=True)
    df = load()
    print(f"  {len(df):,} rows, {df.ba.nunique()} balancing authorities", flush=True)

    for fuel, cols in GROUPS.items():
        present = [c for c in cols if c in df.columns]
        if not present:
            continue
        s = df[present].sum(axis=1, min_count=1)
        piv = pd.DataFrame({"datetime_utc": df.datetime_utc, "ba": df.ba, "v": s}) \
                .dropna(subset=["v"]) \
                .pivot_table(index="datetime_utc", columns="ba", values="v", aggfunc="first")
        MATS[fuel] = (piv.to_numpy(dtype=np.float64), list(piv.columns), piv.index)
        print(f"  {fuel:<11} {piv.shape[0]:>6} hours x {piv.shape[1]:>3} BAs", flush=True)

    fuels = list(MATS)
    npairs = sum(len(MATS[f][1]) * (len(MATS[f][1]) - 1) // 2 for f in fuels)
    nwin = max(1, (len(MATS[fuels[0]][2]) - WINDOW_HOURS) // STEP_HOURS)
    print(f"\nsweeping {npairs:,} pairs x ~{nwin} sliding {WINDOW_DAYS}-day windows "
          f"= ~{npairs * nwin:,} window comparisons, {min(len(fuels), os.cpu_count())} workers",
          flush=True)

    all_hits, total_tested = [], 0
    with Pool(processes=min(len(fuels), os.cpu_count())) as pool:
        for fuel, hits, tested in pool.imap_unordered(sweep_fuel, fuels):
            total_tested += tested
            all_hits.extend(hits)
            print(f"  {fuel:<11} tested {tested:>6}  flagged {len(hits)}", flush=True)

    all_hits.sort(key=lambda h: (-h["pct_identical_within_5mw"], -h["correlation"]))
    dups = [h for h in all_hits
            if h["pct_identical_within_5mw"] >= 50 and h["mean_abs_diff_mw"] <= 50]
    nondups = [h for h in all_hits if h not in dups]
    elapsed = round(time.time() - t0, 1)

    out = {
        "what": ("Every unordered pair of balancing authorities, every fuel, every hour both "
                 "report, 2019 onward. Tests whether the AZPS/SRP double-count is unique."),
        "method": {
            "pairs_with_enough_data": total_tested,
            "min_overlap_hours": MIN_OVERLAP_HOURS, "min_mean_mw": MIN_MEAN_MW,
            "correlation_flag": CORR_FLAG, "identical_tolerance_mw": IDENTICAL_TOL_MW,
            "duplicate_criteria": "pct_identical_within_5mw >= 50 AND mean_abs_diff_mw <= 50",
            "window_days": WINDOW_DAYS, "step_days": STEP_DAYS,
            "near_zero_guard_mw": NEAR_ZERO_MW,
            "why_sliding_windows": (
                "A duplication that STOPS is invisible to a whole-period test. The first "
                "version of this swept 2019-2026 in one window and missed AZPS/SRP, the very "
                "pair it was written to find, because the duplication ended 2019-12-04 and "
                "the post-break period destroys the correlation."),
            "why_the_near_zero_guard": (
                "Hours where both series are near zero are dropped. Without it every pair of "
                "solar series scores about 50% identical for the trivial reason that the sun "
                "is down; the first run reported BANC/PACW solar as a duplicate on exactly "
                "that artefact."),
            "why_correlation_is_not_enough": (
                "Two BAs in the same region share weather and load shape, so their wind and "
                "solar correlate strongly without reporting the same numbers. The "
                "discriminator is whether the VALUES are identical, not whether they move "
                "together. Correlation alone would have produced dozens of false duplicates."),
            "fuel_category_split_handled": (
                "EIA split hydro/solar/wind into sub-categories on 2024-07-01; parent and "
                "child columns are summed, as in the carbon-free index."),
        },
        "elapsed_seconds": elapsed,
        "counts": {"correlation_flagged": len(all_hits), "duplicates": len(dups)},
        "duplicates": dups,
        "high_correlation_not_duplicates": nondups[:50],
    }
    os.makedirs("claims/derived", exist_ok=True)
    json.dump(out, open(OUT, "w"), indent=1)

    print(f"\n{'='*70}")
    print(f"pairs with enough data: {total_tested:,}")
    print(f"correlation-flagged (>={CORR_FLAG}): {len(all_hits)}")
    print(f"ACTUAL DUPLICATES: {len(dups)}")
    print(f"elapsed: {elapsed}s")
    print(f"{'='*70}")
    for d in dups[:15]:
        print(f"  {d['ba_a']:>5}/{d['ba_b']:<5} {d['fuel']:<10} corr={d['correlation']:.4f} "
              f"identical={d['pct_identical_within_5mw']:>5}%  "
              f"{d['mean_a_mw']}+{d['mean_b_mw']} = {d['combined_mean_mw']} MW")
    print("\ntop correlated but NOT duplicates (real regional co-movement):")
    for h in nondups[:8]:
        print(f"  {h['ba_a']:>5}/{h['ba_b']:<5} {h['fuel']:<10} corr={h['correlation']:.4f} "
              f"identical={h['pct_identical_within_5mw']:>5}%  diff={h['mean_abs_diff_mw']} MW")
