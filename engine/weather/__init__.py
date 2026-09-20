"""engine.weather - does the flat-load signal survive a weather control?

The objection this module exists to answer: "overnight demand grew because
summers got hotter; you are detecting air conditioning, not datacenters."

Data: NOAA Integrated Surface Database, s3://noaa-global-hourly-pds (public).
Method: hourly dry-bulb temperature for a curated airport per scored region,
put on the frozen detector's own local clock, turned into cooling and heating
degree hours, and used to residualize demand growth before the frozen scoring
formula is re-applied.

The shipped detector is FROZEN. Nothing here changes it; this module measures it.

    python3 -m engine.weather            # full run
    python3 -m engine.weather --quick    # skip the per-region hourly response model

Write-up: docs/WEATHER.md
"""

MASTER_SEED = 20260920

__all__ = ["MASTER_SEED"]
