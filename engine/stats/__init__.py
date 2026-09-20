"""engine.stats - inferential statistics for the FROZEN L3 flat-load detector.

This module MEASURES the shipped detector. It never changes it. Every number
here is derived from `scripts/l3_detector.py` as shipped; `core.verify()` asserts
that the vectorised re-implementation used by the resampling tests reproduces the
frozen `detect()` output to floating point before any test is run.

Tests provided
  permutation  is the ranking better than chance?        engine/stats/permutation.py
  bootstrap    how stable is a score / a rank?           engine/stats/bootstrap.py
  holdout      does it hold on 2026 Jan-Aug?             engine/stats/holdout.py
  fdr          111 regions - how many top hits are luck? engine/stats/fdr.py
  autocorr     what is n, really?                        engine/stats/autocorr.py

Run everything:  python3 -m engine.stats
Write-up:        docs/STATS.md
"""

MASTER_SEED = 20260920

__all__ = ["MASTER_SEED"]
