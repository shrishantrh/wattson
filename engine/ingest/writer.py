"""Write chunk records as JSONL, refusing anything that cannot be cited."""

import json

FIELDS = ("text", "page", "source_doc", "source_url", "ticker", "year")


def write_jsonl(path, records):
    """Write one JSON object per line. Returns the number of lines written."""
    validated = []
    for i, rec in enumerate(records):
        missing = [f for f in FIELDS if f not in rec]
        if missing:
            raise ValueError(f"record {i} missing fields: {', '.join(missing)}")
        if rec["page"] is None:
            raise ValueError(
                f"record {i} has page=None; a chunk without a page number cannot "
                "be cited on screen, so it is not writable"
            )
        validated.append({f: rec[f] for f in FIELDS})

    with open(path, "w", encoding="utf-8") as fh:
        for rec in validated:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return len(validated)
