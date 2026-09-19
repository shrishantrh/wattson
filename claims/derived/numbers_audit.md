# Numbers audit

Every demo-facing figure checked against the file it comes from.
**21 VERIFIED, 3 CORRECTED, 1 UNVERIFIABLE.**

Reproduce: `python3 -m engine.diagnostics.numbers_audit` (run it on `integration`
— `companies.json`, `alerts_ranked.json`, `irradiance.json` and `facilities.csv`
live there, and the script marks them UNVERIFIABLE rather than skipping them if
they are absent). Machine-readable results in `numbers_audit.json`.

---

## The three that are wrong

### 1. "Dominion gas +10.74 GW overnight" — this is PJM's number, not Dominion's

`PJM/DOM.fuel_delta_overnight_gw.gas` is 10.74 GW, and it is **identical to the
PJM parent's**, because `cf_inherited_from_ba: true`. Every PJM zone carries the
same figure. Dominion's own overnight demand grew **3,973 MW**, about 46% of
PJM's 8.7 GW overnight growth.

Saying "Dominion gas +10.74 GW" is the exact error CLAUDE.md already warns
against — *say half, not all*. Correct phrasing: **"PJM-wide overnight gas rose
10.74 GW; Dominion's own overnight demand rose about 4 GW, roughly half of PJM's
overnight growth."** Dominion's demand figures (+31.8% average, +39.5%
overnight) are its own and are verified.

### 2. Phoenix's siting score in the SITE demo is the uncorrected AZPS number

Omaha 0.737, N. Virginia 0.436 and Phoenix 0.173 all match `regions.json`
exactly. But Phoenix is AZPS, whose generation-side history is the number we
corrected this morning. Corrected, AZPS's siting score is **0.449** and its rank
moves from 49 to about 32 of 52.

So a SITE demo showing Phoenix at 0.173 ranks Phoenix dirtier than our own
evidence supports, on stage, minutes after we explain the correction. The API
serves corrections for `/api/region`; **the `/api/site` path must apply the
overlay too.** This is the one to fix before the demo.

### 3. The alert gap is 44%, not 78% — or 78% the other way round

Rank 6 severity 0.258, rank 7 0.145. Severity **drops 44%** from rank 6 to rank
7; equivalently rank 6 scores **78% above** rank 7. Both are arithmetically
real; they differ only in denominator. "A 78% gap" will be heard as "severity
falls 78%", which is false. Say **"rank 6 scores 78% higher than rank 7"** or
**"severity drops 44% between them"**, and do not mix them.

## The one that cannot be checked

### EC2: 359 MB in 3.7s, full pipeline under 2 minutes, identical across pandas 2 and 3

**No artifact exists in the repository** — no timing log, no run output, no
report. The figure lives only in prose. CLAUDE.md still lists the EC2
reproducibility run as an open issue, which is consistent with it never having
been recorded. A number that cannot be reproduced from a committed file by a
command is asserted, not verified. **Do not say it on stage until someone
commits the run output**; it is a five-minute fix if the run actually happened.

---

## Verified, with wording that matters

**PJM overnight clean, 35,700 → 35,619 MW.** Endpoints differ by **81 MW**, so
"flat within 100 MW since 2019" is literally true *as an endpoint statement*. It
is not true of the path: the series runs 34,316–36,299 MW, a spread of 1,983 MW,
with 2020 sitting 1,384 MW below 2019. Say **"2025 is within 100 MW of 2019"**,
not "it never moved more than 100 MW". A judge who plots the series will see the
2020 dip.

**National shares.** Overnight 0.405 → 0.397, daytime 0.372 → 0.465, overnight
clean absolute 159.0 → 173.4 GW. All exact. The share falls 0.8 points **while
the absolute rises 14.3 GW** — the share fall is misleading without the
absolute, so they must appear together.

**ERCO/NRTH daytime +28.9 pts vs irradiance +3.4%.** Both exact. Two wording
risks: the +3.4% endpoint change is *larger* than the 2.65% "flat" band quoted
beside it, because they are different statistics (endpoint change vs
year-to-year variation) — say which. And ERCO/NRTH inherits its carbon-free
share from ERCO, so +28.9 points describes all of ERCOT while the irradiance
point is Dallas. The irradiance file already says this in
`cf_share_actually_describes`.

**Google walk 0.056.** Verified, and the SCEG caveat is in the file. It must be
said out loud with the number, not left in a tooltip: 0.056 is the SC balancing
authority, which is also the single biggest outlier against Google's own
published grid CFE (we read 5.6%, Google publishes 25% for the South Carolina
regional grid). That divergence is a coarse-region artefact, and it is the same
footprint our verdict rests on.

**Everything else checked clean:** PJM overnight total +8.70 GW; PJM overnight
net exports 3,814 → 2,489 MW; detector 111 scored of 124 served with all ten
named ranks exact; alerts 14 ranked of 162 source, tiers 6/6/2, WACM absent;
company talk/walk (META 0.55/0.603, MSFT 0.55/0.642, GOOGL 0.394/0.056, AMZN
—/0.393) and `cannot_verify` = 1; Google hourly CFE 65/64/64/66/65, locked by a
committed test against the rendered page; grid-CFE validation 7 of 11 within 2
points, median −0.5; irradiance flat at 1.06–2.65%; facilities 4 of 7 without
listed equity, PACW 0.297 → 0.75 with its stale-trap note, Quincy GCPD 1.0.

## One structural gap

`regions.json` carries `meta.data_flags` with an entry for **WACM** and none for
**AZPS**, and AZPS's own `data_flags` array is still `[]`. The AZPS caveat exists
only in our overlay. Anything reading `regions.json` directly — an export, a
screenshot, the fallback demo — shows the uncorrected AZPS collapse with no
warning attached. Same failure as before: *a caveat that is not machine-readable
does not exist.*
