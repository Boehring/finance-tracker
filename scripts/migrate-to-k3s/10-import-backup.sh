#!/usr/bin/env bash
#
# Seeds a backup produced by scripts/backup/backup.sh into the k3s
# finance-tracker stack (manifests: $K3S_MANIFEST_DIR, default
# ~/k3s/k3s/finance-tracker — see MIGRATION.md).
#
# Default mode copies the backup into the two NFS-backed PVCs
# (finance-tracker-sqlite-backups, finance-tracker-uploads) and nothing
# else. On next boot of a backend pod with an EMPTY sqlite-data volume
# (a fresh PVC — the normal case for a first migration), the restore-seed
# initContainer in backend-deployment.yaml picks up the newest file there
# automatically. This is the same bootstrap pattern
# gitea/mysql-deployment.yaml and wikijs/postgres-deployment.yaml already
# use in the k3s repo, so no separate write path had to be invented here.
#
# It deliberately will NOT overwrite an already-running deployment's live
# database — restore-seed only acts on an empty volume, by design, so a
# second import is safe to run repeatedly. Pass --force to actually
# overwrite a live sqlite-data volume (scales the backend to 0, clears it,
# restores directly); this requires typing "yes", matching
# scripts/backup/restore.sh --live's confirmation gate.
#
# Usage:
#   scripts/migrate-to-k3s/10-import-backup.sh <backup-dir> [--force]
#
# Example:
#   scripts/migrate-to-k3s/10-import-backup.sh backups/20260914T193810Z
set -euo pipefail

NAMESPACE="finance-tracker"
HELPER_IMAGE="alpine:3.20"
POD="finance-tracker-restore-helper"
K3S_MANIFEST_DIR="${K3S_MANIFEST_DIR:-$HOME/k3s/k3s/finance-tracker}"

if [ $# -lt 1 ]; then
  echo "usage: $0 <backup-dir> [--force]" >&2
  exit 1
fi

BACKUP_SRC="$1"
FORCE="${2:-}"
if [ ! -f "$BACKUP_SRC/prod.db.gz" ] || [ ! -f "$BACKUP_SRC/uploads.tar.gz" ]; then
  echo "error: $BACKUP_SRC does not look like a scripts/backup/backup.sh output directory" >&2
  exit 1
fi
BACKUP_SRC="$(cd "$BACKUP_SRC" && pwd)"
BACKUP_TIMESTAMP="$(basename "$BACKUP_SRC")"

if [ ! -d "$K3S_MANIFEST_DIR" ]; then
  echo "error: K3S_MANIFEST_DIR ($K3S_MANIFEST_DIR) not found." >&2
  echo "  Set it to wherever k3s/k3s/finance-tracker is checked out on this machine." >&2
  exit 1
fi

echo "==> Verifying checksums"
(cd "$BACKUP_SRC" && sha256sum -c <(grep -E '\.(gz)$' MANIFEST.txt))

echo "==> Ensuring namespace and PVCs exist"
kubectl apply -f "$K3S_MANIFEST_DIR/namespace.yaml" \
  -f "$K3S_MANIFEST_DIR/pv-finance-tracker-sqlite-backups.yaml" \
  -f "$K3S_MANIFEST_DIR/sqlite-backups-pvc.yaml" \
  -f "$K3S_MANIFEST_DIR/pv-finance-tracker-uploads.yaml" \
  -f "$K3S_MANIFEST_DIR/uploads-pvc.yaml"

cleanup() {
  kubectl delete pod "$POD" -n "$NAMESPACE" --ignore-not-found >/dev/null 2>&1 || true
}
trap cleanup EXIT

if [ "$FORCE" = "--force" ]; then
  echo "==> --force: this will OVERWRITE the live finance-tracker-sqlite-data volume."
  read -r -p "Type 'yes' to continue: " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 1
  fi
  if kubectl get deployment finance-tracker-backend -n "$NAMESPACE" >/dev/null 2>&1; then
    echo "==> Scaling deployment/finance-tracker-backend to 0"
    kubectl scale deployment/finance-tracker-backend -n "$NAMESPACE" --replicas=0
    kubectl wait --for=delete pod -l app=finance-tracker-backend -n "$NAMESPACE" --timeout=120s 2>/dev/null || true
  fi
fi

echo "==> Starting restore helper pod"
if [ "$FORCE" = "--force" ]; then
  # --force also mounts the live sqlite-data PVC so it can be overwritten
  # below. Written out in full (rather than conditionally splicing an
  # extra volume/mount into one template) so the manifest stays readable.
  kubectl apply -n "$NAMESPACE" -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: $POD
  labels:
    app: finance-tracker-restore-helper
spec:
  restartPolicy: Never
  containers:
    - name: restore
      image: $HELPER_IMAGE
      command: ["sleep", "infinity"]
      volumeMounts:
        - name: sqlite-backups
          mountPath: /restore/sqlite-backups
        - name: uploads
          mountPath: /restore/uploads
        - name: sqlite-data
          mountPath: /restore/sqlite-data
  volumes:
    - name: sqlite-backups
      persistentVolumeClaim:
        claimName: finance-tracker-sqlite-backups
    - name: uploads
      persistentVolumeClaim:
        claimName: finance-tracker-uploads
    - name: sqlite-data
      persistentVolumeClaim:
        claimName: finance-tracker-sqlite-data
EOF
else
  kubectl apply -n "$NAMESPACE" -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: $POD
  labels:
    app: finance-tracker-restore-helper
spec:
  restartPolicy: Never
  containers:
    - name: restore
      image: $HELPER_IMAGE
      command: ["sleep", "infinity"]
      volumeMounts:
        - name: sqlite-backups
          mountPath: /restore/sqlite-backups
        - name: uploads
          mountPath: /restore/uploads
  volumes:
    - name: sqlite-backups
      persistentVolumeClaim:
        claimName: finance-tracker-sqlite-backups
    - name: uploads
      persistentVolumeClaim:
        claimName: finance-tracker-uploads
EOF
fi

kubectl wait --for=condition=Ready "pod/$POD" -n "$NAMESPACE" --timeout=120s

echo "==> Copying backup files into the helper pod"
kubectl cp "$BACKUP_SRC/prod.db.gz" "$NAMESPACE/$POD:/restore/sqlite-backups/prod-${BACKUP_TIMESTAMP}.db.gz"
kubectl cp "$BACKUP_SRC/uploads.tar.gz" "$NAMESPACE/$POD:/restore/uploads.tar.gz"

echo "==> Verifying the seeded db backup"
kubectl exec -n "$NAMESPACE" "$POD" -- sh -euc "
  apk add --no-cache sqlite gzip >/dev/null
  gunzip -c /restore/sqlite-backups/prod-${BACKUP_TIMESTAMP}.db.gz > /tmp/prod.db
  sqlite3 /tmp/prod.db 'PRAGMA integrity_check;' | grep -qx ok
"

echo "==> Restoring uploads"
kubectl exec -n "$NAMESPACE" "$POD" -- sh -euc "
  find /restore/uploads -mindepth 1 -delete
  tar xzf /restore/uploads.tar.gz -C /restore/uploads
  rm -f /restore/uploads.tar.gz
"

if [ "$FORCE" = "--force" ]; then
  echo "==> Overwriting live sqlite-data volume"
  kubectl exec -n "$NAMESPACE" "$POD" -- sh -euc "
    rm -f /restore/sqlite-data/prod.db /restore/sqlite-data/prod.db-journal /restore/sqlite-data/prod.db-wal /restore/sqlite-data/prod.db-shm
    cp /tmp/prod.db /restore/sqlite-data/prod.db
    chown -R 1000:1000 /restore/sqlite-data || true
  "
  echo "==> Import complete (forced). Next: scripts/migrate-to-k3s/20-deploy.sh to scale deployment/finance-tracker-backend back up."
else
  echo "==> Import complete. Source backup:"
  grep -E '^(timestamp_utc|git_commit|backend_image_digest)=' "$BACKUP_SRC/MANIFEST.txt"
  echo ""
  echo "Next: scripts/migrate-to-k3s/20-deploy.sh — a backend pod starting against"
  echo "an empty sqlite-data volume will auto-restore from this seed."
fi
