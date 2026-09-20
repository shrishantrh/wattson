"""Pull hourly dry-bulb temperature from NOAA ISD and put it on the detector's clock.

Source
    s3://noaa-global-hourly-pds/<year>/<USAF><WBAN>.csv   (public, anonymous)
    registry: https://registry.opendata.aws/noaa-isd/

Only the stations named in `engine.weather.stations` are fetched, only for the
years the analysis needs. ISD as a whole is about 600 GB; this pulls single
station-years, streams each one, keeps five columns, and throws the rest away.

Observation filter
    TMP is "+0078,1": tenths of a degree Celsius, then a quality code.
    * value "+9999" is ISD's missing marker and is dropped.
    * quality codes kept: 0, 1, 4, 5, 9 (passed gross limits / passed all checks
      / no QC applied). Codes 2, 3, 6, 7 are ISD's "suspect" and "erroneous" and
      are dropped.
    * REPORT_TYPE SOD and SOM are daily and monthly summaries, not observations,
      and are dropped. FM-16 (SPECI) is dropped too: SPECI reports are triggered
      by changing conditions, so keeping them would weight unsettled hours more
      heavily than calm ones. FM-12 (SYNOP) and FM-15 (METAR) are kept.
    Surviving observations inside one clock hour are averaged.

Local time
    ISD timestamps are UTC. Each region is localized with the SAME IANA zone the
    frozen detector uses for its demand, `report_timezone` from
    core_eia__codes_balancing_authorities. The weather hour and the demand hour
    are therefore the same hour by construction.

Gaps
    Missing station-hours are normal. A region with several anchors averages over
    whichever of them reported. A region-hour with nothing at all is then linearly
    interpolated across gaps of at most MAX_INTERP_HOURS; anything longer stays
    missing and is excluded from every mean, and counted in the coverage report.
"""
from __future__ import annotations

import io
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import pandas as pd

from .stations import ISD_BUCKET, REPO

CACHE = REPO / "data" / "weather"
GOOD_QUALITY = {"0", "1", "4", "5", "9"}
DROP_REPORT_TYPES = {"SOD", "SOM", "FM-16"}
MAX_INTERP_HOURS = 6
USECOLS = ["STATION", "DATE", "REPORT_TYPE", "TMP", "LATITUDE", "LONGITUDE", "NAME"]


def _client():
    import boto3
    from botocore import UNSIGNED
    from botocore.client import Config
    return boto3.client("s3", config=Config(signature_version=UNSIGNED,
                                            max_pool_connections=32))


def fetch_station_year(station_id: str, year: int, s3=None) -> pd.DataFrame | None:
    """One station-year, reduced to hourly mean temperature in UTC.

    Returns columns station_id, datetime_utc, temp_c, n_obs. None if the key is
    absent (a station that did not report that year).
    """
    s3 = s3 or _client()
    key = f"{year}/{station_id}.csv"
    try:
        body = s3.get_object(Bucket=ISD_BUCKET, Key=key)["Body"].read()
    except Exception:
        return None
    df = pd.read_csv(io.BytesIO(body), usecols=lambda c: c in USECOLS,
                     dtype=str, low_memory=False)
    if df.empty or "TMP" not in df.columns:
        return None
    df = df[~df.REPORT_TYPE.str.strip().isin(DROP_REPORT_TYPES)]
    parts = df.TMP.str.split(",", n=1, expand=True)
    val, qc = parts[0].str.strip(), parts[1].str.strip()
    ok = (val != "+9999") & qc.isin(GOOD_QUALITY)
    df = df[ok]
    if df.empty:
        return None
    temp_c = pd.to_numeric(val[ok], errors="coerce") / 10.0
    ts = pd.to_datetime(df.DATE, errors="coerce", format="ISO8601").dt.floor("h")
    out = pd.DataFrame({"datetime_utc": ts, "temp_c": temp_c}).dropna()
    out = out[(out.temp_c > -80) & (out.temp_c < 60)]          # physical sanity
    g = out.groupby("datetime_utc").temp_c.agg(["mean", "size"])
    return pd.DataFrame({"station_id": station_id,
                         "datetime_utc": g.index,
                         "temp_c": g["mean"].to_numpy(),
                         "n_obs": g["size"].to_numpy()})


def fetch_all(station_ids: list[str], years: list[int], workers: int = 12,
              verbose: bool = True) -> pd.DataFrame:
    """Every station-year, cached to data/weather/isd_hourly_<years>.parquet."""
    tag = f"{min(years)}_{max(years)}_{len(years)}y"
    cache = CACHE / f"isd_hourly_{tag}.parquet"
    if cache.exists():
        d = pd.read_parquet(cache)
        have = set(d.station_id.unique())
        if set(station_ids) <= have:
            if verbose:
                print(f"[weather] cache hit {cache.name}: {len(d):,} station-hours, "
                      f"{d.station_id.nunique()} stations")
            return d[d.station_id.isin(station_ids)]

    jobs = [(sid, y) for sid in station_ids for y in years]
    t0 = time.time()
    s3 = _client()
    frames, misses = [], []

    def one(job):
        sid, y = job
        return job, fetch_station_year(sid, y, s3)

    with ThreadPoolExecutor(max_workers=workers) as ex:
        for i, (job, df) in enumerate(ex.map(one, jobs), 1):
            if df is None:
                misses.append(job)
            else:
                frames.append(df)
            if verbose and i % 50 == 0:
                print(f"[weather] {i}/{len(jobs)} station-years, "
                      f"{time.time() - t0:.0f}s elapsed", flush=True)

    d = pd.concat(frames, ignore_index=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    d.to_parquet(cache, index=False)
    if verbose:
        print(f"[weather] fetched {len(jobs)} station-years in {time.time() - t0:.0f}s; "
              f"{len(misses)} absent; {len(d):,} station-hours -> {cache}")
        if misses:
            print(f"[weather] absent station-years: {sorted(misses)[:20]}")
    return d


def region_hourly(hourly: pd.DataFrame, assigned: dict[str, list[str]],
                  tz_by_region: dict[str, str]) -> pd.DataFrame:
    """Average the anchors of each region and localize to the detector's clock.

    Output: region, datetime_utc, temp_c, local_hour, year, month, n_stations.
    """
    sid_to_regions: dict[str, list[str]] = {}
    for region, ids in assigned.items():
        for sid in ids:
            sid_to_regions.setdefault(sid, []).append(region)

    wide = hourly.pivot_table(index="datetime_utc", columns="station_id",
                              values="temp_c", aggfunc="mean").sort_index()
    # a dense hourly index so gaps are explicit rather than absent rows
    full = pd.date_range(wide.index.min(), wide.index.max(), freq="h")
    wide = wide.reindex(full)

    out = []
    for region, ids in assigned.items():
        cols = [c for c in ids if c in wide.columns]
        if not cols:
            continue
        sub = wide[cols]
        temp = sub.mean(axis=1, skipna=True)
        n_st = sub.notna().sum(axis=1)
        raw_missing = int(temp.isna().sum())
        temp = temp.interpolate(method="linear", limit=MAX_INTERP_HOURS,
                                limit_direction="both", limit_area="inside")
        tz = tz_by_region.get(region)
        if tz is None:
            continue
        local = temp.index.tz_localize("UTC").tz_convert(tz)
        out.append(pd.DataFrame({
            "region": region, "datetime_utc": temp.index, "temp_c": temp.to_numpy(),
            "local_hour": local.hour, "year": local.year, "month": local.month,
            "n_stations": n_st.to_numpy(), "raw_missing_hours": raw_missing,
        }))
    return pd.concat(out, ignore_index=True)


def coverage(region_hours: pd.DataFrame, years: list[int],
             month_max: int, day_max: dict[int, int] | None = None) -> pd.DataFrame:
    """Per region and year: hours present out of hours possible in the window."""
    rows = []
    for (region, year), g in region_hours[region_hours.year.isin(years)].groupby(
            ["region", "year"], observed=True):
        g = g[g.month <= month_max]
        if day_max:
            keep = g.datetime_utc.dt.dayofyear <= day_max.get(year, 366)
            g = g[keep]
        rows.append({"region": region, "year": year, "hours_present": int(g.temp_c.notna().sum()),
                     "hours_slots": int(len(g)),
                     "frac": float(g.temp_c.notna().mean()) if len(g) else np.nan})
    return pd.DataFrame(rows)
