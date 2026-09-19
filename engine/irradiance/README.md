# Irradiance overlay (NASA POWER)

Independent check on the shape of the headline finding: daytime carbon-free
share rose (0.372 -> 0.465 nationally) while overnight stayed flat
(0.405 -> 0.397). The proposed reason is solar. Solar depends on surface
irradiance, which is measured from orbit and owes nothing to this pipeline.

```bash
source ~/hackmit-venv/bin/activate
python3 -m engine.irradiance                 # writes claims/derived/irradiance.json
python3 -m engine.irradiance.aggregate       # only if re-pulling from NASA
```

Data: NASA POWER daily point API, `ALLSKY_SFC_SW_DWN` (all-sky surface
shortwave downward irradiance, kWh/m^2/day), 2019-01-01 to 2025-12-31, five
points, 2,557 days each, **zero fill values**. Free, no key.

The raw daily pull is cached under `data/`, which is gitignored. The
aggregated monthly and annual series are committed as
`engine/irradiance/monthly.json` (15 kB), so the build reproduces with no
network call.

## The finding

**Irradiance is flat everywhere.** Year-to-year variation is 1.1-2.6% with no
trend at any of the five points.

That is the result, not a null result. The resource was always there in the
day and never at night. What changed is the capacity built to catch it. The
honest headline is *"we built to catch a resource that was already there,"*
not *"the sun got brighter."*

| region | point | irr 2019 | irr 2025 | irr Δ | var | daytime Δpts | overnight Δpts | verdict |
|---|---|---|---|---|---|---|---|---|
| PJM/DOM | Ashburn, VA | 4.001 | 4.038 | +0.9% | 1.2% | **+4.0** | −4.3 | supports |
| ERCO/NRTH | Dallas, TX | 4.648 | 4.805 | +3.4% | 2.6% | **+28.9** | +1.4 | supports |
| SWPP/OPPD | Omaha, NE | 3.982 | 4.182 | +5.0% | 2.5% | +5.7 | +5.2 | does not separate |
| CISO | Central Valley, CA | 5.372 | 5.351 | −0.4% | 1.4% | −4.8 | −3.7 | contradicts |
| AZPS | Phoenix, AZ | 5.796 | 5.780 | −0.3% | 1.1% | −17.5 | −51.6 | unusable |

The daytime-rises-while-overnight-does-not pattern appears cleanly in 2 of 5
regions. The other three are reported as they are.

## Why the three others fail, and why that is not a problem

This reading came *after* seeing the result and is marked `post_hoc: true` in
the JSON. It is not a test the data passed.

- **SWPP/OPPD** — SPP's overnight share is *higher* than its daytime share in
  every year (0.467 vs 0.357 in 2019). That is the signature of wind, not
  solar. Wind is not diurnal, so both halves of the day rose together
  (+5.7 / +5.2) and cannot separate.
- **CISO** — overnight rose far more than daytime from 2020 onward (+9.5 vs
  +0.7 points), with overnight wind up 0.63 GW while hydro fell 0.59 GW. Its
  2019 daytime share was also an unusually high starting point.
- **AZPS** — excluded. Its generation series contains the documented reporting
  break already withheld from alerts; the region list is imported from
  `engine.alerts.quality` so the two modules cannot disagree.

Both non-supporting regions are wind- or hydro-led rather than solar-led,
which is where you would expect a solar mechanism *not* to show. That is
consistent with the mechanism being real, but it is an observation, not
evidence, and the JSON says so.

## What this is not

Every caveat below travels **inside `irradiance.json`**, not only here.

- A single hand-picked point is **not a centroid**, not a load-weighted
  average, and not the region. PJM spans Chicago to New Jersey.
- An illustration of a mechanism, **not a causal estimate**. No share of the
  change is attributed to irradiance and no coefficient is reported — a test
  asserts no causal-sounding field name can be emitted.
- **Carbon-free is not solar.** It includes nuclear, hydro, wind and
  geothermal. Only solar is diurnal, so the daytime/overnight split is not a
  pure solar signal.
- **Three of the five regions are zones** whose carbon-free share is inherited
  from the parent BA, so the share describes a far larger footprint than the
  irradiance point. Each carries a `scale_mismatch_note`.
- Five points do not test a national claim. The national figures in the output
  are context only.
