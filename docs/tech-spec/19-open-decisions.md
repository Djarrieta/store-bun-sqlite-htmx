# §20 — Open decisions

Source of truth for unresolved design decisions.

| ID | Topic | Decision | Status |
| --- | --- | --- | --- |
| D1 | Admin analytics interface | Natural language → SQL over views (no PII) | Approved |
| D2 | Product customization | **Out of v1.** Future phase. | Deferred |
| D3 | Payments | v1 = manual Nequi transfer. Wompi = future. | Approved |
| D4 | Inventory management | Minimal: stock count on variant, entries log. No reservations. | Approved |
| D5 | Multi-language | Spanish only in v1. | Approved |
| D6 | Deployment | Docker on self-hosted server, Cloudflare Tunnel. | Approved |
| D7 | Real-time payments | Not v1. Future phase (Wompi). | Deferred |
| O-1 | Stock deduction timing | Deduct on payment confirmation (`paid`), not at checkout. | Approved |
| O-2 | Cart persistence | Server-side cart via `guest_ref` cookie (shared with chat and orders). | Approved |
| O-6 | Analytics views | Admin NL → SQL over prebuilt views, no row-level security. | Approved |
