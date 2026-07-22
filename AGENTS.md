# AGENTS.md — store-bun-sqlite-htmx

Online store + admin panel + multichannel AI chat. Stack: **Bun + SQLite (`bun:sqlite`) + HTMX**, server-rendered HTML, **no build step**, strict TypeScript run directly by Bun.

> **[tech-spec/](docs/tech-spec/index.md)** remains the design source of truth. Read the relevant section before implementing a large feature.
> **For modules and seeding**, read [docs/modules.md](docs/modules.md) and [docs/seeding.md](docs/seeding.md) first.
> **For auth, chat, payments, schema, security, deployment, storefront and theming**, see the docs below.

## Agent docs index

| Doc | Read before... |
|-----|----------------|
| [docs/modules.md](docs/modules.md) | Creating or modifying any module. |
| [docs/seeding.md](docs/seeding.md) | Adding or changing seed data. |
| [docs/auth.md](docs/auth.md) | Touching users, sessions, OAuth, roles, or permissions. |
| [docs/chat.md](docs/chat.md) | Working on the AI assistant, WhatsApp, or payment proof via chat. |
| [docs/payments.md](docs/payments.md) | Working on checkout, orders, Nequi proof, or future Wompi. |
| [docs/schema.md](docs/schema.md) | Adding tables, columns, FKs, or migrations. |
| [docs/security.md](docs/security.md) | Any change that touches auth, SQL, uploads, payments, or chat. |
| [docs/storefront.md](docs/storefront.md) | Public store pages, catalog, cart, or checkout. |
| [docs/ui-theming.md](docs/ui-theming.md) | New UI components or design tokens. |
| [docs/deployment.md](docs/deployment.md) | Releases, production deploys, backups, or rollback. |

## Language

- **Spanish is the only UI language** (see [decisions](docs/tech-spec/02-decisions.md)). UI copy, error messages, domain terms (`Productos`, `/admin/productos`), and code comments are in Spanish. The LLM responds in Spanish when working on this project. No i18n in v1.

## Commands

```bash
bun run dev        # watch mode (bun --watch src/index.ts)
bun run start      # run server
bun run seed       # development seed (src/scripts/seed.ts)
bun run reset      # reset DB (src/scripts/reset.ts)
bun run typecheck  # tsc --noEmit — validate changes
```

- No test framework and no lint step. Validate with `bun run typecheck`.
- Zero runtime dependencies; only `@types/bun` and `typescript` as dev deps.

## Critical conventions

- **Imports with `.ts`**: `import { db } from "../db.ts"`. Use `import type` for type-only imports.
- **Text UUID primary keys everywhere**: `crypto.randomUUID()` → `TEXT PRIMARY KEY`. No autoincrement. FKs are `TEXT`. Order by `created_at`.
- **Parameterized queries only**: bind `$name`, never interpolate user input into SQL.
- **Escape output**: use `escapeHtml()` / `escapeAttr()` from `src/core/http.ts` for all user data in views.
- **Deny-by-default permissions**: `if (guard instanceof Response) return guard;`.
- IDs and timestamps: use `newId()` and `now()` from `src/db.ts`.

## Structure

- `src/index.ts` — entry point: auth → modules → routes → migrations → server.
- `src/core/` — router, http, permissions, base repository, modules.
- `src/modules/<name>/` — store domains. See [docs/modules.md](docs/modules.md) for the module pattern.
- `src/scripts/seed.ts` — single source of initial data. See [docs/seeding.md](docs/seeding.md).
- `src/auth/` — auth/sessions/users (not a module).
- `src/storefront/` — public routes.
- `src/chat/` — AI assistant.

## Security (non-negotiable)

- Chat tools do not receive `ref`/`user_id`; identity is resolved server-side.
- Admin NL→SQL is read-only over allowlisted views, never over PII.
- Sessions: token in cookie, SHA-256 in DB, constant-time compare.
- Nequi proofs are private in `data/uploads/proofs/`, served with owner/admin guard.
- Uploads: magic bytes, jpeg/png/webp, re-encode, `nosniff`.

## Git

Do not run state-changing git commands (`add`, `commit`, `push`, `reset`, etc.) unless the user explicitly asks. Move/delete files with plain filesystem operations.
