#!/usr/bin/env bash
#
# Creates/updates the "finance-tracker-secrets" Kubernetes Secret
# (currently just JWT_SECRET) that backend-deployment.yaml (in the k3s
# manifest repo — see K3S_MANIFEST_DIR in the other scripts) reads via
# secretKeyRef. The value is never written to a file on disk — it goes
# straight from source into the cluster via `kubectl apply -f -`.
#
# Usage:
#   ./01-create-app-secret.sh                 # reads JWT_SECRET from ../../.env.prod
#   JWT_SECRET=... ./01-create-app-secret.sh   # or pass it explicitly
set -euo pipefail

NAMESPACE="finance-tracker"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [ -z "${JWT_SECRET:-}" ]; then
  ENV_PROD="$REPO_ROOT/.env.prod"
  if [ ! -f "$ENV_PROD" ]; then
    echo "error: JWT_SECRET not set and $ENV_PROD not found" >&2
    exit 1
  fi
  JWT_SECRET="$(grep -E '^JWT_SECRET=' "$ENV_PROD" | head -1 | cut -d= -f2-)"
  if [ -z "$JWT_SECRET" ]; then
    echo "error: JWT_SECRET not found in $ENV_PROD" >&2
    exit 1
  fi
  echo "==> Using JWT_SECRET from $ENV_PROD"
fi

kubectl get namespace "$NAMESPACE" >/dev/null 2>&1 || kubectl create namespace "$NAMESPACE"

kubectl create secret generic finance-tracker-secrets \
  --namespace "$NAMESPACE" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "==> finance-tracker-secrets created/updated in namespace $NAMESPACE"
