# DEMO

**Six screens, in order. Never leave the order.** Everything below was read off the live
site, so what you say matches what is on the screen.

**Live:** https://shrishantrh.github.io/wattson/

The tabs across the top, left to right: **Data · What we found · Generating Alpha ·
Day vs night · Method**. You will use them in a different order. Follow this doc.

---

# SCREEN 1 · Home
### The question, and one concrete company

**On screen:** "What's really powering it?" · A GREENWASHING INVESTIGATION OF DATACENTER
OPERATORS · a search box · four company buttons · one line of numbers.

**Say:**

> "Every AI company says it runs on clean energy. Nobody has ever checked what actually came
> out of the wires. That's the whole project."

**Now click "Alphabet (Google)".** Do this immediately. Do not explain first.

**On screen:** Google's claim, quoted, with a page number. Ten datacenters. A verdict.

> "This is Google's own sentence from its own report, page four. It says it **matched** one
> hundred percent of its electricity with renewable **purchases**, on an **annual** basis."

> "Now here are its ten datacenters, and the grid each one actually plugs into. They run
> from **six percent** carbon-free to **ninety-one percent**."

> "Both things are true. The claim is correct under the accounting rules. But one annual
> number is covering ten completely different physical realities, and until now nobody could
> see that."

**That is the pitch. Everything after this explains why it happens and why you should
believe us.**

---

# SCREEN 2 · Day vs night
### Why the gap exists at all

**Click: Day vs night.**

**On screen, the headline:** *"Why the day got clean and the night didn't. The sun never
changed. We built panels. Panels don't work at night."*

Three big numbers: **46.5%** clean from 10am–4pm · **39.7%** clean midnight–6am · **flat**
for the sun.

**Say:**

> "Here's the mechanism. America's grid got much cleaner during the day, forty-six percent
> carbon-free between ten and four. At three in the morning it's thirty-nine percent and
> barely moved since 2019."

> "And the third number is the control. We pulled satellite data on actual sunlight. **The
> sun didn't change** — it varies about one to two percent a year. So the daytime
> improvement is panels we built, not a sunnier decade. And panels make nothing at 3am."

> "A datacenter pulls exactly as hard at 3am as at noon. So half its life is spent in the
> half of the day that never improved."

---

# SCREEN 3 · What we found
### The scale of it, in four steps

**Click: What we found.** Press the arrow keys or **1–4**.

**Step 1 on screen:** **35,700 → 35,619** MW of clean power at night, 2019 then 2025.

**Say:**

> "This is PJM, the grid that serves the biggest datacenter cluster on earth. Northern
> Virginia sits inside it."

> "Six years. The carbon-free megawatts it generates between midnight and 6am are within
> **eighty-one megawatts** of where they started. And that's output, not a percentage —
> nothing about that number depends on how the rest of the grid moved."

**Arrow through steps 2, 3, 4.**

> "Total generation at night went up **8.7 gigawatts** over the same period. Gas went up
> **10.7**. Everything they added after dark, they added by burning something."

---

# SCREEN 4 · Method
### Why you should believe the ranking

**Click: Method.**

**Say:**

> "Underneath all of this is a detector. It scores all one hundred and eleven US grid
> regions on one question: how much does your electricity demand look like a customer moved
> in that never turns off?"

> "Three signals. Did demand grow at night as fast as during the day. Did it grow faster
> than its neighbours on the same grid. Did the daily demand curve flatten out. Only an
> always-on customer does all three."

> "And it never reads a press release. It's demand data only."

**Then the part that makes it real:**

> "We fixed the formula and named four test regions **before** we looked at any results, in
> the same commit as the code. Three landed in the top twenty."

> "Then we re-ran that frozen formula on 2026 data that didn't exist when we locked it. **It
> held — eight of the top ten regions unchanged.** And we ran it ending in 2021, 22, 23, 24:
> nothing before 2025 shows a signal at all. **It's dated to the datacenter buildout.**"

---

# SCREEN 5 · Generating Alpha
### Why this is worth money

**Click: Generating Alpha.**

**Say:**

> "A datacenter is a billion-dollar electricity customer that nobody announces. But it
> cannot hide from the meter. The moment it switches on, it's in federal data within two
> hours."

> "So every region we flag resolves to the utility that delivers the power, that utility's
> parent, and a ticker."

> "Northern Virginia is rank six. Overnight demand up thirty-nine percent. The utility is
> Virginia Electric and Power. Parent: **Dominion Energy, ticker D.** That's a data point
> about Dominion that came out of a power meter, not out of Dominion."

---

# SCREEN 6 · Data
### The receipts

**Click: Data → the Facilities tab.**

**On screen:** 134 rows. Company · Site · Serving utility · Parent · Ticker · Grid · Clean ·
Rank.

**Say:**

> "And nothing here is something you have to take our word for. Every datacenter we mapped,
> the utility that actually serves it, the ticker, the grid, and how clean that grid is."

> "One hundred and thirty-four sites, every one traced through the utility that serves it
> rather than guessed from a map. That mapping is the hard part and it's the reason nobody
> had done this."

**Point at the Regions tab too:**

> "And all one hundred and eleven grids with their night and day numbers, sortable,
> downloadable as a CSV."

---

# ⌘K · Anywhere, any time

If you have a spare thirty seconds, or someone looks sceptical, press **⌘K** and type:

> **"Which five regions have the most clean power at 3am, and which utility serves each?"**

> "That's running against the real data, seven tool calls, back as a table. And it can't
> show you a number the tools didn't return."

Backup: `compare NBIS and CRWV`

---

# HITTING THE JUDGING CRITERIA

**Innovation 30% · Technical Complexity 30% · Impact 30% · Learning 10%.**
5 to 7 minutes. Here is where each one gets scored, and the sentence that earns it.

## Innovation (30%) — earn it on SCREEN 1 and SCREEN 4

The novel thing is not the data. It is the join, and the detector.

> "Corporate clean-energy claims live in PDFs. What the grid actually burned lives in nine
> years of hourly federal data. **Nobody had ever joined them**, because the two halves are
> in different formats and the hard part is knowing which grid each building plugs into."

And the sharper one, on Method:

> "The detector finds datacenters **without a list of datacenters.** It reads electricity
> demand only. If a region's nights start growing as fast as its days, and faster than its
> neighbours, and the daily curve flattens, something moved in that never turns off. No
> press release, no announcement, no company filing."

**Say the words "nobody had done this" and "without a list of datacenters."** Those are the
two innovation claims.

## Technical Complexity (30%) — earn it on SCREEN 4, fast

Do not list technologies. List what you had to overcome.

> "Four point four five million hourly rows, every grid region in America, nine years."

> "Six federal datasets: hourly generation, hourly demand, plant ownership records, EPA
> smokestack monitors, a hundred and thirty-eight weather stations, and three hundred and
> fifty-four company documents."

> "And then we spent last night trying to break our own result. We re-ran the frozen
> detector on 2026 data that didn't exist when we locked it — it held, eight of the top ten
> unchanged. We ran it ending in every earlier year — nothing before 2025 shows a signal.
> And we trained a model on raw demand shape that was never shown our formula, and it found
> the same regions."

**The single most technically impressive sentence you have:**

> "We found an error in the federal data. Two grid operators were each reporting the same
> nuclear plant in full instead of their share, totalling **1.91 times what that plant can
> physically produce.** We proved it three ways, including pulling the plant's ownership
> records and its smokestack emissions."

## Impact (30%) — earn it on SCREEN 5, and do not skip this screen

Impact is the one most teams fumble. Be concrete about who uses it and for what.

> "Datacenters are the fastest-growing consumer of electricity in the United States, and
> there is no watchdog for them. There is one for fast fashion, for airlines, for oil
> majors. Not for this."

Then three users, ten seconds each:

> "**For a journalist or a regulator:** every claim with a page citation, next to what the
> grid actually generated."

> "**For whoever is building the next one:** we rank every region by how much clean power is
> actually there at 3am, which is the hour that decides whether you get served by existing
> clean capacity or by new gas."

> "**For an investor:** a billion-dollar electricity customer switches on and it is in
> federal data two hours later, resolved to the utility and the ticker, before anyone
> announces it."

## Learning & Collaboration (10%) — one clean paragraph at the end

> "Two of us. Shri built the grid engine — nine years of hourly data into an index, the
> detector, the front end. I built the investigation side — reading the documents,
> extracting claims, mapping every datacenter to the utility that serves it, and the
> question layer."

> "We agreed the data format between the two halves before either of us wrote anything,
> which is the only reason they joined at the end."

> "And the biggest thing we learned: **the dangerous bugs look correct.** Our first PDF
> reader spliced two columns together into quotes that read perfectly and did not exist. We
> had repeated one out loud before we caught it. Everything we show now carries a page
> number you can open."

---

# THE 6-MINUTE RUN

| Time | Screen | Criterion it scores |
|---|---|---|
| 0:00–1:15 | **1 · Home**, click Google | Innovation, Impact |
| 1:15–2:00 | **2 · Day vs night** | Innovation |
| 2:00–2:45 | **3 · What we found** | Impact |
| 2:45–4:00 | **4 · Method** + the three flexes | **Technical Complexity** |
| 4:00–4:45 | **5 · Generating Alpha** | **Impact** |
| 4:45–5:15 | **6 · Data** or **⌘K** | Technical Complexity |
| 5:15–5:45 | Learning & Collaboration paragraph | Learning |
| 5:45+ | Questions | |

**If you are running long, cut Screen 6.** Never cut Screen 4 or 5 — they carry 60% of the
score between them.

---

# THE THREE FLEXES

Drop these in wherever they fit. They are strengths, say them like strengths.

**We found an error in the federal data.**
> "Two grid operators were each reporting the same nuclear plant in full instead of their
> share. Together they reported **1.91 times what that plant can physically produce.** We
> confirmed it three ways, and the site shows the corrected number next to the published
> one."

**We published the one we got wrong.**
> "One of our four pre-named test regions, Dallas, came ninety-first. We left it in. A
> ranking you can check against names written down in advance beats one that reports four
> out of four."

**A model found the same thing without our formula.**
> "We trained a model on raw demand shape that was never shown our formula. It found the
> same regions. We wrote the formula from a hypothesis; the model found it without one."

---

# ONLY IF ASKED

**"Isn't it just hotter summers?"**
> "We pulled hourly temperature from a hundred and thirty-eight weather stations and
> measured how much extra power each region uses when it gets hot. That explains **seven
> point eight percent**. And Northern Virginia was actually **colder** in 2025 while its
> overnight demand went up four gigawatts."

**"Did you tune it after seeing results?"**
> "Git proves not. The four test regions are in the same commit as the code that made the
> first ranking, and the only change after that is twenty-two lines, none of which touch the
> score."

**"How many companies?"**
> "Fifty-two operators, a hundred and thirty-four sites."

**"Is it tradeable?"**
> "It's an input to a trade. The event is in federal data two hours after it energises,
> resolved to a ticker, before anyone announces it."

Anything else: `docs/evidence/`, nine files, each with the quote and the citation.

---

# HAVE THESE COLD

| | |
|---|---|
| Google's actual words | "**matched** 100% of our consumption with renewable **purchases**, on an **annual** basis" — never say "claims 100% renewable" |
| Google's range | **6% to 91%** across ten sites |
| PJM at night | **35,700 → 35,619 MW.** Flat for six years |
| PJM's growth | **+8.7 GW** total at night, **+10.7 GW** of it gas |
| The chain | Northern Virginia, rank 6, +39% → **Dominion Energy, D** |
| The error | **1.91×** the nameplate |

---

# IF SOMETHING GOES WRONG

- **Lost?** Go Home and click a company. Screen 1 alone is a complete pitch.
- **⌘K slow?** First question wakes the server. Keep talking or skip it.
- **No network?** Everything except ⌘K works offline.

| Time | Screens |
|---|---|
| 90 seconds | 1 only |
| 3 minutes | 1, 2, 4 |
| 5 minutes | 1, 2, 3, 4, 5 |
| Full | all six plus ⌘K |
