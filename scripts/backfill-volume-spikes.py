"""
One-time backfill: compute historical volume ratios for existing ValidatedTickers
and insert VOLUME_SPIKE Signal rows where ratio >= 2x.

For each unique (date, symbol) across all scans, fetches historical volume data
from Yahoo Finance, computes the volume ratio on the detection date, and inserts
a VOLUME_SPIKE Signal row linked to the correct scanId.

Usage:
    python scripts/backfill-volume-spikes.py          # dry-run (default)
    python scripts/backfill-volume-spikes.py --commit  # actually write to DB
"""

import argparse
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote_plus

import psycopg2
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).parent.parent
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(PROJECT_ROOT / ".env.production")

GCP_PROJECT = os.environ.get("GCP_PROJECT_ID", "signalscope-488702")
INSTANCE_CONNECTION = f"{GCP_PROJECT}:us-central1:signalscope-db"
PROXY_PORT = 5434
DB_USER = "signalscope"
DB_NAME = "signalscope"

VOLUME_SPIKE_THRESHOLD = 2.0
YAHOO_BATCH_SIZE = 10
YAHOO_DELAY = 0.3  # seconds between batches


def generate_cuid() -> str:
    """Generate a cuid-like ID matching Prisma's default."""
    import random
    import string
    ts = hex(int(time.time() * 1000))[2:]
    rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=16))
    return f"cm{ts}{rand}"


def port_is_open(port: int, timeout: float = 1.0) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(timeout)
        return s.connect_ex(("127.0.0.1", port)) == 0


def start_proxy():
    if port_is_open(PROXY_PORT):
        print(f"Proxy already running on port {PROXY_PORT}")
        return None
    proxy_bin = shutil.which("cloud-sql-proxy")
    if not proxy_bin:
        print("ERROR: cloud-sql-proxy not found")
        sys.exit(1)
    proc = subprocess.Popen(
        [proxy_bin, f"--port={PROXY_PORT}", INSTANCE_CONNECTION],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    for _ in range(30):
        if proc.poll() is not None:
            sys.exit(1)
        if port_is_open(PROXY_PORT, 0.5):
            print(f"Proxy ready on port {PROXY_PORT}")
            return proc
        time.sleep(0.5)
    proc.terminate()
    sys.exit(1)


def stop_proxy(proc):
    if proc:
        proc.send_signal(signal.SIGTERM)
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


def fetch_historical_volume(symbol: str, detection_date: datetime) -> dict | None:
    """Fetch daily volume bars around the detection date from Yahoo Finance.

    Returns {regularMarketVolume, averageDailyVolume10Day, ratio} or None.
    """
    import urllib.request

    # Fetch 20 days ending a day after detection to ensure we capture it
    end_ts = int((detection_date + timedelta(days=2)).timestamp())
    start_ts = int((detection_date - timedelta(days=20)).timestamp())

    url = (
        f"https://query2.finance.yahoo.com/v8/finance/chart/{symbol}"
        f"?interval=1d&period1={start_ts}&period2={end_ts}"
    )

    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    })

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
    except Exception:
        return None

    result = data.get("chart", {}).get("result", [None])[0]
    if not result:
        return None

    timestamps = result.get("timestamp", [])
    volumes = result.get("indicators", {}).get("quote", [{}])[0].get("volume", [])

    if not timestamps or not volumes:
        return None

    # Find the bar closest to the detection date
    target_ts = detection_date.timestamp()
    best_idx = None
    best_diff = float("inf")
    for i, ts in enumerate(timestamps):
        diff = abs(ts - target_ts)
        if diff < best_diff:
            best_diff = diff
            best_idx = i

    if best_idx is None or best_idx < 1:
        return None

    detection_vol = volumes[best_idx]
    if detection_vol is None or detection_vol <= 0:
        return None

    # Compute average of prior bars (up to 10)
    prior = [v for v in volumes[:best_idx] if v is not None and v > 0]
    if not prior:
        return None

    avg_vol = sum(prior) / len(prior)
    if avg_vol <= 0:
        return None

    ratio = detection_vol / avg_vol
    return {
        "regularMarketVolume": detection_vol,
        "averageDailyVolume10Day": round(avg_vol),
        "ratio": round(ratio, 2),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", action="store_true", help="Actually write to DB (default: dry-run)")
    args = parser.parse_args()

    db_password = os.environ.get("DB_PASSWORD")
    if not db_password:
        print("ERROR: DB_PASSWORD not found")
        sys.exit(1)

    proxy_proc = start_proxy()
    conn_str = f"postgresql://{DB_USER}:{quote_plus(db_password)}@localhost:{PROXY_PORT}/{DB_NAME}"

    try:
        conn = psycopg2.connect(conn_str)
        cur = conn.cursor()

        # Get all (scanId, symbol, detectionDate) tuples that need backfill
        cur.execute("""
            SELECT vt."scanId", vt.symbol, vt."createdAt"
            FROM "ValidatedTicker" vt
            LEFT JOIN "Signal" s
              ON s."scanId" = vt."scanId" AND s.symbol = vt.symbol AND s.source = 'VOLUME_SPIKE'
            WHERE vt.stage IS NOT NULL
              AND s.id IS NULL
            ORDER BY vt."createdAt"
        """)
        targets = cur.fetchall()
        print(f"ValidatedTickers without VOLUME_SPIKE signal: {len(targets)}")

        # Deduplicate by (symbol, date) to minimize Yahoo requests
        # Map: (symbol, date_str) -> [list of scanIds]
        symbol_date_scans: dict[tuple[str, str], list[str]] = {}
        for scan_id, symbol, created_at in targets:
            key = (symbol, created_at.strftime("%Y-%m-%d"))
            if key not in symbol_date_scans:
                symbol_date_scans[key] = []
            symbol_date_scans[key].append(scan_id)

        unique_lookups = list(symbol_date_scans.keys())
        print(f"Unique (symbol, date) pairs to check: {len(unique_lookups)}")

        # Fetch volume data in batches
        spikes_found = 0
        signals_to_insert = []

        for i in range(0, len(unique_lookups), YAHOO_BATCH_SIZE):
            batch = unique_lookups[i:i + YAHOO_BATCH_SIZE]

            for symbol, date_str in batch:
                detection_date = datetime.strptime(date_str, "%Y-%m-%d")
                vol_data = fetch_historical_volume(symbol, detection_date)

                if vol_data and vol_data["ratio"] >= VOLUME_SPIKE_THRESHOLD:
                    spikes_found += 1
                    scan_ids = symbol_date_scans[(symbol, date_str)]
                    ratio = vol_data["ratio"]
                    reg_vol = vol_data["regularMarketVolume"]
                    avg_vol = vol_data["averageDailyVolume10Day"]

                    for scan_id in scan_ids:
                        signals_to_insert.append({
                            "id": generate_cuid(),
                            "scanId": scan_id,
                            "symbol": symbol,
                            "source": "VOLUME_SPIKE",
                            "title": f"Volume spike: {symbol} at {ratio:.1f}x average volume (backfill)",
                            "body": f"Detection-day volume: {reg_vol:,}, avg: {avg_vol:,}, ratio: {ratio:.2f}x",
                            "volumeRatio": ratio,
                            "velocityScore": 0,
                            "pndFlagged": False,
                            "pndScore": 0,
                        })

            processed = min(i + YAHOO_BATCH_SIZE, len(unique_lookups))
            if processed % 100 == 0 or processed == len(unique_lookups):
                print(f"  Checked {processed}/{len(unique_lookups)} — spikes found: {spikes_found}")

            if i + YAHOO_BATCH_SIZE < len(unique_lookups):
                time.sleep(YAHOO_DELAY)

        print(f"\nResults:")
        print(f"  Symbols with volume spike on detection day: {spikes_found}")
        print(f"  Signal rows to insert: {len(signals_to_insert)}")

        if not signals_to_insert:
            print("No spikes found — nothing to insert.")
            return

        if not args.commit:
            print("\nDry-run mode. Pass --commit to write to DB.")
            # Show sample
            for s in signals_to_insert[:5]:
                print(f"  {s['symbol']} scanId={s['scanId'][:16]}... ratio={s['volumeRatio']}x")
            if len(signals_to_insert) > 5:
                print(f"  ... and {len(signals_to_insert) - 5} more")
            return

        # Insert signals
        print("Inserting signals...")
        insert_sql = """
            INSERT INTO "Signal" (
                id, "scanId", symbol, source, title, body,
                "volumeRatio", "velocityScore", "pndFlagged", "pndScore"
            ) VALUES (
                %(id)s, %(scanId)s, %(symbol)s, %(source)s, %(title)s, %(body)s,
                %(volumeRatio)s, %(velocityScore)s, %(pndFlagged)s, %(pndScore)s
            )
            ON CONFLICT (id) DO NOTHING
        """
        for s in signals_to_insert:
            cur.execute(insert_sql, s)

        conn.commit()
        print(f"Inserted {len(signals_to_insert)} VOLUME_SPIKE signals.")

        # Verify
        cur.execute("""
            SELECT COUNT(*) FROM "Signal" WHERE source = 'VOLUME_SPIKE'
        """)
        print(f"Total VOLUME_SPIKE signals in DB: {cur.fetchone()[0]}")

    finally:
        conn.close()
        stop_proxy(proxy_proc)


if __name__ == "__main__":
    main()
