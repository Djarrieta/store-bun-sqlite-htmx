# §10–§11 — Cart, checkout, and payments

Source of truth for cart, checkout flow, and Nequi manual payment.

## Cart

- Server-side cart referenced by the `guest_ref` cookie (same ID used for chat and `orders.guest_ref`).
- Cart items: `{ variant_id, quantity }`.
- HTMX requests update the mini-cart and totals without client-side state.

## Checkout flow

1. User reviews cart → clicks "Pagar".
2. If not logged in → can continue as guest (or log in for order history).
3. Checkout form: shipping data (department, city, address, phone, notes).
4. On submit: server recalculates prices and shipping, verifies stock, creates the order in status **`pending`** with a generated `payment_ref` (UUID).
5. Customer sees Nequi transfer instructions + the `payment_ref` to include in the transfer note.
6. Customer can upload proof (image) via `/orden/:id/comprobante` or via chat (see [chat.md](13-chat.md)).
7. On proof receipt, validate and store the image (see [storage](07-storage.md)), associate it as `payment_proof_url`, and move the order to **`payment_review`**.

## Payment: Nequi manual transfer (v1)

1. Customer initiates a Nequi transfer (app-to-app) to the store's Nequi number.
2. Customer includes the `payment_ref` (UUID) in the transfer note or sends it via chat.
3. Customer optionally uploads the transfer screenshot/image as proof.
4. An **admin verifies** the transfer in the Nequi app or dashboard.
5. Admin marks the order as **`paid`** in the admin panel.

> Stock deduction happens at payment confirmation (order → `paid`).

## Order status flow

```
pending → payment_review → paid → shipped → delivered
              ↑                         ↓
              └─── cancelled ───────────┘
```

Can cancel from: `pending`, `payment_review`, `paid`.

## Wompi (future phase)

- Automatic payment gateway.
- Variables: `WOMPI_*` (see [env vars](17-env-vars.md) and [architecture](04-architecture.md)).
- Integration folder: `integrations/wompi/`.
