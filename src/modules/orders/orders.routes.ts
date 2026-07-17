/** Orders admin routes: list, detail, verify/reject payment, status/tracking. */
import type { Router } from "../../core/router.ts";
import { html, fragment, redirect, notFound } from "../../core/http.ts";
import { requirePermission } from "../../auth/index.ts";
import { usersRepo } from "../../auth/auth.db.ts";
import { ordersRepo } from "./orders.db.ts";
import { ORDERS_KEY, isManualStatus } from "./orders.rules.ts";
import { approvePayment, rejectPayment } from "./orders.service.ts";
import { ordersListPage, ordersListFragment, orderDetailPage } from "./orders.views.ts";

const BASE = "/admin/ordenes";

export function registerOrdersRoutes(router: Router): void {
  router.get(BASE, (ctx) => {
    const user = requirePermission(ctx, ORDERS_KEY, "view");
    if (user instanceof Response) return user;
    const q = ctx.query.get("q") ?? "";
    const status = ctx.query.get("status") ?? "";
    const pageNum = Number.parseInt(ctx.query.get("page") ?? "1", 10) || 1;
    const data = ordersRepo.listOrders({ page: pageNum, status: status || undefined, search: q || undefined });
    if (ctx.isHtmx) return fragment(ordersListFragment(data, q, status));
    return html(ordersListPage(user, data, q, status));
  });

  router.get(`${BASE}/:id`, (ctx) => {
    const user = requirePermission(ctx, ORDERS_KEY, "view");
    if (user instanceof Response) return user;
    const order = ordersRepo.findById(ctx.params.id!);
    if (!order) return notFound("Pedido no encontrado.");
    const verifiedBy = order.payment_verified_by ? usersRepo.findById(order.payment_verified_by) : null;
    return html(orderDetailPage({ user, order, items: ordersRepo.items(order.id), verifiedBy }));
  });

  router.post(`${BASE}/:id/aprobar`, (ctx) => {
    const user = requirePermission(ctx, ORDERS_KEY, "verify_payment");
    if (user instanceof Response) return user;
    const order = ordersRepo.findById(ctx.params.id!);
    if (!order) return notFound("Pedido no encontrado.");
    const result = approvePayment(order, user.id);
    if (!result.ok) {
      return html(
        orderDetailPage({ user, order, items: ordersRepo.items(order.id), verifiedBy: null, error: result.error }),
        { status: 400 },
      );
    }
    return redirect(`${BASE}/${order.id}`);
  });

  router.post(`${BASE}/:id/rechazar`, (ctx) => {
    const user = requirePermission(ctx, ORDERS_KEY, "verify_payment");
    if (user instanceof Response) return user;
    const order = ordersRepo.findById(ctx.params.id!);
    if (!order) return notFound("Pedido no encontrado.");
    rejectPayment(order);
    return redirect(`${BASE}/${order.id}`);
  });

  router.post(`${BASE}/:id/estado`, async (ctx) => {
    const user = requirePermission(ctx, ORDERS_KEY, "update_status");
    if (user instanceof Response) return user;
    const order = ordersRepo.findById(ctx.params.id!);
    if (!order) return notFound("Pedido no encontrado.");
    const form = await ctx.req.formData();
    const status = String(form.get("status") ?? "");
    const tracking = String(form.get("tracking_code") ?? "").trim();
    if (isManualStatus(status)) ordersRepo.setStatus(order.id, status);
    ordersRepo.setTracking(order.id, tracking);
    return redirect(`${BASE}/${order.id}`);
  });
}
