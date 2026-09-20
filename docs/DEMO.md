# DEMO · read top to bottom, in order

**Live:** https://shrishantrh.github.io/wattson/
Bold = say it. Everything else is direction. Reference tables are at the very bottom.

---

# STEP 1 · HOME SCREEN · talk, don't click yet

> **"Every company building AI datacenters publishes a clean energy claim. Google, Microsoft,
> Meta, Amazon, all of them. And every one of those claims is checked by nobody."**

> **"There's a whole industry auditing fast fashion. One for airlines, one for oil companies.
> Datacenters are now the fastest-growing consumer of electricity in America, and there's no
> equivalent. Not one."**

Pause.

> **"And it isn't that nobody cared. Greenwashing here is an accounting problem, not a lying
> problem. These companies don't say they run on clean power. They say they *matched* their
> *annual* consumption with renewable *purchases*. That's a real accounting standard, it's
> correct, and it averages over every hour of the year. So buying solar at noon cancels
> burning gas at 3am, on paper."**

> **"And datacenters are unusual in one way that makes it matter. Your house uses most of its
> power in the evening. A factory runs shifts. A datacenter draws the same power at three in
> the morning as at noon and never stops. So half its life is in the half of the day that
> never got cleaner."**

> **"We hold fifty-two operators. The four you've heard of publish a report we can check. The
> other forty-eight, the neoclouds and the bitcoin miners that converted to AI, mostly publish
> nothing at all. The grid data works on them anyway, and they're building fastest."**

> **"Wattson is a greenwashing investigation of datacenter operators. We settle every
> renewable claim against four and a half million hours of federal meter data, and hand asset
> managers the named utility on the other side of the gap."**

**→ Click "What we found in the grid data" at the bottom of the screen.**

*(If they're rushing, skip all of the above and say: "Solar panels don't work at night.
Datacenters never turn off. Every AI company says it runs on renewable energy and nobody
checked what that means at 3am. So we did." Then jump to STEP 3.)*

---

# STEP 2 · WHAT WE FOUND · arrow through it

> **"This is PJM, the grid serving the biggest datacenter cluster on earth. Northern Virginia
> sits inside it."**

> **"Clean power at night: thirty-five thousand seven hundred megawatts in 2019. Thirty-five
> six nineteen today. Six years, eighty-one megawatts apart."**

> **"But total night power is up eight point seven gigawatts, and gas is up ten point seven.
> Everything they added after dark, they added by burning something."**

> **"And at annual resolution, this finding doesn't exist."**

---

# STEP 3 · DAY VS NIGHT · why the gap is there

> **"Forty-six percent clean at midday. Thirty-nine at three in the morning, and that hasn't
> moved since 2019."**

> **"The third number is the control. We pulled satellite data on actual sunlight hitting the
> ground. The sun didn't change. So the daytime gain is panels we built, and panels make
> nothing at 3am."**

---

# STEP 4 · TYPE "GOOGL" · the company, and the AI

> **"So who's claiming otherwise? This is Google's own sentence, from its own report, page
> four."**

**Now the AI, right here, because this screen is what it produced:**

> **"We didn't read these by hand. We ingested three hundred and fifty-four documents,
> sustainability reports and SEC filings, and had a language model do three jobs."**

> **"One: pull every clean-energy claim out with a verbatim quote and the page number, so
> nothing on this screen is our paraphrase. Two: score how hedged each claim is, because '100%
> renewable' and '100% of annual consumption matched with certificates' are the same number
> and completely different claims. Three: index all of it, so you can ask what a company said
> and get the passage and the page back."**

> **"And the model never computes a number. It reads text and answers questions. Every grid
> figure here is plain arithmetic, which is why the whole thing reproduces exactly."**

**Then the measurement:**

> **"That's the talk. Here's the walk. We take each of Google's ten datacenters, look up how
> clean the grid it sits on actually was, and average those ten numbers. Forty-six percent."**

> **"Both are true. The claim is correct under the standard. But one annual number is covering
> ten completely different physical realities."**

**Five seconds more if you have it:** type **MSFT**, then **META**.
> **"Microsoft, forty-six. Meta, forty-six. The claims are worded differently. The physics is
> the same."**

---

# STEP 5 · TYPE "OPENAI" · the sponsor beat

> **"We built the question box on OpenAI's models. So let's point it at OpenAI."**

> **"Six Stargate sites, each traced to the utility that delivers its power. Abilene and
> Milam County in Texas. Lordstown and Pike County in Ohio, that one's AEP Ohio. Port
> Washington, Wisconsin, on We Energies. And Santa Teresa, New Mexico."**

> **"Across those, thirty-seven percent clean. Nobody published that. There is no OpenAI
> sustainability report. We got it from the meter."**

**Open Santa Teresa:**

> **"El Paso Electric. Thirty-four percent clean at midday, one tenth of one percent at 3am."**

> **"And this one we can't see at all. It runs on its own gas plant that never touches the
> grid. We'd rather tell you than have you find it."**

---

# STEP 6 · CMD-K · hand them the wheel

**Best pair:**

1. **"Compare OpenAI and CoreWeave"** → CoreWeave 40.1%, OpenAI 36.9%
2. **"Who has the cleanest datacenters?"** → WhiteFiber and Vantage. **Never who they guess.**

**While it runs:**
> **"Ten typed tools against the real data. And it structurally can't show you a number the
> tools didn't return, because we check every figure against what the tools returned and drop
> anything that doesn't match."**

Others that work: *"Which operators sit on the dirtiest grids at night?"* (Microsoft and
Vantage, in Phoenix) · *"What did Google say about 24/7 carbon free energy?"* (the passage
**and its page number**) · *"Compare NBIS and CRWV"*

---

# STEP 7 · METHOD · why believe it, and the ML

> **"We had to find datacenters without a list of datacenters. So we scored every grid on
> three things you'd only see if a customer moved in that never turns off. Are the nights
> growing as fast as the days. Is it growing faster than its neighbours on the same grid. Is
> the daily demand curve flattening. Only an always-on customer does all three."**

> **"It never reads a press release. Demand data only."**

**Then the freeze:**

> **"We fixed that formula and named four test regions *before* looking at any results, in the
> same commit as the code. Three landed in the top twenty."**

**Then the ML, right here, because the numbers are on this screen — point, don't recite:**

> **"Then we spent the night trying to break it. Two things worth knowing."**

> **"We re-ran the frozen method on 2026 data that didn't exist when we locked it. It held:
> eight of the top ten regions unchanged."**

> **"And we ran it ending in 2021, 22, 23, 24. Nothing before 2025 shows a signal at all. A
> method that manufactures signal would manufacture it every year. Ours only fires when the
> datacenters actually arrived."**

**If they want more, it's all on this screen:** every possible four-region combination scored,
ten thousand bootstrap rebuilds, a model trained on raw demand shape that never saw our
formula and found the same regions, and a hundred and thirty-eight weather stations ruling
out hot summers.

**The flex, if it fits:**
> **"And we found an error in the federal data itself. Two grid operators each reported the
> same nuclear plant in full instead of their share. Together, 1.91 times what that plant can
> physically produce."**

---

# STEP 8 · GENERATING ALPHA · what it's worth

> **"A datacenter is a huge electricity customer nobody announces. But it's in federal data
> within hours of switching on."**

> **"Northern Virginia, rank six, demand up thirty-nine percent at night. The utility is
> Virginia Electric and Power. Parent: Dominion Energy, ticker D. That's a power meter to a
> public company."**

> **"Today it's an input, not a trade. We haven't tested it against prices. But that's the
> direction."**

---

# STEP 9 · CLOSE

> **"Three people use this. A journalist or regulator gets every claim with a page citation
> next to what the grid actually generated. Whoever builds the next datacenter gets a ranking
> of where clean power actually exists at three in the morning. And an investor gets a
> billion-dollar event in public data, two hours after it happens."**

> **"Datacenters are about to become the largest industrial electricity consumer in this
> country. Right now there's no instrument pointed at them. This is the first one."**

**Stop there.** No disclaimer.

---
---

# REFERENCE · only past this line

## The one thing to point at on the Data tab

**Data → Regions → find `NEVP`.** The columns **Night** and **Day** are next to each other.

| | Night | Day |
|---|---|---|
| **NEVP** (Nevada Power, Las Vegas) | **1.8%** | **55.8%** |

> **"This is Las Vegas. Fifty-six percent of its power is carbon-free at midday. One point
> eight percent at three in the morning. Same grid, same year, ten hours apart, and it's the
> biggest day-night gap in the country."**

> **"That's two columns of federal data. Nobody was hiding it. It had just never been put next
> to a company's claim."**

Then scroll to **GCPD** — 100% day and night, Columbia River hydro:
> **"Same table. So this measures, it doesn't just indict."**

## Three scores, name which one

| | describes | example |
|---|---|---|
| **Walk score** | a company | Google **46%** |
| **Talk score** | a company | Google **0.405** |
| **Rank** | a grid region | N. Virginia **rank 6 of 111** |

Default to **walk**. It's a plain average and you can't get it wrong. Never recite the
detector formula — point at Method.

## Numbers cold

| | |
|---|---|
| Google | says **100%**, walks **46%** |
| PJM clean at night | **35,700 → 35,619 MW** |
| PJM growth at night | **+8.7 GW**, of which **+10.7 gas** |
| Nationally | **46.5%** midday, **39.7%** at 3am |
| The chain | N. Virginia rank 6 → **Dominion Energy, D** |
| The federal error | **1.91×** the nameplate |
| Scale | 4.45M hours · 111 regions · 52 operators · 134 sites |

**Never say** "Google claims 100% renewable." They said *matched*, *purchases*, *annual*.

## Answers

**"Where's the data?"** All federal, public, free. 4.45M rows since 2018. The join is the
part nobody had done: 354 company reports, the meter data, and a hand-built map of 134
datacenters to the utility that serves each one.

**"Isn't it just hotter summers?"** 138 weather stations, 9M readings. Weather explains 7.8%.
Northern Virginia was *colder* in 2025 while overnight demand rose four gigawatts.

**"Did you tune it?"** Git proves not. Test regions are in the same commit as the code, and
the only change after is 22 lines, none touching the score.

**"Which datasets?"** PUDL bundles EIA, EPA, FERC and SEC data. We used three: EIA-930 hourly
grid, EIA-860 plant records, EPA smokestack monitors. Plus NOAA weather and NASA satellite.

**"What's it built with?"** Python and pandas over parquet, FastAPI, React. OpenAI for
documents and the question box, Elasticsearch for the 354 documents, scikit-learn for the
models. Static build, so everything except the question box works with no network.

## The tracks

**Voloridge** PUDL and your fetch script, three sources deep · **Arrowstreet** 354 documents,
verbatim quotes with page numbers, scored on hedging · **Elastic** all 354 indexed, every
quote openable · **OpenAI** ten typed tools, can't invent a figure · **SpaceXAI** Grok
narrates day vs night · **Long Lake** method frozen first, our miss published, an error found
in the federal data.

## If it breaks

Lost? Click a company, that screen alone is the pitch. Cmd-K slow? Server waking, keep
talking. No network? Everything except Cmd-K works offline.
