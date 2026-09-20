# Wattson — the spoken script

**The pitch is the demo.** `docs/DEMO.md` is the click-by-click document and it is the
authority on every sentence said over a screen. This file covers only the part of the talk
that happens **before any screen is touched** and the part that happens **after the last
click** — the two slides of the cold open, the hand-off, and the close. Where a sentence
here also appears in DEMO.md, it is DEMO.md's sentence, copied, so the two cannot drift.

- The deck is four slides. `docs/pitch/deck.html`, opens offline by double-click.
  Keys: `←` `→` `space` advance · `N` presenter notes · `F` full screen · `B` backup · `?` legend.
- **Two backup slides** carry the PJM finding and the prediction. They exist for the night
  the site is down. If the site is up, both are better on the screen — DEMO.md sections 4
  and 10. Note that `→` from the close walks straight into them: stop pressing on the close.
- `(breath)` means stop, breathe, then keep going. `[ ]` is a stage direction, not spoken.
- **If a number on the screen disagrees with this script, the screen is right.**

**The language rule.** Nobody in the room builds power grids. *Grid region*, not balancing
authority. *How much of the power was clean*, not carbon-free share. *Draws the same power
at three in the morning as at noon*, not flat 24/7 load. *We named four regions before we
ran it*, not pre-registered. *Sixty-five reactors' worth*, not 64.7 GW.

---

## Part 1 — The cold open, and the hand-off. 0:00 to 0:40.

| Clock | YOU SAY | YOU DO |
|---|---|---|
| **0:00** | "There is a greenwashing watchdog for fast fashion. For airlines. For oil majors. There isn't one for datacenters, the fastest growing user of electricity in America. So we built one." | Deck full screen on **"No watchdog"**. Hands off the laptop. Look at the judges, not the screen. |
| **0:11** | "And these companies are careful. They don't say they run on clean power. Google says it *matched* a hundred percent of its consumption with renewable *purchases*, on an *annual* basis. That's an accounting statement, and it's true. (breath) Nobody has checked the physical one." | Still on the first slide. Still hands off. Never paraphrase that quote as "100% renewable". |
| **0:24** | "Since 2019 America added sixty-five reactors' worth of clean power to its midday hours — eighteen reactors' worth to its three-a.m. hours. Solar fixed the daytime. A datacenter draws the same power at three in the morning as at noon, and those hours never improved." | Press **→** to **"Added since 2019"**. Let the two bars sit for one beat. |
| **0:40** | "So we went and measured it." | Press **→** to **"Live demo"**. Now go to the site and drive `docs/DEMO.md` from section 2. |

**Then the demo runs.** Three-minute cut: DEMO.md sections 2, 6, 10 — the table, the
company, the freeze. Five minutes: add 3, 7, 9. Full: all of it, about seven minutes. Come
back to the deck only for the close.

## Part 2 — The close. The last twenty seconds.

| Clock | YOU SAY | YOU DO |
|---|---|---|
| **-0:20** | "We never say a company lied. Their claim is true under the standard. We measure the gap between a contract and a meter." | Still on the site, or already back on the deck. |
| **-0:12** | "And we found an error in the federal data doing it. A nuclear plant reported twice by two grid operators, totalling one point nine one times what it can physically produce. We confirmed it three ways and we show the corrected number next to the published one." | Press **→** to **"Close"**. |
| **-0:04** | "Wattson. It follows the power, not the press release." | Stop. Hands off the laptop. Do not press **→** again — the fallback slides are behind this one. |

## The 20-second version, if the room is running late

> "There's a greenwashing watchdog for fast fashion, for airlines, for oil majors. Not for
> datacenters. We built one out of federal hourly grid data. Las Vegas is fifty-six percent
> carbon-free at midday and one point eight percent at three in the morning — same grid,
> same year, ten hours apart, and a datacenter buys both equally. We check what a company
> claimed against what the grid under its buildings actually generated. We never say anyone
> lied; we measure the gap between a contract and a meter."

## What this file deliberately does not contain

The detector, the claim check, the question box, the stack, the statistics and the Palo
Verde correction are all **spoken over live screens** and their words live in `docs/DEMO.md`.
They were removed from here, and their slides retired to `docs/pitch/slides/retired/`, on
2026-09-20. Two documents telling the same story is how the deck came to say "two hits"
while the demo said "three landed". One story, one source: DEMO.md.

The four answers you will definitely be asked for — the heat objection, whether we tuned it
after seeing results, whether the data is right, and whether it is tradeable — are at the
foot of `docs/DEMO.md`. Have them there, not here.

Word count: `python3 docs/pitch/count-script.py` counts the SAY column of Part 1 only, which
is now the cold open. The demo is timed by its own cuts, not by word count.
