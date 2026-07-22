# UI and theming

Source of truth: [tech-spec/14-ui-theming.md](tech-spec/14-ui-theming.md).

## Stack

- HTMX for all interactivity (search, paginate, add to cart, chat messages, order status changes).
- Responses are HTML fragments.
- No client-side framework, no JSX, no template engine.

## Theme tokens

All design tokens live in `src/theme.ts` and are exposed as CSS variables in `:root`. Components reference `var(--token)`; **never hardcode colors**.

The CRISTA identity uses:

- Serif font for headings.
- Sans font for body.
- Self-hosted fonts in `public/fonts/`.
- Warm palette: off-white background, warm brown text, burgundy accent.

### Key tokens

```css
:root {
  --bg: #f8f5f0;
  --fg: #3f2f27;
  --card: #efe7dc;
  --muted: #8b7565;
  --accent: #7b1e2e;
  --accent-foreground: #f8f5f0;
  --accent-hover: #651825;
  --sage: #aab7a0;
  --terracotta: #c47d5a;
  --gold: #8b6f4d;
  --surface: #fffdfa;
  --border: #d8ccbb;
  --border-strong: #c9b9a4;
  --shadow: rgba(107, 86, 72, 0.16);
  --danger: #d9a7a2;
  --success: #aab7a0;
  --warning: #d8b46a;
  --radius-btn-sm: 0.125rem;
  --radius-btn-md: 0.125rem;
  --radius-btn-lg: 0.125rem;
  --radius-btn-xl: 0.125rem;
  --radius-btn-icon: 0.25rem;
  --radius-card: 0.375rem;
}
```

See `src/theme.ts` for the full canonical set.

## Components

Components are plain functions returning strings, under `src/components/`:

- `layout.ts` — shell HTML, `@font-face`, HTMX script, global CSS injection.
- `nav.ts` — navigation with logo from `public/brand/logo-htal.png`.
- `card.ts` — `card()`, `badge()`, `alert()` shared UI primitives.
- `table.ts` — `dataTable()` with responsive collapse.
- `forms.ts` — form helpers.
- `storefront/product-card.ts` — ProductCard component.

### Component rules

- Each component owns its CSS, added globally by `layout.ts`.
- HTMX fragments must be styled without sending a `<style>` tag per fragment.
- Use `escapeHtml()` / `escapeAttr()` from `src/core/http.ts` for dynamic values.
- Hide controls based on `can()`; re-check in route handlers.

## Logo / brand

- `nav.ts` displays the store logo from `public/brand/logo-htal.png`.
- Served by Bun with immutable cache, like fonts.
- Links to `/`.
- Use descriptive `alt`, fixed `width`/`height` to avoid layout shift.
- Other logo variants live in `public/brand/`.

## Responsive

- Mobile-first.
- Data tables collapse to labeled value cards below 640px via `dataTable()`.

## Fonts

- Self-hosted in `public/fonts/` (woff2).
- Served by Bun with immutable cache.

## Mockups

Reference mockups live in `docs/mockups/`:

| File | Screen |
|------|--------|
| `storefront-home.png` | Public home |
| `storefront-catalog.png` | Catalog |
| `storefront-product-cards.png` | Product cards |
| `chat-assistant.png` | Chat |
| `admin-products.png` | Admin products |

These are design reference only; not served publicly.

## Files

- `src/theme.ts` — canonical tokens.
- `src/components/registry.ts` — component CSS registry (`registerCss()`, `collectedCss()`).
- `src/core/http.ts` — `escapeHtml()`, `escapeAttr()`.
- `src/components/layout.ts` — shell + global CSS.
- `src/components/nav.ts` — navigation.
- `src/components/card.ts` — `card()`, `badge()`, `alert()`.
- `src/components/table.ts` — `dataTable()`.
- `src/components/forms.ts` — form helpers.
- `src/components/storefront/product-card.ts` — ProductCard.
- `public/fonts/` — self-hosted fonts.
- `public/brand/` — logo assets.
