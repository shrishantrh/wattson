# Wattson UI and product plan: 100 points

Written Sept 19, 2026, evening, after two rejected drafts (an editorial page, then a dense
instrument console). The product answers two questions. Everything below serves them:

1. **Check a company.** "It says 100% clean. What's actually powering its sites?"
2. **Compare places.** "Where should 300 MW of flat load go to run on the cleanest power?"

Tags: `[done]` shipped today · `[now]` being built tonight by agents · `[next]` before the
05:00 freeze if time allows · `[later]` after the hackathon.

## A. What the product is (1–12)

1. `[done]` Two verbs on the landing, nothing else: check a company, compare places.
2. `[done]` One answer card per action: one sentence generated from the data, three numbers.
3. `[done]` Evidence only on request, one section at a time.
4. `[now]` A command palette (⌘K) that reaches everything: companies, places, presets, all 124 regions, findings, method, view toggles. The box always works.
5. `[now]` A screener: all 111 regions as a sortable table (clean at night, change, slope, detector rank, growth) with CSV. This is the quant view.
6. `[next]` Saved comparisons: every compare has a URL; a "Copy link" button and a "Recent" list in the palette.
7. `[next]` "Ask" free text routed through the parser with a visible interpretation line ("Read as: 300 MW · Phoenix, Northern Virginia, Omaha") before it runs.
8. `[next]` Alerts as a module in evidence: Yash's 14 ranked alerts, filtered to the places on screen.
9. `[later]` Portfolio mode: a list of companies side by side (talk vs walk for all four).
10. `[later]` Watch a place: pin a region and get its month-over-month change (from trailing-12 series).
11. `[later]` An assistant (Blobatar avatar) that answers questions in prose from the same JSON, with citations. Needs an API route on the server side; not in a static site.
12. `[later]` Public embed: an answer card as an iframe for a newsroom or a report.

## B. Landing (13–22)

13. `[done]` Globe, wordmark, one question, one box, example chips, one "What we found" link.
14. `[now]` The box is the palette inline: results appear as you type (companies, places, regions), Enter opens the first.
15. `[now]` Chips are real presets with URLs; add a third row later for "Explore: cleanest grids at night · dirtiest · where new load is landing".
16. `[next]` Show one live number under the box, rotating on click (not on a timer): "US clean power at night: 39.7%".
17. `[next]` Keyboard from the start: `/` or ⌘K focuses, `1–4` open findings, `?` shows shortcuts.
18. `[next]` Landing globe drifts once to the US on load (a single 1.2 s move), then holds still.
19. `[next]` "Recently checked" chips from localStorage under the examples.
20. `[later]` A one-line onboarding tooltip on first visit only.
21. `[later]` Landing at phone width: box first, globe behind at 50% opacity.
22. `[later]` Preload the company and site fixtures on hover of a chip.

## C. Answer cards (23–38)

23. `[done]` Company: "X says 100% renewable. True on paper. Physically, its sites run on 32–93% clean power."
24. `[done]` Compare: "Omaha is your cleanest option: 52% clean power at night and improving. Northern Virginia is 39% and holding steady. Phoenix reads 10% but its data looks unreliable."
25. `[now]` Numbers tick up when the card appears (NumberTicker), never on idle.
26. `[now]` A sparkline of clean-at-night by year (2019–2025) beside the main number.
27. `[next]` Verdict chip colours: only the contradicted verdict uses the accent; everything else stays grey.
28. `[next]` "Copy sentence" and "Copy link" actions on the card (share the verdict as text).
29. `[next]` Company card: the contradiction, when one exists, is the second sentence, with the page number.
30. `[next]` Compare card: a 3-segment bar of the candidates' night clean share, ordered by rank.
31. `[next]` Compare card: the MW field changes the fossil-MW figure live (already computed in evidence; surface one number on the card).
32. `[next]` Region card: "What would 300 MW here run on?" as a one-line answer.
33. `[next]` When a place's data is flagged, say it in the sentence and grey its pin (done for AZPS/WACM; extend to any `data_flags` from the engine).
34. `[next]` Empty states with the next step: "Google isn't verified yet. Verified so far: Meta." (done); add "Notify me" as a mailto.
35. `[later]` Read the sentence aloud (Web Speech) for the demo.
36. `[later]` Per-claim cards you can flip: front = claim, back = the grid number.
37. `[later]` Confidence as a thin bar under each number, from the claim's `confidence`.
38. `[later]` Diff view: how the verdict changes when contracted power is included (needs PPA data).

## D. Evidence as modules (39–54)

39. `[now]` Evidence sections are modules: show/hide, reorder by drag, order remembered per page.
40. `[now]` "Customize" popover listing every module with a checkbox and Reset.
41. `[now]` Resizable column (drag the edge), width remembered.
42. `[now]` Table view toggle on every list module (sortable, CSV).
43. `[next]` Module: hour-of-day clean share (24 bars) for each place and each company site.
44. `[next]` Module: what changed at night since 2019 (fuel deltas as a signed bar list).
45. `[next]` Module: who serves the load, with the hand-mapped tag and the ticker.
46. `[next]` Module: detector components (four numbers, one line each).
47. `[next]` Module: the 365×24 heatmap for the region (port from `charts/builders.js`, behind a module).
48. `[next]` Module: alerts for the places on screen.
49. `[next]` Module: talk vs walk scatter, only when the engine defines talk (E4).
50. `[next]` Every module has a CSV button (U6) and a "source" footnote (table, hours, baseline).
51. `[later]` Module: interchange (net exports) by year for BAs.
52. `[later]` Module: trailing-12-month series with the 2019 reference line.
53. `[later]` Module: compare any two regions side by side.
54. `[later]` Module: notes (free text, local only) for an analyst's working.

## E. The globe (55–68)

55. `[now]` Minimal dot-matrix globe by default: matte sphere, land as dots, US brighter, state borders as thin lines. Night-lights texture stays as a toggle.
56. `[done]` Pins: dot, stem, rounded tag with the number that matters (clean %), clickable.
57. `[done]` Camera fits the pins for each answer; zoom controls; 2D fallback.
58. `[next]` Hover a pin: a small card (name, clean at night, trend, detector rank) anchored to it.
59. `[next]` Selected pin highlighted; others dimmed while a section is open.
60. `[next]` Region view: draw the BA outline (from the EIA BA shapes if available; else a soft circle around the load centre).
61. `[next]` Compare view: a thin arc from each candidate to a label rail at the right, so labels never overlap.
62. `[next]` Day/night terminator only in the findings view; off elsewhere by default (cleaner).
63. `[next]` Auto-rotate only on the landing, 0.3°/s, stops on any interaction.
64. `[later]` Heat overlay: hex-bin the 111 regions by night clean share (choropleth of dots).
65. `[later]` Time scrub: drag a year slider and watch pins recolour 2019→2025.
66. `[later]` Fly-through demo: the scripted scenes as camera moves with the card updating.
67. `[later]` Offline tiles for a 2D vector fallback (MapLibre with a bundled style) for very old machines.
68. `[later]` Reduced-motion mode drops all camera tweens.

## F. Visual system (69–80)

69. `[now]` Inter for everything, JetBrains Mono for small labels and numbers.
70. `[now]` Spacing scale, radius scale, focus rings, 150 ms transitions, thin scrollbars.
71. `[now]` Cards fade up in sequence after an action (40 ms stagger), never on idle.
72. `[next]` One accent colour, used only for: the winning option, gas/fossil, the contradicted verdict.
73. `[next]` Icons: a small set of 12 line icons (search, pin, table, layers, sun/moon, zoom, close, drag, csv, link, info, keyboard) as inline SVG, 1.5 px stroke.
74. `[next]` Tooltips on every abbreviation (BA, PJM, MW) via `data-tip`.
75. `[next]` Empty, loading (skeleton lines, no spinner) and error states styled consistently.
76. `[next]` Light theme via the tokens file only (Notion-white), toggle in the palette.
77. `[later]` Print stylesheet for the answer card (a one-page PDF).
78. `[later]` Density toggle (comfortable / compact) for the quant view.
79. `[later]` Brand mark: a W built from three vertical bars (day, night, gap).
80. `[later]` Motion audit: every animation traced to a user action or a data change.

## G. Interactivity and keyboard (81–90)

81. `[now]` ⌘K palette with groups and fuzzy search.
82. `[now]` Drag to reorder modules; keyboard reordering too.
83. `[next]` `?` opens a shortcuts sheet; `esc` closes anything; `←` goes back.
84. `[next]` Click a number in a card to open the module that explains it.
85. `[next]` Click a place name anywhere to add it to the current comparison.
86. `[next]` Hover a row to highlight its pin; hover a pin to highlight its row.
87. `[next]` Drag the MW field (scrub) to change the load; the fossil-MW line updates live.
88. `[later]` Pin-to-pin distance and "closest cleaner grid" suggestion.
89. `[later]` Multi-select regions on the globe (shift-click) to build a comparison.
90. `[later]` URL state for every module layout (shareable workspace).

## H. Data, trust and honesty (91–96)

91. `[done]` Hand-noted data caveats (AZPS, WACM) shown wherever those numbers appear.
92. `[done]` Provisional fixtures and mock claims labelled on screen.
93. `[next]` Every number has a source footnote (table, hours, baseline year) in its module.
94. `[next]` Swap to Yash's static export from `server/static_export/` at build; live API behind a flag.
95. `[next]` Method page links from every caveat; the six caveats stay one line each.
96. `[next]` A "numbers checklist" page for E8: every demo-facing figure, its source, a check mark.

## I. Demo and judging (97–100)

97. `[next]` Demo mode: landing → check Meta → evidence → compare → why → what we found → method, on arrow keys, with the globe moving each step.
98. `[next]` A 90-second script: type "Meta" (verdict), type "300 MW: Phoenix vs Northern Virginia vs Omaha" (ranked answer), open why, show the detector map, say the caveats.
99. `[next]` Screenshots of five states at 1440×900 for both write-ups (done for four; redo after tonight's pass).
100. `[next]` Freeze the demo path at 05:00; nothing new after that, only fixes.
