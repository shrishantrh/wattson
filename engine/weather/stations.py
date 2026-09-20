"""Region -> NOAA ISD weather station assignment.

Every one of the 111 scored regions gets a hand-curated list of anchor airports,
given as ICAO identifiers. The ICAO code is the only hand-entered value: the USAF
/ WBAN station id, the latitude, the longitude and the period of record all come
from NOAA's own `isd-history.csv`, fetched at run time. Nothing here is invented.

Why hand-curated and not a computed centroid
--------------------------------------------
The obvious automatic rule is "capacity-weighted centroid of the EIA-860 plants
in the region, then nearest airport". It is wrong for importing regions. LADWP
(LDWP) owns Intermountain Power in Utah and a share of Navajo in Arizona; its
generation centroid lands in the Mojave, hundreds of km from the load it serves.
Seattle City Light's centroid sits at its Skagit River dams. The load is in the
city; the plants are not.

So the anchors are picked from the published footprint of each balancing
authority or subregion, and the plant centroid is computed anyway and reported
as a CROSS-CHECK (`engine.weather.geo`). Where anchor and generation centroid
disagree sharply that is reported, not hidden: it is a real property of the
region, not a defect of the mapping.

Curation rules, applied before any weather data was pulled:
  * large, continuously reporting primary airports (ASOS at a Part-139 field);
  * one anchor for a compact region, several averaged for a region that spans
    more than about one climate zone (PJM, MISO, ERCOT as a whole, SOCO, TVA);
  * for a subregion named after a utility, the airport serving that utility's
    load center (PJM/DOM -> Washington Dulles + Richmond, not "somewhere in PJM");
  * for a subregion named after a geography (ERCOT weather zones, MISO local
    resource zones, ISO-NE states, NYISO zones), the airport in that area.

A region whose anchors cannot be resolved in isd-history, or whose stations fail
the coverage test in `engine.weather.fetch`, is DROPPED and COUNTED. It is never
back-filled with a guess.
"""
from __future__ import annotations

import math
from pathlib import Path

import pandas as pd

REPO = Path(__file__).resolve().parents[2]
ISD_HISTORY_URL = "https://www.ncei.noaa.gov/pub/data/noaa/isd-history.csv"
ISD_HISTORY_LOCAL = REPO / "data" / "weather" / "isd-history.csv"
ISD_BUCKET = "noaa-global-hourly-pds"

#: Anchors must cover these years for the region to be usable.
REQUIRE_BEGIN_BY = 20180101
REQUIRE_END_AFTER = 20250801

# ---------------------------------------------------------------------------
# balancing authorities (43 scored)
# ---------------------------------------------------------------------------
BA_ANCHORS: dict[str, list[str]] = {
    "AECI": ["KSGF", "KCOU"],            # Associated Electric Coop, Missouri
    "AVA":  ["KGEG"],                    # Avista, Spokane
    "AZPS": ["KPHX", "KFLG"],            # Arizona Public Service
    "BANC": ["KSMF"],                    # Balancing Authority of Northern California
    "BPAT": ["KPDX", "KGEG"],            # Bonneville Power Administration
    "CISO": ["KLAX", "KSFO", "KFAT"],    # California ISO
    "CPLE": ["KRDU", "KILM"],            # Duke Energy Progress East
    "CPLW": ["KAVL"],                    # Duke Energy Progress West
    "DUK":  ["KCLT", "KGSP"],            # Duke Energy Carolinas
    "EPE":  ["KELP"],                    # El Paso Electric
    "ERCO": ["KDFW", "KIAH", "KAUS"],    # ERCOT
    "FMPP": ["KMCO"],                    # Florida Municipal Power Pool
    "FPC":  ["KTPA", "KGNV"],            # Duke Energy Florida
    "FPL":  ["KMIA", "KPBI"],            # Florida Power & Light
    "GCPD": ["KMWH"],                    # Grant County PUD, Washington
    "IPCO": ["KBOI"],                    # Idaho Power
    "ISNE": ["KBOS", "KBDL"],            # ISO New England
    "JEA":  ["KJAX"],                    # Jacksonville Electric Authority
    "LDWP": ["KBUR", "KLAX"],            # LA Dept of Water & Power (city load, not its plants)
    "LGEE": ["KSDF", "KLEX"],            # Louisville Gas & Electric / Kentucky Utilities
    "MISO": ["KMSP", "KIND", "KSTL", "KJAN"],   # MISO, Manitoba border to the Gulf
    "NEVP": ["KLAS"],                    # Nevada Power
    "NWMT": ["KBIL", "KHLN"],            # NorthWestern Energy, Montana
    "NYIS": ["KLGA", "KALB", "KBUF"],    # NYISO
    "PACE": ["KSLC", "KCPR"],            # PacifiCorp East
    "PACW": ["KPDX", "KMFR"],            # PacifiCorp West
    "PGE":  ["KPDX"],                    # Portland General Electric
    "PJM":  ["KORD", "KPIT", "KIAD", "KPHL"],   # PJM, Chicago to New Jersey
    "PNM":  ["KABQ"],                    # Public Service Company of New Mexico
    "PSCO": ["KDEN"],                    # Public Service Company of Colorado
    "PSEI": ["KSEA"],                    # Puget Sound Energy
    "SC":   ["KCHS"],                    # South Carolina Public Service Authority
    "SCEG": ["KCAE"],                    # Dominion Energy South Carolina
    "SCL":  ["KSEA"],                    # Seattle City Light (city load, not its dams)
    "SOCO": ["KATL", "KBHM"],            # Southern Company
    "SRP":  ["KPHX"],                    # Salt River Project
    "SWPP": ["KOKC", "KICT", "KOMA"],    # Southwest Power Pool
    "TEC":  ["KTPA"],                    # Tampa Electric
    "TEPC": ["KTUS"],                    # Tucson Electric Power
    "TPWR": ["KTIW", "KSEA"],            # Tacoma Power
    "TVA":  ["KBNA", "KMEM", "KCHA"],    # Tennessee Valley Authority
    "WACM": ["KDEN", "KGJT"],            # WAPA Rocky Mountain Region
    "WALC": ["KPHX", "KLAS"],            # WAPA Desert Southwest
}

# ---------------------------------------------------------------------------
# subregions (68 scored)
# ---------------------------------------------------------------------------
ZONE_ANCHORS: dict[str, list[str]] = {
    # --- CISO: named utilities -------------------------------------------
    "CISO/PGAE": ["KSFO", "KFAT"],       # Pacific Gas and Electric
    "CISO/SCE":  ["KLAX", "KONT"],       # Southern California Edison
    "CISO/SDGE": ["KSAN"],               # San Diego Gas and Electric

    # --- ERCOT weather zones ---------------------------------------------
    "ERCO/COAS": ["KIAH", "KHOU"],       # Coast (Houston)
    "ERCO/EAST": ["KTYR", "KGGG"],       # East (Tyler / Longview)
    "ERCO/FWES": ["KMAF"],               # Far West (Permian Basin)
    "ERCO/NCEN": ["KDFW"],               # North Central (Dallas-Fort Worth)
    "ERCO/NRTH": ["KSPS"],               # North (Wichita Falls)
    "ERCO/SCEN": ["KAUS", "KSAT"],       # South Central (Austin / San Antonio)
    "ERCO/SOUT": ["KCRP"],               # South (Corpus Christi)
    "ERCO/WEST": ["KABI", "KSJT"],       # West (Abilene / San Angelo)

    # --- ISO-NE: one state each ------------------------------------------
    "ISNE/4001": ["KPWM"],               # Maine
    "ISNE/4002": ["KMHT"],               # New Hampshire
    "ISNE/4003": ["KBTV"],               # Vermont
    "ISNE/4004": ["KBDL"],               # Connecticut
    "ISNE/4005": ["KPVD"],               # Rhode Island
    "ISNE/4006": ["KEWB"],               # Southeast Massachusetts
    "ISNE/4007": ["KORH"],               # Western / Central Massachusetts
    "ISNE/4008": ["KBOS"],               # Northeast Massachusetts

    # --- MISO local resource zones ---------------------------------------
    "MISO/0001": ["KMSP", "KFAR"],       # Zone 1: Minnesota and the Dakotas
    "MISO/0004": ["KSPI", "KMDH"],       # Zone 4: Illinois
    "MISO/0006": ["KIND", "KEVV"],       # Zone 6: Indiana
    "MISO/0027": ["KMKE", "KDTW"],       # Zones 2 and 7: Wisconsin and Michigan
    "MISO/0035": ["KDSM", "KSTL"],       # Zones 3 and 5: Iowa and Missouri
    "MISO/8910": ["KLIT", "KBTR", "KJAN"],  # Zones 8, 9, 10: AR, LA/TX, MS

    # --- NYISO zones ------------------------------------------------------
    "NYIS/ZONA": ["KBUF"],               # West
    "NYIS/ZONB": ["KROC"],               # Genesee
    "NYIS/ZONC": ["KSYR"],               # Central
    "NYIS/ZOND": ["KMSS", "KPBG"],       # North
    "NYIS/ZONE": ["KRME", "KUCA"],       # Mohawk Valley
    "NYIS/ZONF": ["KALB"],               # Capital
    "NYIS/ZONG": ["KPOU"],               # Hudson Valley
    "NYIS/ZONI": ["KHPN"],               # Dunwoodie (Westchester)
    "NYIS/ZONJ": ["KLGA", "KJFK"],       # New York City
    "NYIS/ZONK": ["KISP"],               # Long Island

    # --- PJM: named transmission zones -----------------------------------
    "PJM/AE":   ["KACY"],                # Atlantic City Electric
    "PJM/AEP":  ["KCMH", "KCRW", "KFWA"],  # American Electric Power (OH, WV, IN)
    "PJM/AP":   ["KCKB", "KLBE"],        # Allegheny Power (WV / western PA)
    "PJM/ATSI": ["KCLE", "KTOL", "KAKR"],  # FirstEnergy Ohio
    "PJM/BC":   ["KBWI"],                # Baltimore Gas & Electric
    "PJM/CE":   ["KORD", "KMDW"],        # Commonwealth Edison
    "PJM/DAY":  ["KDAY"],                # Dayton Power & Light
    "PJM/DEOK": ["KCVG"],                # Duke Energy Ohio / Kentucky
    "PJM/DOM":  ["KIAD", "KRIC"],        # Dominion Virginia Power
    "PJM/DPL":  ["KILG", "KSBY"],        # Delmarva Power & Light
    "PJM/DUQ":  ["KPIT"],                # Duquesne Light
    "PJM/EKPC": ["KLEX"],                # East Kentucky Power Cooperative
    "PJM/JC":   ["KTTN", "KACY"],        # Jersey Central Power & Light
    "PJM/ME":   ["KRDG"],                # Metropolitan Edison
    "PJM/PE":   ["KPHL"],                # PECO Energy
    "PJM/PEP":  ["KDCA"],                # Potomac Electric Power (DC)
    "PJM/PL":   ["KAVP", "KABE"],        # PPL Electric (north-east PA)
    "PJM/PN":   ["KJST", "KERI"],        # Penelec (northern / western PA)
    "PJM/PS":   ["KEWR"],                # Public Service Electric & Gas

    # --- SPP: named utilities --------------------------------------------
    "SWPP/CSWS": ["KTUL", "KSHV"],       # AEP West (PSO / SWEPCO)
    "SWPP/EDE":  ["KJLN"],               # Empire District Electric
    "SWPP/GRDA": ["KTUL"],               # Grand River Dam Authority
    "SWPP/KCPL": ["KMCI"],               # Kansas City Power & Light
    "SWPP/MPS":  ["KSTJ"],               # KCP&L Greater Missouri Operations
    "SWPP/NPPD": ["KLNK", "KGRI"],       # Nebraska Public Power District
    "SWPP/OKGE": ["KOKC"],               # Oklahoma Gas and Electric
    "SWPP/OPPD": ["KOMA"],               # Omaha Public Power District
    "SWPP/SECI": ["KGCK", "KHYS"],       # Sunflower Electric (western Kansas)
    "SWPP/SPS":  ["KAMA", "KLBB"],       # Southwestern Public Service
    "SWPP/WAUE": ["KFAR", "KFSD"],       # WAPA Upper Great Plains East
    "SWPP/WFEC": ["KLAW"],               # Western Farmers Electric Cooperative
    "SWPP/WR":   ["KICT", "KTOP"],       # Westar / Evergy Kansas Central

    # --- PNM --------------------------------------------------------------
    "PNM/PNM": ["KABQ"],                 # PNM system firm load
}

ANCHORS: dict[str, list[str]] = {**BA_ANCHORS, **ZONE_ANCHORS}


# ---------------------------------------------------------------------------
def load_isd_history(path: Path | None = None) -> pd.DataFrame:
    """NOAA's station inventory. Columns USAF, WBAN, LAT, LON, ICAO, BEGIN, END."""
    path = path or ISD_HISTORY_LOCAL
    h = pd.read_csv(path, dtype=str)
    h.columns = [c.strip().replace(" ", "_").replace("(M)", "_M") for c in h.columns]
    for c in ("LAT", "LON", "ELEV_M"):
        h[c] = pd.to_numeric(h[c], errors="coerce")
    for c in ("BEGIN", "END"):
        h[c] = pd.to_numeric(h[c], errors="coerce")
    h["ICAO"] = h["ICAO"].fillna("").str.strip()
    h["station_id"] = h["USAF"].str.zfill(6) + h["WBAN"].str.zfill(5)
    return h


def resolve_anchors(history: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, list[str]]]:
    """Turn curated ICAO codes into real ISD station ids with real coordinates.

    Returns (station table, {region: [station_id, ...]}). An ICAO that is absent
    from isd-history, or whose record does not span 2018-01-01 to 2025-08-01, is
    dropped here and shows up in the unresolved report.
    """
    usable = history[
        (history.CTRY == "US")
        & history.LAT.notna() & history.LON.notna()
        & (history.LAT != 0) & (history.LON != 0)
        & (history.BEGIN <= REQUIRE_BEGIN_BY)
        & (history.END >= REQUIRE_END_AFTER)
        & (history.ICAO != "")
    ].copy()
    # one row per ICAO: the record with the longest period of service
    usable["span"] = usable.END - usable.BEGIN
    usable = usable.sort_values("span", ascending=False).drop_duplicates("ICAO", keep="first")
    by_icao = usable.set_index("ICAO")

    assigned: dict[str, list[str]] = {}
    rows = []
    for region, icaos in ANCHORS.items():
        ids = []
        for icao in icaos:
            if icao in by_icao.index:
                r = by_icao.loc[icao]
                ids.append(r.station_id)
                rows.append({
                    "region": region, "icao": icao, "station_id": r.station_id,
                    "station_name": r.STATION_NAME, "state": r.STATE,
                    "lat": float(r.LAT), "lon": float(r.LON), "elev_m": float(r.ELEV_M),
                    "isd_begin": int(r.BEGIN), "isd_end": int(r.END),
                })
        if ids:
            assigned[region] = ids
    return pd.DataFrame(rows), assigned


def unresolved(history: pd.DataFrame) -> dict[str, list[str]]:
    """ICAO codes that isd-history cannot serve, per region. For the write-up."""
    tbl, _ = resolve_anchors(history)
    got = tbl.groupby("region").icao.apply(set).to_dict()
    out = {}
    for region, icaos in ANCHORS.items():
        missing = [i for i in icaos if i not in got.get(region, set())]
        if missing:
            out[region] = missing
    return out


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km."""
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
