#!/usr/bin/env bash
# Wattson end-to-end reproducibility run on the Voloridge EC2 instance (spec Amendment 1).
# Run INSIDE tmux on the instance, from the repo root copied to ~/wattson:
#   tmux new -s repro
#   bash docs/ec2_repro.sh 2>&1 | tee docs/ec2_runtime.log
# Records per-step and total wall time, then checks the exported JSON against what is committed.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "host: $(hostname)  instance: $(curl -s --max-time 2 http://169.254.169.254/latest/meta-data/instance-type || echo unknown)  cpus: $(nproc)  mem: $(free -g | awk '/Mem/{print $2}') GiB"
echo "start: $(date -u +%FT%TZ)"
T0=$(date +%s)

if ! command -v python3 >/dev/null; then sudo dnf install -y python3-pip; fi
python3 -m venv ~/hackmit-venv 2>/dev/null || true
source ~/hackmit-venv/bin/activate
pip install -q boto3 pandas pyarrow numpy

step() { local name="$1"; shift; local s=$(date +%s); echo "== $name  ($(date -u +%T)Z)"; "$@"; local e=$(date +%s); echo "== $name done in $((e - s)) s"; echo "$name,$((e - s))" >> docs/ec2_runtime.csv; }
rm -f docs/ec2_runtime.csv
# Snapshot the committed exports so we can diff after the run.
mkdir -p /tmp/committed && cp dashboard/public/data/regions.json dashboard/public/data/alerts.json /tmp/committed/

step fetch python3 scripts/vendor/pudl_fetch.py --output-dir data/pudl \
  --table core_eia930__hourly_net_generation_by_energy_source \
  --table core_eia930__hourly_interchange \
  --table out_eia930__hourly_operations \
  --table out_eia930__hourly_subregion_demand \
  --table core_eia__codes_balancing_authorities \
  --table core_eia__codes_balancing_authority_subregions
step build_wide python3 scripts/build_wide.py
step carbon_free_index python3 scripts/carbon_free_index.py
step overnight_profile python3 scripts/overnight_profile.py
step l2_temporal python3 scripts/l2_temporal.py
step l2_interchange python3 scripts/l2_interchange.py
step l3_detector python3 scripts/l3_detector.py
step l4_supply python3 scripts/l4_supply.py
step export_json python3 scripts/export_json.py
step alerts python3 scripts/alerts.py

T1=$(date +%s)
echo "total,$((T1 - T0))" >> docs/ec2_runtime.csv
echo "end: $(date -u +%FT%TZ)   total: $((T1 - T0)) s ($(( (T1 - T0) / 60 )) min)"
echo "== reproducibility check (committed vs regenerated)"
python3 - <<'PY'
import json
def load(p): return json.load(open(p))
a, b = load('/tmp/committed/regions.json'), load('dashboard/public/data/regions.json')
ra = {r['id']: r for r in a['regions']}; rb = {r['id']: r for r in b['regions']}
diff = 0
for k in ra:
    x, y = ra[k].get('detection') or {}, (rb.get(k) or {}).get('detection') or {}
    if x.get('rank') != y.get('rank') or round(x.get('score') or 0, 2) != round(y.get('score') or 0, 2): diff += 1; print('  differs:', k, x.get('rank'), x.get('score'), '->', y.get('rank'), y.get('score'))
pjm = rb['PJM']
print(f"regions: {len(ra)} committed, {len(rb)} regenerated, {diff} detector ranks/scores differ")
print(f"PJM overnight clean MW 2019/2025: {pjm['cf_avg_mw']['2019']['overnight']} / {pjm['cf_avg_mw']['2025']['overnight']} (README: 35,700 / 35,619)")
PY
echo "runtime table: docs/ec2_runtime.csv"
