"""
PostgreSQL performance analysis for SignalScope.

Connects via Cloud SQL Auth Proxy (same pattern as extract.py) and queries
pg_stat_statements, pg_stat_user_tables, pg_stat_user_indexes, and related
views to surface:

  1. Slowest / most-expensive queries (total_time, mean_time)
  2. Tables with heavy sequential scans (missing index candidates)
  3. Unused indexes (wasted write overhead)
  4. Dead tuple accumulation (VACUUM candidates)
  5. Cache hit rates (buffer pool efficiency)
  6. Table sizes

Usage:
    export GCP_PROJECT_ID=your-gcp-project
    python scripts/pg_perf.py            # full report
    python scripts/pg_perf.py --top 20   # show top 20 per section (default: 10)

Dependencies: pip install psycopg2-binary python-dotenv
Requires: GCP_PROJECT_ID, cloud-sql-proxy on PATH, DB_PASSWORD in .env / .env.production
"""

import argparse
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import quote_plus

import psycopg2
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).parent.parent
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(PROJECT_ROOT / ".env.production")
load_dotenv(PROJECT_ROOT / ".env.local")

GCP_REGION = os.environ.get("GCP_REGION", "us-central1")
INSTANCE_NAME = os.environ.get("GCP_INSTANCE_NAME", "signalscope-db")
PROXY_PORT = 5434
DB_USER = os.environ.get("GCP_DB_USER", "signalscope")
DB_NAME = os.environ.get("GCP_DB_NAME", "signalscope")


def require_gcp_project() -> str:
    """Return GCP_PROJECT_ID or exit with a clear error (no hardcoded prod project)."""
    project = (os.environ.get("GCP_PROJECT_ID") or "").strip()
    if not project:
        print(
            "ERROR: GCP_PROJECT_ID is required when using the Cloud SQL Auth Proxy path.\n"
            "  Export your project id, e.g.: export GCP_PROJECT_ID=your-gcp-project\n"
            "  Optional: GCP_REGION (default us-central1), GCP_INSTANCE_NAME, GCP_DB_USER, GCP_DB_NAME"
        )
        sys.exit(1)
    return project


def instance_connection_name() -> str:
    return f"{require_gcp_project()}:{GCP_REGION}:{INSTANCE_NAME}"

YELLOW = "\033[93m"
RED = "\033[91m"
GREEN = "\033[92m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

SEP = "─" * 90


def h(title: str) -> None:
    print(f"\n{BOLD}{CYAN}{title}{RESET}")
    print(SEP)


def warn(msg: str) -> None:
    print(f"  {YELLOW}⚠  {msg}{RESET}")


def ok(msg: str) -> None:
    print(f"  {GREEN}✓  {msg}{RESET}")


def bad(msg: str) -> None:
    print(f"  {RED}✗  {msg}{RESET}")


# ─── proxy helpers (same as extract.py) ───────────────────────────────────────

def port_is_open(port: int, timeout: float = 1.0) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(timeout)
        return s.connect_ex(("127.0.0.1", port)) == 0


def start_cloud_sql_proxy() -> subprocess.Popen | None:
    if port_is_open(PROXY_PORT):
        print(f"Cloud SQL proxy already running on port {PROXY_PORT}")
        return None
    proxy_bin = shutil.which("cloud-sql-proxy") or shutil.which("cloud_sql_proxy")
    if not proxy_bin:
        print("ERROR: cloud-sql-proxy not found. Install: brew install cloud-sql-proxy")
        sys.exit(1)
    connection = instance_connection_name()
    proxy_name = Path(proxy_bin).name
    if proxy_name == "cloud-sql-proxy":
        cmd = [proxy_bin, f"--port={PROXY_PORT}", connection]
    else:
        cmd = [proxy_bin, f"-instances={connection}=tcp:{PROXY_PORT}"]
    print(f"Starting Cloud SQL proxy ({proxy_name})...")
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    for _ in range(30):
        if proc.poll() is not None:
            stderr = proc.stderr.read().decode() if proc.stderr else ""
            print(f"ERROR: Cloud SQL proxy exited.\n{stderr}")
            sys.exit(1)
        if port_is_open(PROXY_PORT, timeout=0.5):
            print(f"Cloud SQL proxy ready on port {PROXY_PORT}\n")
            return proc
        time.sleep(0.5)
    proc.terminate()
    print("ERROR: Cloud SQL proxy failed to start within 15s")
    sys.exit(1)


def stop_cloud_sql_proxy(proc: subprocess.Popen | None) -> None:
    if proc is None:
        return
    proc.send_signal(signal.SIGTERM)
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()


# ─── analysis queries ──────────────────────────────────────────────────────────

def check_pg_stat_statements(cur, top: int) -> None:
    """Requires pg_stat_statements extension (enabled by default on Cloud SQL)."""
    h("1. SLOW / EXPENSIVE QUERIES  (pg_stat_statements)")

    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
        )
    """)
    if not cur.fetchone()[0]:
        warn("pg_stat_statements extension not enabled — skipping query stats.")
        print("     Enable it with:  CREATE EXTENSION pg_stat_statements;")
        return

    cur.execute(f"""
        SELECT
            calls,
            round(total_exec_time::numeric, 2)   AS total_ms,
            round(mean_exec_time::numeric,  2)   AS mean_ms,
            round(stddev_exec_time::numeric, 2)  AS stddev_ms,
            rows,
            round((shared_blks_hit * 100.0 /
                   NULLIF(shared_blks_hit + shared_blks_read, 0))::numeric, 1) AS cache_hit_pct,
            left(regexp_replace(query, '\\s+', ' ', 'g'), 120)  AS query_snippet
        FROM pg_stat_statements
        WHERE calls > 5
        ORDER BY total_exec_time DESC
        LIMIT {top}
    """)
    rows = cur.fetchall()
    cols = ["calls", "total_ms", "mean_ms", "stddev_ms", "rows", "cache%", "query"]
    _print_table(cols, rows, thresholds={
        "mean_ms":  (100, 1000),    # yellow ≥100 ms, red ≥1000 ms
        "total_ms": (5000, 30000),  # yellow ≥5 s, red ≥30 s
    })

    # Highlight worst offenders
    for row in rows:
        calls, total_ms, mean_ms = row[0], float(row[1]), float(row[2])
        snippet = row[6]
        if mean_ms >= 1000:
            bad(f"mean {mean_ms:,.0f} ms  (×{calls} calls)  → {snippet}")
        elif mean_ms >= 200:
            warn(f"mean {mean_ms:,.0f} ms  (×{calls} calls)  → {snippet}")


def check_seq_scans(cur, top: int) -> None:
    h("2. SEQUENTIAL SCANS  (missing index candidates)")

    cur.execute(f"""
        SELECT
            relname                             AS table,
            seq_scan,
            idx_scan,
            seq_tup_read,
            n_live_tup                          AS live_rows,
            round(seq_scan * 100.0 /
                  NULLIF(seq_scan + COALESCE(idx_scan, 0), 0), 1) AS seq_pct
        FROM pg_stat_user_tables
        WHERE seq_scan > 10
          AND n_live_tup > 1000          -- ignore tiny tables
        ORDER BY seq_scan DESC
        LIMIT {top}
    """)
    rows = cur.fetchall()
    cols = ["table", "seq_scans", "idx_scans", "tup_read", "live_rows", "seq%"]
    _print_table(cols, rows, thresholds={"seq_pct": (50, 80)})

    for row in rows:
        tbl, seq, idx, _, live, seq_pct = row
        idx = idx or 0
        if seq_pct is not None and float(seq_pct) >= 80 and live > 5000:
            bad(f"{tbl}: {seq_pct}% seq scans on {live:,} rows — add index?")
        elif seq_pct is not None and float(seq_pct) >= 50 and live > 10000:
            warn(f"{tbl}: {seq_pct}% seq scans on {live:,} rows — review queries")


def check_unused_indexes(cur) -> None:
    h("3. UNUSED INDEXES  (write overhead with no read benefit)")

    cur.execute("""
        SELECT
            s.relname                                        AS table,
            s.indexrelname                                   AS index,
            s.idx_scan,
            pg_size_pretty(pg_relation_size(s.indexrelid))   AS size
        FROM pg_stat_user_indexes s
        JOIN pg_index i ON i.indexrelid = s.indexrelid
        WHERE s.idx_scan = 0
          AND i.indisprimary = false
          AND i.indisunique  = false
          AND s.schemaname = 'public'
        ORDER BY pg_relation_size(s.indexrelid) DESC
    """)
    rows = cur.fetchall()
    if not rows:
        ok("No unused non-unique indexes found.")
        return
    cols = ["table", "index", "scans", "size"]
    _print_table(cols, rows)
    for tbl, idx, scans, size in rows:
        warn(f"DROP INDEX {idx};  -- on {tbl}, 0 scans, {size}")


def check_dead_tuples(cur, top: int) -> None:
    h("4. DEAD TUPLES  (VACUUM candidates)")

    cur.execute(f"""
        SELECT
            relname                 AS table,
            n_dead_tup,
            n_live_tup,
            round(n_dead_tup * 100.0 /
                  NULLIF(n_live_tup + n_dead_tup, 0), 1) AS dead_pct,
            last_autovacuum::date,
            last_autoanalyze::date
        FROM pg_stat_user_tables
        WHERE n_dead_tup > 1000
        ORDER BY n_dead_tup DESC
        LIMIT {top}
    """)
    rows = cur.fetchall()
    if not rows:
        ok("No significant dead-tuple accumulation.")
        return
    cols = ["table", "dead_tup", "live_tup", "dead%", "last_autovacuum", "last_autoanalyze"]
    _print_table(cols, rows, thresholds={"dead_pct": (10, 25)})

    for row in rows:
        tbl, dead, live, dead_pct, last_vac, last_ana = row
        if dead_pct is not None and float(dead_pct) >= 25:
            bad(f"{tbl}: {dead_pct}% dead tuples ({dead:,}) — run VACUUM ANALYZE {tbl};")
        elif dead_pct is not None and float(dead_pct) >= 10:
            warn(f"{tbl}: {dead_pct}% dead tuples — autovacuum last ran {last_vac}")


def check_cache_hit(cur) -> None:
    h("5. CACHE HIT RATES")

    cur.execute("""
        SELECT
            sum(heap_blks_hit)  AS heap_hit,
            sum(heap_blks_read) AS heap_read,
            round(sum(heap_blks_hit) * 100.0 /
                  NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) AS hit_pct
        FROM pg_statio_user_tables
    """)
    row = cur.fetchone()
    hit_pct = float(row[2]) if row[2] is not None else 0.0
    label = f"Table cache hit rate: {hit_pct:.1f}%"
    if hit_pct >= 99:
        ok(label)
    elif hit_pct >= 95:
        warn(label + "  (target ≥99% — consider increasing shared_buffers)")
    else:
        bad(label + "  (too many disk reads — shared_buffers too small?)")

    cur.execute("""
        SELECT
            sum(idx_blks_hit)  AS idx_hit,
            sum(idx_blks_read) AS idx_read,
            round(sum(idx_blks_hit) * 100.0 /
                  NULLIF(sum(idx_blks_hit) + sum(idx_blks_read), 0), 2) AS hit_pct
        FROM pg_statio_user_indexes
    """)
    row = cur.fetchone()
    hit_pct = float(row[2]) if row[2] is not None else 0.0
    label = f"Index cache hit rate: {hit_pct:.1f}%"
    if hit_pct >= 99:
        ok(label)
    elif hit_pct >= 95:
        warn(label)
    else:
        bad(label)


def check_table_sizes(cur, top: int) -> None:
    h("6. TABLE SIZES")

    cur.execute(f"""
        SELECT
            relname                                        AS table,
            pg_size_pretty(pg_total_relation_size(relid)) AS total,
            pg_size_pretty(pg_relation_size(relid))        AS heap,
            pg_size_pretty(pg_indexes_size(relid))         AS indexes,
            n_live_tup                                     AS live_rows
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(relid) DESC
        LIMIT {top}
    """)
    rows = cur.fetchall()
    cols = ["table", "total", "heap", "indexes", "live_rows"]
    _print_table(cols, rows)


def check_long_running(cur) -> None:
    h("7. LONG-RUNNING QUERIES  (currently active)")

    cur.execute("""
        SELECT
            pid,
            now() - query_start                            AS duration,
            state,
            wait_event_type,
            wait_event,
            left(query, 100)                               AS query_snippet
        FROM pg_stat_activity
        WHERE state != 'idle'
          AND query_start < now() - interval '5 seconds'
          AND query NOT LIKE '%pg_stat_activity%'
        ORDER BY query_start
    """)
    rows = cur.fetchall()
    if not rows:
        ok("No long-running queries at this moment.")
        return
    cols = ["pid", "duration", "state", "wait_type", "wait_event", "query"]
    _print_table(cols, rows)


# ─── table formatter ───────────────────────────────────────────────────────────

def _print_table(cols, rows, thresholds: dict | None = None) -> None:
    if not rows:
        print("  (no rows)")
        return
    thresholds = thresholds or {}
    data = [list(cols)] + [[str(v) if v is not None else "–" for v in row] for row in rows]
    widths = [max(len(str(cell)) for cell in col_data) for col_data in zip(*data)]

    def fmt_row(r, is_header=False):
        parts = []
        for i, (cell, w) in enumerate(zip(r, widths)):
            col_name = cols[i] if not is_header else None
            pad = str(cell).ljust(w)
            if is_header:
                parts.append(f"{BOLD}{pad}{RESET}")
            elif col_name in thresholds and cell != "–":
                try:
                    val = float(cell)
                    lo, hi = thresholds[col_name]
                    if val >= hi:
                        pad = f"{RED}{pad}{RESET}"
                    elif val >= lo:
                        pad = f"{YELLOW}{pad}{RESET}"
                except ValueError:
                    pass
                parts.append(pad)
            else:
                parts.append(pad)
        return "  " + "  ".join(parts)

    print(fmt_row(data[0], is_header=True))
    print("  " + "  ".join("─" * w for w in widths))
    for row in data[1:]:
        print(fmt_row(row))


# ─── main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="PostgreSQL performance analysis for SignalScope.")
    parser.add_argument("--top", type=int, default=10, help="Rows per section (default: 10)")
    args = parser.parse_args()

    db_password = os.environ.get("DB_PASSWORD")
    if not db_password:
        print("ERROR: DB_PASSWORD not found in .env / .env.production")
        sys.exit(1)

    proxy_proc = start_cloud_sql_proxy()
    database_url = (
        f"postgresql://{DB_USER}:{quote_plus(db_password)}"
        f"@localhost:{PROXY_PORT}/{DB_NAME}"
    )

    try:
        conn = psycopg2.connect(database_url)
        conn.autocommit = True
        cur = conn.cursor()

        print(f"\n{BOLD}SignalScope — PostgreSQL Performance Report{RESET}  (top {args.top} per section)")
        print(SEP)

        check_pg_stat_statements(cur, args.top)
        check_seq_scans(cur, args.top)
        check_unused_indexes(cur)
        check_dead_tuples(cur, args.top)
        check_cache_hit(cur)
        check_table_sizes(cur, args.top)
        check_long_running(cur)

        print(f"\n{SEP}")
        print(f"{BOLD}Done.{RESET}  Re-run after making changes to verify improvement.\n")

        cur.close()
        conn.close()
    finally:
        stop_cloud_sql_proxy(proxy_proc)


if __name__ == "__main__":
    main()
