# Seeding

Single source of truth for how initial data is managed.

## One seed file

All initial data lives in **one file**:

```text
src/scripts/seed.ts
```

No module may contain its own seed file or self-seed at import time. Modules only export definitions/constants; `seed.ts` consumes them.

## How to add seed data for a module

1. Export the defaults/curated data from the module's `<n>.rules.ts` (or, less commonly, from its repository).
2. Import that constant in `src/scripts/seed.ts`.
3. Add a `seed<N>()` function and call it from `main()`.
4. Make the insertion idempotent (check existence or use `INSERT OR IGNORE` / `ensure*` repository methods).
5. Do not execute seeding when the module is imported.

## Current seeds

### `content`

- Defaults live in `src/modules/content/content.rules.ts` as `CONTENT_FIELDS`.
- `seed.ts` iterates and calls `contentRepo.ensureDefault(key, default)`.

### `feature-flags`

- Known flags live in `src/modules/feature-flags/feature-flags.rules.ts` as `FLAGS`.
- `seed.ts` iterates and calls `flagsRepo.ensureFlag(key, default)`.
- Previously this used `ensureFlagDefaults()` called from `index.ts`; it was moved to `seed.ts` to follow the single-seed rule.

### `shipping`

- Rates and the free-shipping threshold are inserted directly in `seedShipping()`.
- Guard: `if (shippingRepo.listRates().length > 0) return;`.

### `categories`, `products`, `variants`

- Created only if no products exist (`productsRepo.paginate({ pageSize: 1 })`).
- Order: categories → products → variants, respecting FKs.

## Modules without seed data

Some modules do not need initial data:

- `orders` — transactional data.
- `users` — managed by `src/auth/`.
- `reports` — read-only analytics over views.
- `inventory` — derived from variant stock.

## Commands

```bash
bun run seed   # runs src/scripts/seed.ts
bun run reset  # deletes the DB and re-runs seed
```

## Rules

- **Never** auto-seed on module import. `index.ts` must not mutate the database.
- Seeding must be idempotent: running `bun run seed` multiple times must not duplicate data or break.
- If a module needs defaults to function, expose them as exported constants so `seed.ts` can use them.
