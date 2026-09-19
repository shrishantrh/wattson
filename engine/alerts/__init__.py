"""Alert prioritisation for Wattson.

Reads the exported alert feed and produces a ranked, deduplicated shortlist
fit for a demo screen. Ranking and filtering only: alert text, thresholds and
first_crossed dates are passed through untouched.
"""
