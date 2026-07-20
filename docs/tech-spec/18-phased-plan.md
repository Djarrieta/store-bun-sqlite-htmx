# §19 — Phased plan

Source of truth for the implementation roadmap.

## Phase 0 — Foundation (Week 1)

- Bun project init, folder structure, config, DB connection.
- Module system scaffold.
- Auth system (Google + email/password).
- Admin seed user.
- First module: `categories` (CRUD).

## Phase 1 — Core catalog (Week 2)

- `products` module (CRUD with images).
- `variants` module (CRUD, stock).
- Public catalog pages (`/productos`, `/productos/:slug`).
- Image upload pipeline.

## Phase 2 — Orders + Payments (Week 3)

- `orders` module (create, status flow).
- Cart (localStorage + HTMX).
- Checkout form.
- Nequi payment instructions + `payment_ref`.
- Proof upload endpoint.

## Phase 3 — Admin panel (Week 4)

- Admin layout + navigation.
- Product/category/order management views.
- Order detail with proof review.
- Admin guard on all `/admin/*` routes.

## Phase 4 — AI Chat (Week 5) ✅

- Chat module: provider, tools, conversation storage.
- Web chat widget (HTMX).
- Admin chat interface (visor de conversaciones en `/admin/conversaciones`).
- Tool: `order_status`, `product_lookup`.

## Phase 5 — Polish + Deploy (Week 6)

- UI theming (CRISTA tokens, components).
- Mobile responsiveness.
- Security hardening (see [security checklist](15-security.md)).
- Docker + Cloudflare Tunnel setup.
- Backup script (`deploy.sh`).
- Seed data for demo.

## Future phases (post-v1)

- WhatsApp integration.
- Wompi automatic payments.
- Inventory alerts + notifications.
- Analytics dashboard (NL → SQL).
- Customer notes.
- Litestream continuous backup.
