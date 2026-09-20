# DEMO SCRIPT

Read top to bottom. **Bold lines are what you say.** Everything else is direction.

Shape: **talk for a minute → show for four → land the payoff in one.**

**Live:** https://shrishantrh.github.io/wattson/
**API:** https://wattson-api-v2.fly.dev/ (⌘K needs this; everything else works without it)

**Before you walk up:** open the site, press ⌘K once and close it. That wakes the API so
your first real question is instant instead of taking three seconds.

---

# PART ONE · THE OPENING
## 75 seconds. Stay on the Home screen. Talk over it.

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

> **"So we take the claim where there is one, work out which grid each datacenter actually
> plugs into, and put it next to what the power plants burned. What we wanted was one thing:
> to turn a claim nobody could check into a number you can look up."**

**Now click "What we found in the grid data →" at the bottom of the home screen.**


---

# PART TWO · HOW IT WORKS
## Four screens, about four minutes.

---

## SCREEN 1 · **What we found**
### You just clicked here from Home. Arrow through the four steps.

> **"This is PJM, the grid serving the largest datacenter cluster on earth. Northern Virginia
> sits inside it."**

> **"Thirty-five thousand seven hundred megawatts of clean power at night in 2019.
> Thirty-five thousand six hundred and nineteen today. Six years, and it's within eighty-one
> megawatts of where it started."**

> **"Meanwhile total generation at night went up eight point seven gigawatts, and gas went up
> ten point seven. Everything they added after dark, they added by burning something."**

> **"And if you only look at annual averages, this finding does not exist."**

---

## SCREEN 2 · **Day vs night**
### Why the gap is there at all

Point at the three numbers.

> **"America's grid got dramatically cleaner during the day. Forty-six percent carbon-free
> between ten and four. At three in the morning it's thirty-nine percent and has barely moved
> since 2019."**

> **"And the third number is the control. We pulled satellite data on actual sunlight hitting
> the ground. The sun didn't change, it varies about one percent a year. So the daytime
> improvement is panels we built, not a sunnier decade. And panels make nothing at 3am."**

> **"Which is exactly when a datacenter pulls just as hard as at noon."**

---

## SCREEN 3 · Search box → **GOOGL**
### The company side. This is where you show the AI reading documents.

> **"So who's claiming otherwise? This is Google's own sentence, from its own report, page
> four. It says it matched one hundred percent of its electricity with renewable purchases,
> on an annual basis."**

**Now the part that shows the text work:**

> **"We didn't type that in. We ingested three hundred and fifty-four documents, sustainability
> reports and SEC filings, and had a model pull every clean-energy claim out with its page
> number and a verbatim quote. Then it scores each one: how big the number is, how precisely
> it's stated, and how heavily it's hedged."**

> **"Because the hedging is where the meaning is. 'One hundred percent renewable' and 'one
> hundred percent of annual consumption matched with market-based certificates' are the same
> number and completely different claims. Every qualifier cuts the score."**

**Then the measurement:**

> **"That's the talk. Here's the walk. Its ten datacenters averaged forty-six percent clean
> power, ranging from six to ninety-one."**

**If a judge points at the headline** (it reads "says 100% renewable", which is our
shorthand, not their words):

> **"That headline is our shorthand. Their exact sentence is on the line below it: matched,
> purchases, annual. The hedging is the point, and it's why their talk score isn't 100."**

> **"Both things are true at once. The claim is correct under the accounting standard. But one
> annual number is covering ten completely different physical realities."**

**If you have a spare five seconds, type MSFT then META:**

> **"Microsoft, forty-six percent. Meta, forty-six percent. The claims are all worded
> differently. The physics is the same."**

---

## SCREEN 4 · **Method**
### This is the technical complexity score. Don't rush it.

> **"Underneath all of this is a detector. It scores all one hundred and eleven US grid
> regions on one question: how much does your electricity demand look like a customer moved
> in that never turns off?"**

> **"Three signals. Did demand grow at night as fast as during the day. Did it grow faster
> than its neighbours on the same grid. Did the daily demand curve flatten out. Only an
> always-on customer does all three."**

> **"And it never reads a press release. It finds datacenters without a list of datacenters."**

Then slow down:

> **"We fixed that formula and named four test regions before we looked at any results, in the
> same commit as the code. Three of the four landed in the top twenty."**

> **"Then we spent last night trying to break it. We re-ran the frozen formula on 2026 data
> that didn't exist when we locked it. It held, eight of the top ten unchanged. We ran it
> ending in 2021, 22, 23, 24: nothing before 2025 shows a signal at all. It's dated to the
> buildout."**

> **"And we trained a machine learning model on raw demand shape that was never shown our
> formula. It found the same regions. We wrote the formula from a hypothesis; the model found
> it without one."**

**Then the strongest single thing you have:**

> **"And along the way we found an error in the federal data itself. Two grid operators were
> each reporting the same nuclear plant in full instead of their share. Together they
> reported one point nine one times what that plant can physically produce. We confirmed it
> three ways, including pulling the plant's ownership records and its smokestack emissions.
> The site shows the corrected number next to the published one."**

---

# PART THREE · THE PAYOFF
## Generating Alpha. 60 seconds. End here.

## SCREEN 5 · **Generating Alpha**

> **"So what is this actually for?"**

> **"A datacenter is a billion-dollar electricity customer that nobody announces. The
> operator doesn't say which utility serves it. The utility often can't say either. It
> surfaces in an earnings call months later."**

> **"But it cannot hide from the meter. The moment that load energises, it is in federal data
> within two hours."**

Point at the chain.

> **"So every region we flag resolves to the utility that delivers the power, that utility's
> parent company, and a ticker. Northern Virginia is rank six. Overnight demand up
> thirty-nine percent. Utility: Virginia Electric and Power. Parent: **Dominion Energy,
> ticker D.**"**

> **"That is a data point about Dominion that came out of a power meter, not out of
> Dominion."**

**THE CLOSE — land it, don't hedge it:**

> **"Three people use this. A journalist or a regulator gets every claim with a page
> citation, next to what the grid actually generated. Whoever is building the next
> datacenter gets a ranking of where clean power actually exists at three in the morning,
> which is the hour that decides whether they're served by existing clean capacity or by new
> gas. And an investor gets a billion-dollar event in public data, two hours after it
> happens."**

> **"Datacenters are about to become the largest industrial electricity consumer in this
> country. Right now there is no instrument pointed at them."**

> **"This is the first one. Every claim, every grid, every hour, in one place."**

**Stop there.** Do not add a disclaimer. Do not mention lying, backtests, or coverage gaps.
If they want the limits they will ask, and you have them.

---

# THE ML AND THE AI, IF YOU GET THE CHANCE

Two separate things, and keep them separate.

**The AI reads. It never computes a number.**

> **"AI does two jobs here. It read three hundred and fifty-four company documents and pulled
> every clean-energy claim out with a page number and a verbatim quote. And it powers the
> question box, which runs ten typed tools against the real data and answers with a table."**

> **"But every grid figure is plain arithmetic over federal data. No model touches a number,
> which is why the whole pipeline reproduces exactly on a clean machine."**

**The ML attacks our own result.**

> **"We built the ranking, then spent the night trying to destroy it. Four things."**

> **"One: could randomness produce it? We scored all five point nine million possible
> four-region combinations. Two: is a rank stable? We rebuilt the whole ranking ten thousand
> times on resampled hours. Three: does it hold on data we never saw? We re-ran the frozen
> method on 2026. Four: is it just weather? A hundred and thirty-eight weather stations, nine
> million readings."**

> **"And the one that matters most: we ran the same frozen method ending in 2021, 22, 23, 24.
> **Nothing before 2025 shows a signal.** A method that manufactures signal would manufacture
> it every year."**

> **"Then we trained a model on raw demand shape that was never shown our formula, and it
> found the same regions. We wrote the formula from a hypothesis. The model found it without
> one."**

---

# THE TRACKS

If a sponsor judge is in front of you, lead with theirs.

**Voloridge, Signal in the Noise**
> **"Your PUDL dataset, pulled with your own fetch script. Six EIA-930 tables, 4.45 million
> hours across seventy grids. We also used two more sources inside PUDL: EIA-860 plant
> records, which let us *prove* a nuclear plant was being double-counted, and EPA smokestack
> monitors, which let us replace our carbon-free proxy with measured CO2. Plus NOAA ISD, your
> dataset one, for the weather control."**

**Arrowstreet, Best Textual Analysis Hack**
> **"Three hundred and fifty-four documents, sustainability reports and SEC filings. Every
> claim extracted with a verbatim quote and a page number, then scored on three axes: how big
> the number is, how precisely it's stated, and how heavily it's hedged. 'One hundred percent
> renewable' and 'one hundred percent of annual consumption matched with market-based
> certificates' are the same number and different claims, and the score knows the
> difference."**

**Elastic, Find the Signal**
> **"All 354 documents indexed and searchable. Ask the question box what Google said about
> 24/7 carbon-free energy and it comes back with the passage, the ticker, the page number and
> the source URL, so every quote on screen can be opened in the original."**

**OpenAI, The Fifth Teammate**
> **"The question layer is a tool-calling loop over ten typed tools. Type anything in plain
> English and it queries the real data and answers with a table. And it structurally cannot
> invent a figure: before anything renders we check every number against what the tools
> actually returned and drop what doesn't match."**

**SpaceXAI, Make It Legendary**
> **"Grok narrates the day-versus-night screen, reading satellite irradiance against what the
> grid actually generated."**

**Long Lake, Convince a Non-Believer**
> **"The whole project is built for someone who doesn't believe us. The method was frozen
> before we saw results. One of our four test regions missed and we published it. We found an
> error in the federal data and we show the corrected number next to the published one. Every
> figure on the site says which file it came from."**

---

# THE COLLABORATION LINE
## 20 seconds, right at the end or in answer to a question.

> **"Two of us. Shri built the grid engine — nine years of hourly data into an index, the
> detector itself, and the whole front end. I built the investigation side — reading the
> documents, pulling the claims out with page numbers, mapping every datacenter to the
> utility that serves it, and the question layer."**

> **"We agreed the data format between the two halves before either of us wrote a line, which
> is the only reason they joined at the end."**

> **"And the biggest thing we learned is that the dangerous bugs look correct. Our first PDF
> reader spliced two columns together into quotes that read perfectly and didn't exist. We'd
> repeated one out loud before we caught it. Everything we show now carries a page number you
> can open."**

---

# IF THEY ASK

**"Isn't this just that summers got hotter?"**
> **"We pulled hourly temperature from a hundred and thirty-eight weather stations and
> measured how much extra power each region uses when it gets hot. That explains seven point
> eight percent of the growth. And Northern Virginia was actually **colder** in 2025 while
> its overnight demand went up four gigawatts."**

**"Did you tune it after seeing results?"**
> **"Git proves we didn't. The four test regions are in the same commit as the code that
> produced the first ranking, and the only change after that is twenty-two lines, none of
> which touch the score."**

**"How many companies?"**
> **"Fifty-two operators, one hundred and thirty-four sites, each traced through the utility
> that actually serves it."**

**"Can I try it?"**
Press **⌘K** and hand it over. Or type:
> "Which five regions have the most clean power at 3am, and which utility serves each?"

Anything harder: `docs/evidence/` — nine files, each with the quote and the citation.

---

# NUMBERS TO HAVE COLD

| | |
|---|---|
| Google's actual words | "matched 100% of our consumption with renewable **purchases**, on an **annual** basis". Never say "claims 100% renewable" |
| Google's spread | **6% to 91%** across ten sites |
| PJM clean at night | **35,700 → 35,619 MW**, six years |
| PJM growth at night | **+8.7 GW** total, **+10.7 GW** of it gas |
| Day vs night nationally | **46.5%** clean midday, **39.7%** at 3am |
| The chain | N. Virginia, rank 6, +39% → **Dominion Energy, D** |
| The federal data error | **1.91×** the plant's nameplate |
| Scale | 4.45M hours · 111 regions · 52 operators · 134 sites |

---

# TIMING

| | |
|---|---|
| **Part One** talking | 1:15 |
| **Part Two** four screens | 4:00 |
| **Part Three** payoff | 1:00 |
| **Collaboration** | 0:20 |
| **Total** | **6:35**, leaving time for questions |

**Running long?** Cut Screen 3. Never cut Screen 4 or Part Three.

**If something breaks:** everything except ⌘K works with no network. If you lose your place,
go Home and click a company — Screen 1 on its own is a complete pitch.
