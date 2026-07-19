/**
 * Inventory: stock_movements ledger + denormalized balance on variants.stock.
 * Every change writes a movement AND updates the balance in one transaction
 * (tech-spec §7, §11). This is the single source of truth for stock changes.
 */
import { db, transaction } from "../../db.ts";
import { Repository } from "../../core/repository.ts";

db.exec(`
CREATE TABLE IF NOT EXISTS stock_movements (
  id          TEXT PRIMARY KEY,
  variant_id  TEXT NOT NULL REFERENCES variants(id),
  delta       INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  order_id    TEXT,
  created_by  TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stockmov_variant ON stock_movements(variant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stockmov_order ON stock_movements(order_id);
`);

export type StockReason = "purchase" | "sale" | "adjust" | "return";

export interface StockMovement {
  id: string;
  variant_id: string;
  delta: number;
  reason: StockReason;
  order_id: string | null;
  created_by: string | null;
  created_at: string;
}

/** A variant row enriched with its product title, for the inventory list. */
export interface StockRow {
  variant_id: string;
  product_id: string;
  product_title: string;
  variant_name: string;
  sku: string | null;
  stock: number;
  low_stock_threshold: number;
  active: number;
}

export interface MovementRow extends StockMovement {
  product_title: string;
  variant_name: string;
}

class InventoryRepository extends Repository<StockMovement & Record<string, unknown>> {
  readonly table = "stock_movements";

  /**
   * Apply a stock delta: write a movement and update the balance atomically.
   * Returns the new balance.
   */
  applyMovement(input: {
    variantId: string;
    delta: number;
    reason: StockReason;
    orderId?: string | null;
    createdBy?: string | null;
  }): number {
    return transaction(() => this.applyMovementRaw(input));
  }

  /**
   * Same as `applyMovement` but WITHOUT opening its own transaction — for use
   * inside an existing transaction (e.g. approving payment decrements stock and
   * marks the order paid together). bun:sqlite has no nested transactions.
   */
  applyMovementRaw(input: {
    variantId: string;
    delta: number;
    reason: StockReason;
    orderId?: string | null;
    createdBy?: string | null;
  }): number {
    this.run(
      `INSERT INTO stock_movements (id, variant_id, delta, reason, order_id, created_by, created_at)
       VALUES ($id, $v, $d, $r, $o, $by, $c)`,
      {
        $id: this.newId(),
        $v: input.variantId,
        $d: input.delta,
        $r: input.reason,
        $o: input.orderId ?? null,
        $by: input.createdBy ?? null,
        $c: this.now(),
      },
    );
    db.query(`UPDATE variants SET stock = stock + $d WHERE id = $v`).run({ $d: input.delta, $v: input.variantId });
    const row = db.query(`SELECT stock FROM variants WHERE id = $v`).get({ $v: input.variantId }) as
      | { stock: number }
      | undefined;
    return row?.stock ?? 0;
  }

  /** True if a `sale` movement already exists for this order (idempotency guard). */
  saleRecordedForOrder(orderId: string): boolean {
    const row = this.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM stock_movements WHERE order_id = $o AND reason = 'sale'`,
      { $o: orderId },
    );
    return (row?.n ?? 0) > 0;
  }

  listStock(opts: { page?: number; search?: string; lowOnly?: boolean }): {
    items: StockRow[];
    page: number;
    totalPages: number;
    total: number;
  } {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = 20;
    const params: Record<string, string | number> = {};
    const clauses: string[] = [];
    if (opts.search) {
      params.$q = `%${opts.search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}%`;
      clauses.push("(p.title_search LIKE $q OR LOWER(v.name) LIKE $q OR LOWER(COALESCE(v.sku,'')) LIKE $q)");
    }
    if (opts.lowOnly) clauses.push("v.low_stock_threshold > 0 AND v.stock <= v.low_stock_threshold");
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const total =
      (db
        .query(`SELECT COUNT(*) AS n FROM variants v JOIN products p ON p.id = v.product_id ${where}`)
        .get(params) as { n: number } | undefined)?.n ?? 0;

    params.$limit = pageSize;
    params.$offset = (page - 1) * pageSize;
    const items = db
      .query(
        `SELECT v.id AS variant_id, p.id AS product_id, p.title AS product_title, v.name AS variant_name,
                v.sku AS sku, v.stock AS stock, v.low_stock_threshold AS low_stock_threshold, v.active AS active
         FROM variants v JOIN products p ON p.id = v.product_id
         ${where}
         ORDER BY (v.low_stock_threshold > 0 AND v.stock <= v.low_stock_threshold) DESC, p.title COLLATE NOCASE
         LIMIT $limit OFFSET $offset`,
      )
      .all(params) as StockRow[];

    return { items, page, totalPages: Math.max(1, Math.ceil(total / pageSize)), total };
  }

  lowStockCount(): number {
    const row = db
      .query(
        `SELECT COUNT(*) AS n FROM variants WHERE low_stock_threshold > 0 AND stock <= low_stock_threshold`,
      )
      .get() as { n: number } | undefined;
    return row?.n ?? 0;
  }

  listMovements(variantId: string, limit = 30): MovementRow[] {
    return db
      .query(
        `SELECT sm.*, p.title AS product_title, v.name AS variant_name
         FROM stock_movements sm
         JOIN variants v ON v.id = sm.variant_id
         JOIN products p ON p.id = v.product_id
         WHERE sm.variant_id = $v
         ORDER BY sm.created_at DESC
         LIMIT $limit`,
      )
      .all({ $v: variantId, $limit: limit }) as MovementRow[];
  }
}

export const inventoryRepo = new InventoryRepository();
