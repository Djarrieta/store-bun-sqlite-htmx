/** Orders admin permissions + helpers (tech-spec §11, §12). */
import { registerPermissions, type PermissionMatrix } from "../../core/permissions.ts";
import type { OrderStatus } from "./orders.db.ts";

export const ORDERS_KEY = "orders";

export const ordersPermissions: PermissionMatrix = {
  view: ["admin", "manager", "logistic", "sales"],
  verify_payment: ["admin", "manager"],
  update_status: ["admin", "manager", "logistic", "sales"],
};

registerPermissions(ORDERS_KEY, ordersPermissions);

/** Statuses an admin may set manually (post-payment lifecycle). */
export const MANUAL_STATUSES: OrderStatus[] = ["preparing", "shipped", "delivered", "cancelled", "refunded"];

export const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "pending", label: "Pendiente de pago" },
  { value: "payment_review", label: "Verificando pago" },
  { value: "paid", label: "Pagado" },
  { value: "preparing", label: "En preparación" },
  { value: "shipped", label: "Enviado" },
  { value: "delivered", label: "Entregado" },
  { value: "cancelled", label: "Cancelado" },
  { value: "refunded", label: "Reembolsado" },
];

export function isManualStatus(value: string): value is OrderStatus {
  return (MANUAL_STATUSES as string[]).includes(value);
}

const STATUS_LABEL_MAP = Object.fromEntries(STATUS_FILTERS.map((f) => [f.value, f.label]));

export function statusLabel(status: string): string {
  return STATUS_LABEL_MAP[status] ?? status;
}
