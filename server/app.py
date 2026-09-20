"""Wattson API. Serves the frozen analysis; recomputes no grid physics.

POST /api/site is the only live computation, and even it only ranks precomputed scores.
See contracts/api.v1.yaml — it is binding.
"""
from __future__ import annotations
import csv, io, json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from server import data
from server import search as corpus_search
from server import ai as ask_layer
from server import irradiance_narrate as narrate

app = FastAPI(title="Wattson API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DETECTION_KEYS = ["rank", "score", "growth_pct", "overnight_growth_pct", "overnight_excess",
                  "neighbor_divergence", "load_factor_delta", "pattern"]
SITING_KEYS = ["siting_score", "siting_rank", "overnight_cf_share_2025", "change_since_2019",
               "overnight_clean_mw_over_demand", "ratio_slope_per_year"]


def _sub(d, keys):
    d = d or {}
    return {k: d.get(k) for k in keys if k in d}


def _operator(r):
    ops = r.get("operators") or []
    o = ops[0] if ops else {}
    return {"utility": o.get("utility"), "parent": o.get("parent"),
            "ticker": o.get("ticker"), "mapping_note": "hand-mapped"}


def _summary(r):
    return {
        "id": r["id"], "ba": r["ba"], "zone": r.get("zone"), "name": r["name"],
        "ba_name": r.get("ba_name"), "region_eia": r.get("region_eia"),
        "detection": _sub(r.get("detection"), DETECTION_KEYS),
        "siting": _sub(r.get("siting"), SITING_KEYS),
        "cf_share_2025": (r.get("cf_share") or {}).get("2025"),
        "operator": _operator(r),
        "cf_inherited_from_ba": r.get("cf_inherited_from_ba"),
        "exclude_from_alerts": r.get("exclude_from_alerts"),
        "data_flags": r.get("data_flags"),
        "has_corrections": data.corrections_for(r["id"]) is not None,
    }


@app.get("/api/regions")
def get_regions():
    m = data.meta()
    scored = [r for r in data.regions_doc()["regions"]
              if isinstance(r.get("detection"), dict) and r["detection"].get("rank")]
    scored.sort(key=lambda r: r["detection"]["rank"])
    return {
        "meta": {**data.public_meta(),
                 "n_scored": m["detector"]["n_scored"],
                 "detector_method": m["detector"]["method"],
                 "validation_named_in_advance": m["detector"]["validation_named_in_advance"],
                 "pattern_labels": m["pattern_labels"],
                 "data_flags": m["data_flags"],
                 # National day-vs-night series, passed through from the frozen export.
                 # Requested by the UI for the opening sweep. Zero compute: this is
                 # meta.national verbatim, cf_share and cf_avg_mw by year.
                 "national": m["national"]},
        "count": len(scored),
        "regions": [_summary(r) for r in scored],
        "corrections": data.corrections(),
    }


@app.get("/api/region/{region_id:path}")
def get_region(region_id: str):
    r = data.regions_by_id().get(region_id)
    if r is None:
        raise HTTPException(404, f"unknown region id: {region_id}")
    keys = ["id", "ba", "zone", "type", "name", "ba_name", "region_eia", "timezone",
            "cf_inherited_from_ba", "cf_share", "cf_avg_mw", "total_avg_mw", "demand",
            "detection", "fuel_delta_overnight_gw", "overnight_fuel_mw", "siting",
            "operators", "interchange", "data_flags", "exclude_from_alerts",
            "heatmap_uri", "profile_24h", "trailing12"]
    out = {k: r[k] for k in keys if k in r}
    out["operator"] = _operator(r)
    out["heatmap_available"] = data.heatmap_available(r.get("heatmap_uri"))
    # Known-wrong published values, with corrections and evidence. Served alongside the
    # published numbers, never silently substituted for them.
    corr = data.corrections_for(region_id)
    out["corrections"] = corr
    # Apply corrections in place on nested series too. The published values are still
    # served under `corrections`, so nothing is lost -- but a consumer reading
    # region.profile_24h["2019"] directly must not get a figure we have already shown,
    # on the same screen, to be wrong. AZPS was rendering its corrected 2019 share in
    # the header and its published one in the load-shape module.
    applied = []
    for c in ((corr or {}).get("corrections") or []):
        path, val = c.get("path", ""), c.get("corrected")
        if "." not in path or val is None:
            continue
        field, key = path.split(".", 1)
        if field in out and isinstance(out[field], dict) and key in out[field]:
            out[field][key] = val
            applied.append(path)
    out["corrections_applied_paths"] = applied or None
    return {"meta": data.public_meta(), "region": out}


class SiteRequest(BaseModel):
    mw: float = Field(..., description="Load size in MW")
    metros: list[str]
    flat_247: bool = True


@app.post("/api/site")
def post_site(req: SiteRequest):
    """Rank candidate metros for new flat 24/7 load.

    Ranks on the FROZEN siting score already in regions.json. Nothing is re-tuned here.
    One sentence: we rank on how clean the overnight grid is today, whether it is getting
    cleaner, and how much clean headroom is left relative to demand.
    """
    cands, unmapped = [], []
    for metro in req.metros:
        rid = data.METRO_TO_REGION.get(metro.strip().lower())
        r = data.regions_by_id().get(rid) if rid else None
        if r is None:
            unmapped.append(metro)
            cands.append({"metro": metro, "region_id": None, "siting_score": None,
                          "verdict_rank": None, "reason": "no_region_mapping"})
            continue
        s, dt = dict(r.get("siting") or {}), r.get("detection") or {}
        # Apply the corrections overlay. AZPS's published siting components are known
        # wrong -- two of them have the wrong SIGN -- so ranking Phoenix on the published
        # numbers would contradict our own correction on the same screen.
        corr = data.corrections_for(rid) or {}
        applied = {}
        for c in (corr.get("corrections") or []):
            path = c.get("path", "")
            if not path.startswith("siting."):
                continue
            field = path.split(".", 1)[1]
            if field in s and "corrected" in c:
                applied[field] = {"published": s[field], "corrected": c["corrected"],
                                  "confidence": c.get("confidence"),
                                  "evidence": c.get("evidence")}
                s[field] = c["corrected"]
        fd = r.get("fuel_delta_overnight_gw") or {}
        grew = [(k, v) for k, v in fd.items() if isinstance(v, (int, float)) and v > 0]
        filled = max(grew, key=lambda kv: kv[1]) if grew else (None, None)
        cands.append({
            "metro": metro, "region_id": rid, "name": r["name"], "reason": None,
            "siting_score": s.get("siting_score"), "siting_rank": s.get("siting_rank"),
            "corrections_applied": applied or None,
            "components": {
                "level_overnight_cf_share_2025": s.get("overnight_cf_share_2025"),
                "direction_ratio_slope_per_year": s.get("ratio_slope_per_year"),
                "headroom_overnight_clean_mw_over_demand": s.get("overnight_clean_mw_over_demand"),
                "change_since_2019": s.get("change_since_2019"),
            },
            "detector": _sub(dt, DETECTION_KEYS),
            "fuel_that_filled_growth": {"fuel": filled[0], "gw": filled[1]},
            "fuel_delta_overnight_gw": fd,
            "operator": _operator(r),
            "cf_inherited_from_ba": r.get("cf_inherited_from_ba"),
            "data_flags": r.get("data_flags"),
        })
    scored = [c for c in cands if c.get("siting_score") is not None]
    scored.sort(key=lambda c: -c["siting_score"])
    for i, c in enumerate(scored, 1):
        c["verdict_rank"] = i
    ordered = scored + [c for c in cands if c.get("siting_score") is None]
    return {
        "request": req.model_dump(),
        "method": ("Ranked on overnight carbon-free share today, whether it is improving, and "
                   "overnight clean MW relative to overnight demand. Frozen siting score from "
                   "the published index; no re-tuning. Where a published value is known to be "
                   "wrong, the correction is applied and both values are returned in "
                   "corrections_applied."),
        "candidates": ordered,
        "unmapped_metros": unmapped,
        "caveats": data.meta()["caveats"],
    }


@app.get("/api/alerts")
def get_alerts():
    d = data.alerts_doc()
    alerts = d.get("alerts", [])
    if d.get("is_ranked"):
        alerts = sorted(alerts, key=lambda a: -(a.get("severity") or 0))
    return {"generated": d.get("generated"), "latest_month": d.get("latest_month"),
            "is_ranked": d.get("is_ranked"), "count": len(alerts),
            "count_before_ranking": d.get("count_before_ranking", len(alerts)),
            "excluded_regions": d.get("excluded_regions", []),
            "rules": d.get("rules"), "alerts": alerts}


@app.get("/api/companies")
def get_companies():
    d = data.companies_doc()
    rows = []
    for c in data.company_list():
        claims = c.get("claims") or []
        rows.append({"company": c.get("company"), "ticker": c.get("ticker"),
                     "talk_score": c.get("talk_score"), "walk_score": c.get("walk_score"),
                     "coverage": c.get("coverage"),
                     "unverifiable_share": c.get("unverifiable_share"),
                     "cannot_verify_count": sum(1 for x in claims
                                                if x.get("verdict") == "cannot_verify"),
                     "n_sites": len(c.get("sites") or []), "n_claims": len(claims),
                     "is_mock": bool(c.get("_mock") or d["is_mock"])})
    return {"is_mock": d["is_mock"], "count": len(rows),
            "cannot_verify_total": sum(r["cannot_verify_count"] for r in rows),
            "companies": rows,
            "notes": ["grid-only, excludes PPAs", "unweighted across sites",
                      "site mapping hand-curated"]}


@app.get("/api/company/{ticker}")
def get_company(ticker: str):
    for c in data.company_list():
        if (c.get("ticker") or "").upper() == ticker.upper():
            out = dict(c)
            out["is_mock"] = bool(c.get("_mock") or data.companies_doc()["is_mock"])
            return out
    raise HTTPException(404, f"unknown ticker: {ticker}")


@app.get("/api/search")
def get_search(q: str, ticker: str | None = None, doc_type: str | None = None,
               quality_flag: str | None = None, limit: int = corpus_search.DEFAULT_LIMIT):
    """Search verified ESG and 10-K passages, returning every stored citation field."""
    try:
        return corpus_search.search(q, ticker=ticker, doc_type=doc_type,
                                    quality_flag=quality_flag, limit=limit)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except corpus_search.SearchUnavailable as exc:
        # Retrieval is optional to the grid demo; an offline cloud must not crash it.
        raise HTTPException(503, str(exc)) from exc


@app.get("/api/search/status")
def get_search_status():
    """Index/corpus counts used to verify retrieval coverage during the demo."""
    return corpus_search.status()


def _csv(rows, cols):
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=cols, extrasaction="ignore")
    w.writeheader()
    w.writerows(rows)
    return buf.getvalue()


@app.get("/api/export/{kind}.csv")
def get_export(kind: str):
    if kind == "regions":
        cols = ["id", "ba", "zone", "name", "detector_rank", "detector_score", "growth_pct",
                "overnight_growth_pct", "overnight_excess", "pattern", "siting_score",
                "siting_rank", "overnight_cf_share_2025", "ratio_slope_per_year",
                "utility", "parent", "ticker", "cf_inherited_from_ba"]
        rows = []
        for r in get_regions()["regions"]:
            d, s, o = r["detection"], r["siting"], r["operator"]
            rows.append({"id": r["id"], "ba": r["ba"], "zone": r["zone"], "name": r["name"],
                         "detector_rank": d.get("rank"), "detector_score": d.get("score"),
                         "growth_pct": d.get("growth_pct"),
                         "overnight_growth_pct": d.get("overnight_growth_pct"),
                         "overnight_excess": d.get("overnight_excess"),
                         "pattern": d.get("pattern"), "siting_score": s.get("siting_score"),
                         "siting_rank": s.get("siting_rank"),
                         "overnight_cf_share_2025": s.get("overnight_cf_share_2025"),
                         "ratio_slope_per_year": s.get("ratio_slope_per_year"),
                         "utility": o["utility"], "parent": o["parent"], "ticker": o["ticker"],
                         "cf_inherited_from_ba": r["cf_inherited_from_ba"]})
    elif kind == "alerts":
        cols = ["region", "name", "rule", "severity", "first_crossed", "months_active_streak",
                "current_value", "threshold", "baseline_2019", "description"]
        rows = get_alerts()["alerts"]
    elif kind == "companies":
        cols = ["company", "ticker", "claim_id", "verbatim", "source_doc", "page", "year",
                "metric", "magnitude", "scope", "falsifiability", "verdict",
                "cannot_verify_reason", "physical_min", "physical_max",
                "physical_mean_unweighted"]
        rows = []
        for c in data.company_list():
            for cl in c.get("claims") or []:
                rows.append({"company": c.get("company"), "ticker": c.get("ticker"), **cl})
    else:
        raise HTTPException(404, f"unknown export kind: {kind}")
    return Response(_csv(rows, cols), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{kind}.csv"'})


@app.get("/api/health")
def health():
    return {"ok": True, "regions": len(data.regions_by_id()),
            "companies_are_mock": data.companies_doc()["is_mock"],
            "alerts_are_ranked": data.alerts_doc()["is_ranked"]}


@app.get("/api/irradiance")
def get_irradiance():
    """NASA POWER surface irradiance overlay on daytime vs overnight clean share.

    Precomputed illustration. Irradiance is flat; that is the finding. See
    claims/derived/irradiance.json and the honesty caveats in the payload.
    """
    try:
        return data.irradiance_doc()
    except FileNotFoundError as e:
        raise HTTPException(404, str(e)) from e


class NarrateRequest(BaseModel):
    region: str = Field(..., description="Region id as in irradiance.json, e.g. ERCO/NRTH")
    voice_id: str = Field("leo", description="xAI TTS voice id (leo = instructional)")


@app.get("/api/irradiance/script/{region_id:path}")
def get_irradiance_script(region_id: str):
    """Return the spoken script for one region (no TTS). Useful for transcripts."""
    try:
        doc = data.irradiance_doc()
    except FileNotFoundError as e:
        raise HTTPException(404, str(e)) from e
    try:
        script = narrate.build_script(doc, region_id)
    except KeyError:
        raise HTTPException(404, f"unknown irradiance region: {region_id}") from None
    return {"region": region_id, "script": script, "chars": len(script)}


@app.post("/api/irradiance/narrate")
def post_irradiance_narrate(req: NarrateRequest):
    """Generate a Grok Voice narration for one irradiance region from the data."""
    try:
        doc = data.irradiance_doc()
    except FileNotFoundError as e:
        raise HTTPException(404, str(e)) from e
    try:
        script = narrate.build_script(doc, req.region)
    except KeyError:
        raise HTTPException(404, f"unknown irradiance region: {req.region}") from None
    try:
        audio = narrate.synthesize(script, voice_id=req.voice_id)
    except RuntimeError as e:
        raise HTTPException(503, str(e)) from e
    return Response(
        audio,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": f'inline; filename="{req.region.replace("/", "_")}.mp3"',
            "X-Wattson-Script-Chars": str(len(script)),
        },
    )


@app.get("/api/facilities")
def get_facilities():
    """Datacenter sites joined to the grid they actually draw from.

    The chain the UI filters on: AI operator -> site -> serving utility -> parent
    company -> ticker -> the balancing authority we score.
    """
    rows = []
    for f in data.facilities():
        r = data.regions_by_id().get(f.get("zone") or f["ba"]) or data.regions_by_id().get(f["ba"])
        cf = ((r.get("cf_share") or {}).get("2025") or {}).get("all") if r else None
        det = (r.get("detection") or {}) if r else {}
        rows.append({
            "company": f["company"], "ticker": f["ticker"],
            "metro": f["metro"], "state": f["state"],
            "lat": float(f["lat"]) if f.get("lat") else None,
            "lon": float(f["lon"]) if f.get("lon") else None,
            "serving_utility": f["serving_utility"],
            "utility_parent": f.get("utility_parent") or None,
            "utility_ticker": f.get("utility_ticker") or None,
            "ba": f["ba"], "zone": f["zone"] or None, "pjm_zone": f["zone"] or None,
            "region_id": (f["zone"] or f["ba"]),
            "cf_share_2025": cf,
            "detector_rank": det.get("rank"), "detector_score": det.get("score"),
            "growth_pct": det.get("growth_pct"),
            "source_type": f["source_type"], "source_url": f["source_url"],
            "note": f.get("note") or None,
        })
    # Two different things, deliberately not conflated: a site whose serving utility is
    # KNOWN and has no listed equity (public power, a cooperative, a state authority) is
    # a finding. A site whose serving utility we could not establish is a coverage gap.
    # Counting them together would inflate the finding with our own ignorance.
    resolved = [r for r in rows if r["serving_utility"]]
    no_equity = [r for r in resolved if not r["utility_ticker"]]
    unresolved = [r for r in rows if not r["serving_utility"]]
    return {
        "count": len(rows),
        "facilities": rows,
        "no_listed_equity_count": len(no_equity),
        "resolved_count": len(resolved),
        "unresolved_utility_count": len(unresolved),
        "notes": [
            "Sites are mapped from the serving utility outward, never inferred from the state.",
            "utility_parent and utility_ticker describe the SERVING UTILITY's owner, not the "
            "datacenter operator.",
            f"{len(no_equity)} of the {len(resolved)} sites whose serving utility we could "
            "establish are served by public power districts, member-owned cooperatives or "
            "state authorities with no listed equity. Cheap hydro and wind sit "
            "disproportionately with public power, so a material share of this buildout lands "
            "where there is no stock to trade.",
            f"A further {len(unresolved)} sites have no serving utility recorded. That is a "
            "coverage gap in our research, not a finding about the site, and it is counted "
            "separately so it cannot inflate the figure above.",
            "Coverage is partial and hand-curated. Absence of a site is not evidence it does "
            "not exist.",
        ],
    }


class AskRequest(BaseModel):
    q: str
    page: dict | None = Field(default=None, description="What the user is looking at now")


@app.post("/api/ask")
def post_ask(req: AskRequest):
    """Answer a question using ONLY typed tools over the published datasets.

    The model may not state a number a tool did not return. This is the one surface where
    a model writes prose a reader takes as ours, so the honesty rules -- consistent with
    rather than caused by, never 'they lied', share alongside absolute, zones inherit
    their parent's generation -- are enforced in the system prompt and the tools return
    the same rows the charts draw.
    """
    if not (req.q or "").strip():
        return {"answer": "Ask me something about a grid region, a company claim, or a comparison.",
                "tools_used": []}
    return ask_layer.ask(req.q.strip(), page_context=req.page)


@app.post("/api/ask/summarize")
def post_summarize(req: AskRequest):
    """Plain-English summary of the screen the user is on."""
    return ask_layer.summarize(req.page or {"route": req.q})


@app.get("/api/ask/status")
def get_ask_status():
    """Whether the ask layer is available. The UI hides it rather than failing when not."""
    import os
    return {"available": bool(os.environ.get("OPENAI_API_KEY")),
            "model": ask_layer.MODEL, "tools": sorted(ask_layer.TOOLS)}


@app.get("/api/alpha")
def get_alpha():
    """The chain from a metered grid measurement to a tradable instrument.

    region -> fuel that filled its growth -> serving utility -> parent -> ticker
    -> the markets where that region's tightness is priced.

    An INPUT to a trade, not a trade. No forecast, no backtest, no
    recommendation: we have no validation that this signal predicts any price.
    Every instrument row carries a reason citing a number from our own data.

    The Kalshi snapshot is read from a build-time cache, never fetched here.
    Kalshi's read API needs no auth, so no secret is involved at any layer.
    """
    from engine.alpha import build as alpha_build
    return alpha_build.build()


@app.get("/")
def root():
    """The API root. The site itself lives elsewhere -- this host only answers questions."""
    return {
        "service": "Wattson API",
        "site": "https://shrishantrh.github.io/wattson/",
        "what_this_is": ("The ask layer behind Cmd-K on the site, plus corpus search. Every "
                         "screen renders without it; this only answers questions."),
        "endpoints": ["/api/health", "/api/ask/status", "/api/ask", "/api/ask/summarize",
                      "/api/regions", "/api/region/{id}", "/api/site", "/api/alerts",
                      "/api/companies", "/api/company/{ticker}", "/api/facilities",
                      "/api/irradiance", "/api/alpha", "/api/search", "/api/export/{kind}.csv"],
        "docs": "/docs",
    }
