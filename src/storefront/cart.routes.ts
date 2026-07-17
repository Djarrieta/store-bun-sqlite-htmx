/** Cart routes: page, add, update qty, remove (tech-spec §10). */
import type { Router } from "../core/router.ts";
import { html, fragment } from "../core/http.ts";
import { cartLink } from "../components/nav.ts";
import { addToCart, setQty, removeFromCart, getCart, cartCount } from "./cart.service.ts";
import { cartPage, cartBody, cartBadgeOob } from "./cart.views.ts";

export function registerCartRoutes(router: Router): void {
  router.get("/carrito", (ctx) => html(cartPage(ctx.user, getCart(ctx.guestRef))));

  router.post("/carrito/agregar", async (ctx) => {
    const form = await ctx.req.formData();
    const variantId = String(form.get("variant_id") ?? "");
    const qty = Number.parseInt(String(form.get("qty") ?? "1"), 10) || 1;
    if (variantId) addToCart(ctx.guestRef, variantId, qty);
    return fragment(cartLink(cartCount(ctx.guestRef)));
  });

  router.post("/carrito/actualizar", async (ctx) => {
    const form = await ctx.req.formData();
    const variantId = String(form.get("variant_id") ?? "");
    const qty = Number.parseInt(String(form.get("qty") ?? "0"), 10);
    if (variantId) setQty(ctx.guestRef, variantId, Number.isNaN(qty) ? 0 : qty);
    const summary = getCart(ctx.guestRef);
    return fragment(cartBody(summary) + cartBadgeOob(summary.count));
  });

  router.post("/carrito/eliminar", async (ctx) => {
    const form = await ctx.req.formData();
    const variantId = String(form.get("variant_id") ?? "");
    if (variantId) removeFromCart(ctx.guestRef, variantId);
    const summary = getCart(ctx.guestRef);
    return fragment(cartBody(summary) + cartBadgeOob(summary.count));
  });
}
