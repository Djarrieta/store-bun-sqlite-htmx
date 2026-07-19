#!/usr/bin/env bash
#
# deploy.sh — release y despliegue a producción (tech-spec §17, docs/despliegue.md).
#
# Uso:
#   ./deploy.sh                             Despliega producción. Corre en el checkout
#                                           de main: valida .env -> backup de SQLite
#                                           (conserva 10) -> git pull --ff-only ->
#                                           rebuild Docker -> health check.
#
#   ./deploy.sh release patch|minor|major   Publica dev -> main en UN solo commit:
#                                           bump de versión en dev -> squash-merge en
#                                           main -> tag vX.Y.Z -> push -> merge-back
#                                           a dev. No toca el contenedor de prod.
#
# Las migraciones versionadas (PRAGMA user_version) corren solas al arrancar la
# app, ANTES de servir tráfico (src/migrations/). Para backups continuos se
# recomienda Litestream (réplica a R2/S3).

set -euo pipefail
cd "$(dirname "$0")"

die() { echo "ERROR: $*" >&2; exit 1; }

# --- Utilidades --------------------------------------------------------------

MAIN_WT=""
DEV_WT=""

# Descubre los worktrees de main y dev (mismo repo, sin rutas hardcodeadas).
find_worktrees() {
  local wt=""
  while IFS= read -r line; do
    case "$line" in
      "worktree "*) wt="${line#worktree }" ;;
      "branch refs/heads/main") MAIN_WT="$wt" ;;
      "branch refs/heads/dev")  DEV_WT="$wt" ;;
    esac
  done < <(git worktree list --porcelain)
  [ -n "$MAIN_WT" ] || die "no se encontró un worktree en la rama main"
  [ -n "$DEV_WT" ]  || die "no se encontró un worktree en la rama dev"
}

require_clean() {
  local wt="$1" name="$2"
  [ -z "$(git -C "$wt" status --porcelain)" ] \
    || die "el worktree de $name ($wt) tiene cambios sin commitear"
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

# --- Release: dev -> main (un solo commit + tag) -----------------------------

cmd_release() {
  local kind="${1:-}"
  [[ "$kind" =~ ^(patch|minor|major)$ ]] \
    || die "uso: ./deploy.sh release patch|minor|major"

  find_worktrees

  # 1) Pre-chequeos (antes de mutar nada)
  require_clean "$DEV_WT" dev
  require_clean "$MAIN_WT" main

  git fetch origin
  [ "$(git rev-parse dev)" = "$(git rev-parse origin/dev)" ] \
    || die "dev no está sincronizado con origin/dev (haz pull/push primero)"
  [ "$(git rev-parse main)" = "$(git rev-parse origin/main)" ] \
    || die "main no está sincronizado con origin/main"

  local old new
  old=$(current_version)
  [ -n "$old" ] || die "no se pudo leer la versión de package.json"
  new=$(bump_version "$old" "$kind")

  ! git rev-parse -q --verify "refs/tags/v$new" >/dev/null 2>&1 \
    || die "el tag v$new ya existe localmente"
  [ -z "$(git ls-remote --tags origin "refs/tags/v$new")" ] \
    || die "el tag v$new ya existe en origin"

  echo "==> Typecheck en dev"
  (cd "$DEV_WT" && bun run typecheck)

  # 2) Bump de versión en dev
  echo "==> Bump de versión: v$old -> v$new"
  sed -i "s/\"version\": \"$old\"/\"version\": \"$new\"/" "$DEV_WT/package.json"
  git -C "$DEV_WT" add package.json
  git -C "$DEV_WT" commit -m "chore: bump version to v$new"
  git -C "$DEV_WT" push origin dev

  # 3) Squash-merge en main (worktree de prod): UN solo commit por release.
  #    El contenedor sigue sirviendo la imagen vieja; nada se redepliega aquí.
  echo "==> Release v$new en main ($MAIN_WT)"
  local commits
  commits=$(git log --oneline "origin/main..origin/dev")
  git -C "$MAIN_WT" merge --squash origin/dev
  git -C "$MAIN_WT" commit -m "release: v$new" -m "$commits"
  git -C "$MAIN_WT" tag -a "v$new" -m "Release v$new"
  git -C "$MAIN_WT" push origin main "refs/tags/v$new"

  # 4) Merge-back a dev: árboles idénticos -> merge trivial. Deja el squash
  #    commit como ancestro común para que el próximo release solo incluya
  #    los commits nuevos.
  echo "==> Merge-back a dev"
  git -C "$DEV_WT" merge --no-edit origin/main
  git -C "$DEV_WT" push origin dev

  echo ""
  echo "Release v$new publicado en origin/main."
  echo "Para desplegar en producción:  cd '$MAIN_WT' && ./deploy.sh"
}

# --- Deploy: actualiza el servicio de producción -----------------------------

cmd_deploy() {
  [ "$(git branch --show-current)" = "main" ] \
    || die "el deploy debe correr en el checkout de producción (rama main)"

  # 1) Config obligatoria
  [ -f .env ] || die "falta el archivo .env"

  # 2) Backup de SQLite antes de desplegar (defensa; Litestream = continuo).
  #    Conserva solo los últimos 10.
  if [ -f data/app.sqlite ]; then
    mkdir -p data/backups
    cp data/app.sqlite "data/backups/app-$(date +%Y%m%d-%H%M%S).sqlite"
    ls -1t data/backups/app-*.sqlite | tail -n +11 | xargs -r rm -f
    echo "==> Backup creado en data/backups/ (se conservan los últimos 10)"
  fi

  # 3) Última versión de main (sin merges sorpresa)
  echo "==> git pull --ff-only"
  git pull --ff-only

  # 4) Reconstruye la imagen y recrea el contenedor 'web' (cloudflared sigue arriba)
  echo "==> docker compose up -d --build"
  docker compose up -d --build

  # 5) Limpia imágenes viejas
  docker image prune -f

  # 6) Health check (puerto host según docker-compose.yml)
  local port=4010 i
  echo "==> Health check en http://127.0.0.1:$port"
  for i in $(seq 1 15); do
    if curl -sf -o /dev/null "http://127.0.0.1:$port/"; then
      echo "Despliegue completo: $(git describe --tags 2>/dev/null || git rev-parse --short HEAD)"
      return 0
    fi
    sleep 1
  done
  die "el servicio no responde en el puerto $port; revisa: docker compose logs web"
}

# --- Entrada -----------------------------------------------------------------

case "${1:-}" in
  "") cmd_deploy ;;
  release) shift; cmd_release "${1:-}" ;;
  -h|--help|help)
    echo "Uso: ./deploy.sh [release patch|minor|major]  (ver docs/despliegue.md)"
    ;;
  *) die "uso: ./deploy.sh [release patch|minor|major]" ;;
esac
