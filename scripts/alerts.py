"""Alert rules on trailing-12-month series, with the month each threshold was first crossed.

Series (window = 12 months ending each month, local time overnight = 00:00-05:59):
  demand   overnight average demand per region, from the same demand tables as L3
  cf       overnight carbon-free share and clean MW per BA, from l2_trailing12.csv
  gas      overnight gas share of generation per BA, from l4_overnight_fuel_monthly.csv

Rules (baseline = calendar 2019):
  demand_up_20pct        T12M overnight demand >= 1.20 x 2019 overnight demand
  demand_record_high     latest T12M overnight demand is the series maximum
  cf_share_down_3pts     T12M overnight carbon-free share <= 2019 share - 0.03   (BAs)
  gas_share_up_3pts_yoy  T12M overnight gas share - value 12 months earlier >= 0.03   (BAs)
  clean_mw_below_2019    T12M overnight clean MW <= 0.98 x 2019 overnight clean MW   (BAs)
  detector_top10         detector rank <= 10 with pattern "flat-load growth" (static)

Only regions the detector scored (>= 500 MW, full coverage) are evaluated; regions
with a data flag (see export_json.DATA_FLAGS) are excluded from alerts. Series start
2018-07 for zones and BAs alike; partial months (the snapshot ends 2026-09-05) are
dropped, so the latest window ends 2026-08. For the record-high rule "first crossed"
is the month the current run of new highs began. The share rules need a 2019 baseline
of at least 5% (share) or 100 MW (clean MW) to avoid degenerate alerts.
Output: dashboard/public/data/alerts.json
"""
import json
from datetime import date
from pathlib import Path
import numpy as np
import pandas as pd
from l3_detector import load_demand, localize, NIGHT

PROCESSED = Path("data/processed")
OUT = Path("dashboard/public/data/alerts.json")
RULES = {
    "demand_up_20pct": "Overnight demand (trailing 12 months) at least 20% above 2019",
    "demand_record_high": "Overnight demand (trailing 12 months) at an all-time high",
    "cf_share_down_3pts": "Overnight carbon-free share (trailing 12 months) at least 3 points below 2019",
    "gas_share_up_3pts_yoy": "Overnight gas share (trailing 12 months) up at least 3 points year over year",
    "clean_mw_below_2019": "Overnight clean generation (trailing 12 months) at least 2% below 2019",
    "detector_top10": "Flat-load detector: top 10 with pattern 'flat-load growth'",
}


def t12(monthly: pd.DataFrame, keys, num, den):
    monthly = monthly.sort_values(keys + ["month"])
    roll = monthly.groupby(keys)[[num, den]].rolling(12, min_periods=12).sum().reset_index(level=list(range(len(keys))), drop=True)
    monthly = monthly.assign(v=roll[num] / roll[den])
    return monthly.dropna(subset=["v"])


def evaluate(series: pd.Series, cond: pd.Series):
    """series indexed by month (sorted). Returns first crossed, active, streak."""
    if cond.empty:
        return None
    months = list(series.index)
    first = next((m for m, c in zip(months, cond) if c), None)
    active = bool(cond.iloc[-1])
    streak = 0
    for c in reversed(list(cond)):
        if not c:
            break
        streak += 1
    return {"first_crossed": first, "active": active, "months_active_streak": streak, "latest_month": months[-1], "current_value": float(series.iloc[-1])}


def main():
    regions = json.load(open("dashboard/public/data/regions.json"))["regions"]
    excluded = {x["id"] for x in regions if x.get("exclude_from_alerts")}
    scored = {x["id"] for x in regions if x.get("detection")}
    det = {x["id"]: x["detection"] for x in regions if x.get("detection")}
    names = {x["id"]: x["name"] for x in regions}
    codes = pd.read_parquet("data/pudl/core_eia__codes_balancing_authorities.parquet")
    ry = pd.read_csv(PROCESSED / "l3_region_year.csv")
    base = ry[(ry.window == "calendar") & (ry.year == 2019)].set_index("region")

    # demand T12M per region
    d = load_demand()
    d = localize(d[d.datetime_utc >= "2018-07-01"], codes)   # same history for zones and BAs
    d = d[d.local_hour.isin(NIGHT) & d.region.isin(scored - excluded)]
    d["month"] = d.year.astype(str) + "-" + d.month.astype(str).str.zfill(2)
    m = d.groupby(["region", "month"]).agg(mwh=("demand_mwh", "sum"), hours=("demand_mwh", "count")).reset_index()
    m = m[m.hours >= 0.9 * 6 * pd.to_datetime(m.month + "-01").dt.days_in_month]   # drop partial months
    dem = t12(m, ["region"], "mwh", "hours")

    alerts = []
    for region, g in dem.groupby("region"):
        s = g.set_index("month").v
        b = base.overnight_avg_mw.get(region)
        if b and b > 0:
            e = evaluate(s, s >= 1.2 * b)
            if e and e["first_crossed"]:
                alerts.append({"region": region, "rule": "demand_up_20pct", "threshold": round(1.2 * b), "baseline_2019": round(b), "unit": "MW", **e})
        rec = s.expanding().max()
        is_new_high = (s >= rec) & (s.index >= s.index[min(23, len(s) - 1)])
        e = evaluate(s, is_new_high)
        if e and e["active"]:
            # for a record rule "first crossed" = the month the current run of new highs began
            e["first_crossed"] = list(s.index)[-e["months_active_streak"]]
            alerts.append({"region": region, "rule": "demand_record_high", "threshold": None, "baseline_2019": round(b) if b else None, "unit": "MW",
                           "new_highs_last_12_months": int(is_new_high.tail(12).sum()), **e})

    # BA carbon-free and clean MW
    t = pd.read_csv(PROCESSED / "l2_trailing12.csv")
    t = t[(t.period == "overnight") & t.ba.isin(scored - excluded)]
    l2 = pd.read_csv(PROCESSED / "l2_cf_by_period.csv")
    b2 = l2[(l2.window == "calendar") & (l2.year == 2019) & (l2.period == "overnight")].set_index("ba")
    for ba, g in t.groupby("ba"):
        g = g.sort_values("month").set_index("month")
        if ba not in b2.index:
            continue
        bs, bm = b2.cf_share[ba], b2.cf_avg_mw[ba]
        e = evaluate(g.cf_share, g.cf_share <= bs - 0.03) if bs >= 0.05 else None   # needs a real baseline
        if e and e["first_crossed"]:
            alerts.append({"region": ba, "rule": "cf_share_down_3pts", "threshold": round(bs - 0.03, 3), "baseline_2019": round(bs, 3), "unit": "share", **e})
        e = evaluate(g.cf_avg_mw, g.cf_avg_mw <= 0.98 * bm) if bm >= 100 else None
        if e and e["first_crossed"]:
            alerts.append({"region": ba, "rule": "clean_mw_below_2019", "threshold": round(0.98 * bm), "baseline_2019": round(bm), "unit": "MW", **e})

    # BA gas share YoY
    f = pd.read_csv(PROCESSED / "l4_overnight_fuel_monthly.csv")
    f = f[f.ba.isin(scored - excluded)]
    tot = f.groupby(["ba", "month"]).mwh.sum(min_count=1).rename("total").reset_index()
    gas = f[f.fuel == "gas"][["ba", "month", "mwh"]].rename(columns={"mwh": "gas"})
    gm = tot.merge(gas, on=["ba", "month"], how="left").fillna({"gas": 0})
    gs = t12(gm, ["ba"], "gas", "total")
    for ba, g in gs.groupby("ba"):
        s = g.set_index("month").v
        yoy = s - s.shift(12)
        e = evaluate(s, yoy >= 0.03)
        if e and e["first_crossed"]:
            e["current_value_yoy_delta"] = float(yoy.iloc[-1]) if pd.notna(yoy.iloc[-1]) else None
            alerts.append({"region": ba, "rule": "gas_share_up_3pts_yoy", "threshold": 0.03, "baseline_2019": None, "unit": "share", **e})

    # static detector alerts
    for rid, dd in det.items():
        if rid in excluded:
            continue
        if dd["rank"] <= 10 and dd["pattern"] == "flat-load growth":
            alerts.append({"region": rid, "rule": "detector_top10", "threshold": 10, "baseline_2019": None, "unit": "rank", "first_crossed": None, "active": True,
                           "months_active_streak": None, "latest_month": None, "current_value": dd["rank"], "growth_pct": dd["growth_pct"], "score": dd["score"]})

    for a in alerts:
        a["name"] = names.get(a["region"], a["region"])
        a["description"] = RULES[a["rule"]]
    alerts.sort(key=lambda a: (not a["active"], a["rule"], -(a["current_value"] or 0)))
    OUT.write_text(json.dumps({"generated": date.today().isoformat(), "latest_month": str(dem.month.max()), "rules": RULES,
                               "excluded_regions": sorted(excluded), "alerts": alerts}, indent=None))
    act = [a for a in alerts if a["active"]]
    print(f"{len(alerts)} alerts, {len(act)} active, latest month {dem.month.max()}")
    print(pd.DataFrame(act)[["region", "rule", "first_crossed", "months_active_streak", "current_value", "threshold"]].to_string(index=False))


if __name__ == "__main__":
    main()
