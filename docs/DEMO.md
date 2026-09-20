# DEMO

**Five beats. Each one is self-contained** — if you lose your place, jump to any of them and
it still makes sense. Everything here was checked on the live site.

**Live:** https://shrishantrh.github.io/wattson/

---

## The one sentence, if you say nothing else

> "We ranked every electricity grid in America by how much it looks like a datacenter moved
> in, using nothing but power demand. Then we checked what the companies there claim."

---

# BEAT 1 · The list
### Click: **Data** → **Facilities** tab → sort by **RANK**

**What is on screen:** 134 datacenters. Company, the utility that delivers their power,
that utility's parent, the ticker, the grid, how clean it is, and its rank out of 111.

**Say:**

> "We scored all 111 US grid regions on one question: how much does your electricity demand
> look like a big customer moved in that never turns off? Then we mapped 134 datacenters to
> the utility that actually serves them."

> "A datacenter is a billion-dollar event nobody announces. But it can't hide from the
> meter. This is federal data, published with a two hour lag."

**If they ask how the score works:**

> "Three things: did demand grow at night as fast as in the day, did it grow faster than its
> neighbours on the same grid, and did the daily demand curve flatten out. Only a customer
> that never switches off does all three."

---

# BEAT 2 · One region, and the ticker
### Click: any **Dominion** row → lands on `#/region/PJM/DOM`

**Say:**

> "Northern Virginia. **Rank six of a hundred and eleven.** Overnight demand went from ten
> thousand to fourteen thousand megawatts since 2019, up thirty-nine percent."

> "Nine datacenters we've mapped sit here, including Amazon and Microsoft. The utility is
> Virginia Electric and Power. Parent: **Dominion Energy, ticker D.**"

> "That's a data point about Dominion that came out of a power meter, not out of Dominion."

**Then the one thing that makes this different from a chart** — toggle **CLEAN SHARE → CLEAN MW**:

> "The clean *share* here fell. But the clean *megawatts* barely moved, 35,700 to 35,619.
> No clean power was lost. Everything else in those hours grew around it. If you only quote
> the percentage you say something false using true numbers."

---

# BEAT 3 · What the company claims
### Click: search box, type **GOOGL**

**Say:**

> "Google's own words, page four of its own report: it **matched** 100% of its electricity
> consumption with renewable **purchases**, on an **annual** basis. That's true. We call it
> **true on paper.**"

> "Physically, its ten datacenters sit on grids that ran anywhere from **six percent to
> ninety-one percent** carbon-free. One annual claim, ten different realities."

**The reason it's not an accusation:**

> "We never say they lied. The claim is correct under the accounting standard. We're
> measuring the gap between a contract and a meter."

**If asked how the number is built:** *"Plain average of those ten grids. No weighting, no
contracts."*

---

# BEAT 4 · Ask it anything
### Press **⌘K**

Type: **"Which five regions have the most clean power at 3am, and which utility serves each?"**

**Say:**

> "That's seven tool calls against the real data, back as a table with links. And it
> structurally can't show you a number the tools didn't return."

**Two backups if that one is slow:**
- `compare NBIS and CRWV`
- `what did Google say about 24/7 carbon free energy` — pulls the exact quote and page out
  of 354 indexed documents

---

# BEAT 5 · Why believe the ranking
### Click: **Method**

**Say:**

> "We fixed the formula and named four test regions **before** we looked at any ranking, in
> the same commit as the code. Three landed in the top twenty. **Dallas came ninety-first.**
> We published the miss."

> "Then we tried to destroy our own result. We re-ran the frozen method on 2026 data that
> didn't exist when we locked it: it held. And we ran it ending in 2021, 22, 23, 24 —
> **nothing before 2025 is significant.** The signal is dated to the buildout."

**Then the one that lands with a quant:**

> "And we trained a model on raw demand shape that was never shown our formula. It found the
> same regions. **We wrote the formula from a hypothesis; the model found it without the
> formula.**"

---

# The four questions you will get

### "Isn't this just that summers got hotter?"

> "We pulled hourly temperature from 138 weather stations and measured, for every region,
> how much extra power it uses when it gets hot. That explains **seven point eight percent**
> of the growth. And Northern Virginia was actually **colder** in 2025 while its overnight
> demand went up four gigawatts. It got colder and used more power at night."

### "Did you tune it after seeing results?"

> "No, and git proves it. The four test regions are in the same commit as the code that made
> the first ranking. The only change after is twenty-two lines and none touch the score."

### "How do I know your data is right?"

> "We found an error in the *federal* data. Two grid operators were each reporting the same
> nuclear plant in full instead of their share. Together they reported **1.91 times what
> that plant can physically produce.** We show the corrected number next to the published
> one."

### "Is this tradeable?"

> "It's an input to a trade, not a trade. A third of the load we found sits on public power
> with no listed equity, and that number is on the screen. We've run no backtest and we
> don't claim one."

---

# Have these four cold

1. **"Matched 100% of our consumption with renewable purchases, on an annual basis."**
   Never say "Google claims 100% renewable."
2. **Northern Virginia: rank 6, overnight demand +39%, Dominion Energy, ticker D.**
3. **Dallas came 91st.** Say it before they ask.
4. **1.91 times the nameplate.** The error we found in federal data.

---

# If you get stuck

- **Lost your place?** Go to Data → Facilities and start from Beat 1. The table alone is
  the whole story.
- **⌘K slow?** The API sleeps when idle; the first question takes a few seconds. Keep
  talking, or skip to Beat 5.
- **Everything dead?** Every screen except ⌘K works with no network at all, because the
  whole site is a baked export.
- **Challenged on a number?** `docs/evidence/` has nine files, one per likely challenge,
  each with the quote and citation.

---

# Known, so nothing surprises you

- **ERCOT North is rank 1 and has no mapped datacenters.** Don't attribute it to anyone.
  IREN and Tesla are in ERCOT but in other zones (`ERCO`, `ERCO/WEST`, `ERCO/SCEN`).
- **The region page doesn't list its datacenters.** Region → company isn't a click. Use the
  Facilities sheet for that direction.
- **Compare's deep link doesn't pre-fill tickers.** Open it and pick them manually.

---

# Timing

| You get | Run |
|---|---|
| 2 minutes | Beats 1 and 3 |
| 4 minutes | Beats 1, 2, 3, 5 |
| 6+ minutes | All five, plus Compare and Generating Alpha |
