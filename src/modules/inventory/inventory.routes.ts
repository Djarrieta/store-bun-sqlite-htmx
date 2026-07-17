/** Inventory admin routes: stock list, variant detail, adjustment. */
import type { Router } from "../../core/router.ts";
import { html, fragment, redirect, notFound } from "../../core/http.ts";
import { requirePermission } from "../../auth/index.ts";
import { inventoryRepo, type StockRow } from "./inventory.db.ts";
import { INVENTORY_KEY, validateAdjust } from "./inventory.rules.ts";
import { inventoryListPage, inventoryListFragment, inventoryDetailPage } from "./inventory.views.ts";

const BASE = "/admin/inventario";

/** Load a single stock row (variant joined with its product). */
function loadOne(variantId: string): StockRow | null {
  const rows = inventoryRepo.all<StockRow>(
    `SELECT v.id AS variant_id, p.id AS product_id, p.title AS product_title, v.name AS variant_name,
            v.sku AS sku, v.stock AS stock, v.low_stock_threshold AS low_stock_threshold, v.active AS active
     FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = $v`,
    { $v: variantId },
  );
  return rows[0] ?? null;
}

export function registerInventoryRoutes(router: Router): void {
  router.get(BASE, (ctx) => {
    const user = requirePermission(ctx, INVENTORY_KEY, "view");
    if (user instanceof Response) return user;
    const q = ctx.query.get("q") ?? "";
    const lowOnly = ctx.query.get("low") === "1";
    const pageNum = Number.parseInt(ctx.query.get("page") ?? "1", 10) || 1;
    const data = inventoryRepo.listStock({ page: pageNum, search: q || undefined, lowOnly });
    if (ctx.isHtmx) return fragment(inventoryListFragment(user, data, q, lowOnly));
    return html(inventoryListPage(user, data, q, lowOnly, inventoryRepo.lowStockCount()));
  });

  router.get(`${BASE}/:variantId`, (ctx) => {
    const user = requirePermission(ctx, INVENTORY_KEY, "view");
    if (user instanceof Response) return user;
    const row = loadOne(ctx.params.variantId!);
    if (!row) return notFound("Variante no encontrada.");
    return html(inventoryDetailPage(user, row, inventoryRepo.listMovements(row.variant_id)));
  });

  router.post(`${BASE}/:variantId/ajustar`, async (ctx) => {
    const user = requirePermission(ctx, INVENTORY_KEY, "adjust");
    if (user instanceof Response) return user;
    const row = loadOne(ctx.params.variantId!);
    if (!row) return notFound("Variante no encontrada.");
    const form = await ctx.req.formData();
    const { data, errors } = validateAdjust(form);
    if (!errors.delta && row.stock + data.delta < 0) errors.delta = `No puedes bajar de 0 (saldo actual ${row.stock}).`;
    if (errors.delta || errors.reason) {
      return html(inventoryDetailPage(user, row, inventoryRepo.listMovements(row.variant_id), errors), { status: 400 });
    }
    inventoryRepo.applyMovement({
      variantId: row.variant_id,
      delta: data.delta,
      reason: data.reason,
      createdBy: user.id,
    });
    return redirect(`${BASE}/${row.variant_id}`);
  });
}
