# §15 — UI theming

Source of truth for design tokens, components, and visual direction. For the exact current token values and component implementations, see [docs/ui-theming.md](../../docs/ui-theming.md).

## Brand

- **Brand name:** Cristaterapia (Cristal Therapeutics)
- **Logo:** `public/brand/logo-htal.png`
- **No-image placeholder:** `public/brand/no-image.jpeg`

## Design tokens

All design tokens live in `src/theme.ts` and are exposed as CSS variables in `:root`. Components reference `var(--token)` — never hardcode colors.

The CRISTA identity uses a warm palette: off-white background, warm brown text, burgundy accent. Serif font for headings, sans for body. Self-hosted fonts in `public/fonts/`.

See `src/theme.ts` for the full canonical token set.

## Components

Components are plain functions returning strings, under `src/components/`:

| Component | Description | File |
| --- | --- | --- |
| `layout.ts` | Shell HTML, `@font-face`, HTMX script, global CSS | `src/components/layout.ts` |
| `nav.ts` | Navigation with logo | `src/components/nav.ts` |
| `table.ts` | `dataTable()` with responsive collapse | `src/components/table.ts` |
| `forms.ts` | Form helpers | `src/components/forms.ts` |
| `card.ts` | Shared UI primitives (`card()`, `badge()`, `alert()`) | `src/components/card.ts` |
| `registry.ts` | Component CSS registry (`registerCss()`, `collectedCss()`) | `src/components/registry.ts` |
| `storefront/product-card.ts` | ProductCard component | `src/components/storefront/product-card.ts` |

Output escaping (`escapeHtml()`, `escapeAttr()`) lives in `src/core/http.ts`, not in `registry.ts`.

## Visual direction

- Clean, minimal, trustworthy — not flashy.
- Mobile-first responsive layout.
- Generous whitespace, readable typography (self-hosted woff2).
- Product cards: image, name, price, "Agregar al carrito" button.

## Layouts

Both the storefront and admin shell share the same design tokens but have different navigation structures. Exact layout files are defined in each module's views.
