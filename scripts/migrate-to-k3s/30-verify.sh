#!/usr/bin/env bash
#
# Sanity-checks a k3s deployment the same way scripts/backup/verify-restore.sh
# does for the Docker path: port-forward to the backend Service and poll
# /api/health, so a migration is proven to produce a working app, not just
# Pods that reached Running.
#
# Usage:
#   scripts/migrate-to-k3s/30-verify.sh
set -euo pipefail

NAMESPACE="finance-tracker"
LOCAL_PORT="${VERIFY_PORT:-18081}"

cleanup() {
  [ -n "${PF_PID:-}" ] && kill "$PF_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Port-forwarding svc/backend -> localhost:$LOCAL_PORT"
kubectl port-forward -n "$NAMESPACE" svc/backend "$LOCAL_PORT:3001" >/tmp/finance-tracker-pf.log 2>&1 &
PF_PID=$!

for i in $(seq 1 15); do
  if curl -fsS "http://localhost:$LOCAL_PORT/api/health" >/dev/null 2>&1; then
    echo "==> OK: backend is healthy"
    curl -fsS "http://localhost:$LOCAL_PORT/api/health"
    echo ""
    echo "==> Pod status:"
    kubectl get pods -n "$NAMESPACE" -o wide
    exit 0
  fi
  sleep 1
done

echo "==> FAILED: backend never became healthy. Port-forward log:" >&2
cat /tmp/finance-tracker-pf.log >&2
echo "==> Pod status/events:" >&2
kubectl get pods -n "$NAMESPACE" -o wide >&2
kubectl describe pod -l app=finance-tracker-backend -n "$NAMESPACE" >&2
exit 1
