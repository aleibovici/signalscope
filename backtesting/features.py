"""
Step 2: Feature engineering from raw signal data.

Transforms raw extracted data into ML-ready features.
Only uses raw signal data and fundamentals — no AI-generated or pipeline-computed fields.
Can be imported by train.py and sweep.py.
"""

import numpy as np
import pandas as pd


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


def compute_pct_from_52wk_low(row) -> float | None:
    """Compute (price - 52wk_low) / 52wk_low, preferring direct column over string parsing."""
    price = row.get("price")
    if price is None:
        return None
    wk52_lo = row.get("wk52Lo")
    if wk52_lo is not None and float(wk52_lo) > 0:
        return (price - float(wk52_lo)) / float(wk52_lo)
    range_str = row.get("fiftyTwoWkRange")
    if range_str and isinstance(range_str, str):
        try:
            low = float(range_str.split(" - ")[0])
            if low > 0:
                return (price - low) / low
        except (ValueError, IndexError):
            pass
    return None


def get_wk52_lo(row) -> float | None:
    """Get 52-week low, preferring direct column over string parsing."""
    val = row.get("wk52Lo")
    if val is not None:
        return float(val)
    range_str = row.get("fiftyTwoWkRange")
    if range_str and isinstance(range_str, str):
        try:
            return float(range_str.split(" - ")[0])
        except (ValueError, IndexError):
            pass
    return None


def get_wk52_hi(row) -> float | None:
    """Get 52-week high, preferring direct column over string parsing."""
    val = row.get("wk52Hi")
    if val is not None:
        return float(val)
    range_str = row.get("fiftyTwoWkRange")
    if range_str and isinstance(range_str, str):
        try:
            return float(range_str.split(" - ")[1])
        except (ValueError, IndexError):
            pass
    return None


def engineer_features(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """
    Transform raw extracted data into ML features.

    All features are derived from raw signal data (Signal table) and
    fundamentals (Yahoo Finance). No AI scores, P&D flags, pipeline stages,
    or other computed fields are used as inputs.

    Returns:
        (features_df, feature_names) — DataFrame with features + target columns,
        and list of feature column names.
    """
    feat = pd.DataFrame(index=df.index)

    # --- Signal counts (from signal_agg CTE, raw Signal table) ---
    feat["signal_count"] = pd.to_numeric(df.get("signal_count", 0), errors="coerce").fillna(0)
    feat["source_count"] = pd.to_numeric(df.get("source_count", 0), errors="coerce").fillna(0)

    # --- Fundamentals (raw from Yahoo Finance) ---
    feat["price"] = pd.to_numeric(df.get("price"), errors="coerce")
    feat["marketCap"] = pd.to_numeric(df.get("marketCap"), errors="coerce")
    feat["shortFloat"] = pd.to_numeric(df.get("shortFloat"), errors="coerce")
    feat["floatShares"] = pd.to_numeric(df.get("floatShares"), errors="coerce")

    feat["log_market_cap"] = np.log10(feat["marketCap"].clip(lower=1).fillna(1))
    feat["log_price"] = np.log10(feat["price"].clip(lower=0.001).fillna(0.001))

    # 52-week range features (prefer direct columns, fall back to string parsing)
    feat["pct_from_52wk_low"] = df.apply(compute_pct_from_52wk_low, axis=1)
    feat["wk52_lo"] = df.apply(get_wk52_lo, axis=1)
    feat["wk52_hi"] = df.apply(get_wk52_hi, axis=1)

    # --- Novelty (DB lookups, not AI) ---
    feat["firstSeenDaysAgo"] = pd.to_numeric(df.get("firstSeenDaysAgo"), errors="coerce")
    feat["priorAppearances"] = pd.to_numeric(df.get("priorAppearances", 0), errors="coerce").fillna(0)
    feat["is_novel"] = df["firstSeenDaysAgo"].isna().astype(int)
    feat["is_repeat"] = (feat["priorAppearances"] >= 3).astype(int)

    # --- Per-source presence flags ---
    for src_col, feat_name in [
        ("reddit_count", "has_reddit"),
        ("twitter_count", "has_twitter"),
        ("sec_insider_count", "has_insider"),
        ("options_flow_count", "has_options"),
        ("congress_count", "has_congress"),
        ("volume_spike_count", "has_volume_spike"),
    ]:
        feat[feat_name] = (pd.to_numeric(df.get(src_col, 0), errors="coerce").fillna(0) > 0).astype(int)

    # social_only: no non-social source exists
    non_social = (
        pd.to_numeric(df.get("sec_insider_count", 0), errors="coerce").fillna(0)
        + pd.to_numeric(df.get("options_flow_count", 0), errors="coerce").fillna(0)
        + pd.to_numeric(df.get("congress_count", 0), errors="coerce").fillna(0)
        + pd.to_numeric(df.get("volume_spike_count", 0), errors="coerce").fillna(0)
    )
    feat["social_only"] = (non_social == 0).astype(int)

    # --- Per-source raw counts ---
    for col in ["reddit_count", "twitter_count", "sec_insider_count",
                "volume_spike_count", "congress_count"]:
        feat[col] = pd.to_numeric(df.get(col, 0), errors="coerce").fillna(0)

    # --- Reddit quality (raw from Signal table) ---
    feat["max_reddit_upvotes"] = pd.to_numeric(df.get("max_reddit_upvotes", 0), errors="coerce").fillna(0)
    feat["total_reddit_upvotes"] = pd.to_numeric(df.get("total_reddit_upvotes", 0), errors="coerce").fillna(0)
    feat["total_reddit_comments"] = pd.to_numeric(df.get("total_reddit_comments", 0), errors="coerce").fillna(0)
    feat["distinct_subreddits"] = pd.to_numeric(df.get("distinct_subreddits", 0), errors="coerce").fillna(0)
    feat["avg_reddit_post_age"] = pd.to_numeric(df.get("avg_reddit_post_age"), errors="coerce")

    feat["log_reddit_upvotes"] = np.log2(feat["total_reddit_upvotes"] + 1)
    feat["log_reddit_comments"] = np.log2(feat["total_reddit_comments"] + 1)

    # --- Twitter quality (raw from Signal table) ---
    followers = pd.to_numeric(df.get("max_follower_count", 0), errors="coerce").fillna(0).clip(lower=0)
    feat["log_max_followers"] = np.log10(followers + 1)
    feat["total_retweets"] = pd.to_numeric(df.get("total_retweets", 0), errors="coerce").fillna(0)
    feat["total_likes"] = pd.to_numeric(df.get("total_likes", 0), errors="coerce").fillna(0)

    # --- Insider quality (raw from Signal table) ---
    insider_val = pd.to_numeric(df.get("max_insider_value", 0), errors="coerce").fillna(0).clip(lower=0)
    feat["log_insider_value"] = np.log10(insider_val + 1)
    congress_val = pd.to_numeric(df.get("max_congress_value", 0), errors="coerce").fillna(0).clip(lower=0)
    feat["log_congress_value"] = np.log10(congress_val + 1)
    feat["has_ceo_buy"] = df.get("has_ceo_buy", False).fillna(False).astype(int)

    # --- Volume spike quality (raw from Signal table) ---
    feat["max_volume_ratio"] = pd.to_numeric(df.get("max_volume_ratio"), errors="coerce")
    feat["avg_volume_ratio"] = pd.to_numeric(df.get("avg_volume_ratio"), errors="coerce")

    # --- Velocity / momentum (computed from raw postAge + sortType in SQL) ---
    feat["avg_velocity"] = pd.to_numeric(df.get("avg_velocity", 0), errors="coerce").fillna(0)
    feat["rising_count"] = pd.to_numeric(df.get("rising_count", 0), errors="coerce").fillna(0)
    feat["fresh_count"] = pd.to_numeric(df.get("fresh_count", 0), errors="coerce").fillna(0)
    feat["recent_count"] = pd.to_numeric(df.get("recent_count", 0), errors="coerce").fillna(0)
    feat["comment_derived_count"] = pd.to_numeric(df.get("comment_derived_count", 0), errors="coerce").fillna(0)
    feat["stale_count"] = pd.to_numeric(df.get("stale_count", 0), errors="coerce").fillna(0)

    signal_count = feat["signal_count"].clip(lower=1)
    feat["momentum_ratio"] = (feat["rising_count"] + feat["fresh_count"]) / signal_count
    feat["stale_ratio"] = feat["stale_count"] / signal_count

    # --- Exchange one-hot features ---
    exchange = df.get("exchange", pd.Series("", index=df.index)).fillna("")
    feat["exchange_NYSE American"] = exchange.str.contains("American", case=False, na=False).astype(int)
    feat["exchange_NasdaqGS"] = exchange.str.contains("NasdaqGS", case=False, na=False).astype(int)
    feat["exchange_NasdaqCM"] = exchange.str.contains("NasdaqCM", case=False, na=False).astype(int)
    feat["exchange_NasdaqGM"] = exchange.str.contains("NasdaqGM|Global Market", case=False, na=False).astype(int)
    feat["exchange_NYSE"] = (exchange.str.upper() == "NYSE").astype(int)
    feat["exchange_NYSEArca"] = exchange.str.contains("Arca", case=False, na=False).astype(int)

    # --- Exchange-penny interaction features ---
    price_series = feat["price"].fillna(999)
    feat["amex_penny"] = ((feat["exchange_NYSE American"] == 1) & (price_series < 5)).astype(int)
    feat["nasdaqcm_penny"] = ((feat["exchange_NasdaqCM"] == 1) & (price_series < 5)).astype(int)
    feat["nasdaqgm_penny"] = ((feat["exchange_NasdaqGM"] == 1) & (price_series < 5)).astype(int)

    # --- Binary price flags ---
    feat["is_cheap"] = (price_series < 5).astype(int)
    feat["is_penny"] = (price_series < 1).astype(int)
    feat["is_near_low"] = (feat["pct_from_52wk_low"].fillna(1) < 0.1).astype(int)

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

    # Keep metadata for sweep.py (not used as features)
    feat["symbol"] = df["symbol"]
    feat["createdAt"] = df["createdAt"]
    feat["detectionPrice"] = pd.to_numeric(df.get("detectionPrice"), errors="coerce")

    # Build feature name list (excludes targets and metadata)
    target_cols = {"return_1d", "return_3d", "return_7d", "return_30d",
                   "win_1d", "win_3d", "big_win_3d", "win_7d", "big_win_7d"}
    meta_cols = {"symbol", "createdAt", "detectionPrice"}
    feature_names = [c for c in feat.columns if c not in target_cols and c not in meta_cols]

    # Drop zero-variance features (e.g. volume spike columns when dataset has no volume spike signals)
    zero_var = [c for c in feature_names if feat[c].nunique(dropna=True) <= 1]
    if zero_var:
        print(f"  Dropping {len(zero_var)} zero-variance features: {zero_var}")
        feature_names = [c for c in feature_names if c not in zero_var]

    return feat, feature_names


# Minimum detection price to exclude phantom Yahoo Finance prices ($0.00001 OTC stocks)
MIN_DETECTION_PRICE = 0.01


def clean_for_analysis(df: pd.DataFrame, ret_col: str) -> pd.DataFrame:
    """Clean dataset for return analysis: drop nulls, phantom prices, dedup by symbol.

    Keeps first appearance of each symbol (sorted by createdAt) to avoid
    pseudo-replication from the same ticker appearing across multiple scans.
    """
    valid = df[df[ret_col].notna()].copy()

    # Exclude phantom prices (Yahoo Finance returns $0.00001 for some OTC stocks)
    if "detectionPrice" in valid.columns:
        n_before = len(valid)
        valid = valid[valid["detectionPrice"] > MIN_DETECTION_PRICE]
        n_phantom = n_before - len(valid)
        if n_phantom > 0:
            print(f"  Excluded {n_phantom} rows with phantom price (<=${MIN_DETECTION_PRICE})")

    # Deduplicate by symbol — keep first appearance per symbol
    n_before = len(valid)
    valid = valid.sort_values("createdAt").drop_duplicates(subset="symbol", keep="first")
    n_dupes = n_before - len(valid)
    if n_dupes > 0:
        print(f"  Deduped {n_dupes} repeat-symbol rows ({n_before} → {len(valid)} unique symbols)")

    return valid
