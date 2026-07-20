# Module system

This is the single source of truth for the module architecture and code patterns. Read it before creating or modifying any module.

## What a module is

A module is a vertical domain under `src/modules/<name>/`. It owns its own table(s), repository, permissions, routes, and views. Modules are self-registering: importing `src/modules/index.ts` registers every module and creates its tables as a side effect.

There are no per-module `AGENTS.md` files. Business rules live in the module's own `<name>.rules.ts`. The patterns below are the only allowed way to write module code.

## File layout

Every module must contain exactly these files (replace `<n>` with the module name):

| File | Responsibility |
|------|----------------|
| `index.ts` | `AppModule` class, `registerModule()`, dashboard card, side-effect import of `./<n>.db.ts`. |
| `<n>.db.ts` | `CREATE TABLE IF NOT EXISTS`, row types, repository class, singleton repo export. |
| `<n>.rules.ts` | Module key constant, `PermissionMatrix`, form validators, business-rule helpers. |
| `<n>.routes.ts` | `register<N>Routes(router)` — one handler per route. |
| `<n>.views.ts` | HTML/HTMX template functions returning strings. |

No other file shapes are allowed without explicit approval.

### Layout exceptions

Some modules deviate from the 5-file layout for documented reasons:

| Module | Deviation | Reason |
|--------|-----------|--------|
| `shipping`, `content`, `feature-flags` | Routes live in `<n>.views.ts` instead of `<n>.routes.ts` | Simple modules with few routes; views and handlers are tightly coupled. |
| `users` | No `<n>.db.ts` | User data lives in `src/auth/auth.db.ts`; the module only adds admin routes and views over the auth tables. |
| `variants` | No `.rules.ts`, `.routes.ts`, `.views.ts` | Nested under `products`; variant routes and permissions are managed by the products module. Only the DB table and index registration live here. |
| `orders`, `reports` | Extra `<n>.service.ts` | Business logic that exceeds simple repository methods (e.g., order lifecycle, NL→SQL execution). |
| `chat-viewer` | No `CREATE TABLE` | Reads from existing `chat_messages` table (defined in `src/chat/chat.history.ts`). Read-only admin viewer. |

New modules should follow the canonical 5-file layout. The exceptions above are legacy patterns that work but should not be replicated without reason.

## Module registration pattern

```ts
// src/modules/<n>/index.ts
import { AppModule, registerModule, type DashboardCard } from "../../core/modules.ts";
import type { Router } from "../../core/router.ts";
import "./<n>.db.ts";                       // side effect: creates table
import { <N>_KEY } from "./<n>.rules.ts";
import { register<N>Routes } from "./<n>.routes.ts";

class <N>Module extends AppModule {
  readonly key = <N>_KEY;
  readonly title = "<Human Name>";

  registerRoutes(router: Router): void {
    register<N>Routes(router);
  }

  dashboardCard(): DashboardCard {
    return {
      title: "<Human Name>",
      description: "...",
      href: "/admin/<n-plural>",
      moduleKey: <N>_KEY,
      action: "view",
    };
  }
}

registerModule(new <N>Module());
```

Rules:
- Import `./<n>.db.ts` only for its side effect. Do not import any symbol from it in `index.ts`.
- The `key` must be the same string exported as `<N>_KEY` from `<n>.rules.ts`.
- The dashboard card must require the same `action` used by the list route.

## Database / repository pattern

```ts
// src/modules/<n>/<n>.db.ts
import { db, newId, now } from "../../db.ts";
import { Repository } from "../../core/repository.ts";

export interface <N>Row {
  id: string;
  name: string;
  active: number; // SQLite boolean
  created_at: string;
  updated_at: string;
}

export interface <N>Input {
  name: string;
  active?: boolean;
}

class <N>Repository extends Repository<<N>Row> {
  constructor() {
    super({
      db,
      table: "<n>s",
      columns: ["id", "name", "active", "created_at", "updated_at"],
    });
    db.run(`
      CREATE TABLE IF NOT EXISTS <n>s (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        active      INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      )
    `);
  }

  insert(input: <N>Input): <N>Row {
    const id = newId();
    const createdAt = now();
    const row: <N>Row = {
      id,
      name: input.name,
      active: input.active ? 1 : 0,
      created_at: createdAt,
      updated_at: createdAt,
    };
    this.run(
      `INSERT INTO <n>s (id, name, active, created_at, updated_at)
       VALUES ($id, $name, $active, $createdAt, $updatedAt)`,
      {
        $id: row.id,
        $name: row.name,
        $active: row.active,
        $createdAt: row.created_at,
        $updatedAt: row.updated_at,
      },
    );
    return row;
  }

  // ... update, list, findBySlug, etc.
}

export const <n>Repo = new <N>Repository();
```

Rules:
- Tables are created at import time via `CREATE TABLE IF NOT EXISTS` inside the repository constructor.
- Use `Repository` from `core/repository.ts` for common queries.
- `id` is always `TEXT PRIMARY KEY` generated with `newId()` (a UUID string).
- `created_at` and `updated_at` are always ISO strings via `now()`.
- SQLite booleans are `INTEGER` (`1`/`0`). Convert at the repository boundary.
- Foreign keys are `TEXT`.
- Add search columns named `<field>_search` with lowercase + unaccented text; query with `LIKE`.
- Never load entire tables into memory; paginate with `this.paginate()`.

## Rules file pattern

```ts
// src/modules/<n>/<n>.rules.ts
import { registerPermissions, type PermissionMatrix } from "../../core/permissions.ts";

export const <N>_KEY = "<n>s";

export const <n>Permissions: PermissionMatrix = {
  view: ["admin", "manager"],
  create: ["admin"],
  edit: ["admin"],
  delete: ["admin"],
};

registerPermissions(<N>_KEY, <n>Permissions);

export interface Validated<N> {
  data: { name: string; active: boolean };
  errors: Record<string, string>;
}

export function validate<N>(form: FormData): { data: <N>Input; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const name = (form.get("name")?.toString() ?? "").trim();

  if (!name) errors.name = "El nombre es obligatorio.";
  if (name.length > 120) errors.name = "Máximo 120 caracteres.";

  return {
    data: { name, active: form.get("active") === "1" },
    errors,
  };
}
```

Rules:
- `<N>_KEY` is the module key used by permissions and the dashboard.
- Register permissions immediately after defining them.
- Validators return `{ data, errors }`. `errors` is a plain record of field → message.
- Error messages are in Spanish.
- Business-rule helpers (defaults, curated arrays, etc.) can be exported here and consumed by `src/scripts/seed.ts`.

## Routes pattern

```ts
// src/modules/<n>/<n>.routes.ts
import type { Router } from "../../core/router.ts";
import { html, fragment, notFound, forbidden } from "../../core/http.ts";
import { requirePermission } from "../../auth/index.ts";
import { <N>_KEY } from "./<n>.rules.ts";
import { <n>Repo } from "./<n>.db.ts";
import * as views from "./<n>.views.ts";

const BASE = "/admin/<n-plural>";

export function register<N>Routes(router: Router): void {
  router.get(BASE, async (ctx) => {
    const guard = await requirePermission(ctx, <N>_KEY, "view");
    if (guard instanceof Response) return guard;

    const result = <n>Repo.paginate({ page: ctx.query.page });

    return ctx.isHtmx
      ? fragment(views.list(result, guard.user))
      : html(views.page(result, guard.user));
  });

  router.get(`${BASE}/nuevo`, async (ctx) => {
    const guard = await requirePermission(ctx, <N>_KEY, "create");
    if (guard instanceof Response) return guard;

    return html(views.form({}, guard.user));
  });

  router.post(BASE, async (ctx) => {
    const guard = await requirePermission(ctx, <N>_KEY, "create");
    if (guard instanceof Response) return guard;

    const form = await ctx.formData();
    const { data, errors } = validate(form);

    if (Object.keys(errors).length > 0) {
      return ctx.isHtmx
        ? fragment(views.form({ data, errors }, guard.user))
        : html(views.form({ data, errors }, guard.user));
    }

    const row = <n>Repo.insert(data);
    return redirect(`${BASE}/${row.id}`);
  });
}
```

Rules:
- Every handler starts with `requirePermission(ctx, <N>_KEY, action)`.
- If the guard returns a `Response`, return it immediately: `if (guard instanceof Response) return guard;`.
- Branch on `ctx.isHtmx`: return `fragment(...)` for partial swaps, `html(...)` for full pages.
- Validate forms in the handler, not in the view.
- Redirect after successful mutations (POST-redirect pattern).
- Use parameterized repository methods or raw SQL with `$name` binds.

## Views / HTMX pattern

```ts
// src/modules/<n>/<n>.views.ts
import { escapeHtml, escapeAttr } from "../../core/http.ts";
import { adminShell } from "../../views.ts";
import { page } from "../../components/layout.ts";
import { dataTable } from "../../components/table.ts";
import { can } from "../../core/permissions.ts";
import type { User } from "../../auth/auth.db.ts";
import type { <N>Row } from "./<n>.db.ts";
import { <N>_KEY } from "./<n>.rules.ts";

export function page(rows: Paginated<<N>Row>, user: User) {
  return adminShell({
    title: "<Human Name>",
    user,
    body: list(rows, user),
  });
}

export function list(rows: Paginated<<N>Row>, user: User) {
  return `
    <div class="stack">
      <h1>Human Name</h1>
      ${can(user, <N>_KEY, "create")
        ? `<a href="/admin/<n-plural>/nuevo" class="button">Nuevo</a>`
        : ""}
      ${dataTable({
        rows: rows.items,
        columns: [
          { key: "name", header: "Nombre" },
          { key: "active", header: "Activo" },
        ],
      })}
    </div>
  `;
}

export function form(opts: { data?: Partial<<N>Input>; errors?: Record<string, string> }, user: User) {
  const data = opts.data ?? {};
  const errors = opts.errors ?? {};
  return adminShell({
    title: data.id ? "Editar" : "Nuevo",
    user,
    body: `
      <form method="post" class="stack">
        <label>
          Nombre
          <input name="name" value="${escapeAttr(data.name ?? "")}" />
          ${errors.name ? `<span class="error">${escapeHtml(errors.name)}</span>` : ""}
        </label>
        <button class="button">Guardar</button>
      </form>
    `,
  });
}
```

Rules:
- Views are plain functions returning strings. No JSX, no template engine.
- Escape every dynamic value with `escapeHtml()` (text) or `escapeAttr()` (attributes) from `src/core/http.ts`.
- Hide UI controls with `can(user, <N>_KEY, action)`, but **always** re-check in the route handler.
- Use shared components: `adminShell`, `page`, `dataTable`, `card`, `forms`.
- Use CSS tokens from `src/theme.ts` (`var(--accent)`, etc.); never hardcode colors.

## Permissions pattern

- Define the matrix in `<n>.rules.ts`.
- Hide the control in the view (`can()`).
- Guard the route (`requirePermission`).
- The matrix is the single source of truth; duplication in views/routes is required defense in depth.

## Adding a new module

1. Create `src/modules/<n>/`.
2. Write `<n>.db.ts` with table + repository.
3. Write `<n>.rules.ts` with key + permissions + validators.
4. Write `<n>.routes.ts` with handlers (list, new, create, edit, update, delete as needed).
5. Write `<n>.views.ts` with full-page and partial templates.
6. Write `index.ts` extending `AppModule` and calling `registerModule()`.
7. Add the side-effect import to `src/modules/index.ts`.
8. If it needs seed data, export defaults from `<n>.rules.ts` and consume them in `src/scripts/seed.ts`. Do not self-seed.
9. Use `src/modules/products/` as the canonical reference.
10. Validate with `bun run typecheck`.

## Module types

- **Shared master data:** `products`, `variants`, `categories`, `inventory`, `shipping`, `content`, `feature-flags`. Everyone sees the same rows; `created_by` is audit-only.
- **User-scoped:** `orders`. Filtered by owner in storefront/chat; staff with permission sees all in admin.
- **Tool/analytics:** `reports` (read-only NL→SQL), `users` (role management), `chat-viewer` (read-only conversation viewer).

## Anti-patterns

- Do not create `<n>.seed.ts` inside a module.
- Do not call seed/ensure-default functions from `index.ts`.
- Do not import repositories from other modules except through clearly defined public exports.
- Do not put business logic in views or route handlers; keep it in `<n>.rules.ts` or the repository.
- Do not use `any`. Strict TypeScript is required.
