# Evidence folder

One file per question you are likely to be challenged on. Every number in here was
generated from the shipped data, not typed from memory. Open the file, show the quote,
give the citation.

| If they ask | Open |
|---|---|
| "Do these companies really claim 100% renewable?" | [01-what-companies-actually-say.md](01-what-companies-actually-say.md) |
| "What exactly did you find in PJM?" | [02-pjm-overnight.md](02-pjm-overnight.md) |
| "Where does the day-vs-night number come from?" | [03-day-vs-night.md](03-day-vs-night.md) |
| "How do you know your data is right?" | [04-arizona-error.md](04-arizona-error.md) |
| "Isn't this just hotter summers?" | [05-weather.md](05-weather.md) |
| "Did you tune the method after seeing results?" | [06-detector-and-tuning.md](06-detector-and-tuning.md) |
| "How is a walk score calculated?" | [07-google-sites.md](07-google-sites.md) |
| "What are the limits?" | [08-limits.md](08-limits.md) |
| *(pointing at the Data tab live)* | [09-columns-to-point-at.md](09-columns-to-point-at.md) |

## The three that matter most

**01** is the one that will catch you out. None of these companies says "100% renewable."
They say they *matched* their *annual* consumption with *purchases*. Quote them exactly.

**06** is the credibility file. Git proves the method was fixed before any result was seen,
and it proves it in two commands a judge can run in front of you.

**08** is what makes the rest believable. Say the limits before you are asked.

## Regenerating

`01`, `02`, `03`, `07` are generated from `server/static_export/`. `04`, `05`, `06` are
generated from `claims/derived/corrections.json`, `engine/weather/results/` and
`engine/stats/results/`. If a number on the site changes, regenerate rather than editing
by hand.
