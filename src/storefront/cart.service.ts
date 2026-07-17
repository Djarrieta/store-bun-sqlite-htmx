/** Cart business logic: add/update with server-side stock validation. */
import { cartRepo, type CartLine } from "./cart.db.ts";
import { variantsRepo } from "../modules/variants/variants.db.ts";

export function cartCount(guestRef: string): number {
  return cartRepo.totalQty(guestRef);
}

export interface CartSummary {
  lines: CartLine[];
  subtotalCents: number;
  count: number;
}

export function getCart(guestRef: string): CartSummary {
  const lines = cartRepo.lines(guestRef);
  const subtotalCents = lines.reduce((sum, l) => sum + l.line_total_cents, 0);
  const count = lines.reduce((sum, l) => sum + l.qty, 0);
  return { lines, subtotalCents, count };
}

export interface AddResult {
  ok: boolean;
  error?: string;
}

/** Add `qty` of a variant, clamped to available stock. */
export function addToCart(guestRef: string, variantId: string, qty: number): AddResult {
  const variant = variantsRepo.findById(variantId);
  if (!variant || variant.active !== 1) return { ok: false, error: "Variante no disponible." };
  if (variant.stock <= 0) return { ok: false, error: "Producto agotado." };

  const existing = cartRepo.findItem(guestRef, variantId);
  const desired = (existing?.qty ?? 0) + Math.max(1, qty);
  const clamped = Math.min(desired, variant.stock);
  cartRepo.upsert(guestRef, variantId, clamped);
  return { ok: true };
}

/** Set an absolute quantity (0 removes). Clamped to stock. */
export function setQty(guestRef: string, variantId: string, qty: number): AddResult {
  const variant = variantsRepo.findById(variantId);
  if (!variant) return { ok: false, error: "Variante no disponible." };
  if (qty <= 0) {
    cartRepo.removeItem(guestRef, variantId);
    return { ok: true };
  }
  cartRepo.upsert(guestRef, variantId, Math.min(qty, variant.stock));
  return { ok: true };
}

export function removeFromCart(guestRef: string, variantId: string): void {
  cartRepo.removeItem(guestRef, variantId);
}

export function clearCart(guestRef: string): void {
  cartRepo.clear(guestRef);
}
