"""Write chunk records as JSONL, refusing anything that cannot be cited."""

import json

FIELDS = ("text", "page", "source_doc", "source_url", "ticker", "year")
# HTML filings have no pages; such a record must carry a locator instead, so
# the UI can still cite it ("10-K Item 1A") rather than showing a bare quote.


def write_jsonl(path, records):
    """Write one JSON object per line. Returns the number of lines written."""
    validated = []
    for i, rec in enumerate(records):
        missing = [f for f in FIELDS if f not in rec]
        if missing:
            raise ValueError(f"record {i} missing fields: {', '.join(missing)}")
        locator = rec.get("locator")
        if rec["page"] is None and not locator:
            raise ValueError(
                f"record {i} has page=None and no locator; a chunk that cannot "
                "be cited on screen is not writable"
            )
        out = {f: rec[f] for f in FIELDS}
        if locator:
            out["locator"] = locator
        validated.append(out)

    with open(path, "w", encoding="utf-8") as fh:
        for rec in validated:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return len(validated)
