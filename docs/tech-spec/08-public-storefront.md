# §8–§9 — Public storefront

Source of truth for public routes, catalog browsing, and product detail pages.

## Public routes

| Route | Method | Description |
| --- | --- | --- |
| `/` | GET | Home page / landing |
| `/productos` | GET | Product catalog (paginated, filterable by category) |
| `/productos/:id` | GET | Product detail (images, variants, price, stock, add-to-cart) |
| `/categorias/:slug` | GET | Catalog filtered by category |
| `/carrito` | GET | Cart |
| `/checkout` | GET | Shipping data + summary + payment instructions |
| `/orden/:id` | GET | Order status + proof upload |
| `/orden/:id/comprobante` | POST | Upload Nequi proof image for this order |
| `/nosotros`, `/pagos-envios` | GET | Content pages from `content` table |

## Catalog

- List active products with pagination and category filter.
- Sort options: newest, price asc/desc.
- Show image, title, price.
- Catalog pages are cacheable by Cloudflare.

## Product detail

- Show active variants.
- Variant price: use variant override if set, otherwise product base price.
- Stock badge: "En stock" / "Agotado".
- Add-to-cart button (HTMX POST to cart endpoint).

## UX notes

- All UI copy in Spanish.
- Mobile-first responsive design.
- Minimal JS: HTMX handles search, pagination, add-to-cart, proof upload, and order status refresh.
