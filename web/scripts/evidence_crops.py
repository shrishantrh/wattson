#!/usr/bin/env python3
"""Render the page a claim was read off, cropped around the sentence, with the sentence boxed.

Output: web/public/evidence/<claim_id>-{says,discloses}.png plus index.json, which the
SideBySide module reads. Boxes are fractions of the crop, so the page can scale freely.
Run:  ~/hackmit-venv/bin/python web/scripts/evidence_crops.py
Needs the source PDFs in claims/raw/pdf/ (gitignored; re-fetch from claims/raw/sources.json).
"""
import json, os, sys, unicodedata
import pypdfium2 as pdfium

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'web', 'public', 'evidence')
SCALE = 2.0
PAD_X, PAD_Y = 2.0, 3.5          # points of breathing room around the glyph box
MARGIN_X, MARGIN_Y = 26.0, 40.0  # points of page context kept around the highlight

def norm(s):
    s = unicodedata.normalize('NFKD', s or '')
    for a, b in (('’', "'"), ('‘', "'"), ('“', '"'), ('”', '"'), ('—', '-'), ('–', '-'), (' ', ' ')):
        s = s.replace(a, b)
    return ' '.join(s.split())

def find_boxes(page, needle):
    """Glyph boxes for `needle`, one per line of text it spans, in top-left page coords."""
    tp, H = page.get_textpage(), page.get_size()[1]
    s = tp.search(needle, match_case=False)
    if s is None: return []
    hit = s.get_next()
    if hit is None: return []
    i, n = hit
    rects = [tp.get_charbox(c) for c in range(i, i + n)]
    rects = [r for r in rects if r and (r[2] - r[0]) > 0 and (r[3] - r[1]) > 0]
    if not rects: return []
    # Group by vertical midpoint, not by baseline: descenders (g, y, p) move the bottom edge and
    # would otherwise split one line into a box per word.
    heights = sorted(r[3] - r[1] for r in rects)
    tol = max(1.0, heights[len(heights) // 2] * 0.55)
    lines = []
    for r in rects:
        mid = (r[1] + r[3]) / 2
        for ln in lines:
            if abs(mid - ln['mid']) <= tol: ln['rects'].append(r); break
        else:
            lines.append({'mid': mid, 'rects': [r]})
    out = []
    for ln in sorted(lines, key=lambda x: -x['mid']):
        rs = ln['rects']
        l = min(r[0] for r in rs) - PAD_X; rr = max(r[2] for r in rs) + PAD_X
        b = min(r[1] for r in rs) - PAD_Y; t = max(r[3] for r in rs) + PAD_Y
        out.append((l, H - t, rr, H - b))    # -> top-left origin
    return out

def phrases(text):
    """The sentence, then progressively shorter openings, so a ligature or odd space cannot lose it."""
    w = norm(text).split()
    seen, out = set(), []
    for cand in [text] + [' '.join(w[:k]) for k in (12, 9, 7, 5, 4)]:
        c = (cand or '').strip()
        if len(c) >= 12 and c not in seen: seen.add(c); out.append(c)
    return out

def segments(text, size=7):
    """Overlapping chunks of the sentence. A link or ligature breaks one chunk, not the rest."""
    w = norm(text).split()
    if len(w) <= size: return []
    return [' '.join(w[i:i + size]) for i in range(0, len(w) - 3, max(2, size - 2))]

def union_lines(groups, tol=4.0):
    """Merge box lists from several probes into one box per line of text."""
    lines = []
    for b in [b for g in groups for b in g]:
        mid = (b[1] + b[3]) / 2
        for ln in lines:
            if abs(mid - ln['mid']) <= tol:
                ln['b'] = (min(ln['b'][0], b[0]), min(ln['b'][1], b[1]), max(ln['b'][2], b[2]), max(ln['b'][3], b[3])); break
        else:
            lines.append({'mid': mid, 'b': b})
    return [ln['b'] for ln in sorted(lines, key=lambda x: x['mid'])]

def line_extent(page, boxes, tol=4.0):
    """Horizontal extent of the full text lines the boxes sit on, so a crop never cuts words."""
    tp, H = page.get_textpage(), page.get_size()[1]
    mids = [(b[1] + b[3]) / 2 for b in boxes]
    lo, hi = None, None
    for i in range(tp.count_chars()):
        r = tp.get_charbox(i)
        if not r or r[2] <= r[0]: continue
        mid = H - (r[1] + r[3]) / 2
        if any(abs(mid - m) <= tol for m in mids):
            lo = r[0] if lo is None else min(lo, r[0])
            hi = r[2] if hi is None else max(hi, r[2])
    return lo, hi

def render(pdf_path, page_no, needles, name):
    pdf = pdfium.PdfDocument(pdf_path)
    page = pdf[page_no - 1]
    W, H = page.get_size()
    boxes = []
    for nd in needles:
        found = [find_boxes(page, ph) for ph in phrases(nd)]
        found = [f for f in found if f]
        if found:
            best = found[0]
            seg = [find_boxes(page, sg) for sg in segments(nd)]
            boxes = union_lines([best] + [x for x in seg if x])
            break
    if not boxes:
        print(f'  no match on p.{page_no} for {name}'); return None
    lo, hi = line_extent(page, boxes)          # whole lines, never a clipped word
    x0 = max(0.0, min([b[0] for b in boxes] + ([lo] if lo is not None else [])) - MARGIN_X)
    x1 = min(W, max([b[2] for b in boxes] + ([hi] if hi is not None else [])) + MARGIN_X)
    y0 = max(0.0, min(b[1] for b in boxes) - MARGIN_Y)
    y1 = min(H, max(b[3] for b in boxes) + MARGIN_Y)
    if x1 - x0 < W * 0.45:                                    # keep a readable column width
        c = (x0 + x1) / 2; half = W * 0.26
        x0, x1 = max(0.0, c - half), min(W, c + half)
    img = page.render(scale=SCALE).to_pil().convert('RGB').crop((int(x0 * SCALE), int(y0 * SCALE), int(x1 * SCALE), int(y1 * SCALE)))
    os.makedirs(OUT, exist_ok=True)
    img.save(os.path.join(OUT, f'{name}.png'), optimize=True)
    cw, ch = img.size
    rel = [[(b[0] - x0) * SCALE / cw, (b[1] - y0) * SCALE / ch, (b[2] - b[0]) * SCALE / cw, (b[3] - b[1]) * SCALE / ch] for b in boxes]
    print(f'  {name}.png {img.size} {len(rel)} box(es)')
    return {'src': f'evidence/{name}.png', 'page': page_no, 'boxes': rel}

def main():
    pdfs = {t: os.path.join(ROOT, d['local_path']) for t, d in json.load(open(os.path.join(ROOT, 'claims/raw/sources.json')))['documents'].items()}
    index = {}
    for ticker, pdf_path in sorted(pdfs.items()):
        if not os.path.exists(pdf_path):
            print(f'{ticker}: no PDF at {pdf_path}, skipped'); continue
        cf = os.path.join(ROOT, 'web/public/api/company', f'{ticker}.json')
        if not os.path.exists(cf): continue
        company = json.load(open(cf))
        print(ticker)
        for claim in company.get('claims', []):
            if not claim.get('verbatim') or not claim.get('page'): continue
            says = render(pdf_path, claim['page'], [claim['verbatim']], f"{claim['claim_id']}-says")
            if not says: continue
            entry = {'says': says}
            # the disclosure this claim is measured against: a different page in the same report
            for e in claim.get('evidence', []):
                p, note = e.get('page'), e.get('note') or e.get('label')
                if p and note and p != claim['page']:
                    key = e.get('label') or ' '.join(norm(note).split()[:8])
                    d = render(pdf_path, p, [key, note], f"{claim['claim_id']}-discloses")
                    if d: entry['discloses'] = d
                    break
            index[claim['claim_id']] = entry
            if len(index) >= 12: break
    json.dump(index, open(os.path.join(OUT, 'index.json'), 'w'), indent=1)
    print('claims with page images:', len(index))

main()
