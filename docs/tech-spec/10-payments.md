# §11 — Payments (Nequi v1, future Wompi)

Source of truth for payment flows. See also [cart/checkout](09-cart-checkout.md).

## Nequi manual transfer (v1)

| Step | Actor | Action |
| --- | --- | --- |
| 1 | Customer | Initiates Nequi transfer to store's Nequi number |
| 2 | Customer | Includes `payment_ref` (UUID) in the transfer note |
| 3 | Customer | Optionally uploads transfer screenshot as proof |
| 4 | Admin | Verifies transfer in Nequi app/dashboard |
| 5 | Admin | Marks order as `paid` |

### Proof handling

- Proof image is validated (magic bytes, size) and stored in **private** storage (see [storage](07-storage.md)).
- Admin accesses proofs via guarded download endpoint.
- Customer can also send proof via chat (see [chat.md](13-chat.md) — WhatsApp flow).

### Order lifecycle

```
pending → payment_review → paid → preparing → shipped → delivered
              ↑                                          ↓
              └──────────── cancelled ──────────────────┘
                                                  
                                         refunded (terminal)
```

### Stock deduction

Stock is deducted when the order transitions to **`paid`** (not at checkout).

## Wompi (future phase)

- Automatic payment gateway with webhook callbacks.
- Environment variables: `WOMPI_*` (see [env vars](17-env-vars.md)).
- Integration folder: `integrations/wompi/`.
- Not a v1 objective (see [open decisions](19-open-decisions.md)).
