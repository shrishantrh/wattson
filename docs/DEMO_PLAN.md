# The demo plan

Six minutes of content, cut to whatever you are given. Slides are a frame; **the app is the
demo.** If you get three minutes, run beats 1, 3 and 6.

---

## The running order

| # | Beat | Time | Screen |
|---|---|---|---|
| 1 | The gap nobody filled | 0:20 | Slide / landing |
| 2 | Two columns in federal data | 0:40 | `#/data` |
| 3 | A company, checked | 0:50 | `#/check/GOOGL` |
| 4 | Point it at OpenAI | 0:40 | `#/check/OPENAI` |
| 5 | Ask it anything | 0:40 | ⌘K |
| 6 | Why it holds | 0:50 | `#/method` |
| 7 | Who is exposed | 0:30 | `#/alpha` |
| 8 | Close | 0:20 | anywhere |

---

## Beat 1 — the gap (0:20)

> "There is a greenwashing watchdog for fast fashion. For airlines. For oil majors. There
> isn't one for datacenters, the fastest growing user of electricity in America. So we
> built it."

Pause. Then:

> "These companies are careful. They don't say they run on clean power. They say they
> *matched* their *annual* consumption with renewable *purchases*. That's an accounting
> statement and it's accurate. Nobody has checked the physical one."

---

## Beat 2 — two columns (0:40) · `#/data`

Open the Regions sheet. Find **NEVP**.

> "This is Las Vegas. Fifty-six percent of its power is carbon-free at midday. **One point
> eight percent at three in the morning.** Same grid, same year, ten hours apart."

> "A datacenter buys both, in equal amounts, because it never stops. Nobody is hiding this.
> It's two columns in federal data. It has just never been put next to a company's claim."

Then scroll to **GCPD**:

> "And this is the same table. A hundred percent, day and night. Columbia River hydro. So
> this isn't 'everyone is dirty.' Where you build decides what gets burned for you."

---

## Beat 3 — a company (0:50) · `#/check/GOOGL`

> "Google's own words, page four: *matched one hundred percent of our electricity
> consumption with renewable energy purchases, on a global and annual basis.* True under
> the standard. We say **true on paper**."

> "Physically, its ten datacenters sit on grids that ran from **five point six percent to
> ninety-one percent** carbon-free. One annual claim, ten different realities."

If asked how the score works: *"Plain average of those ten grids. No weighting, no
contracts."*

---

## Beat 4 — OpenAI (0:40) · type `openai`

> "We built the question layer on OpenAI's models, so let's point it at OpenAI. Six
> Stargate sites, each mapped to the utility that serves it."

Open Santa Teresa:

> "El Paso Electric is thirty-four percent clean at midday and **one tenth of one percent**
> at night."

Then, and do not skip this:

> "And this one we can't see at all. It runs on a 700 to 900 megawatt gas microgrid that
> never touches the grid. Federal demand data is blind to it. Eleven of our sites are like
> that. **A demand-only detector cannot see a datacenter that brought its own power plant.**"

---

## Beat 5 — ⌘K (0:40)

Type: **"Which five regions have the most clean power at 3am relative to their demand, and
which utility serves each?"**

> "Seven tool calls against the real data. It comes back as a table with links, and it
> structurally cannot show you a number the tools didn't return."

Backups: `compare NBIS and CRWV` · `what did Google say about 24/7 carbon free energy`
(pulls the quote and page number out of 354 indexed documents).

---

## Beat 6 — why it holds (0:50) · `#/method`

> "The detector scores 111 regions on demand alone. It never reads a press release."

> "We fixed the weights and named four test regions **before** we looked at any ranking,
> in the same commit as the code. Three landed in the top twenty. **Dallas came 91st**, and
> we published the miss rather than retuning until it went away."

Then the strongest statistic:

> "And when we re-ran the frozen method on 2026 data that didn't exist when we locked it,
> the ranking held at **0.877**, with eight of the top ten unchanged."

If pressed on weather: *"Weather explains 7.8%. Northern Virginia was actually colder in
2025 while its demand rose 3,960 megawatts."*

---

## Beat 7 — exposure (0:30) · `#/alpha`

> "Every flagged region resolves to the utility that serves it, its parent, and a ticker.
> ERCOT North, our rank one, is served by AEP Texas. Parent American Electric Power."

Then the honesty:

> "And a third of the load we found lands on public power and cooperatives with **no listed
> equity at all**. That number is on the screen. This is an input to a trade, not a trade.
> We've run no backtest and we don't claim one."

---

## Beat 8 — close (0:20)

> "We never say a company lied. Their claim is true under the standard. We measure the gap
> between a contract and a meter."

> "And we found an error in the federal data doing it: a nuclear plant reported twice by two
> grid operators, 1.91 times what it can physically produce. We confirmed it three ways and
> we show the corrected number next to the published one."

---

## If something breaks

**API down:** ⌘K degrades to navigation. Every other screen works, because the whole site
is a baked export. Do not apologise, move to the next beat.

**No network:** `cd web && npm run build && cd dist && python3 -m http.server 8099`

**Someone challenges a number:** open `docs/evidence/`. Nine files, one per likely
challenge, each with the quote and the citation.

---

## The slides

Seven, and they are a frame, not the content. The app is on screen for beats 2 through 7.

| # | Slide | On it |
|---|---|---|
| 1 | Title | Wattson · *It follows the power, not the press release* · greenwashing investigation of datacenter operators |
| 2 | The gap | Watchdogs exist for fast fashion, airlines, oil majors. None for datacenters |
| 3 | The turn | A datacenter is a fixed address on one grid, and the government publishes what that grid burned every hour for nine years |
| 4 | The finding | **64.7 GW** added to the average midday hour since 2019 · **17.7 GW** to the average 3am hour |
| 5 | *(holding slide while you are in the app)* | Wattson, live |
| 6 | What holds it up | 4.45M hours · 111 regions · method frozen before results · out-of-sample 0.877 · one published miss |
| 7 | Close | *True on paper, X% in reality* |

Existing deck: `docs/pitch/deck.html` (`→` advance, `N` notes, `B` backup slides, `F` full
screen).

---

## The four things to have cold

1. **The claim quote.** "Matched 100% of our electricity consumption with renewable energy
   purchases, on a global and annual basis." Never paraphrase it as "100% renewable."
2. **NEVP: 1.8% at night, 55.8% by day.** Two columns, one row, no method required.
3. **Dallas came 91st.** Volunteer it.
4. **1.91 times the nameplate.** The federal data error, confirmed three ways.
