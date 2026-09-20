"""Cross-check for the curated station anchors: where is the region's iron?

This computes a capacity-weighted centroid of the EIA-860 plants assigned to each
region and reports how far the curated anchor sits from it. It is a CHECK, not
the assignment rule. A generation centroid is not a load centroid: LADWP's plants
are in Utah and Arizona, Seattle City Light's are on the Skagit River, and the
customers are not. A large anchor-to-centroid distance flags exactly that, and
is reported in docs/WEATHER.md rather than quietly corrected.

Balancing authorities take every plant carrying their BA code. Subregions named
after a utility take the plants in the parent BA whose transmission and
distribution owner matches the pattern below; the patterns were read off the
utility names that actually appear in EIA-860, not invented. Subregions named
after a geography (ERCOT weather zones, MISO local resource zones, ISO-NE states,
NYISO zones) have no utility to match on and get no centroid: their entry is
`null`, and the write-up says so.
"""
from __future__ import annotations

import re

import numpy as np
import pandas as pd

from .stations import REPO, haversine_km

PUDL = REPO / "data" / "pudl"
CENTROID_YEAR = 2023          # most recent EIA-860 year with full plant coverage

#: subregion -> regex over transmission_distribution_owner_name, within the parent BA.
ZONE_TD_OWNER = {
    "CISO/PGAE": r"Pacific Gas",
    "CISO/SCE":  r"Southern California Edison",
    "CISO/SDGE": r"San Diego Gas",
    "PJM/AE":    r"Atlantic City Electric",
    "PJM/AEP":   r"Ohio Power|Appalachian Power|Indiana Michigan Power|Kingsport Power|Wheeling Power",
    "PJM/AP":    r"West Penn Power|Potomac Edison|Monongahela Power",
    "PJM/ATSI":  r"American Transmission Systems|Ohio Edison|Cleveland Electric|Toledo Edison",
    "PJM/BC":    r"Baltimore Gas",
    "PJM/CE":    r"Commonwealth Edison",
    "PJM/DAY":   r"Dayton Power|AES Ohio",
    "PJM/DEOK":  r"Duke Energy Ohio|Duke Energy Kentucky",
    "PJM/DOM":   r"Virginia Electric",
    "PJM/DPL":   r"Delmarva",
    "PJM/DUQ":   r"Duquesne Light",
    "PJM/EKPC":  r"East Kentucky Power",
    "PJM/JC":    r"Jersey Central",
    "PJM/ME":    r"Metropolitan Edison",
    "PJM/PE":    r"PECO Energy",
    "PJM/PEP":   r"Potomac Electric Power",
    "PJM/PL":    r"PPL Electric|Pennsylvania Power & Light",
    "PJM/PN":    r"Pennsylvania Electric",
    "PJM/PS":    r"Public Service Elec",
    "PNM/PNM":   r"Public Service Co of NM",
    "SWPP/CSWS": r"Public Service Co of Oklahoma|Southwestern Electric Power",
    "SWPP/EDE":  r"Empire District",
    "SWPP/GRDA": r"Grand River Dam",
    "SWPP/KCPL": r"Kansas City Power|Evergy Metro",
    "SWPP/NPPD": r"Nebraska Public Power",
    "SWPP/OKGE": r"Oklahoma Gas",
    "SWPP/OPPD": r"Omaha Public Power",
    "SWPP/SECI": r"Sunflower Electric",
    "SWPP/SPS":  r"Southwestern Public Service",
    "SWPP/WFEC": r"Western Farmers",
    "SWPP/WR":   r"Westar Energy|Kansas Gas & Electric|Evergy Kansas Central",
}


def plants() -> pd.DataFrame:
    p = pd.read_parquet(PUDL / "out_eia__yearly_plants.parquet",
                        columns=["plant_id_eia", "report_date", "latitude", "longitude",
                                 "balancing_authority_code_eia",
                                 "transmission_distribution_owner_name"])
    p["year"] = pd.to_datetime(p.report_date).dt.year
    p = p[(p.year == CENTROID_YEAR)].dropna(subset=["latitude", "longitude"])
    g = pd.read_parquet(PUDL / "out_eia__yearly_generators.parquet",
                        columns=["plant_id_eia", "report_date", "capacity_mw",
                                 "operational_status"])
    g["year"] = pd.to_datetime(g.report_date).dt.year
    g = g[(g.year == CENTROID_YEAR) & (g.operational_status == "existing")]
    cap = g.groupby("plant_id_eia").capacity_mw.sum().rename("capacity_mw")
    return p.merge(cap, left_on="plant_id_eia", right_index=True, how="left").fillna(
        {"capacity_mw": 0.0})


def centroids(regions: list[str]) -> pd.DataFrame:
    """Capacity-weighted plant centroid per region, where one can be derived."""
    p = plants()
    rows = []
    for region in regions:
        if "/" in region:
            ba = region.split("/")[0]
            pat = ZONE_TD_OWNER.get(region)
            if pat is None:
                rows.append({"region": region, "centroid_lat": np.nan,
                             "centroid_lon": np.nan, "centroid_plants": 0,
                             "centroid_capacity_mw": np.nan,
                             "centroid_source": "none (geographic subregion)"})
                continue
            q = p[(p.balancing_authority_code_eia == ba)
                  & p.transmission_distribution_owner_name.fillna("").str.contains(
                      pat, flags=re.I, regex=True)]
            src = "EIA-860 plants of the named utility"
        else:
            q = p[p.balancing_authority_code_eia == region]
            src = "EIA-860 plants carrying the BA code"
        if q.empty or q.capacity_mw.sum() <= 0:
            rows.append({"region": region, "centroid_lat": np.nan, "centroid_lon": np.nan,
                         "centroid_plants": int(len(q)), "centroid_capacity_mw": np.nan,
                         "centroid_source": "none (no matching plants)"})
            continue
        w = q.capacity_mw.to_numpy()
        rows.append({
            "region": region,
            "centroid_lat": float(np.average(q.latitude, weights=w)),
            "centroid_lon": float(np.average(q.longitude, weights=w)),
            "centroid_plants": int(len(q)),
            "centroid_capacity_mw": float(w.sum()),
            "centroid_source": src,
        })
    return pd.DataFrame(rows)


def anchor_distances(station_table: pd.DataFrame, cent: pd.DataFrame) -> pd.DataFrame:
    """Per region: the anchor stations, their mean position, and the km to the centroid."""
    a = station_table.groupby("region").agg(
        stations=("station_id", lambda s: ",".join(sorted(s))),
        icaos=("icao", lambda s: ",".join(s)),
        n_stations=("station_id", "size"),
        anchor_lat=("lat", "mean"), anchor_lon=("lon", "mean"),
    ).reset_index()
    m = a.merge(cent, on="region", how="left")
    m["anchor_to_centroid_km"] = [
        haversine_km(r.anchor_lat, r.anchor_lon, r.centroid_lat, r.centroid_lon)
        if pd.notna(r.centroid_lat) else np.nan for r in m.itertuples()]
    # spread of the anchors themselves: how much climate does the average cover?
    spread = []
    for region, g in station_table.groupby("region"):
        if len(g) < 2:
            spread.append((region, 0.0))
            continue
        pts = list(zip(g.lat, g.lon))
        spread.append((region, max(haversine_km(*a1, *a2)
                                   for i, a1 in enumerate(pts) for a2 in pts[i + 1:])))
    m = m.merge(pd.DataFrame(spread, columns=["region", "anchor_spread_km"]), on="region")
    return m
