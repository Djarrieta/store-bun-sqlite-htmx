/** Storefront home + static content pages. Product grid added in F1. */
import type { Router } from "../core/router.ts";
import { html } from "../core/http.ts";
import { page } from "../components/layout.ts";
import type { User } from "../auth/auth.db.ts";
import { registerCss } from "../components/registry.ts";
import { productsRepo } from "../modules/products/products.db.ts";
import { variantsRepo, type Variant } from "../modules/variants/variants.db.ts";
import { productCard } from "../components/storefront/product-card.ts";
import { leafDivider, leafBranch, leafMark } from "../components/ornament.ts";
import { cartCount } from "./cart.service.ts";
import { escapeHtml, escapeAttr } from "../core/http.ts";
import { contentRepo } from "../modules/content/content.db.ts";

registerCss(/* css */ `
.hero {
  position: relative; overflow: hidden;
  display: grid; grid-template-columns: 1.12fr 0.88fr;
  border: 1px solid var(--border); border-radius: var(--radius-card);
  background: var(--surface); box-shadow: var(--shadow-soft);
  margin-bottom: 3.5rem;
}
.hero__body {
  padding: clamp(2rem, 5vw, 4rem);
  display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
}
.hero__eyebrow { color: var(--accent); letter-spacing: 0.28em; text-transform: uppercase; font-size: 0.72rem; font-weight: 600; }
.hero h1 { font-size: clamp(2.5rem, 5.4vw, 3.8rem); margin: 0.7rem 0 0; color: var(--fg); text-wrap: balance; }
.hero .ornament { justify-content: flex-start; margin: 1.1rem 0 0; }
.hero__lead { color: var(--muted); max-width: 42ch; margin: 1.2rem 0 1.8rem; font-size: 1.02rem; }
.hero__cta { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; }
.hero__link { text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.78rem; font-weight: 600; }
.hero__aside {
  position: relative; overflow: hidden; min-height: 360px;
  background: linear-gradient(155deg, var(--card), #e7dccd);
  display: grid; place-items: center; border-left: 1px solid var(--border);
}
.hero__aside .leaf-branch { position: relative; z-index: 1; height: min(82%, 300px); width: auto; opacity: 0.92; }
.hero__image { width: 100%; height: 100%; object-fit: cover; display: block; }

.values { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin: 0 0 3.75rem; }
.values__item { text-align: center; padding: 0 1rem; }
.values__item h3 { font-size: 1.15rem; margin: 0.55rem 0 0.35rem; }
.values__item p { color: var(--muted); font-size: 0.9rem; margin: 0; }

.section-head--center { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.35rem; margin: 0 0 2rem; }
.section-head--center .eyebrow { color: var(--accent); }
.section-head--center h2 { margin: 0.15rem 0; }
.section-more { display: flex; justify-content: center; margin-top: 2.75rem; }

@media (max-width: 760px) {
  .hero { grid-template-columns: minmax(0, 1fr); }
  .hero__aside { grid-row: 1; min-height: auto; height: 260px; border-left: none; border-top: none; border-bottom: 1px solid var(--border); }
  .hero__aside .leaf-branch { height: min(75%, 150px); }
  .hero__image { object-position: top; }
  .hero__body { grid-row: 2; min-width: 0; padding: clamp(1.75rem, 6vw, 2.5rem); }
  .hero h1 { font-size: clamp(1.9rem, 8.5vw, 2.8rem); overflow-wrap: break-word; }
  .values { grid-template-columns: 1fr; gap: 1.75rem; }
}
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
    ? `<div class="catalog-grid">${featured.map((p) => productCard(p, variantsByProduct.get(p.id) ?? [])).join("")}</div>
       <div class="section-more"><a class="btn btn--outline" href="/productos">Ver toda la colección</a></div>`
    : `<div class="panel"><p class="muted" style="margin:0">Pronto verás aquí nuestra colección.</p></div>`;

  const values = [
    { title: "Algodones nobles", text: "Fibras naturales, escogidas para respirar contigo." },
    { title: "Vestir con calma", text: "Siluetas atemporales, pensadas sin prisa." },
    { title: "Hecho para ti", text: "Prendas que realzan tu esencia, no la disfrazan." },
  ]
    .map(
      (v) => `<div class="values__item">
        ${leafMark()}
        <h3>${v.title}</h3>
        <p>${v.text}</p>
      </div>`,
    )
    .join("");

  const heroImage = contentRepo.getValue("hero_image", "").trim();
  const heroAside = heroImage
    ? `<img src="${escapeAttr(heroImage)}" alt="CRISTA" class="hero__image">`
    : leafBranch();

  const body = `
    <section class="hero">
      <div class="hero__body">
        <span class="hero__eyebrow">Colección CRISTA</span>
        <h1>Naturalmente tú</h1>
        ${leafDivider()}
        <p class="hero__lead">Prendas de origen natural, pensadas para realzar tu esencia:
        algodones nobles, siluetas atemporales y detalles botánicos para acompañarte cada día.</p>
        <div class="hero__cta">
          <a class="btn" href="/productos">Ver colección</a>
          <a class="hero__link" href="/nosotros">Nuestra historia →</a>
        </div>
      </div>
      <div class="hero__aside">
        ${heroAside}
      </div>
    </section>

    <section class="values">${values}</section>

    <div class="section-head--center">
      <span class="eyebrow">La colección</span>
      <h2>Piezas para florecer</h2>
      ${leafDivider()}
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
