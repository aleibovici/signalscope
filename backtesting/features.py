"""
Step 2: Feature engineering from raw DB columns.

Transforms raw parquet data into ML-ready features.
Can be imported by train.py and sweep.py.
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder

# All P&D flag names we one-hot encode
PND_FLAG_NAMES = [
    "penny_price",
    "otc_listing",
    "micro_cap_no_catalyst",
    "only_penny_subs",
    "single_source",
    "hyperbolic_language",
    "coordinated_posts",
    "no_news_catalyst",
    "sudden_spike",
    "twitter_bot_promoters",
    "twitter_coordinated_pump",
]

NUMERIC_FEATURES = [
    "aiScore", "rawAiScore", "signalCount", "sourceCount",
    "weightedSourceScore", "avgVelocity", "totalUpvotes", "totalComments",
    "subredditCount", "risingCount", "freshCount", "recentCount",
    "commentDerivedCount", "staleCount", "price", "marketCap",
    "shortFloat", "floatShares", "firstSeenDaysAgo", "priorAppearances",
    "pndScore",
]


def parse_52wk_range(range_str: str | None, price: float | None) -> float | None:
    """Parse '12.34 - 56.78' range and return price's position within it (0.0-1.0)."""
    if not range_str or not isinstance(range_str, str) or price is None:
        return None
    try:
        parts = range_str.split(" - ")
        if len(parts) != 2:
            return None
        low, high = float(parts[0]), float(parts[1])
        if high <= low:
            return None
        return (price - low) / (high - low)
    except (ValueError, ZeroDivisionError):
        return None


def engineer_features(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """
    Transform raw extracted data into ML features.

    Returns:
        (features_df, feature_names) — DataFrame with features + target columns,
        and list of feature column names.
    """
    feat = pd.DataFrame(index=df.index)

    # --- Numeric features (direct) ---
    for col in NUMERIC_FEATURES:
        if col in df.columns:
            feat[col] = pd.to_numeric(df[col], errors="coerce")

    # --- Derived features ---
    feat["log_market_cap"] = np.log10(feat["marketCap"].clip(lower=1))
    feat["log_upvotes"] = np.log2(feat.get("totalUpvotes", 0).fillna(0) + 1)
    feat["log_comments"] = np.log2(feat.get("totalComments", 0).fillna(0) + 1)

    upvotes = feat.get("totalUpvotes", pd.Series(0, index=df.index)).fillna(0)
    comments = feat.get("totalComments", pd.Series(0, index=df.index)).fillna(0)
    feat["engagement_score"] = np.minimum(np.log2(upvotes + comments + 1) * 1.5, 10)

    velocity = feat.get("avgVelocity", pd.Series(0, index=df.index)).fillna(0)
    feat["velocity_boost"] = np.minimum(velocity * 3, 10)

    feat["is_novel"] = df["firstSeenDaysAgo"].isna().astype(int)
    feat["is_stale"] = (
        (df["priorAppearances"].fillna(0) >= 3) | (df["firstSeenDaysAgo"].fillna(0) >= 7)
    ).astype(int)

    signal_type = df.get("signalType", pd.Series("", index=df.index)).fillna("")
    feat["social_only"] = signal_type.str.contains("reddit_velocity", case=False, na=False).astype(int)
    feat["has_insider"] = signal_type.str.contains("insider", case=False, na=False).astype(int)
    feat["has_options"] = signal_type.str.contains("options", case=False, na=False).astype(int)

    # Price position in 52-week range
    feat["price_in_52wk_pct"] = df.apply(
        lambda row: parse_52wk_range(row.get("fiftyTwoWkRange"), row.get("price")),
        axis=1,
    )

    signal_count = feat.get("signalCount", pd.Series(1, index=df.index)).fillna(1).clip(lower=1)
    feat["momentum_ratio"] = (
        feat.get("risingCount", 0).fillna(0) + feat.get("freshCount", 0).fillna(0)
    ) / signal_count
    feat["stale_ratio"] = feat.get("staleCount", 0).fillna(0) / signal_count

    # --- P&D flag booleans ---
    pnd_flags_col = df.get("pndFlags")
    if pnd_flags_col is not None:
        for flag_name in PND_FLAG_NAMES:
            col_name = f"flag_{flag_name}"
            feat[col_name] = pnd_flags_col.apply(
                lambda flags: 1 if isinstance(flags, list) and flag_name in flags else 0
            )

    # --- Categorical features ---
    exchange = df.get("exchange", pd.Series("", index=df.index)).fillna("").str.upper()
    exchange_map = {"NYSE": 0, "NYQ": 0, "NASDAQ": 1, "NMS": 1, "NGM": 1, "AMEX": 2, "ASE": 2}
    feat["exchange_cat"] = exchange.map(exchange_map).fillna(3).astype(int)

    for cat_col, source_col in [("sector_cat", "sector"), ("signal_type_cat", "signalType")]:
        if source_col in df.columns:
            le = LabelEncoder()
            values = df[source_col].fillna("unknown").astype(str)
            feat[cat_col] = le.fit_transform(values)
        else:
            feat[cat_col] = 0

    # --- Target variables ---
    feat["return_1d"] = pd.to_numeric(df.get("return1d"), errors="coerce")
    feat["return_3d"] = pd.to_numeric(df.get("return3d"), errors="coerce")
    feat["return_7d"] = pd.to_numeric(df.get("return7d"), errors="coerce")
    feat["return_30d"] = pd.to_numeric(df.get("return30d"), errors="coerce")
    feat["win_1d"] = (feat["return_1d"] > 0).astype(int)
    feat["win_3d"] = (feat["return_3d"] > 0).astype(int)
    feat["big_win_3d"] = (feat["return_3d"] > 0.03).astype(int)
    feat["win_7d"] = (feat["return_7d"] > 0).astype(int)
    feat["big_win_7d"] = (feat["return_7d"] > 0.05).astype(int)

    # Keep metadata for sweep.py
    feat["symbol"] = df["symbol"]
    feat["createdAt"] = df["createdAt"]
    feat["pndFlagged"] = df.get("pndFlagged", False)
    feat["stage"] = df.get("stage", "")

    # Build feature name list (excludes targets and metadata)
    target_cols = {"return_1d", "return_3d", "return_7d", "return_30d",
                   "win_1d", "win_3d", "big_win_3d", "win_7d", "big_win_7d"}
    meta_cols = {"symbol", "createdAt", "pndFlagged", "stage"}
    feature_names = [c for c in feat.columns if c not in target_cols and c not in meta_cols]

    return feat, feature_names
