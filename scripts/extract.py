"""
Extract a remote/source database into local parquet files (one file per table).

Discovers every `public` base table, runs `SELECT *` with no row or column filtering,
and writes `scripts/output/<TableName>.parquet` plus `manifest.json` with row counts.

Then optionally replaces your **local** development database with a `pg_dump` /
`pg_restore` clone (schema + data). The restore target is **`DATABASE_URL_DEV`** (or
`--restore-url`), and must point to localhost / `host.docker.internal` (not Cloud SQL).
Requires PostgreSQL client tools (`pg_dump`, `pg_restore`) on `PATH`.

**Why one parquet per table:** Parquet is tabular; the database has many related tables.
A single file would require denormalizing joins (duplicated rows, huge files) or dropping
tables. Per-table files mirror the schema and are easy to load selectively for ML.

When using the Cloud SQL Auth Proxy path, set `GCP_PROJECT_ID` (required; no default).
Optionally set `GCP_REGION`, `GCP_INSTANCE_NAME`, `GCP_DB_USER`, `GCP_DB_NAME`.
The script starts the proxy, runs parquet export + `pg_dump`, restores into dev, then
stops the proxy.

Usage:
    export GCP_PROJECT_ID=your-gcp-project
    python extract.py
    python extract.py --no-restore   # parquet only, skip dev DB overwrite

Dependencies (venv recommended): pip install -r scripts/requirements.txt

Security: exports include sensitive columns (e.g. password hashes, API key material,
refresh tokens). Treat `scripts/output/` like credentials. Restoring to dev copies
source-DB credentials into your local DB.
"""

import argparse
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.parse import quote_plus, unquote, urlparse

import pandas as pd
import psycopg2
from dotenv import load_dotenv
from psycopg2 import sql

PROJECT_ROOT = Path(__file__).parent.parent

# Load from project root .env, fall back to .env.production, then .env.local
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(PROJECT_ROOT / ".env.production")
load_dotenv(PROJECT_ROOT / ".env.local")

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

# Cloud SQL connection details (require GCP_PROJECT_ID when using the proxy path)
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

LIST_PUBLIC_TABLES = """
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
"""


def parse_postgres_url(url: str) -> dict[str, str]:
    """Parse postgresql:// URLs into pg_dump/pg_restore CLI args."""
    p = urlparse(url)
    if p.scheme not in ("postgresql", "postgres"):
        raise ValueError(f"unsupported URL scheme: {p.scheme!r}")
    host = p.hostname
    if not host:
        raise ValueError("connection URL must include a host (TCP), not a unix socket")
    path = (p.path or "").lstrip("/")
    dbname = path.split("?")[0] if path else ""
    if not dbname:
        raise ValueError("connection URL must include a database name in the path")
    port = str(p.port or 5432)
    user = unquote(p.username) if p.username else ""
    password = unquote(p.password) if p.password else ""
    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "dbname": dbname,
    }


def is_safe_restore_target(url: str) -> bool:
    """True if URL looks like a local dev Postgres (not Cloud SQL / not the proxy port)."""
    u = url.strip()
    if not u:
        return False
    if "/cloudsql/" in u or "host=/cloudsql/" in u:
        return False
    try:
        p = urlparse(u)
    except Exception:
        return False
    if p.scheme not in ("postgresql", "postgres"):
        return False
    host = (p.hostname or "").lower()
    if host not in ("localhost", "127.0.0.1", "::1", "host.docker.internal"):
        return False
    if (p.port or 5432) == PROXY_PORT:
        return False
    path = (p.path or "").lstrip("/")
    dbname = path.split("?")[0] if path else ""
    return bool(dbname)


def resolve_restore_target_url(explicit_restore_url: str | None = None) -> tuple[str, str] | None:
    """
    URL and label for pg_restore.
    Explicit --restore-url wins.
    Else DATABASE_URL_DEV (optional second DB for harvester mirroring).
    """
    if explicit_restore_url and explicit_restore_url.strip():
        u = explicit_restore_url.strip()
        if not is_safe_restore_target(u):
            return None
        return u, "--restore-url"

    dev = os.environ.get("DATABASE_URL_DEV")
    if dev and dev.strip():
        u = dev.strip()
        if not is_safe_restore_target(u):
            return None
        return u, "DATABASE_URL_DEV"
    return None


def assert_not_proxy_port(dev: dict[str, str]) -> None:
    """Refuse to pg_restore onto the Cloud SQL proxy port (would overwrite production)."""
    if dev["port"] == str(PROXY_PORT):
        print(
            f"ERROR: restore target must not use port {PROXY_PORT} "
            "(Cloud SQL proxy / production). Point at your local Postgres (e.g. port 5432)."
        )
        sys.exit(1)


def require_pg_tools() -> None:
    for name in ("pg_dump", "pg_restore"):
        if not shutil.which(name):
            print(f"ERROR: {name} not found. Install PostgreSQL client tools (e.g. brew install libpq)")
            sys.exit(1)


def dump_production_custom(dump_path: Path, db_password: str) -> None:
    """Write a custom-format pg_dump of production (via localhost proxy)."""
    env = {**os.environ, "PGPASSWORD": db_password}
    cmd = [
        "pg_dump",
        "-h",
        "localhost",
        "-p",
        str(PROXY_PORT),
        "-U",
        DB_USER,
        "-d",
        DB_NAME,
        "-Fc",
        "--no-owner",
        "-f",
        str(dump_path),
    ]
    print("Running pg_dump from production (via proxy)...")
    r = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr or r.stdout or "(no output)")
        print("ERROR: pg_dump failed")
        sys.exit(1)


def restore_dump_to_dev(dump_path: Path, dev: dict[str, str]) -> None:
    """Replace dev database contents with the custom-format dump."""
    env = {**os.environ, "PGPASSWORD": dev["password"]}
    cmd = [
        "pg_restore",
        "-h",
        dev["host"],
        "-p",
        dev["port"],
        "-U",
        dev["user"],
        "-d",
        dev["dbname"],
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-acl",
        "--verbose",
        str(dump_path),
    ]
    print(
        f"Restoring to development database "
        f"{dev['user']}@{dev['host']}:{dev['port']}/{dev['dbname']} ..."
    )
    print("(Stop the Next.js dev server or other clients if restore fails on active connections.)")
    r = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if r.stdout:
        print(r.stdout, end="")
    if r.stderr:
        # pg_restore often prints notices to stderr even on success
        print(r.stderr, end="")
    # PostgreSQL: 0 = success, 1 = completed with warnings, >=2 = fatal
    if r.returncode >= 2:
        print("ERROR: pg_restore failed")
        sys.exit(1)
    if r.returncode == 1:
        print("pg_restore completed with warnings (exit code 1).")
    else:
        print("pg_restore completed successfully.")


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

    connection = instance_connection_name()
    proxy_name = Path(proxy_bin).name
    if proxy_name == "cloud-sql-proxy":
        # v2 syntax
        cmd = [proxy_bin, f"--port={PROXY_PORT}", connection]
    else:
        # v1 syntax
        cmd = [proxy_bin, f"-instances={connection}=tcp:{PROXY_PORT}"]

    print(f"Starting Cloud SQL proxy ({proxy_name})...")
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    # Wait up to 15s for proxy to be ready
    for _i in range(30):
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


def export_public_schema(conn) -> dict[str, int]:
    """Export every public base table to `<name>.parquet`; return table -> row counts."""
    with conn.cursor() as cur:
        cur.execute(LIST_PUBLIC_TABLES)
        tables = [row[0] for row in cur.fetchall()]

    if not tables:
        print("WARNING: no public tables found")
        return {}

    manifest: dict[str, int] = {}
    print(f"Exporting {len(tables)} tables (SELECT *, no filters)...")
    for table_name in tables:
        query = sql.SQL("SELECT * FROM {}").format(sql.Identifier(table_name))
        qstring = query.as_string(conn)
        df = pd.read_sql_query(qstring, conn)
        out_path = OUTPUT_DIR / f"{table_name}.parquet"
        df.to_parquet(out_path, index=False)
        manifest[table_name] = len(df)
        print(f"  {table_name}: {len(df)} rows × {len(df.columns)} columns → {out_path.name}")

    manifest_path = OUTPUT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"\nManifest: {manifest_path}")
    return manifest


def main():
    parser = argparse.ArgumentParser(description="Export production DB to parquet and optionally clone into dev.")
    parser.add_argument(
        "--no-restore",
        action="store_true",
        help="Skip pg_dump/pg_restore; only write parquet + manifest under scripts/output/",
    )
    parser.add_argument(
        "--restore-url",
        help=(
            "Explicit local restore target URL (postgresql://...). "
            "Overrides DATABASE_URL_DEV for this run."
        ),
    )
    args = parser.parse_args()

    db_password = os.environ.get("DB_PASSWORD")
    if not db_password:
        print("ERROR: DB_PASSWORD not found in .env.production")
        sys.exit(1)

    dev_conn: dict[str, str] | None = None
    if not args.no_restore:
        resolved = resolve_restore_target_url(args.restore_url)
        if not resolved:
            restore_raw = (args.restore_url or "").strip()
            if restore_raw and not is_safe_restore_target(restore_raw):
                print("ERROR: --restore-url is not a safe local URL (localhost / host.docker.internal, non-proxy port).")
                print("  Refuses Cloud SQL and port 5434 (production proxy).")
                sys.exit(1)
            dev_raw = (os.environ.get("DATABASE_URL_DEV") or "").strip()
            if dev_raw and not is_safe_restore_target(dev_raw):
                print("ERROR: DATABASE_URL_DEV is set but is not a safe local URL (localhost / host.docker.internal, non-proxy port).")
                print("  Refuses Cloud SQL and port 5434 (production proxy).")
                sys.exit(1)
            print("ERROR: No safe local database URL for pg_restore.")
            print("  Set DATABASE_URL_DEV to your local Postgres (e.g. postgresql://postgres:postgres@localhost:5432/signalscope),")
            print("  or pass --restore-url. URLs with Cloud SQL or port 5434 are refused.")
            sys.exit(1)
        restore_url, restore_label = resolved
        require_pg_tools()
        try:
            dev_conn = parse_postgres_url(restore_url)
        except ValueError as e:
            print(f"ERROR: invalid restore URL ({restore_label}): {e}")
            sys.exit(1)
        assert_not_proxy_port(dev_conn)
        print(
            f"Restore target: {restore_label} → "
            f"{dev_conn['user']}@{dev_conn['host']}:{dev_conn['port']}/{dev_conn['dbname']}"
        )

    proxy_proc = start_cloud_sql_proxy()

    database_url = (
        f"postgresql://{DB_USER}:{quote_plus(db_password)}"
        f"@localhost:{PROXY_PORT}/{DB_NAME}"
    )

    dump_path: Path | None = None
    try:
        print("Connecting to database...")
        conn = psycopg2.connect(database_url)
        try:
            manifest = export_public_schema(conn)
        finally:
            conn.close()

        total_rows = sum(manifest.values())
        print(f"\nParquet export done. {len(manifest)} tables, {total_rows} total rows → {OUTPUT_DIR}")

        if not args.no_restore:
            fd, dump_name = tempfile.mkstemp(prefix="signalscope-prod-", suffix=".dump")
            os.close(fd)
            dump_path = Path(dump_name)
            try:
                dump_production_custom(dump_path, db_password)
            finally:
                stop_cloud_sql_proxy(proxy_proc)
                proxy_proc = None

            if dev_conn is None:
                print("ERROR: internal error: dev connection not configured")
                sys.exit(1)
            restore_dump_to_dev(dump_path, dev_conn)
    finally:
        if dump_path is not None and dump_path.exists():
            try:
                dump_path.unlink()
            except OSError:
                pass
        stop_cloud_sql_proxy(proxy_proc)


if __name__ == "__main__":
    main()
