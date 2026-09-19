# Operator verification

`scripts/operators_manual.json` is hand-mapped, was unverified, and already
renders next to every region. This checks it against external sources.

```bash
source ~/hackmit-venv/bin/activate
python3 -m engine.operators        # writes claims/derived/operators_verified.json
```

Reads `scripts/operators_manual.json` **read only** — `scripts/` is frozen and
that file belongs to someone else. Writes only
`claims/derived/operators_verified.json`.

## Method

23 distinct `(utility, ticker)` rows, covering all 31 entries across 12
regions. Each row is checked on three separable questions, because they fail
differently:

1. `ticker_and_exchange` — the symbol exists and is the right listing
2. `ticker_belongs_to_parent` — it is the parent we name, not a near-name
3. `parent_owns_utility_today` — that parent still owns this utility now

Company IR pages and SEC filings were used as evidence. Ticker-lookup sites
were not accepted for question 3: a symbol lookup confirms a company exists,
not that it still owns a particular utility.

Every row carries a `status` (`verified` / `corrected` / `unverifiable`) and a
`source_url`. Corrections carry the old value, the new value and their own
source, because a silent correction is indistinguishable from a silent error.
A row with no research attached falls through to `unverifiable` rather than
defaulting to verified.

## Result: 22 verified, 1 corrected, 0 unverifiable

### The correction

**`AEP Texas North` → `AEP Texas`** (regions ERCO/NRTH, ERCO/FWES).

AEP Texas North Company ceased to exist: it merged with AEP Texas Central
Company into AEP Texas Inc., effective 2016-12-31. AEP's own Exhibit 21
subsidiary list as of 2025-12-31 contains `AEP Texas Inc.` and no
`AEP Texas North Company` — only `AEP Texas North Generation Company LLC`,
a different entity.

The ticker and the parent were right; the utility name was stale by about ten
years. "AEP Texas North" does survive informally as the AEP North TDU
service-territory label, so it is not nonsense as a *zone* name — it is wrong
as the name of a utility company.

### Both CLAUDE.md suspects were actually correct

CLAUDE.md flagged TXNM and FTS as the doubtful ones. Both check out, and the
error was somewhere nobody had flagged — which is the reason the brief said to
check all of them rather than only the two that had been noticed.

- **TXNM** — TXNM Energy's Form 10-Q cover page for the quarter ended
  2026-06-30 gives symbol `TXNM` on the New York Stock Exchange, and states
  TNMP's shares are all held indirectly by TXNM as of 2026-07-24. The parent
  was renamed from PNM Resources to TXNM Energy in 2024, which is the likely
  source of the doubt.
- **FTS** — Fortis Inc. lists UNS Energy among its operating companies and
  describes it as the parent of Tucson Electric Power. Fortis is dual-listed
  on the TSX and NYSE under FTS, so FTS is right for a US-facing table.

### Two tickers are correct today and will stop being correct

Both are mid-merger. Neither is an error now; both need a re-check before
anything is published.

- **BKH** — Black Hills is merging with NorthWestern Energy (all-stock merger
  of equals, announced 2025-08-18, approved by both shareholder groups
  2026-04-02). On close the parent is renamed **Bright Horizon Energy, Inc.**
  and adopts a **new ticker**, so BKH stops being valid. Expected close was
  the second half of 2026 — that is now. This is the more urgent of the two.
- **TXNM** — being acquired by Blackstone Infrastructure at $61.25/share. PUCT
  and FERC approved in February 2026; the New Mexico PRC and NRC approvals
  were still outstanding, the termination date is extended to 2027-05-31, and
  closing is now expected in the first half of 2027. On close the shares are
  delisted from the NYSE.

### Smaller things worth knowing

- **AEP trades on Nasdaq, not the NYSE** — it moved its listing on 2020-10-01.
  The table has no exchange column, so nothing was wrong, but anyone adding
  one should not assume NYSE.
- **Oncor** — Sempra holds an **80.25%** indirect stake, not full ownership;
  the rest is held by Texas Transmission Investment LLC. Fair for a
  who-serves-the-load table, but it is a majority stake, not outright
  ownership. The parent renamed itself from Sempra Energy to Sempra in 2023.
- **Constellation** completed its acquisition of **Calpine** on 2026-01-07,
  enlarging CEG's ERCOT and PJM generation footprint relative to what the
  hand-mapped table assumed.
- **Kentucky Power** is still AEP-owned; the 2021 sale to Liberty/Algonquin
  was terminated.
- **Santee Cooper** remains state-owned. A potential sale of its interest in
  the unfinished V.C. Summer reactors to Brookfield is under negotiation with
  a decision deadline in 2028 — an asset sale, not a change of the utility's
  ownership.

The seven rows with no ticker (federal marketer, municipal utility,
cooperatives, public power districts) have no listed parent by organisational
form, so questions 1 and 2 are `n/a` and there is no ticker that can be wrong.
Their ownership form was still sourced individually.
