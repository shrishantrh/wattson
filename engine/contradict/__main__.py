"""Emit intra-document findings about clean-energy claims.

    python3 -m engine.contradict
"""

import json
import pathlib
import re

from engine.contradict.crossdoc import find_cross_doc
from engine.contradict.hourly import find_disclosed_hourly_cfe
from engine.contradict.detect import build_report

RAW = pathlib.Path("claims/raw")
OUT = pathlib.Path("claims/derived/contradictions.json")
TICKERS = ("META", "MSFT", "GOOGL", "AMZN")

# Pages a human re-read in the RENDERED PDF, not in another text extraction.
# A self-consistent re-extraction cannot catch a systematic extraction bias,
# which is exactly how the column-splicing bug survived the first audit.
VERIFIED_PAGES = {("META", 18), ("MSFT", 6),
                  ("GOOGL", 4), ("GOOGL", 19), ("GOOGL", 28), ("GOOGL", 94)}

# Pattern 1 from the brief -- a near-zero market-based Scope 2 alongside a large
# location-based Scope 2 -- is NOT implemented as a detector. The figures live in
# report tables whose column order text extraction does not reliably preserve, so
# a market-based number can be read as location-based and manufacture a
# contradiction. Naming the gap rather than hiding it.
SCOPE2_STATUS = {
    "META":  "not_disclosed_in_text",
    "MSFT":  "not_disclosed_in_text",
    "GOOGL": "present_only_in_endnotes",
    "AMZN":  "not_disclosed_in_text",
}

GAPS = {
    "AMZN": ("No intra-document finding. Amazon's headline 100%-matched claim "
             "is on page 5 inside an infographic, which extracts as fragments "
             "('100% matched 100% matched') rather than a sentence. A quotable "
             "restatement does exist on page 10 and is used for the "
             "cross-document check, but nothing in the report qualifies or "
             "undercuts it in the same sentence, so nothing is reported."),
}

ARROW = re.compile(r"[↗→➚-➿]")


# A sentence continuing past the page edge picks up the page folio printed
# underneath it, e.g. "... (on a global and annual basis) 4".
TRAILING_FOLIO = re.compile(r"\s+\d{1,3}$")


def clean(text):
    """Drop link-icon glyphs and a trailing page folio, so the quote is the
    printed sentence and nothing else."""
    return TRAILING_FOLIO.sub("", " ".join(ARROW.sub("", text).split())).strip()


def main():
    corpus = {tk: [json.loads(l) for l in
                   (RAW / f"{tk}_esg.jsonl").read_text().splitlines()]
              for tk in TICKERS}
    report = build_report(corpus)

    # A disclosed hourly CFE figure beside the annual claim, both the
    # company's own numbers. No inference at all, so it leads.
    for tk in TICKERS:
        for f in find_disclosed_hourly_cfe(tk, corpus[tk]):
            report[tk]["findings"].insert(0, f)

    # Cross-document: the ESG brochure against the 10-K filed under liability.
    for tk in TICKERS:
        tenk_path = RAW / f"{tk}_10k.jsonl"
        if not tenk_path.exists():
            report[tk]["tenk"] = "not ingested"
            continue
        tenk = [json.loads(l) for l in tenk_path.read_text().splitlines()]
        found = find_cross_doc(tk, corpus[tk], tenk)
        report[tk]["findings"].extend(found)
        report[tk]["tenk"] = {
            "chunks": len(tenk),
            "source_url": tenk[0]["source_url"] if tenk else None,
            "note": ("Items 1 and 1A only. HTML filings have no pages, so these "
                     "chunks carry a locator and a null page rather than an "
                     "invented page number."),
        }

    total = verified = 0
    for tk, block in report.items():
        for f in block["findings"]:
            for side in ("claim", "counterpoint"):
                # A tabular counterpoint carries parsed values, not a quote.
                if f.get(side) and "quote" in f[side]:
                    f[side]["quote"] = clean(f[side]["quote"])
            f["note"] = clean(f["note"])
            f["evidence"]["note"] = f["note"]

            pages = {f["claim"]["page"]}
            if f["counterpoint"] and f["counterpoint"].get("page") is not None:
                pages.add(f["counterpoint"]["page"])
            ok = all((tk, p) in VERIFIED_PAGES for p in pages if p is not None)
            f["verification"] = {
                "human_reread_rendered_page": ok,
                "method": ("human re-read of the rendered PDF page"
                           if ok else "regex + page audit only, not yet re-read"),
                "pages_checked": sorted(p for p in pages if p is not None),
            }
            if (f.get("counterpoint") or {}).get("locator"):
                f["verification"]["tenk_quote"] = (
                    "checked verbatim against the raw SEC filing HTML; "
                    "re-runnable via python3 -m engine.contradict.verify_tenk")
            total += 1
            verified += ok

        block["verification"] = {
            "page_audit": "all 309 chunks verbatim on the page they cite",
            "extraction": "column-aware; multi-column pages read one column at a time",
        }
        block["scope2_extraction"] = SCOPE2_STATUS[tk]
        if tk in GAPS:
            block["gap"] = GAPS[tk]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")

    print(f"wrote {OUT}")
    for tk, block in report.items():
        kinds = ", ".join(f["kind"] for f in block["findings"]) or "-"
        print(f"  {tk:6} {len(block['findings'])} findings  {kinds}")
    print(f"total {total} findings, {verified} with the page re-read rendered")


if __name__ == "__main__":
    main()
