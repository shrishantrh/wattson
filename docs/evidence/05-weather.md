# Weather: the objection that overnight growth is just hot summers

**The objection:** demand grew at night because summers got hotter, so you are detecting
air conditioning, not datacenters. It is the strongest challenge to the detector.

## The answer

| | |
|---|---|
| Total overnight demand growth | 71,861 MW |
| Explained by temperature | 5,629 MW |
| **Share that is weather** | **7.8%** |
| Ranking after weather adjustment | Spearman **0.965** vs shipped |

**This is not a weak control.** The per-region temperature model fits with a median
R-squared of **0.733**, so it works. Weather simply is not
what grew.

For scale: changing the analysis window alone, with no weather adjustment at all, already
moves the ranking to 0.978. **The window matters more than the weather does.**

## The cleanest single fact

Northern Virginia was **0.21 C cooler** overnight in Jan-Aug 2025 than in 2019, while its
overnight demand rose **3,960 MW**. Weather explains 83 of those megawatts.

## The test that states it properly

Cooling peaks in the afternoon. So if overnight growth were air conditioning, daytime
growth would be larger still. After removing each region's own temperature response,
**nights grew faster than days in 96 of 111 regions**, mean +5.7 points.

## Against us, say it before they find it

- Four regions genuinely ARE mostly weather. ComEd is 91% weather-explained.
- ERCOT Far West, our rank 2, **fails** this test: days grew faster than nights. That fits
  Permian oilfield electrification, a load type we already say we cannot separate.
- NOAA's archive ends 2025-08-27, so the 2026 holdout cannot be weather-controlled at all.

## Source

`engine/weather/`, `docs/WEATHER.md`. 138 stations, 9,177,306 station-hours, 99.92% coverage.
