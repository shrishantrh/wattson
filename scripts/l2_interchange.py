"""L2: PJM net interchange by year, overnight and all hours, by partner.

Sign convention (EIA-930): interchange is reported from the perspective of the
reporting BA, POSITIVE = power flowing OUT of PJM (export), NEGATIVE = import.
Verified below against the identity demand = net generation - net interchange
in out_eia930__hourly_operations.

Sources:
  core_eia930__hourly_interchange   one row per (hour, BA, adjacent BA), reported only.
                                    UNRELIABLE before 2020 for PJM: the PJM-MISO tie is
                                    reported with the opposite sign (2019 mean -4.2 GW,
                                    2020 mean +7.5 GW) and the partner sum correlates only
                                    0.45 with EIA's adjusted net. Used for the by-partner
                                    breakdown from 2020 on, with that caveat.
  out_eia930__hourly_operations     BA net interchange, EIA-adjusted. This is the headline
                                    series; it closes the generation - interchange = demand
                                    identity to a 7 MW median residual.

Output: data/processed/l2_pjm_interchange.csv
"""
from pathlib import Path
import pandas as pd

PROCESSED = Path("data/processed")
TZ = "America/New_York"
NIGHT = range(0, 6)

if __name__ == "__main__":
    pd.set_option("display.width", 220); pd.set_option("display.max_columns", 30)
    ic = pd.read_parquet("data/pudl/core_eia930__hourly_interchange.parquet")
    ic = ic[ic.balancing_authority_code_eia == "PJM"].rename(columns={"balancing_authority_code_adjacent_eia": "partner", "interchange_reported_mwh": "mwh"})
    ic = ic[ic.datetime_utc >= "2018-07-01"]
    ops = pd.read_parquet("data/pudl/out_eia930__hourly_operations.parquet")
    ops = ops[(ops.balancing_authority_code_eia == "PJM") & (ops.datetime_utc >= "2018-07-01")].set_index("datetime_utc")

    # 1. data quality per partner
    print("per-partner quantiles of hourly reported interchange (MW):")
    qq = ic.groupby("partner").mwh.describe(percentiles=[.001, .01, .5, .99, .999])[["count", "0.1%", "1%", "50%", "99%", "99.9%", "min", "max"]]
    print(qq.round(0).to_string())

    # 2. sign check on the operations table: demand ?= generation - interchange
    o = ops[["net_generation_adjusted_mwh", "interchange_adjusted_mwh", "demand_adjusted_mwh", "demand_imputed_pudl_mwh"]].dropna()
    resid = o.net_generation_adjusted_mwh - o.interchange_adjusted_mwh - o.demand_adjusted_mwh
    print(f"\nidentity gen - interchange - demand: median |resid| = {resid.abs().median():.1f} MW over {len(o):,} hours "
          f"(mean gen {o.net_generation_adjusted_mwh.mean():,.0f}, demand {o.demand_adjusted_mwh.mean():,.0f}, interchange {o.interchange_adjusted_mwh.mean():+,.0f})")
    print("=> positive interchange = PJM exporting (generation exceeds demand)")

    # 3. partner sum vs operations net, with obvious garbage removed (|x| > 15 GW on a single tie group is not physical)
    clean = ic[ic.mwh.abs() <= 15000]
    print(f"\ndropped {len(ic) - len(clean):,} partner-hours with |interchange| > 15,000 MW")
    net_partner = clean.groupby("datetime_utc").mwh.sum(min_count=1).rename("partner_sum")
    cmp = pd.concat([net_partner, ops.interchange_adjusted_mwh.rename("ops_adjusted"), ops.interchange_reported_mwh.rename("ops_reported")], axis=1, sort=True).dropna()
    print(f"partner sum vs operations adjusted: corr {cmp.partner_sum.corr(cmp.ops_adjusted):.3f}, median |diff| {(cmp.partner_sum - cmp.ops_adjusted).abs().median():.0f} MW, "
          f"hours differing > 1 GW: {((cmp.partner_sum - cmp.ops_adjusted).abs() > 1000).sum():,} of {len(cmp):,}")

    # 4. by year, overnight (00-05 ET) and all hours
    local = cmp.index.tz_localize("UTC").tz_convert(TZ)
    cmp = cmp.assign(year=local.year, night=local.hour.isin(NIGHT))
    part = clean.assign(local=clean.datetime_utc.dt.tz_localize("UTC").dt.tz_convert(TZ))
    part = part.assign(year=part.local.dt.year, night=part.local.dt.hour.isin(NIGHT))

    rows = []
    for label, mask_fn in [("overnight", lambda x: x.night), ("all_hours", lambda x: x.night | ~x.night)]:
        c = cmp[mask_fn(cmp)].groupby("year").agg(net_export_mw=("ops_adjusted", "mean"), partner_sum_mw=("partner_sum", "mean"), hours=("ops_adjusted", "count"))
        p = part[mask_fn(part)].groupby(["year", "partner"]).mwh.mean().unstack("partner")
        t = c.join(p).assign(period=label)
        rows.append(t)
    out = pd.concat(rows).reset_index()
    out.to_csv(PROCESSED / "l2_pjm_interchange.csv", index=False)

    partners = sorted(part.partner.unique())
    for label in ["overnight", "all_hours"]:
        t = out[out.period == label].set_index("year")[["net_export_mw", "partner_sum_mw", "hours"] + partners]
        print(f"\nPJM net interchange, {label}, average MW, positive = export from PJM (2018 = Jul-Dec, 2026 = Jan-Sep 5):")
        print(t.round(0).to_string())
