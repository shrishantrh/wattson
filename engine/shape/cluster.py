"""Q1: do datacenter grids cluster together on load shape alone?

Unsupervised end to end. The input is one thing only: the normalized 24-hour local
demand profile of each region in each year, straight from EIA-930. No detector
score, no rank, no pattern label, no carbon-free share, no site labels.

Pipeline
  1. Matrix X: one row per (region, year), 24 columns, each row divided by its own
     mean so it averages to 1.0. Scale is removed, peak-to-trough is kept.
  2. PCA on the column-centred matrix. The components are interpreted by correlating
     their scores against hand-computable profile statistics (overnight ratio,
     peak-to-trough, peak hour, evening-vs-afternoon contrast), so the physical
     reading is measured rather than asserted.
  3. k-means (k chosen by mean silhouette over k = 2..10, seeded, n_init = 50) and
     Ward hierarchical clustering on the same matrix; agreement reported as ARI.
  4. Only then: join the mapped-site labels and test enrichment with the
     hypergeometric survival function and Fisher's exact test, Bonferroni-corrected
     across clusters. The 2019 slice is run as a placebo -- if mapped-site regions
     were already in the same cluster in 2019, the cluster is telling us about
     long-standing industrial baseload, not about the buildout.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.stats import fisher_exact, hypergeom
from sklearn.cluster import AgglomerativeClustering, KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import adjusted_rand_score, silhouette_score

from . import profiles as P

SEED = 20260920            # the deadline date; fixed once, never re-rolled
N_INIT = 50
K_RANGE = range(2, 11)
YEARS = range(2018, 2027)


# ------------------------------------------------------------------- feature matrix

def profile_matrix(hour: pd.DataFrame, regions, years=YEARS,
                   normalize: str = "mean") -> pd.DataFrame:
    """(region, year) x 24 normalized load shapes.

    normalize="mean": divide by the row mean. Row averages to 1.0; a flat region sits
      near the all-ones vector and a peaky one swings around it. Flatness survives.
    normalize="z": subtract the row mean and divide by the row sd. Amplitude is
      removed entirely and only the TIMING of the peak is left. Robustness check.
    """
    rows, idx = [], []
    h = hour[hour.region.isin(set(regions)) & hour.year.isin(list(years))]
    for (region, year), g in h.groupby(["region", "year"], observed=True):
        g = g.set_index("local_hour").reindex(range(24))
        if g.mw.isna().any() or g.hours.sum() < 0.9 * 8760:
            continue
        v = g.mw.to_numpy(float)
        if normalize == "mean":
            v = v / v.mean()
        elif normalize == "z":
            v = (v - v.mean()) / v.std(ddof=0)
        else:
            raise ValueError(normalize)
        rows.append(v)
        idx.append((region, year))
    X = pd.DataFrame(rows, index=pd.MultiIndex.from_tuples(idx, names=["region", "year"]),
                     columns=[f"h{h:02d}" for h in range(24)])
    return X.sort_index()


def profile_stats(X: pd.DataFrame) -> pd.DataFrame:
    """Hand-computable descriptions of each profile, for interpreting the PCs."""
    v = X.to_numpy()
    return pd.DataFrame({
        "overnight_ratio": v[:, 0:6].mean(axis=1),
        "peak_to_trough": v.max(axis=1) / v.min(axis=1),
        "peak_hour": v.argmax(axis=1).astype(float),
        "trough_hour": v.argmin(axis=1).astype(float),
        "evening_minus_afternoon": v[:, 18:22].mean(axis=1) - v[:, 12:16].mean(axis=1),
        "morning_ramp": v[:, 8] - v[:, 4],
    }, index=X.index)


# ----------------------------------------------------------------------------- PCA

def run_pca(X: pd.DataFrame, n_components: int = 5) -> dict:
    pca = PCA(n_components=n_components, svd_solver="full", random_state=SEED)
    scores = pca.fit_transform(X.to_numpy())
    stats = profile_stats(X)
    interp = {}
    for i in range(n_components):
        s = pd.Series(scores[:, i], index=X.index)
        interp[f"PC{i + 1}"] = {
            "explained_variance_ratio": float(pca.explained_variance_ratio_[i]),
            "loadings": [float(x) for x in pca.components_[i]],
            "corr_with": {c: float(np.corrcoef(s, stats[c])[0, 1]) for c in stats.columns},
        }
    return {
        "pca": pca,
        "scores": pd.DataFrame(scores, index=X.index,
                               columns=[f"PC{i + 1}" for i in range(n_components)]),
        "mean_profile": [float(x) for x in pca.mean_],
        "components": interp,
        "cumulative_explained": [float(x) for x in np.cumsum(pca.explained_variance_ratio_)],
    }


# ------------------------------------------------------------------------ clustering

def choose_k(X: pd.DataFrame) -> tuple[int, list[dict]]:
    """Mean silhouette over k = 2..10. The k with the highest silhouette wins.

    This is the whole rule and it is applied before anything is joined to site labels.
    """
    curve = []
    A = X.to_numpy()
    for k in K_RANGE:
        km = KMeans(n_clusters=k, n_init=N_INIT, random_state=SEED).fit(A)
        ward = AgglomerativeClustering(n_clusters=k, linkage="ward").fit(A)
        curve.append({
            "k": k,
            "silhouette_kmeans": float(silhouette_score(A, km.labels_)),
            "silhouette_ward": float(silhouette_score(A, ward.labels_)),
            "inertia": float(km.inertia_),
            "ari_kmeans_vs_ward": float(adjusted_rand_score(km.labels_, ward.labels_)),
        })
    best = max(curve, key=lambda r: r["silhouette_kmeans"])["k"]
    return best, curve


def fit_clusters(X: pd.DataFrame, k: int) -> dict:
    A = X.to_numpy()
    km = KMeans(n_clusters=k, n_init=N_INIT, random_state=SEED).fit(A)
    ward = AgglomerativeClustering(n_clusters=k, linkage="ward").fit(A)

    # Name clusters by their centroid's overnight ratio: cluster 0 is the flattest.
    order = np.argsort(-km.cluster_centers_[:, 0:6].mean(axis=1))
    remap = {old: new for new, old in enumerate(order)}
    labels = pd.Series([remap[int(l)] for l in km.labels_], index=X.index, name="cluster")
    centers = km.cluster_centers_[order]

    return {
        "k": k,
        "labels": labels,
        "ward_labels": pd.Series(ward.labels_, index=X.index, name="ward"),
        "centroids": centers,
        "silhouette": float(silhouette_score(A, km.labels_)),
        "ari_kmeans_vs_ward": float(adjusted_rand_score(km.labels_, ward.labels_)),
        "centroid_stats": [
            {
                "cluster": i,
                "overnight_ratio": float(c[0:6].mean()),
                "daytime_ratio": float(c[10:16].mean()),
                "peak_to_trough": float(c.max() / c.min()),
                "peak_hour": int(c.argmax()),
                "trough_hour": int(c.argmin()),
                "profile": [float(x) for x in c],
            }
            for i, c in enumerate(centers)
        ],
    }


# ------------------------------------------------------------------------ enrichment

def enrichment(labels_year: pd.Series, site_regions: set, k: int) -> list[dict]:
    """Hypergeometric + Fisher exact, one test per cluster, Bonferroni over k tests.

    N = regions scored, K = regions with >= 1 mapped site, n = cluster size,
    x = mapped-site regions inside the cluster. Hypergeometric sf(x-1) is the
    one-sided P(>= x by chance); Fisher is the two-sided 2x2 version.
    """
    N = len(labels_year)
    K = len({r for r in labels_year.index if r in site_regions})
    out = []
    for c in range(k):
        members = [r for r in labels_year.index if labels_year[r] == c]
        n = len(members)
        x = sum(1 for r in members if r in site_regions)
        if n == 0:
            continue
        p_hyper = float(hypergeom.sf(x - 1, N, K, n))
        table = [[x, n - x], [K - x, N - n - (K - x)]]
        odds, p_fisher = fisher_exact(table, alternative="two-sided")
        out.append({
            "cluster": c, "n_regions": n, "n_with_sites": x,
            "share_with_sites": x / n, "expected_with_sites": n * K / N,
            "p_hypergeometric_one_sided": p_hyper,
            "p_hypergeometric_bonferroni": min(1.0, p_hyper * k),
            "odds_ratio": float(odds) if np.isfinite(odds) else None,
            "p_fisher_two_sided": float(p_fisher),
            "p_fisher_bonferroni": min(1.0, float(p_fisher) * k),
            "N": N, "K": K,
            "regions": members,
        })
    return out
