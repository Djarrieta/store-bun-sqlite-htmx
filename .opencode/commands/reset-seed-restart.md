---
description: Resetea la base de datos de desarrollo, corre seed y reinicia el servidor store-dev.
---

Ejecuta en el proyecto actual, en este orden exacto y sin pedir confirmación:

1. `bun run reset` — borra `data/app.sqlite` y sus archivos WAL/SHM.
2. `bun run seed` — corre `src/scripts/seed.ts` para poblar categorías, productos, variantes, contenido y envíos.
3. `systemctl --user restart store-dev` — reinicia el servicio de desarrollo en el puerto 4011.

Luego verifica:
- Que `systemctl --user status store-dev` esté `active (running)`.
- Que `curl -s http://127.0.0.1:4011/productos` responda con HTTP 200 y contenga al menos un producto.

Reporta el resultado final en español: qué comandos corrieron, si hubo errores, y cuántos productos quedaron en la base de datos.
