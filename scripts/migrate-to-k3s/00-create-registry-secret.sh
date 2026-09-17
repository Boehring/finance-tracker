#!/usr/bin/env bash
#
# Creates/updates the "ghcr-pull-secret" imagePullSecret the backend and
# frontend Deployments use to pull from ghcr.io/boehring — images now
# build on GitHub Actions and publish there instead of gitea.central.lan.
#
# Reuses (copies) the existing ghcr-pull-secret already present in the
# wiki-search namespace (same registry/account already used by
# k3s/wiki-search) rather than minting a fresh one from a token, since
# that secret already exists in the cluster.
#
# Usage:
#   ./00-create-registry-secret.sh
set -euo pipefail

NAMESPACE="finance-tracker"
SOURCE_NAMESPACE="wiki-search"

kubectl get namespace "$NAMESPACE" >/dev/null 2>&1 || kubectl create namespace "$NAMESPACE"

if ! kubectl get secret ghcr-pull-secret -n "$SOURCE_NAMESPACE" >/dev/null 2>&1; then
  echo "error: ghcr-pull-secret not found in namespace $SOURCE_NAMESPACE to copy from." >&2
  echo "  Create one there first (see k3s/wiki-search's own docs), or create" >&2
  echo "  ghcr-pull-secret directly in $NAMESPACE with:" >&2
  echo "  kubectl create secret docker-registry ghcr-pull-secret -n $NAMESPACE \\" >&2
  echo "    --docker-server=ghcr.io --docker-username=<user> --docker-password=<PAT read:packages>" >&2
  exit 1
fi

kubectl get secret ghcr-pull-secret -n "$SOURCE_NAMESPACE" -o json \
  | python3 -c "
import json, sys
d = json.load(sys.stdin)
out = {
    'apiVersion': 'v1',
    'kind': 'Secret',
    'type': d['type'],
    'metadata': {'name': 'ghcr-pull-secret', 'namespace': '$NAMESPACE'},
    'data': d['data'],
}
json.dump(out, sys.stdout)
" \
  | kubectl apply -f -

echo "==> ghcr-pull-secret copied into namespace $NAMESPACE"
