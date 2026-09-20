# DEMO

**Five beats. Highlights only.** Nothing here volunteers a weakness. The answers to hard
questions live in `docs/evidence/` and you pull them out only if asked.

**Live:** https://shrishantrh.github.io/wattson/

---

## The one sentence

> "We ranked every electricity grid in America by how much it looks like a datacenter moved
> in, using nothing but power demand. Then we checked what the companies there claim."

---

# BEAT 1 · The list
### **Data** → **Facilities** → sort by **RANK**

**On screen:** 134 datacenters. Company, the utility delivering their power, its parent,
the ticker, the grid, how clean it is, rank out of 111.

> "We scored all 111 US grid regions on one question: how much does your electricity demand
> look like a customer moved in that never turns off? Then we mapped 134 datacenters to the
> utility that actually serves them."

> "A datacenter is a billion-dollar event nobody announces. It can't hide from the meter.
> This is federal data with a two hour lag."

**If asked how the score works:**

> "Three things: did demand grow at night as fast as in the day, did it grow faster than its
> neighbours on the same grid, did the daily curve flatten. Only a customer that never
> switches off does all three."

---

# BEAT 2 · The chain to a ticker
### Click a **Dominion** row → `#/region/PJM/DOM`

> "Northern Virginia. **Rank six of a hundred and eleven.** Overnight demand went from ten
> thousand to fourteen thousand megawatts since 2019. Up thirty-nine percent."

> "Nine datacenters we've mapped sit here. Amazon, Microsoft, Equinix, Digital Realty. The
> utility is Virginia Electric and Power. Parent: **Dominion Energy, ticker D.**"

> "That's a data point about Dominion that came out of a power meter, not out of Dominion."

**Then toggle CLEAN SHARE → CLEAN MW:**

> "The clean share here fell. The clean megawatts barely moved, 35,700 to 35,619. Everything
> else in those hours grew around it. That distinction is the entire reason we built this
> hourly instead of annually."

---

# BEAT 3 · The company
### Search box → **GOOGL**

> "Google's own words, page four of its own report: it **matched** 100% of its electricity
> consumption with renewable **purchases**, on an **annual** basis."

> "Physically, its ten datacenters sit on grids running from **six percent to ninety-one
> percent** carbon-free. One annual claim. Ten different realities."

> "We're not calling anyone a liar. Their claim is correct under the accounting standard.
> We're measuring the gap between a contract and a meter, and nobody had measured it."

**If asked how it's built:** *"Plain average of those ten grids."*

---

# BEAT 4 · Ask it anything
### **⌘K**

> "Which five regions have the most clean power at 3am, and which utility serves each?"

> "Seven tool calls against the real data, back as a table with links. And it structurally
> cannot show you a number the tools didn't return."

**Backups:**
- `compare NBIS and CRWV`
- `what did Google say about 24/7 carbon free energy` — pulls the exact quote and page out
  of 354 indexed documents

---

# BEAT 5 · Why it holds
### **Method**

> "We fixed the formula and named four test regions **before** we looked at any ranking, in
> the same commit as the code. Three landed in the top twenty."

> "Then we tried to break it. We re-ran the frozen method on 2026 data that didn't exist
> when we locked it: **it held, eight of the top ten unchanged.** We ran it ending in 2021,
> 22, 23, 24 — **nothing before 2025 is significant.** The signal is dated to the buildout."

> "And we trained a model on raw demand shape that was never shown our formula. It found the
> same regions. **We wrote the formula from a hypothesis. The model found it without the
> formula.**"

---

# The flexes

Not apologies. Use them.

**We found an error in federal data.**
> "Two grid operators were each reporting the same nuclear plant in full instead of their
> share. Together they reported **1.91 times what that plant can physically produce.** We
> confirmed it three ways. The site shows the corrected number next to the published one."

**One of our four test regions missed.**
> "Dallas came ninety-first, and we published it. A ranking you can check against names
> written down in advance is worth more than one that reports four out of four."

**We never say anyone lied.**
> "Their claims are true under the standard. We're measuring something nobody had measured,
> not accusing anyone of anything."

---

# Only if asked

Do not volunteer these. Answer confidently when they come.

**"Isn't it just hotter summers?"**
> "We pulled hourly temperature from 138 weather stations and measured how much extra power
> each region uses when it gets hot. That explains **seven point eight percent**. And
> Northern Virginia was **colder** in 2025 while its overnight demand rose four gigawatts."

**"Did you tune it?"**
> "Git proves not. The four test regions are in the same commit as the code that made the
> first ranking, and the only change after is twenty-two lines, none touching the score."

**"Is this tradeable?"**
> "It's an input to a trade. A datacenter energises and it's in federal data two hours
> later, resolved to the utility and the ticker, before anyone announces it."

**"How many companies do you have?"**
> "Fifty-two operators, a hundred and thirty-four sites, every one traced through the
> utility that actually serves it rather than guessed from the state."

**Anything else:** `docs/evidence/` — nine files, each with the quote and the citation.

---

# Have these cold

1. **"Matched 100% of our consumption with renewable purchases, on an annual basis."**
   Never say "Google claims 100% renewable."
2. **Northern Virginia: rank 6, overnight demand +39%, Dominion Energy, ticker D.**
3. **1.91 times the nameplate.**
4. **35,700 to 35,619 MW** — PJM's clean power at night, flat since 2019.

---

# Operational

- **Lost your place?** Data → Facilities. The table alone is the whole story.
- **⌘K slow?** First question wakes the API, a few seconds. Keep talking.
- **No network?** Every screen except ⌘K works offline, the site is a baked export.
- **Don't rely on:** the Compare deep link (pick operators manually), or clicking region to
  company (use the Facilities sheet for that direction).

| You get | Run |
|---|---|
| 2 min | Beats 1 and 3 |
| 4 min | Beats 1, 2, 3, 5 |
| 6+ min | All five, plus Compare and Generating Alpha |
