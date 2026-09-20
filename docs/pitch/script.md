# script.md — the three-minute talk, as spoken

Read the **bold** lines as written; they are timed and every figure in them is traced.
Everything else is direction. Slide numbers refer to `docs/pitch/deck.html`; the pairing of
each slide to each sentence is in `docs/pitch/deck.md`. If a number on screen disagrees
with this script, **the screen is right** — read the screen.

**Numerals are written the way they are spoken** ("eight point seven", not "8.7"), so the
word count measures the talk that gets delivered rather than a shorter one on paper.

**Clauses in [square brackets] are the cut list.** Drop them in order, from the back, if the
app is slow. They total 13 words ≈ 6 seconds. **Never cut beat (b), the detector** — it is
the primary track's entire case.

To re-measure after an edit:

```
python3 - <<'PY'
import io,re
t=io.open('docs/pitch/script.md',encoding='utf-8').read()
b=re.findall(r'^> \*\*(.+?)\*\*$', t, re.M)
w=lambda s: len([x for x in re.sub(r'[\[\]]','',s).split() if x not in '—-·'])
print(sum(map(w,b)), 'words =', round(sum(map(w,b))/130*60,1),'s')
PY
```

---

## 0:00 – 0:14 · Slide 1 · the absence · 30 words

**SCREEN:** fast fashion ✓, airlines ✓, oil majors ✓, datacenters — an empty slot.

> **There's a greenwashing watchdog for fast fashion. For airlines. For oil majors. There isn't one for datacenters — the industrial load every forecast says is growing fastest. So we built it.**

Say the three "for" clauses at pace, then break hard before "There isn't one." The list does
the work: by the third item the room has accepted that this is a normal, mature thing that
obviously should exist, so the absence lands as an oversight rather than a pitch.

**Note the attribution.** It is "every forecast says", not a flat assertion — "the
fastest-growing industrial load in America" is not a Wattson measurement and is in neither
numbers file. **Do not open on solar.** Solar is the evidence, not the thesis.

---

## 0:14 – 0:26 · Slide 2 · what Wattson is · 27 words

**SCREEN:** a company's claim → the grid it draws from → what it burned, hour by hour.

> **We take a company's public clean-energy claim, find the grid its buildings actually draw from, and compare the claim to what that grid generated, hour by hour.**

This slide exists because a judge who only reads the slides must still learn what the
product does. Say it slowly — it is the only plain-English definition in the talk. Every
later slide is one of these three boxes filled in, and slide 7 is this exact shape carrying
Alphabet's real values.

---

## 0:26 – 0:43 · Slide 3 · the evidence · 36 words

**SCREEN:** +64.7 against +17.7, with 3.7× between them. Let the bars land first.

> **Since twenty-nineteen we added sixty-five gigawatts to the average daytime hour, and eighteen to the overnight hour — to the hours a datacenter ignores. And that's after we corrected a nuclear plant the federal data counted twice.**

**These are the corrected figures, and saying so is the point.** The published 2019 baseline
contains AZPS's phantom — Palo Verde nuclear booked by two authorities at once, 3,338 MW
overnight and 3,334 MW daytime, which our own corrections file proves. On the published
numbers this slide would read +61.4 / +14.3 / 4.3×: sixteen percent more flattering, and
built on the exact figure backup B2 exists to discredit. We do not quote a number our own
work proves wrong, and the correction is a better story than the bigger ratio.

**The trap.** These are absolute megawatts, not shares. Both went **up**. On a corrected
basis the overnight share is roughly flat, about 40.0% in 2019 against 39.7% in 2025 — so
never say "four times cleaner by day", which is a share sentence. And 17.7 GW at night is
real, about a Dominion and a half: it grew and still lost the race.

*Source: `api/regions.json` `meta.national.cf_avg_mw` (2019 daytime 178,129, overnight
159,031; 2025 daytime 239,533, overnight 173,380) minus `api/region/AZPS.json`
`corrections[1]` on `cf_avg_mw.2019` (overnight 3,373 → 34.7; daytime 3,736 → 402.2,
confidence `proven`). Corrected 2019: daytime 174,795, overnight 155,693. Deltas +64,738
and +17,687; ratio 3.66.*

---

## 0:43 – 0:57 · Slide 4 · PJM · 30 words

**SCREEN:** "All the night growth was gas." — gas +10,740, coal −2,520, clean −81, in megawatts.

> **PJM — the grid from Chicago to New Jersey — is where the datacenters are. Overnight generation there rose eight point seven gigawatts. Gas supplied ten point seven. Clean fell eighty-one megawatts.**

**Gloss PJM every time, unconditionally.** The room is not technical.

**Do not read the coal bar aloud.** It is on the slide so that a judge who notices 10.7 is
bigger than 8.7 gets the answer before they have to ask: coal fell 2.5 GW and nuclear 0.9,
so part of the gas rise is coal-to-gas switching. The deltas close at +8.69 against +8.70.

Say "consistent with datacenter load being served by gas", never "caused by". Average mix,
not marginal. Overnight net exports fell 3,814 to 2,489 MW, so it isn't PJM exporting less.
Note the line says "is where the datacenters are", not "the largest cluster on earth" —
that superlative is in neither numbers file.

*Source: `api/region/PJM.json` — `total_avg_mw` overnight 82,539 → 91,240;
`fuel_delta_overnight_gw` gas +10.74, coal −2.52; `cf_avg_mw` overnight 35,700 → 35,619.*

---

## 0:57 – 2:29 · Slide 5 · the product, live · 170 words + ~15s of interaction

**SCREEN:** the holding slide, carrying the provenance strip — EIA-930 via PUDL, 4.45M
hourly rows, 70 grid operators, 354 indexed passages. That strip is up for ninety-five
seconds and costs no spoken time; it is what a Voloridge judge scores on "real-world public
datasets". Switch to the app and stay there.

Do not narrate the UI. Ask it things.

### (a) The check — 29 words, 13s.

> **Google claims one hundred percent renewable — page four. On the grid that serves the site: five point six percent. True under the accounting rule. We're measuring a different thing.**

Do **not** say "we never say they lied" — it plants the word nobody asked for. Do not say
"market-based" aloud either; it costs fifteen seconds of confusion. If you linger on the
5.6%: footprint not meter, and it *understates* the site, because Santee Cooper's share of
V.C. Summer nuclear reports under SCEG at 42%.

### (b) The detector — 48 words, 22s. **Never cut this beat.**

> **We also find datacenters without a list of datacenters. A hundred and eleven regions scored on the signature of flat, round-the-clock load. We named four test regions before we ran it, so we couldn't cheat. Two landed in the top ten. Two missed. Both are on the screen.**

**Two hits, two misses.** N. Virginia 6th and Omaha 7th are the hits; the AEP zone 19th and
Dallas 91st are the misses, and backup B1 draws both struck through. An earlier draft said
"three hit", which contradicted our own backup slide. Never inflate this — the miss is what
makes the hits worth believing.

### (c) OpenAI, and our own blind spot — 49 words, 23s (43 without the bracket).

Type `openai`, then open the New Mexico site.

> **[Six Stargate sites, every one mapped.] El Paso Electric, at three in the morning: one megawatt out of six hundred and fifty-five. And El Paso Matters reports a gas microgrid here that never touches that grid. If that's right, this load never shows up in federal data. Including ours.**

**Keep "if that's right".** The microgrid is a press note at `confidence=medium` (El Paso
Matters, 2025-09-25), not something we measured — say "El Paso Matters reports", never "we
found". **Abilene is not one of OpenAI's six**; it is filed under Oracle. The six are
Shackelford, Santa Teresa, Milam, Lordstown, Port Washington, Pike County. EPE imports
overnight (853 MW demand against 655 generated), so this is footprint generation; and it was
0.0% in 2019, a flat line at the floor, not a collapse.

### (d) The ask layer, Codex and the corpus — 44 words, 20s (37 without the bracket).

> **And you can just ask it in English. That's OpenAI's tool-calling API over ten typed tools — and Codex wrote the document-search layer underneath: three hundred and fifty-four passages from their own filings, [six flagged as junk and kept visible,] every one with its page.**

**Say "passages", not "filings".** 354 is the passage count; there are 8 source documents.

**"Over ten typed tools" is deliberate.** The running service reports **eleven** tools,
including `search_corpus`, and the demo runs against that service — so eleven is what a
judge would see. The copy of `server/ai.py` in the repo is stale and lists ten. "Over ten"
is true of both and cannot be made wrong by the next deploy. If a judge asks for the
number, say eleven and name `search_corpus`. The model is `gpt-4.1`.

**Do not say "seven tool calls"** — the call count is a property of the live run and cannot
be promised in advance.

*Verified by direct count of `claims/raw/*.jsonl`: 354 records = 309 sustainability-report
passages + 45 from 10-Ks, across 8 source documents and 312 distinct pages; quality 341 ok
/ 7 tabular / 6 suspect. Every record carries `page`, `source_doc` and `source_url`.*

**If you are behind:** drop the bracketed clauses first, then beat (c)'s "Six Stargate
sites" line. The site is a static export with no backend; if the ask layer is down, ⌘K
degrades to the deterministic palette and every other screen is unaffected.

---

## 2:29 – 2:43 · Slide 6 · what it refuses to say · 30 words

**SCREEN:** 4 operators: their filings. 48: the grid only.

> **The thing we're proudest of is what it refuses to say. Ten claims read. Nine true on paper. One we can't verify. Forty-eight of fifty-two, we haven't read at all.**

Hands off the laptop, look up. Fast and flat — this is the differentiator, not an apology.
The slide now leads with what we **do** hold, because a textual-analysis judge whose only
exposure to our document work is "we read nothing for 48 of 52" scores a zero.

**It is 48 operators, not 12** — the twelve in an older draft was a *site* count from a
stale string. **Do not use the Nebius line**: both Nebius sites name a serving utility; what
is true is that neither utility has listed equity, because both are municipal. If asked how
many sites are behind the meter: ten site notes say so explicitly, about fifteen describe
on-site generation of some kind, and there is no flag field — say "about a dozen of the
134, from the site notes", never "eleven".

*Source: `api/companies.json` — 52 operators, 134 sites, `count_with_claims` 4,
`count_sites_only` 48; 10 claims, 9 `true_on_paper`, 1 `cannot_verify` (Amazon,
`no_falsifiable_content`; `talk_score` is null, not zero).*

---

## 2:43 – 2:54 · Slide 7 · the chain · 25 words

**SCREEN:** "matched 100% of our electricity" / Alphabet, p. 4 → Santee Cooper / serving
utility → 5.6% / generated 2025. Point at the middle box.

> **And every verdict ends at a named utility in a named region. Which means someone can look up who's exposed before the filing says so.**

This is the sentence that separates the project from a class project. Do not cut it for
time — cut a bracketed clause in the demo instead.

The page cite is on the slide because it is the only source citation in the running order,
and it is what the textual-analysis track scores. If asked what someone does with it: load
growth hits a regulated utility's rate base long before it hits its filings, and 107 of our
134 sites resolve to a named serving utility, 42 of them with no listed equity. Say the
denominator — 107, not 134. No stock-price claim, no backtest.

---

## 2:54 – 2:59 · Slide 8 · close · 9 words

> **Wattson. It follows the power, not the press release.**

Then stop. No thank-you, no team names, no reaching for the laptop. If you have run short,
the honest filler is *"a datacenter draws the same power at 3am in January as at noon in
June."*

---

## The budget, measured

| Block | Words | Seconds @ 130 wpm | Running |
|---|---|---|---|
| Slide 1 · the absence | 30 | 13.8 | 0:14 |
| Slide 2 · what Wattson is | 27 | 12.5 | 0:26 |
| Slide 3 · clean power added | 36 | 16.6 | 0:43 |
| Slide 4 · PJM | 30 | 13.8 | 0:57 |
| Slide 5 · demo (a) the check | 29 | 13.4 | 1:10 |
| Slide 5 · demo (b) the detector | 48 | 22.2 | 1:32 |
| Slide 5 · demo (c) OpenAI + blind spot | 49 | 22.6 | 1:55 |
| Slide 5 · demo (d) ask layer, Codex, corpus | 44 | 20.3 | 2:15 |
| Slide 6 · what it refuses to say | 30 | 13.8 | 2:29 |
| Slide 7 · the chain | 25 | 11.5 | 2:41 |
| Slide 8 · close | 9 | 4.2 | 2:45 |
| **Spoken total** | **357** | **164.8** | |
| Interaction: typing, clicking, LLM latency | — | ~15 | |
| **Delivered total** | | **~180** | **3:00** |

Drop both bracketed clauses (13 words, 6.0s) and the spoken total is **344 words /
158.8s**, leaving 21 seconds for a slow app. That is the contingency — not the detector.

Slides before the demo: 123 words, 56.8s. Live app: 170 words, 78.5s spoken. Close: 64
words, 29.5s. Counts measured from this file by the snippet above, not estimated.

---

## Rules for the recording

- **Never say "caused by."** Say "consistent with."
- **Never say a company lied** — and do not say "we never say they lied" either. The verdict
  is *"true under the accounting rule; we're measuring a different thing."*
- **Never quote a megawatt comparison as a share comparison** or the other way round. This
  is the single easiest number in the talk to get wrong.
- **Never quote the published 2019 baseline.** 61.4 / 14.3 / 4.3× are contaminated by the
  AZPS double count. The corrected figures are 64.7 / 17.7 / 3.7×, and you say that you
  corrected them.
- **Two hits, two misses.** Never "three hit".
- **354 passages, 8 source documents, over ten typed tools.** Never "354 filings" — that
  overstates the document count by 44×. The live service reports eleven tools; the repo copy
  says ten; "over ten" is true either way.
- Gloss every term on first use: PJM is "the grid from Chicago to New Jersey"; overnight is
  "three in the morning". Do not say "balancing authority" — the running order never needs
  it. Do not say "market-based", "load factor", "interchange", "PPA" or "REC".
- Anything you did not measure gets attributed out loud: the microgrid is El Paso Matters'
  reporting, the site-to-utility mapping is hand-curated, the tickers are hand-mapped.
- If a number on screen disagrees with this script, **the screen is right.**

## If something breaks

The whole site is a static export and runs with no server. If the ask layer is down, ⌘K
degrades to the deterministic command palette and every other screen is unaffected. Don't
apologise on camera; move to the next screen.

## Backup slides, one `B` away

- **B1** — the frozen detector, for "how do I know you didn't tune it?" It shows two hits
  and two misses, which is exactly what beat (b) says.
- **B2** — the Arizona double count, for "did Phoenix collapse from 62% to 10?" This is also
  the correction slide 3 already referenced, so it confirms rather than ambushes.
- **B3** — Alphabet's own page 94, for "so 'true on paper' means they lied?"
