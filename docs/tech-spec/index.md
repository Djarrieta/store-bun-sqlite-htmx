# Tech Spec — `store-bun-sqlite-htmx`

Online store + admin panel + multichannel AI assistant/chat, built on a
**Bun + HTMX + SQLite** stack: server-rendered, no build step,
self-hosted and published via **Cloudflare Tunnel** on a custom domain.

This is the **design source of truth**. Read the relevant section before implementing a feature.

## Sections

| # | File | Topic |
|---|------|-------|
| §1 | [01-goals.md](01-goals.md) | Goals and non-goals |
| §2 | [02-decisions.md](02-decisions.md) | Fixed decisions and assumptions |
| §3 | [03-stack.md](03-stack.md) | Tech stack |
| §4 | [04-architecture.md](04-architecture.md) | General architecture |
| §5 | [05-folder-structure.md](05-folder-structure.md) | Folder structure |
| §6 | [06-modules.md](06-modules.md) | Module system |
| §7 | [07-data-model.md](07-data-model.md) | Data model (schema) |
| §8 | [07-storage.md](07-storage.md) | Storage (uploads, images, proofs) |
| §9–10 | [08-public-storefront.md](08-public-storefront.md) | Public storefront |
| §10–11 | [09-cart-checkout.md](09-cart-checkout.md) | Cart, checkout, and payments |
| §11 | [10-payments.md](10-payments.md) | Payments (Nequi v1, future Wompi) |
| §12 | [11-admin-panel.md](11-admin-panel.md) | Admin panel |
| §13 | [12-auth.md](12-auth.md) | Authentication and authorization |
| §14 | [13-chat.md](13-chat.md) | AI assistant / Chat |
| §15 | [14-ui-theming.md](14-ui-theming.md) | UI theming |
| §16 | [15-security.md](15-security.md) | Security |
| §17 | [16-deployment.md](16-deployment.md) | Deployment and rollback |
| §18 | [17-env-vars.md](17-env-vars.md) | Environment variables |
| §19 | [18-phased-plan.md](18-phased-plan.md) | Phased plan |
| §20 | [19-open-decisions.md](19-open-decisions.md) | Open decisions |

## Quick links by task

| Task | Start here |
|------|------------|
| Add a new module | [06-modules.md](06-modules.md) |
| Add or change a table | [07-data-model.md](07-data-model.md) |
| Work on public pages | [08-public-storefront.md](08-public-storefront.md) |
| Work on checkout/payments | [09-cart-checkout.md](09-cart-checkout.md), [10-payments.md](10-payments.md) |
| Work on admin panel | [11-admin-panel.md](11-admin-panel.md) |
| Work on auth/users | [12-auth.md](12-auth.md) |
| Work on chat/AI | [13-chat.md](13-chat.md) |
| Change UI/theme | [14-ui-theming.md](14-ui-theming.md) |
| Security review | [15-security.md](15-security.md) |
| Deploy to production | [16-deployment.md](16-deployment.md) |
| Add env variable | [17-env-vars.md](17-env-vars.md) |
| Check roadmap | [18-phased-plan.md](18-phased-plan.md) |
| Review unresolved questions | [19-open-decisions.md](19-open-decisions.md) |
