# DEMO

**This is the final demo doc.** Everything you need on stage is here. Every screen below
was opened and checked against the live site; where something does not work, it says so.

**Live:** https://shrishantrh.github.io/wattson/

| | |
|---|---|
| Deeper background | `docs/UNDERSTAND.md` |
| If a judge challenges a number | `docs/evidence/` (9 files, one per likely challenge) |
| Video script | `docs/DEMO_VIDEO.md` |
| Deploy and offline fallback | `docs/DEMO_RUNBOOK.md` |

---

## 0. Before you start

- Open the site. Leave it on the landing page.
- Have `docs/evidence/` open in a second window or on your phone.
- If ⌘K is slow on the first question, that is the API waking from sleep. It takes ~3s once.

---

## 1. The opening (20s) · landing page

> "There is a greenwashing watchdog for fast fashion. For airlines. For oil majors. There
> isn't one for datacenters, the fastest growing user of electricity in America. So we
> built one."

> "And these companies are careful. They don't say they run on clean power. Google says it
> **matched** 100% of its consumption with renewable **purchases**, on an **annual** basis.
> That's an accounting statement, and it's true. Nobody has checked the physical one."

---

## 2. The evidence, before any method (40s) · `#/data`

Click **Data**. You land on **Regions**. The columns **Night** and **Day** are adjacent.

Find **NEVP**.

> "This is Las Vegas. Fifty-six percent of its power is carbon-free at midday. **One point
> eight percent at three in the morning.** Same grid, same year, ten hours apart."

> "A datacenter buys both, equally, because it never stops. This isn't hidden. It's two
> columns of federal data that nobody had put next to a company's claim."

Now find **GCPD**:

> "Same table, a hundred percent day and night. Columbia River hydro, and Microsoft has a
> site there. So we're measuring, not prosecuting. Where you build decides what burns."

---

## 3. The alt-data view (40s) · `#/data` → **Facilities**

Click the **Facilities** tab. 134 rows. Sort by **RANK**.

> "This is the whole product in one table. Company, the utility that actually delivers its
> power, that utility's parent, the ticker, the grid, how clean that grid is, and where it
> ranks out of 111 for looking like an always-on customer arrived."

> "A datacenter is a billion-dollar capex event nobody announces. But it can't hide from
> the meter. This table is built from federal data published with a two hour lag."

Point at a **Dominion** row:

> "Northern Virginia. Nine datacenters we've mapped, including Amazon and Microsoft. The
> utility is Virginia Electric and Power, parent **Dominion Energy, ticker D**. That's a
> data point about Dominion that came from a power meter, not from Dominion."

---

## 4. One region, in depth (50s) · click through to `#/region/PJM/DOM`

> "Rank six of a hundred and eleven. Overnight demand went from ten thousand to fourteen
> thousand megawatts, up thirty-nine percent."

Point at the caveat line on screen:

> "And note what the page says itself: *generation below is the whole PJM grid, not this
> zone alone*. A zone reports demand only. We won't let you attribute PJM's gas to Dominion."

**Use the hour scrubber.** Drag to 03:00.

> "Three in the morning: thirty-nine point six percent clean, against forty-four in 2019."

**Then toggle CLEAN SHARE → CLEAN MW.** This is the honest moment:

> "And here's the thing most people get wrong. The share fell, but clean output barely
> moved, 35,700 to 35,619 megawatts. **No clean power was lost.** The share fell because
> everything else in those hours grew around it. If you only quote the share, you say
> something false using true numbers."

---

## 5. The simple lookup (20s) · type `NBIS` in the search box

> "Nebius. Two sites, forty-two percent on their grids. And look at what it says: zero
> claims read, no documents ingested from this operator."

> "Forty-eight of our fifty-two companies are like that. That's a statement about **our**
> coverage, not a finding about them, and it says so rather than leaving a blank."

---

## 6. The accusation (50s) · type `GOOGL`

> "Google's own words, page four of its 2026 environmental report. True under the standard,
> so we say **true on paper**."

> "Physically, its ten datacenters sit on grids that ran from **five point six percent** —
> a rural co-op in South Carolina — to **ninety-one percent** on Columbia River hydro. One
> annual claim, ten different realities."

If asked how the score works:

> "Plain average of those ten grids. No weighting, no contracts. Talk is what they said,
> walk is what the wires did."

---

## 7. The sponsor beat and our blind spot (40s) · type `openai`

> "We built the question layer on OpenAI's models. So let's point it at OpenAI. Six
> Stargate sites, each traced to the utility serving it."

Open the **Santa Teresa** site:

> "El Paso Electric. Thirty-four percent clean at midday, **one tenth of one percent** at
> night."

Then, and do not skip it:

> "And this one we cannot see at all. It runs on a seven to nine hundred megawatt gas
> microgrid that never touches the grid. Eleven of our sites are like that. **A demand-only
> detector cannot see a datacenter that brought its own power plant.** We'd rather say that
> than have someone find it."

---

## 8. Comparison (40s) · `#/compare` → **Head to head** → **Operators**

**Pick the two manually.** The deep link does not pre-fill tickers.

> "Any two of the 111 grids, any two of the 52 operators, any two of the 134 sites."

With two operators up:

> "Clean share, and the megawatts behind it, because a percentage without a quantity is how
> you mislead people. And the difference worked out in the third column."

---

## 9. Ask it anything (40s) · ⌘K

Type: **"Which five regions have the most clean power at 3am relative to their demand, and
which utility serves each?"**

> "Seven tool calls against the real data, back as a table with links. And it structurally
> cannot show you a number the tools didn't return: we check every figure in the answer
> against what the tools actually returned, and drop the ones that don't match."

Backups, both verified: `compare NBIS and CRWV` · `what did Google say about 24/7 carbon
free energy` (pulls the quote and page out of 354 indexed documents).

---

## 10. Why believe the ranking (60s) · `#/method`

> "The detector scores 111 regions from demand alone. It never reads a press release.
> Three signals: how much faster demand grew at night than on average, how much faster than
> its neighbours on the same grid, and how much the daily curve flattened."

> "We fixed the weights and named four test regions **before** we looked at any ranking, in
> the same commit as the code. Three landed in the top twenty. **Dallas came 91st.** We
> published the miss."

Then the part that wins it:

> "Then we spent last night trying to destroy our own result."

**Name the tests. Short.**

> "We asked whether randomness could produce it. Barely not, p of 0.049, and we say it's
> marginal. We rebuilt the ranking ten thousand times on resampled hours: Dominion holds
> between third and seventh. We re-ran the frozen method on 2026 data that didn't exist
> when we locked it: it held at **0.877**, eight of the top ten unchanged."

> "And the one that matters most: we ran the same frozen method ending in 2021, 22, 23, 24.
> **Nothing before 2025 is statistically significant.** The signal is dated to the buildout.
> A method that manufactures signal would manufacture it every year."

---

## 11. The model that says the formula was optional (30s)

> "Then we checked whether our formula was even necessary. We trained a gradient boosted
> model on seventeen features of raw demand shape — flatness, summer versus winter, the
> size of the day-night swing. It was never shown our detector's output. Its labels came
> from the 134 datacenters we mapped by hand from utility filings."

> "It found the same regions. AUC of 0.727, and zero of a thousand shuffled-label runs beat
> it. **We wrote the formula from a hypothesis. The model found it without the formula.**"

Then the concession, unprompted:

> "And it told us something against us: region *size* alone predicts our labels better than
> shape does, 0.749. Bigger regions have more mapped sites because we mapped more of them.
> So the honest claim is that shape adds information beyond size, not that it beats size.
> That's in the write-up."

---

## 12. Who's exposed (30s) · `#/alpha`

> "Every flagged region resolves to the utility, the parent, the ticker."

Then the limit:

> "And a third of the load we found sits on public power and cooperatives with **no listed
> equity at all**. That number is on the screen. This is an input to a trade, not a trade.
> We have run no backtest and we don't claim one."

---

## 13. Close (20s)

> "We never say a company lied. Their claim is true under the standard. We measure the gap
> between a contract and a meter."

> "And we found an error in the federal data doing it. A nuclear plant reported twice by two
> grid operators, totalling **1.91 times what it can physically produce**. We confirmed it
> three ways and we show the corrected number next to the published one."

---

## Cuts

**Three minutes:** 2, 6, 10. The table, the company, the freeze.
**Five minutes:** add 3, 7, 9.
**Full:** all of it, about seven minutes.

## Known, so you are not surprised

- **ERCOT North is rank 1 and has no mapped datacenters.** Coverage gap, or it isn't
  datacenters. IREN and Tesla are in ERCOT, but in other zones: `ERCO`, `ERCO/WEST`,
  `ERCO/SCEN`.
- **The region page does not list its datacenters.** Region to company is not a click.
  Company to region is. Use the Facilities sheet for that direction.
- **The Compare deep link does not pre-fill tickers.** Pick them manually.
- **First ⌘K question may take a few seconds** while the API wakes.

---

## The answers to the four questions you will definitely get

### "Isn't this just that summers got hotter?"

> "We pulled hourly temperature from a hundred and thirty-eight weather stations and
> measured, for every region, exactly how much extra power it uses when it gets hot. Then we
> asked how much of the growth that explains. **Seven point eight percent.**"

> "And Northern Virginia was actually **colder** overnight in 2025 than in 2019, while its
> overnight demand went up **three thousand nine hundred and sixty megawatts.** It got
> colder and used four gigawatts more power at night. That isn't air conditioning."

If they push on whether the weather model was any good: *"It explains about three quarters
of the normal hour-to-hour swing in demand. It works. Weather is just not what grew."*

### "Did you tune this after seeing the results?"

> "No, and git proves it. The four test regions are named in the same commit as the code
> that produced the first ranking. The only change after that is twenty-two lines, none of
> which touch the score."

Two commands they can run in front of you:
```
git show 7dc87a0:scripts/l3_detector.py | grep NCEN
git show --numstat c421061 -- scripts/l3_detector.py
```

### "How do I know your data is right?"

> "We found an error in the federal data. Two grid operators were each reporting the same
> nuclear plant in full instead of their share. Combined they reported **1.91 times what
> that plant can physically produce.** We confirmed it three ways and we show the corrected
> number next to the published one."

### "Is this actually tradeable?"

> "It's an input to a trade, not a trade. A datacenter is a billion-dollar capex event
> nobody announces, and it shows up in federal meter data with a two hour lag. We resolve it
> to the utility and the ticker. But a third of the load we found sits on public power with
> no listed equity, that number is on the screen, and we have run no backtest and don't
> claim one."

---

## Have these four cold

1. **The claim quote.** "Matched 100% of our electricity consumption with renewable energy
   purchases, on a global and annual basis." **Never** paraphrase as "100% renewable."
2. **NEVP: 1.8% at night, 55.8% by day.** Two columns, one row, no method required.
3. **Dallas came 91st.** Volunteer it before anyone asks.
4. **1.91 times the nameplate.** The federal data error, confirmed three ways.

---

## If something breaks

**⌘K is slow or dead:** the API sleeps when idle; the first question takes a few seconds.
If it is genuinely down, every other screen still works because the whole site is a baked
export. Do not apologise, move to the next beat.

**No network at all:**
```bash
cd web && npm run build && cd dist && python3 -m http.server 8099
```

**Someone challenges a figure:** open `docs/evidence/`. Nine files, each with the quote and
the citation.
