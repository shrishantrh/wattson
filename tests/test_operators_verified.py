"""Every hand-mapped operator row must end up with a status and a source.

The point of this file is coverage: a verification table that silently omits
a row is indistinguishable from one that verified it.
"""
import json
import pytest

from engine.operators import verify

STATUSES = {"verified", "corrected", "unverifiable"}


@pytest.fixture(scope="module")
def result():
    return verify.build()


@pytest.fixture(scope="module")
def manual():
    return verify.load_manual()


def test_every_manual_row_is_covered(result, manual):
    covered = {(o["utility"], o["ticker"]) for o in result["operators"]}
    for region, entries in manual.items():
        if region.startswith("_"):
            continue
        for e in entries:
            assert (e["utility"], e.get("ticker")) in covered, \
                f"{region}: {e['utility']} has no verification row"


def test_every_row_has_a_status_from_the_allowed_set(result):
    assert all(o["status"] in STATUSES for o in result["operators"])


def test_every_row_has_a_source_url(result):
    for o in result["operators"]:
        assert o["source_url"].startswith("http"), o["utility"]


def test_corrected_rows_carry_both_old_and_new_values(result):
    corrected = [o for o in result["operators"] if o["status"] == "corrected"]
    assert corrected, "expected at least one correction"
    for o in corrected:
        assert o["correction"]["field"]
        assert o["correction"]["old"] != o["correction"]["new"]
        assert o["correction"]["source_url"].startswith("http")


def test_every_row_records_all_three_checks(result):
    for o in result["operators"]:
        checks = o["checks"]
        assert set(checks) == {"ticker_and_exchange",
                               "ticker_belongs_to_parent",
                               "parent_owns_utility_today"}
        assert all(v in {"pass", "fail", "n/a"} for v in checks.values())


def test_rows_without_a_ticker_are_marked_not_applicable(result):
    for o in result["operators"]:
        if o["ticker"] is None:
            assert o["checks"]["ticker_and_exchange"] == "n/a"
            assert o["exchange"] is None


def test_rows_with_a_ticker_record_an_exchange(result):
    for o in result["operators"]:
        if o["ticker"] is not None:
            assert o["exchange"], o["utility"]


def test_pending_ownership_changes_are_flagged(result):
    """A ticker correct today but disappearing at a known merger close."""
    flagged = {o["ticker"] for o in result["operators"] if o.get("pending_change")}
    assert {"TXNM", "BKH"} <= flagged


def test_summary_counts_match_the_rows(result):
    import collections
    counts = collections.Counter(o["status"] for o in result["operators"])
    assert result["summary"]["by_status"] == dict(counts)
    assert result["summary"]["rows"] == len(result["operators"])


def test_manual_table_is_not_modified(manual):
    """scripts/ is frozen and owned by someone else."""
    import subprocess
    out = subprocess.run(["git", "status", "--short", "scripts/operators_manual.json"],
                         capture_output=True, text=True,
                         cwd=verify.REPO_ROOT).stdout.strip()
    assert out == "", f"scripts/operators_manual.json was modified: {out}"
