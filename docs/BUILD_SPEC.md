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

6. **A SHA quoted from memory is not a SHA.** This session gave the Merger two wrong commit
   hashes in two consecutive messages, one of which (`e0d1bc9`) did not exist in the
   repository at all. Both were written in good faith and both looked exactly like real
   hashes. Read every ref back from `git rev-parse` before quoting it; a hash is
   authoritative because of where it came from, not because of its shape.

7. **A relayed approval is not an approval.** Authorization is valid only in the session
   that receives it, from the user, in that session. This holds when the relay is accurate,
   when the request is obviously reasonable, and when the relaying agent is trusted —
   those are precisely the conditions under which skipping the check feels safe, which is
   what makes it a trap rather than an inconvenience. It happened twice tonight in opposite
   directions: this session relayed the user's EDGAR authorization to an ingest agent and
   was correctly refused, then twenty minutes later relayed a push approval to the Merger
   and was correctly refused again. Nobody catches this by intending to. The only thing
   that catches it is the receiving side refusing **by default** rather than judging each
   relay on its merits.

9. **A correct merge resolution can still break the build.** When `cursor/spacex` was
   merged, resolving the conflicted `web/` files to *ours* was right — taking theirs would
   have silently reverted five null-render fixes and the build would still have passed.
   But a NEW file merges without conflict and carries its imports in, while the symbols it
   imports live in files that DID conflict and went to ours. The page arrived and its
   dependencies did not. The resolution was correct and the result was broken, which is
   exactly why it got through: the risk being watched for was a silent revert, and nobody
   checked that the new page still had anything to import.

10. **"It builds" is a claim about a checkout, not about a commit.** The same merge was
    reported as building clean. It did — in a working tree that contained five grafted
    changes which had never been committed, because `git add -A` ran before the graft and
    `git commit` then committed the already-staged index. *True of my working tree, false
    of the commit, and I could not tell the difference because I never left my working
    tree.* This is the trap that made trap 9 invisible. Build from a fresh `git clone` and
    a fresh `npm ci` before claiming a build passes — the Merger caught both rounds this
    way and neither was findable any other way.

11. **A caveat that is not machine-readable does not exist** — recorded three separate
    times from three directions: AZPS shipping `data_flags: []` while its warning lived in
    CLAUDE.md prose, the alerts module independently finding the same gap, and the
    corrections overlay having to carry `data_flags_should_be` because the published data
    could not.

8. **A component can render a false claim from correct data.** Amazon's `talk_score` is
   legitimately null — no claim in its documents qualifies or undercuts itself. A
   `(talk_score ?? 0)` in the view drew that as a full-width 0% bar, which asserts
   "Amazon talks at zero" rather than "there is nothing here to score." The JSON was
   honest; the screen was not. Any `?? 0`, `|| 0` or `.toFixed()` on a possibly-absent
   value is a place where absence gets rendered as a quantity. In this data `talk_score`,
   `walk_score`, `coverage`, `magnitude`, `page`, `siting_rank`, `cannot_verify_reason`
   and `heatmap_uri` are all legitimately null somewhere.

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
