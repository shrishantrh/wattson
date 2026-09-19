"""Build a spoken narration for one irradiance overlay region.

Scripts are generated from claims/derived/irradiance.json — every figure is
read from the file. Tone is investigative: set the national finding, land the
satellite null result, then the region's day/night split and honest verdict.

Banned phrases are enforced by tests/test_irradiance_narrate.py.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path

BANNED_PHRASES = (
    "brighter",
    "got brighter",
    "sun changed",
    "sunlight increased",
    "sun got",
    "explained by",
    "caused by",
    "because of the sun",
    "due to irradiance",
    "attributable to",
    "r-squared",
    "r squared",
    "correlation",
    "% explained",
    "percent explained",
)

# Spoken verdict labels — must still contain the raw verdict token (or spaced form)
# for the honesty tests.
VERDICT_OPEN = {
    "supports": (
        "Verdict: supports. Daytime clean share moved while overnight barely did, "
        "and the satellite record stayed flat — the shape we expected if solar "
        "capacity, not weather, is what changed."
    ),
    "does_not_separate": (
        "Verdict: does not separate. Day and night moved together here. "
        "That is what a wind-led grid looks like — not a clean solar day-night split."
    ),
    "contradicts": (
        "Verdict: contradicts. This footprint does not show the clean daytime-up, "
        "overnight-flat pattern. We keep it on screen anyway."
    ),
    "unusable": (
        "Verdict: unusable. The generation-side series for this region is under "
        "correction. Demand-side evidence still stands; generation-side overlay does not."
    ),
}


def _pts(v: float) -> str:
    return f"{v:+.1f} points"


def _pct(v: float) -> str:
    return f"{v:+.2f} percent" if abs(v) >= 0.005 else "essentially zero percent"


def _share_pct(v: float) -> str:
    """0-1 share → spoken percent with one decimal."""
    return f"{v * 100:.1f} percent"


def _kwh(v: float) -> str:
    return f"{v:.2f} kilowatt-hours per square meter per day"


def build_script(doc: dict, region_id: str) -> str:
    """Return a documentary spoken script for `region_id` from an irradiance.json doc."""
    regions = {r["region"]: r for r in doc.get("regions") or []}
    if region_id not in regions:
        raise KeyError(region_id)
    r = regions[region_id]
    irr = r["irradiance"]
    cf = r["cf_share"]
    name = r.get("name") or region_id
    point = r.get("point") or {}
    place = point.get("place") or "a representative point"
    verdict = r["verdict"]
    nat = doc.get("national_reference") or {}
    n19, n25 = nat.get("2019") or {}, nat.get("2025") or {}

    y0 = str(doc.get("baseline_year") or "2019")
    y1 = str(doc.get("compare_year") or "2025")

    parts: list[str] = []

    # --- national cold open (same finding every time; grounds the region) ---
    if n19 and n25:
        parts.append(
            f"National context first. From {y0} to {y1}, daytime carbon-free share of "
            f"US generation rose from {_share_pct(n19['daytime'])} to {_share_pct(n25['daytime'])}. "
            f"Overnight went from {_share_pct(n19['overnight'])} to {_share_pct(n25['overnight'])} — "
            f"essentially flat. The grid got cleaner in daylight and stood still at night."
        )

    # --- region + satellite null result ---
    parts.append(
        f"Now the satellite check for {region_id} — {name}. "
        f"NASA POWER surface irradiance at {place}, "
        f"{point.get('lat', '?')} north, {abs(point.get('lon', 0)):.2f} west. "
        f"One hand-picked point, not a centroid, not the whole footprint."
    )
    parts.append(
        f"Annual mean irradiance was {_kwh(irr['annual_mean'][y0])} in {y0} and "
        f"{_kwh(irr['annual_mean'][y1])} in {y1}. "
        f"Year-to-year variation — the flatness band — is "
        f"{irr['year_to_year_variation_pct']:.2f} percent. "
        f"The {y0} to {y1} endpoint change is {_pct(irr['change_pct_2019_2025'])}. "
        f"Those are different statistics. Both say the same thing: irradiance is flat. "
        f"The solar resource in {y1} is the same resource that was there in {y0}."
    )

    # --- day vs night on this footprint ---
    d0, d1 = cf[y0]["daytime"], cf[y1]["daytime"]
    o0, o1 = cf[y0]["overnight"], cf[y1]["overnight"]
    parts.append(
        f"On the generation side: daytime carbon-free share moved from "
        f"{_share_pct(d0)} to {_share_pct(d1)} — a change of {_pts(cf['daytime_change_pts'])}. "
        f"Overnight moved from {_share_pct(o0)} to {_share_pct(o1)} — "
        f"{_pts(cf['overnight_change_pts'])}."
    )

    # Contrast line when daytime dwarfs overnight (the money shot)
    day_pts = abs(cf["daytime_change_pts"])
    night_pts = abs(cf["overnight_change_pts"])
    if day_pts >= 5 and day_pts >= 3 * max(night_pts, 0.1) and cf["daytime_change_pts"] > 0:
        parts.append(
            f"Same years. Same satellite. Daytime moved about "
            f"{day_pts / max(night_pts, 0.1):.0f} times as far as overnight, in percentage points. "
            f"That is the diurnal signature — capacity built to catch daylight, not a change in the sun."
        )

    # --- scale mismatch spoken aloud ---
    if r.get("cf_inherited_from_ba"):
        ba = r.get("cf_share_actually_describes") or "the parent balancing authority"
        note = r.get("scale_mismatch_note")
        parts.append(
            note
            or (
                f"Important: {region_id} is a zone. It inherits carbon-free share from {ba}. "
                f"The irradiance point is local; the share describes a much larger grid. "
                f"Treat the pairing as illustrative."
            )
        )

    # --- verdict + region-specific honesty ---
    parts.append(VERDICT_OPEN.get(verdict, f"Verdict: {verdict.replace('_', '')}."))

    if verdict == "unusable" and r.get("data_caveat"):
        parts.append(r["data_caveat"])
    elif r.get("why_it_does_not_support", {}).get("reading"):
        reading = r["why_it_does_not_support"]["reading"]
        if r["why_it_does_not_support"].get("post_hoc"):
            parts.append(f"Post-hoc reading — marked as after-the-fact: {reading}")
        else:
            parts.append(reading)

    # --- close ---
    n_support = len((doc.get("conclusion") or {}).get("supporting_regions") or [])
    n_all = len(doc.get("regions") or [])
    parts.append(
        f"Across all {n_all} points we checked, irradiance is flat everywhere. "
        f"Only {n_support} of {n_all} regions separate day from night cleanly. "
        f"We show the failures too. "
        f"The resource was always there in the day and never at night. "
        f"What changed is capacity built to catch it — not the sunlight itself."
    )
    return " ".join(parts)


def _load_wattson_env(path: Path | None = None) -> None:
    """Load ~/.wattson.env without overwriting variables already in the process."""
    path = path or Path.home() / ".wattson.env"
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key, val = key.strip(), val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


def synthesize(text: str, *, voice_id: str = "leo", language: str = "en") -> bytes:
    """Call xAI Grok TTS. Returns MP3 bytes. Raises RuntimeError on config/API failure.

    Default voice is leo (authoritative / instructional) — better for evidence narration
    than the conversational default.
    """
    import ssl
    _load_wattson_env()
    key = os.environ.get("XAI_API_KEY")
    if not key:
        raise RuntimeError("XAI_API_KEY is not set (export it or put it in ~/.wattson.env)")
    body = json.dumps({
        "text": text,
        "voice_id": voice_id,
        "language": language,
        "text_normalization": True,
    }).encode()
    req = urllib.request.Request(
        "https://api.x.ai/v1/tts",
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    # macOS python.org builds often ship without a usable CA store; prefer certifi.
    try:
        import certifi
        ctx = ssl.create_default_context(cafile=certifi.where())
    except Exception:
        ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=90, context=ctx) as res:
            return res.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:400]
        raise RuntimeError(f"xAI TTS HTTP {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"xAI TTS unreachable: {e.reason}") from e
