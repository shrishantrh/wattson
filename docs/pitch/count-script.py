#!/usr/bin/env python3
"""Count the spoken words in docs/pitch/script.md.

Counts only the SAY column of the tables in Parts 1-3. Stage directions in [brackets],
the (breath) markers and the CUT/ADD labels are excluded, so the number is the words that
actually leave your mouth. Run it after any edit to the script:

    python3 docs/pitch/count-script.py
"""
import re
from pathlib import Path

SCRIPT = Path(__file__).with_name('script.md')
WPM = 130

text = SCRIPT.read_text()
body = text[text.index('## Part 1'):text.index('## The 20-second')]

rows, total = [], 0
for line in body.splitlines():
    if not line.startswith('| **'):
        continue
    cells = [c.strip() for c in line.strip().strip('|').split('|')]
    if len(cells) < 3:
        continue
    say = cells[1]
    say = re.sub(r'\*\*(CUT IF LONG|ADD IF SHORT|ADD IF AHEAD)\*\*\s*—', '', say)
    say = re.sub(r'\*?\[.*?\]\*?', '', say)
    say = say.replace('(breath)', '').replace('**', '')
    words = [w for w in re.split(r'[\s—]+', say) if re.search(r'[A-Za-z0-9]', w)]
    if words:
        rows.append((cells[0].strip('*'), len(words)))
        total += len(words)

for clock, n in rows:
    print(f'{clock:>8}  {n:>3}')
print(f'\nTOTAL {total} words = {total / WPM * 60:.0f}s of speech at {WPM} wpm')
