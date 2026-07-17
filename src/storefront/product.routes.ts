/** Public product detail: /productos/:id. */
import type { Router } from "../core/router.ts";
import { html, notFound } from "../core/http.ts";
import { productsRepo } from "../modules/products/products.db.ts";
import { variantsRepo } from "../modules/variants/variants.db.ts";
import { categoriesRepo } from "../modules/categories/categories.db.ts";
import { productDetailPage } from "./storefront.views.ts";
import { cartCount } from "./cart.service.ts";

export function registerProductRoutes(router: Router): void {
  router.get("/productos/:id", (ctx) => {
    const product = productsRepo.findById(ctx.params.id!);
    if (!product || product.active !== 1) return notFound("Producto no encontrado.");
    const variants = variantsRepo.listActiveByProduct(product.id);
    const category = product.category_id ? categoriesRepo.findById(product.category_id) : null;
    return html(
      productDetailPage({
        user: ctx.user,
        cartCount: cartCount(ctx.guestRef),
        product,
        variants,
        category,
      }),
    );
  });
}
