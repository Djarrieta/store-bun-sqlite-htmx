/** Storefront product card (catalog grid) with variant selector + add-to-cart. */
import { escapeHtml, escapeAttr } from "../../core/http.ts";
import { formatCop } from "../../core/format.ts";
import { registerCss } from "../registry.ts";
import { parseImages, effectivePriceCents, type Product } from "../../modules/products/products.db.ts";
import type { Variant } from "../../modules/variants/variants.db.ts";

registerCss(/* css */ `
.pcard { display: flex; flex-direction: column; }
.pcard__media {
  aspect-ratio: 1; background: var(--card); border-radius: var(--radius-btn-icon);
  overflow: hidden; display: grid; place-items: center; margin-bottom: 0.85rem;
}
.pcard__media img { width: 100%; height: 100%; object-fit: cover; }
.pcard__media .ph { color: var(--muted); font-family: var(--font-serif); font-size: 1.5rem; }
.pcard__head { display: flex; justify-content: space-between; gap: 0.75rem; align-items: baseline; }
.pcard__title { font-family: var(--font-serif); font-size: 1.15rem; margin: 0; }
.pcard__price { font-weight: 700; white-space: nowrap; }
.pcard__price s { color: var(--muted); font-weight: 400; margin-right: 0.35rem; font-size: 0.85em; }
.pcard__desc { color: var(--muted); font-size: 0.9rem; margin: 0.4rem 0 0.6rem; }
.pcard__detail { display: block; text-align: right; font-size: 0.85rem; margin-bottom: 0.75rem; }
.pcard__form { margin-top: auto; }
.pcard__form .field { margin-bottom: 0.6rem; }
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
  if (img) return `<div class="pcard__media"><img src="${escapeAttr(img.url)}" alt="${escapeAttr(img.alt ?? product.title)}" loading="lazy"></div>`;
  return `<div class="pcard__media"><span class="ph">CRISTA</span></div>`;
}

export function productCard(product: Product, variants: Variant[]): string {
  const truncated = product.description.length > 96 ? `${product.description.slice(0, 96)}…` : product.description;
  const inStock = variants.filter((v) => v.stock > 0);
  const addForm = inStock.length
    ? `<form class="pcard__form" hx-post="/carrito/agregar" hx-target="#cart-badge" hx-swap="outerHTML">
        <input type="hidden" name="product_id" value="${escapeAttr(product.id)}">
        <div class="field">
          <label>Variante</label>
          <select class="select" name="variant_id" required>
            ${inStock.map((v) => `<option value="${escapeAttr(v.id)}">${escapeHtml(v.name)}</option>`).join("")}
          </select>
        </div>
        <button type="submit" class="btn btn--block">Agregar al carrito</button>
      </form>`
    : `<button class="btn btn--block" disabled aria-disabled="true">Agotado</button>`;

  return `<article class="panel pcard">
    ${media(product)}
    <div class="pcard__head">
      <h3 class="pcard__title">${escapeHtml(product.title)}</h3>
      ${priceHtml(product)}
    </div>
    ${truncated ? `<p class="pcard__desc">${escapeHtml(truncated)}</p>` : ""}
    <a class="pcard__detail" href="/productos/${escapeAttr(product.id)}">Ver detalle →</a>
    ${addForm}
  </article>`;
}
