/** Orders + order_items tables and repository (tech-spec §7, §10, §11). */
import { db, transaction } from "../../db.ts";
import { Repository } from "../../core/repository.ts";

db.exec(`
CREATE TABLE IF NOT EXISTS orders (
  id             TEXT PRIMARY KEY,
  user_id        TEXT REFERENCES users(id),
  guest_ref      TEXT,
  customer_name  TEXT NOT NULL DEFAULT '',
  customer_phone TEXT,
  customer_email TEXT,
  status         TEXT NOT NULL DEFAULT 'pending',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  total_cents    INTEGER NOT NULL DEFAULT 0,
  shipping_dept  TEXT,
  shipping_city  TEXT,
  shipping_addr  TEXT,
  notes          TEXT,
  tracking_code  TEXT,
  payment_method TEXT NOT NULL DEFAULT 'nequi',
  payment_ref    TEXT UNIQUE,
  payment_proof_url TEXT,
  payment_verified_by TEXT REFERENCES users(id),
  paid_at        TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_guest ON orders(guest_ref, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id              TEXT PRIMARY KEY,
  order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id      TEXT REFERENCES variants(id),
  product_title   TEXT NOT NULL,
  variant_name    TEXT NOT NULL DEFAULT '',
  sku             TEXT,
  qty             INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
`);

export type OrderStatus =
  | "pending"
  | "payment_review"
  | "paid"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface Order {
  id: string;
  user_id: string | null;
  guest_ref: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  status: OrderStatus;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  shipping_dept: string | null;
  shipping_city: string | null;
  shipping_addr: string | null;
  notes: string | null;
  tracking_code: string | null;
  payment_method: string;
  payment_ref: string | null;
  payment_proof_url: string | null;
  payment_verified_by: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  variant_id: string | null;
  product_title: string;
  variant_name: string;
  sku: string | null;
  qty: number;
  unit_price_cents: number;
}

export interface NewOrderInput {
  user_id: string | null;
  guest_ref: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  shipping_dept: string | null;
  shipping_city: string | null;
  shipping_addr: string | null;
  notes: string | null;
}

export interface NewOrderItem {
  variant_id: string;
  product_title: string;
  variant_name: string;
  sku: string | null;
  qty: number;
  unit_price_cents: number;
}

function genPaymentRef(): string {
  return `CR-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

class OrdersRepository extends Repository<Order & Record<string, unknown>> {
  readonly table = "orders";

  createOrder(input: NewOrderInput, items: NewOrderItem[]): Order {
    const ts = this.now();
    const id = this.newId();
    const paymentRef = genPaymentRef();
    transaction(() => {
      this.run(
        `INSERT INTO orders (id, user_id, guest_ref, customer_name, customer_phone, customer_email, status,
           subtotal_cents, shipping_cents, total_cents, shipping_dept, shipping_city, shipping_addr, notes,
           payment_method, payment_ref, created_at, updated_at)
         VALUES ($id, $user_id, $guest_ref, $name, $phone, $email, 'pending',
           $subtotal, $shipping, $total, $dept, $city, $addr, $notes,
           'nequi', $ref, $c, $c)`,
        {
          $id: id,
          $user_id: input.user_id,
          $guest_ref: input.guest_ref,
          $name: input.customer_name,
          $phone: input.customer_phone,
          $email: input.customer_email,
          $subtotal: input.subtotal_cents,
          $shipping: input.shipping_cents,
          $total: input.total_cents,
          $dept: input.shipping_dept,
          $city: input.shipping_city,
          $addr: input.shipping_addr,
          $notes: input.notes,
          $ref: paymentRef,
          $c: ts,
        },
      );
      for (const item of items) {
        this.run(
          `INSERT INTO order_items (id, order_id, variant_id, product_title, variant_name, sku, qty, unit_price_cents)
           VALUES ($id, $order, $variant, $title, $vname, $sku, $qty, $price)`,
          {
            $id: this.newId(),
            $order: id,
            $variant: item.variant_id,
            $title: item.product_title,
            $vname: item.variant_name,
            $sku: item.sku,
            $qty: item.qty,
            $price: item.unit_price_cents,
          },
        );
      }
    });
    return this.findById(id) as Order;
  }

  items(orderId: string): OrderItem[] {
    return this.all<OrderItem>(`SELECT * FROM order_items WHERE order_id = $o`, { $o: orderId });
  }

  setStatus(id: string, status: OrderStatus): void {
    this.run(`UPDATE orders SET status = $s, updated_at = $u WHERE id = $id`, {
      $s: status,
      $u: this.now(),
      $id: id,
    });
  }

  setTracking(id: string, code: string): void {
    this.run(`UPDATE orders SET tracking_code = $t, updated_at = $u WHERE id = $id`, {
      $t: code,
      $u: this.now(),
      $id: id,
    });
  }

  /** Admin listing: filter by status + search by ref/name/phone, paginated. */
  listOrders(opts: { page?: number; status?: string; search?: string }): {
    items: Order[];
    page: number;
    totalPages: number;
    total: number;
  } {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = 20;
    const params: Record<string, unknown> = {};
    const clauses: string[] = [];
    if (opts.status) {
      clauses.push("status = $status");
      params.$status = opts.status;
    }
    if (opts.search) {
      params.$q = `%${opts.search.toLowerCase()}%`;
      clauses.push("(LOWER(payment_ref) LIKE $q OR LOWER(customer_name) LIKE $q OR LOWER(COALESCE(customer_phone,'')) LIKE $q)");
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const total = this.get<{ n: number }>(`SELECT COUNT(*) AS n FROM orders ${where}`, params)?.n ?? 0;
    params.$limit = pageSize;
    params.$offset = (page - 1) * pageSize;
    const items = this.all<Order>(
      `SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT $limit OFFSET $offset`,
      params,
    );
    return { items, page, totalPages: Math.max(1, Math.ceil(total / pageSize)), total };
  }

  attachProof(id: string, proofUrl: string): void {
    this.run(
      `UPDATE orders SET payment_proof_url = $p, status = 'payment_review', updated_at = $u
       WHERE id = $id AND status IN ('pending','payment_review')`,
      { $p: proofUrl, $u: this.now(), $id: id },
    );
  }

  /** Mark paid + record verifier. Returns true only on the payment_review→paid
   * transition (idempotent: a second call finds status=paid and returns false). */
  markPaid(id: string, verifiedBy: string): boolean {
    const ts = this.now();
    const res = db
      .query(
        `UPDATE orders SET status = 'paid', paid_at = $t, payment_verified_by = $by, updated_at = $t
         WHERE id = $id AND status = 'payment_review'`,
      )
      .run({ $t: ts, $by: verifiedBy, $id: id });
    return res.changes > 0;
  }

  latestPendingForRef(guestRef: string, userId: string | null): Order | null {
    return this.get<Order>(
      `SELECT * FROM orders
       WHERE status IN ('pending','payment_review') AND (guest_ref = $g OR ($u IS NOT NULL AND user_id = $u))
       ORDER BY created_at DESC LIMIT 1`,
      { $g: guestRef, $u: userId },
    );
  }
}

export const ordersRepo = new OrdersRepository();
