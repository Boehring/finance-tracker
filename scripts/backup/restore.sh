#!/usr/bin/env bash
#
# Restores a backup produced by backup.sh into Docker volumes.
#
# By default it restores into NEW, throwaway volumes (suffix "-restore-test")
# so you can safely verify a backup without touching production data. Pass
# --live to overwrite the real finance-tracker_sqlite_data / _uploads
# volumes used by docker-compose.prod.yml (requires the stack to be down).
#
# Usage:
#   scripts/backup/restore.sh <backup-dir> [--live]
#
# Examples:
#   scripts/backup/restore.sh backups/20260914T120000Z            # test restore
#   scripts/backup/restore.sh backups/20260914T120000Z --live     # real restore
set -euo pipefail

COMPOSE_PROJECT="finance-tracker"
HELPER_IMAGE="alpine:3.20"

if [ $# -lt 1 ]; then
  echo "usage: $0 <backup-dir> [--live]" >&2
  exit 1
fi

BACKUP_SRC="$1"
MODE="${2:-}"

if [ ! -f "$BACKUP_SRC/prod.db.gz" ] || [ ! -f "$BACKUP_SRC/uploads.tar.gz" ]; then
  echo "error: $BACKUP_SRC does not look like a backup.sh output directory" >&2
  exit 1
fi
BACKUP_SRC="$(cd "$BACKUP_SRC" && pwd)"

echo "==> Verifying checksums"
(cd "$BACKUP_SRC" && sha256sum -c <(grep -E '\.(gz)$' MANIFEST.txt))

if [ "$MODE" = "--live" ]; then
  SQLITE_VOLUME="${COMPOSE_PROJECT}_sqlite_data"
  UPLOADS_VOLUME="${COMPOSE_PROJECT}_uploads"

  if docker compose -f "$(dirname "${BASH_SOURCE[0]}")/../../docker-compose.prod.yml" ps --status running -q 2>/dev/null | grep -q .; then
    echo "error: the prod stack looks like it's running. Stop it first:" >&2
    echo "  docker compose -f docker-compose.prod.yml down" >&2
    exit 1
  fi

  read -r -p "This will OVERWRITE volumes '$SQLITE_VOLUME' and '$UPLOADS_VOLUME'. Type 'yes' to continue: " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 1
  fi
else
  SUFFIX="restore-test-$(date -u +%Y%m%dT%H%M%SZ)"
  SQLITE_VOLUME="${COMPOSE_PROJECT}_sqlite_data-${SUFFIX}"
  UPLOADS_VOLUME="${COMPOSE_PROJECT}_uploads-${SUFFIX}"
  echo "==> Test mode: restoring into new volumes"
  echo "    $SQLITE_VOLUME"
  echo "    $UPLOADS_VOLUME"
  docker volume create "$SQLITE_VOLUME" >/dev/null
  docker volume create "$UPLOADS_VOLUME" >/dev/null
fi

echo "==> Restoring SQLite database into $SQLITE_VOLUME"
docker run --rm \
  -v "$SQLITE_VOLUME:/data" \
  -v "$BACKUP_SRC:/backup:ro" \
  "$HELPER_IMAGE" sh -euc "
    apk add --no-cache sqlite gzip >/dev/null
    rm -f /data/prod.db /data/prod.db-journal /data/prod.db-wal /data/prod.db-shm
    gunzip -c /backup/prod.db.gz > /data/prod.db
    sqlite3 /data/prod.db 'PRAGMA integrity_check;' | grep -qx ok
    chown -R 1000:1000 /data || true
  "

echo "==> Restoring uploads into $UPLOADS_VOLUME"
docker run --rm \
  -v "$UPLOADS_VOLUME:/data" \
  -v "$BACKUP_SRC:/backup:ro" \
  "$HELPER_IMAGE" sh -euc "
    find /data -mindepth 1 -delete
    tar xzf /backup/uploads.tar.gz -C /data
    chown -R 1000:1000 /data || true
  "

echo "==> Restore complete."
if [ "$MODE" != "--live" ]; then
  cat <<EOF

Restored into throwaway volumes for verification:
  $SQLITE_VOLUME
  $UPLOADS_VOLUME

Delete them when done:
  docker volume rm $SQLITE_VOLUME $UPLOADS_VOLUME

To sanity-check them against the app, see scripts/backup/verify-restore.sh.
EOF
else
  echo "You can now start the stack: docker compose -f docker-compose.prod.yml up -d"
fi
