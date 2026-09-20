# Facility coverage expansion — staging notes

`claims/lookup/facilities_expanded.csv` is a **staging file**. It has not been merged into
`claims/lookup/facilities.csv` and nothing reads it yet.

## What is in it

| | |
|---|---|
| New rows | **114** |
| Distinct operators | **51** (previous file: 16) |
| Distinct regions touched | **45** of the 111 scored regions |
| Rows carrying a ticker | 73 |
| Confidence: high | 42 |
| Confidence: medium | 61 |
| Confidence: low | 11 |

Combined with the existing 20 rows this takes the lookup to **134 sites / ~60 operators**.

Every row was validated mechanically before commit:

* header is byte-identical to `facilities.csv`, so `server/data.py::facilities()` (a plain
  `csv.DictReader`) can read a simple concatenation;
* every `ba` exists in `dashboard/public/data/regions.json`, every `zone` exists **and**
  nests under its own `ba`;
* no row duplicates an existing `(company, metro)` pair and none duplicate each other;
* all 100 distinct source URLs were fetched and return content. The only non-200 responses
  are SEC EDGAR (403 to a browser user-agent, 200 with a compliant one — all six filings
  were re-fetched and their content greppedy) and three bot-blocked corporate pages
  (EdgeConneX 403, Prime 403, Iron Mountain 429). No dead or invented links.

## Schema decisions a reviewer should know about

* **`confidence` is not a column.** The schema had to match `facilities.csv` exactly, so
  confidence is encoded as the first token of `note`: `confidence=high.` /
  `confidence=medium.` / `confidence=low.`. If a `confidence` column is ever added, it can
  be parsed straight back out. The validator enforces that every row carries one.
* **Confidence grades the site→BA mapping, not the press release.** That is the claim the
  product rests on. So a site the company itself announces, whose serving utility is
  inferred from the city, is *medium* when the city sits in exactly one balancing
  authority, and *low* when the city straddles two (e.g. Chandler AZ is SRP **or** AZPS —
  two different BAs, so Digital Realty Phoenix is low and its `serving_utility` is blank).
* **`lat`/`lon` are deliberately blank on all 114 rows.** Most sources give a city or a
  county, not a campus address. A city-centre pin presented as a facility pin is a small
  lie and this project cannot afford small lies. Fill them per-row only from an address.
* **`serving_utility` is blank on 22 rows** where the location is solid but the retail
  utility could not be pinned. Those rows still carry a defensible `ba`, and the note says
  what is unknown. This is deliberate, per the honesty bar: an honest blank beats a guess.
* **Company-string collision.** The Odessa row uses `Cipher Digital (Cipher Mining)` to
  match the existing Wink row exactly so the two group as one company in the UI. The name
  is awkward; if it is ever normalised to `Cipher Mining`, both rows must change together.

## Three ticker corrections that also affect existing data

Verified against filings and live quotes, not memory:

| Was | Now | What happened |
|---|---|---|
| Bitfarms `BITF` | **`KEEL`** | Rebranded Keel Infrastructure and redomiciled to the US; trading as KEEL from 6 Apr 2026 |
| Greenidge `GREE` | **`VIP`** | Renamed Vulcan Infrastructure and Power; GREE ceased trading 23 Jul 2026 |
| Stronghold `SDIG` | **delisted** | Ceased trading 17 Mar 2025 on the Bitfarms merger |

Also confirmed live and correct: **TXNM** (Texas-New Mexico Power's parent) — that closes
the "operator tickers unverified, especially TXNM" item in `CLAUDE.md`. Its Blackstone
acquisition is pending, so it will delist on close. **CORZ** still trades independently:
the CoreWeave acquisition of Core Scientific was voted down and terminated on 30 Oct 2025,
which is why CoreWeave appears as a *tenant* at Denton and not as its owner.

## Findings worth surfacing on screen, not burying

**1. Behind-the-meter is a structural blind spot, and it is now measurable.**
Eleven of these sites are wholly or mostly behind the meter, so EIA-930 cannot see their
load at all. The Oracle/OpenAI Stargate fact sheet states it outright for two of them —
Shackelford County TX runs on "an onsite, behind-the-meter, gas-powered microgrid utilizing
Jenbacher reciprocating engines", and Doña Ana County NM on a microgrid that "will power the
campus independently from the local grid" — while the same document says Abilene "connects
directly to the ERCOT grid". Also invisible: both Keel/Stronghold Pennsylvania waste-coal
plants, Vulcan/Greenidge Dresden (all power from its own 106 MW gas plant), Soluna Briscoe
County, Nebius Vineland (~85% self-generated), Crusoe Laramie County, xAI Southaven, Fermi
America, and Poolside Pecos County. A demand-only detector is blind to every one of them.
That is a real limitation of the method and should be stated on the site, not discovered by
a judge.

**2. Two sites are explicitly NOT flat load.** MARA Kearney NE — NPPD's own article calls
the mining load interruptible — and the Keel Pennsylvania sites, which the operator says it
will offer into PJM as demand response. Reading either as flat datacenter load would be wrong.

**3. The Panhandle heuristic breaks twice.** Hut 8's Vega is listed in its 10-K with its
location given only as "Texas Panhandle" but its power source as "Wind + ERCOT grid", and
Soluna's Briscoe County site is the same story. Anything that auto-assigns Panhandle counties
to SWPP/SPS will mis-route both. Fermi America near Amarillo is the mirror image: genuinely
SPP, not ERCOT.

**4. One town, two balancing authorities.** Core Scientific's 10-K puts Marble 1 (35 MW)
on Murphy Electric Power Board, a TVA distributor, and Marble 2 (68 MW) next door on Duke.
Same town, TVA vs DUK. Both are in the file as separate rows. This is the cleanest
demonstration in the dataset of why geographic inference fails.

**5. Phoenix contains two balancing authorities and operators are split across them.**
Goodyear/El Mirage/Glendale is APS (AZPS); Mesa/Chandler/Tempe is SRP. Vantage and Compass
are on AZPS, Google Mesa and EdgeConneX Tempe on SRP, and Digital Realty's Chandler campus
could be either — which is why that row is the weakest in the file and says so.

## Operators searched for and NOT placed — our documented coverage gap

These should be displayed, not hidden. Each was looked for and honestly could not be sourced
to a specific US site with a resolvable balancing authority.

| Operator | Why not |
|---|---|
| **IBM** | No US datacenter IBM publicly names as an owned site with an identifiable location. IBM Cloud's US multi-zone regions are leased third-party colo and IBM does not disclose the buildings. Every list found was an aggregator. |
| **Salesforce** | Publicly states it runs most infrastructure on hyperscaler public cloud and does not name its remaining owned US datacenters. |
| **Nvidia** | Operates no publicly disclosed US datacenter of its own. The Plano TX facilities that surface in search are CoreWeave's and Aligned's (leased to Lambda) — Nvidia is customer and investor, not site operator. The 2025 Texas/Arizona announcements are Wistron/Foxconn/TSMC *manufacturing*, not datacenters. |
| **Together AI** | Leases capacity from third parties with no publicly named facility, county or campus. Nothing mappable. |
| **Anthropic** | The $50bn Fluidstack announcement names only "Texas and New York". The two Fluidstack sites we could place (Cameron County TX, Lake Mariner NY) are *reported* to be the Anthropic sites, but no source we opened names Anthropic at either — the Cameron County permit coverage says explicitly that no anchor tenant has been announced. Both are filed under **Fluidstack**, which is the defensible attribution. |
| **Bitfarms (as Bitfarms)** | The Sharon PA site (110 MW) is named in a 6-K, but we could not confirm county and serving utility. Covered indirectly through the two ex-Stronghold rows. |
| **Riot Platforms** | No US site found beyond Rockdale and Corsicana, which we already had. |
| **Flexential** | flexential.com returns 403 to automated fetch on every path. The one Nashville row rests on a 2019 press release with no address and no utility. A human with a browser could upgrade this materially. |
| **Yondr Lancaster TX** | Only reachable through a paraphrase in search results; no page opened. |

Sites known to exist but left out because the **balancing authority** could not be settled:

* **Google Pampa (Gray/Roberts Counties) TX** — co-developed with Intersect Power with its own
  generation; SPS retail vs behind-the-meter unresolved, and that decides the BA.
* **Google Cedar Rapids IA**, **Google Nebraska**, **Google Storey County / Henderson NV** —
  locations on Google's own pages, retail utility not sourced.
* **Meta Fort Worth TX** — Meta's fact sheet for this one site uniquely says only "multiple
  partners" and names no utility, unlike every other Meta fact sheet.
* **Microsoft Cheyenne WY**, **Microsoft West Des Moines IA**, **Microsoft Castroville TX**.
* **Oracle Phoenix (us-phoenix-1)** and **Oracle's Stargate "Midwest" site** — the latter is
  referenced in the fact sheet with no state or county at all.
* **Soluna Project Sophie KY** — sources say only "Kentucky"; TVA vs LGEE vs PJM/EKPC turns
  entirely on the county.
* **Bitdeer Wenatchee WA** — "Wenatchee" vs "East Wenatchee" is CHPD vs DOPD.
* **Cipher Alborz / Bear / Chief TX**, **Hut 8 King Mountain TX** — JV sites with unresolved
  TDU and ERCOT zone.
* **Flexential Denver (Parker CO)** — served by Core Electric Cooperative, not Xcel, so the
  BA is not safely PSCO.
* **Aligned Phoenix** — the campus genuinely straddles APS and SRP across Phoenix, Chandler
  and Waddell; one row would have forced one BA onto two.
* **Sabey Austin** — actually in Round Rock, which straddles Oncor/Pedernales and the
  ERCOT SCEN/NCEN line.
* **Novva Mesa AZ / Las Vegas NV**, **T5 Atlanta**, **Compass Red Oak TX** — pages 404'd or
  were bot-blocked.

## Rejected — tempted, and dropped

* **Tesla Buffalo NY (Dojo)** — announced Jan 2024, but Dojo was shut down in Aug 2025 and the
  Buffalo commitment is unresolved. A row asserting operating load in NYIS/ZONA would likely
  be wrong today. Tesla is represented by the Austin/Cortex row instead.
* **Nvidia Plano TX** — the "$1.6B Nvidia supercomputer" there is CoreWeave's facility and the
  $700M Plano build is Aligned's, leased to Lambda. Attributing it to Nvidia would be fabrication.
* **TeraWulf Nautilus (Berwick PA, behind the Susquehanna nuclear plant)** — would have been an
  ideal behind-the-meter row, but TeraWulf sold its stake to Talen in Oct 2024.
* **Greenidge Spartanburg SC and Columbus MS** — both divested.
* **Galaxy McGregor TX** — real and company-disclosed, but first power is expected 2028.
  Galaxy is represented by Helios (Dickens County) instead.
* **Bitdeer Clarington and Niles OH** — in the SEC exhibit but dated 2027 and 2029.
* **MARA "North Texas, 180 MW wind farm"** — the 10-K gives no city or county.
* **Crusoe's second Abilene campus and the Crusoe/Lancium Abilene site** — real, but same metro,
  same BA, same ERCOT zone as our existing Abilene row; no new grid signal.
* **Nebius Kansas City (Patmos)** — could not settle Missouri vs Kansas, which changes the BA.
* **Flexential Charlotte 4** — Flexential does not own the building; it leases from H5. Recording
  it as a Flexential campus would mislead a siting analysis.
* **Santa Clara colo for STACK and DataBank** — neither page pinned a facility to the City of
  Santa Clara versus San Jose, and that distinction is Silicon Valley Power vs PG&E.
* **All aggregator listings** (baxtel, datacenters.com, compute-atlas, datacenter.fyi, usdatamap)
  — used as leads only, never cited. Several carry utility and capacity fields we could not
  corroborate.
* **measuredai.substack.com** — supplied several useful-looking specifics; dropped as a citation
  and both claims re-sourced to POWER Magazine and local reporting instead.
* **Megawatt figures as structured data** — the schema has no capacity column and none was
  invented. Where a capacity appears in a `note` it is printed by the cited source.

## One anchor we got wrong mid-task, and corrected

The research briefs initially told two agents that Santa Clara / Silicon Valley Power sits in
**BANC**. That is wrong: SVP is a municipal utility operating as a **metered subsystem inside
CAISO**. BANC's members are SMUD, Modesto Irrigation District, Roseville, Redding, Shasta Lake
and Trinity PUD — Sacramento-area only. The correction was pushed to both agents before they
finished and the Vantage Santa Clara row carries `ba=CISO` with the sub-zone blank. Worth
noting because the same error is easy to make again.

## Suggested next steps before merge

1. Decide whether `confidence` becomes a real column, or stays parsed out of `note`.
2. Backfill `lat`/`lon` only for rows whose source gives a street address (roughly 20 of them).
3. Re-check the 11 low-confidence rows with a browser — several are low only because a
   corporate site blocked automated fetch, not because the fact is doubtful.
4. Decide how the UI should present the 11 behind-the-meter sites. They are the most
   interesting rows in the file and the ones our method is structurally blind to.
