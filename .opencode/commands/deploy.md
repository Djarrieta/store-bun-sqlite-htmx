---
description: Publica un release a producción (bump, merge, Docker deploy).
---

# Deploy

Publica un release a producción del proyecto store-bun-sqlite-htmx. Referencia: `docs/despliegue.md` y `deploy.sh`.

## Worktrees

- **Dev**: `/home/dario/projects/store-bun-sqlite-htmx-dev` (rama `dev`)
- **Prod**: `/home/dario/projects/store-bun-sqlite-htmx` (rama `main`, puerto 4010, Docker + Cloudflare Tunnel)

## Flujo

### 1. Inspeccionar el estado

Reportar antes de cualquier mutación:
- `git status --short` en el worktree dev (debe estar limpio)
- `git log --oneline origin/main..origin/dev` — commits del release
- Versión actual: `grep '"version"' package.json`
- Tags: `git tag -l`

### 2. Preguntar tipo de versión y pedir confirmación

Tipos:
- **patch** — correcciones
- **minor** — funcionalidad nueva compatible
- **major** — cambios incompatibles

Presentar el plan y **esperar confirmación explícita** antes de ejecutar:
- Bump `v<actual>` → `v<nueva>` en `dev` + push
- Squash-merge `release: v<nueva>` en `main` + tag + push
- Merge-back a `dev` + push
- Deploy en producción (backup, pull, rebuild Docker)

### 3. Ejecutar el release

```bash
./deploy.sh release patch|minor|major
```

### 4. Ejecutar deploy en producción

```bash
cd /home/dario/projects/store-bun-sqlite-htmx && ./deploy.sh
```

### 5. Verificar

- `Despliegue completo: vX.Y.Z`
- `docker ps --filter name=store-bun-sqlite-htmx-web`
- `curl -sI https://crista.click | head -1`
- `docker compose logs --tail=50 web`

### 6. Reportar

Resumen: versión, commits, health check, advertencias.

## Restricciones

- **Nunca** `git push --force`, `git reset --hard` ni reescritura de historia en `main`
- Rollback = `git revert` del commit de release + `./deploy.sh`
- No commits directos en `main`
- Pedir confirmación antes de cada operación que mute git o producción
- Si el usuario solo quiere "probar en dev", no ejecutar nada de esto
