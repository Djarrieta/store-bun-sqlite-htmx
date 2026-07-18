/** Storefront product card (catalog grid) with variant selector + add-to-cart. */
import { escapeHtml, escapeAttr } from "../../core/http.ts";
import { formatCop } from "../../core/format.ts";
import { registerCss } from "../registry.ts";
import { parseImages, effectivePriceCents, type Product } from "../../modules/products/products.db.ts";
import type { Variant } from "../../modules/variants/variants.db.ts";

registerCss(/* css */ `
.pcard { display: flex; flex-direction: column; }
.pcard__media {
  position: relative; aspect-ratio: 4 / 5; background: var(--card);
  border-radius: var(--radius-card); overflow: hidden;
  display: grid; place-items: center; margin-bottom: 0.9rem;
}
.pcard__media img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s ease; }
.pcard:hover .pcard__media img { transform: scale(1.045); }
.pcard__media .ph { color: var(--muted); font-family: var(--font-serif); letter-spacing: 0.24em; font-size: 1.2rem; }
.pcard__flag {
  position: absolute; top: 0.7rem; left: 0.7rem;
  background: var(--accent); color: var(--accent-foreground);
  font-size: 0.66rem; font-weight: 600; letter-spacing: 0.08em;
  padding: 0.2rem 0.5rem; border-radius: 999px;
}
.pcard__title { font-family: var(--font-serif); font-size: 1.22rem; line-height: 1.2; margin: 0; }
.pcard__title a { color: var(--fg); }
.pcard__title a:hover { color: var(--accent); }
.pcard__price { color: var(--accent); font-weight: 600; margin: 0.2rem 0 0; }
.pcard__price s { color: var(--muted); font-weight: 400; margin-right: 0.4rem; font-size: 0.85em; }
.pcard__desc { color: var(--muted); font-size: 0.88rem; margin: 0.4rem 0 0; }
.pcard__form { margin-top: 0.9rem; }
.pcard__form .field { margin-bottom: 0.5rem; }
.pcard__form .field > label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); }
`);

function priceHtml(product: Product): string {
  const eff = effectivePriceCents(product.price_cents, product.discount_pct);
  if (product.discount_pct > 0) {
    return `<span class="pcard__price"><s>${escapeHtml(formatCop(product.price_cents))}</s>${escapeHtml(formatCop(eff))}</span>`;
  }
  return `<span class="pcard__price">${escapeHtml(formatCop(eff))}</span>`;
}

function media(product: Product): string {
  const img = parseImages(product)[0];
  const flag = product.discount_pct > 0 ? `<span class="pcard__flag">−${product.discount_pct}%</span>` : "";
  const inner = img
    ? `<img src="${escapeAttr(img.url)}" alt="${escapeAttr(img.alt ?? product.title)}" loading="lazy">`
    : `<span class="ph">CRISTA</span>`;
  return `<a class="pcard__media" href="/productos/${escapeAttr(product.id)}">${inner}${flag}</a>`;
}

export function productCard(product: Product, variants: Variant[]): string {
  const inStock = variants.filter((v) => v.stock > 0);
  const addForm = inStock.length
    ? `<form class="pcard__form" hx-post="/carrito/agregar" hx-target="#cart-badge" hx-swap="outerHTML">
        <input type="hidden" name="product_id" value="${escapeAttr(product.id)}">
        <div class="field">
          <label>Talla / variante</label>
          <select class="select" name="variant_id" required>
            ${inStock.map((v) => `<option value="${escapeAttr(v.id)}">${escapeHtml(v.name)}</option>`).join("")}
          </select>
        </div>
        <button type="submit" class="btn btn--outline btn--block">Agregar al carrito</button>
      </form>`
    : `<div class="pcard__form"><button class="btn btn--outline btn--block" disabled aria-disabled="true">Agotado</button></div>`;

  return `<article class="pcard">
    ${media(product)}
    <h3 class="pcard__title"><a href="/productos/${escapeAttr(product.id)}">${escapeHtml(product.title)}</a></h3>
    ${priceHtml(product)}
    ${addForm}
  </article>`;
}
