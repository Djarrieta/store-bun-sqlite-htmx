/** Checkout orchestration: server-side revalidation + order creation (§10, §11). */
import { getCart, clearCart } from "./cart.service.ts";
import { variantsRepo } from "../modules/variants/variants.db.ts";
import { ordersRepo, type Order, type NewOrderItem } from "../modules/orders/orders.db.ts";
import { quoteShipping, type ShippingQuote } from "../modules/shipping/shipping.service.ts";

export interface CheckoutInput {
  guestRef: string;
  userId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  department: string;
  city: string;
  address: string;
  notes: string | null;
}

export type CheckoutResult =
  | { ok: true; order: Order }
  | { ok: false; error: string };

export function createOrderFromCart(input: CheckoutInput): CheckoutResult {
  const cart = getCart(input.guestRef);
  if (cart.lines.length === 0) return { ok: false, error: "Tu carrito está vacío." };

  // Re-validate stock server-side against current balances.
  for (const line of cart.lines) {
    const variant = variantsRepo.findById(line.variant_id);
    if (!variant || variant.active !== 1) {
      return { ok: false, error: `"${line.product_title}" ya no está disponible. Ajusta tu carrito.` };
    }
    if (variant.stock < line.qty) {
      return {
        ok: false,
        error: `Stock insuficiente para "${line.product_title} — ${line.variant_name}" (disponible: ${variant.stock}).`,
      };
    }
  }

  const subtotalCents = cart.subtotalCents;
  const quote: ShippingQuote = quoteShipping(input.department, input.city, subtotalCents);
  if (!quote.covered) {
    return { ok: false, error: "Aún no tenemos tarifa de envío para esa ciudad. Escríbenos por el chat." };
  }
  const totalCents = subtotalCents + quote.cents;

  const items: NewOrderItem[] = cart.lines.map((l) => ({
    variant_id: l.variant_id,
    product_title: l.product_title,
    variant_name: l.variant_name,
    sku: l.sku,
    qty: l.qty,
    unit_price_cents: l.unit_price_cents,
  }));

  const order = ordersRepo.createOrder(
    {
      user_id: input.userId,
      guest_ref: input.guestRef,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      customer_email: input.customerEmail,
      subtotal_cents: subtotalCents,
      shipping_cents: quote.cents,
      total_cents: totalCents,
      shipping_dept: input.department,
      shipping_city: input.city,
      shipping_addr: input.address,
      notes: input.notes,
    },
    items,
  );

  clearCart(input.guestRef);
  return { ok: true, order };
}

/** True if the requester owns the order (by guest_ref or user_id). */
export function ownsOrder(order: Order, guestRef: string, userId: string | null): boolean {
  if (userId && order.user_id === userId) return true;
  return Boolean(order.guest_ref && order.guest_ref === guestRef);
}
