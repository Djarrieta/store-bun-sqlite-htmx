# §7 — Data model (schema)

Source of truth for table design conventions and core entities.

Each module defines its own tables in `<n>.db.ts` via `CREATE TABLE IF NOT EXISTS`. The fields listed below are **examples** — modules add columns as business needs evolve. For the exact current schema of every table, see `docs/schema.md`.

## Conventions

- **IDs:** text UUIDs (`crypto.randomUUID()`), `TEXT PRIMARY KEY`.
- **Timestamps:** `created_at`, `updated_at` as `TEXT` (ISO 8601).
- **Monetary amounts:** stored as **integers in whole COP cents** (`*_cents`). Displayed as `$ 15.000`. No decimals.
- **FKs:** `TEXT` referencing the parent table's primary key.
- **Booleans:** `INTEGER` (`1`/`0`). Convert at the repository boundary.
- **Ordering:** default `ORDER BY created_at DESC` unless specified otherwise.
- **PRAGMA `user_version`:** used for versioned migrations.
- **Search columns:** `*_search` with lowercase + unaccented text; query with `LIKE`.
- **JSON:** `TEXT` columns with serialized JSON (e.g. images arrays, attributes maps).

## Core entities

### `categories`

Product categories. Key fields: `id`, `name` (unique). Modules may add `description`, `image_url`, `sort_order`, search columns, etc.

### `products`

Catalog products. Key fields: `id`, title/name, `category_id` (FK), price in cents, `active`/`status`, timestamps. Modules may add `description`, `discount_pct`, `tags`, `images` (JSON), `created_by`, search columns, etc.

### `variants`

Product variants (SKU, size, color). Key fields: `id`, `product_id` (FK), `sku` (unique), name, optional price override, `stock` balance, `active`. A product with no explicit variants still has one default variant. Modules may add `attributes` (JSON), `low_stock_threshold`, `image_url`, timestamps, etc.

### `stock_movements` / inventory log

Audit log for every stock change. Key fields: `id`, `variant_id` (FK), `delta`/`quantity`, `reason`, optional `order_id`, `created_by`, timestamp. The denormalized balance lives on `variants.stock`; the movement log is the source of truth.

### `orders`

Order lifecycle. Key fields: `id`, optional `user_id` (FK) and `guest_ref` for anonymous checkouts, `status`, `payment_ref` (UUID), `total_cents`, timestamps. Modules may add `subtotal_cents`, `shipping_*` fields, `payment_method`, `payment_proof_url`, `tracking_code`, `notes`, etc.

**Status flow:**

```
pending → payment_review → paid → preparing → shipped → delivered
              ↑                                          ↓
              └──────────── cancelled ──────────────────┘
                                                  
                                         refunded (terminal)
```

Can cancel from: `pending`, `payment_review`, `paid`.

> Stock deduction semantics on purchase: see [payments.md](10-payments.md) and [open decisions](19-open-decisions.md).

### `order_items`

Line items snapshot. Key fields: `id`, `order_id` (FK), `variant_id` (FK), product/variant name (snapshot), `quantity`, `unit_price_cents` (snapshot at purchase). Modules may add `sku`, etc.

### `users`

User accounts. Key fields: `id`, `email` (unique), `password_hash` (null if OAuth-only), `role` (default `customer`), `display_name`/`name`, timestamps. Modules may add `phone`, `avatar_url`, `auth_provider`, etc.

### `sessions`

HTTP sessions. Key fields: `id` (SHA-256 hex of opaque cookie token), `user_id` (FK), `expires_at`. Modules may add `created_at`, etc.

> Only the SHA-256 hash of the token is stored in the database. On read, hash the cookie value and compare.

### Chat tables

The chat subsystem uses `chat_messages` (keyed by `ref` + `channel`) and supporting tables for migration logs. Modules may add `chat_conversations`, `chat_settings`, `customer_notes`, etc.

### Feature flags

Simple key/value flags. Key fields: `key` (unique), `enabled`.

### Content

CMS-like content blocks. Key fields: `key` (unique), `value`, `updated_at`.

### Shipping

`shipping_rates` (department + city → price) and `shipping_config` (singleton, free-shipping threshold). Modules may add fields as needed.

## Analytics views (admin-only, no PII)

> Admin NL → SQL is read-only over these prebuilt views, never over raw PII tables.

Typical views include: sales by product, daily summaries, low-stock alerts, top customers, revenue by category, recent activity. Exact view definitions live in `docs/schema.md`.
