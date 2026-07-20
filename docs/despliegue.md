# Despliegue a producción

Proceso oficial para llevar cambios de `dev` a producción. Todo pasa por el
script [`deploy.sh`](../deploy.sh) (see [tech-spec/16-deployment.md](tech-spec/16-deployment.md)). Existe también un skill de
agente (`.agents/skills/deploy/`) que guía este mismo flujo.

## Entornos

| Entorno | Ruta | Rama | Puerto | Datos | Proceso |
|---|---|---|---|---|---|
| Producción | `/home/dario/projects/store-bun-sqlite-htmx` | `main` | `4010` (Docker → túnel Cloudflare) | `./data`, `./public/uploads` | `docker compose up -d` via `deploy.sh` |
| Desarrollo | `/home/dario/projects/store-bun-sqlite-htmx-dev` | `dev` | `4011` (LAN/Tailscale) | `./data`, `./public/uploads` propios | systemd user unit `store-dev` (`bun --watch`) |

Ambas rutas son **worktrees del mismo repositorio**. El desarrollo diario ocurre
en `dev`; `main` solo recibe cambios a través de releases.

## Flujo general

```
dev (commits diarios)
  │
  │  ./deploy.sh release patch|minor|major
  │    1. pre-chequeos (worktrees limpios, ramas sincronizadas, typecheck)
  │    2. bump de versión en package.json (commit + push en dev)
  │    3. git merge --squash dev  →  UN solo commit "release: vX.Y.Z" en main
  │    4. tag anotado vX.Y.Z  →  push de main + tag
  │    5. merge-back a dev (merge trivial, árboles idénticos) + push
  ▼
main (historia limpia: 1 commit por release, un tag por versión)
  │
  │  ./deploy.sh        (en el checkout de producción)
  │    1. valida .env
  │    2. backup de data/app.sqlite (conserva los últimos 3)
  │    3. git pull --ff-only
  │    4. docker compose up -d --build
  │    5. health check en http://127.0.0.1:4010
  ▼
servicio actualizado (migraciones corren solas al arrancar, antes de
servir tráfico — src/migrations/)
```

## Referencia de `deploy.sh`

### `./deploy.sh release patch|minor|major`

Puede correrse desde cualquier checkout (descubre los worktrees con
`git worktree list`). **No toca el contenedor de producción**: la imagen vieja
sigue sirviendo hasta que se corre el deploy.

- **patch** — correcciones (`0.2.0` → `0.2.1`)
- **minor** — funcionalidad nueva compatible (`0.2.0` → `0.3.0`)
- **major** — cambios incompatibles (`0.2.0` → `1.0.0`)

Aborta sin mutar nada si: algún worktree está sucio, `dev` o `main` no están
sincronizadas con `origin`, el typecheck falla, o el tag destino ya existe.

### `./deploy.sh` (sin argumentos)

Corre **únicamente en el checkout de producción** (rama `main`). Actualiza el
servicio siguiendo los pasos del diagrama. Imprime al final la versión
desplegada (`git describe --tags`).

## Versionado y tags

- La versión vive en `package.json` (`"version"`) y la actualiza el propio
  script de release (no se edita a mano).
- Cada release crea un **tag anotado** `vX.Y.Z` sobre el commit de release en
  `main`. Convención: [semver](https://semver.org/lang/es/).
- `main` acumula **un commit por release** (`release: vX.Y.Z`); el cuerpo del
  mensaje lista los commits de `dev` incluidos. La historia detallada vive en
  `dev`.
- Consultas útiles:
  - `git tag -l` — versiones publicadas.
  - `git log --oneline main` — releases.
  - `git show v0.2.0` — contenido de un release.
  - `git diff v0.1.0 v0.2.0` — cambios entre versiones.

## Backups

### Backup puntual pre-deploy (automático)

`./deploy.sh` copia `data/app.sqlite` a
`data/backups/app-YYYYMMDD-HHMMSS.sqlite` **antes de cada despliegue**, y
conserva únicamente los **últimos 3** (borra los más antiguos). Es una defensa
ante migraciones destructivas o corrupción detectada justo tras un deploy.

### Restaurar un backup

```bash
cd /home/dario/projects/store-bun-sqlite-htmx
docker compose stop web
cp data/backups/app-<timestamp>.sqlite data/app.sqlite
docker compose start web
```

### Backups continuos (recomendado, pendiente)

Para protección real ante fallo de disco se recomienda **Litestream**
(replicación continua del WAL a R2/S3), ver [tech-spec/16-deployment.md](tech-spec/16-deployment.md). El backup puntual
del script **no** reemplaza una réplica externa: ambos viven en el mismo disco.

## Verificación post-deploy

`./deploy.sh` hace un health check automático (`curl` a `http://127.0.0.1:4010`,
hasta 15 s). Verificación manual adicional:

```bash
docker ps --filter name=store-bun-sqlite-htmx-web   # contenedor arriba
git describe --tags                                  # versión desplegada
curl -sI https://crista.click | head -1              # responde por el túnel
docker compose logs --tail=50 web                    # arranque sin errores
```

## Rollback

### Código (volver a la versión anterior)

`main` nunca se reescribe (sin force-push): se revierte el commit de release y
se redepliega, manteniendo `--ff-only`:

```bash
cd /home/dario/projects/store-bun-sqlite-htmx
git revert --no-edit HEAD        # revierte el último release
git push origin main
./deploy.sh
```

### Base de datos (tras una migración problemática)

Restaurar el backup pre-deploy como se indica en **Backups → Restaurar**, y
revertir el código a la versión compatible con ese esquema.

## Recuperación ante un release fallido

El script de release aborta ante el primer error (`set -e`). Según el paso:

| Falla en | Estado | Acción |
|---|---|---|
| Pre-chequeos / typecheck | Nada se mutó | Corregir la causa y reintentar |
| Push del bump en dev | Commit de bump local en dev | `git push origin dev` y reintentar el release (el tag aún no existe) |
| Squash-merge (conflicto) | Merge a medio en el worktree de main | `git merge --abort` en ese worktree, resolver la divergencia y reintentar |
| Push de main/tag | Commit + tag locales en main | `git push origin main refs/tags/vX.Y.Z`; si se decide abortar el release: `git reset --hard origin/main` y `git tag -d vX.Y.Z` en el worktree de main |

## Transición desde `start.sh`

`start.sh` fue renombrado y extendido como `deploy.sh`. El **primer** deploy
tras este cambio se hace con el viejo `./start.sh` (su `git pull` trae
`deploy.sh`); desde entonces se usa `./deploy.sh`.
