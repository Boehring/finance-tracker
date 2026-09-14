#!/usr/bin/env bash
#
# Backs up the persistent state of the finance-tracker production stack:
#   - finance-tracker_sqlite_data  (SQLite database, prod.db)
#   - finance-tracker_uploads      (expense attachment files)
#
# The SQLite file is copied using `sqlite3 .backup`, which uses SQLite's
# online backup API. This is safe to run while the backend container is
# up and writing to the database (unlike `cp`, which can capture a
# torn/inconsistent file mid-write).
#
# Output: one timestamped, self-contained directory under BACKUP_DIR
# containing the db backup, the uploads tarball, and a manifest with
# checksums and provenance (git commit, image digests). This format is
# deliberately plain (tar + raw sqlite file) rather than tied to the
# Docker volume driver, so it can later be loaded into a Kubernetes PVC.
set -euo pipefail

COMPOSE_PROJECT="finance-tracker"
SQLITE_VOLUME="${COMPOSE_PROJECT}_sqlite_data"
UPLOADS_VOLUME="${COMPOSE_PROJECT}_uploads"
DB_FILE_IN_VOLUME="prod.db"
HELPER_IMAGE="alpine:3.20"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="$BACKUP_DIR/$TIMESTAMP"
KEEP="${BACKUP_RETENTION_COUNT:-14}"

for vol in "$SQLITE_VOLUME" "$UPLOADS_VOLUME"; do
  if ! docker volume inspect "$vol" >/dev/null 2>&1; then
    echo "error: expected docker volume '$vol' not found" >&2
    exit 1
  fi
done

mkdir -p "$OUT_DIR"
echo "==> Writing backup to $OUT_DIR"

echo "==> Backing up SQLite database ($SQLITE_VOLUME)"
docker run --rm \
  -v "$SQLITE_VOLUME:/data:ro" \
  -v "$OUT_DIR:/backup" \
  "$HELPER_IMAGE" sh -euc "
    apk add --no-cache sqlite >/dev/null
    sqlite3 /data/$DB_FILE_IN_VOLUME '.backup /backup/prod.db'
    sqlite3 /backup/prod.db 'PRAGMA integrity_check;' | grep -qx ok
    gzip -9 /backup/prod.db
  "

echo "==> Backing up uploads ($UPLOADS_VOLUME)"
docker run --rm \
  -v "$UPLOADS_VOLUME:/data:ro" \
  -v "$OUT_DIR:/backup" \
  "$HELPER_IMAGE" sh -euc "
    tar czf /backup/uploads.tar.gz -C /data .
  "

echo "==> Recording provenance"
GIT_COMMIT="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"
BACKEND_IMAGE_DIGEST="$(docker inspect --format='{{index .RepoDigests 0}}' \
  gitea.central.lan/finance/finance-tracker/finance-tracker-backend:latest 2>/dev/null || echo unknown)"

{
  echo "timestamp_utc=$TIMESTAMP"
  echo "git_commit=$GIT_COMMIT"
  echo "backend_image_digest=$BACKEND_IMAGE_DIGEST"
  echo "sqlite_volume=$SQLITE_VOLUME"
  echo "uploads_volume=$UPLOADS_VOLUME"
  echo ""
  echo "# sha256 checksums"
  (cd "$OUT_DIR" && sha256sum prod.db.gz uploads.tar.gz)
} > "$OUT_DIR/MANIFEST.txt"

cat "$OUT_DIR/MANIFEST.txt"
echo "==> Backup complete: $OUT_DIR"

if [ "$KEEP" -gt 0 ]; then
  echo "==> Pruning old backups (keeping last $KEEP)"
  ls -1dt "$BACKUP_DIR"/*/ 2>/dev/null | tail -n "+$((KEEP + 1))" | while read -r old; do
    echo "    removing $old"
    rm -rf "$old"
  done
fi
