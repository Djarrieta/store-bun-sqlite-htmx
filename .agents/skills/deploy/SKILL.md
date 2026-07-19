---
name: deploy
description: Publica a producción un release del proyecto store-bun-sqlite-htmx. Bump de versión, squash-merge de dev a main en un solo commit, tag semántico vX.Y.Z, y despliegue Docker con backup. Usar cuando el usuario diga "lanzar a prod", "desplegar", "deploy", "release", "subir a producción" o similar.
---

# Deploy a producción

La referencia completa del proceso está en [docs/despliegue.md](../../../docs/despliegue.md)
y la ejecuta `deploy.sh`. Este skill guía al agente paso a paso. Todo el trabajo
de desarrollo ocurre en la rama `dev` (worktree
`/home/dario/projects/store-bun-sqlite-htmx-dev`); producción es la rama `main`
(worktree `/home/dario/projects/store-bun-sqlite-htmx`, puerto 4010, Docker +
Cloudflare Tunnel).

## 1. Inspeccionar el estado

Antes de cualquier mutación, reportar:

- `git status --short` en el worktree dev (debe estar limpio).
- `git log --oneline origin/main..origin/dev` — commits que entrarían en el release.
- Versión actual: `grep '"version"' package.json`.
- Tags existentes: `git tag -l`.

## 2. Preguntar el tipo de versión y pedir confirmación

Preguntar al usuario qué tipo de bump corresponde (salvo que ya lo haya indicado):

- **patch** — solo correcciones.
- **minor** — funcionalidad nueva compatible.
- **major** — cambios incompatibles.

Presentar el plan y **esperar confirmación explícita** ("sí", "ok", "procede")
antes de ejecutar nada que mute git o producción:

- Bump `v<actual>` → `v<nueva>` en `dev` + push.
- Un solo commit `release: v<nueva>` en `main` + tag `v<nueva>` + push.
- Merge-back a `dev` + push.
- Deploy en producción (backup, pull, rebuild Docker).

## 3. Ejecutar el release

Desde el worktree dev:

```bash
./deploy.sh release patch|minor|major
```

El script hace pre-chequeos (worktrees limpios, ramas sincronizadas,
typecheck), el bump de versión, el squash-merge en `main`, el tag, los pushes
y el merge-back a `dev`. **No** toca el contenedor de producción.

Si falla, consultar la tabla "Recuperación ante un release fallido" en
docs/despliegue.md antes de improvisar.

## 4. Ejecutar el deploy en producción

```bash
cd /home/dario/projects/store-bun-sqlite-htmx && ./deploy.sh
```

Esto valida `.env`, respalda `data/app.sqlite` (conserva los últimos 10),
hace `git pull --ff-only`, reconstruye el contenedor `web` y verifica con un
health check en `http://127.0.0.1:4010`.

## 5. Verificar

- El script termina con `Despliegue completo: vX.Y.Z`.
- `docker ps --filter name=store-bun-sqlite-htmx-web` — contenedor arriba.
- `curl -sI https://crista.click | head -1` — responde por el túnel.
- `docker compose logs --tail=50 web` — arranque sin errores ni migraciones fallidas.

## 6. Reportar

Resumir al usuario:

- Versión desplegada (tag) y commits incluidos.
- Resultado del health check.
- Advertencias si las hubo (logs, contenedor reiniciado, etc.).

## Restricciones

- **Nunca** `git push --force`, `git reset --hard` ni reescritura de historia en
  `main`: `main` siempre avanza fast-forward (el deploy usa `--ff-only`).
- Rollback = `git revert` del commit de release + `./deploy.sh` (ver
  docs/despliegue.md § Rollback), nunca reescribir `main`.
- No hacer commits directos en `main`: todo entra por `./deploy.sh release`.
- Pedir confirmación antes de cada operación que mute git o producción, igual
  que en el skill git-sync.
- Si el usuario solo quiere "probar en dev", no ejecutar nada de esto: el
  entorno dev se actualiza solo con `bun --watch`.
