/** Storefront order page + Nequi proof upload/serving (tech-spec §8.2, §11, §16). */
import type { Router } from "../core/router.ts";
import { html, fragment, notFound, forbidden, badRequest } from "../core/http.ts";
import { isStaff } from "../core/permissions.ts";
import { saveImage } from "../core/uploads.ts";
import { cartCount } from "./cart.service.ts";
import { ownsOrder } from "./checkout.service.ts";
import { ordersRepo } from "../modules/orders/orders.db.ts";
import { orderPage, nequiSection } from "./order.views.ts";

const PROOFS_DIR = "data/uploads/proofs";
const SAFE_NAME = /^[0-9a-f-]+\.(jpg|png|webp)$/i;

export function registerOrderRoutes(router: Router): void {
  router.get("/orden/:id", (ctx) => {
    const order = ordersRepo.findById(ctx.params.id!);
    if (!order) return notFound("Pedido no encontrado.");
    if (!ownsOrder(order, ctx.guestRef, ctx.user?.id ?? null) && !isStaff(ctx.user))
      return forbidden("No puedes ver este pedido.");
    return html(
      orderPage({
        user: ctx.user,
        order,
        items: ordersRepo.items(order.id),
        cartCount: cartCount(ctx.guestRef),
        paymentSection: nequiSection(order),
      }),
    );
  });

  // Upload the Nequi payment proof (image) -> private storage -> payment_review.
  router.post("/orden/:id/comprobante", async (ctx) => {
    const order = ordersRepo.findById(ctx.params.id!);
    if (!order) return notFound("Pedido no encontrado.");
    if (!ownsOrder(order, ctx.guestRef, ctx.user?.id ?? null) && !isStaff(ctx.user))
      return forbidden("No puedes modificar este pedido.");
    if (order.status !== "pending" && order.status !== "payment_review")
      return badRequest("Este pedido ya no admite comprobantes.");

    const form = await ctx.req.formData();
    const file = form.get("proof");
    if (!(file instanceof File)) return badRequest("No se recibió el comprobante.");

    const result = await saveImage(file, PROOFS_DIR);
    if (!result.ok) {
      return fragment(nequiSection(order, { error: result.error }));
    }
    ordersRepo.attachProof(order.id, result.filename!);
    return fragment(nequiSection(ordersRepo.findById(order.id)!));
  });

  // Serve the private proof (owner or staff only). Never cached at the edge.
  router.get("/orden/:id/comprobante", async (ctx) => {
    const order = ordersRepo.findById(ctx.params.id!);
    if (!order) return notFound("Pedido no encontrado.");
    if (!ownsOrder(order, ctx.guestRef, ctx.user?.id ?? null) && !isStaff(ctx.user))
      return forbidden("No autorizado.");
    const name = order.payment_proof_url ?? "";
    if (!SAFE_NAME.test(name)) return notFound("Sin comprobante.");
    const file = Bun.file(`${PROOFS_DIR}/${name}`);
    if (!(await file.exists())) return notFound("Comprobante no encontrado.");
    return new Response(file, {
      headers: {
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  });
}
