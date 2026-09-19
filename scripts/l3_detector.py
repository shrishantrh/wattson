"""L3: flat-load detector.

Scores every demand region on the electrical fingerprint of new 24/7 load,
comparing 2025 against the 2019 baseline. Regions are every subregion in
out_eia930__hourly_subregion_demand plus every BA with demand in
out_eia930__hourly_operations (demand_imputed_pudl_mwh in both). Regions under
500 MW average demand in either year are excluded.

Components (all in percentage points except load factor):
  overnight_excess     overnight (00-05 local) demand growth minus average demand growth
  load_factor_delta    (mean / peak) in 2025 minus 2019; supporting evidence only.
                       Peak = the 99.5th percentile hour, so one corrupt hour cannot
                       move it (PJM/PL 2019 has a 11.6 GW spike against a 7.6 GW p99.5).
                       The raw-max version is kept as load_factor_max_delta.
  neighbor_divergence  average demand growth minus the median growth of peers
                       (zones: other zones in the same BA; BAs: other BAs in the
                       same interconnection, or all BAs if fewer than 3 peers)
  score = z(overnight_excess) + z(neighbor_divergence) + 0.5 * z(load_factor_delta)
          with robust z-scores (median / MAD) across all scored regions.

METHOD FROZEN 2026-09-19 after the first run: weights, the 500 MW cut and the
p99.5 peak were set before looking at the ranking and are not tuned to it. The
validation regions (PJM/DOM, PJM/AEP, SWPP/OPPD, ERCO/NCEN) were named in advance.
The detector flags flat 24/7 load in general: datacenters, crypto mining,
oilfield electrification. Use "consistent with" language.

pattern label (descriptive, not part of the score):
  flat-load growth                    growth >= 10% and overnight_excess > 0
  possible midday solar suppression   growth < 5% and overnight_excess >= 5 points
  mixed                               everything else

Outputs (data/processed/):
  l3_region_year.csv   region, year, window, avg_mw, overnight_avg_mw, peak_mw, p995_mw, load_factor (p99.5), load_factor_max, hours
  l3_detector.csv      one row per region: components, score, rank
"""
from pathlib import Path
import numpy as np
import pandas as pd

PROCESSED = Path("data/processed")
MIN_MW = 500
BASE, TARGET = 2019, 2025
NIGHT = range(0, 6)


def load_demand() -> pd.DataFrame:
    sub = pd.read_parquet("data/pudl/out_eia930__hourly_subregion_demand.parquet",
                          columns=["datetime_utc", "balancing_authority_code_eia", "balancing_authority_subregion_code_eia", "demand_imputed_pudl_mwh"])
    sub.columns = ["datetime_utc", "ba", "zone", "demand_mwh"]
    sub["zone"] = sub.zone.astype(str)
    ops = pd.read_parquet("data/pudl/out_eia930__hourly_operations.parquet",
                          columns=["datetime_utc", "balancing_authority_code_eia", "demand_imputed_pudl_mwh"])
    ops.columns = ["datetime_utc", "ba", "demand_mwh"]
    ops["zone"] = None
    d = pd.concat([sub, ops], ignore_index=True).dropna(subset=["demand_mwh"])
    d["region"] = np.where(d.zone.isna(), d.ba, d.ba + "/" + d.zone.astype(str))
    return d


def localize(d: pd.DataFrame, codes: pd.DataFrame) -> pd.DataFrame:
    d = d.merge(codes[["code", "report_timezone"]], left_on="ba", right_on="code", how="left").drop(columns="code")
    missing = sorted(d.loc[d.report_timezone.isna(), "ba"].unique())
    if missing:
        print("no time zone, dropped:", missing)
    parts = []
    for tzname, g in d.dropna(subset=["report_timezone"]).groupby("report_timezone", observed=True):
        local = g.datetime_utc.dt.tz_localize("UTC").dt.tz_convert(tzname)
        parts.append(g.assign(local_hour=local.dt.hour, year=local.dt.year, month=local.dt.month))
    return pd.concat(parts, ignore_index=True)


def region_year_stats(d: pd.DataFrame) -> pd.DataFrame:
    out = []
    for window, frame in [("calendar", d), ("jan_aug", d[d.month <= 8])]:
        g = frame.groupby(["region", "year"]).agg(
            ba=("ba", "first"), zone=("zone", "first"),
            avg_mw=("demand_mwh", "mean"), peak_mw=("demand_mwh", "max"),
            p995_mw=("demand_mwh", lambda s: s.quantile(0.995)), hours=("demand_mwh", "count"),
        )
        g["overnight_avg_mw"] = frame[frame.local_hour.isin(NIGHT)].groupby(["region", "year"]).demand_mwh.mean()
        g["load_factor"] = g.avg_mw / g.p995_mw
        g["load_factor_max"] = g.avg_mw / g.peak_mw
        out.append(g.reset_index().assign(window=window))
    return pd.concat(out, ignore_index=True)


def robust_z(s: pd.Series) -> pd.Series:
    med = s.median()
    mad = (s - med).abs().median() * 1.4826
    return (s - med) / mad if mad > 0 else s * 0


def detect(stats: pd.DataFrame, codes: pd.DataFrame, window="calendar", base=BASE, target=TARGET) -> pd.DataFrame:
    s = stats[stats.window == window]
    b = s[s.year == base].set_index("region")
    t = s[s.year == target].set_index("region")
    common = b.index.intersection(t.index)
    b, t = b.loc[common], t.loc[common]
    full = (b.hours >= 0.9 * (8760 if window == "calendar" else 5832)) & (t.hours >= 0.9 * (8760 if window == "calendar" else 5832))
    big = (b.avg_mw >= MIN_MW) & (t.avg_mw >= MIN_MW)
    keep = common[full & big]
    b, t = b.loc[keep], t.loc[keep]

    r = pd.DataFrame(index=keep)
    r["ba"], r["zone"] = b.ba, b.zone
    r["is_zone"] = r.zone.notna()
    r["avg_mw_base"], r["avg_mw_target"] = b.avg_mw, t.avg_mw
    r["growth_pct"] = 100 * (t.avg_mw / b.avg_mw - 1)
    r["overnight_growth_pct"] = 100 * (t.overnight_avg_mw / b.overnight_avg_mw - 1)
    r["overnight_excess"] = r.overnight_growth_pct - r.growth_pct
    r["load_factor_base"], r["load_factor_target"] = b.load_factor, t.load_factor
    r["load_factor_delta"] = t.load_factor - b.load_factor
    r["load_factor_max_delta"] = t.load_factor_max - b.load_factor_max

    # peer groups
    ic = codes.set_index("code").interconnect_code_eia.astype(str)
    r["peer_group"] = np.where(r.is_zone, "zone:" + r.ba.astype(str), "ic:" + r.ba.map(ic).fillna("nan"))
    div = pd.Series(index=r.index, dtype=float)
    for grp, members in r.groupby("peer_group").groups.items():
        for m in members:
            peers = r.loc[members].drop(index=m).growth_pct
            if len(peers) < 3:
                # lone zone (e.g. PNM/PNM) or thin interconnection: compare against all BAs
                peers = r[~r.is_zone].drop(index=m, errors="ignore").growth_pct
            div[m] = r.at[m, "growth_pct"] - peers.median() if len(peers) else np.nan
    r["neighbor_divergence"] = div

    r["z_overnight_excess"] = robust_z(r.overnight_excess)
    r["z_neighbor_divergence"] = robust_z(r.neighbor_divergence)
    r["z_load_factor_delta"] = robust_z(r.load_factor_delta)
    r["score"] = r.z_overnight_excess + r.z_neighbor_divergence + 0.5 * r.z_load_factor_delta
    r = r.sort_values("score", ascending=False)
    r["rank"] = np.arange(1, len(r) + 1)
    r["pattern"] = r.apply(pattern_label, axis=1)
    return r.reset_index().rename(columns={"index": "region"})


def pattern_label(row) -> str:
    """Descriptive label only; does not affect the score or rank (method frozen).
    'high' overnight excess = 5 points, about the median plus one robust SD."""
    if row.growth_pct >= 10 and row.overnight_excess > 0:
        return "flat-load growth"
    if row.growth_pct < 5 and row.overnight_excess >= 5:
        return "possible midday solar suppression"
    return "mixed"


if __name__ == "__main__":
    pd.set_option("display.width", 250); pd.set_option("display.max_columns", 40)
    codes = pd.read_parquet("data/pudl/core_eia__codes_balancing_authorities.parquet")
    d = localize(load_demand(), codes)
    stats = region_year_stats(d)
    stats.to_csv(PROCESSED / "l3_region_year.csv", index=False)

    # data quality: where does the raw max blow past the 99.5th percentile?
    q = stats[(stats.window == "calendar") & stats.year.isin([BASE, TARGET]) & (stats.avg_mw >= MIN_MW)]
    bad = q[q.peak_mw > 1.3 * q.p995_mw]
    print(f"regions x years where max > 1.3 x p99.5 (suspect peaks): {len(bad)} of {len(q)}")
    if len(bad):
        print(bad[["region", "year", "avg_mw", "peak_mw", "p995_mw"]].round(0).head(12).to_string(index=False))

    r = detect(stats, codes)
    r.to_csv(PROCESSED / "l3_detector.csv", index=False)
    r26 = detect(stats, codes, window="jan_aug", target=2026)
    r26.to_csv(PROCESSED / "l3_detector_2026_jan_aug.csv", index=False)

    cols = ["rank", "region", "avg_mw_base", "avg_mw_target", "growth_pct", "overnight_growth_pct", "overnight_excess",
            "load_factor_base", "load_factor_target", "load_factor_delta", "neighbor_divergence", "score"]
    fmt = {"avg_mw_base": 0, "avg_mw_target": 0, "growth_pct": 1, "overnight_growth_pct": 1, "overnight_excess": 1,
           "load_factor_base": 3, "load_factor_target": 3, "load_factor_delta": 3, "neighbor_divergence": 1, "score": 2}
    print(f"\nscored regions: {len(r)} ({r.is_zone.sum()} zones, {(~r.is_zone).sum()} BAs), 2019 -> 2025 calendar")
    print("\nTOP 20:"); print(r[cols].head(20).round(fmt).to_string(index=False))
    print("\nVALIDATION SET:")
    print(r[r.region.isin(["PJM/DOM", "PJM/AEP", "SWPP/OPPD", "ERCO/NCEN", "PJM", "ERCO", "SWPP"])][cols].round(fmt).to_string(index=False))
    print("\nBOTTOM 5:"); print(r[cols].tail(5).round(fmt).to_string(index=False))
    print("\nComponent spread (median / MAD):")
    for c in ["overnight_excess", "neighbor_divergence", "load_factor_delta"]:
        print(f"  {c:20s} median {r[c].median():7.3f}  MAD {((r[c]-r[c].median()).abs().median()*1.4826):7.3f}")
    print("\n2019 -> 2026 Jan-Aug, top 10:")
    print(r26[cols].head(10).round(fmt).to_string(index=False))
    print("\n2026 Jan-Aug ranks for validation set:")
    print(r26[r26.region.isin(["PJM/DOM", "PJM/AEP", "SWPP/OPPD", "ERCO/NCEN"])][["rank", "region", "growth_pct", "overnight_excess", "load_factor_delta", "neighbor_divergence", "score"]].round(fmt).to_string(index=False))
