---
description: Extract production DB to parquet and restore into local dev DB
---

Run the production DB extract + pg_restore into the local dev database.

Steps:
1. Verify the local Postgres is running on port 5432 (`docker compose ps` — start with `docker compose up -d db` if not).
2. Run `python scripts/extract.py --restore-url "postgresql://postgres:postgres@localhost:5432/signalscope"` (timeout 600000 ms).
3. On success, report row counts from the manifest and note any `pg_restore` warnings (the `transaction_timeout` notice from PG17→PG16 is benign).

Notes:
- Never delete files in `scripts/output/` — they're the parquet exports consumed by the ML harness.
- The script auto-starts/stops the Cloud SQL Auth Proxy on port 5434; do not pass a restore URL pointing at 5434 or the Cloud SQL socket (the script refuses those).
- If the user passes `--no-restore` as an argument, forward it to skip the local DB overwrite.

Arguments: $ARGUMENTS
