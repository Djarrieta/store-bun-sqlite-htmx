# Storefront and checkout

Source of truth: [tech-spec/08-public-storefront.md](tech-spec/08-public-storefront.md).

## Public routes

Public routes are resolved **before** the session auth guard.

| Route | Description |
|-------|-------------|
| `GET /` | Home: grid of featured/active products. |
| `GET /productos` | Catalog with search + category filter + pagination (HTMX). |
| `GET /productos/:id` | Product detail: images, description, variant selector, price, stock, add-to-cart/buy. |
| `GET /categorias/:id` | Catalog filtered by category. |
| `GET /carrito` | Cart. |
| `GET /checkout` | Shipping data + summary + Nequi payment instructions. |
| `GET /orden/:id` | Order status. |
| `POST /orden/:id/comprobante` | Upload Nequi proof image; associates it with the order. |
| `GET /nosotros`, `GET /pagos-envios` | Content pages from `content` table. |

Pattern: each page is a function returning server-rendered HTML. Interactivity (search, paginate, cart, chat) uses HTMX (`hx-get`, `hx-post` returning fragments). Catalog is cacheable by Cloudflare.

## Cart

Recommended: **server-side cookie cart**.

- Cart is stored server-side, referenced by the single `guest_ref` cookie.
- The same `guest_ref` identifies cart, chat, and `orders.guest_ref`.
- HTMX can render the mini-cart and totals without client-side state.

Alternative (`localStorage` + some JS) is documented but departs from the pure HTMX approach.

## Checkout (v1 — manual Nequi)

1. Customer fills shipping data (department/city → calculate `shipping_cents` using `shipping_rates` and `free_above_cents`).
2. Create order in `pending` with snapshot of line items and totals, and generate `payment_ref` (UUID).
3. Show Nequi payment instructions (number/QR, exact amount, `payment_ref`).
4. Customer transfers and uploads proof from the order page (`POST /orden/:id/comprobante`) or via chat.
5. On proof receipt, order moves to `payment_review`; admin verifies and marks `paid`.

### Server validations

- Recalculate prices and shipping on the server; never trust client amounts.
- Verify stock availability before creating the order.
- Create order items as a snapshot (title, variant name, SKU, qty, unit price) so historical orders stay correct even if products change later.

## Files

- `src/storefront/home.routes.ts`
- `src/storefront/catalog.routes.ts`
- `src/storefront/product.routes.ts`
- `src/storefront/cart.routes.ts`
- `src/storefront/checkout.routes.ts`
- `src/components/storefront/` — ProductCard, cart, chat FAB.
