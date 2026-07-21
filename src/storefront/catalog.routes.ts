/** Public catalog: /productos and /categorias/:id (search + filter + paginate). */
import type { Router, RouteContext } from "../core/router.ts";
import { html, fragment, notFound } from "../core/http.ts";
import { productsRepo } from "../modules/products/products.db.ts";
import { variantsRepo, type Variant } from "../modules/variants/variants.db.ts";
import { categoriesRepo, type Category } from "../modules/categories/categories.db.ts";
import { catalogPage, catalogGrid } from "./storefront.views.ts";
import { cartCount } from "./cart.service.ts";

function groupVariants(productIds: string[]): Map<string, Variant[]> {
  const map = new Map<string, Variant[]>();
  for (const v of variantsRepo.listActiveByProductIds(productIds)) {
    const list = map.get(v.product_id) ?? [];
    list.push(v);
    map.set(v.product_id, list);
  }
  return map;
}

function renderCatalog(ctx: RouteContext, category: Category | null): Response {
  const q = ctx.query.get("q") ?? "";
  const pageNum = Number.parseInt(ctx.query.get("page") ?? "1", 10) || 1;
  const pageData = productsRepo.listPublic({ page: pageNum, search: q, categoryId: category?.id });
  const variantsByProduct = groupVariants(pageData.items.map((p) => p.id));
  const data = {
    pageData,
    variantsByProduct,
    q,
    categories: categoriesRepo.listAll(),
    activeCategory: category ?? undefined,
  };
  if (ctx.isHtmx) return fragment(catalogGrid(data));
  return html(catalogPage({ user: ctx.user, cartCount: cartCount(ctx.guestRef), data }));
}

export function registerCatalogRoutes(router: Router): void {
  router.get("/productos", (ctx) => renderCatalog(ctx, null));

  router.get("/categorias/:id", (ctx) => {
    const category = categoriesRepo.findById(ctx.params.id!);
    if (!category) return notFound("Categoría no encontrada.");
    return renderCatalog(ctx, category);
  });
}
