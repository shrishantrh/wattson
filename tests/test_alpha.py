"""Tests for the Generating Alpha payload.

Most of these are honesty guards. The page links grid measurements to tradable
instruments, and the single thing that would discredit the project is implying
we can predict a price. We have no validation that this signal predicts
anything, so the tests enforce that nothing in the generated text claims we do.
"""
import json
import re

import pytest

from engine.alpha import build

# Words that would turn an input into a recommendation or a forecast.
BANNED = re.compile(
    r"\b(forecast|predict\w*|will rise|will fall|price target|undervalued|"
    r"overvalued|buy|sell|short\b|long\b|outperform|upside|downside|"
    r"expected return|alpha signal|guaranteed)\b", re.I)


@pytest.fixture(scope="module")
def payload():
    return build.build()


def test_no_instrument_row_lacks_a_reason(payload):
    for chain in payload["chains"]:
        for inst in chain["instruments"]:
            assert inst["why"].strip(), f"{inst.get('symbol')} has no reason"


def test_every_reason_cites_a_number_from_our_data(payload):
    """A reason without a figure is an assertion, not a link."""
    for chain in payload["chains"]:
        for inst in chain["instruments"]:
            assert re.search(r"\d", inst["why"]), inst["why"]


def test_nothing_in_the_payload_predicts_a_price(payload):
    """Scanned everywhere EXCEPT `limits`, which exists to say what we cannot
    do. "no validation that this signal predicts prices" is the denial, not
    the claim, and a scan that cannot tell them apart would push the
    disclaimer off the page."""
    # `limits` and `no_prediction` are the disclaimer blocks: they exist to
    # say what we cannot do, so they are the one place the banned words are
    # correct. A scan that cannot tell a denial from a claim would push the
    # disclaimer off the page.
    disclaimers = {"limits", "no_prediction"}
    scanned = {k: v for k, v in payload.items() if k not in disclaimers}
    hit = BANNED.search(json.dumps(scanned))
    assert hit is None, f"prediction language in payload: {hit.group(0)!r}"


def test_the_limits_block_denies_prediction_explicitly(payload):
    joined = " ".join(payload["limits"]).lower()
    assert "no validation that this signal predicts prices" in joined


def test_the_no_validation_limit_is_stated(payload):
    joined = " ".join(payload["limits"]).lower()
    assert "no validation" in joined
    assert "predict" in joined  # stated as the thing we CANNOT do


def test_the_not_advice_limit_is_stated(payload):
    joined = " ".join(payload["limits"]).lower()
    assert "not investment advice" in joined
    assert "licensed" in joined


def test_the_coarse_region_limit_is_stated(payload):
    assert any("coarse" in l.lower() for l in payload["limits"])


def test_no_listed_equity_count_is_surfaced_from_the_facilities_endpoint(payload):
    ne = payload["no_listed_equity"]
    assert ne["count"] == 5
    assert ne["resolved"] == 12
    assert re.search(r"\d", ne["note"])


def test_every_chain_names_the_fuel_that_filled_its_growth(payload):
    for chain in payload["chains"]:
        assert re.search(r"\d", chain["fuel_sentence"])


def test_equity_rows_carry_a_verified_source_url(payload):
    for chain in payload["chains"]:
        for inst in chain["instruments"]:
            if inst["class"] == "equity":
                assert inst["source_url"].startswith("http")


def test_event_rows_only_appear_when_kalshi_has_open_markets(payload):
    for chain in payload["chains"]:
        for inst in chain["instruments"]:
            if inst["class"] == "event":
                assert inst["markets"], f"{inst['series']} has no open markets"


def test_series_with_no_open_markets_are_reported_not_hidden(payload):
    """'This market exists and nobody trades it' is information."""
    empty = payload["event_markets"]["series_with_no_open_contracts"]
    assert "KXUTILITYPJMWEST" in empty


def test_payload_still_has_equities_and_commodities_without_kalshi(monkeypatch):
    monkeypatch.setattr(build.kalshi, "load", lambda: {
        "available": False, "error": "unreachable", "series": {}, "fetched_at": None})
    p = build.build()
    assert p["event_markets"]["available"] is False
    assert p["event_markets"]["message"]
    classes = {i["class"] for c in p["chains"] for i in c["instruments"]}
    assert "equity" in classes and "commodity" in classes
    assert "event" not in classes


def test_chains_are_ordered_by_detector_rank(payload):
    ranks = [c["rank"] for c in payload["chains"]]
    assert ranks == sorted(ranks)


def test_frame_says_input_not_answer(payload):
    assert "input" in payload["frame"].lower()


def test_corrected_utility_names_are_used_not_the_stale_ones(payload):
    """operators_verified corrected 'AEP Texas North' -> 'AEP Texas'. That
    company merged away in 2016; rendering it would put a defunct entity on a
    public page."""
    blob = json.dumps(payload)
    assert "AEP Texas North" not in blob


def test_zone_fuel_figures_are_labelled_as_the_parent_bas(payload):
    """Zones report demand only and inherit the parent BA's generation. A fuel
    line that silently shows ERCO's numbers under ERCO/NRTH reads as that
    zone's own mix."""
    for chain in payload["chains"]:
        if chain["fuel_inherited_from"]:
            assert chain["fuel_inherited_from"] in chain["fuel_sentence"]
            assert "inherit" in chain["fuel_sentence"].lower()


def test_at_least_one_featured_region_is_an_inheriting_zone(payload):
    assert any(c["fuel_inherited_from"] for c in payload["chains"])


# --- the two checks the Manager asked to confirm ---------------------------

def test_event_prices_carry_an_as_of_timestamp(payload):
    """A price with no as-of date reads as current when the demo runs later."""
    ev = payload["event_markets"]
    if ev["available"]:
        assert ev["fetched_at"], "cached Kalshi prices must carry a fetch time"
        assert ev["as_of_note"] and re.search(r"\d", ev["as_of_note"])


def test_event_prices_are_cached_not_fetched_in_the_browser(payload):
    assert payload["event_markets"]["cached_at_build_time"] is True


def test_page_denies_predictive_power_outside_the_limits_block(payload):
    """It must be impossible to read the page and think we claim prediction,
    without having to reach the limits section."""
    stmt = payload["no_prediction"].lower()
    assert "no validation" in stmt
    assert "predict" in stmt
    assert "backtest" in stmt
