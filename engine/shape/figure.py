"""The money figure, drawn as plain SVG so the module needs no plotting dependency.

PC1 (day/night amplitude) against PC2 (peak timing) for the 2025 slice, with the
regions that host a mapped datacenter site marked. The same numbers are in
shape.json under q1_clustering.scatter, which is what a front end should read; this
file exists so the write-up has a picture without adding matplotlib to the venv.
"""
from __future__ import annotations

from pathlib import Path

OUT = Path(__file__).resolve().parent / "pca_scatter.svg"

W, H = 780, 520
PAD_L, PAD_R, PAD_T, PAD_B = 62, 170, 46, 54
CLUSTER_FILL = {0: "#2f7d63", 1: "#7a7f8c", 2: "#b4622c"}
LABEL_THESE = ["PJM/DOM", "PJM/AEP", "ERCO/NCEN", "ERCO/NRTH", "SWPP/OPPD",
               "AZPS", "CISO", "ISNE", "NYIS", "ERCO", "PJM"]


def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render(result: dict, year: int = 2025, path: Path = OUT) -> Path:
    pts = [p for p in result["q1_clustering"]["scatter"] if p["year"] == year]
    comp = result["q1_clustering"]["pca"]["components"]
    xs = [p["pc1"] for p in pts]
    ys = [p["pc2"] for p in pts]
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)
    mx, my = (x1 - x0) * 0.06, (y1 - y0) * 0.08
    x0, x1, y0, y1 = x0 - mx, x1 + mx, y0 - my, y1 + my

    def sx(v):
        return PAD_L + (v - x0) / (x1 - x0) * (W - PAD_L - PAD_R)

    def sy(v):
        return H - PAD_B - (v - y0) / (y1 - y0) * (H - PAD_T - PAD_B)

    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" '
         f'height="{H}" font-family="ui-sans-serif,-apple-system,Segoe UI,Helvetica,sans-serif">',
         f'<rect width="{W}" height="{H}" fill="#ffffff"/>']

    # axes through the origin
    o.append(f'<line x1="{PAD_L}" y1="{sy(0):.1f}" x2="{W - PAD_R}" y2="{sy(0):.1f}" '
             'stroke="#d5d8de" stroke-width="1"/>')
    o.append(f'<line x1="{sx(0):.1f}" y1="{PAD_T}" x2="{sx(0):.1f}" y2="{H - PAD_B}" '
             'stroke="#d5d8de" stroke-width="1"/>')
    o.append(f'<rect x="{PAD_L}" y="{PAD_T}" width="{W - PAD_L - PAD_R}" '
             f'height="{H - PAD_T - PAD_B}" fill="none" stroke="#e6e8ec"/>')

    for p in sorted(pts, key=lambda p: p["has_site"]):
        cx, cy = sx(p["pc1"]), sy(p["pc2"])
        fill = CLUSTER_FILL.get(p["cluster"], "#888")
        if p["has_site"]:
            r = 4.0 + min(p["n_sites"], 9) * 0.55
            o.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{fill}" '
                     'fill-opacity="0.85" stroke="#111318" stroke-width="1.4"/>')
        else:
            o.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="3.1" fill="none" '
                     f'stroke="{fill}" stroke-width="1.2" stroke-opacity="0.75"/>')

    for p in pts:
        if p["region"] in LABEL_THESE:
            o.append(f'<text x="{sx(p["pc1"]) + 7:.1f}" y="{sy(p["pc2"]) - 6:.1f}" '
                     f'font-size="10" fill="#111318">{_esc(p["region"])}</text>')

    pc1 = 100 * comp["PC1"]["explained_variance_ratio"]
    pc2 = 100 * comp["PC2"]["explained_variance_ratio"]
    o.append(f'<text x="{(PAD_L + W - PAD_R) / 2:.0f}" y="{H - 16}" font-size="12" '
             f'text-anchor="middle" fill="#3b4049">PC1 ({pc1:.0f}% of variance) — '
             'day/night amplitude · left = flatter</text>')
    o.append(f'<text transform="translate(18,{(PAD_T + H - PAD_B) / 2:.0f}) rotate(-90)" '
             f'font-size="12" text-anchor="middle" fill="#3b4049">PC2 ({pc2:.0f}%) — '
             'evening vs afternoon peak</text>')
    o.append(f'<text x="{PAD_L}" y="26" font-size="14" fill="#111318" '
             f'font-weight="600">Load-shape space, {year} — unsupervised</text>')
    o.append(f'<text x="{PAD_L}" y="{PAD_T - 8}" font-size="11" fill="#6b7280">'
             f'{len(pts)} regions · k-means k=3 on the pooled 2019–2025 profiles · '
             'no detector input</text>')

    lx = W - PAD_R + 14
    o.append(f'<text x="{lx}" y="{PAD_T + 6}" font-size="11" fill="#3b4049" '
             'font-weight="600">cluster</text>')
    for i, (c, name) in enumerate([(0, "flattest"), (1, "middle"), (2, "peakiest")]):
        y = PAD_T + 26 + i * 18
        o.append(f'<circle cx="{lx + 6}" cy="{y - 4}" r="4" fill="{CLUSTER_FILL[c]}"/>')
        o.append(f'<text x="{lx + 18}" y="{y}" font-size="11" fill="#3b4049">'
                 f'{c} · {name}</text>')
    y = PAD_T + 100
    o.append(f'<text x="{lx}" y="{y}" font-size="11" fill="#3b4049" '
             'font-weight="600">mapped sites</text>')
    o.append(f'<circle cx="{lx + 6}" cy="{y + 18}" r="5.5" fill="#7a7f8c" '
             'fill-opacity="0.85" stroke="#111318" stroke-width="1.4"/>')
    o.append(f'<text x="{lx + 18}" y="{y + 22}" font-size="11" fill="#3b4049">'
             '&#8805; 1 site</text>')
    o.append(f'<circle cx="{lx + 6}" cy="{y + 38}" r="3.1" fill="none" stroke="#7a7f8c" '
             'stroke-width="1.2"/>')
    o.append(f'<text x="{lx + 18}" y="{y + 42}" font-size="11" fill="#3b4049">none</text>')
    o.append(f'<text x="{lx}" y="{y + 72}" font-size="10" fill="#6b7280">filled radius</text>')
    o.append(f'<text x="{lx}" y="{y + 86}" font-size="10" fill="#6b7280">grows with</text>')
    o.append(f'<text x="{lx}" y="{y + 100}" font-size="10" fill="#6b7280">site count</text>')

    o.append("</svg>")
    path.write_text("\n".join(o))
    return path
