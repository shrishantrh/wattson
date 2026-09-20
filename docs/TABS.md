# Wattson — every screen, every part

What each tab answers, what each control on it does, what to say about it, and the trap a
judge will reach for. Written to be read cold before a demo.

**One rule above all: if a number on screen disagrees with this document, the screen is
right.** These pages are generated from the data; this file is written by hand.

---

## The shape of the product

Wattson is a **greenwashing investigation of datacenter operators**. Everything below is
one of four moves:

| Move | Screens | The question |
|---|---|---|
| **Accuse** | Check, Companies | This company says it is clean. What actually powers its sites? |
| **Detect** | Found, Screener, Explore, Region, Alerts | Where is flat 24/7 load landing, and on whose grid? |
| **Advise** | Compare, Irradiance | Where should the next gigawatt go, and why does the hour matter? |
| **Monetize** | Generating Alpha | Who is exposed to this? |

Plus **Method** and **Data**, which exist so nothing above has to be taken on trust, and
**Ask** (⌘K), which answers anything in plain English.

---

## `#/` — Landing

**Answers:** what is this, and give me one thing I did not know.

| Part | What it is |
|---|---|
| Globe | 111 scored regions. Dot color is clean share at night for the selected year; hollow dots are regions whose data is flagged or corrected. |
| Headline figure | The national day-vs-night gap. |
| Company chips | Jump straight into a verdict. 52 operators are reachable, not just the four on screen. |
| ⌘K bar | The ask layer. Type anything. |

**Say:** *"Since 2019 the US added 64.7 GW of clean power to the average daytime hour and
17.7 GW to the average overnight hour — 3.7 times as much to the hours a datacenter doesn't
care about."*

**Do not say** the clean share "fell" without immediately giving the absolute. The share
held flat at 0.397 while output **rose** 155.7 → 173.4 GW. Demand simply grew faster.
These are the corrected 2019 figures; the published baseline carries AZPS's 3,373 MW
overnight phantom. If you are asked, say so — we found it ourselves.
Saying only the first half is the single easiest way to state something false out of true
numbers.

---

## `#/check/:ticker` — Check

**Answers:** this company says it is clean; what actually powers its sites?

| Part | What it is |
|---|---|
| Claim, verbatim | The company's own sentence, with a page cite into its own PDF. |
| Verdict | `true_on_paper` · `contradicted` · `unfalsifiable` · `cannot_verify` (with a reason). |
| Talk score | magnitude × specificity × scope_breadth. How big the claim is, how precisely stated, how little hedged. `null` when we read no document. |
| Walk score | Mean physical carbon-free share across mapped sites, 2025, all hours, grid-only. |
| Sites | Each with its serving utility, that utility's parent and ticker, the BA it sits in, and the source the mapping came from. |
| Coverage status | `claims_checked` · `sites_only` · `no_site_resolved`. |

**Say:** *"True on paper. Six percent physically."* Then immediately: *"We never say they
lied. An annual matched claim is genuinely true under the GHG Protocol market-based
method — that's a real accounting standard, not a loophole someone invented. We're
measuring the gap between a contract and a meter."*

**The `sites_only` screen is a feature, not a hole.** 48 of 52 operators have sites mapped
and no documents ingested. That card says so in words: *"a gap in our coverage, not a
finding about them."* Show one deliberately — it is the most honest screen in the product.

**Trap:** *"You only mapped two of Google's thirty datacenters."* True, and the card says
its own coverage fraction. The answer: the mapped sites are sourced and checkable; an
unmapped site is absent, not assumed clean.

---

## `#/companies` — Companies

**Answers:** who have you actually looked at?

Talk-vs-walk across all 52 operators, with the coverage split visible: 4 with documents
read, 48 sites-only, and the count we could not verify at all.

**A null must never draw as a zero.** Amazon's talk score is legitimately `null`. We
shipped a bug once where `(talk_score ?? 0)` drew that as a 0% bar — a screen that said
"Amazon talks at zero," assembled entirely from correct JSON. Nulls now render as an em
dash.

---

## `#/found` — What we found

**Answers:** what is the actual finding?

A stepped walk through PJM rather than a wall of text. Arrow keys or the dots move through
it; each step keeps the prior figures on screen and only the last step shows the full
paragraph.

1. Overnight clean generation: flat within 100 MW since 2019
2. Overnight generation overall: **+8.7 GW**
3. Of that, gas: **+10.74 GW** (coal −2.5, nuclear −0.9 make up the difference)
4. Net exports: **3,814 → 2,489 MW** — so the extra power stayed inside PJM

**Say:** *"At annual resolution this finding does not exist."*

**Trap:** *"How is gas +10.7 when total is only +8.7?"* Because coal fell 2.5 GW and
nuclear 0.9. It is coal-to-gas switching plus growth. The fuel deltas sum to 8.69 against
the 8.70 total, so no fuel category was dropped by the 2024-07-01 EIA recategorization.

---

## `#/screen` — Screener

**Answers:** let me cut the 111 regions myself.

| Control | What it does |
|---|---|
| Clean-at-night floor | Slider; drops regions below that overnight clean share |
| Demand-growth floor | Slider; bounds read off the data so the left end filters nothing |
| Footprint | all / whole grids / zones only |
| Interconnection chips | Eastern, Western, ERCOT, with live counts |
| Pattern chips | flat-load growth · possible midday solar suppression · mixed, with counts |
| Readout | Regions passing, median clean at night, median growth, count carrying the flat-load pattern — recomputes on every move |
| Reset · `Esc` | Clears every filter |
| ↑ ↓ · `Enter` | Row navigation, open the region |

Columns include **Night excess** and a **Data** column marking flagged or corrected regions.

**Say:** *"A datacenter buys every hour it runs, so the column that decides what gets burned
for it is clean at night — not the annual headline."*

**Pattern labels are descriptive only and never touch the score.** They are assigned after
ranking, from growth and overnight excess. Do not let anyone treat them as an input.

---

## `#/region/:id` — Region

**Answers:** everything about one grid.

| Part | What it does |
|---|---|
| Hour scrubber | Slider, arrow keys, or click a bar. Reads out that hour and names the cleanest and dirtiest hours of the day |
| 2019 overlay | Toggles the baseline year onto the 24-hour profile |
| Share ↔ MW toggle | Switches between clean share and "MW of a 300 MW load served by fossil". **This is the honesty toggle** — it makes the share-vs-absolute distinction physical |
| Year series | 2019–2025, night / day / all-24, generating its own reading |
| Detector module | The three inputs, the score, the rank, the pattern |
| Fuel delta | What filled the overnight growth |
| Siting | Overnight clean share, change since 2019, clean MW over demand, slope per year |
| Operators | The serving utility, its parent, its ticker |

**Zones show the parent BA's generation** and say so (`cf_inherited_from_ba`). A zone
reports demand only. Never attribute a BA's fuel change to one of its zones.

**AZPS is the screen to show if someone doubts your rigor.** Its published overnight clean
share reads 0.62 → 0.15, an apparent collapse. It is an artifact of a reporting change. We
found it in our own diagnostics and ship **both** the published and corrected value, with
the year marked amber — corrected, it rises. Then we swept the other 69 BAs and all 4,430
BA pairs to prove Arizona was the only one.

---

## `#/explore` — Explore

**Answers:** show me the field and let me cut it.

Scatter plus globe, linked. Pick the axes, set a direction (≥ / ≤) and a threshold on the
y-metric's real domain; the readout compares the median x among survivors against the
median among the rest. Clicking a point pins it on both the scatter and the globe.

---

## `#/compare` — Compare

**Answers:** where should this load go?

Head-to-head over any two of the 111 regions, with a swap button and a nine-row delta:
clean at night, change since 2019, trend per year, clean ÷ night demand, siting rank,
flat-load rank, demand growth, own night demand in MW, and the **fossil MW** of the
requested load. It generates a sentence naming the gap in megawatts.

**Say the MW, not the percentage.** *"A 300 MW load here draws 176 MW from fossil
generation between midnight and 6am"* is a sentence a person can act on. "39.7%" is not.

**Caveated regions render amber and withhold their delta** — AZPS's published −51.7 pt
change is not comparable to a clean region's, so the comparison is suppressed while the
2025 level still stands.

---

## `#/irradiance` — Irradiance

**Answers:** is the day-vs-night story actually about the sun?

NASA POWER satellite irradiance, which owes nothing to our pipeline. It shows the daytime
solar resource did **not** change while the daytime clean share did — so the daytime
improvement is built capacity, not a better sun. Includes the hour-by-hour payoff: what a
300 MW load draws from fossil at 3am versus at noon.

**This is the independent check.** If someone says "your whole finding could be an artifact
of your own pipeline," this is the answer: a second, unrelated dataset with the same shape.

---

## `#/alerts` — Alerts

**Answers:** what changed recently?

Min-severity slider, rule chips with counts, tier chips, order by severity / longest run /
newest, reset and `Esc`, keyboard nav, and an empty state that names the highest severity
in the set.

**Own the history here.** Our first prioritization pass scored missing values as passes, so
regions with incomplete data swept the top eight slots — the "prioritized" screen was the
detector ranking wearing a different label. We caught it and it is in the write-up.

Alerts for detector-type rules have **no streak at all**, and render an em dash, not "0
months". WACM is flagged and excluded from alerts (unexplained +1.5 GW demand in 2022 with
flat generation); it stays in the ranking.

---

## `#/method` — Method

**Answers:** why should I believe the detector?

An inspector: pick any of the 111 regions, see its three detector inputs and its published
score and rank, watch both pattern rules evaluated against its own figures with ✓ / ·
marks, and compare the rule's answer to the shipped label. Validation clusters are
clickable rows showing their ranks.

**The script:** *"score = z(overnight excess) + z(neighbor divergence) + 0.5 × z(load
factor change). Robust z — median and MAD, not mean and sigma, because ERCOT's two zones
are genuine outliers at +94.6% and +116.1% and would otherwise set the scale for everyone
else. Regions under 500 MW average demand are excluded. Weights and cutoffs were frozen
before we saw the ranking, and four validation regions were named in advance."*

**Then volunteer the miss.** Northern Virginia 6th, Omaha 7th, AEP 19th — three hits. Dallas
came **91st**. Neighbor divergence compares a zone against its neighbors, and every ERCOT
zone is booming, so a booming Dallas looks unremarkable. Saying this unprompted buys more
credibility than the three hits do.

---

## `#/data` — Data

**Answers:** where did every number come from?

Click any column chip: the source file, the JSON path, the producing script, the stored
unit, what the field means, and live min/max/median/blank counts computed from the rows on
screen. Full CSV download.

**Say:** *"Nothing on this site is a figure you have to take our word for. Shares are 0–1
fractions in the file and percentages only on screen."*

---

## `#/alpha` — Generating Alpha

**Answers:** who is exposed to this?

The chain from a metered measurement to an instrument: flagged region → serving utility →
parent → ticker. Plus Kalshi contracts with strike, bid, ask and close.

**We stop at the input.** No backtest, no price target, no position. The honest pitch is
that load growth hits a regulated utility's rate base before it hits its filings, and we
are naming the utilities early. Say that as a hypothesis, because that is what it is.

**Do not show a market with no trades as if it were a signal.** A dead market has no edge
in it.

---

## `⌘K` and `#/ask` — the ask layer

**Answers:** anything, in plain English.

Start typing and a grey completion appears under the caret; **Tab** accepts it. Suggestions
are route-aware — on a region page it offers *"How clean is PJM/DOM at 3am?"*, on a company
page *"What does IREN actually run on at night?"*. When more than one prompt still matches,
it deliberately shows **no** ghost rather than guessing.

Ten typed tools run against the real data: `rank_regions`, `region`, `compare_regions`,
`national`, `company`, `companies`, `alerts`, `facilities`, `irradiance`, `search_corpus`.
An answer with a shape — a comparison, a ranking, one subject and its figures — renders as
a **table with links**, not a paragraph.

**The guard is the point.** After the tool loop, a render step turns the answer into a view
spec, and every figure in that view is checked against the tool results already in the
conversation. A view containing a number the tools did not produce is **discarded** and the
prose is served instead. The model is structurally unable to put an invented figure on
screen.

**Demo prompts that work:**
- *"Compare ERCOT, PJM and CAISO on clean power at night"* → 3-row table, 2019 vs 2025
- *"Which five regions have the most clean power available at 3am relative to their overnight demand, and which listed utility serves each?"* → 7 tool calls, ranked table with links
- *"Which companies claim 100% renewable but sit on fossil grids?"*
- *"What fuel served the load growth in PJM/DOM?"*

**If the key runs out mid-demo:** ⌘K degrades to the deterministic command palette and every
other screen is unaffected. The whole site is a static export and needs no server. Do not
apologize on camera — move to the next screen.

---

## The five things never to say

1. **"Caused by."** Say *consistent with*. The detector flags flat load, which is
   datacenters, crypto, and oilfield electrification.
2. **"They lied."** The verdict is *true on paper, X physically*.
3. **A share fell** without the absolute in the same breath.
4. **A zone's generation.** Zones report demand only and inherit the parent's generation.
5. **Any number not on the screen in front of you.**
