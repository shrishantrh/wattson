import pandas as pd, glob
CLEAN = {"nuclear","hydro","hydro_excluding_pumped_storage","wind",
         "wind_wo_integrated_battery_storage","solar",
         "solar_wo_integrated_battery_storage","geothermal"}
STORAGE = {"battery_storage","pumped_storage"}
f = (glob.glob('data/pudl/**/*net_generation_by_energy_source*.parquet', recursive=True)
     or glob.glob('../wattson-mgr/data/pudl/**/*net_generation_by_energy_source*.parquet', recursive=True))[0]

d = pd.read_parquet(f, filters=[("balancing_authority_code_eia","==","PJM")])
d = d[~d.generation_energy_source.isin(STORAGE)]
d["local"] = d.datetime_utc - pd.Timedelta(hours=5)          # PJM is US/Eastern
d["year"], d["hour"] = d.local.dt.year, d.local.dt.hour
night = d[d.hour.between(0,5)]                                # midnight to 5:59am

for y in (2019, 2025):
    n = night[night.year == y]
    hours = n.local.nunique()
    total = n.net_generation_adjusted_mwh.sum() / hours
    clean = n[n.generation_energy_source.isin(CLEAN)].net_generation_adjusted_mwh.sum() / hours
    print(f"  {y} overnight:  clean {clean:>9,.0f} MW   of total {total:>9,.0f} MW   = {clean/total:.1%}")
