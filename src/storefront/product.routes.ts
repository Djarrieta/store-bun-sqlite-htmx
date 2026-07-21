/** Public product detail: /productos/:id + card fragment. */
import type { Router } from "../core/router.ts";
import { html, fragment, notFound } from "../core/http.ts";
import { productsRepo, isSellableOnStorefront } from "../modules/products/products.db.ts";
import { variantsRepo } from "../modules/variants/variants.db.ts";
import { categoriesRepo } from "../modules/categories/categories.db.ts";
import { productDetailPage, productDetailFragment } from "./storefront.views.ts";
import { productCard } from "../components/storefront/product-card.ts";
import { cartCount } from "./cart.service.ts";

export function registerProductRoutes(router: Router): void {
  router.get("/productos/:id/card", (ctx) => {
    const product = productsRepo.findById(ctx.params.id!);
    if (!product || product.active !== 1) return notFound();
    const variants = variantsRepo.listActiveByProduct(product.id);
    if (!isSellableOnStorefront(product, variants)) return notFound();
    const imageIndex = Number.parseInt(ctx.query.get("imageIndex") ?? "0", 10) || 0;
    const selectedVariantId = ctx.query.get("variant_id") ?? undefined;
    const htmlCard = productCard(product, variants, { imageIndex, selectedVariantId });
    if (!htmlCard) return notFound();
    return fragment(htmlCard);
  });

  router.get("/productos/:id/fragment", (ctx) => {
    const product = productsRepo.findById(ctx.params.id!);
    if (!product || product.active !== 1) return notFound();
    const variants = variantsRepo.listActiveByProduct(product.id);
    if (!isSellableOnStorefront(product, variants)) return notFound();
    const category = product.category_id ? categoriesRepo.findById(product.category_id) : null;
    const rawImageIndex = ctx.query.get("imageIndex");
    const imageIndex = rawImageIndex != null ? Number.parseInt(rawImageIndex, 10) || 0 : undefined;
    const selectedVariantId = ctx.query.get("variant_id") ?? undefined;
    return fragment(
      productDetailFragment({
        product,
        variants,
        category,
        imageIndex,
        selectedVariantId,
      }),
    );
  });

  router.get("/productos/:id", (ctx) => {
    const product = productsRepo.findById(ctx.params.id!);
    if (!product || product.active !== 1) return notFound("Producto no encontrado.");
    const variants = variantsRepo.listActiveByProduct(product.id);
    if (!isSellableOnStorefront(product, variants)) return notFound("Producto no encontrado.");
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
