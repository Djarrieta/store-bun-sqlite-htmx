/** Server-side cart storage keyed by the unified guest_ref (tech-spec §10). */
import { db } from "../db.ts";
import { Repository } from "../core/repository.ts";

db.exec(`
CREATE TABLE IF NOT EXISTS cart_items (
  id         TEXT PRIMARY KEY,
  guest_ref  TEXT NOT NULL,
  variant_id TEXT NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
  qty        INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (guest_ref, variant_id)
);
CREATE INDEX IF NOT EXISTS idx_cart_guest ON cart_items(guest_ref);
`);

export interface CartItem {
  id: string;
  guest_ref: string;
  variant_id: string;
  qty: number;
  created_at: string;
}

/** A cart row joined with product + variant details, for rendering/checkout. */
export interface CartLine {
  id: string;
  variant_id: string;
  product_id: string;
  qty: number;
  stock: number;
  product_title: string;
  variant_name: string;
  sku: string | null;
  unit_price_cents: number;
  line_total_cents: number;
}

class CartRepository extends Repository<CartItem & Record<string, unknown>> {
  readonly table = "cart_items";

  findItem(guestRef: string, variantId: string): CartItem | null {
    return this.get<CartItem>(`SELECT * FROM cart_items WHERE guest_ref = $g AND variant_id = $v`, {
      $g: guestRef,
      $v: variantId,
    });
  }

  upsert(guestRef: string, variantId: string, qty: number): void {
    const existing = this.findItem(guestRef, variantId);
    if (existing) {
      this.run(`UPDATE cart_items SET qty = $qty WHERE id = $id`, { $qty: qty, $id: existing.id });
    } else {
      this.run(
        `INSERT INTO cart_items (id, guest_ref, variant_id, qty, created_at) VALUES ($id, $g, $v, $qty, $c)`,
        { $id: this.newId(), $g: guestRef, $v: variantId, $qty: qty, $c: this.now() },
      );
    }
  }

  removeItem(guestRef: string, variantId: string): void {
    this.run(`DELETE FROM cart_items WHERE guest_ref = $g AND variant_id = $v`, { $g: guestRef, $v: variantId });
  }

  clear(guestRef: string): void {
    this.run(`DELETE FROM cart_items WHERE guest_ref = $g`, { $g: guestRef });
  }

  totalQty(guestRef: string): number {
    const row = this.get<{ n: number }>(`SELECT COALESCE(SUM(qty), 0) AS n FROM cart_items WHERE guest_ref = $g`, {
      $g: guestRef,
    });
    return row?.n ?? 0;
  }

  /** Joined cart lines with effective unit price (variant override -> product, minus discount). */
  lines(guestRef: string): CartLine[] {
    return this.all<CartLine>(
      `SELECT
         ci.id AS id,
         ci.variant_id AS variant_id,
         p.id AS product_id,
         ci.qty AS qty,
         v.stock AS stock,
         p.title AS product_title,
         v.name AS variant_name,
         v.sku AS sku,
         CAST(ROUND(COALESCE(v.price_cents, p.price_cents) * (1 - p.discount_pct / 100.0)) AS INTEGER) AS unit_price_cents,
         CAST(ROUND(COALESCE(v.price_cents, p.price_cents) * (1 - p.discount_pct / 100.0)) * ci.qty AS INTEGER) AS line_total_cents
       FROM cart_items ci
       JOIN variants v ON v.id = ci.variant_id
       JOIN products p ON p.id = v.product_id
       WHERE ci.guest_ref = $g
       ORDER BY ci.created_at`,
      { $g: guestRef },
    );
  }
}

export const cartRepo = new CartRepository();
