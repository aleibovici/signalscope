"""
Step 4: Threshold parameter sweep using trained model + raw data.

Automatically selects the best available return horizon (7d > 3d > 1d).

Answers:
- What P&D flag count threshold maximizes returns?
- What AI score cutoff best separates winners from losers?
- What stage thresholds produce the best Sharpe-like ratio?
- Which individual P&D flags are most predictive of actual dumps?
- How do cross-category interactions perform (e.g. micro-cap + insider, FORMING + high AI score)?

Usage:
    python sweep.py
"""

import warnings
from pathlib import Path

import pandas as pd

from features import PND_FLAG_NAMES, clean_for_analysis, engineer_features

warnings.filterwarnings("ignore", category=FutureWarning)

OUTPUT_DIR = Path(__file__).parent / "output"

# Horizons in order of preference
HORIZONS = [
    {"return": "return_7d", "label": "7d", "min_rows": 50},
    {"return": "return_3d", "label": "3d", "min_rows": 50},
    {"return": "return_1d", "label": "1d", "min_rows": 50},
]


def load_data():
    parquet_path = OUTPUT_DIR / "dataset.parquet"
    if not parquet_path.exists():
        print("ERROR: dataset.parquet not found. Run extract.py first.")
        raise SystemExit(1)
    return pd.read_parquet(parquet_path)


def select_horizon(feat_df):
    for h in HORIZONS:
        n = feat_df[h["return"]].notna().sum()
        if n >= h["min_rows"]:
            print(f"Selected horizon: {h['label']} ({n} rows with data)")
            return h
    for h in HORIZONS:
        n = feat_df[h["return"]].notna().sum()
        print(f"  {h['label']}: {n} rows")
    print("ERROR: Not enough performance data for any horizon.")
    raise SystemExit(1)


def sharpe_like(returns: pd.Series) -> float:
    """Sharpe-like ratio: mean / std (annualization not needed for comparison)."""
    if len(returns) < 2 or returns.std() == 0:
        return 0.0
    return returns.mean() / returns.std()


def sweep_pnd_flagged(valid: pd.DataFrame, ret_col: str) -> list[dict]:
    """Compare P&D-flagged vs unflagged tickers."""
    results = []

    for flagged_val, label in [(False, "not_pnd_flagged"), (True, "pnd_flagged")]:
        subset = valid[valid["pndFlagged"] == flagged_val]
        other = valid[valid["pndFlagged"] != flagged_val]

        if len(subset) == 0:
            continue

        results.append({
            "sweep_type": "pnd_flagged",
            "parameter": label,
            "threshold": None,
            "n_included": len(subset),
            "n_excluded": len(other),
            "avg_return": subset[ret_col].mean(),
            "median_return": subset[ret_col].median(),
            "win_rate": (subset[ret_col] > 0).mean(),
            "big_win_rate": (subset[ret_col] > 0.05).mean(),
            "sharpe_like": sharpe_like(subset[ret_col]),
            "avg_excluded_return": other[ret_col].mean() if len(other) > 0 else None,
        })

    return results


def sweep_ai_score(valid: pd.DataFrame, ret_col: str) -> list[dict]:
    """Sweep AI score cutoffs."""
    results = []

    for threshold in range(0, 100, 5):
        included = valid[valid["aiScore"] >= threshold]
        if len(included) == 0:
            continue

        results.append({
            "sweep_type": "ai_score_cutoff",
            "parameter": f"ai_score_ge_{threshold}",
            "threshold": threshold,
            "n_included": len(included),
            "n_excluded": len(valid) - len(included),
            "avg_return": included[ret_col].mean(),
            "median_return": included[ret_col].median(),
            "win_rate": (included[ret_col] > 0).mean(),
            "big_win_rate": (included[ret_col] > 0.05).mean(),
            "sharpe_like": sharpe_like(included[ret_col]),
            "avg_excluded_return": None,
        })

    return results


def sweep_stage(valid: pd.DataFrame, ret_col: str) -> list[dict]:
    """Evaluate returns by signal stage."""
    results = []

    for stage in ["EARLY", "FORMING", "CONFIRMED", "FILTERED"]:
        subset = valid[valid["stage"] == stage]
        if len(subset) == 0:
            continue

        results.append({
            "sweep_type": "stage",
            "parameter": stage,
            "threshold": None,
            "n_included": len(subset),
            "n_excluded": len(valid) - len(subset),
            "avg_return": subset[ret_col].mean(),
            "median_return": subset[ret_col].median(),
            "win_rate": (subset[ret_col] > 0).mean(),
            "big_win_rate": (subset[ret_col] > 0.05).mean(),
            "sharpe_like": sharpe_like(subset[ret_col]),
            "avg_excluded_return": None,
        })

    for stages in [["CONFIRMED"], ["FORMING", "CONFIRMED"], ["EARLY", "FORMING", "CONFIRMED"]]:
        label = "+".join(stages)
        subset = valid[valid["stage"].isin(stages)]
        if len(subset) == 0:
            continue

        results.append({
            "sweep_type": "stage_combo",
            "parameter": label,
            "threshold": None,
            "n_included": len(subset),
            "n_excluded": len(valid) - len(subset),
            "avg_return": subset[ret_col].mean(),
            "median_return": subset[ret_col].median(),
            "win_rate": (subset[ret_col] > 0).mean(),
            "big_win_rate": (subset[ret_col] > 0.05).mean(),
            "sharpe_like": sharpe_like(subset[ret_col]),
            "avg_excluded_return": None,
        })

    return results


def sweep_individual_flags(valid: pd.DataFrame, ret_col: str) -> list[dict]:
    """Check each P&D flag's predictive power for actual losses."""
    results = []

    for flag_name in PND_FLAG_NAMES:
        col = f"flag_{flag_name}"
        if col not in valid.columns:
            continue

        flagged = valid[valid[col] == 1]
        unflagged = valid[valid[col] == 0]

        if len(flagged) == 0:
            continue

        results.append({
            "sweep_type": "individual_flag",
            "parameter": flag_name,
            "threshold": None,
            "n_included": len(flagged),
            "n_excluded": len(unflagged),
            "avg_return": flagged[ret_col].mean(),
            "median_return": flagged[ret_col].median(),
            "win_rate": (flagged[ret_col] > 0).mean(),
            "big_win_rate": (flagged[ret_col] > 0.05).mean(),
            "sharpe_like": sharpe_like(flagged[ret_col]),
            "avg_excluded_return": unflagged[ret_col].mean() if len(unflagged) > 0 else None,
        })

    return results


def _sweep_result(sweep_type: str, parameter: str, subset: pd.Series,
                   total: int, ret_col: str, excluded_returns=None) -> dict:
    """Build a standard sweep result dict."""
    return {
        "sweep_type": sweep_type,
        "parameter": parameter,
        "threshold": None,
        "n_included": len(subset),
        "n_excluded": total - len(subset),
        "avg_return": subset[ret_col].mean(),
        "median_return": subset[ret_col].median(),
        "win_rate": (subset[ret_col] > 0).mean(),
        "big_win_rate": (subset[ret_col] > 0.05).mean(),
        "sharpe_like": sharpe_like(subset[ret_col]),
        "avg_excluded_return": excluded_returns.mean() if excluded_returns is not None and len(excluded_returns) > 0 else None,
    }


def sweep_source_type(valid: pd.DataFrame, ret_col: str) -> list[dict]:
    """Sweep by signal source type and multi-source combinations."""
    results = []
    n = len(valid)

    # Individual source types (from signalType string)
    if "signal_type_raw" in valid.columns:
        for stype in valid["signal_type_raw"].unique():
            subset = valid[valid["signal_type_raw"] == stype]
            if len(subset) < 3:
                continue
            results.append(_sweep_result("source_type", stype, subset, n, ret_col))

    # Multi-source (sourceCount >= 2) vs single-source
    if "sourceCount" in valid.columns:
        for label, mask in [
            ("single_source", valid["sourceCount"] == 1),
            ("multi_source_2+", valid["sourceCount"] >= 2),
            ("multi_source_3+", valid["sourceCount"] >= 3),
        ]:
            subset = valid[mask]
            if len(subset) < 3:
                continue
            results.append(_sweep_result("source_count", label, subset, n, ret_col))

    # --- Source presence sweep (from Signal-level features) ---
    source_features = [
        ("has_reddit", "reddit"),
        ("has_twitter", "twitter"),
        ("has_insider", "insider"),
        ("has_options", "options"),
        ("has_congress", "congress"),
        ("has_volume_spike", "volume_spike"),
    ]

    for col, label in source_features:
        if col not in valid.columns:
            continue
        present = valid[valid[col] == 1]
        absent = valid[valid[col] == 0]
        if len(present) < 3:
            continue
        results.append(_sweep_result(
            "source_presence", f"has_{label}",
            present, n, ret_col,
            excluded_returns=absent[ret_col] if len(absent) > 0 else None,
        ))

    # --- Source combination sweep ---
    combos = [
        ("insider+reddit", ["has_insider", "has_reddit"]),
        ("congress+reddit", ["has_congress", "has_reddit"]),
        ("options+reddit", ["has_options", "has_reddit"]),
        ("insider+congress", ["has_insider", "has_congress"]),
        ("insider+volume_spike", ["has_insider", "has_volume_spike"]),
        ("twitter+insider", ["has_twitter", "has_insider"]),
    ]

    for label, cols in combos:
        if not all(c in valid.columns for c in cols):
            continue
        mask = pd.Series(True, index=valid.index)
        for c in cols:
            mask &= valid[c] == 1
        subset = valid[mask]
        if len(subset) < 3:
            continue
        results.append(_sweep_result("source_combo", label, subset, n, ret_col))

    return results


def sweep_market_cap(valid: pd.DataFrame, ret_col: str) -> list[dict]:
    """Sweep by market cap bucket."""
    results = []

    if "marketCap" not in valid.columns:
        return results

    buckets = [
        ("nano(<50M)", 0, 50e6),
        ("micro(50-300M)", 50e6, 300e6),
        ("small(300M-2B)", 300e6, 2e9),
        ("mid(2-10B)", 2e9, 10e9),
        ("large(>10B)", 10e9, float("inf")),
    ]

    for label, lo, hi in buckets:
        subset = valid[(valid["marketCap"] >= lo) & (valid["marketCap"] < hi)]
        if len(subset) < 3:
            continue
        results.append({
            "sweep_type": "market_cap_bucket",
            "parameter": label,
            "threshold": None,
            "n_included": len(subset),
            "n_excluded": len(valid) - len(subset),
            "avg_return": subset[ret_col].mean(),
            "median_return": subset[ret_col].median(),
            "win_rate": (subset[ret_col] > 0).mean(),
            "big_win_rate": (subset[ret_col] > 0.05).mean(),
            "sharpe_like": sharpe_like(subset[ret_col]),
            "avg_excluded_return": None,
        })

    # Cumulative: exclude large caps progressively
    cap_thresholds = [("cap<=300M", 0, 300e6), ("cap<=2B", 0, 2e9), ("cap<=10B", 0, 10e9)]
    for label, lo, hi in cap_thresholds:
        subset = valid[(valid["marketCap"] >= lo) & (valid["marketCap"] < hi)]
        if len(subset) < 3:
            continue
        results.append({
            "sweep_type": "market_cap_cumulative",
            "parameter": label,
            "threshold": None,
            "n_included": len(subset),
            "n_excluded": len(valid) - len(subset),
            "avg_return": subset[ret_col].mean(),
            "median_return": subset[ret_col].median(),
            "win_rate": (subset[ret_col] > 0).mean(),
            "big_win_rate": (subset[ret_col] > 0.05).mean(),
            "sharpe_like": sharpe_like(subset[ret_col]),
            "avg_excluded_return": None,
        })

    return results


def sweep_interactions(valid: pd.DataFrame, ret_col: str) -> list[dict]:
    """Sweep all two-way interactions between categorical dimensions."""
    from itertools import combinations

    dimensions: dict[str, dict[str, pd.Series]] = {}

    # Market cap
    if "marketCap" in valid.columns:
        dimensions["market_cap"] = {
            "nano(<50M)":      (valid["marketCap"] < 50e6),
            "micro(50-300M)":  (valid["marketCap"] >= 50e6) & (valid["marketCap"] < 300e6),
            "small(300M-2B)":  (valid["marketCap"] >= 300e6) & (valid["marketCap"] < 2e9),
            "mid(2-10B)":      (valid["marketCap"] >= 2e9) & (valid["marketCap"] < 10e9),
            "large(>10B)":     (valid["marketCap"] >= 10e9),
        }

    # Stage
    if "stage" in valid.columns:
        dimensions["stage"] = {
            s: (valid["stage"] == s)
            for s in ["EARLY", "FORMING", "CONFIRMED", "FILTERED"]
        }

    # Source presence
    source_cols = ["has_options", "has_insider", "has_congress", "social_only"]
    available = [c for c in source_cols if c in valid.columns]
    if available:
        src_dim = {c: (valid[c] == 1) for c in available}
        if "sourceCount" in valid.columns:
            src_dim["multi_source_2+"] = (valid["sourceCount"] >= 2)
        dimensions["source"] = src_dim

    # AI score buckets
    if "aiScore" in valid.columns:
        dimensions["ai_score"] = {
            "ai_low(<35)":   (valid["aiScore"] < 35),
            "ai_mid(35-55)": (valid["aiScore"] >= 35) & (valid["aiScore"] < 55),
            "ai_high(>=55)": (valid["aiScore"] >= 55),
        }

    # P&D
    if "pndFlagged" in valid.columns:
        dimensions["pnd"] = {
            "no_pnd":  (valid["pndFlagged"] == False),
            "is_pnd":  (valid["pndFlagged"] == True),
        }

    results = []
    n = len(valid)

    for (dim_a_name, dim_a), (dim_b_name, dim_b) in combinations(dimensions.items(), 2):
        for seg_a_name, mask_a in dim_a.items():
            for seg_b_name, mask_b in dim_b.items():
                subset = valid[mask_a & mask_b]
                if len(subset) < 3:
                    continue
                results.append(_sweep_result(
                    f"interaction_{dim_a_name}_x_{dim_b_name}",
                    f"{seg_a_name} \u00d7 {seg_b_name}",
                    subset, n, ret_col,
                ))

    return results


def main():
    print("Loading dataset...")
    raw_df = load_data()

    print("Engineering features...")
    feat_df, feature_names = engineer_features(raw_df)

    horizon = select_horizon(feat_df)
    ret_col = horizon["return"]
    label = horizon["label"]

    # Carry raw signalType through for source sweep (before dedup drops it)
    feat_df["signal_type_raw"] = raw_df["signalType"].fillna("unknown")

    # Clean: remove phantom prices, dedup by symbol
    print(f"\nCleaning data for analysis...")
    valid = clean_for_analysis(feat_df, ret_col)
    print(f"Analysis set: {len(valid)} unique symbols with {ret_col}")

    all_results = []

    print(f"\n--- P&D Flagged vs Unflagged ({label}) ---")
    pnd_results = sweep_pnd_flagged(valid, ret_col)
    all_results.extend(pnd_results)
    for r in pnd_results:
        diff = ""
        if r["avg_excluded_return"] is not None:
            d = r["avg_return"] - r["avg_excluded_return"]
            diff = f" (Δ {d:+.3f})"
        print(f"  {r['parameter']:20s}: n={r['n_included']:4d}, "
              f"avg={r['avg_return']:+.3f}, med={r['median_return']:+.3f}, "
              f"win={r['win_rate']:.1%}{diff}")
    if not pnd_results or all(r["parameter"] == "not_pnd_flagged" for r in pnd_results):
        print("  ⚠ No P&D-flagged tickers have return data — cannot evaluate P&D filter")

    print(f"\n--- AI Score Cutoff Sweep ({label}) ---")
    ai_results = sweep_ai_score(valid, ret_col)
    all_results.extend(ai_results)
    for r in ai_results:
        print(f"  score >= {r['threshold']:3d}: n={r['n_included']:4d}, "
              f"avg={r['avg_return']:+.3f}, med={r['median_return']:+.3f}, "
              f"win={r['win_rate']:.1%}, sharpe={r['sharpe_like']:.3f}")

    print(f"\n--- Stage Analysis ({label}) ---")
    stage_results = sweep_stage(valid, ret_col)
    all_results.extend(stage_results)
    for r in stage_results:
        print(f"  {r['parameter']:30s}: n={r['n_included']:4d}, "
              f"avg={r['avg_return']:+.3f}, med={r['median_return']:+.3f}, "
              f"win={r['win_rate']:.1%}, sharpe={r['sharpe_like']:.3f}")

    print(f"\n--- Individual P&D Flag Predictiveness ({label}) ---")
    flag_results = sweep_individual_flags(valid, ret_col)
    all_results.extend(flag_results)
    flag_results_sorted = sorted(flag_results, key=lambda r: r["avg_return"])
    for r in flag_results_sorted:
        diff = ""
        if r["avg_excluded_return"] is not None:
            d = r["avg_return"] - r["avg_excluded_return"]
            diff = f" (Δ {d:+.3f})"
        print(f"  {r['parameter']:30s}: n={r['n_included']:4d}, "
              f"avg={r['avg_return']:+.3f}, med={r['median_return']:+.3f}, "
              f"win={r['win_rate']:.1%}{diff}")
    if not flag_results:
        print("  (no individual flags present in return data)")

    print(f"\n--- Source Type Analysis ({label}) ---")
    source_results = sweep_source_type(valid, ret_col)
    all_results.extend(source_results)
    # Group by sweep type for cleaner output
    for stype, stype_label in [
        ("source_type", "Signal type (raw)"),
        ("source_count", "Source count"),
        ("source_presence", "Source presence"),
        ("source_combo", "Source combinations"),
    ]:
        subset_results = [r for r in source_results if r["sweep_type"] == stype]
        if not subset_results:
            continue
        print(f"  --- {stype_label} ---")
        subset_sorted = sorted(subset_results, key=lambda r: r["sharpe_like"], reverse=True)
        for r in subset_sorted:
            diff = ""
            if r.get("avg_excluded_return") is not None:
                d = r["avg_return"] - r["avg_excluded_return"]
                diff = f" (Δ {d:+.3f})"
            print(f"  {r['parameter']:25s}: n={r['n_included']:4d}, "
                  f"avg={r['avg_return']:+.3f}, med={r['median_return']:+.3f}, "
                  f"win={r['win_rate']:.1%}, sharpe={r['sharpe_like']:.3f}{diff}")
    if not source_results:
        print("  (no source type data available)")

    print(f"\n--- Market Cap Bucket Analysis ({label}) ---")
    mcap_results = sweep_market_cap(valid, ret_col)
    all_results.extend(mcap_results)
    # Print buckets first, then cumulative
    for sweep_type in ["market_cap_bucket", "market_cap_cumulative"]:
        subset_results = [r for r in mcap_results if r["sweep_type"] == sweep_type]
        if sweep_type == "market_cap_cumulative" and subset_results:
            print(f"  --- cumulative ---")
        for r in subset_results:
            print(f"  {r['parameter']:25s}: n={r['n_included']:4d}, "
                  f"avg={r['avg_return']:+.3f}, med={r['median_return']:+.3f}, "
                  f"win={r['win_rate']:.1%}, sharpe={r['sharpe_like']:.3f}")
    if not mcap_results:
        print("  (no market cap data available)")

    print(f"\n--- Interaction Analysis ({label}) ---")
    interaction_results = sweep_interactions(valid, ret_col)
    all_results.extend(interaction_results)
    # Group by dimension pair, sorted by Sharpe within each
    dim_pairs = sorted(set(r["sweep_type"] for r in interaction_results))
    for pair in dim_pairs:
        pair_results = [r for r in interaction_results if r["sweep_type"] == pair]
        pair_sorted = sorted(pair_results, key=lambda r: r["sharpe_like"], reverse=True)
        pair_label = pair.replace("interaction_", "").replace("_x_", " × ")
        print(f"  --- {pair_label} ---")
        for r in pair_sorted:
            print(f"    {r['parameter']:40s}: n={r['n_included']:4d}, "
                  f"avg={r['avg_return']:+.3f}, med={r['median_return']:+.3f}, "
                  f"win={r['win_rate']:.1%}, sharpe={r['sharpe_like']:.3f}")
    if not interaction_results:
        print("  (not enough data for interaction analysis)")

    # Save all results
    results_df = pd.DataFrame(all_results)
    out_path = OUTPUT_DIR / "sweep_results.csv"
    results_df.to_csv(out_path, index=False)
    print(f"\nAll sweep results saved to {out_path}")

    # Print best overall (consider all sweep types with n >= 5)
    candidates = [r for r in all_results if r["n_included"] >= 5]
    if candidates:
        best = max(candidates, key=lambda r: r["sharpe_like"])
        print(f"\n{'=' * 60}")
        print(f"BEST CONFIG ({label}): [{best['sweep_type']}] {best['parameter']}")
        print(f"  Avg return:    {best['avg_return']:+.3f}")
        print(f"  Median return: {best['median_return']:+.3f}")
        print(f"  Win rate:      {best['win_rate']:.1%}")
        print(f"  Big win rate:  {best['big_win_rate']:.1%}")
        print(f"  Sharpe-like:   {best['sharpe_like']:.3f}")
        print(f"  Sample size:   {best['n_included']}")
        print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
