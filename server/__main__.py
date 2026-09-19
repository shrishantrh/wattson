"""Run the API, or dump every endpoint to static JSON.

  python3 -m server                   serve on :8000
  python3 -m server --static-export   dump to server/static_export/

The static export is the demo insurance policy: with it, the UI works with the server dead.
Exercise it early and often, not at hour eight.
"""
from __future__ import annotations
import argparse, json, sys
from pathlib import Path
from urllib.parse import quote

OUT_DEFAULT = Path(__file__).resolve().parent / "static_export"


def static_export(out_dir: Path) -> int:
    from server import app as A, data
    out_dir.mkdir(parents=True, exist_ok=True)
    written = 0

    def w(rel: str, payload):
        p = out_dir / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(payload, indent=1))
        nonlocal written
        written += 1

    regions = A.get_regions()
    w("regions.json", regions)
    w("health.json", A.health())
    w("alerts.json", A.get_alerts())
    w("companies.json", A.get_companies())
    w("facilities.json", A.get_facilities())
    try:
        w("irradiance.json", A.get_irradiance())
    except Exception as e:  # noqa: BLE001 — static export should still finish if overlay missing
        print(f"skip irradiance export: {e}", file=sys.stderr)

    # Every region the detail endpoint accepts, not just the 111 ranked ones.
    # Files are named with the id URL-encoded so PJM/DOM -> region/PJM%2FDOM.json
    for rid in data.regions_by_id():
        w(f"region/{quote(rid, safe='')}.json", A.get_region(rid))

    for c in data.company_list():
        t = c.get("ticker")
        if t:
            w(f"company/{t.upper()}.json", A.get_company(t))

    # Precomputed answers for the demo path, so SITE works with no server at all.
    class _Req:
        def __init__(self, mw, metros):
            self.mw, self.metros, self.flat_247 = mw, metros, True

        def model_dump(self):
            return {"mw": self.mw, "metros": self.metros, "flat_247": True}

    presets = {
        "300mw-phoenix-nova-omaha": (300, ["Phoenix", "N. Virginia", "Omaha"]),
        "300mw-dallas-columbus-portland": (300, ["Dallas", "Columbus", "Portland"]),
        "500mw-all-flagged": (500, ["Phoenix", "N. Virginia", "Omaha", "Tucson",
                                    "Dallas", "West Texas", "Portland", "Columbus"]),
    }
    for name, (mw, metros) in presets.items():
        w(f"site/{name}.json", A.post_site(_Req(mw, metros)))

    w("index.json", {
        "note": "Static export of the Wattson API. Every file is a real endpoint response.",
        "generated_from": data.public_meta(),
        "endpoints": {
            "regions": "regions.json",
            "region": "region/{URL-encoded id}.json  (124 ids; the ranked list has 111)",
            "alerts": "alerts.json",
            "companies": "companies.json",
            "facilities": "facilities.json",
            "company": "company/{TICKER}.json",
            "site": "site/{preset}.json",
            "irradiance": "irradiance.json",
        },
        "site_presets": list(presets),
        "files": written + 1,
    })
    return written


def main(argv=None):
    ap = argparse.ArgumentParser(prog="server")
    ap.add_argument("--static-export", action="store_true")
    ap.add_argument("--out", default=str(OUT_DEFAULT))
    ap.add_argument("--port", type=int, default=8000)
    a = ap.parse_args(argv)
    if a.static_export:
        n = static_export(Path(a.out))
        print(f"static export: {n} files -> {a.out}")
        return 0
    import uvicorn
    uvicorn.run("server.app:app", host="127.0.0.1", port=a.port)
    return 0


if __name__ == "__main__":
    sys.exit(main())
