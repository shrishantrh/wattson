"""Neocloud and converted-bitcoin-miner sites, mapped serving-utility outward.

Every row was established from the operator's own disclosure, an SEC filing or
reporting that names the interconnection. None was mapped from the state: Texas
is not a balancing authority, and the two entries below prove it in opposite
directions.

`zone` is left empty on every row, matching the existing facility lookup.
ERCOT weather zones are geographic, and assigning one from a county would be
exactly the state-level inference this table exists to avoid.
"""
from __future__ import annotations

SITES = [
    {
        "company": "IREN", "ticker": "IREN",
        "metro": "Childress", "state": "TX",
        "serving_utility": "AEP Texas",
        "ba": "ERCO", "zone": "",
        "ba_basis": ("Direct 345 kV interconnection to ERCOT via on-site "
                     "substations, under an amended connection agreement with "
                     "AEP; expansion approved by ERCOT."),
        "source_type": "company_disclosure",
        "source_url": "https://iren.com/data-centers/childress",
        "note": ("TRAP, AND OUR OWN SPEC FLAGGED IT: naive geography gives "
                 "SWPP. Childress County sits in the Texas Panhandle where the "
                 "ERCOT/SPP boundary is irregular, and most of the Panhandle "
                 "IS SPP. This site is not: it interconnects directly to "
                 "ERCOT. 750 MW, converting from bitcoin to AI (Horizon 1)."),
        "unresolved_reason": "",
    },
    {
        "company": "TeraWulf / Fluidstack JV", "ticker": "WULF",
        "metro": "Abernathy", "state": "TX",
        "serving_utility": "Southwestern Public Service Company (Xcel Energy)",
        "ba": "SWPP", "zone": "",
        "ba_basis": ("Sited in Xcel Energy / Southwestern Public Service "
                     "territory near Lubbock; SPS is an SPP member, not ERCOT."),
        "source_type": "press",
        "source_url": ("https://www.datacenterdynamics.com/en/news/terawulf-"
                       "and-fluidstack-to-develop-texas-data-center-in-google-"
                       "backed-deal/"),
        "note": ("TRAP IN THE OPPOSITE DIRECTION TO CHILDRESS: a Texas site "
                 "that is NOT ERCOT. Served by Xcel/SPS, which is SPP. A "
                 "Texas-implies-ERCOT mapping gets this wrong, and the two "
                 "traps sit about 120 miles apart. 168 MW IT (240 MW gross), "
                 "TeraWulf 51%."),
        "unresolved_reason": "",
    },
    {
        "company": "Riot Platforms", "ticker": "RIOT",
        "metro": "Rockdale", "state": "TX",
        "serving_utility": "Oncor Electric Delivery",
        "ba": "ERCO", "zone": "",
        "ba_basis": ("Riot's own 10-Q describes an agreement with Oncor to "
                     "extend transmission/substation facilities to the "
                     "Rockdale facility, and ERCOT curtailment instructions "
                     "reaching it through Oncor."),
        "source_type": "sec_filing",
        "source_url": ("https://www.sec.gov/Archives/edgar/data/1167419/"
                       "000155837023009137/riot-20230331x10q.htm"),
        "note": ("DEMAND RESPONSE: Riot curtailed more than 95% of load during "
                 "the August 2023 ERCOT peak and books Power and Demand "
                 "Response Credits. Its load is not purely flat. See the "
                 "curtailment check for what that does to our detector."),
        "unresolved_reason": "",
    },
    {
        "company": "Riot Platforms", "ticker": "RIOT",
        "metro": "Corsicana", "state": "TX",
        "serving_utility": "Oncor Electric Delivery",
        "ba": "ERCO", "zone": "",
        "ba_basis": ("Sited in ERCOT with direct access to 1 GW of "
                     "high-voltage capacity; ERCOT and Oncor issue curtailment "
                     "instructions to the facility."),
        "source_type": "company_disclosure",
        "source_url": "https://www.riotplatforms.com/locations/corsicana/",
        "note": "Navarro County. Same demand-response caveat as Rockdale.",
        "unresolved_reason": "",
    },
    {
        "company": "Cipher Digital (Cipher Mining)", "ticker": "CIFR",
        "metro": "Wink (Winkler County)", "state": "TX",
        "serving_utility": "",
        "ba": "ERCO", "zone": "",
        "ba_basis": "ERCOT-approved interconnection up to 300 MW at the site.",
        "source_type": "press",
        "source_url": ("https://www.datacenterdynamics.com/en/news/cipher-"
                       "mining-to-develop-300mw-cryptomining-data-center-site-"
                       "in-west-texas/"),
        "note": ("'Black Pearl'. Winkler County is the Permian Basin, the same "
                 "footprint our detector ranks 2nd (ERCO/FWES, +116% overnight "
                 "demand growth). Bitcoin is being wound down to redirect power "
                 "to AI tenants: the load stays, the purpose changes."),
        "unresolved_reason": ("The ERCOT interconnection is documented; the TDU "
                              "serving the site is not named in any source I "
                              "could find. Recorded blank rather than guessed "
                              "between Oncor and TNMP."),
    },
    {
        "company": "TeraWulf", "ticker": "WULF",
        "metro": "Barker (Lake Mariner)", "state": "NY",
        "serving_utility": "NYSEG and New York Power Authority",
        "ba": "NYIS", "zone": "",
        "ba_basis": ("Operates in the NYISO market, NYISO Zone A; power "
                     "allocated from NYPA and NYSEG."),
        "source_type": "company_disclosure",
        "source_url": "https://www.terawulf.com/our-sites",
        "note": ("Built on the retired 700 MW Somerset coal plant site. NYISO "
                 "Zone A is Niagara hydro-heavy, so this is a converted miner "
                 "on unusually clean supply - the opposite of the West Texas "
                 "story and worth showing next to it."),
        "unresolved_reason": "",
    },
    {
        "company": "Applied Digital", "ticker": "APLD",
        "metro": "Ellendale", "state": "ND",
        "serving_utility": "",
        "ba": "MISO", "zone": "",
        "ba_basis": ("Applied Digital describes its North Dakota campuses as "
                     "being in the MISO footprint."),
        "source_type": "press",
        "source_url": ("https://www.datacenterdynamics.com/en/news/applied-"
                       "digital-signs-250mw-agreement-with-coreweave-for-"
                       "capacity-at-ellendale-campus-north-dakota/"),
        "note": ("'Polaris Forge 1', 400 MW when complete. North Dakota is "
                 "split between MISO and SWPP, so the state does not settle "
                 "this; the MISO attribution is the operator's own."),
        "unresolved_reason": ("Dickey County's serving utility is not named in "
                              "any source I could find. Not guessed."),
    },
    {
        "company": "CoreWeave", "ticker": "CRWV",
        "metro": "Ellendale (leased from Applied Digital)", "state": "ND",
        "serving_utility": "",
        "ba": "MISO", "zone": "",
        "ba_basis": "Tenant at the Applied Digital Ellendale campus; same grid.",
        "source_type": "company_disclosure",
        "source_url": ("https://ir.applieddigital.com/news-events/press-releases/"
                       "detail/123/applied-digital-announces-250mw-ai-data-"
                       "center-lease-with"),
        "note": ("CoreWeave leases the full 400 MW campus under a ~15-year "
                 "agreement. It owns no grid connection here: the load appears "
                 "as Applied Digital's. A company-level view would miss this "
                 "entirely, which is the argument for mapping sites rather "
                 "than companies."),
        "unresolved_reason": ("Serving utility unresolved for the same reason "
                              "as the Applied Digital row: it is the same site."),
    },
]

#: Named in the brief but NOT included, because coverage without a source is
#: the thing this table is supposed to prevent.
NOT_ESTABLISHED = [
    {"company": "Nebius", "ticker": "NBIS",
     "reason": ("3.5 GW contracted is a company-level figure. I could not tie "
                "a specific US site to a serving utility from public sources.")},
    {"company": "Core Scientific", "ticker": "CORZ",
     "reason": "No individual site researched to a named serving utility."},
    {"company": "IREN", "ticker": "IREN",
     "reason": ("Sweetwater TX and the Oklahoma sites are named in the brief "
                "but only Childress was verified to an interconnection.")},
]
