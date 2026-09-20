# Wattson, demo video script

**Target: 2:30.** Read the bold lines as written; they are timed. Everything else is
direction. Every figure below is checked against the data, do not round them "nicer."

---

## The opening line

> ## **"There's a greenwashing watchdog for fast fashion. For airlines. For oil majors.**
> ## **There isn't one for datacenters, the fastest-growing industrial power load in**
> ## **America. So we built it."**

Say the three "for" clauses at pace, then break before "There isn't one." The list does the
work: by the third item the audience has accepted that this is a normal, mature thing that
obviously should exist, so the absence lands as an oversight rather than as a pitch.

**Do not open on solar.** Solar is the *evidence*, not the thesis. The thesis is that an
entire industry's environmental claims have never been audited. Lead with the audit; the
night is how you win the argument thirty seconds later.

**Alternates:**

- *"This is a greenwashing investigation of datacenter operators. It's the first one that exists, and it's settled against 4.45 million hours of federal meter data, not a press release."*
- *"Every company building AI says it runs on clean power. Not one of those claims has ever been checked against the meter. We checked all of them."*
- *"Fast fashion has watchdogs. Airlines have watchdogs. The industry burning the most new electricity in America has nobody. That's the whole gap."*

---

## 0:00 – 0:25 · Cold open (the 15-second pitch, expanded)

**SCREEN:** black, then the globe, slow.

> **"There's a greenwashing watchdog for fast fashion. For airlines. For oil majors. There
> isn't one for datacenters, the fastest-growing industrial power load in America. So we
> built it."**
>
> *(beat)*
>
> **"Wattson is a greenwashing investigation of datacenter operators. Every one of them
> says it runs clean. Nobody had ever checked, because the claim is one sentence in a
> sustainability PDF, and the evidence is 4.45 million hours of federal meter data across
> all seventy US grids. Wattson is that join."**
>
> **"And because every verdict ends at a named utility in a named region, it isn't only an
> exposé. An asset manager can act on it."**

That last sentence is the one that separates this from a class project. Do not cut it for
time, cut something in the middle instead.

---

## 0:25 – 0:50 · The evidence

**SCREEN:** the day-vs-night chart. Let the two bars land.

> **"Here's why nobody caught this. At annual resolution it is invisible. You have to
> separate the hours."**
>
> **"Since 2019, the United States added sixty-five gigawatts of clean power to the average
> daytime hour, and eighteen to the average overnight hour. Nearly four times more to the
> hours a datacenter doesn't care about."**
>
> **"Solar cleaned up the middle of the day. It did nothing for the middle of the night , 
> and a datacenter draws the same power at 3am in January as at noon in June. So an annual
> '100% renewable' claim can be completely true on paper and still describe a facility that
> ran on gas every night for seven years."**

**SCREEN:** PJM.

> **"In PJM, the grid serving the largest datacenter cluster on earth, overnight clean
> generation has not increased since 2019. Overnight generation rose 8.7 gigawatts. Gas
> supplied 10.7 of it."**
>
> **"At annual resolution, this finding does not exist."**

---

## 0:45 – 1:35 · The product, live

Do not narrate the UI. Ask it things.

**(a) The check, 15s.** Type a ticker.

> **"So: a company says it's clean. What actually powers its sites?"**

Land on the verdict.

> **"True on paper. Six to ninety-one percent physically. We never say they lied, an annual matched
> claim is genuinely true under the GHG Protocol. We're measuring the gap between a
> contract and a meter."**

**(b) The detector, 15s.**

> **"We also find the datacenters without a list of datacenters. This scores 111 regions on
> the signature of flat 24/7 load, nights growing faster than days, the load curve
> flattening. It never reads a press release."**
>
> **"Method frozen before we saw the ranking, four validation regions named in advance.
> Three hit. One missed, and it's on screen, Dallas came 91st, because every ERCOT zone is
> booming, so a booming Dallas looks unremarkable."**

Say the miss out loud. It buys more credibility than the three hits.

**(b2) OpenAI, 20s. Use this. It is the best beat in the demo.**

Type `openai`. Six Stargate sites come up, every one mapped to a grid.

> **"We built the ask layer on OpenAI's models. So let's point it at OpenAI."**
>
> **"Six Stargate sites. Abilene, Milam County, Lordstown, Pike County, Port Washington,
> Santa Teresa. Thirty-seven percent carbon-free across them, and the two we're most
> confident about are the two where the utility is named in the press release: AEP Ohio
> and We Energies."**

Then open the New Mexico site. **This is the line.**

Before the microgrid point, land the grid it sits in, it is the thesis in one region:

> **"Look at the grid that campus sits on. El Paso Electric runs thirty-four percent
> carbon-free in the middle of the day, and one tenth of one percent at night. One
> megawatt of clean generation out of six hundred and fifty-five. That is the entire
> argument in a single utility."**


> **"And this one we cannot see at all. Project Jupiter is a 700-to-900 megawatt gas
> microgrid that explicitly does not connect to El Paso Electric. So that load never
> appears in federal demand data, including ours."**
>
> **"That's not a gap we found in someone else's work. That's our own blind spot, on our
> own screen, in writing. Eleven of our mapped sites are behind the meter. A demand-only
> detector cannot see a datacenter that brought its own power plant."**

Why this beat works: it is a sponsor demo, a finding, and a confession in one move, and
the confession is what makes the other two credible. Do not skip the last paragraph to
save time, it is the most persuasive thing you will say.

---

**(c) ⌘K, 20s. This is the moment.** Open it. Start typing; let the grey completion appear
and hit Tab.

> **"And you can just ask it."**

Run: **"Which five regions have the most clean power available at 3am relative to their
overnight demand, and which listed utility serves each?"**

> **"That's seven tool calls against the real data. It comes back as a table with links,
> not a paragraph, and it structurally cannot show you a number the data didn't produce."**

---

## 1:35 – 2:05 · Why it holds

**SCREEN:** the coverage / cannot-verify counters.

> **"The thing we're proudest of is what it refuses to say."**
>
> **"Nebius, we couldn't tie a single site to a named serving utility. So its record says
> that, instead of guessing a grid. Twelve operators have sites mapped and no documents
> read, and each one says so: that's a gap in our coverage, not a finding about them."**
>
> **"And Arizona's clean share looked like it collapsed. It's an artifact, a reporting
> change. We found it in our own diagnostics, and rather than quietly patching the export,
> we ship both numbers side by side."**
>
> **"Vantage's site in Quincy, Washington runs on a grid that is a hundred percent
> carbon-free at 3am. Columbia River hydro. The method isn't 'everyone is dirty.' It
> distinguishes."**

That last line is important. Without it you sound like a prosecutor; with it you sound like
an instrument.

---

## 2:05 – 2:30 · Close

**SCREEN:** back to the globe, or the regional ranking.

> **"Greenwashing analysis is a mature field, for fast fashion, for airlines, for oil
> majors. It does not exist for datacenters, which are now the fastest-growing industrial
> electricity load in the country."**
>
> **"Wattson is the join. A claim, the grid the site actually draws from, and the hour that
> decides it."**
>
> **"And because every verdict ends at a named utility in a named region, it isn't only an
> exposé, an asset manager can act on it. Load growth hits a regulated utility's rate base
> long before it hits its filings."**
>
> *(beat)*
>
> **"It follows the power, not the press release."**

---

## Rules for the recording

- **Never say "caused by."** Say "consistent with." The detector flags flat load; flat load
  is datacenters, crypto, and oilfield electrification.
- **Never say a company lied.** The verdict is *"true on paper, X physically."*
- **Never state a share falling as clean power shrinking.** If you say a share fell, say the
  absolute in the same breath.
- Say **"balancing authority,"** then immediately ",  the grid operator for an area." Don't
  assume the term.
- If a number on screen disagrees with this script, **the screen is right.** Read the screen.

## If something breaks

The whole site is a static export, it runs with no server. If the ask layer is down, ⌘K
degrades to the deterministic command palette and every other screen is unaffected. Don't
apologize for it on camera; just move to the next screen.

## Numbers used in this script

| Figure | Value | Where it comes from |
|---|---|---|
| Hourly rows | 4.45M | EIA-930 via PUDL, 2018-07 → 2026-09-05 |
| Balancing authorities | 70 | same |
| Regions scored | 111 | detector output |
| Daytime clean added since 2019 | **+64.7 GW** | 174.8 → 239.5 GW (corrected 2019) |
| Overnight clean added since 2019 | **+17.7 GW** | 155.7 → 173.4 GW (corrected 2019) |
| Ratio | **3.7×** | the two above |
| Overnight share 2019→2025 | **flat, 0.397** | it did NOT fall; published 0.405 carries the AZPS phantom |
| PJM overnight generation growth | +8.7 GW | |
| PJM overnight gas | +10.74 GW | `fuel_delta_overnight_gw.gas` |
| PJM overnight net exports | 3,814 → 2,489 MW | EIA-adjusted operations |
| Dominion detector rank | 6th of 111 | |
| Dallas (ERCO/NCEN) | 91st | the pre-registered miss |
| Grant County PUD overnight clean | 100% | `GCPD.cf_share_2025.overnight` = 1.0 |
| Operators held | 52 | 134 sites; 4 with claims checked, 48 sites-only |
| OpenAI Stargate sites | 6 | walk score 0.369, coverage 1.0 |
| Project Jupiter microgrid | 700–900 MW | gas, not connected to El Paso Electric |
| Behind-the-meter sites | 11 | invisible to EIA-930 by construction |
| El Paso Electric daytime clean | 34.1% | `EPE.cf_share.2025.daytime` |
| El Paso Electric overnight clean | **0.1%** | 1 MW clean of 655 MW total |
