---
description: Publishes a release to production (bump, merge, Docker deploy).
---

# Deploy

Publishes a production release for the store-bun-sqlite-htmx project. Reference: `docs/deployment.md` and `deploy.sh`.

## Worktrees

- **Dev**: `/home/dario/projects/store-bun-sqlite-htmx-dev` (branch `dev`)
- **Prod**: `/home/dario/projects/store-bun-sqlite-htmx` (branch `main`, port 4010, Docker + Cloudflare Tunnel)

## Flow

### 1. Inspect state

Report before any mutation:
- `git status --short` in the dev worktree (must be clean)
- `git log --oneline origin/main..origin/dev` — release commits
- Current version: `grep '"version"' package.json`
- Tags: `git tag -l`

### 2. Ask for version type and confirmation

Types:
- **patch** — bug fixes
- **minor** — backward-compatible features
- **major** — breaking changes

Present the plan and **wait for explicit confirmation** before executing:
- Bump `v<current>` → `v<new>` on `dev` + push
- Squash-merge `release: v<new>` on `main` + tag + push
- Merge-back to `dev` + push
- Deploy to production (backup, pull, rebuild Docker)

### 3. Run the release

```bash
./deploy.sh release patch|minor|major
```

### 4. Deploy to production

```bash
cd /home/dario/projects/store-bun-sqlite-htmx && ./deploy.sh
```

### 5. Verify

- `Deploy complete: vX.Y.Z`
- `docker ps --filter name=store-bun-sqlite-htmx-web`
- `curl -sI https://crista.click | head -1`
- `docker compose logs --tail=50 web`

### 6. Report

Summary: version, commits, health check, warnings.

## Constraints

- **Never** `git push --force`, `git reset --hard`, or rewrite history on `main`
- Rollback = `git revert` of the release commit + `./deploy.sh`
- No direct commits on `main`
- Ask for confirmation before each operation that mutates git or production
- If the user only wants "to test on dev", do not execute any of this
