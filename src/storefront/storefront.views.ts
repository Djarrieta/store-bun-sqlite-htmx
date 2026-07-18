/** Storefront catalog + product detail views. */
import { page } from "../components/layout.ts";
import { escapeHtml, escapeAttr } from "../core/http.ts";
import { formatCop } from "../core/format.ts";
import { productCard } from "../components/storefront/product-card.ts";
import { leafDivider } from "../components/ornament.ts";
import { registerCss } from "../components/registry.ts";
import type { User } from "../auth/auth.db.ts";
import type { Page } from "../core/repository.ts";
import { parseImages, parseTags, effectivePriceCents, type Product } from "../modules/products/products.db.ts";
import { parseAttributes, type Variant } from "../modules/variants/variants.db.ts";
import type { Category } from "../modules/categories/categories.db.ts";

registerCss(/* css */ `
.page-head { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.3rem; margin: 0.5rem 0 2rem; }
.page-head .eyebrow { color: var(--accent); }
.page-head h1 { margin: 0.1rem 0; }
.filters { margin: 0 auto 2.25rem; max-width: 640px; }
.filters__row { display: grid; grid-template-columns: 2fr 1fr; gap: 0.75rem; }
.catalog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.75rem 1.5rem; }
.pdetail { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem; align-items: start; }
.pdetail__media { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-card); overflow: hidden; aspect-ratio: 4 / 5; display: grid; place-items: center; }
.pdetail__media img { width: 100%; height: 100%; object-fit: cover; }
.pdetail__media .ph { color: var(--muted); font-family: var(--font-serif); letter-spacing: 0.24em; font-size: 2rem; }
.pdetail__thumbs { display: flex; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap; }
.pdetail__thumbs img { width: 64px; height: 64px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border); }
.pdetail .ornament { justify-content: flex-start; margin: 1rem 0; }
.pdetail__price { font-family: var(--font-serif); font-size: 1.9rem; color: var(--accent); }
.pdetail__price s { color: var(--muted); font-weight: 400; font-size: 1rem; margin-right: 0.5rem; }
.pdetail__back { text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.75rem; font-weight: 600; }
@media (max-width: 760px) { .pdetail { grid-template-columns: 1fr; } .filters__row { grid-template-columns: 1fr; } }
`);

interface CatalogData {
  pageData: Page<Product>;
  variantsByProduct: Map<string, Variant[]>;
  q: string;
  categories: Category[];
  activeCategory?: Category;
}

export function catalogGrid(data: CatalogData): string {
  const cards = data.pageData.items.length
    ? data.pageData.items
        .map((p) => productCard(p, data.variantsByProduct.get(p.id) ?? []))
        .join("")
    : `<div class="panel"><p class="muted" style="margin:0">No se encontraron productos.</p></div>`;

  const base = data.activeCategory ? `/categorias/${data.activeCategory.slug}` : "/productos";
  const q = data.q;
  const pager =
    data.pageData.totalPages > 1
      ? `<div class="pagination">
          ${data.pageData.page > 1 ? `<a class="btn btn--outline btn--sm" hx-get="${base}?page=${data.pageData.page - 1}&q=${encodeURIComponent(q)}" hx-target="#catalog-grid" hx-swap="innerHTML" hx-push-url="true" href="#">Anterior</a>` : ""}
          <span class="muted">Página ${data.pageData.page} de ${data.pageData.totalPages}</span>
          ${data.pageData.page < data.pageData.totalPages ? `<a class="btn btn--outline btn--sm" hx-get="${base}?page=${data.pageData.page + 1}&q=${encodeURIComponent(q)}" hx-target="#catalog-grid" hx-swap="innerHTML" hx-push-url="true" href="#">Siguiente</a>` : ""}
        </div>`
      : "";

  return `<div class="catalog-grid">${cards}</div>${pager}`;
}

export function catalogPage(opts: { user: User | null; cartCount: number; data: CatalogData }): string {
  const { data } = opts;
  const title = data.activeCategory ? data.activeCategory.name : "Productos";
  const eyebrow = data.activeCategory ? "Categoría" : "Tienda";
  const searchUrl = data.activeCategory ? `/categorias/${data.activeCategory.slug}` : "/productos";
  const body = `
    <div class="page-head">
      <span class="eyebrow">${eyebrow}</span>
      <h1>${escapeHtml(title)}</h1>
      ${leafDivider()}
    </div>
    <div class="filters">
      <div class="filters__row">
        <input class="input" type="search" name="q" value="${escapeAttr(data.q)}" placeholder="Buscar productos…"
          hx-get="${searchUrl}" hx-target="#catalog-grid" hx-swap="innerHTML"
          hx-trigger="keyup changed delay:300ms, search" hx-push-url="true">
        <select class="select" onchange="if(this.value)window.location=this.value">
          <option value="/productos"${!data.activeCategory ? " selected" : ""}>Todas las categorías</option>
          ${data.categories.map((c) => `<option value="/categorias/${escapeAttr(c.slug)}"${data.activeCategory?.id === c.id ? " selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}
        </select>
      </div>
    </div>
    <div id="catalog-grid">${catalogGrid(data)}</div>`;
  return page({ title, user: opts.user, active: "catalog", cartCount: opts.cartCount, body });
}

export function productDetailPage(opts: {
  user: User | null;
  cartCount: number;
  product: Product;
  variants: Variant[];
  category: Category | null;
}): string {
  const { product, variants } = opts;
  const images = parseImages(product);
  const tags = parseTags(product);
  const eff = effectivePriceCents(product.price_cents, product.discount_pct);
  const priceHtml =
    product.discount_pct > 0
      ? `<div class="pdetail__price"><s>${escapeHtml(formatCop(product.price_cents))}</s>${escapeHtml(formatCop(eff))}</div>`
      : `<div class="pdetail__price">${escapeHtml(formatCop(eff))}</div>`;

  const mainImg = images[0]
    ? `<img src="${escapeAttr(images[0].url)}" alt="${escapeAttr(images[0].alt ?? product.title)}">`
    : `<span class="ph">CRISTA</span>`;

  const inStock = variants.filter((v) => v.stock > 0);
  const buyBox = inStock.length
    ? `<form hx-post="/carrito/agregar" hx-target="#cart-badge" hx-swap="outerHTML" class="stack" style="margin-top:1.5rem">
        <input type="hidden" name="product_id" value="${escapeAttr(product.id)}">
        <div class="field">
          <label for="variant_id">Variante</label>
          <select class="select" id="variant_id" name="variant_id" required>
            ${inStock
              .map((v) => {
                const attrs = parseAttributes(v);
                const suffix = Object.keys(attrs).length ? ` (${Object.values(attrs).join(" / ")})` : "";
                const vp = v.price_cents !== null ? ` — ${formatCop(v.price_cents)}` : "";
                return `<option value="${escapeAttr(v.id)}">${escapeHtml(v.name + suffix + vp)}</option>`;
              })
              .join("")}
          </select>
        </div>
        <div class="field" style="max-width:120px">
          <label for="qty">Cantidad</label>
          <input class="input" id="qty" name="qty" type="number" value="1" min="1" max="20">
        </div>
        <button type="submit" class="btn">Agregar al carrito</button>
      </form>`
    : `<p class="badge badge--warn" style="margin-top:1.5rem">Agotado</p>`;

  const body = `
    <p style="margin-bottom:1.25rem"><a class="pdetail__back muted" href="/productos">← Volver al catálogo</a></p>
    <div class="pdetail">
      <div>
        <div class="pdetail__media">${mainImg}</div>
        ${images.length > 1 ? `<div class="pdetail__thumbs">${images.map((im) => `<img src="${escapeAttr(im.url)}" alt="${escapeAttr(im.alt ?? "")}">`).join("")}</div>` : ""}
      </div>
      <div>
        ${opts.category ? `<span class="eyebrow">${escapeHtml(opts.category.name)}</span>` : ""}
        <h1>${escapeHtml(product.title)}</h1>
        ${priceHtml}
        ${leafDivider()}
        ${product.description ? `<p>${escapeHtml(product.description)}</p>` : ""}
        ${tags.length ? `<p class="muted">${tags.map((t) => `<span class="badge">${escapeHtml(t)}</span>`).join(" ")}</p>` : ""}
        ${buyBox}
      </div>
    </div>`;
  return page({ title: product.title, user: opts.user, active: "catalog", cartCount: opts.cartCount, body });
}
