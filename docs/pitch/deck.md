# deck.md — what is on each slide, and the exact words said over it

The deliverable of this file is the **pairing**. Left: what the audience sees. Right: the
sentence coming out of your mouth while they see it. If a slide cannot be paired with a
sentence, the slide is wrong.

- **Deck:** `docs/pitch/deck.html`. Self-contained, no external request, opens offline by
  double-click. Keys: `←` `→` `space` advance · `N` presenter notes · `F` full screen ·
  `B` backup slides · `?` brings the control legend back.
- **Spoken script:** `docs/pitch/script.md`, the same words laid out to read from.
- **Narrative:** `docs/pitch/video-script-yash.md`, with the corrections in
  `docs/pitch/review-deck.md` applied.
- **Figures:** traced to `docs/pitch/numbers.md`, `docs/pitch/numbers-v2.md`, or recomputed
  here from `web/public/api/` and `claims/raw/` with the computation shown. Sources are
  cited per slide and again in each slide's presenter notes.

## Two measurements, run — not estimated

Open the deck and run these in the console. Both are part of the file.

```js
window.__wordCounts()   // rendered words per slide. Cap is 15, headline and axis labels included.
window.__overlaps()     // any two text boxes on a slide whose rendered rectangles intersect
```

Last run at 1280×720:

```
S1=9  S2=15  S3=15  S4=15  S5=15  S6=15  S7=15  S8=9  B9=15  B10=14  B11=15
over the cap: 0        overlaps: []        external references: 0
```

Every slide is at or under the cap and **no two text boxes intersect anywhere in the deck**.
The overlap check is how the slide-3 headline/figure collision (191×12px) was found and is
how you confirm a layout change rather than eyeballing a screenshot.

## Presenter mechanics — read before you plug in

- **`N` renders the notes in the same window.** On a mirrored display that projects the trap
  list — including the sentences you are forbidden to say — to the room. The notes panel
  now prints that warning in its own header. **Treat `N` as rehearsal-only.** If you need
  notes live, use a printout or a second device.
- **The control legend hides itself** on your first keypress, so the room never reads
  `← → / space · N notes · B backup · F full screen` for three minutes. It is also
  suppressed in full screen. `?` toggles it back.
- The slide counter (bottom right) stays: a slide count is defensible, a keyboard
  cheat-sheet is not.

**Timing: 357 spoken words = 164.8s at 130 wpm, plus ~15s of typing, clicking and LLM
latency = ~180s.** Numerals are written as spoken, so the count measures the real talk.
Dropping the two bracketed clauses gives 344 words / 158.8s and 21 seconds of slack.

---

## The stranger test

For each slide: could a tired person in row fifteen, who has never heard of a balancing
authority or a carbon-free share, say what the slide is claiming? Not whether it is
defensible — whether they *get* it. Every row below was re-checked against a screenshot
scaled to 0.34, which is roughly the back of a room.

| # | What a stranger takes away | Fixed to get there |
|---|---|---|
| 1 | "Other industries have greenwashing watchdogs. Datacenters don't." | The empty slot was a 3px hairline that nearly vanished at range; now 5px `--muted`. |
| 2 | "They compare what a company claims to what its grid actually burned." | "what **it** burned" had no antecedent on the slide — "it" could have been the company. Now "what **that grid** burned, hour by hour". Box widths rebalanced to the text they hold; the longest phrase had the narrowest box. |
| 3 | "Since 2019 far more clean power was added to daytime hours than to overnight hours." | The word "added" is now in the headline at 56px, not a 26px footer. `GW` moved from a floating axis label to sit beside the number it belongs to. Both bars carry `+`. |
| 4 | "In this grid, all the growth at night came from gas." | **"Gas took all of it" had no antecedent** — a stranger could not tell what "it" was. Now "All the night growth was gas." The coal bar answers "how does +10,740 come out of +8,701?" before it is asked. |
| 5 | "This is the live product, built on federal hourly data and an index of their filings." | Provenance strip added. `70 grid operators` rather than "balancing authorities", deliberately. |
| 6 | "For 4 companies they've read the documents; for 48 they only have grid data, and they say so." | Was "Documents read for 4 of 52 operators" with the legend "48 sites only" — a stranger knew neither what a document was here nor whether 4 of 52 was good. Hollow marks raised from `--line` to `--muted` so the gap is visible at range. |
| 7 | "Alphabet claims 100%; the utility that serves the site generated 5.6%." | "Santee Cooper" meant nothing on its own; it is now labelled **serving utility**. The claim box carries the quotation and `Alphabet, p. 4` instead of a bare `100%`. |
| 8 | "That's the name and the idea." | — |
| B1 | "They named their test regions in advance and published the misses." | Rank and place labels were overlapping and set at 24–26px; separated and raised to 30–32px. |
| B2 | "One nuclear plant was counted by two operators; corrected, the number goes up not down." | `published` label moved clear of the dotted line it labels. |
| B3 | "Their own report says 65% on page 94, ninety pages after the 100%." | Labels raised to 32px, which collided with the figures above them; viewBox extended and labels moved down. |

Three slides still use a term a stranger will not know — **PJM** (slide 4), **EIA-930** and
**PUDL** (slide 5's provenance strip). PJM is glossed unconditionally in the spoken line
("the grid from Chicago to New Jersey"); the two dataset names are deliberate, because a
judge scoring "use of real-world public datasets" needs to see them named, and they read as
provenance rather than as something to decode.

## The type scale

The rule the review caught us on: **a qualifier that makes the slide truthful cannot be set
at a quarter of the headline size.** Current ratios, after rebalancing:

| Role | Was | Now | Ratio to headline |
|---|---|---|---|
| Headline (`h2.small`) | 64px | 56px | — |
| Explanatory line (`.sub`) | 38px | 42px | 0.75 |
| Series labels in charts (daytime, gas, clean) | 30px | 44px | 0.79 |
| Role and axis labels (serving utility, GW, MW) | 26–32px | 38px | 0.68 |
| Eyebrow | 23px | 30px | 0.54 |
| Provenance strip | 26px | 30px | — |

Nothing that carries meaning is now below 30px on a 1600×900 stage, i.e. below ~10px at
one-third scale. Verified by scaling every screenshot to 0.34 rather than assuming.

---

## The running order

| # | On screen | Spoken over it | Slide words | Runs |
|---|---|---|---|---|
| 1 | Fast fashion ✓, Airlines ✓, Oil majors ✓, **Datacenters** — an empty dashed slot | "There's a greenwashing watchdog for fast fashion. For airlines. For oil majors. There isn't one for datacenters — the industrial load every forecast says is growing fastest. So we built it." | 9 | 0:00–0:14 |
| 2 | a company's claim → the grid it draws from → what that grid burned, hour by hour | "We take a company's public clean-energy claim, find the grid its buildings actually draw from, and compare the claim to what that grid generated, hour by hour." | 14 | 0:14–0:26 |
| 3 | **+64.7** and **+17.7** clean bars, **3.7×** between them, under "Clean power added since 2019, by hour of day." | "Since twenty-nineteen we added sixty-five gigawatts to the average daytime hour, and eighteen to the overnight hour — to the hours a datacenter ignores. And that's after we corrected a nuclear plant the federal data counted twice." | 15 | 0:26–0:43 |
| 4 | gas **+10,740**, coal **−2,520**, clean **−81** MW, under "All the night growth was gas." | "PJM — the grid from Chicago to New Jersey — is where the datacenters are. Overnight generation there rose eight point seven gigawatts. Gas supplied ten point seven. Clean fell eighty-one megawatts." | 15 | 0:43–0:57 |
| 5 | Holding slide + provenance strip: EIA-930 via PUDL · 4.45M hourly rows · 70 grid operators · 354 indexed passages | *(the live app — four beats, below)* | 15 | 0:57–2:29 |
| 6 | 52 marks, 4 filled; "4 operators: their filings. 48: the grid only." / "Ten claims read, one we cannot verify." | "The thing we're proudest of is what it refuses to say. Ten claims read. Nine true on paper. One we can't verify. Forty-eight of fifty-two, we haven't read at all." | 15 | 2:29–2:43 |
| 7 | "matched 100% of our electricity" / Alphabet, p. 4 → Santee Cooper / serving utility → 5.6% / generated 2025 | "And every verdict ends at a named utility in a named region. Which means someone can look up who's exposed before the filing says so." | 15 | 2:43–2:54 |
| 8 | "It follows the power, not the press release." | "Wattson. It follows the power, not the press release." | 9 | 2:54–2:59 |

---

## Slide by slide

### 1 · The absence · 30 words · 14s

Three ticked rows in muted grey, then **Datacenters** in full ink with an empty dashed slot
where its tick would be. The dashed stroke is 5px `--muted`, not a 3px hairline: the empty
slot is the entire point of the slide and it has to survive the back of the room.

The spoken line says *"the industrial load every forecast says is growing fastest"*, not
"the fastest-growing industrial power load in America". That superlative is in neither
numbers file, and the project's own rule is that anything unmeasured is attributed out loud.

No signal hue: an absent watchdog is neither clean nor fossil.

---

### 2 · What Wattson is · 27 words · 12s — **new slide**

A three-box schema: **a company's claim** (dashed, neutral — a claim is not a measurement)
→ **the grid it draws from** (ink) → **what that grid burned, hour by hour** (`--clean`).

**Why it was added.** The previous running order never said what the product does. Slide 1
set up an absence, 3 and 4 were evidence, 5 was a holding slide, 6 was coverage, 7 a
verdict. A judge who only read the slides never learned what Wattson is. This is the only
plain-English definition in the talk, and slide 7 is deliberately the same shape carrying
Alphabet's real values — the schema, then the instance.

---

### 3 · Clean power added, day against night · 36 words · 17s

Two `--clean` bars to scale (400px for 64.7 GW, so 17.7 GW is 109px), a `3.7×` marker
between them, and the headline **"Clean power added since 2019, by hour of day."**

**Three defects fixed here.**

1. **The headline was false to a stranger.** "Four times more clean power by day" over bars
   reading 61 and 14 reads as a statement about *levels*, and the levels are 239.5 and
   173.4 GW — a ratio of 1.4. The word "added" was nowhere on the slide and the only
   qualifier was a 26px footer. The headline now carries "added since 2019" at 60px and the
   bar values carry a `+`.
2. **The figures were the contaminated ones.** 61.4 / 14.3 / 4.3× come from the published
   2019 baseline, which contains AZPS's phantom — the exact double count that backup B2
   exists to expose, two keypresses away. Using it would have been a 16% flattering number
   the team's own file proves wrong.
3. **The qualifier was sized as a footnote.** Bar labels are now 40px and the axis 32px.

**The computation, shown in full.** Published `meta.national.cf_avg_mw` 2019: daytime
178,129 MW, overnight 159,031 MW. `api/region/AZPS.json` `corrections[1]` on
`cf_avg_mw.2019` (confidence `proven`): overnight published 3,373 → corrected 34.7; daytime
published 3,736 → corrected 402.2. Phantom = 3,338.3 overnight, 3,333.8 daytime. Corrected
2019: daytime **174,795.2**, overnight **155,692.7**. Against 2025 (239,533 / 173,380):

- daytime **+64,738 MW**
- overnight **+17,687 MW**
- ratio **3.66 → 3.7×**

**Trap N1.** These are absolute megawatt averages per hour-class, not shares. Both go up.
On a corrected basis the overnight share is roughly flat (about 40.0% in 2019 against 39.7%
in 2025), so the old fallback line "the share slipped 40.5 to 39.7" also used the
contaminated baseline and is gone. Never say "four times cleaner by day".

---

### 4 · PJM · 30 words · 14s

A zero line with gas **+10,740** in `--fossil`, coal **−2,520** in dimmed `--fossil` below
the line, and clean **−81** as a hairline, in MW, under **"All the night growth was gas."**
The earlier headline, "Gas took all of it.", had no antecedent for "it" anywhere on the
slide — a stranger could not tell what gas had taken.

**What was wrong, and is fixed.**

- **A real rendering collision.** The old two-line headline overlapped the `+10.7` figure by
  191×12 pixels. The headline is now one short line and `window.__overlaps()` returns empty.
- **The colour taught the opposite of the truth.** The old slide drew the `+8,701` total in
  the fossil hue; that column was total generation. Now only gas and coal — which are fossil
  — are fossil-coloured, and the total is spoken, never drawn.
- **The arithmetic invited a challenge with no on-screen answer.** A judge can subtract:
  10.7 > 8.7. The coal bar now answers it before it is asked. Do not read coal aloud.
- **`−0.1` overstated the magnitude by 23%** in the flattering direction. It now prints
  **−81 MW**, which is also the better number: "eighty-one megawatts" sounds like a
  measurement.
- **"None clean" (a level) contradicted "−0.1" (a change).** The headline is now "Gas took
  all of it."

*Source: `api/region/PJM.json` — `total_avg_mw` overnight 82,539 → 91,240 = +8,701;
`fuel_delta_overnight_gw` gas +10.74, coal −2.52, nuclear −0.95 (deltas sum +8.69 against
+8.70); `cf_avg_mw` overnight 35,700 → 35,619 = −81.*

---

### 5 · Holding slide · 170 words · 92s + ~15s interaction

The slide carries a **provenance strip**: `EIA-930 via PUDL · 4.45M hourly rows · 70 grid
operators · 354 indexed passages`. It is up for ninety-five seconds and costs no spoken
time. This is where the dataset lives now that the old "4.45M / 70 / 111" spec-dump slide is
gone — deleting that slide was right, deleting the *dataset* was not.

**(a) The check — 29 words, 13s.**
*"Google claims one hundred percent renewable — page four. On the grid that serves the
site: five point six percent. True under the accounting rule. We're measuring a different
thing."*
The page cite is spoken because source citation is what the textual-analysis track scores.
"We never say they lied" is **cut** — it plants the word nobody asked for.
`api/company/GOOGL.json`, p.4 annual claim, Moncks Corner on Santee Cooper, 0.056.

**(b) The detector — 48 words, 22s. Never cut.**
*"We also find datacenters without a list of datacenters. A hundred and eleven regions
scored on the signature of flat, round-the-clock load. We named four test regions before we
ran it, so we couldn't cheat. Two landed in the top ten. Two missed. Both are on the
screen."*
**Two hits, two misses — corrected.** The previous script said "three hit" while backup B1
drew the AEP zone at 19th struck through as a miss, and this file said two and two. A judge
pressing `B` after hearing "three hit" saw two crosses. All three artefacts now agree.
"We named four test regions before we ran it, so we couldn't cheat" replaces "method frozen
before we saw the ranking", which was methodology jargon with no verb.

**(c) OpenAI and the blind spot — 49 words, 23s.**
*"[Six Stargate sites, every one mapped.] El Paso Electric, at three in the morning: one
megawatt out of six hundred and fifty-five. And El Paso Matters reports a gas microgrid
here that never touches that grid. If that's right, this load never shows up in federal
data. Including ours."*
**"If that's right" is restored** — `numbers-v2.md` §3 prescribes the conditional and both
the deck and the script had dropped it, asserting a press note at `confidence=medium` as
settled fact. The "one tenth of one percent" phrasing is gone: half a room hears it as ten
percent, and one megawatt out of 655 is the same fact as a picture.
`api/region/EPE.json`: overnight `cf_avg_mw` 1.0 of `total_avg_mw` 655.0 (654 gas, 1 solar).

**(d) The ask layer, Codex and the corpus — 44 words, 20s.**
*"And you can just ask it in English. That's OpenAI's tool-calling API over ten typed tools
— and Codex wrote the document-search layer underneath: three hundred and fifty-four
passages from their own filings, [six flagged as junk and kept visible,] every one with its
page."*
This beat now serves three sponsor tracks that the previous draft served not at all:
the tool-calling API and **Codex** (which appeared zero times in every pitch file), and the
**corpus** (likewise zero). "Seven tool calls" is **cut** — the call count is a property of
the live run and cannot be promised in advance.

**Corpus figures, recomputed here** (neither numbers file carries them yet): a direct count
over `claims/raw/*.jsonl` gives **354 records = 309 sustainability-report passages + 45
from 10-Ks**, across **8 source documents** and **312 distinct pages**; quality **341 ok, 7
tabular, 6 suspect**. Every record carries `page`, `source_doc` and `source_url`.

> **Units warning.** 354 is a count of **passages, not filings.** There are eight filings.
> Saying "354 filings" is wrong and is exactly the kind of error this project exists to
> catch. The slide says "354 indexed passages" and the script says "passages".

> **Tool count.** Say **"over ten typed tools"**. The *running service* reports **eleven**,
> including `search_corpus`, and the demo runs against that service — so eleven is what a
> judge would see. The copy of `server/ai.py` in the repo is stale and lists ten. "Over ten"
> is true of both and cannot be made wrong by the next deploy. If asked for a number, say
> eleven and name `search_corpus`. The model is `gpt-4.1`.

---

### 6 · What it refuses to say · 30 words · 14s

52 marks, 4 filled. Headline **"4 operators: their filings. 48: the grid only."** and a
38px line, **"Ten claims read, one we cannot verify."**

**Two fixes.** The slide used to read "Documents read for 4 of 52 operators" with the legend
"4 checked / 48 sites only" — a stranger could not tell what a document was here, why
reading one mattered, or whether 4 of 52 was good or bad, and the only statement the running
order made about documents was an admission of failure with no frame. It now leads with what
we **do** hold and puts the `cannot_verify` count on screen in the running order. Second,
the 48 hollow marks were stroked in `--line` and vanished at a third scale, so the slide read
as "four white squares" and the gap — the content — was invisible. They are now `--muted`.

*Source: `api/companies.json` — 52 operators, 134 sites, `count_with_claims` 4,
`count_sites_only` 48; 10 claims, 9 `true_on_paper`, 1 `cannot_verify` (Amazon,
`no_falsifiable_content`, `talk_score` null not zero). Verified `numbers-v2.md` §2.5.*

---

### 7 · The chain · 25 words · 12s

The same three-box shape as slide 2, filled in: the **quoted claim** with its page cite
(dashed, neutral) → **Santee Cooper**, labelled **serving utility** → **5.6%**, labelled
**generated 2025**, in `--clean`.

**Two fixes.** The first box used to be a bare `100%` with no provenance, which made the
only textual-analysis slide in the deck carry no text and no source; it now carries the
quotation and `Alphabet, p. 4`. And "Santee Cooper" meant nothing to a stranger, so it is
labelled as what it is.

*Source: `api/company/GOOGL.json` — claim p.4 of the 2026 Environmental Report (annual,
market-based, verdict `true_on_paper`); `sites[0].cf_share_2025` = 0.056.*

---

### 8 · Close · 9 words · 4s

*"Wattson. It follows the power, not the press release."* Then stop.

---

## Backup slides — one `B` away

| | On screen | The question it answers |
|---|---|---|
| B1 | Rank axis 1–111: 6th N. Virginia and 7th Omaha in ink; 19th AEP and 91st Dallas crossed out in `--warn` under "misses" | "How do I know you didn't tune the detector?" Weights, the 500 MW cut and the peak definition were frozen and four regions named before any rank was seen. **Two hits, two misses** — which is exactly what beat (b) now says. |
| B2 | Published 62% in `--warn` against corrected 1.7% in `--clean`, both landing on 10.4% | "Did Phoenix collapse from 62% to 10?" No — a double count we caught. r = 0.9948 over 7,976 hours, 7,087 MW against a 3,937 MW nameplate. Corrected, Phoenix *rose* from 2%. **Slide 3 already references this correction**, so B2 now confirms the story rather than ambushing it. |
| B3 | 100% claimed, 65% their own report, 5.6% the grid | "So 'true on paper' means they lied?" No. Annual matching is genuinely true under the accounting rule. Google's own page 94 says 65% hourly, ninety pages after the 100% on page 4. |

---

## What was deleted, and why

| Deleted | Reason |
|---|---|
| The old **title card** | The tagline is the last thing said, not the first. It closes the deck now. |
| The two **percentage lines** (37→47, 40→40) | Near-parallel slopes at slide scale; the headline did all the work. |
| **"Every hour, every grid" / 4.45M / 70 / 111** | A spec dump with no claim attached. But deleting the *slide* should not have deleted the *dataset*: EIA-930, PUDL and the row count are now on the holding slide's provenance strip, where they are visible for ninety-five seconds at no spoken cost. |
| **"The limits are on the screen, not in a footnote."** | A bare sentence in black — meaningless without the speaker, redundant with them. |
| The **team-credit block** | Credits are not an argument. Say the split in Q&A. |
| The **fossil-coloured +8,701 column** | It was total generation drawn in the fossil hue. |
| **61.4 / 14.3 / 4.3×** | Built on the published 2019 baseline, which contains the AZPS phantom that backup B2 exists to expose. Replaced by the corrected 64.7 / 17.7 / 3.7×, spoken as a correction we made. |
| **"Four times more clean power by day"** as a headline | False to anyone who does not already know the method: it reads as a statement about levels, and the levels are 239.5 against 173.4. |
| **"Three hit"** | Contradicted backup B1 and this file, both of which show two hits and two misses. |
| **"Seven tool calls"** | A property of the live run; unverifiable in advance and contradictable by the screen behind you. |
| **"We never say they lied"** | A denial nobody asked for that plants the word. |
| **"At annual resolution this finding does not exist"** | Said twice in thirteen seconds, and a boast about method rather than a finding. |
| **"the fastest-growing industrial power load in America"** and **"the largest datacenter cluster on earth"** | Unmeasured superlatives asserted as fact, in the opening sentences of the two most important slides. Both now attributed or reworded. |
| **"So it never appears in federal demand data"** | Dropped the conditional on a `confidence=medium` press note. Restored to "If that's right". |
| **"Quincy is a hundred percent carbon-free"** | "Is" is a consumption verb for a generation figure from a net exporter. |
| The **Nebius** beat | Both Nebius sites name a serving utility. |
| **"Twelve operators"**, **"eleven behind-the-meter sites"**, **Abilene as an OpenAI site** | Wrong by four times; not reproducible from the repo; filed under Oracle. |

## Open items for whoever owns the numbers files

- `numbers-v2.md` §2.1 verifies the **published** 61.4 / 14.3 / 4.3× and does not yet carry
  the corrected 64.7 / 17.7 / 3.7×. The computation is written out under slide 3 above and
  should be traced into that file.
- The **corpus counts** (354 / 309 / 45 / 8 docs / 312 pages / 341-7-6) are recomputed here
  from `claims/raw/*.jsonl` and are in neither numbers file. `numbers.md` §3 still lists
  *"354 chunks in claims/raw"* under UNVERIFIABLE with "don't quote it" — that entry is
  stale and should be re-verified and moved, not ignored.
- The README's line that the Elastic track is not claimable is out of date; the index is
  live.
