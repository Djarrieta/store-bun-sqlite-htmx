/** Storefront product card (catalog grid) with variant selector + add-to-cart. */
import { escapeHtml, escapeAttr } from "../../core/http.ts";
import { formatCop } from "../../core/format.ts";
import { registerCss } from "../registry.ts";
import { parseImages, resolveUnitPriceCents, resolveBasePriceCents, isSellableOnStorefront, type Product } from "../../modules/products/products.db.ts";
import { parseVariantImages, type Variant } from "../../modules/variants/variants.db.ts";

registerCss(/* css */ `
.pcard { display: flex; flex-direction: column; }
.pcard__carousel {
  position: relative; aspect-ratio: 4 / 5; background: var(--card);
  border-radius: var(--radius-card); overflow: hidden; margin: 0 0 0.9rem;
}
.pcard__carousel-frame { width: 100%; height: 100%; display: grid; place-items: center; }
.pcard__carousel-frame img { width: 100%; height: 100%; object-fit: cover; }
.pcard__carousel-btn {
  position: absolute; top: 50%; transform: translateY(-50%);
  width: 2rem; height: 2rem; border-radius: 50%;
  background: var(--surface); border: 1px solid var(--border);
  display: grid; place-items: center; cursor: pointer;
  font-size: 0.8rem; color: var(--fg); opacity: 0.85;
  transition: opacity 0.15s;
}
.pcard__carousel-btn:hover { opacity: 1; }
.pcard__carousel-btn--prev { left: 0.4rem; }
.pcard__carousel-btn--next { right: 0.4rem; }
.pcard__dots { display: flex; justify-content: center; gap: 0.3rem; position: absolute; bottom: 0.5rem; left: 0; right: 0; }
.pcard__dot {
  width: 0.4rem; height: 0.4rem; border-radius: 50%;
  background: var(--border-strong); border: none; padding: 0; cursor: pointer;
  transition: background 0.15s;
}
.pcard__dot--active { background: var(--accent); }
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

// ---- Card slides (carousel model) ----

export interface CardSlide {
  index: number;
  url: string;
  alt: string;
  /** null = product image (does not force variant selection on navigation) */
  variantId: string | null;
}

export function buildCardSlides(
  product: Product,
  variants: Variant[],
): CardSlide[] {
  if (!isSellableOnStorefront(product, variants)) return [];

  const sellable = variants.filter(
    (v) => v.active === 1 && v.stock > 0 && resolveBasePriceCents(product, v) !== null,
  );

  const slides: CardSlide[] = [];
  let idx = 0;

  // Product images first
  const productImages = parseImages(product);
  if (productImages.length > 0) {
    for (const img of productImages) {
      slides.push({ index: idx++, url: img.url, alt: img.alt ?? product.title, variantId: null });
    }
  } else {
    slides.push({ index: idx++, url: "/brand/no-image.jpeg", alt: product.title, variantId: null });
  }

  // Then variant images (sellable only, in repo order)
  for (const v of sellable) {
    const vImages = parseVariantImages(v);
    for (const img of vImages) {
      slides.push({ index: idx++, url: img.url, alt: img.alt ?? v.name, variantId: v.id });
    }
  }

  return slides;
}

export function firstSlideIndexForVariant(slides: CardSlide[], variantId: string): number | null {
  const slide = slides.find((s) => s.variantId === variantId);
  return slide ? slide.index : null;
}

export function cardFragmentUrl(
  productId: string,
  opts: { imageIndex?: number; variantId?: string } = {},
): string {
  const params = new URLSearchParams();
  if (opts.imageIndex != null && opts.imageIndex > 0) params.set("imageIndex", String(opts.imageIndex));
  if (opts.variantId) params.set("variantId", opts.variantId);
  const qs = params.toString();
  return `/productos/${productId}/card${qs ? `?${qs}` : ""}`;
}

export function productCarousel(opts: {
  productId: string;
  slides: CardSlide[];
  currentIndex: number;
  selectedVariantId?: string;
}): string {
  const { productId, slides, currentIndex } = opts;
  if (slides.length === 0) return "";
  const i = Math.max(0, Math.min(currentIndex, slides.length - 1));
  const slide = slides[i]!;
  const baseParams: Record<string, string> = {};
  if (opts.selectedVariantId) baseParams.variantId = opts.selectedVariantId;

  const prevIdx = i > 0 ? i - 1 : slides.length - 1;
  const nextIdx = i < slides.length - 1 ? i + 1 : 0;

  const flag = ""; // Flag rendered outside carousel by caller

  const arrows =
    slides.length > 1
      ? `<button type="button" class="pcard__carousel-btn pcard__carousel-btn--prev"
          hx-get="${escapeAttr(cardFragmentUrl(productId, { ...baseParams, imageIndex: prevIdx }))}"
          hx-target="closest .pcard" hx-swap="outerHTML"
          aria-label="Imagen anterior">‹</button>
        <button type="button" class="pcard__carousel-btn pcard__carousel-btn--next"
          hx-get="${escapeAttr(cardFragmentUrl(productId, { ...baseParams, imageIndex: nextIdx }))}"
          hx-target="closest .pcard" hx-swap="outerHTML"
          aria-label="Imagen siguiente">›</button>`
      : "";

  const dots =
    slides.length > 1
      ? `<div class="pcard__dots">${slides
          .map(
            (s) =>
              `<button type="button" class="pcard__dot${s.index === i ? " pcard__dot--active" : ""}"
                hx-get="${escapeAttr(cardFragmentUrl(productId, { ...baseParams, imageIndex: s.index }))}"
                hx-target="closest .pcard" hx-swap="outerHTML"
                aria-label="Imagen ${s.index + 1}"></button>`,
          )
          .join("")}</div>`
      : "";

  return `<figure class="pcard__carousel" data-index="${i}">
    <div class="pcard__carousel-frame">
      <img src="${escapeAttr(slide.url)}" alt="${escapeAttr(slide.alt)}" loading="lazy">
    </div>
    ${flag}${arrows}${dots}
  </figure>`;
}

function priceHtml(product: Product, selected: Variant | undefined): string {
  const unit = resolveUnitPriceCents(product, selected);
  if (unit === null) return `<span class="pcard__price muted">Sin precio</span>`;
  const base = resolveBasePriceCents(product, selected);
  if (product.discount_pct > 0 && base !== null) {
    return `<span class="pcard__price"><s>${escapeHtml(formatCop(base))}</s>${escapeHtml(formatCop(unit))}</span>`;
  }
  return `<span class="pcard__price">${escapeHtml(formatCop(unit))}</span>`;
}

export function productCard(
  product: Product,
  variants: Variant[],
  opts?: { imageIndex?: number; selectedVariantId?: string },
): string | null {
  const slides = buildCardSlides(product, variants);
  if (slides.length === 0) return null;

  const sellable = variants.filter(
    (v) => v.active === 1 && v.stock > 0 && resolveBasePriceCents(product, v) !== null,
  );

  let imageIndex = Math.max(0, Math.min(opts?.imageIndex ?? 0, slides.length - 1));
  let selectedVariantId = opts?.selectedVariantId;

  // Slide with variantId forces variant selection
  const slide = slides[imageIndex]!;
  if (slide.variantId) selectedVariantId = slide.variantId;

  // Always have a valid selected variant
  if (!selectedVariantId || !sellable.some((v) => v.id === selectedVariantId)) {
    selectedVariantId = sellable[0]?.id;
  }

  const selected = sellable.find((v) => v.id === selectedVariantId);

  const flag = product.discount_pct > 0 ? `<span class="pcard__flag">−${product.discount_pct}%</span>` : "";

  const carousel = productCarousel({
    productId: product.id,
    slides,
    currentIndex: imageIndex,
    selectedVariantId,
  });

  // Variant selector
  const selector =
    sellable.length > 1
      ? `<div class="field">
          <label>Variante</label>
          <select class="select" name="variantId"
            hx-get="${escapeAttr(cardFragmentUrl(product.id))}"
            hx-target="closest .pcard" hx-swap="outerHTML" hx-trigger="change"
            hx-include="this">
            ${sellable.map((v) => `<option value="${escapeAttr(v.id)}"${v.id === selectedVariantId ? " selected" : ""}>${escapeHtml(v.name)}</option>`).join("")}
          </select>
        </div>`
      : sellable.length === 1
        ? `<input type="hidden" name="variantId" value="${escapeAttr(sellable[0]!.id)}">`
        : "";

  // Add to cart form
  const addForm =
    sellable.length > 0
      ? `<form class="pcard__form" hx-post="/carrito/agregar" hx-target="#cart-badge" hx-swap="outerHTML">
          <input type="hidden" name="product_id" value="${escapeAttr(product.id)}">
          ${selector}
          <button type="submit" class="btn btn--outline btn--block">Agregar al carrito</button>
        </form>`
      : `<div class="pcard__form"><button class="btn btn--outline btn--block" disabled aria-disabled="true">Agotado</button></div>`;

  return `<article class="pcard">
    <div style="position:relative">
      ${carousel}
      ${flag}
    </div>
    <h3 class="pcard__title"><a href="/productos/${escapeAttr(product.id)}">${escapeHtml(product.title)}</a></h3>
    ${priceHtml(product, selected)}
    ${addForm}
  </article>`;
}
