# DEMO

**Live:** https://shrishantrh.github.io/wattson/

---

# 1. THE HOOK · 10 seconds

> **"Solar panels don't work at night."**
>
> **"Datacenters never turn off."**
>
> **"Every AI company says it runs on renewable energy. Nobody ever checked what that means
> at 3am."**
>
> **"So we did. Every grid in America, every hour, nine years."**

Stop there. No jargon, nothing to teach. They already know solar doesn't work at night.

---

# 2. THE PROOF · 15 seconds

Click **Google**. Point at the two numbers.

> **"Google says 100%. Its datacenters actually run on grids averaging 46%."**
>
> **"Both are true. Their number is a yearly average, and a yearly average hides the night."**

**That is the whole pitch in 25 seconds.** Everything below is depth, on request.

Say "greenwashing investigation" *after* they've seen 100 vs 46, not before. Leading with it
makes people brace.

---

# 3. THE SCREENS · if they stay

## Day vs night — why the gap exists
> **"46% clean at midday. 39% at 3am, and that hasn't moved in six years."**
>
> **"The third number is the control: satellite data says the sun didn't change. So the
> daytime gain is panels we built. Panels make nothing at 3am."**

## What we found — the scale
> **"PJM serves the biggest datacenter cluster on earth. Clean power at night: 35,700
> megawatts in 2019, 35,619 today."**
>
> **"But total night power is up 8,700. Gas is up 10,700. Everything they added after dark,
> they added by burning something."**

## Method — why believe it
> **"A detector scores all 111 US grids on one question: does your demand look like a
> customer moved in that never turns off? Three signals: nights growing as fast as days,
> growing faster than neighbours, and the daily curve flattening."**
>
> **"We fixed the formula and named four test regions *before* looking at results, in the
> same commit as the code. Three landed in the top twenty."**
>
> **"Then we tried to break it. Re-ran it frozen on 2026 data that didn't exist yet — held,
> eight of the top ten unchanged. Ran it ending in 2021 through 2024 — nothing before 2025
> shows a signal. It's dated to the buildout."**

## Generating Alpha — what it's worth
> **"A datacenter is a huge electricity customer nobody announces. But it's in federal data
> within hours of switching on."**
>
> **"Northern Virginia, rank six, demand up 39% at night. The utility is Virginia Electric
> and Power. Parent: Dominion Energy, ticker D. That's a power meter to a public company."**
>
> **"Today it's an input, not a trade. We haven't tested it against prices. But that's the
> direction."**

---

# 4. THE THREE FLEXES

Drop these anywhere. They are strengths.

**We found an error in federal data.**
> **"Two grid operators each reported the same nuclear plant in full instead of their share.
> Together, 1.91 times what that plant can physically produce. Confirmed three ways."**

**We published the one we got wrong.**
> **"One of our four pre-named test regions, Dallas, came 91st. We left it in."**

**A model found it without our formula.**
> **"We trained a model on raw demand shape that never saw our formula. It found the same
> regions. AUC 0.727, and zero of a thousand shuffled runs beat it."**

---

# 5. THE OPENAI BEAT

Type **`openai`**.

> **"We built the question box on OpenAI's models. So let's point it at OpenAI."**

Six Stargate sites. Open **New Mexico**:

> **"El Paso Electric. 34% clean at midday, one tenth of one percent at 3am."**
>
> **"And this one we can't see at all — it runs on its own gas plant that never touches the
> grid. We'd rather tell you than have you find it."**

## Cmd-K, three prompts that work

| prompt | shows |
|---|---|
| "Which five regions have the most clean power at 3am, and which utility serves each?" | 7 tool calls, table with links |
| "What did Google say about 24/7 carbon free energy?" | the passage **and its page number**, out of 354 documents |
| "Compare NBIS and CRWV" | two neoclouds, ~3 seconds |

> **"It structurally can't show you a number the tools didn't return."**

---

# 6. ANSWERS

**"Where's the data?"**
> **"All federal, public, free. The government publishes what every grid generated every
> hour by fuel — 4.45 million rows since 2018. The part nobody had done is the join: 354
> company reports on one side, the meter data on the other, and a hand-built map of 134
> datacenters to the utility that serves each one."**

Then click **Data**: *"Every sheet an answer is built from. Sort it, download the CSV."*

**"Isn't it just hotter summers?"**
> **"138 weather stations, 9 million readings. Weather explains 7.8%. And Northern Virginia
> was *colder* in 2025 while its overnight demand rose four gigawatts."**

**"Did you tune it?"**
> **"Git proves not. The four test regions are in the same commit as the code that made the
> first ranking, and the only change after is 22 lines, none touching the score."**

**"How many companies?"**
> **"52 operators, 134 sites. Four publish reports we can check. The other 48 — neoclouds,
> converted bitcoin miners, colocation — mostly publish nothing. The grid data works on them
> anyway, and they're building fastest."**

**"What's it built with?"**
> **"Python and pandas over parquet, FastAPI, React. OpenAI for reading documents and the
> question box, Elasticsearch for the 354 documents, scikit-learn for the models. Static
> build, so every screen except the question box works with no network."**

**"Which datasets?"**
> **"PUDL bundles EIA, EPA, FERC and SEC data. We used three: EIA-930 hourly grid data is
> the spine, EIA-860 plant records proved the nuclear double-count, EPA smokestack monitors
> measured CO2 directly. Plus NOAA weather, NASA satellite irradiance, and 354 company
> documents."**

---

# 7. NUMBERS COLD

| | |
|---|---|
| Google | says **100%**, grids average **46%** |
| All three hyperscalers | **46%**. Claims differ, physics doesn't |
| PJM clean at night | **35,700 → 35,619 MW**, six years |
| PJM growth at night | **+8.7 GW**, of which **+10.7 gas** |
| Day vs night nationally | **46.5%** midday, **39.7%** at 3am |
| The chain | N. Virginia, rank 6, +39% → **Dominion Energy, D** |
| The federal error | **1.91×** the plant's nameplate |
| Scale | 4.45M hours · 111 regions · 52 operators · 134 sites |

**Never say** "Google claims 100% renewable." They said *matched*, *purchases*, *annual*.

---

# 8. IF IT BREAKS

- **Lost?** Click a company. That screen alone is the pitch.
- **Cmd-K slow?** Server waking, 3 seconds. Keep talking.
- **No network?** Everything except Cmd-K works offline.
- **Challenged hard?** `docs/evidence/` — nine files, each with quote and citation.

---

# 9. THE TRACKS

Lead with theirs if a sponsor judge is in front of you.

**Voloridge** — PUDL and your fetch script. 4.45M hours, and we went three sources deep: hourly grid, plant ownership, smokestack CO2. Plus NOAA for the weather control.
**Arrowstreet** — 354 documents, every claim pulled with a verbatim quote and page number, scored on how heavily it's hedged.
**Elastic** — all 354 indexed, so every quote comes back with its page and source URL.
**OpenAI** — the question box: ten typed tools, and it can't invent a figure.
**SpaceXAI** — Grok narrates the day-versus-night screen.
**Long Lake** — built for someone who doesn't believe us: method frozen first, our miss published, an error found in the federal data itself.
