"""
Step 4: Threshold parameter sweep using trained model + raw data.

Automatically selects the best available return horizon (7d > 3d > 1d).

Answers:
- What P&D flag count threshold maximizes returns?
- What AI score cutoff best separates winners from losers?
- What stage thresholds produce the best Sharpe-like ratio?
- Which individual P&D flags are most predictive of actual dumps?

Usage:
    python sweep.py
"""

import warnings
from pathlib import Path

import numpy as np
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


def sweep_combined(valid: pd.DataFrame, ret_col: str) -> list[dict]:
    """Sweep combinations of AI score + P&D flagged status."""
    results = []

    for ai_cutoff in [25, 30, 35, 40, 45, 50]:
        for pnd_flagged in [False, True]:
            label_pnd = "no_pnd" if not pnd_flagged else "any_pnd"
            included = valid[
                (valid["aiScore"] >= ai_cutoff) & (valid["pndFlagged"] == pnd_flagged)
            ]
            if len(included) < 5:
                continue

            results.append({
                "sweep_type": "combined",
                "parameter": f"ai>={ai_cutoff}_{label_pnd}",
                "threshold": None,
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


def main():
    print("Loading dataset...")
    raw_df = load_data()

    print("Engineering features...")
    feat_df, feature_names = engineer_features(raw_df)

    horizon = select_horizon(feat_df)
    ret_col = horizon["return"]
    label = horizon["label"]

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

    print(f"\n--- Combined Sweeps: AI Score + P&D Flag ({label}) ---")
    combined_results = sweep_combined(valid, ret_col)
    all_results.extend(combined_results)
    combined_sorted = sorted(combined_results, key=lambda r: r["sharpe_like"], reverse=True)
    for r in combined_sorted[:10]:
        print(f"  {r['parameter']:25s}: n={r['n_included']:4d}, "
              f"avg={r['avg_return']:+.3f}, med={r['median_return']:+.3f}, "
              f"win={r['win_rate']:.1%}, sharpe={r['sharpe_like']:.3f}")

    # Save all results
    results_df = pd.DataFrame(all_results)
    out_path = OUTPUT_DIR / "sweep_results.csv"
    results_df.to_csv(out_path, index=False)
    print(f"\nAll sweep results saved to {out_path}")

    # Print best overall
    if combined_sorted:
        best = combined_sorted[0]
        print(f"\n{'=' * 60}")
        print(f"BEST COMBINED CONFIG ({label}): {best['parameter']}")
        print(f"  Avg return:    {best['avg_return']:+.3f}")
        print(f"  Median return: {best['median_return']:+.3f}")
        print(f"  Win rate:      {best['win_rate']:.1%}")
        print(f"  Big win rate:  {best['big_win_rate']:.1%}")
        print(f"  Sharpe-like:   {best['sharpe_like']:.3f}")
        print(f"  Sample size:   {best['n_included']}")
        print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
