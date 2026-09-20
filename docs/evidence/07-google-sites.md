# Google's ten sites, and where the walk score comes from

**Walk score 0.464** is the plain average of these ten numbers. Nothing else.

| clean share 2025 | site | grid | serving utility |
|---|---|---|---|
| 0.056 | Moncks Corner (Berkeley County) | `SC` | Berkeley Electric Cooperative (power from Santee Cooper) |
| 0.349 | Council Bluffs | `MISO` | MidAmerican Energy |
| 0.349 | Pine Island | `MISO/0001` | Northern States Power - Minnesota (Xcel Energy) |
| 0.393 | Fort Wayne | `PJM/AEP` | Indiana Michigan Power |
| 0.456 | Pryor (Mayes County) | `SWPP/GRDA` | Grand River Dam Authority |
| 0.461 | Midlothian (Ellis County) | `ERCO/NCEN` | not resolved |
| 0.487 | Bridgeport (Jackson County) | `TVA` | Tennessee Valley Authority |
| 0.575 | Lenoir | `DUK` | Duke Energy Carolinas |
| 0.599 | Mesa | `SRP` | Salt River Project |
| 0.913 | The Dalles | `BPAT` | Northern Wasco County PUD |

Mean of 10 = **0.464** = the walk score.

- **No weighting by site size.** A single very large site could move this and we say so.
- **Grid-only.** Power purchase agreements and certificates are excluded on purpose:
  the walk score is what the wires carried, the talk score is what was bought.
- Range: **5.6% to 91.3%**, a 16-fold spread
  under one annual claim.

## Source

`server/static_export/company/GOOGL.json` → `sites[].cf_share_2025`
