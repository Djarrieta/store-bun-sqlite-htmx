/** Shipping cost calculation (server-side; never trust client amounts). */
import { shippingRepo } from "./shipping.db.ts";

export interface ShippingQuote {
  covered: boolean;
  cents: number;
  free: boolean;
  estimatedDays: number | null;
}

/**
 * Quote shipping for a destination + subtotal. If the subtotal meets the
 * free-shipping threshold, cost is 0. Returns covered=false if the city has no rate.
 */
export function quoteShipping(department: string, city: string, subtotalCents: number): ShippingQuote {
  const config = shippingRepo.getConfig();
  const rate = shippingRepo.findRate(department, city);
  if (!rate) return { covered: false, cents: 0, free: false, estimatedDays: null };

  const free = config.free_above_cents !== null && subtotalCents >= config.free_above_cents;
  return {
    covered: true,
    cents: free ? 0 : rate.price_cents,
    free,
    estimatedDays: rate.estimated_days,
  };
}
