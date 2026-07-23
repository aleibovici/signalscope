"""
Extract a source database into local parquet files (one file per table).

Discovers every `public` base table, runs `SELECT *` with no row or column filtering,
and writes `scripts/output/<TableName>.parquet` plus `manifest.json` with row counts.

Then optionally replaces your **local** development database with a `pg_dump` /
`pg_restore` clone (schema + data). The restore target is **`DATABASE_URL_DEV`** (or
`--restore-url`) and must point at localhost / `host.docker.internal`, never at the
source database. Requires PostgreSQL client tools (`pg_dump`, `pg_restore`) on `PATH`.

**Why one parquet per table:** Parquet is tabular; the database has many related tables.
A single file would require denormalizing joins (duplicated rows, huge files) or dropping
tables. Per-table files mirror the schema and are easy to load selectively for ML.

Connection: reads `DATABASE_URL` by default, so it works against local Postgres,
Docker Compose, or any managed provider. Google Cloud SQL users who need the auth
proxy can pass `--cloud-sql-proxy` (see `scripts/db_connect.py`).

Usage:
    python scripts/extract.py                          # DATABASE_URL, parquet + dev restore
    python scripts/extract.py --no-restore             # parquet only
    python scripts/extract.py --database-url postgresql://...
    python scripts/extract.py --cloud-sql-proxy        # Google Cloud SQL auth proxy

Dependencies (venv recommended): pip install -r scripts/requirements.txt

Security: exports include sensitive columns (e.g. password hashes, API key material,
refresh tokens). Treat `scripts/output/` like credentials. Restoring to dev copies
source-DB credentials into your local DB.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlparse

import pandas as pd
import psycopg2
from psycopg2 import sql

from db_connect import (
    PROXY_PORT,
    add_connection_args,
    load_env,
    open_source_connection,
    parse_postgres_url,
)

load_env()

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

LIST_PUBLIC_TABLES = """
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
"""

LOCAL_HOSTS = ("localhost", "127.0.0.1", "::1", "host.docker.internal")


def is_safe_restore_target(url: str) -> bool:
    """True if the URL looks like a local dev Postgres (not a remote/proxied database)."""
    u = url.strip()
    if not u or "/cloudsql/" in u:
        return False
    try:
        p = urlparse(u)
    except ValueError:
        return False
    if p.scheme not in ("postgresql", "postgres"):
        return False
    if (p.hostname or "").lower() not in LOCAL_HOSTS:
        return False
    if (p.port or 5432) == PROXY_PORT:
        return False
    dbname = (p.path or "").lstrip("/").split("?")[0]
    return bool(dbname)


def resolve_restore_target_url(explicit_restore_url: str | None = None) -> tuple[str, str] | None:
    """
    URL and label for pg_restore.
    Explicit --restore-url wins, otherwise DATABASE_URL_DEV.
    """
    for candidate, label in (
        ((explicit_restore_url or "").strip(), "--restore-url"),
        ((os.environ.get("DATABASE_URL_DEV") or "").strip(), "DATABASE_URL_DEV"),
    ):
        if candidate:
            return (candidate, label) if is_safe_restore_target(candidate) else None
    return None


def require_pg_tools() -> None:
    for name in ("pg_dump", "pg_restore"):
        if not shutil.which(name):
            print(f"ERROR: {name} not found. Install PostgreSQL client tools (e.g. brew install libpq)")
            sys.exit(1)


def dump_source_custom(dump_path: Path, source_url: str) -> None:
    """Write a custom-format pg_dump of the source database."""
    src = parse_postgres_url(source_url)
    env = {**os.environ, "PGPASSWORD": src["password"]}
    cmd = [
        "pg_dump",
        "-h", src["host"],
        "-p", src["port"],
        "-U", src["user"],
        "-d", src["dbname"],
        "-Fc",
        "--no-owner",
        "-f", str(dump_path),
    ]
    print("Running pg_dump from the source database...")
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
        "-h", dev["host"],
        "-p", dev["port"],
        "-U", dev["user"],
        "-d", dev["dbname"],
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


def resolve_dev_connection(args) -> dict[str, str]:
    """Validate and parse the pg_restore target, exiting with guidance if unusable."""
    resolved = resolve_restore_target_url(args.restore_url)
    if not resolved:
        print("ERROR: No safe local database URL for pg_restore.")
        print("  Set DATABASE_URL_DEV to your local Postgres")
        print("  (e.g. postgresql://postgres:postgres@localhost:5432/signalscope), or pass --restore-url.")
        print(f"  Non-local hosts and port {PROXY_PORT} are refused so the source DB is never overwritten.")
        sys.exit(1)

    restore_url, restore_label = resolved
    require_pg_tools()
    try:
        dev = parse_postgres_url(restore_url)
    except ValueError as e:
        print(f"ERROR: invalid restore URL ({restore_label}): {e}")
        sys.exit(1)

    print(
        f"Restore target: {restore_label} → "
        f"{dev['user']}@{dev['host']}:{dev['port']}/{dev['dbname']}"
    )
    return dev


def main():
    parser = argparse.ArgumentParser(
        description="Export a PostgreSQL database to parquet and optionally clone it into your dev DB."
    )
    add_connection_args(parser)
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

    dev_conn = None if args.no_restore else resolve_dev_connection(args)

    source = open_source_connection(args)
    dump_path: Path | None = None
    try:
        print(f"Connecting to database ({source.label})...")
        conn = psycopg2.connect(source.url)
        try:
            manifest = export_public_schema(conn)
        finally:
            conn.close()

        total_rows = sum(manifest.values())
        print(f"\nParquet export done. {len(manifest)} tables, {total_rows} total rows → {OUTPUT_DIR}")

        if dev_conn is not None:
            fd, dump_name = tempfile.mkstemp(prefix="signalscope-export-", suffix=".dump")
            os.close(fd)
            dump_path = Path(dump_name)
            try:
                dump_source_custom(dump_path, source.url)
            finally:
                source.close()
            restore_dump_to_dev(dump_path, dev_conn)
    finally:
        if dump_path is not None and dump_path.exists():
            try:
                dump_path.unlink()
            except OSError:
                pass
        source.close()


if __name__ == "__main__":
    main()
