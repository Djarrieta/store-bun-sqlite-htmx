/**
 * Payment approval: decrement stock (idempotent) and mark the order paid in a
 * single transaction (tech-spec §11, O-1). Stock leaves inventory only here.
 */
import { transaction } from "../../db.ts";
import { inventoryRepo } from "../inventory/inventory.db.ts";
import { ordersRepo, type Order } from "./orders.db.ts";

export type ApprovalResult = { ok: true } | { ok: false; error: string };

export function approvePayment(order: Order, adminId: string): ApprovalResult {
  if (order.status !== "payment_review") {
    return { ok: false, error: "La orden no está en verificación de pago." };
  }
  if (!order.payment_proof_url) {
    return { ok: false, error: "La orden no tiene comprobante adjunto." };
  }

  transaction(() => {
    // Mark paid first (guarded transition). Only decrement if this call performed it
    // and stock wasn't already decremented for this order (double idempotency).
    const transitioned = ordersRepo.markPaid(order.id, adminId);
    if (transitioned && !inventoryRepo.saleRecordedForOrder(order.id)) {
      for (const item of ordersRepo.items(order.id)) {
        if (!item.variant_id) continue;
        inventoryRepo.applyMovementRaw({
          variantId: item.variant_id,
          delta: -item.qty,
          reason: "sale",
          orderId: order.id,
          createdBy: adminId,
        });
      }
    }
  });

  return { ok: true };
}

/** Reject a submitted proof: send back to `pending` so the client can retry. */
export function rejectPayment(order: Order): ApprovalResult {
  if (order.status !== "payment_review") {
    return { ok: false, error: "La orden no está en verificación de pago." };
  }
  ordersRepo.setStatus(order.id, "pending");
  return { ok: true };
}
