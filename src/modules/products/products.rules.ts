/** Products + variants permissions and form validation (tech-spec §6, §12). */
import { registerPermissions, type PermissionMatrix } from "../../core/permissions.ts";
import type { ProductInput } from "./products.db.ts";
import type { VariantInput } from "../variants/variants.db.ts";

export const PRODUCTS_KEY = "products";
export const VARIANTS_KEY = "variants";

const catalogView: PermissionMatrix["view"] = ["admin", "manager", "sales", "logistic"];

export const productsPermissions: PermissionMatrix = {
  view: catalogView,
  create: ["admin", "manager"],
  edit: ["admin", "manager"],
  delete: ["admin", "manager"],
};

export const variantsPermissions: PermissionMatrix = {
  view: catalogView,
  create: ["admin", "manager"],
  edit: ["admin", "manager"],
  delete: ["admin", "manager"],
};

registerPermissions(PRODUCTS_KEY, productsPermissions);
registerPermissions(VARIANTS_KEY, variantsPermissions);

function parsePesosToCents(raw: string): number {
  const cleaned = raw.replace(/[^0-9.,]/g, "").replace(/\./g, "").replace(",", ".");
  const pesos = Number.parseFloat(cleaned);
  if (Number.isNaN(pesos) || pesos < 0) return NaN;
  return Math.round(pesos * 100);
}

function parseTagsInput(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export interface ProductErrors {
  title?: string;
  price?: string;
  discount?: string;
}

export function validateProduct(
  form: FormData,
  validCategoryIds: Set<string>,
): { data: ProductInput; priceRaw: string; errors: ProductErrors } {
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const priceRaw = String(form.get("price") ?? "").trim();
  const price_cents = parsePesosToCents(priceRaw);
  const discount_pct = Number.parseInt(String(form.get("discount_pct") ?? "0"), 10) || 0;
  let category_id: string | null = String(form.get("category_id") ?? "").trim() || null;
  if (category_id && !validCategoryIds.has(category_id)) category_id = null;
  const tags = parseTagsInput(String(form.get("tags") ?? ""));
  const active = form.get("active") === "1";

  const errors: ProductErrors = {};
  if (!title) errors.title = "El título es obligatorio.";
  if (Number.isNaN(price_cents)) errors.price = "Precio inválido.";
  if (discount_pct < 0 || discount_pct > 100) errors.discount = "El descuento debe estar entre 0 y 100.";

  return {
    data: {
      title,
      description,
      price_cents: priceRaw === "" || Number.isNaN(price_cents) ? null : price_cents,
      discount_pct: Math.max(0, Math.min(100, discount_pct)),
      category_id,
      tags,
      active,
    },
    priceRaw,
    errors,
  };
}

export interface VariantErrors {
  name?: string;
  stock?: string;
}

export function validateVariant(form: FormData): { data: VariantInput; errors: VariantErrors } {
  const name = String(form.get("name") ?? "").trim();
  const sku = String(form.get("sku") ?? "").trim() || null;
  const priceRaw = String(form.get("price") ?? "").trim();
  const price_cents = priceRaw ? parsePesosToCents(priceRaw) : null;
  const stock = Number.parseInt(String(form.get("stock") ?? "0"), 10);
  const low = Number.parseInt(String(form.get("low_stock_threshold") ?? "0"), 10) || 0;
  const active = form.get("active") === "1";

  const errors: VariantErrors = {};
  if (!name) errors.name = "El nombre de la variante es obligatorio.";
  if (Number.isNaN(stock) || stock < 0) errors.stock = "Stock inválido.";

  return {
    data: {
      name,
      sku,
      price_cents: price_cents !== null && Number.isNaN(price_cents) ? null : price_cents,
      stock: Number.isNaN(stock) ? 0 : Math.max(0, stock),
      low_stock_threshold: Math.max(0, low),
      active,
    },
    errors,
  };
}
