/** Storefront home + static content pages. Product grid added in F1. */
import type { Router } from "../core/router.ts";
import { html } from "../core/http.ts";
import { page } from "../components/layout.ts";
import type { User } from "../auth/auth.db.ts";
import { registerCss } from "../components/registry.ts";
import { productsRepo } from "../modules/products/products.db.ts";
import { variantsRepo, type Variant } from "../modules/variants/variants.db.ts";
import { productCard } from "../components/storefront/product-card.ts";
import { cartCount } from "./cart.service.ts";
import { escapeHtml } from "../core/http.ts";
import { contentRepo } from "../modules/content/content.db.ts";

registerCss(/* css */ `
.hero {
  position: relative; border-radius: var(--radius-card); overflow: hidden;
  background: linear-gradient(120deg, #2c2320, #4a3b34);
  color: #fff; padding: clamp(2rem, 6vw, 4.5rem); margin-bottom: 2.5rem;
  min-height: 340px; display: flex; flex-direction: column; justify-content: center;
}
.hero__eyebrow { color: rgba(255,255,255,0.7); letter-spacing: 0.2em; text-transform: uppercase; font-size: 0.75rem; font-weight: 600; }
.hero h1 { color: #fff; font-size: clamp(2.5rem, 6vw, 4rem); margin: 0.5rem 0; }
.hero p { color: rgba(255,255,255,0.85); max-width: 46ch; }
.hero .btn { margin-top: 1rem; align-self: flex-start; }
.section-head { margin: 2rem 0 1rem; }
`);

function homePage(user: User | null, cartCountValue: number): string {
  const featured = productsRepo.listPublic({ page: 1 }).items.slice(0, 6);
  const variantsByProduct = new Map<string, Variant[]>();
  for (const v of variantsRepo.listActiveByProductIds(featured.map((p) => p.id))) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  }
  const grid = featured.length
    ? `<div class="catalog-grid">${featured.map((p) => productCard(p, variantsByProduct.get(p.id) ?? [])).join("")}</div>`
    : `<div class="panel"><p class="muted" style="margin:0">Pronto verás aquí nuestra colección.</p></div>`;

  const body = `
    <section class="hero">
      <span class="hero__eyebrow">Colección CRISTA</span>
      <h1>Naturalmente tú</h1>
      <p>Prendas de origen natural, pensadas para realzar tu esencia. Algodones nobles,
      siluetas atemporales y detalles botánicos hechos para acompañarte cada día.</p>
      <a class="btn" href="/productos">Ver colección</a>
    </section>
    <div class="row-between section-head">
      <h2 style="margin:0">Productos</h2>
      <a class="muted" href="/productos">Ver todo →</a>
    </div>
    ${grid}`;
  return page({ title: "Inicio", user, active: "home", cartCount: cartCountValue, body });
}

function contentPage(user: User | null, title: string, bodyHtml: string, cartCountValue: number, active?: string): string {
  return page({
    title,
    user,
    active,
    cartCount: cartCountValue,
    body: `<h1>${title}</h1><div class="panel">${bodyHtml}</div>`,
  });
}

/** Render stored content text (escaped) with paragraph breaks. */
function renderContent(key: string): string {
  const raw = contentRepo.getValue(key, "");
  return raw
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function registerHomeRoutes(router: Router): void {
  router.get("/", (ctx) => html(homePage(ctx.user, cartCount(ctx.guestRef))));

  router.get("/nosotros", (ctx) =>
    html(contentPage(ctx.user, "Nosotros", renderContent("nosotros"), cartCount(ctx.guestRef), "about")),
  );

  router.get("/pagos-envios", (ctx) =>
    html(contentPage(ctx.user, "Pagos y envíos", renderContent("pagos_envios"), cartCount(ctx.guestRef))),
  );
}
