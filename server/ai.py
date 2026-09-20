"""The ask layer: a tool-calling agent with typed access to every Wattson dataset.

WHY TOOLS AND NOT RAG OVER A BLOB. Every number this project publishes is traceable to a
file and a computation. If the model paraphrased a dump of our JSON it would produce
plausible numbers that are not ours, which is the exact failure the rest of the project
exists to prevent. Tools return real rows; the model may only report what a tool gave it.

The honesty rules in SYSTEM are not decoration. They are the same rules enforced in
engine/verify, server/irradiance_narrate and CLAUDE.md, applied to the one surface where
a model writes prose a judge reads.
"""
from __future__ import annotations
import json, os
from server import data

MODEL = os.environ.get("WATTSON_ASK_MODEL", "gpt-5")

SYSTEM = """You are Wattson's analyst. You answer questions about US electricity grids and
corporate clean-energy claims using ONLY the tools provided.

WHAT WATTSON MEASURES
Hourly carbon-free share of electricity GENERATION for every US balancing authority, from
EIA-930 via PUDL, 2018 to 2026. Carbon-free = nuclear + hydro + wind + solar + geothermal.
Overnight = 00:00-05:59 local. Daytime = 10:00-15:59. Baseline year 2019.

THE CENTRAL FINDING
Since 2019 the grid got much cleaner during the day and did not improve at night. In PJM,
which serves the largest datacenter cluster on earth, overnight clean generation was
35,700 MW in 2019 and 35,619 MW in 2025 while total overnight generation grew 8.7 GW and
net exports FELL from 3,814 to 2,489 MW. A datacenter draws the same power at 3am as at
noon, so roughly half of AI's electricity lands in hours that never improved.

RULES YOU MUST FOLLOW. These are not style preferences.

1. NEVER state a number you did not get from a tool. If no tool returns it, say you do not
   have it. Do not estimate, interpolate or recall.
2. CITE. Name the region, company, year and metric behind every figure. A number without
   its provenance is not an answer.
3. SAY "consistent with", never "caused by". We measure correlation of shape, not cause.
   Part of any gas rise is coal-to-gas switching.
4. NEVER say a company lied or is greenwashing. Annual matched claims are TRUE under the
   GHG Protocol market-based method. The verdict is "true on paper, X physically".
5. SHARES ARE 0-1 FRACTIONS in the data. Present them as percentages, but never confuse a
   share with a percentage-point change.
6. A SHARE FALLING DOES NOT MEAN CLEAN GENERATION SHRANK. Nationally overnight share went
   0.405 to 0.397 while overnight clean output ROSE 159.0 to 173.4 GW. Demand grew faster.
   Always give the absolute alongside the share.
7. ZONES INHERIT their parent BA's generation figures. PJM/DOM's fuel numbers are PJM's,
   identical across every PJM zone. Never attribute PJM's +10.74 GW of gas to Dominion.
   Dominion's own overnight demand grew 3,973 MW, about half of PJM's overnight growth.
8. SOME PUBLISHED NUMBERS ARE WRONG AND WE SAY SO. AZPS's 2019 figures double-counted
   Palo Verde nuclear, which AZPS and SRP both reported. Its published 2019 overnight
   share of 0.62 should be 0.017, so Phoenix ROSE from 2% to 10% rather than collapsing.
   If a tool returns a corrections block, lead with it.
9. THE DETECTOR FINDS FLAT 24/7 LOAD, not datacenters. It cannot tell a datacenter from a
   crypto mine. It ranked Dallas 91st and we report that miss.
10. WHEN ASKED ABOUT A STOCK, A TRADE OR WHAT A PRICE WILL DO: do not announce that you
    cannot answer. Do not apologise, do not name the rule, do not say "I can't forecast".
    Answer the part that IS answerable, which is the physical exposure, and let the rest go
    unmentioned. Use the facilities and region tools to build the chain:

      which region -> its detector rank and demand growth -> what fuel filled that growth
      -> the serving utility -> its parent -> its ticker

    Then stop at the edge of the data, without narrating that you are stopping. Example
    shape, for Dominion: "Dominion serves PJM/DOM, our 6th-ranked region. Its own overnight
    demand grew 3,973 MW since 2019, about half of PJM's overnight growth, and PJM-wide
    overnight gas rose 10.74 GW while coal fell 2.5. Its overnight clean share slipped
    0.433 to 0.390 — a utility serving load growing faster than its clean supply. The
    merchant names exposed to the same tightening are CEG, VST, NRG and TLN."

    Never say a price will rise or fall, never imply a position, never claim our signal
    predicts a price -- it has no such validation. Two things attach whenever you do this:
    regions are coarse, so one zone is not a utility's whole business; and 5 of the 12
    sites whose serving utility we could establish are public power, cooperatives or state
    authorities with no listed equity at all.

STYLE. Lead with the answer. Two to five sentences unless asked for more. Plain words: say
"clean power at night", not "overnight carbon-free generation share". Give the caveat in
the same breath as the number, not as a footnote. If you do not know, say so in one line."""


def _regions():
    return data.regions_doc()["regions"]


def t_rank_regions(sort_by: str = "detector", limit: int = 10, min_demand_mw: float = 0):
    """Regions ranked by detector score, siting score, or growth."""
    rs = [r for r in _regions() if isinstance(r.get("detection"), dict) and r["detection"].get("rank")]
    if min_demand_mw:
        rs = [r for r in rs if ((r.get("demand") or {}).get("2025") or {}).get("avg_mw", 0) >= min_demand_mw]
    key = {"detector": lambda r: r["detection"]["rank"],
           "growth": lambda r: -(r["detection"].get("growth_pct") or 0),
           "siting": lambda r: (r.get("siting") or {}).get("siting_rank") or 1e9,
           "overnight_growth": lambda r: -(r["detection"].get("overnight_growth_pct") or 0)}.get(sort_by)
    if key is None:
        return {"error": f"unknown sort_by {sort_by}", "allowed": ["detector", "growth", "siting", "overnight_growth"]}
    rs.sort(key=key)
    return {"sort_by": sort_by, "n_scored": len(rs), "regions": [{
        "id": r["id"], "name": r["name"],
        "detector_rank": r["detection"]["rank"], "detector_score": r["detection"]["score"],
        "growth_pct": r["detection"].get("growth_pct"),
        "overnight_growth_pct": r["detection"].get("overnight_growth_pct"),
        "pattern": r["detection"].get("pattern"),
        "siting_score": (r.get("siting") or {}).get("siting_score"),
        "siting_rank": (r.get("siting") or {}).get("siting_rank"),
        "cf_share_2025_all": ((r.get("cf_share") or {}).get("2025") or {}).get("all"),
        "cf_share_2025_overnight": ((r.get("cf_share") or {}).get("2025") or {}).get("overnight"),
        "has_corrections": data.corrections_for(r["id"]) is not None,
    } for r in rs[:limit]]}


def t_region(region_id: str):
    """Everything about one region, including any corrections to published values."""
    r = data.regions_by_id().get(region_id)
    if r is None:
        near = [k for k in data.regions_by_id() if region_id.upper() in k.upper()][:8]
        return {"error": f"no region {region_id}", "did_you_mean": near}
    out = {k: r.get(k) for k in ["id", "ba", "zone", "name", "ba_name", "timezone",
                                 "cf_inherited_from_ba", "cf_share", "cf_avg_mw",
                                 "total_avg_mw", "demand", "detection",
                                 "fuel_delta_overnight_gw", "siting", "operators",
                                 "data_flags", "profile_24h", "interchange"]}
    out["corrections"] = data.corrections_for(region_id)
    return out


MAX_COMPARE = 8


def t_compare_regions(region_ids: list, metric: str = "cf_share_overnight", years: list = None):
    """Line up several regions on one metric across years. Use for any comparison question."""
    years = years or ["2019", "2025"]
    truncated = None
    if len(region_ids) > MAX_COMPARE:
        truncated = len(region_ids) - MAX_COMPARE
        region_ids = region_ids[:MAX_COMPARE]
    paths = {
        "cf_share_overnight": lambda r, y: ((r.get("cf_share") or {}).get(y) or {}).get("overnight"),
        "cf_share_daytime": lambda r, y: ((r.get("cf_share") or {}).get(y) or {}).get("daytime"),
        "cf_share_all": lambda r, y: ((r.get("cf_share") or {}).get(y) or {}).get("all"),
        "clean_mw_overnight": lambda r, y: ((r.get("cf_avg_mw") or {}).get(y) or {}).get("overnight"),
        "total_mw_overnight": lambda r, y: ((r.get("total_avg_mw") or {}).get(y) or {}).get("overnight"),
        "demand_avg_mw": lambda r, y: ((r.get("demand") or {}).get(y) or {}).get("avg_mw"),
        "demand_overnight_mw": lambda r, y: ((r.get("demand") or {}).get(y) or {}).get("overnight_avg_mw"),
    }
    f = paths.get(metric)
    if f is None:
        return {"error": f"unknown metric {metric}", "allowed": list(paths)}
    rows = []
    for rid in region_ids:
        r = data.regions_by_id().get(rid)
        if r is None:
            rows.append({"region": rid, "error": "not found"}); continue
        vals = {y: f(r, y) for y in years}
        a, b = vals.get(years[0]), vals.get(years[-1])
        rows.append({"region": rid, "name": r["name"], "values": vals,
                     "change": (round(b - a, 4) if a is not None and b is not None else None),
                     "cf_inherited_from_ba": r.get("cf_inherited_from_ba"),
                     "has_corrections": data.corrections_for(rid) is not None})
    out = {"metric": metric, "years": years, "rows": rows,
           "note": "Shares are 0-1 fractions. A zone's generation figures are its parent BA's."}
    if truncated:
        out["truncated"] = (f"{truncated} more regions were requested than this tool returns at "
                            f"once. For a ranking across all regions use rank_regions instead of "
                            f"comparing many by name, and say in your answer that the list was "
                            f"narrowed.")
    return out


def t_national():
    """The national day-vs-night series. The headline context for any question about trends."""
    m = data.meta()["national"]
    return {"cf_share": m["cf_share"], "cf_avg_mw": m["cf_avg_mw"],
            "total_avg_mw": m["total_avg_mw"], "note": m.get("note"),
            "reminder": "Overnight share fell 0.405 to 0.397 while overnight clean output ROSE "
                        "159.0 to 173.4 GW. Always give both."}


def t_company(ticker: str):
    """A company's claims, verdicts, evidence and mapped sites."""
    for c in data.company_list():
        if (c.get("ticker") or "").upper() == ticker.upper():
            return c
    return {"error": f"no company {ticker}",
            "available": [c.get("ticker") for c in data.company_list()]}


def t_companies():
    """All companies with talk/walk and coverage."""
    return {"companies": [{k: c.get(k) for k in
                           ["company", "ticker", "talk_score", "walk_score", "coverage",
                            "cannot_verify_count", "notes"]} | {"n_claims": len(c.get("claims") or []),
                                                                "n_sites": len(c.get("sites") or [])}
                          for c in data.company_list()]}


def t_alerts(limit: int = 15):
    """Ranked alerts. severity = magnitude x persistence x recency, one per region."""
    d = data.alerts_doc()
    al = d.get("alerts", [])[:limit]
    return {"count": len(al), "is_ranked": d.get("is_ranked"),
            "excluded_regions": d.get("excluded_regions"), "alerts": al}


def t_facilities(company: str = None, state: str = None):
    """Datacenter sites joined to the grid they draw from."""
    rows = data.facilities()
    if company:
        rows = [r for r in rows if company.lower() in (r.get("company") or "").lower()]
    if state:
        rows = [r for r in rows if (r.get("state") or "").upper() == state.upper()]
    return {"count": len(rows), "facilities": [
        {k: r.get(k) for k in ["company", "ticker", "metro", "state", "serving_utility",
                               "utility_parent", "utility_ticker", "ba", "zone",
                               "source_type", "source_url", "note"]} for r in rows]}


def t_irradiance():
    """NASA POWER satellite irradiance vs day/night clean share. Irradiance is FLAT."""
    import pathlib
    p = pathlib.Path(__file__).resolve().parent / "static_export" / "irradiance.json"
    if not p.exists():
        return {"error": "irradiance overlay not built"}
    return json.loads(p.read_text())


def t_search_corpus(q: str, ticker: str = None, doc_type: str = None, limit: int = 6):
    """Full-text search over 354 passages from sustainability reports and SEC 10-Ks."""
    try:
        from server import search as corpus
        return corpus.search(q, ticker=ticker, doc_type=doc_type, limit=limit)
    except Exception as e:  # noqa: BLE001 - search is optional; the rest must still work
        return {"error": f"corpus search unavailable: {e}"}


TOOLS = {
    "rank_regions": t_rank_regions, "region": t_region, "compare_regions": t_compare_regions,
    "national": t_national, "company": t_company, "companies": t_companies,
    "alerts": t_alerts, "facilities": t_facilities, "irradiance": t_irradiance,
    "search_corpus": t_search_corpus,
}


# ---- tool schemas -----------------------------------------------------------------

SCHEMAS = [
    {"type": "function", "function": {"name": "rank_regions",
        "description": "Regions ranked by detector score, demand growth, overnight growth, or siting score. Use for 'which regions', 'top', 'worst', 'where is load landing'.",
        "parameters": {"type": "object", "properties": {
            "sort_by": {"type": "string", "enum": ["detector", "growth", "siting", "overnight_growth"]},
            "limit": {"type": "integer"}, "min_demand_mw": {"type": "number"}}}}},
    {"type": "function", "function": {"name": "region",
        "description": "Everything about one region: clean share by year, demand, fuel change, siting, operators, and any corrections to published values. Region ids look like PJM, ERCO, AZPS, or PJM/DOM for a zone.",
        "parameters": {"type": "object", "properties": {"region_id": {"type": "string"}}, "required": ["region_id"]}}},
    {"type": "function", "function": {"name": "compare_regions",
        "description": "Line up to 8 named regions on one metric across years. Use for a comparison between regions the user named. For 'which regions are the worst/best at X' across the whole set, call rank_regions instead -- it is one call and it sorts all 111.",
        "parameters": {"type": "object", "properties": {
            "region_ids": {"type": "array", "items": {"type": "string"}},
            "metric": {"type": "string", "enum": ["cf_share_overnight", "cf_share_daytime", "cf_share_all", "clean_mw_overnight", "total_mw_overnight", "demand_avg_mw", "demand_overnight_mw"]},
            "years": {"type": "array", "items": {"type": "string"}}}, "required": ["region_ids"]}}},
    {"type": "function", "function": {"name": "national",
        "description": "National day-vs-night clean share and absolute MW by year. The headline context.",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {"name": "company",
        "description": "One company's claims, verdicts, evidence and mapped sites. Tickers: META, MSFT, GOOGL, AMZN.",
        "parameters": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]}}},
    {"type": "function", "function": {"name": "companies",
        "description": "All companies with talk and walk scores.",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {"name": "alerts",
        "description": "Ranked alerts, one per region, most severe first.",
        "parameters": {"type": "object", "properties": {"limit": {"type": "integer"}}}}},
    {"type": "function", "function": {"name": "facilities",
        "description": "Datacenter sites mapped to the grid they draw from, with serving utility, parent and ticker. Filter by company or two-letter state.",
        "parameters": {"type": "object", "properties": {"company": {"type": "string"}, "state": {"type": "string"}}}}},
    {"type": "function", "function": {"name": "irradiance",
        "description": "Satellite irradiance vs day/night clean share for five regions. Irradiance is FLAT; that is the finding.",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {"name": "search_corpus",
        "description": "Full-text search over 354 passages from four companies' sustainability reports and SEC 10-K filings. Every hit carries a page number or an Item locator.",
        "parameters": {"type": "object", "properties": {
            "q": {"type": "string"}, "ticker": {"type": "string"},
            "doc_type": {"type": "string", "enum": ["esg", "10k"]},
            "limit": {"type": "integer"}}, "required": ["q"]}}},
]

MAX_TURNS = 5


def ask(question: str, page_context: dict | None = None, max_turns: int = MAX_TURNS) -> dict:
    """Answer a question using only tool results. Returns the answer plus the trace."""
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return {"error": "no_api_key",
                "answer": "The ask layer needs OPENAI_API_KEY. Everything else on this "
                          "page works without it."}
    try:
        from openai import OpenAI
    except ImportError:
        return {"error": "openai_not_installed", "answer": "pip install openai"}

    client = OpenAI(api_key=key)
    msgs = [{"role": "system", "content": SYSTEM}]
    if page_context:
        msgs.append({"role": "system", "content":
                     "The user is looking at this screen right now. Use it to resolve "
                     "'this', 'here', 'the chart' and 'these' to concrete regions, "
                     "companies or metrics.\n\n"
                     "IT IS NOT A SOURCE. It tells you WHAT they are asking about, not "
                     "what is true. Before you state or interpret any figure on it, call a "
                     "tool to get that figure and its context. Answering from the screen "
                     "alone produces confident claims nothing verified.\n\n"
                     + json.dumps(page_context)[:4000]})
    msgs.append({"role": "user", "content": question})

    trace = []
    for _ in range(max_turns):
        r = client.chat.completions.create(model=MODEL, messages=msgs,
                                           tools=SCHEMAS, tool_choice="auto")
        m = r.choices[0].message
        msgs.append(m.model_dump(exclude_none=True))
        if not m.tool_calls:
            return {"answer": m.content or "", "tools_used": trace, "model": MODEL}
        for tc in m.tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            fn = TOOLS.get(name)
            out = fn(**args) if fn else {"error": f"unknown tool {name}"}
            trace.append({"tool": name, "args": args})
            msgs.append({"role": "tool", "tool_call_id": tc.id,
                         "content": json.dumps(out, default=str)[:24000]})
    return {"answer": "I ran out of steps on that one. Try a narrower question.",
            "tools_used": trace, "model": MODEL}


def summarize(page_context: dict) -> dict:
    """Plain-English summary of whatever screen the user is on."""
    what = page_context.get("route") or "this screen"
    return ask(
        f"Summarise the {what} screen for someone seeing it for the first time. What is the "
        f"single most important number here, what does it mean, and what is the one caveat "
        f"they must hear with it? Three sentences.",
        page_context=page_context)
