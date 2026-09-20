"""Plant-level evidence from EIA-860.

Everything else in Wattson works at balancing-authority resolution, from the
EIA-930 hourly tables. That is enough to see that two BAs reported the same
generation, and not enough to say which physical plant it was. This module
adds the second PUDL dataset, EIA-860, which is one row per plant, per
generator and per owner, and uses it to test a claim we have already
published: that the generation AZPS and SRP both reported through 2019 was
Palo Verde.

    python3 -m engine.plants            # print the evidence pack
    python3 -m engine.plants --json     # also write engine/plants/evidence.json

Data comes from s3://pudl.catalyst.coop (public, anonymous) via
scripts/vendor/pudl_fetch.py. See docs/PLANTS.md for the write-up.
"""
