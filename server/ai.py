"""The ask layer: a tool-calling agent with typed access to every Wattson dataset.

WHY TOOLS AND NOT RAG OVER A BLOB. Every number this project publishes is traceable to a
file and a computation. If the model paraphrased a dump of our JSON it would produce
plausible numbers that are not ours, which is the exact failure the rest of the project
exists to prevent. Tools return real rows; the model may only report what a tool gave it.

The honesty rules in SYSTEM are not decoration. They are the same rules enforced in
engine/verify, server/irradiance_narrate and CLAUDE.md, applied to the one surface where
a model writes prose a judge reads.

WHY A SECOND CALL RENDERS A VIEW. A paragraph is the wrong answer to "compare ERCOT, PJM
and CAISO at night": the reader wants the three numbers side by side. So after the tool
loop finishes, one more call turns the answer it just wrote into a view spec -- columns,
rows, an optional chart -- as strict JSON. That call gets NO tools, so it cannot fetch a
new figure, and every number it emits is checked against the numbers the tools actually
returned in this conversation (_grounding_index below). A view whose figures are all
unaccounted for is dropped and the prose is served instead. The prose is always returned.
"""
from __future__ import annotations
import bisect, json, os, re
from server import data

# gpt-4.1 answers the same questions with the same tool calls in ~2s where gpt-5
# takes ~13s. Measured, not assumed, against the four questions in the test below.
MODEL = os.environ.get("WATTSON_ASK_MODEL", "gpt-4.1")

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

    Then stop at the edge of the data, without narrating that you are stopping.

    CALL THE TOOLS. Do not answer this from memory or from the examples in this prompt.
    The shape is: "<utility> serves <region>, our <rank>-ranked region. Its own overnight
    demand grew <X> MW since 2019, <share> of <parent BA>'s overnight growth, and <parent>
    -wide overnight gas rose <Y> GW while coal fell <Z>. Its overnight clean share moved
    <a> to <b> — a utility serving load growing faster than its clean supply. The merchant
    names exposed to the same tightening are <tickers from the operator table>."
    Every one of those placeholders comes from region(), facilities() or rank_regions().
    An answer with no tool call is an answer you invented, however right it sounds.

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


# Sorts whose metric is derived from GENERATION. A zone reports demand only and inherits
# its parent BA's generation, so several zones of one BA carry byte-identical figures: rank
# them together and one grid is presented as five findings. The demand-side sorts are the
# opposite case -- a zone's demand is its own, and Dominion placing 6th inside PJM is the
# whole point of the detector -- so those must NOT collapse.
_GENERATION_SORTS = {"siting"}


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
    note = None
    if sort_by in _GENERATION_SORTS:
        # Keep the PARENT row where we have it: the figure describes the whole BA, so it
        # should be labelled "Southwest Power Pool", not whichever of its zones sorted first.
        have_parent = {r["id"] for r in rs if not r.get("zone")}
        kept, seen = [], set()
        for r in rs:
            ba = r.get("ba") or r["id"]
            if ba in seen or (r.get("zone") and ba in have_parent):
                continue
            seen.add(ba)
            kept.append(r)
        dropped = len(rs) - len(kept)
        rs = kept
        if dropped:
            note = (f"{sort_by} is computed from generation, and zones report demand only -- they "
                    f"inherit their parent BA's generation and so its {sort_by} figures. {dropped} "
                    f"zones were collapsed into their parent so one grid is not listed several "
                    f"times. Say the ranking is by balancing authority.")
    return {"sort_by": sort_by, "n_scored": len(rs), "note": note, "regions": [{
        "id": r["id"], "name": r["name"],
        "ba": r.get("ba"), "is_zone": bool(r.get("zone")),
        "cf_inherited_from_ba": bool(r.get("cf_inherited_from_ba")),
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


# ---- the render step: the answer as a view, not a paragraph ------------------------

RENDER_PROMPT = """Now render the answer you just gave as a VIEW SPEC the interface can draw.

Reply with ONE JSON object and nothing else. No prose around it, no markdown fence.

YOU HAVE NO TOOLS IN THIS STEP. Every value you put in "rows" or "chart" MUST already
appear in a tool result above, or in the answer you just wrote. Do not compute, convert,
average, interpolate, estimate or recall any figure that is not already in this
conversation. A cell you cannot fill from the transcript you leave out; a cell you invent
is the exact failure this project exists to catch. The ONE conversion allowed is a 0-1
share to a percentage number: 0.397 becomes 39.7 with unit "%".

The shape:

{
  "headline": "the answer as a phrase, at most 80 characters, no trailing full stop",
  "summary":  "one or two sentences. The caveat rides with the number, not after it.",
  (read the rows back before writing those two: a headline saying every region fell, over a
   table where one rose, is the same failure as an invented number)
  "kind":     "comparison" | "ranking" | "single" | "prose",
  "columns":  [{"key": "short_snake_case", "label": "plain words", "unit": "%|pp|MW|GW|rank|score|"}],
  "rows":     [{"label": "the thing", "href": "#/region/PJM/DOM", "values": {"col_key": 39.7}}],
  "chart":    {"type": "bars"|"lines", "series": [{"label": "...", "points": [{"x": "2019", "y": 43.3}]}]} or null,
  "caveats":  ["short honest notes that actually apply to THESE numbers"],
  "sources":  ["the tool names you used"]
}

CHOOSING kind:
  comparison  the user named several things and wants them beside each other. One row each.
  ranking     an ordered list over many regions. Keep the tool's order; a rank column first.
  single      one subject. Return exactly ONE row, its figures in that row's values.
  prose       nothing tabular -- a method question, a definition, an answer that is a
              sentence. Then "rows": [] and "columns": [], and the paragraph is served.

COLUMNS. Two to five of them. Label them in words a reader knows ("clean at night, 2025"),
not field names. Give the unit. When you show a share, ALSO show the absolute MW or GW
beside it if a tool returned one -- a share falling is not clean generation shrinking.
Never repeat the row's own name as a column: the label is already the first column. A rank
column must be a rank a tool RETURNED (the detector rank, the siting rank) and must say
which -- never the position of the row in the list you just wrote.

ROWS. "href" deep-links into the app: "#/region/<id>" with the id spelled exactly as the
tools spell it (PJM, ERCO/NCEN, PJM/DOM -- do not url-encode the slash), or
"#/check/<TICKER>" for a company. Omit href when you do not know the id.

CHART. "bars" compares one value across the rows; "lines" is a value over years, one series
per thing. null when a chart would add nothing. Chart y values obey the same rule: from the
transcript only.

CAVEATS. One to three, and only the ones that bear on these numbers: that a zone's
generation figures are its parent BA's, that a share is not output, a correction a tool
returned, the coarseness of a region. Not a generic disclaimer."""

VIEW_KINDS = {"comparison", "ranking", "single", "prose"}
MAX_ROWS, MAX_COLS, MAX_SERIES, MAX_POINTS = 24, 6, 6, 40
HREF_OK = re.compile(r"^#/[A-Za-z0-9/_\-.%?=&]{1,120}$")
_NUM = re.compile(r"-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?")
# A model rounds (0.3966 -> 39.7) and rescales (MW -> GW), so grounding is checked against
# the transcript at those scales with a 2% tolerance. This is a guard against invention,
# not a proof of provenance: it catches a figure that resembles nothing a tool returned.
SCALES = (1.0, 100.0, 0.01, 1000.0, 0.001)
GROUND_TOL = 0.02


def _num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _grounding_index(msgs) -> list:
    """Every number the tools returned in this conversation, at the scales a model may use."""
    raw = set()
    for m in msgs:
        if not isinstance(m, dict) or m.get("role") != "tool":
            continue
        for t in _NUM.findall(str(m.get("content") or "")):
            try:
                raw.add(float(t))
            except ValueError:
                pass
    return sorted({round(x * s, 9) for x in raw for s in SCALES})


def _grounded(v: float, idx: list) -> bool:
    if not idx:
        return False
    i = bisect.bisect_left(idx, v)
    for j in (i - 1, i):
        if 0 <= j < len(idx):
            u = idx[j]
            if abs(v - u) <= max(GROUND_TOL * abs(u), 1e-9):
                return True
    return False


def _href(h):
    h = str(h or "").strip()
    return h if HREF_OK.match(h) else None


def _coerce_chart(c):
    if not isinstance(c, dict) or c.get("type") not in ("bars", "lines"):
        return None
    series = []
    for s in (c.get("series") or [])[:MAX_SERIES]:
        if not isinstance(s, dict):
            continue
        pts = []
        for p in (s.get("points") or [])[:MAX_POINTS]:
            if isinstance(p, dict) and _num(p.get("y")) and p.get("x") is not None:
                pts.append({"x": p["x"] if _num(p["x"]) else str(p["x"])[:60], "y": float(p["y"])})
        if pts:
            series.append({"label": str(s.get("label") or "")[:60], "points": pts})
    return {"type": c["type"], "series": series} if series else None


def _coerce_view(obj, question: str, idx: list) -> dict | None:
    """Structure-check the model's JSON and reject anything it could not have measured.

    Returns None whenever the view would not beat the paragraph: wrong shape, no rows, or
    figures that match nothing any tool returned.
    """
    if not isinstance(obj, dict):
        return None
    kind = str(obj.get("kind") or "").strip().lower()
    if kind not in VIEW_KINDS or kind == "prose":
        return None

    cols, keys = [], []
    for c in (obj.get("columns") or [])[:MAX_COLS]:
        if not isinstance(c, dict):
            continue
        k = str(c.get("key") or "").strip()[:40]
        if not k or k in keys:
            continue
        keys.append(k)
        cols.append({"key": k, "label": str(c.get("label") or k).strip()[:48],
                     "unit": str(c.get("unit") or "").strip()[:8]})

    rows = []
    for r in (obj.get("rows") or [])[:MAX_ROWS]:
        if not isinstance(r, dict):
            continue
        label = str(r.get("label") or "").strip()[:80]
        if not label:
            continue
        vals = {}
        for k, v in (r.get("values") or {}).items():
            k = str(k)[:40]
            if keys and k not in keys:
                continue
            if _num(v):
                vals[k] = float(v)
            elif isinstance(v, str) and v.strip():
                vals[k] = v.strip()[:60]
        row = {"label": label, "values": vals}
        h = _href(r.get("href"))
        if h:
            row["href"] = h
        rows.append(row)
    if not rows:
        return None
    if not cols:
        cols = [{"key": k, "label": k.replace("_", " "), "unit": ""}
                for k in list(rows[0]["values"])[:MAX_COLS]]
    # A column that just restates the row's own name is a column of noise: the label is
    # already the first thing on the row.
    cols = [c for c in cols
            if not all(str(r["values"].get(c["key"], "")) == r["label"] for r in rows)]
    if not cols:
        return None
    keys = [c["key"] for c in cols]
    for r in rows:
        r["values"] = {k: v for k, v in r["values"].items() if k in keys}
    if not any(r["values"] for r in rows):
        return None

    chart = _coerce_chart(obj.get("chart"))
    figures = [v for r in rows for v in r["values"].values() if _num(v)]
    figures += [p["y"] for s in (chart or {}).get("series", []) for p in s["points"]]
    unverified = [v for v in figures if not _grounded(v, idx)]
    # Every figure unaccounted for means the render step wrote its own numbers. Serve the
    # prose instead: a wrong table is worse than a right paragraph.
    if figures and len(unverified) == len(figures):
        return None
    return {
        "question": question,
        "kind": kind,
        "headline": str(obj.get("headline") or "").strip()[:120],
        "summary": str(obj.get("summary") or "").strip()[:600],
        "columns": cols,
        "rows": rows,
        "chart": chart,
        "caveats": [str(x).strip()[:240] for x in (obj.get("caveats") or [])[:4] if str(x).strip()],
        "sources": [str(x).strip()[:40] for x in (obj.get("sources") or [])[:12] if str(x).strip()],
        "values_checked": len(figures),
        "unverified_value_count": len(unverified),
    }


def _render_view(client, msgs, question: str, trace: list) -> dict | None:
    """One extra call, no tools, JSON only. Any failure returns None and the prose stands."""
    try:
        r = client.chat.completions.create(
            model=MODEL, temperature=0,
            response_format={"type": "json_object"},
            messages=msgs + [{"role": "user", "content": RENDER_PROMPT}])
        raw = r.choices[0].message.content or ""
        view = _coerce_view(json.loads(raw), question, _grounding_index(msgs))
        if view is not None:
            # The sources line is what actually ran, not what the model remembers running.
            view["sources"] = list(dict.fromkeys(t["tool"] for t in trace))
        return view
    except Exception:  # noqa: BLE001 - the view is an enhancement; the answer is the product
        return None


def ask(question: str, page_context: dict | None = None, max_turns: int = MAX_TURNS,
        render: bool = True) -> dict:
    """Answer a question using only tool results. Returns the answer plus the trace."""
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return {"error": "no_api_key", "view": None,
                "answer": "The ask layer needs OPENAI_API_KEY. Everything else on this "
                          "page works without it."}
    try:
        from openai import OpenAI
    except ImportError:
        return {"error": "openai_not_installed", "view": None, "answer": "pip install openai"}

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
            # No tool ran, so there is nothing to tabulate and nothing to ground a view in.
            view = _render_view(client, msgs, question, trace) if (render and trace) else None
            return {"answer": m.content or "", "view": view,
                    "tools_used": trace, "model": MODEL}
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
            "view": None, "tools_used": trace, "model": MODEL}


def summarize(page_context: dict) -> dict:
    """Plain-English summary of whatever screen the user is on.

    Prose on purpose: the summary is read in the palette, over the screen it describes, and
    sending the reader to a table of the screen they are already looking at helps nobody.
    """
    what = page_context.get("route") or "this screen"
    return ask(
        f"Summarise the {what} screen for someone seeing it for the first time. What is the "
        f"single most important number here, what does it mean, and what is the one caveat "
        f"they must hear with it? Three sentences.",
        page_context=page_context, render=False)
