"""Guard the plant-level facts the AZPS correction now rests on.

These are assertions about EIA-860 itself, so they need the PUDL parquet on
disk and skip cleanly without it. They exist so that a later PUDL release that
moves Palo Verde, changes an ownership share or renames a column fails here
rather than silently weakening a published claim.
"""

import pytest

from engine.plants import eia860, palo_verde

pytestmark = pytest.mark.skipif(
    not eia860.path("core_eia860__scd_plants").exists(),
    reason="EIA-860 parquet not fetched; see scripts/vendor/pudl_fetch.py",
)

APS, SRP = 803, 16572


@pytest.fixture(scope="module")
def evidence():
    return palo_verde.run()


def test_palo_verde_is_plant_6008(evidence):
    assert evidence["plant_id_eia"] == 6008
    az = evidence["identify"]["arizona_matches"]
    assert len(az) == 1, "more than one Arizona plant matches the name"


def test_it_is_the_only_nuclear_station_in_arizona(evidence):
    nuc = evidence["alternatives"]["az_nuclear_plants_any_year"]
    assert [p["plant_id_eia"] for p in nuc] == [6008]


def test_aps_and_srp_both_own_it(evidence):
    own = evidence["ownership"]
    assert own["aps_and_srp_both_own"]
    assert own["fraction_sums_to_one"]
    assert own["aps_share"] == pytest.approx(0.2910)
    assert own["srp_share"] == pytest.approx(0.1749)


def test_eia860_puts_the_plant_in_the_srp_balancing_authority(evidence):
    ba = evidence["ba_attribution"]
    assert ba["code_in_base_year"] == "SRP"
    assert ba["distinct_codes_ever"] == ["SRP"], (
        "EIA-860 has never recorded Palo Verde under any other BA")
    assert evidence["alternatives"]["nuclear_plant_years_under_azps"] == 0


def test_eia860_cannot_date_the_correction(evidence):
    """The one clause EIA-860 does not reach. If this ever starts passing, the
    write-up's 'partially unavailable' caveat needs revisiting, not deleting."""
    assert evidence["ba_attribution"]["changed_around_step"] is False


def test_3937_is_net_summer_capacity_not_nameplate(evidence):
    cap = evidence["capacity"]
    assert cap["net_summer_capacity_mw"] == pytest.approx(3937.0)
    assert cap["nameplate_mw"] == pytest.approx(4209.6)
    assert not cap["published_figure_matches_nameplate"]
    assert cap["published_figure_matches_net_summer"]


@pytest.mark.skipif(
    not eia860.path(palo_verde.GEN930).exists(),
    reason="EIA-930 generation parquet not fetched",
)
def test_the_two_bas_together_reported_more_than_one_plant(evidence):
    x = evidence["eia930_cross_check"]
    assert x["combined_over_nameplate"] > 1.5
    assert x["peak_combined_hour_mw"] > evidence["capacity"]["nameplate_mw"]
    # and after the correction, one plant's worth
    assert x["after_over_nameplate"] < 1.0
    # each BA reported the whole plant, not its ownership share
    assert x["azps_mean_mw"] > 2 * x["aps_share_of_nameplate_mw"]


def test_verdict_is_reached_from_the_checks_not_asserted(evidence):
    v = evidence["verdict"]
    assert v["verdict"] in {"confirmed", "partially confirmed", "not confirmed"}
    assert v["verdict"] == ("confirmed" if not v["failed"] else v["verdict"])
    assert v["verdict"] == "confirmed"
