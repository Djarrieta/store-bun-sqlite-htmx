/** Shipping admin permissions + validation (tech-spec §12). */
import { registerPermissions, type PermissionMatrix } from "../../core/permissions.ts";

export const SHIPPING_KEY = "shipping";

export const shippingPermissions: PermissionMatrix = {
  view: ["admin", "manager"],
  edit: ["admin", "manager"],
};

registerPermissions(SHIPPING_KEY, shippingPermissions);

/** Pesos string -> integer cents (or NaN). */
export function pesosToCents(raw: string): number {
  const cleaned = raw.replace(/[^0-9.,]/g, "").replace(/\./g, "").replace(",", ".");
  const pesos = Number.parseFloat(cleaned);
  if (Number.isNaN(pesos) || pesos < 0) return NaN;
  return Math.round(pesos * 100);
}

export interface RateInput {
  department: string;
  city: string;
  priceCents: number;
  estimatedDays: number | null;
}

export interface RateErrors {
  department?: string;
  city?: string;
  price?: string;
}

export function validateRate(form: FormData): { data: RateInput; errors: RateErrors } {
  const department = String(form.get("department") ?? "").trim();
  const city = String(form.get("city") ?? "").trim();
  const priceCents = pesosToCents(String(form.get("price") ?? ""));
  const daysRaw = String(form.get("estimated_days") ?? "").trim();
  const estimatedDays = daysRaw ? Number.parseInt(daysRaw, 10) : null;

  const errors: RateErrors = {};
  if (!department) errors.department = "Departamento obligatorio.";
  if (!city) errors.city = "Ciudad obligatoria.";
  if (Number.isNaN(priceCents)) errors.price = "Precio inválido.";

  return {
    data: {
      department,
      city,
      priceCents: Number.isNaN(priceCents) ? 0 : priceCents,
      estimatedDays: estimatedDays !== null && Number.isNaN(estimatedDays) ? null : estimatedDays,
    },
    errors,
  };
}
