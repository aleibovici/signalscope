"""
Step 1: Extract validated ticker + performance data from production DB into local parquet.

Automatically starts Cloud SQL Auth Proxy, runs the query, then shuts it down.

Usage:
    python extract.py
"""

import os
import shutil
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import quote_plus

import pandas as pd
import psycopg2
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).parent.parent

# Load from backtesting/.env first, fall back to project root .env.production
load_dotenv(Path(__file__).parent / ".env")
load_dotenv(PROJECT_ROOT / ".env.production")

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

# Cloud SQL connection details
GCP_PROJECT = os.environ.get("GCP_PROJECT_ID", "signalscope-488702")
GCP_REGION = os.environ.get("GCP_REGION", "us-central1")
INSTANCE_NAME = "signalscope-db"
INSTANCE_CONNECTION = f"{GCP_PROJECT}:{GCP_REGION}:{INSTANCE_NAME}"
PROXY_PORT = 5433
DB_USER = "signalscope"
DB_NAME = "signalscope"

QUERY = """
WITH signal_agg AS (
  SELECT
    s."scanId",
    s.symbol,
    -- Total signal count
    COUNT(*)                                            AS signal_count,
    -- Per-source signal counts
    COUNT(*) FILTER (WHERE s.source = 'REDDIT')        AS reddit_count,
    COUNT(*) FILTER (WHERE s.source = 'TWITTER')       AS twitter_count,
    COUNT(*) FILTER (WHERE s.source = 'STOCKTWITS')    AS stocktwits_count,
    COUNT(*) FILTER (WHERE s.source = 'SEC_INSIDER')   AS sec_insider_count,
    COUNT(*) FILTER (WHERE s.source = 'OPTIONS_FLOW')  AS options_flow_count,
    COUNT(*) FILTER (WHERE s.source = 'VOLUME_SPIKE')  AS volume_spike_count,
    COUNT(*) FILTER (WHERE s.source = 'CONGRESS')      AS congress_count,
    -- Source diversity
    COUNT(DISTINCT s.source)                            AS source_count,
    -- Insider / congress quality
    MAX(s."purchaseValue") FILTER (WHERE s.source IN ('SEC_INSIDER', 'CONGRESS'))  AS max_insider_value,
    SUM(s."purchaseValue") FILTER (WHERE s.source IN ('SEC_INSIDER', 'CONGRESS'))  AS total_insider_value,
    MAX(s."purchaseValue") FILTER (WHERE s.source = 'CONGRESS')                    AS max_congress_value,
    COALESCE(
      BOOL_OR(s."insiderTitle" ILIKE '%ceo%' OR s."insiderTitle" ILIKE '%chief executive%')
      FILTER (WHERE s.source = 'SEC_INSIDER'),
      false
    )                                                   AS has_ceo_buy,
    -- Twitter quality
    MAX(s."followerCount") FILTER (WHERE s.source = 'TWITTER')      AS max_follower_count,
    SUM(s."retweetCount")  FILTER (WHERE s.source = 'TWITTER')      AS total_retweets,
    SUM(s."likeCount")     FILTER (WHERE s.source = 'TWITTER')      AS total_likes,
    -- Reddit quality
    MAX(s.upvotes)         FILTER (WHERE s.source = 'REDDIT')       AS max_reddit_upvotes,
    SUM(s.upvotes)         FILTER (WHERE s.source = 'REDDIT')       AS total_reddit_upvotes,
    SUM(s."commentCount")  FILTER (WHERE s.source = 'REDDIT')       AS total_reddit_comments,
    AVG(s."postAge")       FILTER (WHERE s.source = 'REDDIT')       AS avg_reddit_post_age,
    COUNT(DISTINCT s.subreddit) FILTER (WHERE s.source = 'REDDIT')  AS distinct_subreddits,
    -- Velocity / momentum (from raw postAge + sortType)
    AVG(s."velocityScore")                              AS avg_velocity,
    COUNT(*) FILTER (WHERE s."sortType" = 'rising')     AS rising_count,
    COUNT(*) FILTER (WHERE s."sortType" = 'comment')    AS comment_derived_count,
    COUNT(*) FILTER (WHERE s."postAge" IS NOT NULL AND s."postAge" < 3
                       AND COALESCE(s."sortType", '') NOT IN ('rising', 'comment'))   AS fresh_count,
    COUNT(*) FILTER (WHERE s."postAge" IS NOT NULL AND s."postAge" >= 3 AND s."postAge" < 12
                       AND COALESCE(s."sortType", '') NOT IN ('rising', 'comment'))   AS recent_count,
    COUNT(*) FILTER (WHERE s."postAge" IS NOT NULL AND s."postAge" >= 12
                       AND COALESCE(s."sortType", '') NOT IN ('rising', 'comment'))   AS stale_count,
    -- Volume spike quality
    MAX(s."volumeRatio") FILTER (WHERE s.source = 'VOLUME_SPIKE')   AS max_volume_ratio,
    AVG(s."volumeRatio") FILTER (WHERE s.source = 'VOLUME_SPIKE')   AS avg_volume_ratio
  FROM "Signal" s
  GROUP BY s."scanId", s.symbol
)
SELECT
  -- ValidatedTicker (all columns)
  vt.id,
  vt."scanId",
  vt.symbol,
  vt.price,
  vt."marketCap",
  vt."shortFloat",
  vt.catalyst,
  vt.risks,
  vt.recommendation,
  vt.report,
  vt."aiScore",
  vt.stage,
  vt."signalCount",
  vt."sourceCount",
  vt."avgSentiment",
  vt."signalType",
  vt."fiftyTwoWkRange",
  vt."wk52Lo",
  vt."wk52Hi",
  vt.exchange,
  vt."firstSeenDaysAgo",
  vt."priorAppearances",
  vt."weightedSourceScore",
  vt."avgVelocity",
  vt."totalUpvotes",
  vt."totalComments",
  vt."subredditCount",
  vt."risingCount",
  vt."freshCount",
  vt."recentCount",
  vt."commentDerivedCount",
  vt."staleCount",
  vt."aiReasoning",
  vt.sector,
  vt."floatShares",
  vt.name,
  vt."pndFlagged",
  vt."pndFlags",
  vt."pndScore",
  vt."rawAiScore",
  vt."pndAiConfidence",
  vt."pndAiReasoning",
  vt."medianSignalAgeHrs",
  vt."createdAt",
  -- TickerPerformance (all columns, prefixed to avoid conflicts)
  tp.id                  AS tp_id,
  tp."validatedTickerId",
  tp.symbol              AS tp_symbol,
  tp."detectionPrice",
  tp."price1d",
  tp."price3d",
  tp."price7d",
  tp."price30d",
  tp."return1d",
  tp."return3d",
  tp."return7d",
  tp."return30d",
  tp."snapped1dAt",
  tp."snapped3dAt",
  tp."snapped7dAt",
  tp."snapped30dAt",
  tp."createdAt"          AS tp_created_at,
  tp."updatedAt"          AS tp_updated_at,
  -- Signal-level aggregates (all computed from raw Signal table)
  sa.signal_count,
  sa.source_count,
  sa.reddit_count,
  sa.twitter_count,
  sa.stocktwits_count,
  sa.sec_insider_count,
  sa.options_flow_count,
  sa.volume_spike_count,
  sa.congress_count,
  sa.max_insider_value,
  sa.total_insider_value,
  sa.max_congress_value,
  sa.has_ceo_buy,
  sa.max_follower_count,
  sa.total_retweets,
  sa.total_likes,
  sa.max_reddit_upvotes,
  sa.total_reddit_upvotes,
  sa.total_reddit_comments,
  sa.avg_reddit_post_age,
  sa.distinct_subreddits,
  sa.avg_velocity,
  sa.rising_count,
  sa.comment_derived_count,
  sa.fresh_count,
  sa.recent_count,
  sa.stale_count,
  sa.max_volume_ratio,
  sa.avg_volume_ratio
FROM "ValidatedTicker" vt
LEFT JOIN "TickerPerformance" tp ON tp."validatedTickerId" = vt.id
LEFT JOIN signal_agg sa ON sa."scanId" = vt."scanId" AND sa.symbol = vt.symbol
WHERE vt.stage IS NOT NULL
ORDER BY vt."createdAt"
"""


def port_is_open(port: int, timeout: float = 1.0) -> bool:
    """Check if a TCP port is accepting connections on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(timeout)
        return s.connect_ex(("127.0.0.1", port)) == 0


def start_cloud_sql_proxy() -> subprocess.Popen | None:
    """Start Cloud SQL Auth Proxy and wait for it to be ready."""
    if port_is_open(PROXY_PORT):
        print(f"Cloud SQL proxy already running on port {PROXY_PORT}")
        return None

    # Try cloud-sql-proxy (v2) first, fall back to cloud_sql_proxy (v1)
    proxy_bin = shutil.which("cloud-sql-proxy") or shutil.which("cloud_sql_proxy")
    if not proxy_bin:
        print("ERROR: cloud-sql-proxy not found. Install it:")
        print("  brew install cloud-sql-proxy")
        print("  or: gcloud components install cloud-sql-proxy")
        sys.exit(1)

    proxy_name = Path(proxy_bin).name
    if proxy_name == "cloud-sql-proxy":
        # v2 syntax
        cmd = [proxy_bin, f"--port={PROXY_PORT}", INSTANCE_CONNECTION]
    else:
        # v1 syntax
        cmd = [proxy_bin, f"-instances={INSTANCE_CONNECTION}=tcp:{PROXY_PORT}"]

    print(f"Starting Cloud SQL proxy ({proxy_name})...")
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    # Wait up to 15s for proxy to be ready
    for i in range(30):
        if proc.poll() is not None:
            stderr = proc.stderr.read().decode() if proc.stderr else ""
            print(f"ERROR: Cloud SQL proxy exited immediately.\n{stderr}")
            sys.exit(1)
        if port_is_open(PROXY_PORT, timeout=0.5):
            print(f"Cloud SQL proxy ready on port {PROXY_PORT}")
            return proc
        time.sleep(0.5)

    proc.terminate()
    print("ERROR: Cloud SQL proxy failed to start within 15s")
    sys.exit(1)


def stop_cloud_sql_proxy(proc: subprocess.Popen | None):
    """Gracefully stop the Cloud SQL Auth Proxy."""
    if proc is None:
        return
    print("Stopping Cloud SQL proxy...")
    proc.send_signal(signal.SIGTERM)
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()


def main():
    db_password = os.environ.get("DB_PASSWORD")
    if not db_password:
        print("ERROR: DB_PASSWORD not found in .env.production")
        sys.exit(1)

    proxy_proc = start_cloud_sql_proxy()

    database_url = (
        f"postgresql://{DB_USER}:{quote_plus(db_password)}"
        f"@localhost:{PROXY_PORT}/{DB_NAME}"
    )

    try:
        print("Connecting to database...")
        conn = psycopg2.connect(database_url)
        try:
            print("Running extraction query...")
            df = pd.read_sql(QUERY, conn)
        finally:
            conn.close()

        out_path = OUTPUT_DIR / "dataset.parquet"
        df.to_parquet(out_path, index=False)

        print(f"\nExtracted {len(df)} rows, {len(df.columns)} columns")
        print(f"Date range: {df['createdAt'].min()} → {df['createdAt'].max()}")
        print(f"Unique symbols: {df['symbol'].nunique()}")
        print(f"Rows with return_7d: {df['return7d'].notna().sum()}")
        print(f"Saved to {out_path}")
    finally:
        stop_cloud_sql_proxy(proxy_proc)


if __name__ == "__main__":
    main()
