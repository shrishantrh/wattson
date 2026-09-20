# Wattson — the spoken script

**Three minutes. This is the thing you read and say out loud.** Left column is what you
SAY, word for word. Right column is what you DO. Clock runs down the margin.

- `(breath)` means stop, breathe, then keep going. They are placed on purpose.
- `[ ]` in the SAY column is a stage direction, not spoken.
- **If a number on the screen disagrees with this script, the screen is right.** Read the
  screen out loud and keep moving. Do not correct yourself twice.
- Two lines are marked **CUT IF LONG**. Drop them without apology if you hit 2:30 before
  the results.

Word count: **374 spoken words.** At 130 words a minute that is **2:53 of speech**, plus
about 7 seconds of marked pauses and clicks. Real duration **≈ 3:00**. There is no slack.
Dropping both **CUT IF LONG** lines brings it to **337 words, 2:36 of speech** — the safe
version if the room is noisy or the app is slow.

---

## Part 1 — Slides. 0:00 to 0:48.

| Clock | YOU SAY | YOU DO |
|---|---|---|
| **0:00** | "Fast fashion has watchdogs. Airlines have watchdogs. Datacenters have none. (breath) And they're the fastest growing power load in America." | Deck full screen on **"No watchdog"**, the first slide of **01-problem**. Hands off the laptop. Look at the judges, not the screen. |
| **0:12** | "And here's what nobody checked. Since 2019 America added sixty-four point seven gigawatts of clean power to the average daytime hour. (breath) And seventeen point seven to the average overnight hour." | Press **→** to **"Annual vs hourly"** on the first sentence, **→** again to **"Added since 2019"** on the second. The two numbers are on that slide. Let them sit for one beat. |
| **0:24** | "Nearly four times. Megawatts added, not shares. Solar fixed the day. Datacenters run all night." | Still. Do not click. |
| **0:31** | "So we built the watchdog. Wattson checks clean power claims against the meter." | Press **→** to **02-solution**. |
| **0:37** | "Four steps. A company makes a claim. We find the buildings it operates. We find the grid serving each one. We read what that grid generated, hour by hour. Then we compare. (breath) Every screen from here is one of those." | Press **→** to **03-howitworks**. One step per clause — if the slide has four items, point at each as you say it. |
| **0:48** | *[nothing — move]* | Press **→** past **04-demo**, then **⌘-Tab** to the browser. The app is already open on the landing page, already loaded, from before you walked up. |

> On the numbers: 64.7 and 17.7 gigawatts are **clean megawatts added to the average
> hour** since 2019, both positive, both changes — not levels and not shares. Corrected
> baseline: the 2019 figures have the Arizona double count removed, which the deck itself
> diagnoses two slides from the end. Ratio 3.66, hence "nearly four times".
> `numbers-v2.md` addendum. The same pair is on the slide. There is nothing to decide on
> stage.

---

## Part 2 — Live product. 0:48 to 2:26.

### The company check

| Clock | YOU SAY | YOU DO |
|---|---|---|
| **0:48** | "We built the ask layer on OpenAI's models. So let's point it at OpenAI." | Press **⌘K**. Type `openai`. **Enter**. |
| **0:56** | "Six sites. Each mapped to the grid that serves it. Thirty-seven percent carbon-free across them." | The company page is up. Let the six site rows land. Do not scroll yet. |
| **1:05** | "We never say they lied. On paper the claim is true. (breath) We measure the gap to the meter." | Hands off the trackpad for this one. It is the most important sentence in the demo. |

### One site, one grid

| Clock | YOU SAY | YOU DO |
|---|---|---|
| **1:14** | "This is the grid under their New Mexico site. Thirty-four percent clean at midday. (breath) At three in the morning, one megawatt out of six hundred and fifty-five." | Click the **Santa Teresa** row. You land on the El Paso Electric region page. Point at the day figure, then the night figure. |
| **1:27** | "And this one we may not even see. A reporter says that campus runs its own gas plant, off grid. So it never reaches our data. (breath) We say so ourselves." | Scroll to the site note with the El Paso Matters source line. Leave it visible while you say it. |

> Say "a reporter says", never "we found". We read that microgrid in the press and wrote
> it down; we did not measure it.

### The detector

| Clock | YOU SAY | YOU DO |
|---|---|---|
| **1:41** | "We also find these sites without a list of sites. A hundred and eleven regions scored on round-the-clock load." | **⌘K**, type `found`, **Enter**. The ranking fills. |
| **1:50** | **CUT IF LONG** — "Method frozen before we looked. Four test regions named in advance. Two landed. Two didn't. Both misses are on screen." | Point at one of the two misses. Do not read the whole table. |

### Ask it anything

| Clock | YOU SAY | YOU DO |
|---|---|---|
| **2:00** | "And you can just ask it." | **⌘K**. Start typing `which five regions have the most clean power at 3am` — let the grey completion appear, hit **Tab**, then **Enter**. |
| **2:05** | *[silence while it runs — count three]* | Watch it with them. Do not narrate the spinner. |
| **2:13** | "Real tool calls against the real data. A table with links. (breath) It can't invent a number." | Point at one link. Do not click it. |

---

## Part 3 — Why it holds, and the close. 2:26 to 3:00.

| Clock | YOU SAY | YOU DO |
|---|---|---|
| **2:26** | "What we're proudest of is what it won't say. Fifty-two operators, a hundred and thirty-four sites. Documents read for four of them." | **⌘-Tab** back to the deck. It resumes on **05-results**. Press **→** once between each sentence — three slides, they read themselves. |
| **2:35** | "And one region looked like its clean power collapsed. It was a nuclear plant counted twice in the federal data. We caught it. We ship both numbers." | **→** into **06-rigor**, then **→** again to **"We print what we got wrong"**. |
| **2:43** | **CUT IF LONG** — "It isn't that everyone's dirty. Grant County, Washington ran a hundred percent clean at three a.m. Hydro." | Stay on **06-rigor**. |
| **2:49** | "Wattson is the join. A claim, the grid the building draws from, and the hour that decides it." | **→** past **07-stack** to **08-close**. Do not talk over the stack slide; let it pass. |
| **2:56** | (breath) "It follows the power, not the press release." | Stop. Hands off the laptop. Do not add a sentence. |

---

## The 20-second hallway version

> "Every company building AI says it runs on clean power. Nobody ever checked it against
> the meter. (breath) So: they publish a claim, we find the buildings they operate, we find
> the grid serving each one, and we read what that grid actually generated, hour by hour.
> (breath) Since 2019 America added nearly four times as much clean power to the average
> daytime hour as to the average overnight hour. And a datacenter runs all night."

## The one-sentence version

> "Wattson checks datacenter clean-power claims against the hour-by-hour output of the grid
> that actually serves each building."

---

## The seven questions, with answers under 25 seconds

**1. How do you know which grid a building is on?**
> "Hand-curated, site by site, from filings and press. A hundred and seven of our hundred
> and thirty-four sites have a serving utility we could establish. The other twenty-seven
> are counted as unresolved, on the screen. We don't guess a grid."

**2. Isn't this just the average grid mix? They buy renewables directly.**
> "Yes, and that's the point. Their claim is a contract. Ours is the physical grid inside
> that footprint. Both are true. We measure the gap between them, and we say out loud that
> we exclude power purchase agreements."

**3. Why has nobody found this before?**
> "Because at annual resolution it doesn't exist. Annually, the grid is getting cleaner. You
> only see it when you separate the hours, and the hour that matters is three in the
> morning."

**4. Are you saying these companies lied?**
> "No. Never. The verdict is 'true on paper, this much physically.' An annual matched claim
> is genuinely true under the accounting standard. We're measuring a contract against a
> meter."

**5. What can't you see?**
> "Load behind the meter. Around a dozen of our site notes describe an on-site plant, and
> federal data never sees those, so we understate fossil use there. We also measure
> generation inside a footprint, not consumption, and we don't allocate imports."

**6. I've seen 61 and 14 gigawatts quoted. Why do your numbers differ?**
> "Because we took our own correction out of our own headline. The published 2019 baseline
> double counts an Arizona nuclear plant. We caught that, we publish it, so we can't quote a
> number we've already shown to be wrong. Correcting it made our ratio smaller, not bigger."

**7. Who actually uses this?**
> "Every verdict ends at a named utility in a named region. That's a journalist's lead, a
> regulator's docket, and an asset manager's screen. Load growth hits a regulated utility
> long before it hits its filings."

*(Bonus, if asked about data:)* "EIA-930 through PUDL. Four and a half million hourly rows,
seventy grid operators, 2018 to this month."

---

## If something breaks

**The app doesn't load.** The whole site is a static export, so this is almost always the
tab, not the build. Do not debug on stage. Say: *"I'll show you this from the deck"* — go
back to the slides, and speak the demo words against the screenshots on **04-demo** and
**05-results**. You lose nothing but the clicking. Total cost: five seconds.

**The ask layer is down.** ⌘K still works — it falls back to the deterministic command
palette, and every other screen is unaffected. Say: *"the model layer's offline, so this is
the plain search — same data underneath,"* then navigate with it and skip the 2:00 beat.
Spend the recovered fifteen seconds on the El Paso site instead. Do not apologise twice.

**A number on screen disagrees with this script.** The screen is right. Read what is on the
screen, in the same sentence shape, and move on. Do not say "that should say" or "the data
changed". If a judge asks, the honest answer is one line: *"the export is the authority;
the script was written against an earlier build."*

**You are at 2:30 and still in the demo.** Skip the detector, skip Grant County, go
straight to 2:26. Never skip the close.
