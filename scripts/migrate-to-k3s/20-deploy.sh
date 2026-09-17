#!/usr/bin/env bash
#
# Applies the finance-tracker k3s manifests (kustomize, checked out at
# K3S_MANIFEST_DIR — default ~/k3s/k3s/finance-tracker) and waits for both
# Deployments to roll out. Assumes gitea-pull-secret and
# finance-tracker-secrets already exist (00-create-registry-secret.sh /
# 01-create-app-secret.sh) and, for a migration rather than a fresh
# install, that 10-import-backup.sh has already seeded the backups PVC.
#
# Usage:
#   scripts/migrate-to-k3s/20-deploy.sh
set -euo pipefail

NAMESPACE="finance-tracker"
K3S_MANIFEST_DIR="${K3S_MANIFEST_DIR:-$HOME/k3s/k3s/finance-tracker}"

if [ ! -d "$K3S_MANIFEST_DIR" ]; then
  echo "error: K3S_MANIFEST_DIR ($K3S_MANIFEST_DIR) not found." >&2
  exit 1
fi

for secret in gitea-pull-secret finance-tracker-secrets; do
  if ! kubectl get secret "$secret" -n "$NAMESPACE" >/dev/null 2>&1; then
    echo "error: secret '$secret' not found in namespace $NAMESPACE." >&2
    echo "  Run 00-create-registry-secret.sh / 01-create-app-secret.sh first." >&2
    exit 1
  fi
done

echo "==> Applying k3s manifests from $K3S_MANIFEST_DIR"
kubectl apply -k "$K3S_MANIFEST_DIR"

echo "==> Waiting for deployment/finance-tracker-backend"
kubectl rollout status deployment/finance-tracker-backend -n "$NAMESPACE" --timeout=180s

echo "==> Waiting for deployment/finance-tracker-frontend"
kubectl rollout status deployment/finance-tracker-frontend -n "$NAMESPACE" --timeout=180s

echo "==> Deployed. Next: scripts/migrate-to-k3s/30-verify.sh"
echo ""
echo "Note: images use the :latest tag with imagePullPolicy: IfNotPresent"
echo "(matching this cluster's convention). After CI pushes a new :latest,"
echo "force a refresh with:"
echo "  kubectl rollout restart deployment/finance-tracker-backend deployment/finance-tracker-frontend -n $NAMESPACE"
