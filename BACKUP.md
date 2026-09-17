# Backup procedure (Docker era — superseded)

**Production moved to k3s on 2026-09-17** — see [MIGRATION.md](MIGRATION.md)
and the Wiki.js page "Finance Tracker (migración a k3s)". This document,
and the `scripts/backup/` tooling it describes, no longer apply to
production: nothing writes to the `finance-tracker_sqlite_data` /
`finance-tracker_uploads` Docker volumes anymore (the compose stack on
`dassault` was stopped, volumes kept only as a last-resort rollback).
Nightly backups now run in-cluster via `sqlite-backup-cronjob.yaml` in the
`k3s/finance-tracker` manifest repo.

Kept below for historical reference and in case a rollback to Docker is
ever needed.

---

This documents how to preserve the persistent state of the production stack
(`docker-compose.prod.yml`) before any risky operation, and lays the
groundwork for a later migration to Kubernetes. **This phase only covers
backup/restore of the current Docker deployment.** The k3s migration itself
— manifests + the scripts that load one of these backups into the
cluster's PVCs — is now underway; see [MIGRATION.md](MIGRATION.md).

## What needs to be preserved

Production runs with `provider = "sqlite"` (see `backend/prisma/schema.prisma`),
not the PostgreSQL connection string shown in `CLAUDE.md`/`.env.example` for
local dev — those are the optional/legacy path. All persistent state lives
in two named Docker volumes declared in `docker-compose.prod.yml`:

| Volume | Mount | Contents |
|---|---|---|
| `finance-tracker_sqlite_data` | `/app/data` | `prod.db` — the whole application database (users, people, categories, expenses, participants, settlements) |
| `finance-tracker_uploads` | `/app/uploads` | Expense attachment files referenced by the `Attachment` table |

Everything else is reproducible from git + the built images (schema is
applied via `prisma db push --accept-data-loss` on container start —
there is no separate migrations history to preserve).

## Scripts

All in `scripts/backup/`:

- **`backup.sh`** — snapshots both volumes into a timestamped, portable
  directory under `backups/<UTC timestamp>/`:
  - `prod.db.gz` — a **hot backup** of the SQLite file taken via
    `sqlite3 .backup` (safe to run while the backend is writing to it;
    do not just `cp`/`tar` a live SQLite file, it can capture a torn copy).
    Integrity-checked (`PRAGMA integrity_check`) before being gzipped.
  - `uploads.tar.gz` — a tarball of the uploads volume.
  - `MANIFEST.txt` — sha256 checksums, the git commit this repo was at,
    and the backend image digest in use, so a backup is traceable to the
    exact app version that wrote it.
  - Prunes old backups, keeping the last `BACKUP_RETENTION_COUNT` (default 14).
  - Output location is `backups/` by default (gitignored); override with
    `BACKUP_DIR=/some/other/path`.

- **`restore.sh <backup-dir> [--live]`** — restores a backup.
  - Without `--live`, restores into **new, disposable volumes** (safe to
    run anytime, doesn't touch production) so you can verify a backup.
  - With `--live`, overwrites the real `finance-tracker_sqlite_data` /
    `finance-tracker_uploads` volumes. Refuses to run if the prod stack is
    still up, and requires typing `yes` to confirm.

- **`verify-restore.sh <sqlite-volume> <uploads-volume>`** — actually
  boots the real backend image against a test-restored pair of volumes
  and polls `/api/health`, so a backup is proven to produce a working
  app, not just a file that passes a checksum.

## Usage

Run a backup:

```bash
./scripts/backup/backup.sh
```

Verify the latest backup restores cleanly (recommended after every backup,
and always before relying on one for a real restore):

```bash
LATEST=$(ls -1dt backups/*/ | head -1)
./scripts/backup/restore.sh "$LATEST"
# copy the two volume names it prints, then:
./scripts/backup/verify-restore.sh <sqlite-volume-name> <uploads-volume-name>
docker volume rm <sqlite-volume-name> <uploads-volume-name>   # cleanup
```

Restore for real (disaster recovery / rollback):

```bash
docker compose -f docker-compose.prod.yml down
./scripts/backup/restore.sh backups/<timestamp> --live
docker compose -f docker-compose.prod.yml up -d
```

## When to run a backup

Manually, before:
- Any change to `backend/prisma/schema.prisma`.
- Upgrading the backend/frontend images in production.
- Any of the Kubernetes migration steps once that work starts.

This is deliberately a manual script for now, not a cron job — automate it
once the manual procedure has been exercised a few times and the retention
policy above still looks right.

## Notes for the eventual Kubernetes migration

These predated the migration work and are now implemented as described —
see [MIGRATION.md](MIGRATION.md) for the actual manifests/scripts. Kept
here as the rationale behind those choices.

- The backup format (plain `.gz` SQLite file + tarball, not a Docker
  volume snapshot) was chosen so it can be loaded into a PVC later via a
  one-off `kubectl cp` / init Job, independent of the Docker volume driver.
- SQLite-on-a-volume means the backend can only ever run as a
  single replica (`ReplicaSet` size 1) unless the app is migrated to
  Postgres — fine for a `Deployment` + `ReadWriteOnce` `PersistentVolumeClaim`,
  but worth deciding explicitly before writing manifests.
- `docker-entrypoint.sh` runs `prisma db push --accept-data-loss` on every
  boot; carry the same behavior (or switch to tracked migrations) in
  whatever entrypoint/initContainer replaces it in Kubernetes.
