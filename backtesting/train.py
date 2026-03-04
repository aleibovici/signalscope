"""
Step 3: XGBoost training + evaluation + SHAP analysis.

Automatically selects the best available return horizon (7d > 3d > 1d).

Usage:
    python train.py
"""

import warnings
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
import xgboost as xgb
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    recall_score,
    roc_auc_score,
)

from features import engineer_features

warnings.filterwarnings("ignore", category=FutureWarning)

OUTPUT_DIR = Path(__file__).parent / "output"

# Horizons in order of preference — pick the longest with enough data
HORIZONS = [
    {"return": "return_7d", "big_win": "big_win_7d", "label": "7d", "min_rows": 50},
    {"return": "return_3d", "big_win": "big_win_3d", "label": "3d", "min_rows": 50},
    {"return": "return_1d", "big_win": "win_1d",     "label": "1d", "min_rows": 50},
]


def load_data():
    parquet_path = OUTPUT_DIR / "dataset.parquet"
    if not parquet_path.exists():
        print("ERROR: dataset.parquet not found. Run extract.py first.")
        raise SystemExit(1)
    return pd.read_parquet(parquet_path)


def select_horizon(feat_df):
    """Pick the longest return horizon with enough data."""
    for h in HORIZONS:
        n = feat_df[h["return"]].notna().sum()
        if n >= h["min_rows"]:
            print(f"Selected horizon: {h['label']} ({n} rows with data)")
            return h
    # Print available counts to help debug
    for h in HORIZONS:
        n = feat_df[h["return"]].notna().sum()
        print(f"  {h['label']}: {n} rows")
    print("ERROR: Not enough performance data for any horizon (need >= 50 rows).")
    raise SystemExit(1)


def time_series_split(feat_df, feature_names, target_col, test_frac=0.2):
    """Split by time — last test_frac% of rows (already sorted by createdAt)."""
    valid = feat_df[feat_df[target_col].notna()].copy()
    if len(valid) == 0:
        print(f"ERROR: No rows with non-null {target_col}")
        raise SystemExit(1)

    split_idx = int(len(valid) * (1 - test_frac))
    train = valid.iloc[:split_idx]
    test = valid.iloc[split_idx:]

    X_train = train[feature_names].fillna(0)
    X_test = test[feature_names].fillna(0)
    y_train = train[target_col]
    y_test = test[target_col]

    print(f"  Train: {len(train)} rows ({train['createdAt'].min().date()} → {train['createdAt'].max().date()})")
    print(f"  Test:  {len(test)} rows ({test['createdAt'].min().date()} → {test['createdAt'].max().date()})")

    return X_train, X_test, y_train, y_test, test


def train_classifier(X_train, X_test, y_train, y_test, label):
    """Train XGBoost classifier on binary target."""
    pos_count = y_train.sum()
    neg_count = len(y_train) - pos_count
    scale_pos_weight = neg_count / max(pos_count, 1)

    model = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale_pos_weight,
        eval_metric="logloss",
        random_state=42,
        verbosity=0,
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    print(f"\n--- Classification Metrics ({label}) ---")
    print(f"  Accuracy:  {accuracy_score(y_test, y_pred):.3f}")
    print(f"  Precision: {precision_score(y_test, y_pred, zero_division=0):.3f}")
    print(f"  Recall:    {recall_score(y_test, y_pred, zero_division=0):.3f}")
    print(f"  F1:        {f1_score(y_test, y_pred, zero_division=0):.3f}")
    try:
        auc = roc_auc_score(y_test, y_prob)
        print(f"  AUC-ROC:   {auc:.3f}")
    except ValueError:
        print("  AUC-ROC:   N/A (single class in test set)")

    return model


def train_regressor(X_train, X_test, y_train, y_test, label):
    """Train XGBoost regressor on raw returns."""
    model = xgb.XGBRegressor(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric="rmse",
        random_state=42,
        verbosity=0,
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    y_pred = model.predict(X_test)

    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    ss_res = np.sum((y_test - y_pred) ** 2)
    ss_tot = np.sum((y_test - y_test.mean()) ** 2)
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0

    print(f"\n--- Regression Metrics ({label}) ---")
    print(f"  MAE:  {mae:.4f}")
    print(f"  RMSE: {rmse:.4f}")
    print(f"  R²:   {r2:.4f}")

    return model


def plot_feature_importance(model, feature_names):
    """Plot top 20 features by gain importance."""
    importance = model.get_booster().get_score(importance_type="gain")

    if not importance:
        print("  No feature importance data available.")
        return

    sorted_imp = sorted(importance.items(), key=lambda x: x[1], reverse=True)[:20]
    names, values = zip(*sorted_imp)

    fig, ax = plt.subplots(figsize=(10, 8))
    ax.barh(range(len(names)), values, color="#2563eb")
    ax.set_yticks(range(len(names)))
    ax.set_yticklabels(names, fontsize=9)
    ax.invert_yaxis()
    ax.set_xlabel("Gain")
    ax.set_title("Top 20 Feature Importance (XGBoost)")
    plt.tight_layout()
    fig.savefig(OUTPUT_DIR / "feature_importance.png", dpi=150)
    plt.close(fig)
    print(f"\n  Feature importance plot saved to output/feature_importance.png")


def run_shap_analysis(model, X_test, feature_names):
    """Generate SHAP summary and dependence plots."""
    print("\nRunning SHAP analysis (this may take a moment)...")
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_test)

    # Summary plot
    fig, ax = plt.subplots(figsize=(10, 8))
    shap.summary_plot(shap_values, X_test, feature_names=feature_names,
                      show=False, max_display=20)
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "shap_summary.png", dpi=150, bbox_inches="tight")
    plt.close("all")
    print(f"  SHAP summary plot saved to output/shap_summary.png")

    # Dependence plots for top 5 features by mean |SHAP|
    mean_abs_shap = np.abs(shap_values).mean(axis=0)
    top_indices = np.argsort(mean_abs_shap)[-5:][::-1]

    for rank, idx in enumerate(top_indices):
        fig, ax = plt.subplots(figsize=(8, 5))
        shap.dependence_plot(idx, shap_values, X_test,
                             feature_names=feature_names, show=False, ax=ax)
        plt.tight_layout()
        fig.savefig(OUTPUT_DIR / f"shap_dep_{rank+1}_{feature_names[idx]}.png",
                    dpi=150, bbox_inches="tight")
        plt.close(fig)

    print(f"  SHAP dependence plots saved for top 5 features")

    return shap_values, mean_abs_shap


def print_insights(shap_values, X_test, feature_names, feat_df, horizon):
    """Print actionable insights from SHAP analysis."""
    ret_col = horizon["return"]
    label = horizon["label"]
    mean_shap = shap_values.mean(axis=0)
    mean_abs_shap = np.abs(shap_values).mean(axis=0)

    sorted_idx = np.argsort(mean_abs_shap)[::-1]

    print("\n" + "=" * 60)
    print("ACTIONABLE INSIGHTS")
    print("=" * 60)

    # Features predicting gains
    gain_features = [(feature_names[i], mean_shap[i], mean_abs_shap[i])
                     for i in sorted_idx if mean_shap[i] > 0][:5]
    print("\nFeatures that most predict GAINS:")
    for name, mean_s, abs_s in gain_features:
        print(f"  + {name:30s} mean SHAP: {mean_s:+.4f}  |SHAP|: {abs_s:.4f}")

    # Features predicting losses
    loss_features = [(feature_names[i], mean_shap[i], mean_abs_shap[i])
                     for i in sorted_idx if mean_shap[i] < 0][:5]
    print("\nFeatures that most predict LOSSES:")
    for name, mean_s, abs_s in loss_features:
        print(f"  - {name:30s} mean SHAP: {mean_s:+.4f}  |SHAP|: {abs_s:.4f}")

    # P&D threshold analysis
    valid = feat_df[feat_df[ret_col].notna()]
    if len(valid) > 0:
        print(f"\nP&D Flag Count vs Avg Return ({label}):")
        print(f"  Current threshold: flags >= 3 → P&D filtered")
        for threshold in range(0, 6):
            subset = valid[valid["pndScore"] >= threshold] if threshold > 0 else valid
            if len(subset) > 0:
                avg_ret = subset[ret_col].mean()
                win_rate = (subset[ret_col] > 0).mean()
                print(f"  pndScore >= {threshold}: n={len(subset):4d}, "
                      f"avg return: {avg_ret:+.3f}, win rate: {win_rate:.1%}")

    # AI score threshold analysis
    if "aiScore" in feat_df.columns and len(valid) > 0:
        print(f"\nAI Score Threshold vs Avg Return ({label}):")
        for threshold in [50, 60, 65, 70, 75, 80]:
            subset = valid[valid["aiScore"] >= threshold]
            if len(subset) > 0:
                avg_ret = subset[ret_col].mean()
                win_rate = (subset[ret_col] > 0).mean()
                print(f"  aiScore >= {threshold}: n={len(subset):4d}, "
                      f"avg return: {avg_ret:+.3f}, win rate: {win_rate:.1%}")


def main():
    print("Loading dataset...")
    raw_df = load_data()
    print(f"Total rows: {len(raw_df)}")

    print("\nEngineering features...")
    feat_df, feature_names = engineer_features(raw_df)
    print(f"Features: {len(feature_names)}")

    # Select best available horizon
    horizon = select_horizon(feat_df)
    ret_col = horizon["return"]
    big_win_col = horizon["big_win"]
    label = horizon["label"]

    # --- Classification ---
    print("\n" + "=" * 60)
    print(f"CLASSIFIER: Predicting {big_win_col}")
    print("=" * 60)
    X_train, X_test, y_train, y_test, test_df = time_series_split(
        feat_df, feature_names, big_win_col
    )
    clf = train_classifier(X_train, X_test, y_train, y_test, big_win_col)

    # --- Regression ---
    print("\n" + "=" * 60)
    print(f"REGRESSOR: Predicting {ret_col}")
    print("=" * 60)
    X_train_r, X_test_r, y_train_r, y_test_r, _ = time_series_split(
        feat_df, feature_names, ret_col
    )
    reg = train_regressor(X_train_r, X_test_r, y_train_r, y_test_r, ret_col)

    # Save model
    reg.save_model(str(OUTPUT_DIR / "model.json"))
    print(f"\n  Model saved to output/model.json")

    # --- Feature importance + SHAP ---
    plot_feature_importance(reg, feature_names)
    shap_values, mean_abs_shap = run_shap_analysis(reg, X_test_r, feature_names)

    # --- Insights ---
    print_insights(shap_values, X_test_r, feature_names, feat_df, horizon)

    print("\nDone.")


if __name__ == "__main__":
    main()
