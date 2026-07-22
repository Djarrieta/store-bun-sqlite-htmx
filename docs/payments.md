# Payments

Source of truth: [tech-spec/10-payments.md](tech-spec/10-payments.md).

## v1 — Manual Nequi payment

There is **no automatic payment gateway** in v1. Collection is a **manual Nequi transfer** verified by staff.

### Flow

1. On checkout confirmation, create the order in `pending` with:
   - `payment_ref` (UUID)
   - `payment_method='nequi'`
   - totals calculated server-side
2. Show **payment instructions**: Nequi number/QR, **exact amount** (`total_cents`), and reference `payment_ref`.
3. The customer transfers from their Nequi app and sends the **proof image**. Two equivalent channels:
   - Order page upload: `POST /orden/:id/comprobante`
   - Chat attachment (web or verified WhatsApp)
4. On proof receipt, validate and store the image (see §8 / docs/security.md), associate it as `payment_proof_url`, and move the order to **`payment_review`**.
5. An admin/staff with order permission reviews the proof in the `orders` module and:
   - **Approves** → order `paid`, record `paid_at` and `payment_verified_by`, and **deduct stock** (`stock_movements` reason `sale` + balance update) in one SQLite transaction.
   - **Rejects** → order back to `pending`.

### Idempotency and security

- Stock is deducted **only once**, when moving to `paid`, conditioned on the previous state to prevent double deduction.
- Amounts are **recalculated server-side**; the proof is evidence, not the source of truth.
- Verification is **human** in v1; the image content is not interpreted automatically.
- The proof is validated by type/size and stored in **private** storage with guard access (see docs/security.md).

## Stock semantics

- Stock is deducted **on payment approval**, not on `pending` order creation, to avoid blocking inventory for abandoned checkouts.
- Optional future enhancement: "soft reservation" with expiration during active checkout.

## Future — Wompi automatic gateway

When Wompi (COP) is integrated, manual verification is replaced by automatic confirmation, reusing the same order model (`payment_method='wompi'`).

### Checkout integrity signature

SHA-256 of `reference + amount_in_cents + currency + WOMPI_INTEGRITY_SECRET`.

The Wompi Widget receives:

- `public-key`
- `currency=COP`
- `amount-in-cents`
- `reference`
- `signature:integrity`
- `redirect-url`

### Webhook

`POST /api/wompi/webhook`:

1. Verify `signature.checksum` (SHA-256 of properties + `timestamp` + `WOMPI_EVENTS_SECRET`).
2. Find order by `payment_ref`.
3. If `transaction.status == APPROVED`, mark `paid` + deduct stock in a transaction.
4. Idempotent by transaction id.

### Defense in depth

In `/checkout/resultado`, also confirm status against the **Wompi transactions API**; do not rely only on the redirect.

Variables: `WOMPI_ENV`, `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`.

## Files

- `src/modules/orders/` — order lifecycle, proof association, verification.
- `src/modules/inventory/` — stock movements and balance.
- `src/storefront/checkout.routes.ts` — checkout and payment instructions.
- `src/storefront/cart.routes.ts` — cart.
- Future: `src/integrations/wompi/`
