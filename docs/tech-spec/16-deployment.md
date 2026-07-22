# §17 — Deployment and rollback

Source of truth for release process, production deploys, and rollback. For the detailed step-by-step reference, see [docs/deployment.md](../../docs/deployment.md).

## Production environment

| Item | Value |
| --- | --- |
| Runtime | Docker on self-hosted server |
| Internal port | `4010` (localhost only) |
| External access | Cloudflare Tunnel → `crista.click` |
| Database | SQLite at `data/app.sqlite` |
| Backups | On-deploy via `deploy.sh` (last 3 kept) |
| Replication | Litestream (WAL → R2/S3) — recommended, pending |

## Release flow

```
dev (daily commits)
  → ./deploy.sh release patch|minor|major
    1. pre-checks (clean worktrees, branches in sync, typecheck)
    2. bump version in package.json
    3. git merge --squash dev → single release commit on main
    4. annotated tag vX.Y.Z
    5. merge-back to dev
main
  → ./deploy.sh (in production checkout)
    1. validate .env
    2. backup data/app.sqlite (keep last 3)
    3. git pull --ff-only
    4. docker compose up -d --build
    5. health check on http://127.0.0.1:4010
```

Schema is created on boot via `CREATE TABLE IF NOT EXISTS`. Versioned migrations
are deferred to v1.0.

## Rollback

### Code
Revert the release commit on `main` and redeploy (`git revert --no-edit HEAD`).

### Database
Restore the pre-deploy backup, then revert code to the compatible version.

## Versioned migrations (v1.0+)

Deferred until v1.0. While pre-1.0 the database is disposable: change the schema
directly in each `<n>.db.ts` and reset with `bun run reset` + `bun run seed`.

From v1.0, when real data must be preserved:

- Managed via `PRAGMA user_version`.
- Each migration increments the version number.
- Migrations run automatically on startup **before** serving traffic.
- **Never** delete or modify applied migrations — only add new ones.

## Backups

- `deploy.sh` copies `data/app.sqlite` to `data/backups/` before each deploy.
- For production: consider Litestream for continuous WAL replication to R2/S3 (see [security checklist](15-security.md)).
