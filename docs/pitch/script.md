# Wattson — the spoken script

**Three minutes. This is the thing you read and say out loud.** Left column is what you
SAY, word for word. Right column is what you DO. Clock runs down the margin.

- `(breath)` means stop, breathe, then keep going. They are placed on purpose.
- `[ ]` in the SAY column is a stage direction, not spoken.
- **If a number on the screen disagrees with this script, the screen is right.** Read the
  screen out loud and keep moving. Do not correct yourself twice.
- Nothing in the running script is optional. Two extra lines are parked under Part 3 as
  **ADD IF AHEAD**; take one only if you are early.

**Counted, not estimated.** **378 spoken words.** At 130 words a minute that is **2:54 of
speech**, and speech is the thing that has to fit. The per-beat table is at the foot of this
file; `python3 docs/pitch/count-script.py` recounts it after any edit, and the clock column
is derived from those counts rather than guessed.

The clock column is deliberately pessimistic: it adds a beat between lines and the
three-second wait for the model at 1:53, so on paper it runs to 3:08. In the room the slide
advances happen while you are still talking. Rehearse against 2:54 and treat anything past
it as the warning. **If you need ten seconds back, cut the 1:42 beat** — the ranking stays
on the screen either way — and the two ADD IF AHEAD lines stay outside the count.

**The language rule for this talk.** Nobody in the room builds power grids. Every sentence
below uses words a stranger already owns: *grid region*, not balancing authority. *How much
of the power was clean*, not carbon-free share. *Draws the same power at three in the
morning as at noon*, not flat 24/7 load. *We named four regions before we ran it*, not
pre-registered. *Sixty-five reactors' worth*, not 64.7 GW. Where a technical name is worth
saying — PJM, EIA-930, PUDL, Elasticsearch — say it straight after the plain sentence it
belongs to, never instead of it.

---

## Part 1 — The problem, and what we built. 0:00 to 1:07.

| Clock | YOU SAY | YOU DO |
|---|---|---|
| **0:00** | "Fast fashion has watchdogs. Airlines have watchdogs. Datacenters have none — and every forecast says they're growing fastest." | Deck full screen on **"No watchdog"**, the first slide of **01-problem**. Hands off the laptop. Look at the judges, not the screen. |
| **0:08** | "Nobody has checked, because of how the promise is written: a year of clean power bought against a year of use. It balances." | Press **→** to **"Annual vs hourly"**. Point at the single annual block, then at the hours beside it. |
| **0:19** | "Nobody looks inside the hours. Since 2019 America added sixty-five reactors' worth of clean power to its midday hours — eighteen reactors' worth to its three-a.m. hours." | Press **→** to **"Added since 2019"**. Let the two bars sit for one beat. |
| **0:31** | "Solar fixed the daytime. (breath) A datacenter draws the same power at three in the morning as at noon — hours that never improved." | Still. Do not click. |
| **0:42** | "So we built the watchdog. It takes the claim, finds the buildings, finds the grid under each, and reads what that grid generated, hour by hour." | Press **→** to **02-solution** on "so we built". One clause per element of the picture: the report, the buildings, the hours, the measured bar. |
| **0:54** | "Under it all, one number for every hour of every grid region: how much of the power was clean." | Press **→** to **03-howitworks**. Point at the middle box on "one number", the left box on "four and a half million", the fan on the last word. |
| **1:03** | *[nothing — move]* | Press **→** past **04-demo**, then **⌘-Tab** to the browser. The app is already open on the landing page, already loaded, from before you walked up. |

> **The reactor is the unit, not the gigawatt.** A large nuclear reactor is about one
> gigawatt, so 64.7 and 17.7 GW become sixty-five and eighteen reactors' worth
> (`UNDERSTAND.md` §3 step 2). Both are clean megawatts **added** to the average hour since
> 2019 — both positive, both changes, neither a level nor a percentage. Clean power at night
> went **up**; it went up roughly four times slower than clean power at midday. The 2019
> starting point has the Arizona double count taken out of it, which is the correction you
> describe at 2:49. `numbers-v2.md` addendum, ratio 3.7.
>
> **Never say the overnight share fell.** It did not: 39.7% in 2019, 39.7% in 2025. Output
> rose 17.7 GW and demand rose faster. "The share fell" is the easiest way to say something
> false out of true numbers.

---

## Part 2 — Live product. 1:07 to 2:10.

### The company check

| Clock | YOU SAY | YOU DO |
|---|---|---|
| **1:07** | "We built the question box on OpenAI's models. So let's point it at OpenAI." | Press **⌘K**. Type `openai`. **Enter**. |
| **1:14** | "Six buildings, each matched to the grid serving it. Thirty-seven percent of that power was clean. (breath) We never say anyone lied — on paper it's true. We print it: true on paper, this much physically." | The company page is up. Let the six site rows land. Hands off the trackpad for the second half; it is the most important sentence in the demo. |

### One building, one grid

| Clock | YOU SAY | YOU DO |
|---|---|---|
| **1:30** | "Here's the grid under their New Mexico site. Midday, a third of the power is clean. (breath) Three in the morning: one megawatt of six hundred fifty-five." | Click the **Santa Teresa** row. You land on the El Paso Electric region page. Point at the day figure, then the night figure. |

> Say "a reporter says", never "we found": we read that gas plant in the press, we did not
> measure it. About a dozen of our buildings are like that, and a tool that only reads
> demand cannot see a datacenter that brought its own power plant.

### Finding the buildings without being told where they are

| Clock | YOU SAY | YOU DO |
|---|---|---|
| **1:42** | "We also find these places with no list of them — a hundred and eleven regions ranked on demand that stopped following the day." | **⌘K**, type `found`, **Enter**. The ranking fills. |
| **1:53** | "And you can just ask it, in English." | **⌘K**. Start typing `which five regions have the most clean power at 3am` — let the grey completion appear, hit **Tab**, then **Enter**. |
| **1:57** | *[silence while it runs — count three]* | Watch it with them. Do not narrate the spinner. |
| **2:01** | "Real tool calls against real data. Every row says where it came from. It can't invent a number." | Point at one link. Do not click it. |

---

## Part 3 — What we found, why it holds, the close. 2:10 to 3:03.

| Clock | YOU SAY | YOU DO |
|---|---|---|
| **2:10** | "Here's what it finds. PJM — Chicago to New Jersey — generates eight point seven gigawatts more at night than in 2019. (breath) Not one net megawatt of it is clean." | **⌘-Tab** back to the deck. It resumes on **05-results**, the PJM slide. Let the three bars land before the second sentence. |
| **2:23** | "A separate instrument agrees: EPA's smokestack monitors measured PJM's night-time carbon dioxide up four million tons." | **→** twice through the other two **05-results** slides; they read themselves. |
| **2:31** | "We called it in advance: four regions named before we ran the ranking. Three landed in the top twenty. Dallas came ninety-first, and we published it." | **→** into **06-rigor**, the slide with the rank line on it. Point at Dallas. |
| **2:43** | "One region looked like its clean power collapsed. It hadn't — a plant counted twice in the federal data. (breath) We use the corrected number, and it shrinks our headline." | **→** to **"We print what we got wrong"**. |
| **2:56** | "Every answer ends at a named utility, in a named place, at a named hour." | **→** past **07-stack** to **08-close**. Do not talk over the stack slide; let it pass. |
| **3:03** | (breath) "Wattson. It follows the power, not the press release." | Stop. Hands off the laptop. Do not add a sentence. |

**Two ADD IF AHEAD lines.** Neither is in the count above. Take one only if you reach 2:00
still ahead of the clock, and never both.

1. After the New Mexico beat, scrolling to the El Paso Matters note: *"And this campus we
   may not see at all. A reporter says it runs its own gas plant, off the grid. We print
   that."* (24 words, 11 seconds.) Say **a reporter says**, never *we found*.
2. After the smokestack beat: *"And it isn't that everyone is dirty. Grant County,
   Washington ran fully clean at three in the morning. Hydro."* (17 words, 8 seconds.)

---
## The 20-second hallway version

> "Every company building AI says it runs on clean power. Nobody has ever checked that
> against the grid those buildings are actually plugged into. (breath) So: they publish a
> claim, we find the buildings they run, we find the grid serving each one, and we read what
> that grid actually generated, hour by hour. (breath) Since 2019 America added four times
> more clean power to the middle of the day than to the middle of the night. And a
> datacenter runs all night."

## The one-sentence version

> "Wattson checks a datacenter's clean-power claim against what the grid serving each
> building actually generated, hour by hour."

---

## The nine questions, with answers under 25 seconds

**1. How do you know which grid a building is on?**
> "By hand, building by building, and it is not a map lookup. IREN's datacenter in
> Childress, Texas sits in the Panhandle, where the counties around it are on one grid — and
> it wires straight into the Texas grid instead. Get that row wrong and the verdict flips.
> A hundred and seven of our hundred and thirty-four have a utility we could establish; the
> other twenty-seven print as unresolved."

**2. Isn't this just the average mix of the grid? They buy clean power directly.**
> "Yes, and that is the point. Their number is a contract. Ours is the power that physically
> flowed in that region. Both are real. We measure the distance between them, and we say out
> loud that we leave purchase contracts out."

**3. Why has nobody found this before?**
> "Because if you only look at the year, it isn't there — year over year the grid is getting
> cleaner. You only see it when you separate the hours, and the hour that matters is three in
> the morning. We didn't find new data. We refused to average over the hours that matter."

**4. Are you saying these companies lied?**
> "No. Never. The verdict we print is 'true on paper, this much physically.' Matching a
> year's power with a year's certificates is genuinely true under the accounting standard.
> We are measuring a contract against a meter."

**5. What are those two scores?**
> "Talk is how bold the claim is — how big the number, how precisely stated, how little
> hedged. Walk is the plain average of how clean every grid their mapped buildings sit on
> actually was. No contracts, no certificates, and no weighting by building size, which we
> say out loud because one very large site could move it."

**6. How do I know you didn't tune this until it agreed with you?**
> "Three ways. The weights and the four test regions were fixed before any ranking existed,
> and we published the one we got wrong. We re-ran the whole ranking on 2026 data the method
> had never seen, and the two rankings agree at nought point eight-eight, where one is
> identical — eight of the top ten are the same regions. And EPA's smokestack monitors, a
> completely separate instrument, move with our measure at minus nought point eight-seven
> across forty-nine regions."

**7. Isn't this just air conditioning, or a hot year?**
> "We checked. Across all hundred and eleven regions, each region's own temperature response
> explains seven point eight percent of the overnight demand growth — and the temperature
> model fits well, so that is a real answer and not a weak control. Take each region's
> weather response out and nights still grew faster than days in ninety-six of a hundred and
> eleven. Cooling peaks in the afternoon; if this were air conditioning, the days would have
> grown more."

**8. What can't you see?**
> "Power made on site, behind the meter — about a dozen of our buildings have that, and the
> federal data is blind to it, so we understate fossil fuel there. We measure what a region
> generated, not what a building consumed. We use the average mix, not the specific plant
> that fires up, which understates us again. And below the top ten our ranking is not an
> ordering — treat the top ten as a set, not a league table."

**9. I've seen 61 and 14 gigawatts quoted. Why do your numbers differ?**
> "Because we took our own correction out of our own headline. The published 2019 baseline
> counts an Arizona nuclear plant twice — two owners each reported the whole plant instead of
> their share. We caught it, so we can't go on quoting a number we've shown to be wrong.
> Correcting it made our ratio smaller, not bigger."

*(Bonus, if asked about data:)* "EIA-930, the federal hourly grid data, pulled through PUDL.
Four and a half million hours, seventy grid regions, 2018 to this month. And
`docs/headline_from_raw.py` rebuilds the PJM headline from the raw table in fifteen lines
and lands within nought point four percent, so you can reproduce us in a minute."

---

## If something breaks

**The app doesn't load.** The whole site is a folder of files with no server behind it, so
this is almost always the tab, not the build. Do not debug on stage. Say: *"I'll show you
this from the deck"* — go back to the slides, and speak the demo words against the
screenshots on **04-demo** and **05-results**. You lose nothing but the clicking. Total
cost: five seconds.

**The question box is down.** ⌘K still works — it falls back to a fixed list of prepared
searches, and every other screen is unaffected. Say: *"the model layer's offline, so this is
the plain search — same data underneath,"* then navigate with it and skip the 1:53 beat.
Spend the recovered fifteen seconds on the El Paso site instead. Do not apologise twice.

**A number on screen disagrees with this script.** The screen is right. Read what is on the
screen, in the same sentence shape, and move on. Do not say "that should say" or "the data
changed". If a judge asks, the honest answer is one line: *"the published files are the
authority; the script was written against an earlier build."*

**You are at 2:20 and still in the demo.** Drop the gas-plant line and go straight to PJM.
Never skip the close.

---

## The word count, counted

Every spoken cell above, counted as words (stage directions, `(breath)` and the CUT/ADD
markers excluded). Recount with `python3 docs/pitch/count-script.py` after any edit.

| Beat | Words |
|---|---|
| 0:00 Fast fashion has watchdogs | 17 |
| 0:08 Nobody has checked because | 23 |
| 0:19 Nobody looks inside the | 26 |
| 0:31 Solar fixed the daytime | 22 |
| 0:42 So we built the | 26 |
| 0:54 Under it all one | 19 |
| 1:07 We built the question | 14 |
| 1:14 Six buildings each matched | 34 |
| 1:30 Here's the grid under | 26 |
| 1:42 We also find these | 23 |
| 1:53 And you can just | 8 |
| 2:01 Real tool calls against | 18 |
| 2:10 Here's what it finds | 28 |
| 2:23 A separate instrument agrees | 16 |
| 2:31 We called it in | 26 |
| 2:43 One region looked like | 28 |
| 2:56 Every answer ends at | 15 |
| 3:03 breath Wattson It follows | 9 |
| **Total** | **378** |
