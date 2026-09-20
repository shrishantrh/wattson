"""The corroboration experiment: cross-validation, permutation test, importance,
agreement with the frozen detector, calibration.

Run from the repo root:

    python3 -m engine.ml.experiment

Writes engine/ml/results/*.json and prints everything docs/ML.md quotes.

Design notes a reviewer should check:

*   Every scaler is fitted INSIDE the training fold (sklearn Pipeline), never on
    the full matrix. Nothing about the test fold reaches the fit.
*   n = 111 with 49 positives, so a single train/test split would be noise.
    Headline numbers are pooled out-of-fold over repeated stratified 5-fold;
    leave-one-out is reported alongside as a second scheme.
*   Average precision is the metric that matters here. ROC-AUC is insensitive
    to prevalence and rewards a model for correctly ordering the large easy
    negative mass; average precision asks how good the TOP of the ranking is,
    which is the only part anyone would act on, and its no-skill floor is the
    prevalence rather than 0.5.
*   The permutation test is run twice. Plain shuffling tests "any signal at
    all". Shuffling WITHIN size quintiles holds the coverage-vs-size confound
    fixed in the null, and so tests the much harder question: does the load
    shape carry signal beyond the fact that big regions are better documented?
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
from joblib import Parallel, delayed
from scipy import stats
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.model_selection import (
    LeaveOneOut,
    RepeatedStratifiedKFold,
    StratifiedGroupKFold,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from engine.ml import SEED, features as F, labels as L

REPO = Path(__file__).resolve().parents[2]
RESULTS = Path(__file__).resolve().parent / "results"
CACHE = REPO / "data" / "processed" / "ml_features.csv"

N_SPLITS = 5
N_REPEATS = 20          # headline scheme: 100 fits
N_REPEATS_PERM = 3      # permutation scheme: 15 fits per shuffle
N_PERM = 1000
N_PERM_GB = 500         # gradient boosting is ~25x slower to fit than logistic
SIZE_STRATA = 5


def models() -> dict[str, Pipeline]:
    return {
        # L2 logistic regression. C=1.0 on standardized features, not tuned:
        # with n=111 an inner tuning loop would spend the sample on
        # hyperparameters and the result would be less, not more, honest.
        "logistic": Pipeline([
            ("scale", StandardScaler()),
            ("clf", LogisticRegression(C=1.0, max_iter=5000, random_state=SEED)),
        ]),
        # Shallow boosting (depth 2) because n is small; depth 3+ memorises.
        "gradient_boosting": Pipeline([
            ("scale", StandardScaler()),
            ("clf", GradientBoostingClassifier(
                n_estimators=200, max_depth=2, learning_rate=0.05,
                subsample=0.9, random_state=SEED)),
        ]),
    }


# ---------------------------------------------------------------------------

def oof_predict(X: np.ndarray, y: np.ndarray, model, cv, groups=None):
    """Out-of-fold probabilities, averaged over repeats, plus per-fold metrics."""
    total = np.zeros(len(y))
    count = np.zeros(len(y))
    fold_auc, fold_ap = [], []
    split = cv.split(X, y, groups) if groups is not None else cv.split(X, y)
    for tr, te in split:
        m = sklearn_clone(model)
        m.fit(X[tr], y[tr])
        p = m.predict_proba(X[te])[:, 1]
        total[te] += p
        count[te] += 1
        if len(np.unique(y[te])) == 2:
            fold_auc.append(roc_auc_score(y[te], p))
            fold_ap.append(average_precision_score(y[te], p))
    return total / np.maximum(count, 1), np.array(fold_auc), np.array(fold_ap)


def sklearn_clone(model):
    from sklearn.base import clone
    return clone(model)


def pooled_auc(X, y, model, cv) -> float:
    """Pooled out-of-fold AUC. The statistic used for the permutation test."""
    p, _, _ = oof_predict(X, y, model, cv)
    return roc_auc_score(y, p)


def evaluate(X: np.ndarray, y: np.ndarray, model, seed: int = SEED) -> dict:
    cv = RepeatedStratifiedKFold(n_splits=N_SPLITS, n_repeats=N_REPEATS, random_state=seed)
    p, fa, fp = oof_predict(X, y, model, cv)
    loo_p, _, _ = oof_predict(X, y, model, LeaveOneOut())
    return {
        "n": int(len(y)), "n_pos": int(y.sum()), "prevalence": float(y.mean()),
        "fold_auc_mean": float(fa.mean()), "fold_auc_sd": float(fa.std(ddof=1)),
        "fold_ap_mean": float(fp.mean()), "fold_ap_sd": float(fp.std(ddof=1)),
        "pooled_auc": float(roc_auc_score(y, p)),
        "pooled_ap": float(average_precision_score(y, p)),
        "loo_auc": float(roc_auc_score(y, loo_p)),
        "loo_ap": float(average_precision_score(y, loo_p)),
        "brier": float(brier_score_loss(y, p)),
        "brier_base_rate": float(brier_score_loss(y, np.full(len(y), y.mean()))),
        "n_folds": int(len(fa)),
        "oof": p.tolist(),
    }


def permutation_test(X, y, model, n_perm: int, rng, size_strata=None) -> dict:
    """Empirical p-value for the pooled out-of-fold AUC under shuffled labels.

    size_strata: if given, labels are shuffled only WITHIN each stratum, so the
    null keeps the association between region size and the chance of being
    labelled. A significant p-value against that null means the load shape
    carries signal the size confound does not explain.
    """
    cv = RepeatedStratifiedKFold(n_splits=N_SPLITS, n_repeats=N_REPEATS_PERM,
                                 random_state=SEED)
    observed = pooled_auc(X, y, model, cv)

    def shuffled() -> np.ndarray:
        if size_strata is None:
            return rng.permutation(y)
        yp = y.copy()
        for s in np.unique(size_strata):
            idx = np.where(size_strata == s)[0]
            yp[idx] = rng.permutation(y[idx])
        return yp

    # Labels are drawn up front from the single seeded generator, so the null
    # is reproducible regardless of how joblib schedules the fits.
    draws = [shuffled() for _ in range(n_perm)]
    null = np.array(Parallel(n_jobs=-1, prefer="processes")(
        delayed(pooled_auc)(X, yp, model, cv) for yp in draws))
    # (1 + #{null >= observed}) / (1 + n): never reports p = 0, which would be
    # a claim the number of shuffles cannot support.
    p = (1 + int((null >= observed).sum())) / (1 + n_perm)
    return {
        "observed_auc": float(observed), "n_perm": int(n_perm),
        "null_mean": float(null.mean()), "null_sd": float(null.std(ddof=1)),
        "null_p95": float(np.quantile(null, 0.95)),
        "null_max": float(null.max()), "p_value": float(p),
        "stratified": size_strata is not None,
    }


def permutation_importance_oof(X, y, model, names, n_repeats=10, seed=SEED) -> pd.DataFrame:
    """Drop in HELD-OUT AUC when one feature's column is shuffled in the test fold.

    Held-out, not impurity on the training set: impurity importance rewards
    features that let a tree memorise the training rows. Correlated features
    share credit and each looks individually weak, so read groups, not ranks.
    """
    cv = RepeatedStratifiedKFold(n_splits=N_SPLITS, n_repeats=5, random_state=seed)
    rng = np.random.default_rng(seed)
    drops = {n: [] for n in names}
    for tr, te in cv.split(X, y):
        m = sklearn_clone(model)
        m.fit(X[tr], y[tr])
        if len(np.unique(y[te])) < 2:
            continue
        base = roc_auc_score(y[te], m.predict_proba(X[te])[:, 1])
        for j, name in enumerate(names):
            for _ in range(n_repeats):
                Xp = X[te].copy()
                Xp[:, j] = rng.permutation(Xp[:, j])
                drops[name].append(base - roc_auc_score(y[te], m.predict_proba(Xp)[:, 1]))
    out = pd.DataFrame({
        "feature": names,
        "auc_drop_mean": [np.mean(drops[n]) for n in names],
        "auc_drop_sd": [np.std(drops[n], ddof=1) for n in names],
    })
    return out.sort_values("auc_drop_mean", ascending=False).reset_index(drop=True)


def paired_compare(y, spec_a, spec_b, seed=SEED) -> dict:
    """Compare two (feature set, model) specs ON IDENTICAL FOLDS.

    Fold AUCs have a standard deviation around 0.09 here, so two models whose
    means differ by 0.01 are indistinguishable unless the comparison is paired.
    Each spec is (feature matrix, estimator).
    """
    cv = RepeatedStratifiedKFold(n_splits=N_SPLITS, n_repeats=N_REPEATS,
                                 random_state=seed)
    (Xa, ma), (Xb, mb) = spec_a, spec_b
    a_auc, b_auc, a_ap, b_ap = [], [], [], []
    for tr, te in cv.split(Xa, y):
        if len(np.unique(y[te])) < 2:
            continue
        for M, model, auc_l, ap_l in ((Xa, ma, a_auc, a_ap), (Xb, mb, b_auc, b_ap)):
            m = sklearn_clone(model)
            m.fit(M[tr], y[tr])
            p = m.predict_proba(M[te])[:, 1]
            auc_l.append(roc_auc_score(y[te], p))
            ap_l.append(average_precision_score(y[te], p))
    d_auc = np.array(a_auc) - np.array(b_auc)
    d_ap = np.array(a_ap) - np.array(b_ap)
    t_auc = stats.ttest_rel(a_auc, b_auc)
    t_ap = stats.ttest_rel(a_ap, b_ap)
    w_auc = stats.wilcoxon(a_auc, b_auc)
    return {
        "n_folds": int(len(d_auc)),
        "mean_auc_a": float(np.mean(a_auc)), "mean_auc_b": float(np.mean(b_auc)),
        "mean_ap_a": float(np.mean(a_ap)), "mean_ap_b": float(np.mean(b_ap)),
        "delta_auc_mean": float(d_auc.mean()), "delta_auc_sd": float(d_auc.std(ddof=1)),
        "delta_auc_ci95": [float(np.quantile(d_auc, 0.025)),
                           float(np.quantile(d_auc, 0.975))],
        "delta_ap_mean": float(d_ap.mean()), "delta_ap_sd": float(d_ap.std(ddof=1)),
        "paired_t_auc_p": float(t_auc.pvalue), "paired_t_ap_p": float(t_ap.pvalue),
        "wilcoxon_auc_p": float(w_auc.pvalue),
        "a_beats_b_fold_frac": float((d_auc > 0).mean()),
    }


def reliability(y, p, bins=5) -> pd.DataFrame:
    q = pd.qcut(p, bins, labels=False, duplicates="drop")
    df = pd.DataFrame({"y": y, "p": p, "bin": q})
    g = df.groupby("bin").agg(n=("y", "size"), mean_pred=("p", "mean"),
                              observed=("y", "mean"), lo=("p", "min"), hi=("p", "max"))
    return g.reset_index()


# ---------------------------------------------------------------------------

def main() -> int:
    t0 = time.time()
    rng = np.random.default_rng(SEED)
    RESULTS.mkdir(parents=True, exist_ok=True)

    if CACHE.exists():
        X = pd.read_csv(CACHE)
        print(f"features: cached {CACHE}")
    else:
        X = F.build(REPO)
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        X.to_csv(CACHE, index=False)
        print(f"features: built and cached to {CACHE}")

    X = X.sort_values("region").reset_index(drop=True)
    X["log_size"] = np.log(X["_avg_mw_25"])

    lab = L.build_labels(X.region, REPO, exclude_btm=False, propagate_to_ba=True)
    X = X.merge(lab, on="region", how="left")
    y = X["y"].to_numpy()
    groups = X["ba"].to_numpy()
    size_strata = pd.qcut(X["log_size"], SIZE_STRATA, labels=False).to_numpy()
    sets = F.feature_sets(X)

    print("=" * 78)
    print(f"seed {SEED} | n {len(X)} | positives {int(y.sum())} "
          f"({y.mean():.1%}) | negatives {int((1 - y).sum())}")
    print(f"zones {int(X.is_zone.sum())} | BAs {int((~X.is_zone).sum())} | "
          f"parent-BA groups {len(set(groups))}")
    print(f"CV: RepeatedStratifiedKFold({N_SPLITS}, n_repeats={N_REPEATS}) "
          f"= {N_SPLITS * N_REPEATS} fits, plus leave-one-out")
    print(f"permutation: {N_PERM} shuffles (logistic) / {N_PERM_GB} (boosting), "
          f"each re-CV'd with n_repeats={N_REPEATS_PERM}")
    for k, v in sets.items():
        print(f"  feature set {k:16s} p = {len(v)}")
    print("=" * 78)

    out: dict = {
        "seed": SEED, "n": int(len(X)), "n_pos": int(y.sum()),
        "prevalence": float(y.mean()),
        "cv": {"scheme": "RepeatedStratifiedKFold", "n_splits": N_SPLITS,
               "n_repeats": N_REPEATS, "n_fits": N_SPLITS * N_REPEATS},
        "feature_sets": {k: v for k, v in sets.items()},
        "results": {}, "permutation": {}, "importance": {},
        "agreement": {}, "calibration": {}, "sensitivity": {},
    }

    # ---- 1. cross-validated classifiers ---------------------------------
    print("\n[1] CROSS-VALIDATED PERFORMANCE  (no-skill: AUC 0.500, AP "
          f"{y.mean():.3f} = prevalence)")
    print(f"{'set':17s} {'model':19s} {'fold AUC':>16s} {'fold AP':>16s} "
          f"{'pool AUC':>9s} {'pool AP':>8s} {'LOO AUC':>8s}")
    oof_store: dict[str, np.ndarray] = {}
    for sname, cols in sets.items():
        M = X[cols].to_numpy(dtype=float)
        for mname, model in models().items():
            if sname == "size_only" and mname == "gradient_boosting":
                continue                      # one feature, nothing to boost over
            r = evaluate(M, y, model)
            key = f"{sname}|{mname}"
            oof_store[key] = np.asarray(r.pop("oof"))
            out["results"][key] = r
            print(f"{sname:17s} {mname:19s} "
                  f"{r['fold_auc_mean']:.3f} +/- {r['fold_auc_sd']:.3f}  "
                  f"{r['fold_ap_mean']:.3f} +/- {r['fold_ap_sd']:.3f}  "
                  f"{r['pooled_auc']:9.3f} {r['pooled_ap']:8.3f} {r['loo_auc']:8.3f}")

    # ---- 2. permutation tests -------------------------------------------
    print("\n[2] PERMUTATION TEST on pooled out-of-fold AUC")
    print(f"{'set':17s} {'model':19s} {'null':13s} {'obs':>6s} {'null mean':>9s} "
          f"{'null sd':>8s} {'null p95':>8s} {'p':>8s}")
    for sname in ["static_2025", "shape_change", "shape_plus_size", "size_only"]:
        M = X[sets[sname]].to_numpy(dtype=float)
        for mname, model in models().items():
            if sname == "size_only" and mname == "gradient_boosting":
                continue
            n_perm = N_PERM if mname == "logistic" else N_PERM_GB
            for label, strata in [("plain", None), ("size-stratified", size_strata)]:
                r = permutation_test(M, y, model, n_perm,
                                     np.random.default_rng(SEED), strata)
                out["permutation"][f"{sname}|{mname}|{label}"] = r
                print(f"{sname:17s} {mname:19s} {label:13s} "
                      f"{r['observed_auc']:6.3f} {r['null_mean']:9.3f} "
                      f"{r['null_sd']:8.3f} {r['null_p95']:8.3f} "
                      f"{r['p_value']:8.4f}  (n={r['n_perm']})")

    # ---- 3. permutation importance --------------------------------------
    print("\n[3] PERMUTATION IMPORTANCE on held-out folds (drop in test AUC)")
    for sname in ["static_2025", "shape_change"]:
        cols = sets[sname]
        M = X[cols].to_numpy(dtype=float)
        for mname, model in models().items():
            imp = permutation_importance_oof(M, y, model, cols)
            out["importance"][f"{sname}|{mname}"] = imp.to_dict("records")
            print(f"\n  {sname} / {mname} -- top 10 of {len(cols)}")
            for _, row in imp.head(10).iterrows():
                print(f"    {row.feature:26s} {row.auc_drop_mean:+.4f} "
                      f"+/- {row.auc_drop_sd:.4f}")
            imp.to_csv(RESULTS / f"importance_{sname}_{mname}.csv", index=False)

    # ---- 4. agreement with the frozen detector ---------------------------
    print("\n[4] AGREEMENT WITH THE FROZEN L3 DETECTOR")
    det = pd.read_csv(REPO / "data" / "processed" / "l3_detector.csv")
    det = det[["region", "rank", "score"]].set_index("region").loc[X.region]
    for key in ["static_2025|gradient_boosting", "shape_change|gradient_boosting",
                "static_2025|logistic", "shape_change|logistic",
                "shape_plus_size|gradient_boosting"]:
        p = oof_store[key]
        rho, pv = stats.spearmanr(p, det["score"].to_numpy())
        out["agreement"][key] = {"spearman_rho_vs_score": float(rho),
                                 "p_value": float(pv)}
        print(f"  {key:38s} Spearman(model prob, detector score) = "
              f"{rho:+.3f}  (p = {pv:.2e})")
    # detector score as a standalone predictor of the same label
    out["agreement"]["detector_score_as_predictor"] = {
        "auc": float(roc_auc_score(y, det["score"])),
        "ap": float(average_precision_score(y, det["score"])),
    }
    print(f"  detector score, scored against the SAME labels: "
          f"AUC {roc_auc_score(y, det['score']):.3f}  "
          f"AP {average_precision_score(y, det['score']):.3f}")

    headline = "shape_change|gradient_boosting"
    dis = pd.DataFrame({
        "region": X.region, "y": y,
        "model_prob": oof_store[headline],
        "detector_rank": det["rank"].to_numpy(),
        "avg_mw_2025": X["_avg_mw_25"].to_numpy(),
    })
    dis["model_rank"] = dis.model_prob.rank(ascending=False).astype(int)
    dis["rank_gap"] = dis.detector_rank - dis.model_rank
    dis.sort_values("model_rank").to_csv(RESULTS / "oof_vs_detector.csv", index=False)
    print("\n  model ranks FAR ABOVE the detector (model_rank << detector_rank):")
    print(dis.nlargest(8, "rank_gap")[
        ["region", "y", "model_rank", "detector_rank", "model_prob", "avg_mw_2025"]
    ].round(3).to_string(index=False))
    print("\n  detector ranks FAR ABOVE the model:")
    print(dis.nsmallest(8, "rank_gap")[
        ["region", "y", "model_rank", "detector_rank", "model_prob", "avg_mw_2025"]
    ].round(3).to_string(index=False))
    out["agreement"]["largest_disagreements"] = {
        "model_above_detector": dis.nlargest(8, "rank_gap").to_dict("records"),
        "detector_above_model": dis.nsmallest(8, "rank_gap").to_dict("records"),
    }

    # ---- 5. calibration ---------------------------------------------------
    print("\n[5] CALIBRATION of out-of-fold probabilities")
    for key in ["shape_change|gradient_boosting", "shape_change|logistic",
                "static_2025|gradient_boosting"]:
        p = oof_store[key]
        rel = reliability(y, p)
        out["calibration"][key] = {
            "brier": float(brier_score_loss(y, p)),
            "brier_base_rate": float(brier_score_loss(y, np.full(len(y), y.mean()))),
            "reliability": rel.to_dict("records"),
        }
        print(f"\n  {key}: Brier {brier_score_loss(y, p):.4f} "
              f"(base-rate-only model: {brier_score_loss(y, np.full(len(y), y.mean())):.4f})")
        print("    quintile  n  mean predicted   observed rate")
        for _, r in rel.iterrows():
            print(f"      {int(r['bin']) + 1}      {int(r['n']):3d}      "
                  f"{r['mean_pred']:.3f}          {r['observed']:.3f}")

    # ---- 6. label sensitivity --------------------------------------------
    print("\n[6] LABEL SENSITIVITY  (headline set: shape_change / gradient_boosting)")
    M = X[sets["shape_change"]].to_numpy(dtype=float)
    variants = {
        "primary (all 134 sites, zone->BA propagated)":
            dict(exclude_btm=False, propagate_to_ba=True),
        "behind-the-meter sites excluded (123 sites)":
            dict(exclude_btm=True, propagate_to_ba=True),
        "no zone->parent-BA propagation":
            dict(exclude_btm=False, propagate_to_ba=False),
        "both (123 sites, no propagation)":
            dict(exclude_btm=True, propagate_to_ba=False),
    }
    gb = models()["gradient_boosting"]
    print(f"{'variant':46s} {'n_pos':>5s} {'fold AUC':>16s} {'fold AP':>16s} {'pool AP':>8s}")
    for name, kw in variants.items():
        yv = L.build_labels(X.region, REPO, **kw)["y"].to_numpy()
        r = evaluate(M, yv, gb)
        r.pop("oof")
        out["sensitivity"][name] = r
        print(f"{name:46s} {int(yv.sum()):5d} "
              f"{r['fold_auc_mean']:.3f} +/- {r['fold_auc_sd']:.3f}  "
              f"{r['fold_ap_mean']:.3f} +/- {r['fold_ap_sd']:.3f}  {r['pooled_ap']:8.3f}")

    # grouped CV: zones and their parent BA never straddle a fold boundary
    print("\n  grouped CV (StratifiedGroupKFold on parent BA -- PJM and PJM/DOM "
          "cannot land on opposite sides of a split):")
    gcv = StratifiedGroupKFold(n_splits=N_SPLITS, shuffle=True, random_state=SEED)
    for mname, model in models().items():
        p, fa, fp = oof_predict(M, y, model, gcv, groups=groups)
        out["sensitivity"][f"grouped_cv|{mname}"] = {
            "fold_auc_mean": float(fa.mean()), "fold_auc_sd": float(fa.std(ddof=1)),
            "fold_ap_mean": float(fp.mean()), "fold_ap_sd": float(fp.std(ddof=1)),
            "pooled_auc": float(roc_auc_score(y, p)),
            "pooled_ap": float(average_precision_score(y, p)),
        }
        print(f"    {mname:19s} fold AUC {fa.mean():.3f} +/- {fa.std(ddof=1):.3f}   "
              f"fold AP {fp.mean():.3f} +/- {fp.std(ddof=1):.3f}   "
              f"pooled AUC {roc_auc_score(y, p):.3f}  AP {average_precision_score(y, p):.3f}")

    # zones only / BAs only: the size confound is much weaker inside each stratum
    print("\n  restricted samples:")
    for label, mask in [("zones only", X.is_zone.to_numpy()),
                        ("BAs only", ~X.is_zone.to_numpy())]:
        yv = y[mask]
        if yv.sum() < 5 or (1 - yv).sum() < 5:
            continue
        r = evaluate(M[mask], yv, gb)
        r.pop("oof")
        rs = evaluate(X.loc[mask, ["log_size"]].to_numpy(), yv, models()["logistic"])
        rs.pop("oof")
        out["sensitivity"][f"restricted|{label}"] = {"shape": r, "size_only": rs}
        print(f"    {label:12s} n={len(yv):3d} pos={int(yv.sum()):3d}  "
              f"shape: AUC {r['fold_auc_mean']:.3f} AP {r['fold_ap_mean']:.3f}  |  "
              f"size-only: AUC {rs['fold_auc_mean']:.3f} AP {rs['fold_ap_mean']:.3f}")

    # ---- 7. does load shape add anything BEYOND region size? --------------
    # The single most important control in this experiment. Facility coverage
    # is not size-neutral: a 90 GW BA is far more likely to have a sourced site
    # than a 600 MW zone. Paired on identical folds, so the comparison is not
    # swamped by the ~0.09 fold-to-fold spread.
    print("\n[7] PAIRED COMPARISON on identical folds (positive delta = A better than B)")
    gb, lr = models()["gradient_boosting"], models()["logistic"]
    size_M = X[["log_size"]].to_numpy(dtype=float)
    comparisons = {
        "shape_change/GB  vs  size_only/LR":
            ((X[sets["shape_change"]].to_numpy(float), gb), (size_M, lr)),
        "static_2025/GB   vs  size_only/LR":
            ((X[sets["static_2025"]].to_numpy(float), gb), (size_M, lr)),
        "shape_plus_size/GB vs size_only/LR":
            ((X[sets["shape_plus_size"]].to_numpy(float), gb), (size_M, lr)),
        "static_2025/GB   vs  shape_change/GB":
            ((X[sets["static_2025"]].to_numpy(float), gb),
             (X[sets["shape_change"]].to_numpy(float), gb)),
    }
    out["paired"] = {}
    for name, (a, b) in comparisons.items():
        r = paired_compare(y, a, b)
        out["paired"][name] = r
        print(f"  {name:36s} dAUC {r['delta_auc_mean']:+.4f} "
              f"(sd {r['delta_auc_sd']:.3f}, 95% {r['delta_auc_ci95'][0]:+.3f}.."
              f"{r['delta_auc_ci95'][1]:+.3f})  dAP {r['delta_ap_mean']:+.4f}  "
              f"paired-t p {r['paired_t_auc_p']:.3g}  A wins {r['a_beats_b_fold_frac']:.0%} of folds")

    (RESULTS / "experiment.json").write_text(json.dumps(out, indent=2, default=float))
    print(f"\nwrote {RESULTS / 'experiment.json'}")
    print(f"total runtime {time.time() - t0:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
