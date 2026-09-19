# Wattson plan, part 2: from a lookup to an analysis layer

Added Sept 19, late afternoon, after the first hundred points. Why: the product answered two
questions with one number each, which is a lookup. Judges reward what the data can *do*. Every
item below is computable from data already in the repo tonight (hourly clean-share profiles,
yearly series, fuel deltas, the detector components, the siting score, interchange, Yash's 14
ranked alerts, four companies' ESG text). No new pipeline work.

## What we have that nobody is using yet

- `profile_24h` per region: clean share for every hour of the day, 2019 and 2025.
- `cf_share` per region for every year 2019 to 2026, day / night / all.
- `heatmap` 365 × 24 for every BA (2025): seasons and weekdays are in there.
- `interchange` per BA by year: who imports its night power.
- `detection` components and `siting` components for 111 regions: a 12-column dataset.
- `overnight_fuel_mw` by year and fuel: the fuel stack behind every night.
- Alerts with severity = magnitude × persistence × recency, first-crossed month, streak.
- ESG report text, page-cited, for Meta, Google, Microsoft, Amazon (309 chunks).

## K. The load-shape simulator (101–108) `[now]`

101. A load has a shape. Flat 24/7 (a datacenter), business hours, overnight-heavy (fleet charging, batch jobs), daytime-following. Each shape weights the 24-hour clean profile differently, so the same place gives a different clean share for each.
102. Shape picker on the compare card: switching shape re-ranks the candidates live.
103. "Flexible 20%": if a fifth of the energy can move into the cleanest six hours, the share rises by X. Says which hours.
104. Best six hours and worst six hours per place, in clock words ("2pm to 8pm").
105. Fossil MW at your load size for each shape, side by side.
106. 2019 vs 2025 for the chosen shape: did the hours you use get cleaner?
107. Region page module: "What your load shape would run on".
108. Sentence: "In Northern Virginia a flat 300 MW runs on 39% clean power; on business hours 42%; shifting a fifth into the cleanest hours gets 43%."

## L. Explore: any two metrics across 111 regions (109–116) `[now]`

109. Scatter with axis pickers over 14 metrics, Pearson r, least-squares line, top-5 outliers.
110. Preset "Flat-load fingerprint": growth vs overnight excess, the four named clusters labelled. The detector as a picture.
111. Preset "Does growth run on gas?": growth vs change in night clean share.
112. Preset "Where solar hides the night": clean by day vs clean at night. The day-night gap ranking.
113. Preset "Cleanest and improving": clean at night vs trend. The siting logic as a picture.
114. Sector grouping by interconnection (Eastern, Texas, Western) as colour and as a filter. This is the "sectors" cut the data supports; EIA-930 has no customer sectors.
115. Click a point to pin it on the globe and open the region.
116. URL state for every view, so a chart is a link.

## M. Time (117–124) `[next]`

117. Time machine: a year slider on the detector map recolours every pin by night clean share 2019 → 2025. Watch the mid-Atlantic dim.
118. Season split from the heatmap: winter nights vs summer nights per region (solar's absence in December).
119. Weekday vs weekend night share from the heatmap dates (industrial vs residential load).
120. "What changed this month": Yash's 14 alerts as a feed with severity bars, first-crossed dates, and the place pinned.
121. Trailing-12 series with the 2019 reference line, per region.
122. Import dependence: BAs whose night demand exceeds their night generation (PACW generates a quarter of what it uses). Show it on the site rows so a 93% figure is not read as consumption.
123. Streaks: how many months a region has been above its 2019 night demand.
124. Snapshot date and data vintage on every card footer, generated from the export.

## N. Companies (125–132) `[next]`, blocked on Yash's E2/E4/E5

125. Reading progress per company: pages and chunks read, extraction pending or done (from claims/raw). Replaces "isn't verified yet".
126. Peer comparison: four companies side by side, talk vs walk, physical range, cannot-verify count.
127. Relocation what-if: move one site to another grid and watch the physical range move.
128. Portfolio: enter several sites, get the weighted physical share and the weakest site.
129. Claim timeline: claims by year with the grid share of that year beside each.
130. Contradiction cards: the headline claim and the appendix figure, both with page numbers.
131. Falsifiability distribution per company: how many claims can even be checked.
132. "What would make this claim true physically": the clean share the sites would need.

## O. Demo and story (133–140) `[next]`

133. Demo route: landing → Meta → why → compare → shape → explore fingerprint → what we found → method.
134. One sentence per screen, generated; no slide has a number the checklist cannot trace.
135. The Phoenix caveat and the PACW import artifact said out loud: honesty is the differentiator.
136. Judges' question prep: "average not marginal", "generation not consumption", "why 00:00–05:59", "why frozen".
137. A 90-second cut and a 3-minute cut of the walkthrough.
138. Screenshots at 1440 × 900 of landing, Meta, compare, shape, explore, detector map, region, screener.
139. Freeze at 05:00; only fixes after.
140. Write-ups: Voloridge (detector, traps, EC2 runtime), Arrowstreet (claims, contradictions, cannot-verify reasons).
