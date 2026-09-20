"""engine.ml -- independent supervised corroboration of the frozen L3 detector.

The question: the L3 flat-load detector is a hand-built linear rule over three
hand-picked features, designed while looking at the same data it scores. Can a
model that never saw that rule recover the regions that demonstrably host large
datacenter load, using the hourly demand SHAPE alone?

Labels come from `claims/lookup/facilities.csv` (134 sited facilities, 54
operators, each with a source URL), built from serving utilities and public
filings and never from the detector. See `labels.py` for the known noise.

Nothing downstream of the detector is ever used as a feature. `l3_detector.csv`
is read in exactly one place -- the agreement analysis in `experiment.py` -- and
never enters `features.py`.
"""

SEED = 20260920
