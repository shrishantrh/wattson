# review-deck.md — hostile review of the pitch

Reviewed 2026-09-20. Read-only. Targets: `docs/pitch/deck.html` (10 sections: 7 running,
3 backup), `docs/pitch/deck.md`, `docs/pitch/script.md`. Deck stepped through at 1440x900
in a browser, every slide, both backups behind `B` and the notes behind `N`, and every
slide re-shot at 0.34 scale to approximate the back of a room. Figures checked against
`docs/pitch/numbers.md` and `docs/pitch/numbers-v2.md`; honesty rules against `CLAUDE.md`
and the README. Rendered word counts read from `window.__wordCounts()`, not estimated.
Spoken word count computed from the file, not estimated.

Nothing in the repo was changed except this file.

**One correction to the brief, applied throughout:** the README's claim that the Elastic
track is "not claimable until `ELASTICSEARCH_URL` and `ELASTIC_API_KEY` are set" is **stale**.
The cluster is live — `wattson-corpus-v1`, 354 documents (309 sustainability-report
passages, 45 from 10-Ks; 341 clean, 7 tabular, 6 suspect) — and the corpus retrieval tool is
one of eleven typed tools in the ask layer, which reports model `gpt-4.1`. All four tracks
are therefore judged here as claimable. **The README row should be updated before a judge
reads it and concludes the team is claiming something it disclaimed.**

---

## Worst first, across all three positions

| # | Item | Position | Where |
|---|---|---|---|
| 1 | Slide 2 headline states a falsehood to anyone who does not already know the method | naive judge / fact-check | slide 2 |
| 2 | Slide 2 and the script use the *uncorrected* 2019 baseline that backup B2 exists to discredit | fact-check | slide 2, B2, README |
| 3 | Arrowstreet track is essentially unserved: no claim text, no page cite, no confidence spoken in the running order | tracks | whole deck |
| 3= | Elastic track is now live and claimable (354 indexed documents) and the pitch says nothing about it | tracks | whole deck |
| 3= | Beat (d) demos the weakest available question; one swap would serve six criteria across four sponsors | tracks | script beat (d) |
| 4 | OpenAI track: the Codex requirement is not met anywhere in deck, script or notes | tracks | whole deck |
| 5 | "Three hit" in beat (b) is contradicted by backup B1, which shows two hits and two misses | fact-check | script 0:45 beat (b) vs B1 |
| 6 | Voloridge: the dataset is never named and its scale never stated in the running order | tracks | whole deck |
| 7 | 178 s of words + zero seconds for typing, clicking, LLM latency and pauses | mechanics | slide 4 |
| 8 | 57% of the talk rides on one holding slide and a live app with no visual fallback | mechanics | slide 4 |
| 9 | Slide 3 invites "how does +10.7 come out of +8.7?" and has no on-screen answer | naive judge | slide 3 |
| 10 | "Seven tool calls" is a live-run figure asserted in advance and verified nowhere | fact-check | script beat (d) |
| 11 | The control legend `← → / space · N notes · B backup · F full screen` is projected to the audience on every slide, including full screen | mechanics | deck.html `#help` |
| 12 | Microgrid conditional dropped: "So it never appears" vs numbers-v2 "If that's right" | honesty | script beat (c) |
| 13 | Jargon fired before it is defined: PJM, overnight, carbon-free, footprint, true on paper, walk | naive judge | slides 2, 3, 4 |
| 14 | Footers and axis units vanish at one-third scale; on slide 2 the vanishing footer is the only thing that disambiguates the chart | mechanics | slides 2, 3 |
| 15 | Slide 3 headline is a verbatim restatement of the spoken sentence, which the deck's own rule forbids | mechanics | slide 3 |

---

# POSITION ONE — the judge who knows nothing about grids

Three minutes, forty projects deep, tired. Every flag below is a place where I either did
not know what a word meant, did not know which way a number pointed, or did not know what
I was supposed to conclude.

### 1.1 Slide 2 headline is false as written. **Worst thing in the deck.**

**On screen:** `Four times more clean power by day.` over bars `61` (daytime) and `14`
(overnight), axis `GW`, footer `average hour, 2019–2025`.

**What I concluded:** that in the daytime the American grid has 61 GW of clean power and
at night it has 14 GW, four times less. That is what the slide says. It is false: the real
figures are 239.5 GW by day and 173.4 GW at night, a ratio of 1.4, not 4.

The word that makes the slide true — **added** — is nowhere on it. The only hint is the
footer `2019–2025`, which is 22px mono, and at one-third scale it is an unreadable grey
smear (verified in the screenshot). The bars are also unlabelled as deltas: nothing carries
a `+`.

Worse, the deck's own note on this slide calls this "TRAP N1, the house trap" and forbids
the speaker from saying "the grid got four times cleaner by day" — and then prints a
headline that a non-expert reads as exactly that. The spoken line is careful; the slide is
not, and the slide is what the back row remembers.

**Fix.** Headline: `Since 2019 we added four times more clean power by day.` (9 words,
total slide 17 — so drop the footer's year range, which the headline now carries, back to
`average hour` and the count lands at 15.) Put `+61` and `+14` on the bars with the plus
sign. Change the axis label from `GW` to `GW added since 2019`.

### 1.2 Slide 3 makes an arithmetic promise it does not keep

**On screen:** `Overnight generation rose 8.7 gigawatts. None clean.` over a bar `+10.7`
labelled `gas` and a hairline `−0.1` labelled `clean`.

I can subtract. 10.7 is bigger than 8.7. My first thought is not "coal-to-gas switching",
it is "their numbers do not add up". The answer exists — coal −2.5, nuclear −0.9 — but it
lives only in the presenter notes, where the judge cannot see it, and the script only
deploys it "if challenged". By the time I challenge it, I have already stopped believing
the slide.

**Fix.** Add two small ghost bars in neutral ink to the right of `gas`: `coal −2.5` and
`nuclear −0.9`. The slide then reads as a decomposition and answers the question before it
is asked. If that breaks the 15-word cap, cut the eyebrow `PJM, 2019–2025` and put PJM in
the headline: `PJM at night: gas up 10.7, coal down 2.5, clean flat.`

### 1.3 "None clean" versus "−0.1"

The headline says **none**; the chart says **−0.1**. Those are different claims — one is
zero, one is negative. A tired judge reads this as sloppiness, and a sharp one asks which
it is. Also the minus glyph is a thin `−` at 0.34 scale and reads as a dash or disappears;
the teal hairline sits *above* the zero line in the render, so the bar looks positive.

**Fix.** Headline: `Gas took all of it. Clean fell 81 megawatts.` Label the hairline
`−81 MW` in full, not `−0.1`, and draw it two pixels *below* the zero line so the direction
is visible without reading. The GW axis label then only applies to the gas bar; move it
under `+10.7`.

### 1.4 Terms used before they are explained

Every one of these is fired at a non-expert with no gloss, in the first 45 seconds:

| Term | Where | What I need |
|---|---|---|
| **PJM** | slide 3, first word spoken | The script says "call it the mid-Atlantic grid if the room is not technical". At HackMIT the room *is* not technical. Make it unconditional: **"PJM — the grid from Chicago to New Jersey —"**. Do not leave this to a judgement call on stage. |
| **overnight** | slides 2 and 3, six times | Never defined out loud. It means 00:00–05:59 local. First use should be **"overnight — midnight to six"**. |
| **carbon-free / clean power** | slide 2 onward | Never defined. It means nuclear + hydro + wind + solar + geothermal. One clause on first use: **"clean — nuclear, hydro, wind and solar"**. Without it a judge assumes "renewable" and then B3's nuclear talk is confusing. |
| **generation** vs **demand** | slides 2, 3 | The whole pitch turns on this distinction and it is never drawn. The audience hears "power" and thinks "what they use". |
| **true on paper** | beat (a) | A term of art invented by this project, used as if it were common. Say **"true under the accounting rule, and here is the wire"**. |
| **balancing authority** | never spoken | Good — it is correctly avoided in the running order. The script's rule 5 ("say balancing authority, then gloss it") is now dead text; it contradicts a deck that never uses the phrase. Delete the rule or it will tempt the speaker into it live. |
| **footprint** | beat (c), B3 caveat | If the caveat has to be spoken, "footprint" needs a gloss: **"what the power plants inside that area produced"**. |
| **flat, round-the-clock load** | beat (b) | This is the core concept of the whole project and it is introduced at 1:06 in a subordinate clause. It should be established on slide 1 or 2. |
| **the ask layer** | beat (c) | Internal jargon. Say **"the question box"** or **"you can type a question at it"**. |
| **load factor, interchange, PPA, REC, market-based** | absent | Correctly absent from the running order. Note that "market-based" appears in the notes for beat (a) as a mandatory caveat — if the speaker reaches for it live it will cost fifteen seconds of confusion. Strike it from anything that can be said aloud in the three minutes. |

### 1.5 Sentences I had to read twice

- **"At annual resolution this is invisible, so we separate the hours."** (slide 2, and
  again on slide 3). "Annual resolution" is a data-science phrase. And it is the *opening*
  of the evidence — the first thing said after the hook is an abstraction about
  methodology. **Fix:** *"Nobody looks at the night separately. We did."*
- **"At annual resolution this finding does not exist."** (slide 3). Same phrase, second
  use in thirteen seconds. It sounds like a boast about method rather than a finding.
  **Fix:** cut it entirely — it buys nothing and slide 3 is already tight. Use the four
  seconds for the coal/nuclear decomposition instead.
- **"We measure the gap between a contract and a meter."** (beat a). Good line, but it
  arrives *after* "true on paper" and "on the grid that serves it", so by then I have
  already lost the thread. Move it to be the first sentence of the beat.
- **"Method frozen before we saw the ranking, four regions named in advance."** (beat b).
  Two pieces of methodology jargon in nine words, with no verb. A non-expert does not know
  why freezing matters. **Fix:** *"We wrote the scoring rule down and named four test
  regions before we ran it, so we could not cheat."*
- **"It distinguishes."** (beat d, final word). Two syllables, no object, and the script
  says it is the most important word in the beat. A tired judge hears nothing. **Fix:**
  *"So it is not just finding gas everywhere — it tells the clean grids apart."*
- **"Which means an asset manager can act on it."** (slide 6). At a student hackathon this
  lands as a non-sequitur unless the judge is from the finance sponsors. It is worth
  keeping for Voloridge/Arrowstreet, but give it a verb the room can picture: *"which means
  someone can look up who is exposed before the filing says so."*

### 1.6 Numbers whose units or direction are ambiguous

- Slide 2: `61` / `14` — no unit on the number, unit is a lone `GW` floating at the axis
  origin, and no sign. Levels or deltas is unresolvable from the slide.
- Slide 3: `−0.1` — see 1.3. Also `+10.7` is a delta while `8.7` (spoken) is a delta and
  `None clean` is a level. Three number types in one sentence.
- Slide 5: `4 checked` / `48 sites only` — "sites only" is meaningless to a newcomer. It
  means "we mapped where they are but never read a word they published". **Fix the legend
  to `48 no documents read`.**
- Slide 6: `5.6% generated` — generated *by whom, over what period*? The year (2025) and
  the object (the utility's own plants) are only in the notes. **Fix:** `5.6% on that grid,
  2025` — still inside the cap at 15 words.
- Beat (c): "thirty-four percent at midday and one tenth of one percent at night". "One
  tenth of one percent" takes five words and is heard as "ten percent" by half the room.
  **Fix:** *"one megawatt of clean power out of six hundred and fifty-five"* and drop the
  percentage entirely — the ratio is the picture.

### 1.7 What am I supposed to conclude?

Slide 1 tells me a watchdog is missing. Slides 2–3 tell me the night is dirty. The demo
tells me four things. Slide 5 tells me what the tool does not know. Slide 6 tells me an
asset manager can use it. **Nowhere does anyone say what a user does with Wattson.** There
is no sentence of the form "you type a company and you get X". Beat (a) comes closest and
opens with a rhetorical question instead.

**Fix:** make the first sentence of beat (a) declarative: *"You type a company. Wattson
finds every site it owns, the utility that serves each one, and what that utility actually
burned last year."*

---

# POSITION TWO — against the sponsor tracks

Requirement by requirement, from the "Tracks we are entered in" table in `README.md`.

## 2.1 Voloridge, "Signal in the Noise" (primary, $5k) — **partially served**

| Criterion | Served? | Where |
|---|---|---|
| Originality | **Yes** | The demand-only detector, beat (b): finding datacenters without a list of datacenters. This is the most original thing in the deck and it gets 22 seconds. |
| Technical excellence | **Weak** | Nothing about the pipeline is said aloud. Backup B1 has the frozen method, the 500 MW cut and the p99.5 peak definition — but only in the *notes*, and only if a judge asks. In the running order the word "hourly" is never spoken. |
| Insight | **Yes** | Slide 3 (PJM: all the night growth was gas) and slide 2 are exactly this. |
| Execution | **Yes** | 101 seconds of live product. |
| Real-world public datasets, made concrete | **NO** | See below. |
| Messy data | **NO in the running order** | See below. |

**Failure A — the dataset is never named and its scale is never stated.** `deck.md`'s own
"What was deleted" table records killing old slide 4 ("4.45M / 70 / 111") as "a spec dump".
That was right as a *slide* and wrong as a *deletion*: the result is that the words
EIA-930, PUDL, federal, hourly, and 4.45 million appear **zero times** in the seven running
slides and only once in passing in the script ("federal demand data", beat c, used to
describe a blind spot). A Voloridge judge scoring "use of real-world public datasets" has
nothing to score. The only surviving scale number, 111 regions, is spoken without saying
what a region is or where the data came from.

**Fix (costs four words and no slide):** change slide 3's spoken opening to
*"PJM — the mid-Atlantic grid — is the largest datacenter cluster on earth. In nine years
of federal hourly meter data, overnight generation there rose 8.7 gigawatts."* Then add
one mono line to slide 2's footer: `EIA-930 · 4.45M hourly rows · 70 grid operators`
(7 words; slide 2 then needs the headline trimmed per 1.1 to stay at 15).

**Failure B — the messy-data story is in a backup slide only.** The AZPS double count is
the single best "signal in the noise" artefact the team owns: two authorities reporting one
nuclear plant, r = 0.9948 over 7,976 hours, caught in their own output, published and
corrected shown side by side. It is **backup B2**, reachable only if a judge happens to ask
"did Phoenix collapse?" — a question no judge will ask, because Phoenix is never mentioned
in the running order. The deck has built a perfect answer to a question it has made
impossible to ask.

**Fix.** For a Voloridge-heavy room, spend eight seconds of the demo (cut beat b to 14s)
on B2 promoted into the running order after slide 3, with the line: *"And while we were
checking our own output we found a nuclear plant reported twice, by two different
operators, for eighteen months. We corrected it and we show both numbers."* This is the
strongest 8 seconds available to this track and it is currently unreachable.

## 2.2 Arrowstreet, "Best Textual Analysis Hack" ($1k) — **not served. The predicted gap is real.**

The brief: classify the likelihood that a company's public statements are greenwashing,
judged on (a) quality of evidence retrieved *with sources cited*, (b) creativity and
sophistication of the *textual* analysis, (c) confidence of the conclusion, (d) presentation
of findings.

| Criterion | Served in the running order? |
|---|---|
| Evidence retrieved with sources cited | **No.** No page number, document name, publication date or quotation is spoken or shown at any point in the seven running slides. `100% claimed` on slide 6 appears in a dashed box with no provenance. |
| Sophistication of the textual analysis | **No.** No mention of extraction, of magnitude/specificity/hedging scoring, of the four verdict classes, or of how a sentence becomes a falsifiable claim. The README says all of this exists (`docs/arrowstreet/SUBMISSION.md`); none of it reaches the stage. |
| Conclusion confidence | **Barely.** "true on paper" is said once, as an aside inside beat (a). The four verdict classes, the `cannot_verify` count and the `no_falsifiable_content` reason on Amazon are all backup-only (B3) or absent. |
| Presentation of findings | Partial. Slide 6's chain is good presentation of *one* verdict, stripped of its textual half. |

**And it is worse than absent — it reads as a disclaimer.** The only slide in the running
order that mentions documents is slide 5: `Documents read for 4 of 52 operators.` An
Arrowstreet judge watching this deck end-to-end learns exactly one fact about the team's
textual analysis: that they did not do it for 92% of the watchlist. The honesty is
admirable and the framing is suicidal for this track.

**Fix, and it is cheap.** Two changes:

1. **Put the text on slide 6.** Replace the bare `100%` box with the quoted sentence and
   its cite. Proposed slide 6, 15 words rendered:
   `"matched 100% of our electricity consumption"` / `Alphabet 2026 report, p. 4` →
   `Santee Cooper` → `5.6% on that grid, 2025`. That single change converts slide 6 from a
   grid slide into a textual-analysis slide with a source citation, at zero time cost.
2. **Rewrite slide 5's headline to lead with what was read, not what was not.**
   `Ten claims read. Nine true on paper. One we cannot verify.` (10 words) with the 52-mark
   grid kept underneath and the legend `4 checked · 48 no documents read`. The spoken line
   keeps the honesty beat verbatim — it just stops being the *only* thing said about text.
   This also puts the explicit `cannot_verify` count on screen in the running order, which
   the README claims is already done and currently is not.
3. **One sentence in beat (a), replacing "We never say they lied":**
   *"We pull the sentence out of the report with its page number, score how hedged it is,
   and then go and look at the wire."* Same length, and it is the only description of the
   textual pipeline anywhere in three minutes.

## 2.3 OpenAI — **two of three. The third is missing entirely.**

| Requirement | Served? | Where |
|---|---|---|
| Show the working product during the demo | **Yes** | Slide 4, 101 seconds live. |
| Explain how the OpenAI API is used | **Thin but present** | Beat (c): *"We built the ask layer on OpenAI's models"*. Beat (d) says *"Seven tool calls against the real data"* without attributing the tool-calling loop to the API. A judge hears "we used your model" and not "we used your tool-calling API over ten typed tools". |
| One concrete way Codex improved the process or outcome | **ABSENT** | The string "Codex" appears **zero times** in `deck.html`, `deck.md` and `script.md`, including in every presenter note and every backup slide. |

This is a stated, checkable requirement of the track and the pitch does not attempt it. The
team has the example ready in the README (Codex implemented the Elasticsearch integration)
and never says it.

**Fix.** Merge the API explanation and the Codex requirement into beat (d), which currently
has slack because "It distinguishes" is being asked to do too much work. Replace the last
sentence of beat (d) with:

> *"That's OpenAI's tool-calling API over eleven typed tools against our own data — and the
> document-search layer underneath it was written by Codex in one pass while we were
> building the pipeline."*

**Eleven, not ten.** The README says ten typed tools; the live ask layer reports **eleven**,
the eleventh being the corpus retrieval tool (§2.4). Nothing in the deck or script states a
tool count today, so there is nothing to correct — but do not inherit the README's ten.

That is 35 words, ~16 seconds. Beat (d) is currently 46 words / 21 s; cutting *"Seven tool
calls against the real data, back as a table with links"* (12 words, and see 3.6 — it is
unverifiable anyway) pays for 12 of those 35. The rest comes from cutting *"At annual
resolution this finding does not exist"* on slide 3 (per 1.5). Net time: roughly neutral.

**The Codex answer is concrete, truthful and available: Codex implemented the Elasticsearch
retrieval layer.** That is precisely the "one concrete way Codex improved your process or
outcome" the brief asks for, it is checkable, and it is not a vague productivity claim. Say
it in those words. Also note the live ask layer reports **gpt-4.1** — if a judge asks which
model, that is the answer, and it should be in the slide-4 presenter notes, which currently
say only "OpenAI's models".

If the speaker will not spend the seconds, the absolute minimum is a one-line credit on the
slide-4 holding slide — but a holding slide with text on it stops being a holding slide, so
prefer the spoken version.

## 2.4 Elastic, "Find the Signal" — **claimable, live, and invisible in the pitch. A whole track is being left on the table.**

**The README is out of date and must not be used to judge this.** The cluster is
provisioned and the index is live: `wattson-corpus-v1` holds **354 documents — 309 passages
from corporate sustainability reports and 45 from 10-K filings — with a quality breakdown
of 341 clean, 7 tabular, 6 suspect**. Real queries return real passages. The corpus
retrieval tool is one of **eleven** typed tools in the ask layer.

**What the pitch shows of it: nothing.** I checked every rendered word, every presenter
note, and both companion files. "Elastic", "Elasticsearch", "corpus", "index", "retrieval"
and "search" appear **zero times** in `deck.html`, `deck.md` and `script.md`.

This is now a bigger miss than it looked. The Elastic brief is *best use of Elasticsearch
to turn messy data into insights*, and the team is sitting on the cleanest possible answer
— 354 filings and reports, graded for quality with the bad rows counted rather than
dropped, retrieved live behind a question-answering layer — and says not one word about it
in three minutes. Worse, the 6 suspect and 7 tabular documents are exactly the
"messy-data-handled-honestly" beat this deck is otherwise so good at, and they are not on a
slide either.

It also propagates: the 354-document corpus is the *evidence retrieval with sources cited*
that Arrowstreet is scoring (§2.2) and the reason a page cite exists at all. The deck
currently presents page 4 and page 94 as if someone read the PDF by hand.

**Fix — one sentence, and it serves three tracks at once.** Put it in beat (a), where the
claim first appears on screen:

> *"Every claim behind this comes out of a searchable index of three hundred and fifty-four
> filings and sustainability reports — graded for quality, six of them flagged as junk and
> kept visible — so every verdict carries the page it came from."*

35 words, ~16 s. Pay for it with the cuts in 4.1. If only half the time exists, the minimum
viable version is nine words inside the existing beat (a) sentence: *"pulled from an index
of three hundred and fifty-four filings"*.

**Also fix the numbers file.** Neither `numbers.md` nor `numbers-v2.md` contains 354, 309,
45, 341, 7 or 6. The deck's own rule is that no figure reaches a slide that neither file
verifies, so these have to be traced and written into `numbers-v2.md` before they are
spoken. (`numbers.md` §3 currently lists *"354 chunks in claims/raw"* under UNVERIFIABLE
with the instruction *"don't quote it"* — that entry is now stale and contradicts the live
index; it must be re-verified and moved, not quietly ignored.)

## 2.5 The single best asset the pitch owns, and it is not in the pitch

Run live against the deployed ask layer:

> **"Which company claims 100% renewable but sits on the dirtiest grid at night?"**

The answer named Microsoft, said the claim is true on paper under market-based accounting,
placed its Arizona campus on a grid at 10% clean at night, noted that figure **rose from
2%** once a nuclear reporting error was corrected, gave the detector rank, and cited the
report page.

That is, in one breath: the **textual analysis with a page cite** (Arrowstreet), the
**hourly measurement** (Voloridge insight), the **correction the team found in federal
data** (Voloridge messy-data), the **detector** (Voloridge originality), the **OpenAI
tool-calling loop** (OpenAI), and the **corpus retrieval** that produced the cite (Elastic).
**Six of the things four sponsors are scoring, in one query, driven by a judge-legible
question in plain English.**

The current beat (d) instead asks *"Which regions have the most clean power at 3am relative
to their overnight demand?"* — a question that returns Grant County, demonstrates exactly
one capability (regional ranking), requires the "it distinguishes" defence to justify
itself, and carries the exporter-artefact trap (3.5).

**This is the highest-leverage single change available to the pitch and it costs nothing:
swap the question.** Proposed beat (d):

> *"And you can just ask it in English. Which company claims a hundred percent renewable
> but sits on the dirtiest grid at night? Microsoft — true on paper, page six — Arizona
> campus, ten percent clean at three in the morning, up from two once we corrected a
> double-counted nuclear plant. Claim, page, grid, correction, rank. One question."*

52 words, ~24 s against beat (d)'s current 46 / 21 s. Three seconds for six track criteria.

**Four cautions before this goes on stage.**

1. **"Dirtiest grid at night" is a superlative the data does not support globally.** El Paso
   Electric is 0.1% overnight; AZPS at 10.4% is nowhere near the dirtiest BA. The answer is
   only correct scoped to *companies in the watchlist making a 100% claim*. If a judge
   knows the EPE number from beat (c) — which the same talk just gave them — they will
   catch it. **Say the scope out loud:** *"of the companies we've read, the one on the
   dirtiest night grid is Microsoft."*
2. **Every figure in that answer must be traced before it is spoken.** Microsoft 100% at
   p. 6 is verified (`numbers.md` §2.6); AZPS 1.7% → 10.4% corrected is verified (D1); the
   AZPS demand-side detector rank of 3rd is in `CLAUDE.md` but is **not** in either numbers
   file. Trace it into `numbers-v2.md` or do not say the rank.
3. **Do not say "Phoenix collapsed" or let the 62% appear.** T2/D1. The corrected direction
   is *up*, 2% to 10%, and that is the version in the ask layer's answer — good, keep it.
4. **This is a live LLM call on stage.** The answer above is one sample; the next one may be
   phrased differently or pick a different company. Either accept that and script only the
   *question*, not the answer, or pre-run it and have a screenshot slide behind the holding
   slide (4.2). Do not read a scripted answer over a live response that may differ.

---

# POSITION THREE — fact-check

Every figure that appears on a slide or in a bold spoken line, traced to `numbers.md` or
`numbers-v2.md`.

## 3.1 The uncorrected national baseline. **This is the most dangerous item in the deck.**

Slide 2 and the script use **61 GW / 14 GW / four times**, sourced to `numbers-v2.md` §2.1,
which verifies them against `api/regions.json` `meta.national.cf_avg_mw` (2019 overnight
159,031 MW). Verified as published values.

But the team's own README says, verbatim:

> "These are the **corrected** 2019 figures... The published national baseline includes
> AZPS's 3,373 MW overnight phantom, Palo Verde nuclear counted once under Arizona and once
> under SRP, which our own corrections file proves. Published 2019 overnight clean reads
> 159.0 GW; corrected it is 155.7 GW. **Quote the corrected number and say that you
> corrected it.**"

README's corrected figures: **64.7 GW by day, 17.7 GW at night, 3.7x**. I checked the
arithmetic against `web/public/api/regions.json`: 173,380 − 155,659 = 17,721 MW, so the
README is internally consistent. The deck quotes the number the README explicitly tells the
speaker not to quote.

The exposure is not academic. **Backup B2, two keypresses away, is a slide whose entire
purpose is to prove that the 2019 AZPS figure is a double count.** If a judge presses B or
reads the README from the Devpost link, the team has demonstrated that it knew its 2019
baseline was contaminated and used it anyway to make the headline ratio look 16% larger
(4.3x instead of 3.7x). That converts the project's best credibility asset into its worst
liability.

The same contamination runs through the script's fallback line *"the overnight share
actually slipped, 40.5% to 39.7%"* (script.md, slide 2 block; deck.html slide 2 notes).
Corrected, 2019 overnight share is 155,659 / 388,814 = **0.400**, so the slip is 0.3 points,
not 0.8. The README goes further and calls it flat. Either way the scripted number
overstates the decline using a baseline the team has proven wrong.

**Fix.** Use the corrected figures on the slide and say that you corrected them. Slide 2
bars become `+65` and `+18`; headline `Since 2019 we added nearly four times more clean
power by day.` Spoken line:

> *"Since 2019 America added sixty-five gigawatts of clean power to the average daytime
> hour, and eighteen to the overnight hour. Nearly four times more, to the hours a
> datacenter ignores — and that's after we corrected a double-counted nuclear plant in the
> federal data."*

That is 48 words against the current 40, costs 3.7 seconds, and it does three jobs at once:
it makes the headline honest, it puts the messy-data story into the running order for
Voloridge (§2.1 Failure B), and it pre-empts B2 instead of being ambushed by it.

**If the team will not spend the seconds**, the minimum acceptable action is to update
`numbers-v2.md` §2.1 with the corrected companion figures and add one line to slide 2's
presenter notes: *"if asked about AZPS: corrected, it is 64.7 / 17.7 / 3.7x, same
direction, same conclusion."* Shipping the uncorrected number with no note is the one
option that is not survivable.

## 3.2 "Three hit" contradicts backup B1

**Script, beat (b), bold line:** *"four regions named in advance. Three hit. Dallas came
ninety-first, and the miss is on the screen."*

**Backup B1, rendered on screen:** N. Virginia 6th and Omaha 7th in white ink; **AEP 19th
and Dallas 91st both in `--warn`, both struck through with a circled cross, under the word
`misses`.** `deck.md`'s own B1 row says: *"Two hits, two misses, all four on screen."*

So the spoken script grades AEP at 19th as a hit and the backup slide grades it as a miss.
A judge who presses B after hearing "three hit" sees two crosses and one label reading
"misses". In a pitch whose entire differentiator is that it does not overstate, being caught
inflating your own hit rate by one out of four is disproportionately expensive.

`numbers.md` §2.3 verifies the ranks (6, 7, 19, 91) but takes no position on how many are
hits; §5 item 5 and T15 both describe it as *"put Data Center Alley 6th and Omaha 7th — and
missed Dallas at 91st"*, i.e. two named wins.

**Fix — pick one and make both artefacts agree.** Recommended, because it is the stronger
line: *"Four regions named in advance. Two landed in the top ten. The AEP zone came
nineteenth and Dallas came ninety-first, and both misses are on the screen."* (28 words vs
the current fragment's ~14 — offset by the cuts in 1.5.) If time forbids, the short version
is *"Two hits, two misses, all four published"* — 7 words, and it matches B1 exactly.

## 3.3 Unverified superlatives spoken as fact

| Line | Where | Status |
|---|---|---|
| *"the fastest-growing industrial power load in America"* | slide 1, spoken, **first sentence of the pitch** | Not in `numbers.md` or `numbers-v2.md`. The deck's own note concedes it: *"that is the framing claim, not a Wattson measurement — EIA and the regional operators' own load forecasts. Do not attach a number to it."* It is nevertheless delivered as a flat assertion of fact, unattributed, in the opening sentence. |
| *"PJM serves the largest datacenter cluster on earth"* | slide 3, spoken | Not in either numbers file. Not measured by Wattson. No source anywhere in the deck or notes. |

The project's stated rule is *"Anything you did not measure gets attributed out loud"*
(script.md, Rules for the recording). These two lines break that rule, and they are the
opening sentences of the two most important slides.

**Fix.** Slide 1: *"There isn't one for datacenters — the industrial load everyone's
forecasts say is growing fastest."* Slide 3: *"Northern Virginia, inside PJM, is the
densest datacenter cluster in the world by everyone's count."* Both keep the force, both
stop asserting a measurement the team does not hold. If the speaker prefers brevity, the
single word **"reportedly"** or **"by every forecast"** discharges the obligation.

## 3.4 The microgrid conditional is dropped

**`numbers-v2.md` §3 prescribes:** *"El Paso Matters reports a 700-to-900 megawatt gas
microgrid that does not connect to El Paso Electric. **If that's right**, none of this load
will ever show up in the federal data we use."*

**`script.md` beat (c) says:** *"And El Paso Matters reports this campus runs on its own gas
microgrid that never touches that grid. **So it never appears** in federal demand data.
Including ours."*

**`deck.md` beat (c) says:** *"So it **will never appear** in federal demand data."*

The attribution survives on the first clause and is then dropped on the second, which is
stated as settled fact about the future. The note is `confidence=medium`, `source_type:
press`, one article dated 2025-09-25. Three files, three different tenses, and the two that
will actually be spoken are the two that assert.

**Fix, and align both files:** *"...a gas microgrid that never touches that grid. If that's
right, this load will never appear in federal demand data. Including ours."* Four extra
words, and it is the difference between a confession and an overclaim.

## 3.5 "Quincy, Washington: a hundred percent carbon-free at 3am"

`numbers-v2.md` verifies GCPD overnight `cf_share` = 1.000 (§2.3, §2.6). The figure is
correct. But trap **N5/N6** in the same file says the honest sentence is *"the Grant County
PUD footprint **generated** 991 megawatts overnight, all Columbia River hydro"*, because the
BA is a net exporter (991 MW generated against 735 MW of demand) and "is 100% carbon-free"
is a consumption phrasing.

The script's own direction acknowledges this in the paragraph *below* the bold line
(*"Grant County generated 100% and exports — 'runs on' is the wrong verb"*) and then leaves
the bold line saying a place "is a hundred percent carbon-free". The speaker will read the
bold line.

**Fix the bold line:** *"Quincy, Washington: the grid there generated a hundred percent
carbon-free at 3am — all Columbia River hydro."* Same length, survives the follow-up.

## 3.6 "Seven tool calls" is not verifiable and should not be asserted in advance

Beat (d): *"Seven tool calls against the real data, back as a table with links."* Neither
`numbers.md` nor `numbers-v2.md` contains this figure, and it cannot be in them: the number
of tool calls an LLM makes is a property of the live run, not of the export. If the run on
stage makes five or nine, the speaker has said something false in front of the judges while
the counter-evidence is on the screen behind them.

**Fix:** *"That ran a handful of tool calls against the real data and came back as a table
with links."* Or, better, use the seconds for the Codex/API line from §2.3 and drop the
count entirely — the table with links is the impressive part, not the call count.

## 3.7 Rounding on slide 3

`−0.1` on the clean hairline is a rounding of −81 MW (−0.081 GW), a 23% overstatement of the
magnitude in the direction that flatters the argument. Numerically trivial; rhetorically
avoidable. `numbers.md` §2.1 verifies −81 MW. **Say and print −81 MW.** It is also a better
number: "eighty-one megawatts" sounds like a measurement, "minus nought point one" sounds
like a rounding.

## 3.8 Honesty rules, checked one by one

| Rule (`CLAUDE.md` / README) | Verdict |
|---|---|
| Never "caused by" | **Pass.** The string does not appear in any spoken line. Slide 3's notes carry the "consistent with" discipline. Note that the slide itself never says "consistent with" either — it says nothing causal at all, which is the safest option. |
| Never say a company lied | **Pass, with a rhetorical warning.** No line asserts a lie. But beat (a) says *"We never say they lied"* — which introduces the word "lied" into the judges' heads, and is a denial nobody asked for. **Prefer:** *"The claim is true under the accounting rule. We are measuring a different thing."* Same work, no denial. |
| Never state a share falling without the absolute in the same breath | **Pass in the spoken lines, fail on the slide.** Slide 2's headline `Four times more clean power by day` is a ratio the audience will decode as a share claim (see 1.1). The scripted fallback line *"the overnight share slipped, 40.5% to 39.7%"* does pair the share with *"clean megawatts at night rose 14 GW"* in the surrounding prose — but the bold-only reader gets the share without the absolute. Put the pairing inside the bold. |
| Unverifiable claims counted, not hidden | **Pass in spirit, thin in execution.** Slide 5 counts the coverage gap out loud, which is the best beat in the deck. But the `cannot_verify` count (1 of 10 claims, Amazon, `no_falsifiable_content`) appears only in backup B3. The README asserts "the `cannot_verify` count... on screen"; in this deck it is not, in the running order. See the §2.2 fix, which puts it there at zero time cost. |
| Zones inherit the parent BA's generation; never attribute PJM's gas to Dominion | **Pass.** Dominion is not mentioned in the running order at all. |
| Average mix, not marginal | **Notes only.** Acceptable for three minutes; make sure the speaker has T6 loaded for Q&A. |
| Footprint not consumption | **Fails twice in bold lines** — beat (a)'s 5.6% (caveat is "mandatory if you linger", i.e. conditional) and beat (d)'s Grant County (see 3.5). Both fixes above. |

## 3.9 Figures that check out clean

For completeness, every remaining figure traces: 61,404 / 14,349 / 4.279 (v2 §2.1, as
published — see 3.1), PJM 8,701 MW and gas +10.74 GW (numbers.md §2.1, v2 §2.7), clean
−81 MW (§2.1), Google 100% p.4 and 5.6% (§2.6), Santee Cooper / SCEG 42% (§2.6), 111
regions and ranks 6/7/19/91 (§2.3), EPE 34.1% / 0.1% / 1 of 655 MW (v2 §2.2), GCPD 1.000
and 991 MW hydro (v2 §2.3), 52 operators / 134 sites / 4 checked / 48 sites-only (v2 §2.5),
107 and 42 (v2 §2.5, N12), OpenAI's six sites named correctly per X3 with Abilene properly
excluded (v2 §2.4), B2's 62% / 1.7% / 10.4% / r=0.9948 / 7,976 hours / 7,087 MW / 3,937 MW
(numbers.md D1), B3's 65% series and "9 of 10 true on paper, 1 cannot_verify" (§2.6).

The corrections applied since the last draft — X1 (48 not 12), X2 (Nebius), X3 (Abilene),
X4 (behind-the-meter) — are all correctly propagated into both the deck notes and the
script. That work is sound and should not be revisited.

---

# MECHANICS

## 4.1 Does the script fit three minutes? Counted, not estimated: **no, once the room is real.**

Counted from `script.md` by extracting every `> **...**` block:

| Block | Words |
|---|---|
| Slide 1 | 29 |
| Slide 2 | 40 |
| Slide 3 | 29 |
| Beat (a) | 45 |
| Beat (b) | 47 |
| Beat (c) | 82 |
| Beat (d) | 46 |
| Slide 5 | 38 |
| Slide 6 | 21 |
| Slide 7 | 9 |
| **Total** | **386** |

386 / 130 × 60 = **178.2 s**. The file's own table is accurate. Three problems with it:

1. **Numerals are counted as written, not as spoken.** "8.7 gigawatts" is 2 tokens and 4
   spoken words. "10.7" is 1 and 3. "3am" ×2 is 1 each and 2–3 each. Expanding the numerals
   the way the speaker will actually say them adds **~8 words ≈ 3.7 s**, putting the talk at
   **~182 s — already over the 180 s budget with no pauses at all.** Note the script is
   inconsistent about this: it spells out "one hundred percent", "a hundred and eleven",
   "six hundred and fifty-five" and "ninety-first", but leaves "8.7", "10.7" and "3am" as
   digits. Spell all of them out and re-run the counter, or the counter is measuring a
   different talk than the one that gets delivered.
2. **Zero seconds are budgeted for anything but talking.** Slide 4 requires: switching from
   deck to app, typing a ticker, waiting for a company page, navigating to the detector,
   typing `openai`, opening a site page, opening ⌘K, typing a question, waiting for a grey
   completion, hitting Tab, and waiting for a multi-call LLM round trip to return a table.
   The script budgets **0.0 s** for all of it. A realistic figure is 20–35 s. The talk is
   therefore **200–215 s against a 180 s budget**, i.e. 10–20% over.
3. **The script instructs the speaker to pause and then charges nothing for it.** *"Let
   the two bars land before you say the numbers"*, *"Do not talk over the bars"*, *"break
   hard before 'There isn't one'"*, *"Hands off the laptop, look up"*, *"Then stop."* Those
   are five deliberate silences, all correct direction, none costed. Call it another 6–8 s.

**Fix.** Rebudget at **155 spoken seconds and 25 seconds of dead air**, which means cutting
~50 words. The cuts that hurt least, in order:
- *"At annual resolution this finding does not exist."* (slide 3, 8 words) — duplicate of
  slide 2's framing.
- *"Seven tool calls against the real data, back as a table with links."* (beat d, 12
  words) — unverifiable anyway (3.6).
- *"We never say they lied."* (beat a, 5 words) — a denial nobody asked for (3.8).
- *"Which means an asset manager can act on it."* (slide 6, 8 words) — **do not cut**; the
  deck is right that this is load-bearing. Listed only to say it was considered.
- Beat (b) compressed to the "two hits, two misses" version (3.2) saves ~10 words.

That is ~35 words of slack, which plus the tightening in 1.5 pays for the corrected-baseline
line (3.1) and the Codex line (2.3) without going over.

**Also: the script's stated contingency is insufficient.** *"If you are behind: cut beat (b)
whole"* removes 47 words / 22 s. If the true overrun is 20–35 s, cutting beat (b) is the
*only* lever and it removes the detector — the single most original thing in the project and
the core of the Voloridge case. Add a second, cheaper lever: **drop slide 5 to one sentence**
(*"We've read documents for four of fifty-two operators, and every record says so"*, 13
words, saves 25 words / 11 s) so the speaker is not forced to choose between the detector
and finishing.

## 4.2 Every slide has a spoken sentence; every beat has a slide — with one structural caveat

Checked all seven running slides against `script.md`. Each has exactly one bold spoken block
(slide 4 has four). No orphan slides, no orphan beats. Backups correctly carry no spoken
line and are marked `BACKUP — NOT IN THE RUNNING ORDER` on screen.

**The caveat:** slide 4 is a single holding slide covering **101.5 of 178 seconds — 57% of
the talk**. For that majority of the pitch, the deck contributes a pulsing dot and the words
"Wattson, running." Everything else rides on a live application. The failure plan covers
only the ask layer (*"⌘K degrades to the deterministic command palette"*). There is no plan
for the app not loading, the browser not switching, the projector losing the second source,
or a site page erroring.

**Fix.** Add three static screenshot slides behind the holding slide — the Google company
card, the detector ranking, the EPE region page — reachable with `→` and skipped in the
normal flow (or place them behind a fourth key like `S`). They cost nothing if the demo
works and they save the pitch if it does not. `deck.html` already supports a `data-backup`
attribute and a `B` jump, so the mechanism exists; this is a 20-minute change.

## 4.3 Word cap: all ten slides pass, two are at the ceiling

`window.__wordCounts()`, read live from the deck:

| Slide | Words | |
|---|---|---|
| 1 absence | 9 | |
| 2 61 vs 14 | **15** | at cap — the fix in 1.1 must trade words, not add them |
| 3 PJM | 14 | |
| 4 holding | 3 | |
| 5 coverage | 13 | |
| 6 chain | 14 | |
| 7 close | 9 | |
| B1 detector | **15** | at cap |
| B2 Phoenix | 14 | |
| B3 page 94 | **15** | at cap |

No slide exceeds 15. The `deck.md` table agrees with the live counter on every row. This is
the one mechanical claim in the deck documentation that is fully true as stated.

## 4.4 Legibility at one-third scale (back of the room)

Every slide was re-rendered at 0.34 scale. What survives and what does not:

| Slide | At 1/3 scale |
|---|---|
| 1 | Headline rows legible. **The dashed empty box next to `Datacenters` — the entire point of the slide — is a faint grey outline that nearly disappears.** Fix: thicken the dash stroke to 3px and lift it to `--warn` or full `--ink`; the "absent" semantics survive a visible box. |
| 2 | Bars and `61`/`14` read clearly. **`average hour, 2019–2025` and the `GW` axis label are both illegible smears.** Since that footer is currently the only thing distinguishing a delta from a level, the slide at range says something false (see 1.1). Fix: fold the disambiguation into the headline and raise the footer to 26px. |
| 3 | `+10.7` and `−0.1` read; **the `−` sign does not resolve, and `GW` at the far right vanishes.** The clean hairline reads as a small positive bar. Fix per 1.3. |
| 4 | `Wattson, running.` reads. Fine. |
| 5 | Headline reads. **The 48 hollow squares nearly vanish into the background, so the slide reads as "four white squares" and the gap — the actual content — is invisible.** Fix: raise the hollow stroke from `--line` to `--muted`; the contrast between filled and hollow is still obvious. |
| 6 | All three boxes and labels read. Best slide in the deck at range. |
| 7 | Reads. Fine. |
| B1 | **`N. Virginia 6th` and `Omaha 7th` are two dots overlapping at the left edge and unreadable; the rank axis has no left-hand label, so `111` at the right end floats without a scale; `misses` is illegible.** Fix: label the axis `rank, 1 of 111` at the left, and separate the 6th/7th markers vertically. |
| B2 | Lines read, but **the `published` label is overprinted by the dotted line it labels** — at range it is a smudge. Fix: move the label above the line. |
| B3 | Reads well. |

## 4.5 Presenter mechanics

- **The control legend is projected to the audience.** `#help` (`← → / space · N notes ·
  B backup · F full screen`) is `position:fixed`, always visible, on every slide, in full
  screen too — there is no rule hiding it. Same for `#hud` (`1 / 7`). A slide-count is
  defensible; a keyboard cheat-sheet on the projected image is not. **Fix:** hide `#help`
  after first keypress, or bind it to `?`, or at minimum add
  `:fullscreen #help{display:none}`.
- **There is no presenter view.** `N` renders the notes *in the same window*, occupying the
  bottom 34vh. On a mirrored display — the normal hackathon table setup — pressing `N`
  shows the judges the trap list, including the sentences the speaker is forbidden to say
  ("never say 'we found'", "never round 48 down"). **Fix:** either accept that `N` is for
  rehearsal only and say so in `deck.md`, or open the notes in a `window.open()` child so
  they can be dragged to a laptop screen.
- **Notes panel clips the slide.** With `N` on, the stage scales down but the backup pill
  (`position:absolute; top:40px`) is cropped at the top of the viewport. Cosmetic, but it
  will be noticed in rehearsal and wrongly diagnosed as a rendering bug.
- **Slide 3's headline is a verbatim restatement of the spoken sentence** — the slide reads
  `Overnight generation rose 8.7 gigawatts.` and the speaker says "Overnight generation
  there rose 8.7 gigawatts." `deck.html`'s own header comment states rule 2: *"A slide that
  only restates the narration has been deleted."* `deck.md` deleted old slide 6 for exactly
  this offence and then let slide 3 commit it. The fix in 1.2 resolves both.

---

# If only three things change

**1. Fix slide 2 — the headline and the baseline together.** It is simultaneously the
slide that earns the entire premise, the one sentence in the deck that is false as a
non-expert reads it (1.1), and the one figure built on a 2019 number the team has itself
proven wrong two keypresses away (3.1). New headline `Since 2019 we added four times more
clean power by day.`, bars `+65` and `+18` from the corrected series, and the spoken line
carrying *"— and that's after we corrected a double-counted nuclear plant in the federal
data."* One change makes the slide true at a glance, makes the number defensible under the
team's own README, and drops the Voloridge messy-data story into the running order where a
judge will actually hear it.

**2. Put the text back into the pitch — slide 6 and one sentence in beat (a).** Replace
slide 6's bare `100%` with the quoted claim and its page cite (`"matched 100% of our
electricity consumption" — Alphabet 2026 report, p. 4`), retitle slide 5 to lead with
`Ten claims read. Nine true on paper. One we cannot verify.`, and add to beat (a): *"We
pull the sentence out of the report with its page number, score how hedged it is, and then
go and look at the wire."* Arrowstreet is currently scoring a textual-analysis hack whose
only on-screen statement about documents is that it did not read 48 of them. This costs
about eight seconds and converts a zero into a real entry.

**3. Rebudget the demo and pay for the Codex line out of the savings.** The talk is
~182 s of words before a single click, keystroke or LLM round trip, against a 180 s budget;
realistically 200–215 s. Cut *"At annual resolution this finding does not exist"*, *"Seven
tool calls against the real data..."* and *"We never say they lied"* (25 words, ~12 s),
compress beat (b) to the "two hits, two misses" version that matches backup B1 (3.2), and
spend part of the savings on the OpenAI track's third requirement, which is currently
unmet in every file — and, in the same breath, the Elastic and Arrowstreet evidence that is
live and unmentioned: *"That's OpenAI's tool-calling API over eleven typed tools, and Codex
wrote the document-search layer underneath it in one pass — an index of three hundred and
fifty-four filings, six of them flagged as junk and kept visible."*

**The single highest-leverage version of item 3:** swap the ⌘K question to *"Which company
claims 100% renewable but sits on the dirtiest grid at night?"* (§2.5). One live answer then
carries the claim, the page cite, the hourly grid figure, the correction the team found in
federal data and the detector rank — six criteria across all four sponsors in about twenty
seconds, against the current question's one. Scope the superlative out loud ("of the
companies we've read") and trace the AZPS detector rank into `numbers-v2.md` first.

---

*Everything above is a criticism with a proposed replacement, as asked. One thing deserves
to be said without qualification: slide 5 is the best beat in the pitch and should not be
softened — it should be joined by the three live capabilities (the corpus, Codex, and the
ask layer's best question) that the pitch currently keeps to itself.*
