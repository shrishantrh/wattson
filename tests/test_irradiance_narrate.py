"""Narration script for the irradiance screen.

Built from claims/derived/irradiance.json so it works for any region in the file.
Banned phrasing guards the honesty constraints: the sun did not change, this is
an illustration not a causal estimate, and scale mismatch must be spoken aloud.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from server.irradiance_narrate import BANNED_PHRASES, build_script

IRRADIANCE = Path("claims/derived/irradiance.json")


@pytest.fixture(scope="module")
def doc():
    return json.loads(IRRADIANCE.read_text())


@pytest.fixture(scope="module")
def scripts(doc):
    return {r["region"]: build_script(doc, r["region"]) for r in doc["regions"]}


def test_script_exists_for_every_region(doc, scripts):
    assert len(scripts) == len(doc["regions"])
    for s in scripts.values():
        assert isinstance(s, str) and len(s) > 40


def test_script_names_the_region_and_verdict(doc, scripts):
    for r in doc["regions"]:
        s = scripts[r["region"]].lower()
        assert r["region"].lower() in s or r["name"].lower() in s
        assert r["verdict"].replace("_", " ") in s or r["verdict"] in s


def test_script_includes_daytime_and_overnight_deltas(doc, scripts):
    for r in doc["regions"]:
        s = scripts[r["region"]]
        day = r["cf_share"]["daytime_change_pts"]
        night = r["cf_share"]["overnight_change_pts"]
        assert f"{day:+.1f}" in s or f"{day:.1f}" in s
        assert f"{night:+.1f}" in s or f"{night:.1f}" in s


def test_script_states_irradiance_is_flat(doc, scripts):
    for r in doc["regions"]:
        s = scripts[r["region"]].lower()
        assert "flat" in s
        assert "brighter" not in s
        assert "got brighter" not in s
        assert "sun changed" not in s
        assert "sunlight increased" not in s


def test_script_distinguishes_variation_from_endpoint_change(doc, scripts):
    """year_to_year_variation_pct and change_pct_2019_2025 are different stats."""
    for r in doc["regions"]:
        s = scripts[r["region"]].lower()
        var = r["irradiance"]["year_to_year_variation_pct"]
        end = r["irradiance"]["change_pct_2019_2025"]
        assert f"{var:.2f}" in s or f"{var:.1f}" in s
        assert "year-to-year" in s or "year to year" in s
        assert f"{end:+.2f}" in s or f"{end:.2f}" in s or f"{end:+.1f}" in s or f"{end:.1f}" in s
        assert "2019" in s and "2025" in s


def test_inherited_regions_speak_the_scale_mismatch(doc, scripts):
    for r in doc["regions"]:
        if not r.get("cf_inherited_from_ba"):
            continue
        s = scripts[r["region"]].lower()
        assert r["cf_share_actually_describes"].lower() in s
        note = (r.get("scale_mismatch_note") or "").lower()
        # At least one distinctive fragment of the note must be spoken.
        assert "illustrative" in s or "inherits" in s or "parent" in s or note[:40] in s


def test_no_banned_causal_or_sun_phrasing(scripts):
    for region, s in scripts.items():
        low = s.lower()
        for phrase in BANNED_PHRASES:
            assert phrase not in low, f"{region} script contains banned phrase: {phrase!r}"


def test_unknown_region_raises():
    with pytest.raises(KeyError):
        build_script({"regions": []}, "NOPE")
