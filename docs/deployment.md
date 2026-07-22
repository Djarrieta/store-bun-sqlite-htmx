# Production deployment

Official process for promoting changes from `dev` to production. Everything goes through
the [`deploy.sh`](../deploy.sh) script (see [tech-spec/16-deployment.md](tech-spec/16-deployment.md)). There is also an agent
skill (`.agents/skills/deploy/`) that guides this same flow.

## Environments

| Environment | Path | Branch | Port | Data | Process |
|---|---|---|---|---|---|
| Production | `/home/dario/projects/store-bun-sqlite-htmx` | `main` | `4010` (Docker → Cloudflare tunnel) | `./data`, `./public/uploads` | `docker compose up -d` via `deploy.sh` |
| Development | `/home/dario/projects/store-bun-sqlite-htmx-dev` | `dev` | `4011` (LAN/Tailscale) | `./data`, `./public/uploads` (own) | systemd user unit `store-dev` (`bun --watch`) |

Both paths are **worktrees of the same repository**. Daily work happens in
`dev`; `main` only receives changes through releases.

## General flow

```
dev (daily commits)
  │
  │  ./deploy.sh release patch|minor|major
  │    1. pre-checks (clean worktrees, branches in sync, typecheck)
  │    2. bump version in package.json (commit + push on dev)
  │    3. git merge --squash dev  →  ONE commit "release: vX.Y.Z" on main
  │    4. annotated tag vX.Y.Z  →  push main + tag
  │    5. merge-back to dev (trivial, identical trees) + push
  ▼
main (clean history: 1 commit per release, 1 tag per version)
  │
  │  ./deploy.sh        (in the production checkout)
  │    1. validate .env
  │    2. backup data/app.sqlite (keep last 3)
  │    3. git pull --ff-only
  │    4. docker compose up -d --build
  │    5. health check on http://127.0.0.1:4010
  ▼
updated service (schema auto-created at boot via CREATE TABLE IF NOT EXISTS)
```

## `deploy.sh` reference

### `./deploy.sh release patch|minor|major`

Can be run from any checkout (discovers worktrees with
`git worktree list`). **Does not touch the production container**: the old image
keeps serving until deploy runs.

- **patch** — bug fixes (`0.2.0` → `0.2.1`)
- **minor** — backward-compatible features (`0.2.0` → `0.3.0`)
- **major** — breaking changes (`0.2.0` → `1.0.0`)

Aborts without mutating anything if: any worktree is dirty, `dev` or `main` are not
in sync with `origin`, typecheck fails, or the target tag already exists.

### `./deploy.sh` (no arguments)

Runs **only in the production checkout** (branch `main`). Updates the
service following the steps in the diagram. Prints the deployed version
at the end (`git describe --tags`).

## Versioning and tags

- Version lives in `package.json` (`"version"`) and is updated by the release
  script (do not edit by hand).
- Each release creates an **annotated tag** `vX.Y.Z` on the release commit in
  `main`. Convention: [semver](https://semver.org/).
- `main` accumulates **one commit per release** (`release: vX.Y.Z`); the body
  lists the `dev` commits included. Detailed history lives in `dev`.
- Useful queries:
  - `git tag -l` — published versions.
  - `git log --oneline main` — releases.
  - `git show v0.2.0` — release contents.
  - `git diff v0.1.0 v0.2.0` — changes between versions.

## Backups

### Pre-deploy backup (automatic)

`./deploy.sh` copies `data/app.sqlite` to
`data/backups/app-YYYYMMDD-HHMMSS.sqlite` **before every deploy**, keeping only
the **last 3** (deletes older ones). This is a defense against corruption or a
bad deploy detected right after release.

### Restore a backup

```bash
cd /home/dario/projects/store-bun-sqlite-htmx
docker compose stop web
cp data/backups/app-<timestamp>.sqlite data/app.sqlite
docker compose start web
```

### Continuous backups (recommended, pending)

For real disk-failure protection, use **Litestream**
(continuous WAL replication to R2/S3), see [tech-spec/16-deployment.md](tech-spec/16-deployment.md). The script's
point-in-time backup does **not** replace an external replica: both live on the
same disk.

## Post-deploy verification

`./deploy.sh` runs an automatic health check (`curl` to `http://127.0.0.1:4010`,
up to 15 s). Additional manual checks:

```bash
docker ps --filter name=store-bun-sqlite-htmx-web   # container up
git describe --tags                                  # deployed version
curl -sI https://crista.click | head -1              # responds through tunnel
docker compose logs --tail=50 web                    # clean startup
```

## Rollback

### Code (revert to previous version)

`main` is never rewritten (no force-push): revert the release commit and
redeploy, keeping `--ff-only`:

```bash
cd /home/dario/projects/store-bun-sqlite-htmx
git revert --no-edit HEAD        # revert latest release
git push origin main
./deploy.sh
```

### Database (after a bad deploy)

Restore the pre-deploy backup as described in **Backups → Restore**, then
revert the code to the version compatible with that schema.

## Recovery from a failed release

The release script aborts on the first error (`set -e`). Depending on the step:

| Failure | State | Action |
|---|---|---|
| Pre-checks / typecheck | Nothing mutated | Fix the cause and retry |
| Push of dev bump | Bump commit local on dev | `git push origin dev` and retry release (tag does not exist yet) |
| Squash-merge (conflict) | Merge in progress in main worktree | `git merge --abort` in that worktree, resolve divergence, retry |
| Push of main/tag | Commit + tag local on main | `git push origin main refs/tags/vX.Y.Z`; or to abort: `git reset --hard origin/main` and `git tag -d vX.Y.Z` in main worktree |

## Transition from `start.sh`

`start.sh` was renamed and extended as `deploy.sh`. The **first** deploy
after this change uses the old `./start.sh` (its `git pull` brings
`deploy.sh`); from then on use `./deploy.sh`.
