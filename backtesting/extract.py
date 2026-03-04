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
SELECT
  vt.id,
  vt.symbol,
  vt."scanId",
  vt."createdAt",
  -- Scoring inputs
  vt."aiScore",
  vt."rawAiScore",
  vt."signalCount",
  vt."sourceCount",
  vt."weightedSourceScore",
  vt."avgVelocity",
  vt."avgSentiment",
  vt."totalUpvotes",
  vt."totalComments",
  vt."subredditCount",
  vt."risingCount",
  vt."freshCount",
  vt."recentCount",
  vt."commentDerivedCount",
  vt."staleCount",
  -- Fundamentals
  vt.price,
  vt."marketCap",
  vt."shortFloat",
  vt."floatShares",
  vt.exchange,
  vt.sector,
  vt."signalType",
  -- Novelty
  vt."firstSeenDaysAgo",
  vt."priorAppearances",
  -- P&D
  vt."pndFlagged",
  vt."pndFlags",
  vt."pndScore",
  vt."pndAiConfidence",
  vt.stage,
  vt."fiftyTwoWkRange",
  -- Outcomes (labels)
  tp."detectionPrice",
  tp."return1d",
  tp."return3d",
  tp."return7d",
  tp."return30d",
  tp."price1d",
  tp."price3d",
  tp."price7d",
  tp."price30d"
FROM "ValidatedTicker" vt
LEFT JOIN "TickerPerformance" tp ON tp."validatedTickerId" = vt.id
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
