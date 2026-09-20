# The detector, and whether we tuned it

## The method

`score = z(overnight excess) + z(neighbor divergence) + 0.5 x z(load factor change)`

- **Overnight excess:** how much faster demand grew at night than on average.
- **Neighbor divergence:** how much faster than other zones on the same grid.
- **Load factor change:** how much the daily demand curve flattened.
- **Robust z** (median/MAD, not mean/sigma) because ERCOT's two zones grew +94.6% and
  +116.1% and would otherwise set the scale for all 111 regions.
- Regions under 500 MW average demand excluded. Peak is the 99.5th percentile hour.

## Did we tune it after seeing results? No, and git proves it.

`scripts/l3_detector.py` has exactly two commits.

- `7dc87a0` is the first version. It **already contains** the scoring function, the 500 MW
  floor, the p99.5 peak **and the four validation region names**, in code:

```python
r[r.region.isin(["PJM/DOM", "PJM/AEP", "SWPP/OPPD", "ERCO/NCEN", ...])]
print("\n2026 Jan-Aug ranks for validation set:")
```

- `c421061` is the only later change: **+22 lines, 0 deletions**, adding a docstring and a
  descriptive pattern label whose own comment says it *"does not affect the score or rank"*.

**Check it live:** `git show 7dc87a0:scripts/l3_detector.py | grep NCEN` and
`git show --numstat c421061 -- scripts/l3_detector.py`.

**What we do NOT claim:** there is no separate timestamped pre-registration document. The
claim is exactly what git shows: the validation set is named in the commit that produced
the first ranking, and the scoring function never changed after.

## Results

| region | rank | |
|---|---|---|
| Northern Virginia (PJM/DOM) | 6th | hit |
| Omaha (SWPP/OPPD) | 7th | hit |
| Central Ohio (PJM/AEP) | 19th | hit |
| Dallas (ERCO/NCEN) | **91st** | **miss** |

**Volunteer the miss.** Neighbor divergence compares a zone to its neighbors, and every
ERCOT zone is booming, so a booming Dallas looks unremarkable. Drop that term and Dallas
moves to 48th. We published the 91st because the weights were fixed first.

## Does it hold out of sample?

Re-run on 2026 Jan-Aug, data that did not exist when the method was frozen:

- Spearman **0.8769**, CI [0.8251, 0.9141]
- Kendall tau-b 0.7181
- Top-10 overlap **8 of 10**, against 0.91 expected by chance
- All four validation regions moved UP or stayed: N. Virginia 6 to 3, Omaha 7 to 6,
  Central Ohio 19 to 12, Dallas 91 to 81.

## Against us

- The in-sample permutation p is **0.0488** on mean score and **0.0571** on mean rank. It
  straddles 0.05. Drop Dominion alone and it moves to 0.137. **The out-of-sample result is
  the stronger claim; quote that one.**
- Our bootstrap rank intervals contain the out-of-sample rank only **71.8%** of the time
  against a nominal 95%. Window choice dominates, not sampling noise.
- Below the top 10 the ranking is not an ordering: median rank interval is 29 places wide.

## Source

`scripts/l3_detector.py` (frozen), `engine/stats/`, `docs/STATS.md`
