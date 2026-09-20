# Columns to point at in the Data tab

Open `#/data`. Five sheets: **Regions, Alerts, Companies, Claims, Sites.** This file gives
you one line per column, and the single strongest move to open with.

---

## The move: two columns, one row

On the **Regions** sheet, the columns **Night** and **Day** sit next to each other. Sort by
Day descending, or just find these rows:

| Region | Night | Day | What it is |
|---|---|---|---|
| **NEVP** | **1.8%** | **55.8%** | Nevada Power. Las Vegas |
| TEC | 0.0% | 28.6% | Tampa Electric |
| EPE | 0.1% | 34.1% | El Paso Electric |
| AZPS | 10.4% | 47.6% | Arizona Public Service |

Point at the NEVP row and say:

> "This is Las Vegas. **Fifty-six percent of its power is carbon-free in the middle of the
> day. One point eight percent at three in the morning.** That is the same grid, the same
> year, ten hours apart. A datacenter there is buying both, and it is buying the same amount
> of each."

Then:

> "Nobody is hiding this. It is two columns in federal data. It just has never been put next
> to a company's clean-energy claim before."

**Why this works:** it needs no method, no statistics and no trust in us. It is two numbers
in one row of public data, and the gap is so large it argues for itself.

**The counterweight, and use it, because it stops you sounding like a prosecutor:** find
**GCPD**. Grant County PUD, Washington. **100% at night and 100% by day.** Columbia River
hydro. Microsoft and Vantage both have sites there.

> "And this is the same table. A hundred percent, day and night. So this is not 'everyone is
> dirty'. It measures. Where you build decides what gets burned for you."

---

## Regions sheet, column by column

| Column | One line |
|---|---|
| **Place / Region** | The grid region. `PJM/DOM` means the Dominion zone inside PJM. A zone reports demand only and inherits its parent's generation |
| **Night** | Clean share of everything generated there, midnight to 6am local, 2025. **The column the whole project is about** |
| **Day** | Same thing, 10am to 4pm. The gap between this and Night is solar |
| **Δ 2019** | How much Night moved since 2019, in points. Mostly small, which is the finding |
| **Trend** | Points per year. Direction, not a forecast |
| **Clean ÷ dem** | Clean megawatts at night divided by overnight demand. Above 1.0 means the region generates more clean power at night than it uses |
| **Siting** | Where new 24/7 load would be served cleanly. Level, direction and headroom combined |
| **Rank** | Flat-load detector rank of 111. **Computed from demand only. It never reads a press release** |
| **Score** | The detector score behind that rank |
| **Growth** | Average demand growth 2019 to 2025 |
| **Excess** | How much faster demand grew at night than on average, in points. **The single most datacenter-shaped number here** |
| **Pattern** | A descriptive label. **Does not affect the score.** Assigned after ranking |
| **Flags** | Data problems we found. AZPS carries one |

**Rows worth knowing on this sheet:**

- **ERCO/NRTH, rank 1.** ERCOT North. Demand grew 94.6%.
- **PJM/DOM, rank 6.** Northern Virginia. One of the four we named in advance.
- **ERCO/NCEN, rank 91.** Dallas. **The one we got wrong**, and we left it in.
- **AZPS, rank 3** with a flag. The region where we found the federal data error.

---

## Claims sheet: the company's own words

This is the sheet to open if anyone doubts we read the documents.

| Column | One line |
|---|---|
| **Claim** | The **verbatim sentence** from the company's own report. Not a summary |
| **Source / p.** | The filename and **page number**. Openable |
| **Metric / Value / Scope** | What is being claimed, how much, and how narrowly |
| **Verdict** | `true_on_paper`, `contradicted`, `unfalsifiable`, `cannot_verify` |
| **Checkable** | How falsifiable the claim is. A vague claim scores low and that is the claim's problem, not ours |
| **Min / Max** | **The physical range** of the grids under that company's sites. Google runs 5.6% to 91.3% |
| **Patterns** | Hedging language we detected |

> "That column is not our paraphrase. That is the sentence, and that is the page it is on."

---

## Companies sheet

| Column | One line |
|---|---|
| **Talk** | How bold the claim is: magnitude × specificity × scope. Hedges cut it |
| **Walk** | Plain average of the clean share of every grid their sites sit on |
| **Cover** | What fraction of their claims grid data can speak to at all |
| **Claims / Sites** | How many we read, how many we mapped |
| **No check** | Claims we **cannot** settle. **Counted on screen rather than hidden** |

> "Talk is what they said. Walk is what the wires did. We never call the gap a lie, because
> their claim is true under the accounting standard."

---

## Sites sheet: the part that makes the rest possible

| Column | One line |
|---|---|
| **Serving utility** | The utility that actually delivers power to that building. **Everything is built outward from this column**, never from the state |
| **Parent / Ticker** | Its owner, and the listed ticker if there is one. This is where a grid observation becomes a named security |
| **Grid** | The balancing authority that utility sits in |
| **Clean** | That grid's carbon-free share |
| **Source** | Where the mapping came from: company disclosure, press, SEC filing |

**The row to point at: IREN, Childress, Texas.**

> "Childress is in the Texas Panhandle, where most surrounding counties are on the SPP grid.
> Every map would put this site in SPP. **It wires directly into ERCOT.** One wrong row here
> flips a verdict, which is why all 134 are traced through the serving utility by hand, each
> with a source."

---

## If they ask you to prove a number live

```bash
python3 docs/headline_from_raw.py
```

Fifteen lines against the raw federal table. Prints PJM's overnight clean and total for
2019 and 2025, within 0.4% of what the site shows. The small gap is daylight saving: the
script uses a fixed offset, the pipeline does it properly.
