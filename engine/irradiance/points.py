"""Representative measurement points for the irradiance overlay.

IMPORTANT: each of these is a SINGLE HAND-PICKED POINT, not a centroid, not a
load-weighted average, and not in any sense "the region". A balancing
authority is a large, irregular, multi-state footprint — PJM alone spans
Chicago to New Jersey. A point near the load centre is enough to show the
shape of the solar resource over time. It is not enough to characterise a
region, and nothing downstream should treat it as if it were.

Points were chosen before the irradiance data was pulled.
"""

POINTS = {
    "PJM/DOM":   {"lat": 39.04, "lon": -77.49, "place": "Ashburn, VA"},
    "AZPS":      {"lat": 33.45, "lon": -112.07, "place": "Phoenix, AZ"},
    "SWPP/OPPD": {"lat": 41.26, "lon": -95.93, "place": "Omaha, NE"},
    "ERCO/NRTH": {"lat": 32.78, "lon": -96.80, "place": "Dallas, TX"},
    "CISO":      {"lat": 36.70, "lon": -119.80, "place": "Central Valley, CA"},
}

#: NASA POWER, all-sky surface shortwave downward irradiance, kWh/m^2/day.
PARAMETER = "ALLSKY_SFC_SW_DWN"
UNITS = "kWh/m^2/day"
SOURCE = "NASA POWER (power.larc.nasa.gov), daily point API, community=RE"
NASA_FILL_VALUE = -999.0
