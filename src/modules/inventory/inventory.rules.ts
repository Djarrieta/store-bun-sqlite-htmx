/** Inventory permissions + validation (tech-spec §12). */
import { registerPermissions, type PermissionMatrix } from "../../core/permissions.ts";
import type { StockReason } from "./inventory.db.ts";

export const INVENTORY_KEY = "inventory";

export const inventoryPermissions: PermissionMatrix = {
  view: ["admin", "manager", "logistic"],
  adjust: ["admin", "manager", "logistic"],
};

registerPermissions(INVENTORY_KEY, inventoryPermissions);

const VALID_REASONS: StockReason[] = ["purchase", "adjust", "return", "sale"];

export interface AdjustInput {
  delta: number;
  reason: StockReason;
}

export interface AdjustErrors {
  delta?: string;
  reason?: string;
}

export function validateAdjust(form: FormData): { data: AdjustInput; errors: AdjustErrors } {
  const delta = Number.parseInt(String(form.get("delta") ?? ""), 10);
  const reason = String(form.get("reason") ?? "adjust") as StockReason;
  const errors: AdjustErrors = {};
  if (Number.isNaN(delta) || delta === 0) errors.delta = "Ingresa una cantidad distinta de cero (usa - para salidas).";
  if (!VALID_REASONS.includes(reason)) errors.reason = "Motivo inválido.";
  return { data: { delta: Number.isNaN(delta) ? 0 : delta, reason }, errors };
}

export const REASON_LABELS: Record<StockReason, string> = {
  purchase: "Entrada / compra",
  sale: "Venta",
  adjust: "Ajuste",
  return: "Devolución",
};
