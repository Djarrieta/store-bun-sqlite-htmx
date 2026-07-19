# AGENTS.md — store-bun-sqlite-htmx

Online store + admin panel + multichannel AI chat. Stack: **Bun + SQLite (`bun:sqlite`) + HTMX**, server-rendered HTML, **no build step**, strict TypeScript run directly by Bun. Self-hosted, published via Cloudflare Tunnel.

**[tech-spec.md](tech-spec.md) is the design source of truth** (in Spanish). Consult it for data model, phases (F1–F10), payments, chat, and security decisions before implementing a feature. Don't duplicate it here.

## Language

- **Spanish is the only language** (tech-spec §S1). UI copy, error messages, domain terms (`Productos`, `/admin/productos`), and code comments are Spanish. LLM responds in Spanish. No i18n in v1.

## Commands

```bash
bun run dev        # watch mode (bun --watch src/index.ts)
bun run start      # run server
bun run seed       # seed demo data (src/scripts/seed.ts)
bun run reset      # reset DB (src/scripts/reset.ts)
bun run typecheck  # tsc --noEmit — run this to validate changes
```

- **No test framework** and no lint step. Validate work with `bun run typecheck`.
- No `npm`/`node` — this is a Bun project with zero runtime dependencies (only `@types/bun` + `typescript` dev deps).
- Deploy: `deploy.sh` — release (`./deploy.sh release patch|minor|major`: dev → main en un solo commit + tag `vX.Y.Z`) y despliegue en prod (`./deploy.sh`: backup SQLite + `git pull --ff-only` + `docker compose up -d --build` + health check). Migraciones al arrancar. Proceso completo en [docs/despliegue.md](docs/despliegue.md) y [tech-spec.md](tech-spec.md) §17. El skill `deploy` (`.agents/skills/deploy/`) guía el flujo.

## Environments

Two environments coexist in this repo:

| Environment | Path | Branch | Port | DB / uploads | Process |
|---|---|---|---|---|---|
| Production | `/home/dario/projects/store-bun-sqlite-htmx` | `main` | `4010` (Docker → tunnel) | `./data`, `./public/uploads` | `docker compose up -d` via `deploy.sh` |
| Development | `/home/dario/projects/store-bun-sqlite-htmx-dev` | `dev` | `4011` (LAN/Tailscale) | Own `./data`, `./public/uploads` (gitignored worktree dirs) | systemd user unit `store-dev` (`bun --watch src/index.ts`) |

- Prod runs with `NODE_ENV=production` and `DEV_LOGIN=0`. Dev runs with `NODE_ENV=development` and `DEV_LOGIN=1`.
- The prod `web` service sets `environment: { NODE_ENV: production, DEV_LOGIN: "0" }` in `docker-compose.yml` so `env_file` can never accidentally enable dev mode.
- To restart/see dev logs: `systemctl --user restart store-dev` / `journalctl --user -u store-dev -f`.

## Critical conventions

- **Explicit `.ts` in imports**: always `import { db } from "../db.ts"` (tsconfig has `allowImportingTsExtensions` + `verbatimModuleSyntax`). Use `import type` for type-only imports.
- **UUID text primary keys everywhere**: `crypto.randomUUID()` → `TEXT PRIMARY KEY`. No `INTEGER AUTOINCREMENT`. FKs are `TEXT`. Order by `created_at`. Natural-key exceptions: `content.key`, `feature_flags.key`, singleton `shipping_config (id=1)`.
- **Parameterized queries only** — bind `$name` params, never string-interpolate user input into SQL.
- **Escape all interpolated user data** in views with `escapeHtml()` / `escapeAttr()` from [src/components/registry.ts](src/components/registry.ts).
- **Deny-by-default permissions**: guard every handler; a guard returns `User | Response`, so `if (x instanceof Response) return x;`.
- Timestamps via `now()` (ISO string) and IDs via `newId()` from [src/db.ts](src/db.ts).

## Architecture

Custom micro-framework — no Express/Hono. Startup flow in [src/index.ts](src/index.ts): import auth → import modules (side-effect registration + table creation) → register routes → `runMigrations()` → start Bun server.

- **Router** — [src/core/router.ts](src/core/router.ts): `router.get/post/...(path, handler)`, `:param` matching. Handlers receive a `RouteContext` (`params`, `query`, `cookies`, `user`, `guestRef`, `isHtmx`, `setCookie`).
- **HTTP helpers** — [src/core/http.ts](src/core/http.ts): `html()`, `fragment()`, `json()`, `redirect()`, `notFound()`, `forbidden()`, `badRequest()`, `serverError()`.
- **Repository** — [src/core/repository.ts](src/core/repository.ts): base `Repository<Row>` with `all/get/run/findById/deleteById/count/paginate`. Each module exports a singleton repo (e.g. `productsRepo`).
- **Permissions** — [src/core/permissions.ts](src/core/permissions.ts): roles `admin|manager|sales|logistic|financial|customer`; `PermissionMatrix` per module key; `can(user, moduleKey, action)`.
- **Auth guards** — [src/auth/index.ts](src/auth/index.ts): `requireUser`, `requireStaff`, `requirePermission(ctx, moduleKey, action)`.
- **Config** — [src/config.ts](src/config.ts): typed env loader (`config.*`). Bun autoloads `.env`. Never hardcode secrets.

### Modules (`src/modules/<name>/`)

Each domain is a module extending `AppModule` ([src/core/modules.ts](src/core/modules.ts)) and self-registering via `registerModule(...)`. Register new modules by adding a side-effect import to [src/modules/index.ts](src/modules/index.ts) (grouped by phase). Standard file layers:

| File | Role |
|------|------|
| `index.ts` | Extends `AppModule` (`key`, `title`, `registerRoutes`, optional `dashboardCard`), calls `registerModule` |
| `<name>.db.ts` | `CREATE TABLE IF NOT EXISTS` at import time + repository class + singleton export |
| `<name>.rules.ts` | Exports `<NAME>_KEY`, permission matrix (`registerPermissions`), form validators returning `{ data, errors }` |
| `<name>.routes.ts` | Exports `register<Name>Routes(router)`; base path `const BASE = "/admin/<nombre>"` |
| `<name>.views.ts` | HTML template functions returning strings |

Use [src/modules/products/](src/modules/products/) as the reference implementation.

### Views & HTMX

Server-rendered template **strings** — no JSX, no template engine. Full pages via `page()` ([src/components/layout.ts](src/components/layout.ts)) and `adminShell()` ([src/views.ts](src/views.ts)). Shared components: `forms.ts`, `table.ts`, `card.ts`, `nav.ts`.

- **HTMX branching**: handlers check `ctx.isHtmx` → return `fragment(...)` for partial swaps, else `html(fullPage())`.
- **Theming**: use CSS design tokens (`var(--accent)`, etc.) from [src/theme.ts](src/theme.ts) — never hardcode colors. Palette = CRISTA theme (marfil `#f8f5f0`, burdeos `#7b1e2e`). Register component CSS once via `registerCss()`.

### Migrations

Dev: tables created by each module's `CREATE TABLE IF NOT EXISTS`. Prod: `runMigrations()` ([src/migrations/index.ts](src/migrations/index.ts)) applies ordered migrations tracked by `PRAGMA user_version` at boot. **Never edit past migrations** — add new versions only.

## Security (tech-spec §16 — non-negotiable)

- **Chat tools receive no `ref`/`user_id`**; identity is resolved server-side and ownership of `order_id` is validated in the handler (anti-IDOR / prompt injection).
- **Admin NL→SQL** is read-only over analytics **views** only (positive allowlist, AST-parsed), never over `users`/`sessions`/`oauth_identities`/PII.
- **Sessions**: DB stores `SHA-256(token)`, cookie holds the token; constant-time compare.
- **Nequi proofs** are private (`data/uploads/proofs/`, not under `public/`), served behind an owner/admin guard, `no-store`.
- **Uploads**: validate by magic bytes (not content-type), only jpeg/png/webp, reject SVG, re-encode, `nosniff`.
- **LLM is swappable** — the core must not depend on DeepSeek; abstract via [src/core/llm.ts](src/core/llm.ts).

## Git

Do not run state-changing git commands (`add`, `commit`, `push`, `reset`, etc.) unless the user explicitly asks. Move/delete files with plain filesystem operations.
