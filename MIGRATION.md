# Migration to k3s

This is the "eventual Kubernetes migration" [BACKUP.md](BACKUP.md) deferred.
It moves the production stack from `docker-compose.prod.yml` on a single
host to the homelab's k3s cluster, carrying over the existing data via the
backup format `scripts/backup/backup.sh` already produces.

**The k8s manifests live in a separate repo**, not here:
`~/k3s/k3s/finance-tracker/` (repo `Boehring/k3s`) — that's where every
other service in this homelab (`gitea`, `wikijs`, `jellyfin`, `homer`, ...)
keeps its manifests, decoupled from the app's own source repo, and it's
the repo that's actually `kubectl apply -k`'d against the cluster. This
repo (`finance-tracker`) only keeps the tooling that's specific to
*this app's* data: the scripts that read a `scripts/backup/backup.sh`
output and get it into that cluster.

## What's in `~/k3s/k3s/finance-tracker/`

Built to match that repo's established conventions (see its `CLAUDE.md` /
`AGENTS.md`, and the `gitea`/`wikijs` directories, which are the closest
analogs — a stateful app with a DB + a backup CronJob):

- `namespace.yaml`.
- `sqlite-data-pvc.yaml` — `local-path` (node-local dynamic provisioning),
  `ReadWriteOnce`, mounted by the backend Deployment directly (no separate
  DB Deployment — the backend process embeds SQLite).
- `pv-finance-tracker-sqlite-backups.yaml` / `sqlite-backups-pvc.yaml` —
  NFS-backed (`192.168.0.18`), `ReadWriteMany`, same shape as
  `gitea/pv-gitea-mysql-backups.yaml`. Written nightly by
  `sqlite-backup-cronjob.yaml`; read by the backend's `restore-seed`
  initContainer.
- `pv-finance-tracker-uploads.yaml` / `uploads-pvc.yaml` — NFS-backed,
  `ReadWriteMany`, same shape as `wikijs/pv-wikijs-data.yaml`. Attachment
  files live here.
- `backend-deployment.yaml` — 1 replica, `strategy: Recreate`,
  `nodeAffinity` excluding `lockheed` (same as `gitea/mysql-deployment.yaml`
  / `wikijs/postgres-deployment.yaml` — anything holding a `local-path`
  volume avoids that node in this cluster). Includes a `restore-seed`
  initContainer: **if `sqlite-data` is empty, it auto-restores the newest
  file in `sqlite-backups` before the app starts** — same self-healing
  pattern gitea/wikijs already use for their DB volumes.
- `backend-service.yaml` — named `backend` (not `finance-tracker-backend`)
  on purpose: `frontend/nginx.conf`'s `proxy_pass http://backend:3001`
  already expects that short name (it's the docker-compose service name
  today too), so this avoids touching the frontend image.
- `sqlite-backup-cronjob.yaml` — nightly `sqlite3 .backup` +
  integrity-check + gzip into `sqlite-backups`, keeping the last 14 (same
  retention default as `scripts/backup/backup.sh`). Unlike the
  mysql/postgres backup CronJobs (which dump over TCP), this one mounts
  the same `local-path` `sqlite-data` PVC read-only, so it uses
  `podAffinity` to land on whatever node is currently running the backend
  pod.
- `frontend-deployment.yaml` / `frontend-service.yaml` — stateless nginx,
  1 replica (matches `homer`'s footprint/shape).
- `ingress.yaml` — Traefik `websecure` entrypoint, TLS via the cluster's
  default wildcard cert (`cert-manager/tlsstore-default.yaml`) — same two
  annotations as every other Ingress in the repo, host
  `finance-tracker.central.lan`.
- `kustomization.yaml` ties it together.

Both Deployments need `gitea-pull-secret` (registry) and
`finance-tracker-secrets` (`JWT_SECRET`) — created *out-of-band*, from
here, by the scripts below (never committed to the manifest repo, same
convention as `wiki-search`'s `ghcr-pull-secret`).

## What's in `scripts/migrate-to-k3s/` (this repo)

- `00-create-registry-secret.sh` — creates `gitea-pull-secret`.
- `01-create-app-secret.sh` — creates `finance-tracker-secrets`, reading
  `JWT_SECRET` from `.env.prod`.
- `10-import-backup.sh <backup-dir> [--force]` — verifies a backup's
  checksums and copies it into the NFS-backed `sqlite-backups` /
  `uploads` PVCs. Default mode never touches a live `sqlite-data` volume
  (the `restore-seed` initContainer only acts when that volume is empty,
  so re-running this is always safe); `--force` overwrites a live
  deployment's data directly, gated the same way
  `scripts/backup/restore.sh --live` is (types `yes` to confirm).
- `20-deploy.sh` — `kubectl apply -k` against `K3S_MANIFEST_DIR` (default
  `~/k3s/k3s/finance-tracker`) and waits for both rollouts.
- `30-verify.sh` — port-forwards to `svc/backend` and polls
  `/api/health`, mirroring `scripts/backup/verify-restore.sh`.

All four accept `K3S_MANIFEST_DIR` / `KUBECONFIG` as needed; none of them
touch the manifest repo's git history — that's a separate `git add`/commit
there if you want the directory tracked.

## Prerequisites

- `kubectl` pointed at the k3s cluster.
- `~/k3s/k3s` checked out (or `K3S_MANIFEST_DIR` pointed at wherever it
  is) with the `finance-tracker/` directory from this migration added and
  committed there.
- A Gitea token with `read:package` scope (the CI pipeline's
  `RUNNER_PACKAGE_TOKEN` works).
- A fresh backup: `./scripts/backup/backup.sh`.

## One-time cluster bootstrap

```bash
GITEA_USER=<user> GITEA_TOKEN=<token> \
  ./scripts/migrate-to-k3s/00-create-registry-secret.sh

./scripts/migrate-to-k3s/01-create-app-secret.sh   # reads JWT_SECRET from .env.prod
```

## Import the data and deploy

```bash
LATEST=$(ls -1dt backups/*/ | head -1)
./scripts/migrate-to-k3s/10-import-backup.sh "$LATEST"
./scripts/migrate-to-k3s/20-deploy.sh
./scripts/migrate-to-k3s/30-verify.sh
```

The backend's first boot restores from the seeded backup automatically
(empty `sqlite-data` volume → `restore-seed` initContainer kicks in); no
manual overwrite of a live volume is needed for a first migration.

Also spot-check a few real records (e.g. `kubectl exec` into the backend
pod and query a couple of rows, or hit the Ingress host and log in) before
trusting this for the real cutover.

## Cutover checklist

Once `30-verify.sh` passes and you've spot-checked the data:

1. Take one final backup from the Docker host to capture anything written
   since the backup used above (`./scripts/backup/backup.sh`), and repeat
   the import step with it if there's a meaningful gap — plain
   `10-import-backup.sh` (no `--force`) won't touch the running k3s
   deployment's data, so this is safe to do ahead of time; use `--force`
   right before cutover if you need it applied immediately rather than on
   next restart.
2. Stop the Docker stack so nothing writes to the old SQLite file while
   traffic moves over:
   ```bash
   docker compose -f docker-compose.prod.yml down
   ```
3. Point DNS / the reverse proxy in front of this app at the k3s Ingress
   (`finance-tracker.central.lan`, or repoint that hostname if it's
   already what production resolves to).
4. Watch `kubectl get pods -n finance-tracker -w` and the app itself for a
   while.
5. Keep the Docker volumes and the last few `backups/` snapshots around
   until you're confident in the k3s deployment — rollback is: bring
   `docker compose -f docker-compose.prod.yml up -d` back and repoint DNS.

## Notes / gotchas

- **Single backend replica, permanently, until Postgres.** Same
  constraint BACKUP.md already flagged: SQLite-on-a-volume means
  `replicas: 1` and `strategy: Recreate` are load-bearing, not arbitrary.
- **`local-path` PVCs are node-local**, and this cluster explicitly
  excludes the `lockheed` node from that kind of workload (see
  `backend-deployment.yaml`'s `nodeAffinity`) — match that, don't drop it.
- **Schema application on boot is unchanged.** `docker-entrypoint.sh`
  runs `prisma db push --accept-data-loss` on every container start; the
  backend image's `ENTRYPOINT`/`CMD` carry this over unmodified into the
  Pod, so no extra init step was needed for that part.
- **`:latest` + `IfNotPresent`** matches this cluster's convention, but
  means a fresh CI push won't automatically roll out — `20-deploy.sh`
  prints the `kubectl rollout restart` command to do that manually. Pin a
  real tag instead for anything beyond a first smoke test (edit the
  `image:` lines, or add a kustomize `images:` override).
- **Wiki.js documentation.** The k3s repo's own `CLAUDE.md` requires every
  non-trivial infra change to get a page on `https://wiki.central.lan` —
  do that for this migration before considering it done, separately from
  this file.
