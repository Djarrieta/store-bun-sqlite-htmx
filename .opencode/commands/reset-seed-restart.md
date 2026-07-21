---
description: Resets the development database, runs seed, and restarts the store-dev server.
---

Run in the current project, in this exact order and without asking for confirmation:

1. `bun run reset` — deletes `data/app.sqlite` and its WAL/SHM files.
2. `bun run seed` — runs `src/scripts/seed.ts` to populate categories, products, variants, content, and shipping.
3. `systemctl --user restart store-dev` — restarts the dev service on port 4011.

Then verify:
- `systemctl --user status store-dev` is `active (running)`.
- `curl -s http://127.0.0.1:4011/productos` returns HTTP 200 and contains at least one product.

Report the final result: which commands ran, any errors, and how many products remain in the database.
