#!/usr/bin/env bash
#
# Despliegue / actualización en el servidor (tech-spec §17, fase F10).
# Uso: ./start.sh   (a mano, por cron o webhook de despliegue)
#
# Flujo: valida .env -> respalda SQLite -> git pull -> rebuild + recrea 'web'.
# Las migraciones versionadas (PRAGMA user_version) corren solas al arrancar la
# app, ANTES de servir tráfico (src/migrations/). Para backups continuos se
# recomienda Litestream (réplica a R2/S3).

set -euo pipefail
cd "$(dirname "$0")"

# 1) Config obligatoria.
if [ ! -f .env ]; then
  echo "ERROR: falta el archivo .env" >&2
  exit 1
fi

# 2) Respaldo puntual de la base antes de desplegar (defensa; Litestream = continuo).
if [ -f data/app.sqlite ]; then
  mkdir -p data/backups
  cp data/app.sqlite "data/backups/app-$(date +%Y%m%d-%H%M%S).sqlite"
  echo "Backup creado en data/backups/"
fi

# 3) Última versión de la rama de producción (sin merges sorpresa).
git pull --ff-only

# 4) Reconstruye la imagen y recrea el contenedor 'web' (cloudflared sigue arriba).
docker compose up -d --build

# 5) Limpia imágenes viejas.
docker image prune -f

echo "Despliegue completo."
