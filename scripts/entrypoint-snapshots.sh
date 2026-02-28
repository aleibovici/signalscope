#!/bin/sh
set -e

echo "==> Starting Cloud SQL Proxy..."
cloud-sql-proxy "${CLOUD_SQL_CONNECTION}" \
  --credentials-file=/secrets/sa-key.json \
  --port=5432 \
  --quiet &

PROXY_PID=$!

# Wait for proxy to be ready
echo "==> Waiting for proxy..."
for i in $(seq 1 30); do
  if nc -z localhost 5432 2>/dev/null; then
    echo "==> Proxy ready"
    break
  fi
  sleep 1
done

echo "==> Running snapshots..."
npx tsx --tsconfig tsconfig.scripts.json scripts/run-snapshots.ts
EXIT_CODE=$?

kill $PROXY_PID 2>/dev/null || true
exit $EXIT_CODE
