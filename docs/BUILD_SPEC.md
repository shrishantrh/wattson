# Wattson build spec (live)

Supersedes the "frontend is about to be restructured" line in CLAUDE.md, which is stale.
Where this file and CLAUDE.md disagree on *who owns what*, this file wins. Where they disagree
on *frozen analytical decisions*, CLAUDE.md wins — those are not up for renegotiation.

## Ownership, enforced by worktree

| Tree | Branch | Owner | Writes |
|---|---|---|---|
| `wattson/` | `master` | nobody | PRISTINE. This is the fallback demo. No agent works here. |
| `wattson-mgr/` | `eng/contracts` | Manager | `contracts/ fixtures/ docs/` |
| `wattson-d1/` | `eng/ingest` | D1 | `engine/ingest/ claims/raw/` |
| `wattson-d2/` | `eng/server` | unassigned | `server/` |
| `wattson-d3/` | `eng/alerts` | wattson-34 | `engine/alerts/ claims/derived/` |
| (other machine) | `ui/*` | Shri | `web/` |

`dashboard/` and `scripts/` are frozen for this run. Nobody edits them.
Manager owns `integration` end to end. Merger owns `master` and receives only `integration -> master`.

## Git is the transport layer

Shri is on a different machine. Every commit in this repo is his; a local-only branch is invisible
to him. Anything meant for the UI must be **pushed to origin**, promptly. Five checkpoints, not one.

## Endpoints

`contracts/api.v1.yaml` is binding. `contracts/ba_codes.txt` is the authority on BA spellings.

```
GET  /api/regions              ranked, detector score, growth, siting
GET  /api/region/{id}          detail: cf_share, fuel_delta, heatmap, operators
GET  /api/companies            talk/walk/coverage, is_mock flag
GET  /api/company/{ticker}     claims, verdicts, evidence, sites
POST /api/site   {mw, metros}  ranked siting verdict   <- THE PRODUCT
GET  /api/alerts               ranked, deduped, severity
GET  /api/export/{kind}.csv
```

## Traps found in this dataset, and what they cost if missed

1. **`heatmap_uri` is not a promise.** All 124 regions carry a non-null `heatmap_uri`; three
   (AEC, OVEC, SWPW) point at files that do not exist. `dashboard/` survives by catching the failed
   load. Any new consumer must too. `fixtures/region_no_heatmap.json` exists so the empty state gets
   built rather than discovered live.
2. **`data/` does not exist on this machine** — it is gitignored and was never cloned, so the
   committed exports under `dashboard/public/data/` are the only data present.
   **CORRECTED: an earlier version of this note said the raw data could not be regenerated
   here. That was wrong and nobody had tested it.** The PUDL parquet sits in a public S3
   bucket with anonymous access and pulls in under a minute; `scripts/vendor/pudl_fetch.py`
   already defaults to unsigned. That wrong belief nearly cost us the AZPS investigation,
   which only happened because an agent tested the assumption instead of accepting it.
   The narrower claim still holds and is the one the gate runs on: `dashboard/public/data/*`
   cannot be regenerated *without* that fetch, so any diff against it is hand-edited until
   someone shows the re-run.
3. **`zone` vs `pjm_zone`.** New `web/` reads `zone`; frozen `dashboard/` reads `pjm_zone`
   (`Companies.jsx:32`). Every site object ships BOTH keys with identical values. Note that
   `scripts/export_json.py:233` also emits `pjm_zone` — two producers, so they must not disagree.
4. **`dashboard/sync-claims.mjs` copies `claims/*.json` into the fallback at build time.** Writing
   `claims/companies.json` changes the fallback demo without editing a line of `dashboard/`.
5. **Session labels drift.** Agents were respawned mid-run and names moved between sessions. The
   worktree path is the source of truth for an assignment, never the session name.

## Scores, defined

**Siting** (frozen, from `regions.json`, not re-tuned): overnight CF share 2025 (level), its
2019-2025 slope (direction), overnight clean MW over overnight demand (headroom). One sentence:
*we rank on how clean the overnight grid is today, whether it is getting cleaner, and how much clean
headroom is left relative to demand.*

**Talk** = `magnitude x specificity x scope_breadth`, 0-1. Specificity from numeric precision;
scope_breadth penalizes narrowing qualifiers (market-based, owned-and-operated). One sentence:
*how big the number is, how precisely it is stated, and how little it is hedged.*
If this cannot be said in one sentence, the Talk-vs-Walk scatter gets cut — an undefined axis is
worse than no chart.

**Walk** = mean physical carbon-free share across mapped sites, grid-only, unweighted.

## Verdicts

`true_on_paper | contradicted | unfalsifiable | cannot_verify`

Never "they lied". Annual matched claims are true under the GHG Protocol market-based method.
`cannot_verify` carries an enumerated reason — `no_falsifiable_content | no_site_mapping |
ba_out_of_coverage | year_out_of_range` — and the count is rendered on screen, so the reasons must
be real values rather than a label.
