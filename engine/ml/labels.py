"""Labels for the corroboration experiment, from evidence outside the detector.

Positive class: a region that demonstrably hosts large datacenter / flat-load
capacity, taken from `claims/lookup/facilities.csv`. Every row there was mapped
from a named serving utility or a public filing to a balancing authority (and,
where public sources allowed, a subregion). The file was built by hand from
company disclosures, SEC filings and press, and at no point consults the L3
detector, its score, or its ranking. That is what makes it usable as a label.

Negative class: every scored region with no mapped facility.

KNOWN NOISE IN THE LABELS -- all of it stated, none of it fixable here:

1.  Absence of a mapped site is absence of COVERAGE, not absence of a
    datacenter. The negative class is contaminated with true positives we
    simply never sourced. Contaminated negatives depress measured precision
    and recall, so any score reported here is a LOWER bound.

2.  Eleven sites are wholly or mostly behind the meter. EIA-930 reports
    interchange and net generation at the BA boundary; load served by an
    on-site microgrid never crosses that boundary and is invisible to the
    data by construction. `BEHIND_THE_METER` lists them. The experiment is
    run both with and without them.

3.  A facility whose public sourcing only established the BA (zone blank) is
    labelled at BA level. The zones of that BA then sit in the negative class
    even though one of them almost certainly contains the site. This is the
    single largest contamination channel in ERCO and MISO.

4.  Coverage is not size-neutral. Big, prominent, heavily reported regions are
    far more likely to have a sourced facility than small ones. `experiment.py`
    measures this confound explicitly rather than assuming it away.

5.  Two labelled sites are explicitly NOT flat load (MARA Kearney is
    interruptible; the Keel/Stronghold Pennsylvania sites are offered into PJM
    as demand response). They stay in the positive class -- removing them
    would be tuning the labels to the hypothesis.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

# The eleven behind-the-meter sites, enumerated in
# claims/lookup/EXPANSION_NOTES.md ("Behind-the-meter is a structural blind
# spot"). Matched on (company prefix, metro prefix) so the list is auditable
# against that prose rather than re-derived by a regex over free text.
BEHIND_THE_METER: list[tuple[str, str]] = [
    ("Oracle", "Shackelford County"),
    ("Oracle", "Santa Teresa"),
    ("Stronghold Digital", "Nesquehoning"),
    ("Stronghold Digital", "Venango County"),
    ("Vulcan Infrastructure and Power", "Torrey / Dresden"),
    ("Soluna", "Briscoe County"),
    ("Nebius", "Vineland"),
    ("Crusoe Energy", "Laramie County"),
    ("xAI", "Southaven"),
    ("Fermi America", "Amarillo"),
    ("Poolside", "Pecos County"),
]


def load_facilities(repo_root: Path) -> pd.DataFrame:
    """Read facilities.csv and attach `region` (zone if known, else BA) and `btm`."""
    f = pd.read_csv(repo_root / "claims" / "lookup" / "facilities.csv")
    # `zone` in this file is already the compound region id ("PJM/DOM"), matching
    # the detector's `ba + "/" + subregion` convention. Blank zone => BA-level row.
    f["region"] = f["zone"].fillna(f["ba"])
    btm = pd.Series(False, index=f.index)
    for company, metro in BEHIND_THE_METER:
        hit = f["company"].str.startswith(company) & f["metro"].str.startswith(metro)
        if hit.sum() != 1:
            raise ValueError(
                f"behind-the-meter entry ({company!r}, {metro!r}) matched {hit.sum()} rows; "
                "facilities.csv changed and the list must be re-checked by hand"
            )
        btm |= hit
    f["btm"] = btm
    return f


def build_labels(
    regions: pd.Index | list[str],
    repo_root: Path,
    *,
    exclude_btm: bool = False,
    propagate_to_ba: bool = True,
) -> pd.DataFrame:
    """One row per scored region: `y`, `n_sites`, `n_operators`.

    propagate_to_ba
        A facility sited in PJM/DOM is physically inside PJM, so by default a
        zone-level facility also marks its parent BA positive. Set False to
        label only the exact region string the source established; the
        experiment reports both.
    exclude_btm
        Drop the eleven behind-the-meter sites from the positive class. Their
        load is invisible to EIA-930 by construction, so they are labels the
        features cannot possibly satisfy.
    """
    f = load_facilities(repo_root)
    if exclude_btm:
        f = f[~f.btm]

    rows = f[["region", "ba", "company"]].copy()
    rows["site_id"] = f.index                 # identity is the facility, not the name:
    if propagate_to_ba:                       # two Oracle sites are two sites
        parents = rows.assign(region=rows["ba"])
        rows = (pd.concat([rows, parents], ignore_index=True)
                  .drop_duplicates(subset=["region", "site_id"]))

    regions = pd.Index(regions, name="region")
    grp = rows.groupby("region")
    out = pd.DataFrame(index=regions)
    out["n_sites"] = grp.size().reindex(regions).fillna(0).astype(int)
    out["n_operators"] = grp["company"].nunique().reindex(regions).fillna(0).astype(int)
    out["y"] = (out["n_sites"] > 0).astype(int)
    return out.reset_index()
