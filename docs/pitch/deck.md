# deck.md — what is on each slide, and the exact words said over it

**The deck is no longer the pitch.** `docs/DEMO.md` is: a click-by-click run of the live
site, checked screen by screen, with three-minute, five-minute and seven-minute cuts. This
deck is what surrounds it — a cold open spoken with hands off the laptop, a holding slide
while the site is driven, and a close — plus two backup slides for the night the site is
down.

- **Deck:** `docs/pitch/deck.html`. Self-contained, no external request, opens offline by
  double-click. Keys: `←` `→` `space` advance · `N` presenter notes · `F` full screen ·
  `B` backup slides · `?` control legend.
- **Spoken script:** `docs/pitch/script.md` — the cold open and the close only.
- **The demo:** `docs/pitch/../DEMO.md`. Everything between.
- **Figures:** traced to `docs/pitch/numbers.md` or `numbers-v2.md`, cited in each slide's
  presenter notes. Two figures used in the notes are read live from `web/public/api/` and
  are **not yet in either numbers file** — the NEVP day/night pair and the statistics from
  `docs/STATS.md`. They are spoken, never printed on a slide, and it says so in the notes.

## The cut, 2026-09-20

The deck had fifteen slides and told the same story as the demo, one beat behind it. That
is how it came to say "two hits, two misses" on a slide while the demo said "three landed,
Dallas came 91st". Rather than reconcile two tellings, the deck was cut to the slides a
live demo **cannot** do, and everything else moved to `slides/retired/`.

| Slide | Retired because |
|---|---|
| Annual vs hourly | DEMO.md §1 says it in words, in the first twenty seconds, better |
| What we built | DEMO.md §6 does it live on the Google page |
| How it works | DEMO.md §3 and §10 drive the real screens |
| Ask it in English | DEMO.md §9 types a real question into ⌘K |
| PJM at night | DEMO.md §4 — kept as a **backup slide** only |
| One claim, ten grids | DEMO.md §6 |
| The detector | DEMO.md §10 on the method page |
| Called in advance | DEMO.md §10 — kept as a **backup slide** only |
| What we print | DEMO.md §13, and it was two ideas on one slide anyway |
| Built on | DEMO.md answers the stack from `docs/evidence/` |
| Out of sample | Folded into the backup prediction slide's notes, with the four other tests |

Sentences taken from DEMO.md verbatim, so the two cannot drift again: the watchdog opening;
the Google claim quote with *matched*, *purchases* and *annual* stressed; the Las Vegas
pair; "the share fell, but clean output barely moved… if you only quote the share, you say
something false using true numbers"; "we fixed the weights and named four test regions
before we looked at any ranking"; and the close, "we measure the gap between a contract and
a meter".

---

## 1 · No watchdog — `01-problem.html#1`

**Seen.** Fast fashion, Airlines, Oil majors, each ticked. A rule. Then an empty box
beside the word *Datacenters*, in the accent colour. Headline: **None for datacenters. So
we built one.**

**Said.** "There is a greenwashing watchdog for fast fashion. For airlines. For oil majors.
There isn't one for datacenters, the fastest growing user of electricity in America. So we
built one." Then, still on this slide: "And these companies are careful. They don't say they
run on clean power. Google says it *matched* 100% of its consumption with renewable
*purchases*, on an *annual* basis. That's an accounting statement, and it's true. Nobody has
checked the physical one."

**Watch.** "Fastest growing user of electricity" is a superlative in neither numbers file.
If challenged, retreat to "every forecast says they're growing fastest" and move on. Never
paraphrase the Google quote as "100% renewable".

## 2 · Added since 2019 — `01-problem.html#2`

**Seen.** Two clean-coloured bars at one scale: **+64.7 GW** into the average midday hour
since 2019, **+17.7 GW** into the average 3am hour. An accent pointer labelled *Datacenter
load* running flat across both.

**Said.** "Since 2019 America added sixty-five reactors' worth of clean power to its midday
hours — eighteen reactors' worth to its three-a.m. hours. Solar fixed the daytime. A
datacenter draws the same power at three in the morning as at noon, and those hours never
improved."

**Why it survived.** It is the one number in the talk that needs a picture and has no screen
of its own. On the site the same fact is one grid and two columns: NEVP, 55.8% carbon-free
at midday and 1.8% at three in the morning. Say that on the site, not here.

**Watch.** These are megawatts **added**, not levels and not shares — the levels are 239.5
and 173.4 GW, a ratio of 1.4, and the slide says "added" for that reason. The overnight
share did not fall: 39.7% in 2019, 39.7% in 2025, with clean megawatts up 17.7 GW. Never a
share without the absolute in the same breath. Source: numbers-v2.md, *Addendum: the
corrected-baseline headline pair*.

## 3 · Live demo — `04-demo.html`

**Seen.** *Live demo · Wattson · shrishantrh.github.io/wattson*, over a quiet provenance
strip: EIA-930 / PUDL · 4,451,763 rows · 70 grid regions · 52 operators, 134 sites.

**Said.** "So we went and measured it." Then the site, from `docs/DEMO.md` §2.

**Why the strip.** This slide is up for four to six minutes, longer than any other, and a
judge scoring public-dataset use will read it. The URL is there so they can open it on their
own laptop while you talk.

## 4 · Close — `08-close.html`

**Seen.** *Wattson* · **It follows the power, not the press release.** · the URL · *Yash ·
Shri*. Nothing else.

**Said.** "We never say a company lied. Their claim is true under the standard. We measure
the gap between a contract and a meter. And we found an error in the federal data doing it.
A nuclear plant reported twice by two grid operators, totalling 1.91 times what it can
physically produce. We confirmed it three ways and we show the corrected number next to the
published one." Then: "Wattson. It follows the power, not the press release." Stop.

**Watch.** `→` from here walks into the backup slides. Stop pressing.

---

## Backup · only if the site is down

Press `B`. Both of these are shown live and better in the demo; they exist so that a dead
network is an inconvenience rather than the end of the pitch.

### B1 · Fallback: PJM at night — `09-backup.html#1`

**Seen.** *Chicago to New Jersey* · **Extra power at night: fossil.** Three bars at one true
scale, against a dashed rule at the +8,701 MW of total overnight growth: gas **+10,740**,
coal **−2,520**, clean **−81** — a sliver 1.3 pixels tall, below zero.

**Said.** "PJM — the grid from Chicago to New Jersey — generates 8.7 gigawatts more power at
night than it did in 2019. Not one net megawatt of that increase is clean." Then the honest
moment, in the demo's words: "The share fell, but clean output barely moved, 35,700 to
35,619 megawatts. No clean power was lost. The share fell because everything else in those
hours grew around it. If you only quote the share, you say something false using true
numbers."

**Watch.** The headline is about the **extra** power. PJM generated 35,619 MW of clean power
at night; never let the slide be read as "PJM has no clean power at night". Gas exceeds the
growth because it also replaced retiring coal. Figures: numbers.md §2.1.

### B2 · Fallback: the prediction — `09-backup.html#2`

**Seen.** **We named four. Then ranked 111 regions.** Four names written across the top —
Virginia 6th, Omaha 7th, Columbus 19th, Dallas 91st — each joined by a line down to where
the detector actually placed it on a rank line of 111. Three converge at the left end in the
accent colour; Dallas runs to a hollow mark near the right.

**Said.** "We fixed the weights and named four test regions *before* we looked at any
ranking, in the same commit as the code. Three landed in the top twenty. Dallas came 91st.
We published the miss."

**Why the picture is two rows.** The one thing a viewer cannot guess is that the four names
were written down *first*. The top row is the prediction; the rail is the result; the lines
are the only claim on the slide. It could have failed in public, and one of the four did.

**What the notes carry that no slide does.** The four destruction tests — permutation
p = 0.049 and we say marginal; ten thousand resampled rankings holding Dominion 3rd to 7th;
the frozen method re-run on 2026 data at Spearman 0.877 with eight of the top ten unchanged;
and the one that matters most, **nothing before 2025 is statistically significant**, which
dates the signal to the buildout. Plus the gradient boosted model on seventeen demand-shape
features, never shown the detector's output, that found the same regions at AUC 0.727 with
zero of a thousand shuffled-label runs beating it — and its concession, that region *size*
alone predicts our labels better at 0.749, so the honest claim is that shape adds
information beyond size. Sources: `docs/STATS.md`, `docs/DEMO.md` §§10–11.

**Say about a dozen.** DEMO.md §7 says eleven of our sites make their own power and never
touch the grid; our fact-check reproduced ten site notes saying so. Say *about a dozen*. The
limit is the point either way: a demand-only detector cannot see a datacenter that brought
its own power plant.
