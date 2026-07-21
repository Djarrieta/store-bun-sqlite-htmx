#!/usr/bin/env bash
#
# deploy.sh — release and production deploy (tech-spec §17, docs/deployment.md).
#
# Usage:
#   ./deploy.sh                             Deploys to production. Run in the main
#                                           checkout: validate .env -> SQLite backup
#                                           (keep 3) -> git pull --ff-only ->
#                                           rebuild Docker -> health check.
#
#   ./deploy.sh release patch|minor|major   Publishes dev -> main in ONE commit:
#                                           version bump on dev -> squash-merge on
#                                           main -> tag vX.Y.Z -> push -> merge-back
#                                           to dev. Does not touch the prod container.
#
# Versioned migrations (PRAGMA user_version) run automatically on startup,
# BEFORE serving traffic (src/migrations/). For continuous backups
# Litestream is recommended (replica to R2/S3).

set -euo pipefail
cd "$(dirname "$0")"

die() { echo "ERROR: $*" >&2; exit 1; }

# --- Utilities ---------------------------------------------------------------

MAIN_WT=""
DEV_WT=""

# Discover main and dev worktrees (same repo, no hardcoded paths).
find_worktrees() {
  local wt=""
  while IFS= read -r line; do
    case "$line" in
      "worktree "*) wt="${line#worktree }" ;;
      "branch refs/heads/main") MAIN_WT="$wt" ;;
      "branch refs/heads/dev")  DEV_WT="$wt" ;;
    esac
  done < <(git worktree list --porcelain)
  [ -n "$MAIN_WT" ] || die "no worktree found on the main branch"
  [ -n "$DEV_WT" ]  || die "no worktree found on the dev branch"
}

require_clean() {
  local wt="$1" name="$2"
  [ -z "$(git -C "$wt" status --porcelain)" ] \
    || die "worktree $name ($wt) has uncommitted changes"
}

current_version() {
  sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' "$DEV_WT/package.json" | head -1
}

bump_version() {
  local current="$1" kind="$2" major minor patch
  IFS=. read -r major minor patch <<< "$current"
  case "$kind" in
    major) echo "$((major + 1)).0.0" ;;
    minor) echo "$major.$((minor + 1)).0" ;;
    patch) echo "$major.$minor.$((patch + 1))" ;;
  esac
}

# --- Release: dev -> main (one commit + tag) ----------------------------------

cmd_release() {
  local kind="${1:-}"
  [[ "$kind" =~ ^(patch|minor|major)$ ]] \
    || die "usage: ./deploy.sh release patch|minor|major"

  find_worktrees

  # 1) Pre-checks (before mutating anything)
  require_clean "$DEV_WT" dev
  require_clean "$MAIN_WT" main

  git fetch origin
  [ "$(git rev-parse dev)" = "$(git rev-parse origin/dev)" ] \
    || die "dev is not synced with origin/dev (pull/push first)"
  [ "$(git rev-parse main)" = "$(git rev-parse origin/main)" ] \
    || die "main is not synced with origin/main"

  local old new
  old=$(current_version)
  [ -n "$old" ] || die "could not read version from package.json"
  new=$(bump_version "$old" "$kind")

  ! git rev-parse -q --verify "refs/tags/v$new" >/dev/null 2>&1 \
    || die "tag v$new already exists locally"
  [ -z "$(git ls-remote --tags origin "refs/tags/v$new")" ] \
    || die "tag v$new already exists on origin"

  echo "==> Typecheck on dev"
  (cd "$DEV_WT" && bun run typecheck)

  # 2) Version bump on dev
  echo "==> Version bump: v$old -> v$new"
  sed -i "s/\"version\": \"$old\"/\"version\": \"$new\"/" "$DEV_WT/package.json"
  git -C "$DEV_WT" add package.json
  git -C "$DEV_WT" commit -m "chore: bump version to v$new"
  git -C "$DEV_WT" push origin dev

  # 3) Squash-merge on main (prod worktree): ONE commit per release.
  #    The container keeps serving the old image; nothing is redeployed here.
  echo "==> Release v$new on main ($MAIN_WT)"
  local commits
  commits=$(git log --oneline "origin/main..origin/dev")
  git -C "$MAIN_WT" merge --squash origin/dev
  git -C "$MAIN_WT" commit -m "release: v$new" -m "$commits"
  git -C "$MAIN_WT" tag -a "v$new" -m "Release v$new"
  git -C "$MAIN_WT" push origin main "refs/tags/v$new"

  # 4) Merge-back to dev: identical trees -> trivial merge. Leaves the squash
  #    commit as common ancestor so the next release only includes new commits.
  echo "==> Merge-back to dev"
  git -C "$DEV_WT" merge --no-edit origin/main
  git -C "$DEV_WT" push origin dev

  echo ""
  echo "Release v$new published on origin/main."
  echo "To deploy to production:  cd '$MAIN_WT' && ./deploy.sh"
}

# --- Deploy: update the production service -----------------------------------

cmd_deploy() {
  [ "$(git branch --show-current)" = "main" ] \
    || die "deploy must run on the production checkout (main branch)"

  # 1) Required config
  [ -f .env ] || die ".env file is missing"

  # 2) SQLite backup before deploying (defense; Litestream = continuous).
  #    Keep only the last 3.
  if [ -f data/app.sqlite ]; then
    mkdir -p data/backups
    cp data/app.sqlite "data/backups/app-$(date +%Y%m%d-%H%M%S).sqlite"
    ls -1t data/backups/app-*.sqlite | tail -n +4 | xargs -r rm -f
    echo "==> Backup created in data/backups/ (keeping last 3)"
  fi

  # 3) Latest version of main (no surprise merges)
  echo "==> git pull --ff-only"
  git pull --ff-only

  # 4) Rebuild the image and recreate the 'web' container (cloudflared stays up)
  echo "==> docker compose up -d --build"
  docker compose up -d --build

  # 5) Clean old images
  docker image prune -f

  # 6) Health check (host port per docker-compose.yml)
  local port=4010 i
  echo "==> Health check on http://127.0.0.1:$port"
  for i in $(seq 1 15); do
    if curl -sf -o /dev/null "http://127.0.0.1:$port/"; then
      echo "Deploy complete: $(git describe --tags 2>/dev/null || git rev-parse --short HEAD)"
      return 0
    fi
    sleep 1
  done
  die "service is not responding on port $port; check: docker compose logs web"
}

# --- Entry -------------------------------------------------------------------

case "${1:-}" in
  "") cmd_deploy ;;
  release) shift; cmd_release "${1:-}" ;;
  -h|--help|help)
    echo "Usage: ./deploy.sh [release patch|minor|major]  (see docs/deployment.md)"
    ;;
  *) die "usage: ./deploy.sh [release patch|minor|major]" ;;
esac
