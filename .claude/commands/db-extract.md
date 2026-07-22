---
description: Optional maintainer helper — extract a remote DB to parquet and restore into local dev
---

Optional maintainer workflow: dump a remote/source Postgres into parquet under `scripts/output/`, then optionally `pg_restore` into a local dev database. This does **not** assume a particular cloud vendor or production GCP project.

Prerequisites (only if you use the Cloud SQL Auth Proxy path in `scripts/extract.py`):
- `GCP_PROJECT_ID` set in the environment (required; no default project id)
- Optional: `GCP_REGION`, `GCP_INSTANCE_NAME`, `GCP_DB_USER`, `GCP_DB_NAME`
- `DB_PASSWORD` available via `.env` / `.env.production` / `.env.local`
- `cloud-sql-proxy` (or `cloud_sql_proxy`) on `PATH` when the script starts the proxy

Steps:
1. Verify local Postgres is running on port 5432 (`docker compose ps` — start with `docker compose up -d db` if not).
2. Ensure required env vars are set for your source DB / proxy path (at minimum `GCP_PROJECT_ID` + `DB_PASSWORD` if using the built-in Cloud SQL proxy helpers).
3. Run `python scripts/extract.py --restore-url "postgresql://postgres:postgres@localhost:5432/signalscope"` (timeout 600000 ms).
4. On success, report row counts from the manifest and note any `pg_restore` warnings (e.g. a `transaction_timeout` notice from PG17→PG16 is usually benign).

Notes:
- Never delete files in `scripts/output/` — they're the parquet exports consumed by the ML harness.
- The script may auto-start/stop a Cloud SQL Auth Proxy on port 5434 when that path is used; do not pass a restore URL pointing at 5434 or a Cloud SQL socket (the script refuses those).
- If the user passes `--no-restore` as an argument, forward it to skip the local DB overwrite.
- Skip this command entirely if you have no remote DB credentials or do not need a local clone.

Arguments: $ARGUMENTS
