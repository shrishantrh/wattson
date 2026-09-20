# DEMO

**Live:** https://shrishantrh.github.io/wattson/

---

# 1. THE OPENING · 75 seconds
## Stay on the Home screen. Talk over it.

**This is the full version. Use it.** The 10-second hook in section 1b is only for when
someone is clearly in a rush or walking past.

> **"Every company building AI datacenters publishes a clean energy claim. Google, Microsoft,
> Meta, Amazon, all of them. And every one of those claims is checked by nobody."**

> **"There's a whole industry auditing fast fashion. There's one for airlines and one for oil
> companies. Datacenters are now the fastest-growing consumer of electricity in America, and
> there is no equivalent. Not one."**

Pause.

> **"And it isn't that nobody cared. It's that greenwashing here is an accounting problem, not
> a lying problem. These companies don't say they run on clean power. They say they *matched*
> their *annual* consumption with renewable *purchases*. That's a real accounting standard,
> it's correct, and it averages over every hour of the year. So buying solar at noon cancels
> burning gas at 3am, on paper. The claim is airtight and the physical question underneath it
> had never been asked."**

> **"And datacenters are unusual in one way that makes it matter. Your house uses most of its
> power in the evening. A factory runs shifts. A datacenter draws the same power at three in
> the morning as at noon, and it never stops. So half its life is spent in the half of the
> day that never got cleaner."**

> **"We hold fifty-two operators. The four you've heard of at least publish a report we can
> check. The other forty-eight, the neoclouds, the bitcoin miners that converted to AI, the
> colocation companies, mostly publish nothing at all. There is no claim to check and no
> report to read."**

> **"That's exactly why this works. The grid data doesn't care whether anyone published
> anything. We can measure what a company runs on whether or not it ever says a word, and
> those forty-eight are the ones building fastest right now."**

> **"So that's what Wattson is."**

> **"Wattson is a greenwashing investigation of datacenter operators. We settle every
> renewable claim against four and a half million hours of federal meter data, and hand
> asset managers the named utility on the other side of the gap."**

Say it flat and stop. Everything after this is you proving that sentence.

**Now click "What we found in the grid data →" at the bottom of the home screen.**

---

# 1b. THE 10-SECOND HOOK · only if they are rushing

> **"Solar panels don't work at night. Datacenters never turn off. Every AI company says it
> runs on renewable energy, and nobody ever checked what that means at 3am. So we did."**

Then go straight to the proof below.

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

# 3b. THE THREE HARD ONES

Never introduce these as features. Each one answers a doubt they already have.
**One sentence to open, one to land. Only go deeper if they lean in.**

---

## THE SCORE · answers *"how did you find them?"*

**Open:**
> **"We had to find datacenters without a list of datacenters."**

**Land:**
> **"So we scored every grid on three things you'd only see if a customer moved in that
> never turns off. Are the nights growing as fast as the days. Is it growing faster than its
> neighbours on the same grid. And is the daily demand curve flattening out."**
>
> **"Only an always-on customer does all three. It never reads a press release."**

**If they lean in:** the formula's on the Method tab. `z(overnight excess) + z(neighbour
divergence) + 0.5 × z(load factor change)`. The z puts three different units on one scale.
Half weight on the third because it hangs on a single peak hour.

---

## THE AI · answers *"how do you know what they claimed?"*

**Open:**
> **"We had to read 354 company reports, so we had AI do it."**

**Land:**
> **"It pulls every clean-energy claim out with a verbatim quote and the page number, so
> nothing on screen is our paraphrase. Then it scores how hedged each claim is — because
> '100% renewable' and '100% of annual consumption matched with certificates' are the same
> number and completely different claims."**

**The line that matters:**
> **"And the AI never computes a number. It reads text and answers questions. Every grid
> figure is plain arithmetic, which is why the whole thing reproduces exactly."**

---

## THE ML · answers *"how do I know you didn't make this up?"*

**Open:**
> **"Once we had a ranking, we spent the night trying to break it."**

**Land — say two, not four:**
> **"We re-ran the frozen method on 2026 data that didn't exist when we locked it. It held:
> eight of the top ten regions unchanged."**
>
> **"And we ran the same frozen method ending in 2021, 22, 23, 24. **Nothing before 2025
> shows a signal at all.** A method that manufactures signal would manufacture it every
> year. Ours only fires when the datacenters actually arrived."**

**If they want more, the other four:** all 5,989,005 possible four-region combinations
scored, 10,000 bootstrap rebuilds for rank stability, a model trained on raw demand shape
that never saw our formula and found the same regions, and 138 weather stations to rule out
hot summers.

**All the numbers are on the Method tab.** Point, don't recite.


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

# 5. THE OPENAI BEAT AND CMD-K

## OpenAI, with the substance

Type **`openai`**.

> **"We built the question box on OpenAI's models. So let's point it at OpenAI."**

**What's on screen, and it's more than people expect:**

> **"Six Stargate sites, and we traced each one to the utility that actually delivers its
> power. Abilene and Milam County in Texas. Lordstown and Pike County in Ohio — that one's
> AEP Ohio. Port Washington, Wisconsin, served by We Energies. And Santa Teresa, New
> Mexico."**

> **"Across those, 36.9% clean. Nobody published that. There is no OpenAI sustainability
> report to read. We got it from the meter."**

**Then open Santa Teresa:**

> **"El Paso Electric. 34% clean at midday, one tenth of one percent at 3am."**

> **"And this one we can't see at all — it runs on its own 700 to 900 megawatt gas plant
> that never touches the grid. We'd rather tell you than have you find it."**

**Why this beat is strong:** OpenAI publishes nothing, so there's no claim to check. The
grid data works anyway. That's the argument for the whole method, in one company.

---

## The Cmd-K queries. All tested, all return real tables.

**Company comparisons — the crowd-pleaser:**

| type this | you get |
|---|---|
| **"Compare OpenAI and CoreWeave"** | CoreWeave **40.1%**, OpenAI **36.9%**, with the grids behind each |
| **"Compare NBIS and CRWV"** | two neoclouds, ~3 seconds |
| **"Compare Google and Microsoft"** | both land near 46% |

**The ones that surprise people:**

| type this | you get |
|---|---|
| **"Who has the cleanest datacenters?"** | WhiteFiber and Vantage — **not** the names they expect |
| **"Which operators sit on the dirtiest grids at night?"** | Microsoft and Vantage in Phoenix, on Arizona Public Service |
| **"Which companies run on the most gas at night?"** | ranked, with the grids |

**The two that show the machinery:**

| type this | you get |
|---|---|
| **"Which five regions have the most clean power at 3am, and which utility serves each?"** | **7 tool calls**, table with links |
| **"What did Google say about 24/7 carbon free energy?"** | the passage **and its page number**, out of 354 documents |

**The line to say while it runs:**
> **"It's running ten typed tools against the real data. And it structurally can't show you
> a number the tools didn't return — we check every figure against what the tools returned
> and drop anything that doesn't match."**

**Best pair if you only get two:** `Compare OpenAI and CoreWeave`, then
`Who has the cleanest datacenters?` — the second one always gets a reaction, because the
answer is never who they guess.

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
