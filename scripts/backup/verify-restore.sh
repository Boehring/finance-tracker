#!/usr/bin/env bash
#
# Sanity-checks a test-restored backup by actually booting the backend
# image against it and hitting /api/health. This catches problems a raw
# `sqlite3 integrity_check` wouldn't, e.g. a schema mismatch between the
# backup and the current image (docker-entrypoint.sh runs
# `prisma db push --accept-data-loss` on boot).
#
# Usage:
#   scripts/backup/verify-restore.sh <sqlite-volume> <uploads-volume>
#
# Typically the two volume names printed by restore.sh in test mode.
set -euo pipefail

if [ $# -ne 2 ]; then
  echo "usage: $0 <sqlite-volume> <uploads-volume>" >&2
  exit 1
fi

SQLITE_VOLUME="$1"
UPLOADS_VOLUME="$2"
IMAGE="gitea.central.lan/finance/finance-tracker/finance-tracker-backend:latest"
CONTAINER="finance-tracker-verify-$$"
PORT="${VERIFY_PORT:-13001}"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Starting backend against restored volumes on port $PORT"
docker run -d --name "$CONTAINER" \
  -v "$SQLITE_VOLUME:/app/data" \
  -v "$UPLOADS_VOLUME:/app/uploads" \
  -e DATABASE_URL="file:/app/data/prod.db" \
  -e JWT_SECRET="verify-only-not-a-real-secret" \
  -e PORT=3001 \
  -e UPLOAD_DIR=/app/uploads \
  -e MAX_FILE_SIZE=5242880 \
  -p "$PORT:3001" \
  "$IMAGE" >/dev/null

echo "==> Waiting for health check"
for i in $(seq 1 15); do
  if curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
    echo "==> OK: backend is healthy against the restored data"
    echo "==> Recent logs:"
    docker logs "$CONTAINER" --tail 20
    exit 0
  fi
  sleep 1
done

echo "==> FAILED: backend never became healthy. Logs:" >&2
docker logs "$CONTAINER" >&2
exit 1
