"""Verification of the hand-mapped operator table.

scripts/operators_manual.json is hand-mapped, unverified, and already renders
next to every region. Each distinct (utility, ticker) row is checked on three
separable questions, which fail differently:

  1. ticker_and_exchange        the symbol exists and is the right listing
  2. ticker_belongs_to_parent   it is the parent we name, not a near-name
  3. parent_owns_utility_today  that parent still owns this utility NOW

Findings below were researched 2026-09-19 against company IR pages and SEC
filings. Ticker-lookup sites were not accepted as evidence for check 3.

This module READS scripts/operators_manual.json and never writes to it:
scripts/ is frozen and the file belongs to someone else.
"""
from __future__ import annotations

import collections
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
MANUAL_PATH = REPO_ROOT / "scripts" / "operators_manual.json"
OUTPUT_PATH = REPO_ROOT / "claims" / "derived" / "operators_verified.json"

VERIFIED_ON = "2026-09-19"

SEC_AEP_SUBSIDIARIES = (
    "https://www.sec.gov/Archives/edgar/data/4904/000000490426000013/ex2120254q.htm"
)

#: Keyed by the utility name exactly as the manual table spells it.
FINDINGS = {
    "AEP Texas North": {
        "status": "corrected",
        "exchange": "Nasdaq Global Select",
        "checks": {"ticker_and_exchange": "pass",
                   "ticker_belongs_to_parent": "pass",
                   "parent_owns_utility_today": "fail"},
        "correction": {
            "field": "utility",
            "old": "AEP Texas North",
            "new": "AEP Texas",
            "source_url": SEC_AEP_SUBSIDIARIES,
            "reason": (
                "AEP Texas North Company ceased to exist: it merged with AEP "
                "Texas Central Company into AEP Texas Inc., effective "
                "2016-12-31. AEP's Exhibit 21 subsidiary list as of "
                "2025-12-31 contains 'AEP Texas Inc.' and no 'AEP Texas North "
                "Company' (only 'AEP Texas North Generation Company LLC', a "
                "different entity). The ticker AEP and the parent are correct; "
                "only the utility name is stale, by about ten years."
            ),
        },
        "source_url": SEC_AEP_SUBSIDIARIES,
        "notes": (
            "'AEP Texas North' does survive informally as the AEP North TDU "
            "service-territory / rate-zone label, so it is not nonsense as a "
            "zone name. It is wrong as the name of a utility company."
        ),
    },
    "AEP Texas": {
        "status": "verified", "exchange": "Nasdaq Global Select",
        "checks": {"ticker_and_exchange": "pass",
                   "ticker_belongs_to_parent": "pass",
                   "parent_owns_utility_today": "pass"},
        "source_url": SEC_AEP_SUBSIDIARIES,
        "notes": ("'AEP Texas Inc.' appears in AEP's Exhibit 21 as of "
                  "2025-12-31. AEP trades on Nasdaq, not the NYSE: it moved "
                  "its listing on 2020-10-01."),
    },
    "AEP Ohio, Appalachian Power, Indiana Michigan Power, Kentucky Power": {
        "status": "verified", "exchange": "Nasdaq Global Select",
        "checks": {"ticker_and_exchange": "pass",
                   "ticker_belongs_to_parent": "pass",
                   "parent_owns_utility_today": "pass"},
        "source_url": SEC_AEP_SUBSIDIARIES,
        "notes": ("All four appear in AEP's Exhibit 21 as of 2025-12-31, under "
                  "legal names Ohio Power Company (d/b/a AEP Ohio), Appalachian "
                  "Power Company, Indiana Michigan Power Company and Kentucky "
                  "Power Company. Kentucky Power is still AEP-owned: the 2021 "
                  "sale to Liberty/Algonquin was terminated."),
    },
    "Black Hills Colorado Electric / Cheyenne Light": {
        "status": "verified", "exchange": "NYSE",
        "checks": {"ticker_and_exchange": "pass",
                   "ticker_belongs_to_parent": "pass",
                   "parent_owns_utility_today": "pass"},
        "source_url": ("https://ir.blackhillscorp.com/news-releases/"
                       "news-release-details/black-hills-corp-and-"
                       "northwestern-energy-shareholders-approve"),
        "pending_change": (
            "BKH is merging with NorthWestern Energy in an all-stock merger of "
            "equals announced 2025-08-18. Shareholders of both approved it on "
            "2026-04-02; it had not closed as of this check. On close the "
            "parent is renamed Bright Horizon Energy, Inc. and adopts a NEW "
            "ticker, so BKH will stop being correct. Expected close was second "
            "half of 2026, i.e. now. Re-check before any public use."
        ),
    },
    "Constellation Energy": {
        "status": "verified", "exchange": "Nasdaq",
        "checks": {"ticker_and_exchange": "pass",
                   "ticker_belongs_to_parent": "pass",
                   "parent_owns_utility_today": "pass"},
        "source_url": ("https://investors.constellationenergy.com/news-releases/"
                       "news-release-details/constellation-completes-calpine-"
                       "transaction-powering-americas"),
        "notes": ("Constellation completed its acquisition of Calpine on "
                  "2026-01-07; Calpine LLC is now an indirect wholly owned "
                  "subsidiary. This enlarges CEG's ERCOT and PJM generation "
                  "footprint relative to what the hand-mapped table assumed."),
    },
    "CenterPoint Energy Houston Electric": {
        "status": "verified", "exchange": "NYSE",
        "checks": {"ticker_and_exchange": "pass",
                   "ticker_belongs_to_parent": "pass",
                   "parent_owns_utility_today": "pass"},
        "source_url": ("https://www.businesswire.com/news/home/20260422904150/en/"
                       "CenterPoint-Energy-reports-strong-Q1-2026-results-"
                       "reiterates-full-year-2026-guidance-provides-an-update-"
                       "on-Houston-Electric-load-growth"),
    },
    "Virginia Electric and Power (Dominion Energy Virginia)": {
        "status": "verified", "exchange": "NYSE",
        "checks": {"ticker_and_exchange": "pass",
                   "ticker_belongs_to_parent": "pass",
                   "parent_owns_utility_today": "pass"},
        "source_url": "https://investors.dominionenergy.com/home/default.aspx",
        "notes": ("Virginia Electric and Power Company does business as "
                  "Dominion Energy Virginia and is a subsidiary of Dominion "
                  "Energy, Inc. Both spellings in the manual table name the "
                  "same entity and both are correct."),
    },
    "Dominion Energy Virginia": {
        "status": "verified", "exchange": "NYSE",
        "checks": {"ticker_and_exchange": "pass",
                   "ticker_belongs_to_parent": "pass",
                   "parent_owns_utility_today": "pass"},
        "source_url": "https://investors.dominionenergy.com/home/default.aspx",
    },
    "Tucson Electric Power": {
        "status": "verified", "exchange": "NYSE and TSX (dual-listed)",
        "checks": {"ticker_and_exchange": "pass",
                   "ticker_belongs_to_parent": "pass",
                   "parent_owns_utility_today": "pass"},
        "source_url": "https://www.fortisinc.com/company/our-companies/index",
        "notes": ("CLAUDE.md flagged FTS as doubtful. It is correct. Fortis "
                  "Inc. lists UNS Energy among its operating companies and "
                  "describes it as the parent of Tucson Electric Power. Fortis "
                  "is dual-listed on the TSX and NYSE under FTS, so FTS is the "
                  "right symbol for a US-facing table."),
    },
    "NRG Energy": {
        "status": "verified", "exchange": "NYSE",
        "checks": {"ticker_and_exchange": "pass",
                   "ticker_belongs_to_parent": "pass",
                   "parent_owns_utility_today": "pass"},
        "source_url": "https://www.nrg.com/investors/overview.html",
        "notes": "Parent and operating company are the same entity.",
    },
    "Arizona Public Service": {
        "status": "verified", "exchange": "NYSE",
        "checks": {"ticker_and_exchange": "pass",
                   "ticker_belongs_to_parent": "pass",
                   "parent_owns_utility_today": "pass"},
        "source_url": ("https://www.sec.gov/Archives/edgar/data/0000764622/"
                       "000076462226000041/pnw-20260630.htm"),
        "notes": ("Arizona Public Service is the principal subsidiary of "
                  "Pinnacle West Capital Corporation."),
    },
    "Oncor Electric Delivery": {
        "status": "verified", "exchange": "NYSE",
        "checks": {"ticker_and_exchange": "pass",
                   "ticker_belongs_to_parent": "pass",
                   "parent_owns_utility_today": "pass"},
        "source_url": ("https://www.sempra.com/sempra-energy-completes-"
                       "acquisition-majority-stake-oncor"),
        "notes": ("Sempra holds an 80.25% indirect stake in Oncor, not full "
                  "ownership; the remainder is held by Texas Transmission "
                  "Investment LLC. 'Parent: Sempra' is fair for a "
                  "who-serves-the-load table but is a majority stake, not "
                  "outright ownership. The parent renamed itself from Sempra "
                  "Energy to Sempra in 2023."),
    },
    "San Diego Gas & Electric": {
        "status": "verified", "exchange": "NYSE",
        "checks": {"ticker_and_exchange": "pass",
                   "ticker_belongs_to_parent": "pass",
                   "parent_owns_utility_today": "pass"},
        "source_url": "https://www.sempra.com/our-family-companies",
    },
    "Talen Energy": {
        "status": "verified", "exchange": "Nasdaq Global Select",
        "checks": {"ticker_and_exchange": "pass",
                   "ticker_belongs_to_parent": "pass",
                   "parent_owns_utility_today": "pass"},
        "source_url": "https://www.nasdaq.com/market-activity/stocks/tln",
        "notes": ("Talen relisted on Nasdaq on 2024-07-10 under TLN and was "
                  "trading as of 2026-09-14. Parent and operating company are "
                  "the same entity."),
    },
    "Texas-New Mexico Power": {
        "status": "verified", "exchange": "NYSE",
        "checks": {"ticker_and_exchange": "pass",
                   "ticker_belongs_to_parent": "pass",
                   "parent_owns_utility_today": "pass"},
        "source_url": ("https://www.sec.gov/Archives/edgar/data/0001108426/"
                       "000110842626000048/pnm-20260630.htm"),
        "pending_change": (
            "TXNM is being acquired by Blackstone Infrastructure at $61.25/share. "
            "Shareholders approved on 2025-08-28; PUCT and FERC approved in "
            "February 2026; the New Mexico PRC and NRC approvals were still "
            "outstanding at this check, and the termination date was extended "
            "to 2027-05-31 with closing now expected in the first half of 2027. "
            "On close the shares are delisted from the NYSE and TXNM stops "
            "being a valid ticker. Correct today; re-check before publication."
        ),
        "notes": ("CLAUDE.md flagged TXNM as doubtful. It is correct. TXNM "
                  "Energy's own Form 10-Q cover page for the quarter ended "
                  "2026-06-30 gives 'Common Stock, no par value', symbol "
                  "'TXNM', 'New York Stock Exchange', and states that TNMP's "
                  "shares are all held indirectly by TXNM as of 2026-07-24. "
                  "The parent was renamed from PNM Resources to TXNM Energy "
                  "in 2024, which is the likely source of the doubt."),
    },
    "Vistra": {
        "status": "verified", "exchange": "NYSE",
        "checks": {"ticker_and_exchange": "pass",
                   "ticker_belongs_to_parent": "pass",
                   "parent_owns_utility_today": "pass"},
        "source_url": "https://investor.vistracorp.com/",
        "notes": "Parent and operating company are the same entity.",
    },
    # --- no listed parent: public power, cooperatives, federal marketers ---
    "Western Area Power Administration, Rocky Mountain Region": {
        "status": "verified", "exchange": None,
        "checks": {"ticker_and_exchange": "n/a",
                   "ticker_belongs_to_parent": "n/a",
                   "parent_owns_utility_today": "pass"},
        "source_url": "https://www.wapa.gov/project/rocky-mountain-region/",
        "notes": ("A power marketing administration of the US Department of "
                  "Energy. Federal; no ticker exists to be wrong."),
    },
    "Tri-State Generation and Transmission": {
        "status": "verified", "exchange": None,
        "checks": {"ticker_and_exchange": "n/a",
                   "ticker_belongs_to_parent": "n/a",
                   "parent_owns_utility_today": "pass"},
        "source_url": "https://tristate.coop/about-us",
        "notes": "Not-for-profit member-owned generation and transmission cooperative.",
    },
    "Colorado Springs Utilities": {
        "status": "verified", "exchange": None,
        "checks": {"ticker_and_exchange": "n/a",
                   "ticker_belongs_to_parent": "n/a",
                   "parent_owns_utility_today": "pass"},
        "source_url": "https://www.csu.org/about/our-history",
        "notes": ("Community-owned four-service municipal utility; the city "
                  "took ownership in 1925."),
    },
    "Northern Virginia Electric Cooperative (NOVEC)": {
        "status": "verified", "exchange": None,
        "checks": {"ticker_and_exchange": "n/a",
                   "ticker_belongs_to_parent": "n/a",
                   "parent_owns_utility_today": "pass"},
        "source_url": "https://www.novec.com/About_NOVEC/NOVEC-At-A-Glance.cfm",
        "notes": "Member-owned distribution cooperative, Virginia's largest.",
    },
    "Omaha Public Power District": {
        "status": "verified", "exchange": None,
        "checks": {"ticker_and_exchange": "n/a",
                   "ticker_belongs_to_parent": "n/a",
                   "parent_owns_utility_today": "pass"},
        "source_url": "https://oppd.com/",
        "notes": "Nebraska public power district; publicly owned, no shareholders.",
    },
    "Santee Cooper (South Carolina Public Service Authority)": {
        "status": "verified", "exchange": None,
        "checks": {"ticker_and_exchange": "n/a",
                   "ticker_belongs_to_parent": "n/a",
                   "parent_owns_utility_today": "pass"},
        "source_url": ("https://www.santeecooper.com/global-news/2026/"
                       "021926-Santee-Cooper-Board-Approves-$460-Million-Bond-Sale.aspx"),
        "notes": ("Still state-owned. Privatisation was proposed repeatedly and "
                  "did not happen; the legislature's overhaul did not include a "
                  "sale. Separately, a potential sale of its interest in the "
                  "unfinished V.C. Summer reactors to Brookfield is under "
                  "negotiation with a decision deadline in 2028 — that is an "
                  "asset sale, not a change of the utility's ownership."),
    },
    "Central Electric Power Cooperative": {
        "status": "verified", "exchange": None,
        "checks": {"ticker_and_exchange": "n/a",
                   "ticker_belongs_to_parent": "n/a",
                   "parent_owns_utility_today": "pass"},
        "source_url": "https://cepci.org/",
        "notes": ("South Carolina's generation and transmission cooperative, "
                  "supplying the state's 19 distribution cooperatives."),
    },
}


def load_manual() -> dict:
    with MANUAL_PATH.open() as fh:
        return json.load(fh)


def build() -> dict:
    manual = load_manual()

    rows = {}
    for region, entries in manual.items():
        if region.startswith("_"):
            continue
        for e in entries:
            key = (e["utility"], e.get("ticker"))
            row = rows.setdefault(key, {
                "utility": e["utility"],
                "parent": e.get("parent"),
                "ticker": e.get("ticker"),
                "role": e.get("role"),
                "regions": [],
            })
            row["regions"].append(region)

    operators = []
    for (utility, ticker), row in rows.items():
        finding = FINDINGS.get(utility)
        if finding is None:
            # Never silently pass an unresearched row.
            operators.append({**row, "status": "unverifiable", "exchange": None,
                              "checks": {"ticker_and_exchange": "n/a",
                                         "ticker_belongs_to_parent": "n/a",
                                         "parent_owns_utility_today": "n/a"},
                              "source_url": "",
                              "notes": "No verification was performed for this row."})
            continue
        entry = {**row,
                 "status": finding["status"],
                 "exchange": finding["exchange"],
                 "checks": finding["checks"],
                 "source_url": finding["source_url"]}
        for optional in ("correction", "pending_change", "notes"):
            if optional in finding:
                entry[optional] = finding[optional]
        operators.append(entry)

    operators.sort(key=lambda o: (o["status"] != "corrected",
                                  o["ticker"] or "zzz", o["utility"]))

    by_status = collections.Counter(o["status"] for o in operators)
    return {
        "generated": VERIFIED_ON,
        "source_table": "scripts/operators_manual.json",
        "source_table_is_read_only": True,
        "method": (
            "Each distinct (utility, ticker) row checked on three separable "
            "questions: the ticker exists on the exchange named; it belongs to "
            "the parent we name rather than a similarly-named entity; and that "
            "parent still owns this utility today. Company IR pages and SEC "
            "filings were used as evidence; ticker-lookup sites were not "
            "accepted for the ownership question."
        ),
        "summary": {
            "rows": len(operators),
            "by_status": dict(by_status),
            "with_ticker": sum(1 for o in operators if o["ticker"]),
            "without_ticker": sum(1 for o in operators if not o["ticker"]),
            "pending_change": sum(1 for o in operators if o.get("pending_change")),
        },
        "operators": operators,
    }


def write(result: dict) -> Path:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w") as fh:
        json.dump(result, fh, indent=2)
        fh.write("\n")
    return OUTPUT_PATH
