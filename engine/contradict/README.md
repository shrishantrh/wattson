# engine/contradict

Finds places where a company's headline clean-energy claim is qualified, scoped
or undercut **inside the same document**. Deterministic: regex over the ingested
chunks. No LLM, no network, no API key.

```bash
source ~/hackmit-venv/bin/activate
python3 -m engine.contradict        # writes claims/derived/contradictions.json
```

## The thesis this feature exists to show

Three of the four companies claim they **matched 100% of their electricity on an
annual basis**. Google additionally targets **24/7 carbon-free energy**, hour by
hour. Annual matching is an accounting result: buy as many clean megawatt-hours
over a year as you consumed, anywhere on the system. It says nothing about
whether the load was served by clean power at 3am in a particular balancing
authority — which is exactly what Wattson's hourly index measures.

So the interesting finding is rarely "the company lied". It is that the claim is
**weaker than it sounds**, and the company usually says so itself, in the same
report, often on the same page.

## What it emits

`claims/derived/contradictions.json`, keyed by ticker. Each finding carries the
claim, the counterpoint where there is one, **both page numbers**, and a
`verification` block. Kinds:

| kind | meaning |
|---|---|
| `annual_scope` | the claim is explicitly annual, not hourly |
| `certificate_based` | the claim is met with certificates/RECs/EACs |
| `hourly_claim` | a 24/7 or hourly claim: stronger, and falsifiable by our index |
| `claim_vs_emissions_growth` | a matching claim alongside disclosed rising emissions |
| `claim_vs_demand_growth` | a matching claim alongside disclosed rising electricity demand |

## Precision over recall, and what that cost

A false contradiction accuses a named public company on stage. Every rule below
exists because it caught a real false positive in this corpus:

- **Same sentence, never same page.** Meta page 18 states the 100% claim and,
  separately, applies EACs *to Scope 3*. Different subjects. Pairing them on page
  co-occurrence manufactures a contradiction. Character distance is no help
  either — column extraction interleaves text, so "nearby" is meaningless.
- **An exclusion is not a hedge.** Microsoft page 64 says its target "does not
  include" spot-market RECs, and page 6 says it is *pausing* use of unbundled
  certificates. Both are Microsoft adopting a **stricter** standard. Reporting
  them as hedges inverts the company's meaning.
- **A mention is not an assertion.** Google's contents page, an endnote citing
  Princeton and TU Berlin, and a methodology definition all contain "24/7". That
  is the document saying it, not Google claiming it. Contents pages, citations
  and over-long strings are filtered out; a claim must be first-person.
- **A volume is not a match.** Amazon's "131,000 GWh of carbon-free energy
  production annually" is a quantity, not a 100% claim.

Unfiltered, Google alone produced 30 hits. Six findings survive across four
companies. That is the intended ratio.

## Gaps, named rather than hidden

- **Amazon: 0 findings.** Its 100%-matched claim sits in an infographic on page 5
  and extracts as "100% matched 100% matched 100% matched", not a sentence. The
  claim is real; our text pipeline cannot quote it verbatim, so it is not
  reported. Recorded as `gap` on the AMZN record.
- **Location-based vs market-based Scope 2 is not implemented.** It is the
  strongest possible test — market-based near zero while location-based is large
  — but both figures live in tables whose column order text extraction does not
  reliably preserve. A market-based number misread as location-based would
  fabricate a contradiction. Each record carries `scope2_extraction` saying why
  it was not attempted for that company.
- Footnote superscripts survive in quotes as ordinary digits ("carbon-free
  energy2"), because they are genuinely printed on the page.

## Verification

Every finding carries `verification.human_reread_rendered_page`. All six were
checked by a human re-reading the **rendered PDF page** — a different instrument
from the text extractor that produced the quote. Nothing reaches the UI on regex
alone.

## Cross-document: ESG report vs 10-K

The strongest findings compare the sustainability report against the 10-K —
a marketing document against one filed under legal liability.

| | |
|---|---|
| MSFT ESG p6 | "In FY25, we matched 100% of our annual global electricity consumption with renewable energy." |
| MSFT 10-K Item 1A | "AI development and deployment has and will likely continue to raise energy use and emissions, making it harder to meet these goals." |
| GOOGL ESG p4 | "Despite this, we again matched 100% of our electricity consumption with renewable energy purchases (on a global and annual basis)" |
| GOOGL 10-K Item 1A | "For instance, AI's energy and water demands have made efforts to reduce our emissions more complex and challenging across every level." |

Both 10-K quotes are verbatim in the filing; re-check with
`python3 -m engine.contradict.verify_tenk`.

What does **not** count: every 10-K carries generic climate boilerplate, and
Amazon's Item 1A lists transition risks (compliance costs, customer behaviour,
reputational damage). Neither is a company conceding its own footprint is
growing. Meta's single climate sentence in Item 1A is about natural disasters.
Both are excluded by test.

**A false negative is also a failure.** A general-purpose page fetcher was the
first independent check on the Microsoft quote and reported it absent — the
filing is 8.6 MB and the fetcher truncated it. The sentence is present, exactly
once. Going to the primary source settled it. Dropping a true finding on a
tool's say-so would have been the mirror image of shipping a false one.
