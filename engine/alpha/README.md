# Generating Alpha

One screen. For each featured detector region: the fuel that filled its
overnight growth, the serving utilities we verified, their parents and
tickers, and the commodity and event markets where that region's tightness is
priced.

```bash
source ~/hackmit-venv/bin/activate
python3 -m engine.alpha.kalshi      # refresh the cached event-market snapshot
python3 -m server --static-export   # bake /api/alpha into the export
```

Route `#/alpha`. Renders entirely from `server/static_export/alpha.json`, with
no server and no network.

## An input, not an answer

We have no validation that this signal predicts any price. No backtest, nothing
tested against a price series. The page says so in its own words at the top,
before the limits section, so it is not possible to read it and come away
thinking otherwise.

Every instrument row carries a one-sentence reason citing a number from our own
data. A test enforces that: a reason with no figure in it is an assertion, not
a link. A second test scans the whole payload for prediction language and fails
on it — scoped to exclude the two disclaimer blocks, which are the one place
those words belong, because a scan that cannot tell a denial from a claim would
push the disclaimer off the page.

## The wrong negative we nearly published

The first Kalshi pass pulled **12,000 open markets** and found essentially
nothing relevant. The obvious conclusion was "their markets do not cover this."

That conclusion would have been wrong, and the sample was the problem: the
markets endpoint returned a sports-dominated slice. Querying Kalshi's **series**
list instead — 14,169 series with categories including Commodities, Climate and
Weather, and AI — found **12 series matching our findings, 10 with open
contracts**: ERCOT peak load, Henry Hub daily and monthly, Marcellus
production, US retail electricity price, datacenter construction spending, the
number of US datacenters, federal datacenter power-cost standards, Illinois
nuclear generation, and Talen Energy generation.

**A wrong negative reported with confidence is worse than a wrong positive,
because nobody checks a null result.** "We looked and there was nothing there"
invites no follow-up. The fix was not more data, it was asking whether the
sample could answer the question.

## The honest negative that stayed

`KXUTILITYPJMWEST` — PJM West electricity prices — is the single most on-point
market for our headline finding, and it has **zero open contracts**. So does
`KXERCOTX`, Texas renewable share.

Both are on the page, above the instrument rows rather than below them. A
market that exists and is not being traded is information about liquidity, and
it is the one fact on this page nobody could accuse us of selecting.

## Prices are cached and dated

The Kalshi snapshot is pulled at build time into `kalshi_cache.json` and baked
into the static export. It is never fetched from the browser. The as-of
timestamp appears on screen beside the prices, not only in the provenance
footer: a price with no date reads as current whenever the demo happens to run.

Kalshi's read API needs no auth, so **no secret exists in this feature at any
layer**. The only environment variables the client reads are `BASE_URL` and
`VITE_API_BASE`, which is a URL and not a secret.

## Two bugs found by reading the rendered page

Neither was caught by a test. Both were caught by looking at the screen.

**It rendered "AEP Texas North"** — a company that merged into AEP Texas Inc.
in 2016. We had already established that and recorded the correction in
`operators_verified.json`; the builder was reading the stale `utility` field
and walking straight past our own fix. A defunct company on a public page is
exactly what that verification work existed to prevent.

**Zone fuel figures are the parent BA's.** Zones report demand only and inherit
their parent's generation, so ERCO/NRTH displayed ERCO's +6.62 GW of gas as
though it were that zone's own mix. Now labelled inline rather than footnoted,
because a caveat below the number does not travel with the number.

## A security check that could not fail

The first scan for leaked keys in built assets printed **SECRET FOUND** when
there was no secret. The check was `grep -rIl ... | head`, and a pipeline
returns the exit status of its last command, so `head` made it exit 0 whether
or not grep matched anything.

A security check that cannot fail is worse than no security check: it
manufactures confidence in both directions, and the direction it fails in is
the one you notice least. The replacement counts matches directly. Current
result: **0 key-pattern matches across `web/dist`.**
