"""
Shared database connection helpers for the Python maintenance scripts.

Default path is a plain PostgreSQL connection string (``DATABASE_URL``), which
works for local Postgres, Docker Compose, and any managed provider that hands
you a URL. Hosts that require a local auth proxy (currently Google Cloud SQL)
are opt-in via ``--cloud-sql-proxy`` so nothing here assumes a specific cloud.
"""

import os
import shutil
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import parse_qsl, quote_plus, unquote, urlencode, urlparse, urlunparse

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).parent.parent

#: Local port the Cloud SQL Auth Proxy listens on when the opt-in path is used.
PROXY_PORT = int(os.environ.get("CLOUD_SQL_PROXY_PORT", "5434"))


def load_env() -> None:
    """Load .env then .env.local, without overriding already-exported vars."""
    load_dotenv(PROJECT_ROOT / ".env")
    load_dotenv(PROJECT_ROOT / ".env.local")

    # Opt-in extra env file for operators who keep deployment secrets separately.
    extra = os.environ.get("ENV_FILE")
    if extra:
        load_dotenv(PROJECT_ROOT / extra if not Path(extra).is_absolute() else Path(extra))


def add_connection_args(parser) -> None:
    """Register the connection flags shared by extract.py and pg_perf.py."""
    parser.add_argument(
        "--database-url",
        help="PostgreSQL connection URL to read from. Defaults to $DATABASE_URL.",
    )
    parser.add_argument(
        "--cloud-sql-proxy",
        action="store_true",
        help=(
            "Connect through a local Google Cloud SQL Auth Proxy instead of "
            "DATABASE_URL. Requires GCP_PROJECT_ID, DB_PASSWORD and cloud-sql-proxy on PATH."
        ),
    )


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
    return {
        "host": host,
        "port": str(p.port or 5432),
        "user": unquote(p.username) if p.username else "",
        "password": unquote(p.password) if p.password else "",
        "dbname": dbname,
    }


#: Query parameters Prisma understands but libpq rejects or ignores.
PRISMA_ONLY_PARAMS = {
    "schema",
    "connection_limit",
    "pool_timeout",
    "pgbouncer",
    "socket_timeout",
    "statement_cache_size",
}


def to_libpq_url(url: str) -> str:
    """
    Convert a Prisma-style connection URL into one libpq/psycopg2 accepts.

    Prisma URLs commonly carry `?schema=public`, which libpq rejects outright.
    Drop the Prisma-only parameters and translate a non-default schema into the
    equivalent `options=-c search_path=...`.
    """
    p = urlparse(url)
    params = parse_qsl(p.query, keep_blank_values=True)

    kept = [(k, v) for k, v in params if k not in PRISMA_ONLY_PARAMS]
    schema = next((v for k, v in params if k == "schema"), None)
    if schema and schema != "public" and not any(k == "options" for k, _ in kept):
        kept.append(("options", f"-c search_path={schema}"))

    return urlunparse(p._replace(query=urlencode(kept)))


def port_is_open(port: int, timeout: float = 1.0) -> bool:
    """Check if a TCP port is accepting connections on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(timeout)
        return s.connect_ex(("127.0.0.1", port)) == 0


def _require_env(name: str, hint: str) -> str:
    value = (os.environ.get(name) or "").strip()
    if not value:
        print(f"ERROR: {name} is required. {hint}")
        sys.exit(1)
    return value


def _instance_connection_name() -> str:
    project = _require_env(
        "GCP_PROJECT_ID",
        "Export it, e.g.: export GCP_PROJECT_ID=your-gcp-project",
    )
    region = os.environ.get("GCP_REGION", "us-central1")
    instance = _require_env(
        "GCP_INSTANCE_NAME",
        "Export the Cloud SQL instance name, e.g.: export GCP_INSTANCE_NAME=my-db",
    )
    return f"{project}:{region}:{instance}"


def start_cloud_sql_proxy() -> subprocess.Popen | None:
    """Start the Cloud SQL Auth Proxy and wait for it to accept connections."""
    if port_is_open(PROXY_PORT):
        print(f"Cloud SQL proxy already running on port {PROXY_PORT}")
        return None

    # cloud-sql-proxy (v2) first, then cloud_sql_proxy (v1)
    proxy_bin = shutil.which("cloud-sql-proxy") or shutil.which("cloud_sql_proxy")
    if not proxy_bin:
        print("ERROR: cloud-sql-proxy not found. Install it:")
        print("  brew install cloud-sql-proxy")
        print("  or: gcloud components install cloud-sql-proxy")
        sys.exit(1)

    connection = _instance_connection_name()
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
            print(f"ERROR: Cloud SQL proxy exited immediately.\n{stderr}")
            sys.exit(1)
        if port_is_open(PROXY_PORT, timeout=0.5):
            print(f"Cloud SQL proxy ready on port {PROXY_PORT}")
            return proc
        time.sleep(0.5)

    proc.terminate()
    print("ERROR: Cloud SQL proxy failed to start within 15s")
    sys.exit(1)


def stop_cloud_sql_proxy(proc: subprocess.Popen | None) -> None:
    """Gracefully stop the Cloud SQL Auth Proxy."""
    if proc is None:
        return
    print("Stopping Cloud SQL proxy...")
    proc.send_signal(signal.SIGTERM)
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()


class SourceConnection:
    """A resolved read connection plus any proxy process that backs it."""

    def __init__(self, url: str, label: str, proxy: subprocess.Popen | None):
        #: libpq-compatible URL, safe to hand to psycopg2 / pg_dump.
        self.url = to_libpq_url(url)
        self.label = label
        self._proxy = proxy

    @property
    def via_proxy(self) -> bool:
        return self._proxy is not None or self.label == "cloud-sql-proxy"

    def close(self) -> None:
        stop_cloud_sql_proxy(self._proxy)
        self._proxy = None


def open_source_connection(args) -> SourceConnection:
    """
    Resolve where to read data from.

    Default: --database-url or $DATABASE_URL (any PostgreSQL host).
    Opt-in:  --cloud-sql-proxy, which starts a local proxy and builds the URL
             from GCP_PROJECT_ID / GCP_INSTANCE_NAME / GCP_DB_USER / GCP_DB_NAME.
    """
    if getattr(args, "cloud_sql_proxy", False):
        db_user = os.environ.get("GCP_DB_USER", "signalscope")
        db_name = os.environ.get("GCP_DB_NAME", "signalscope")
        password = _require_env(
            "DB_PASSWORD",
            "Set the Cloud SQL user's password in your environment or .env file.",
        )
        proxy = start_cloud_sql_proxy()
        url = f"postgresql://{db_user}:{quote_plus(password)}@localhost:{PROXY_PORT}/{db_name}"
        return SourceConnection(url, "cloud-sql-proxy", proxy)

    url = (getattr(args, "database_url", None) or os.environ.get("DATABASE_URL") or "").strip()
    if not url:
        print(
            "ERROR: no database URL. Set DATABASE_URL, pass --database-url, "
            "or use --cloud-sql-proxy for Google Cloud SQL."
        )
        sys.exit(1)

    try:
        parse_postgres_url(url)
    except ValueError as e:
        print(f"ERROR: invalid database URL: {e}")
        sys.exit(1)

    return SourceConnection(url, "DATABASE_URL", None)
