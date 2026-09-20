# Wattson film narration

*It follows the power, not the press release.*

**Generated from `web/src/demo/film.js`.** `web/scripts/narrate.mjs` rewrites this file on every
run; edit the `say` lines in `film.js`, never here. Sourcing, correction notes and recording
conditions live in **`docs/narration-annex.md`**, which narrate does not own.

The shape is: say what the product is and how it works, then walk that same process on screen, then
one finding, one refusal and one clean result.

## The script

**1. open** · what · flat

> Fast fashion has a greenwashing watchdog. Airlines have one. Datacenters don’t.

**2. what** · what · '#/'

> Here’s how it works. A company publishes a claim. We find the buildings it operates. Each sits on a grid we can name. We read what that grid generated hour by hour. Then we compare.

**3. why** · what · night

> Why hours? Since twenty nineteen America added sixty-five gigawatts of clean power to the average daytime hour. Overnight it added eighteen. Datacenters run on both.

**4. type** · walk · '#/' — silent

**5. google** · walk · '#/check/GOOGL'

> Start with Google. First the claim. Google says a hundred percent renewable. Then the buildings. We’ve mapped ten.

**6. grids** · walk · '#/check/GOOGL'

> Now the grids. They ran six to ninety-one percent clean last year. That averages forty-six. So the claim is true on paper under the GHG Protocol. Not a lie. A contract against a meter.

**7. claims** · walk · '#/check/GOOGL'

> Here’s the claim we read. Page four of their own report. Their page ninety-four discloses the hourly figure. Sixty-five percent.

**8. detector** · walk · '#/found?s=detector'

> That works when we know the company. This answers a harder question. Where is new round-the-clock load landing when nobody tells us? It reads demand alone. No company list.

**9. method** · walk · '#/found?s=detector'

> A hundred and eleven regions get a score. The scoring uses medians instead of means. One big region can’t swamp it. It was frozen before we looked. Dallas came ninety-first. We print the miss.

**10. pjm** · finding · '#/found'

> Now run that reading on PJM. That’s the grid operator for the biggest datacenter cluster on earth. Clean power at night hasn’t moved since twenty nineteen.

**11. gas** · finding · '#/found'

> The night got eight point seven gigawatts bigger. Gas supplied ten point seven. Consistent with round-the-clock load served by gas. Not caused by it.

**12. stargate** · walk · '#/check/OPENAI'

> We built the ask layer on OpenAI’s models. So point it at OpenAI. Six Stargate sites. Each mapped to a grid. Only three to a named utility. One we can’t see at all. Reporting says it runs on its own gas plant.

**13. blind** · walk · '#/check/OPENAI?evidence=1'

> Ten of our mapped sites are behind the meter. A demand-only detector can’t see them.

**14. ask** · walk · ASK_ROUTE

> You can also just ask it. Which claimant sits on the dirtiest grid at night? It answers Google. Moncks Corner. Zero point seven percent clean overnight.

**15. askhow** · walk · ASK_ROUTE

> That’s an OpenAI tool-calling loop over eleven typed tools. One searches three hundred fifty-four passages in Elasticsearch. They come from the companies’ own reports and filings. Codex wrote that retrieval layer.

**16. refuse** · refusal · '#/check/CRUSOE'

> Last thing. Watch what it won’t say. We couldn’t tie a single Crusoe building to a named utility. So the record says that.

**17. clean** · refusal · '#/check/VANTAGE?evidence=1'

> Vantage’s Quincy, Washington site sits on a grid a hundred percent carbon-free at 3am. Columbia River hydro. The method distinguishes.

**18. end** · close · end

> A claim. The buildings behind it. The grid under each one. The hour that decides it. It follows the power, not the press release.

## Per-shot clock

| # | id | section | words | narration |
|---|---|---|---|---|
| 1 | open | what | 11 | 5.4 s |
| 2 | what | what | 35 | 15.8 s |
| 3 | why | what | 25 | 11.5 s |
| 4 | type | walk | 0 | 0.6 s |
| 5 | google | walk | 18 | 8.4 s |
| 6 | grids | walk | 34 | 15.4 s |
| 7 | claims | walk | 20 | 9.3 s |
| 8 | detector | walk | 29 | 13.2 s |
| 9 | method | walk | 34 | 15.4 s |
| 10 | pjm | finding | 26 | 11.9 s |
| 11 | gas | finding | 24 | 11.0 s |
| 12 | stargate | walk | 42 | 18.9 s |
| 13 | blind | walk | 15 | 7.1 s |
| 14 | ask | walk | 26 | 11.9 s |
| 15 | askhow | walk | 31 | 14.1 s |
| 16 | refuse | refusal | 23 | 10.6 s |
| 17 | clean | refusal | 20 | 9.3 s |
| 18 | end | close | 24 | 11.0 s |
| | **total** | | **437** | **200.8 s** |

437 words over 18 shots at `words / 2.3 + 0.6 s` = 200.8 s of speech. Interaction adds
about 36 s, so the film runs near 3:56.
