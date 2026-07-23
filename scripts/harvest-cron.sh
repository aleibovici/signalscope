#!/usr/bin/env bash
# SignalScope harvest cron — runs locally, POSTs signals to your web app for processing
# Schedule: 8:30 AM ET Mon–Fri (12:30 UTC in EST / 13:30 UTC in EDT)
# Add to crontab: 30 12 * * 1-5 /path/to/signalscope/scripts/harvest-cron.sh
#
# Env file: defaults to .env in the repo root. Override with HARVEST_ENV_FILE.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${HARVEST_ENV_FILE:-.env}"

# Only run on US Eastern weekdays (Mon=1 .. Fri=5)
US_DOW=$(TZ=America/New_York date +%u)
if [ "$US_DOW" -gt 5 ]; then
  exit 0
fi

LOG_DIR="$DIR/logs"
LOG_FILE="$LOG_DIR/harvest-$(date +%Y-%m-%d).log"

mkdir -p "$LOG_DIR"

echo "=== Harvest started at $(date) ===" >> "$LOG_FILE"

cd "$DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: env file '$ENV_FILE' not found (set HARVEST_ENV_FILE to override)" >> "$LOG_FILE"
  exit 1
fi

# Run the harvester in Docker for a consistent Node environment, independent of
# local nvm or node_modules state. --rm removes the container after exit.
EXIT_CODE=0
docker compose -f docker-compose.harvest.yml --env-file "$ENV_FILE" run --rm harvester >> "$LOG_FILE" 2>&1 || EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "=== Harvest FAILED (exit $EXIT_CODE) at $(date) ===" >> "$LOG_FILE"
else
  echo "=== Harvest completed at $(date) ===" >> "$LOG_FILE"
fi

# Clean up logs older than 30 days
find "$LOG_DIR" -name "harvest-*.log" -mtime +30 -delete

exit $EXIT_CODE
