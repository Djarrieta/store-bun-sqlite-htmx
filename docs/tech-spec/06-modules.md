# §6 — Module system

Each business domain is a **module** inside `src/modules/<name>/`. For the full module code patterns, see [docs/modules.md](../../docs/modules.md).

## File layout

| File            | Purpose                                        |
| --------------- | ---------------------------------------------- |
| `index.ts`      | `AppModule` class, `registerModule()`, dashboard card |
| `<n>.db.ts`     | Table definition (`CREATE TABLE IF NOT EXISTS`), row types, repository |
| `<n>.rules.ts`  | Module key, permissions matrix, validators     |
| `<n>.routes.ts` | HTTP handlers (admin + storefront)             |
| `<n>.views.ts`  | HTML/HTMX template functions (plain strings)   |

No JSX, no template engine — views are functions returning strings.

## Modules in scope (v1)

| Module        | Purpose                                    |
| ------------- | ------------------------------------------ |
| `categories`  | CRUD for product categories                |
| `products`    | CRUD for products                          |
| `variants`    | Variants of a product (SKU, price, stock)  |
| `inventory`   | Stock management (movements, adjustments)  |
| `orders`      | Order lifecycle (pending → paid → shipped)  |
| `content`     | CMS-like content blocks                    |
| `feature-flags` | Feature toggles                         |
| `shipping`    | Shipping rates and config                  |
| `reports`     | Read-only NL → SQL analytics               |

Modules outside `src/modules/`: auth (`src/auth/`), chat (`src/chat/`), storefront (`src/storefront/`).

## Key rules

1. Tables are created at import time via `CREATE TABLE IF NOT EXISTS` in the repository constructor.
2. Each module registers its permissions via `registerPermissions()`.
3. Routes guard with `requirePermission(ctx, MODULE_KEY, action)`.
4. Views hide controls with `can(user, MODULE_KEY, action)` and escape all dynamic output.
5. Seed data is exported from `<n>.rules.ts` and consumed by `src/scripts/seed.ts` — modules do not self-seed.
