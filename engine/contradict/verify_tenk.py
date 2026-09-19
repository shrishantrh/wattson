"""Re-check every 10-K quote against the raw filing HTML from SEC.

    EDGAR_UA_EMAIL=you@example.edu python3 -m engine.contradict.verify_tenk

This deliberately does NOT reuse engine.ingest.htmltext. It strips tags with a
throwaway regex, so a bug in our parser cannot hide a bad quote by making the
same mistake twice -- the lesson from the column-splicing defect, where the
audit and the extractor shared an instrument.

A general-purpose page fetcher was tried as the independent check first and
returned a FALSE NEGATIVE on Microsoft: the filing is 8.6 MB, the fetcher
truncated it, and reported the sentence absent when it is present exactly once.
Going to the primary source is what settled it.
"""

import json
import pathlib
import re
import sys

OUT = pathlib.Path("claims/derived/contradictions.json")


def plain_text(html):
    stripped = re.sub(r"<[^>]+>", " ", html)
    stripped = re.sub(r"&#\d+;|&[a-z]+;", " ", stripped)
    return re.sub(r"\s+", " ", stripped)


def main():
    from engine.ingest import edgar

    report = json.loads(OUT.read_text())
    failures = 0
    for ticker, block in report.items():
        for f in block["findings"]:
            cp = f.get("counterpoint") or {}
            if not cp.get("locator"):
                continue
            html = edgar._throttled_get(cp["source_url"]).text
            ok = " ".join(cp["quote"].split()) in plain_text(html)
            print(f"{ticker:6} {'OK  ' if ok else 'FAIL'} {cp['quote'][:80]}")
            failures += not ok

    print("all 10-K quotes verbatim in the filing" if not failures
          else f"{failures} quote(s) NOT found in the filing")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
