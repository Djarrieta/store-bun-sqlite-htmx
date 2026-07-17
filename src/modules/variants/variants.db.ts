/** Variants (sellable SKUs) table + repository (tech-spec §7). */
import { db } from "../../db.ts";
import { Repository } from "../../core/repository.ts";

db.exec(`
CREATE TABLE IF NOT EXISTS variants (
  id             TEXT PRIMARY KEY,
  product_id     TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku            TEXT UNIQUE,
  name           TEXT NOT NULL DEFAULT '',
  attributes     TEXT NOT NULL DEFAULT '{}',
  price_cents    INTEGER,
  stock          INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 0,
  active         INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id);
`);

export interface Variant {
  id: string;
  product_id: string;
  sku: string | null;
  name: string;
  attributes: string;
  price_cents: number | null;
  stock: number;
  low_stock_threshold: number;
  active: number;
}

export interface VariantInput {
  name: string;
  sku: string | null;
  price_cents: number | null;
  stock: number;
  low_stock_threshold: number;
  active: boolean;
}

export function parseAttributes(variant: Variant): Record<string, string> {
  try {
    const v = JSON.parse(variant.attributes);
    return v && typeof v === "object" ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

class VariantsRepository extends Repository<Variant & Record<string, unknown>> {
  readonly table = "variants";

  listByProduct(productId: string): Variant[] {
    return this.all<Variant>(`SELECT * FROM variants WHERE product_id = $p ORDER BY name COLLATE NOCASE`, {
      $p: productId,
    });
  }

  listActiveByProduct(productId: string): Variant[] {
    return this.all<Variant>(
      `SELECT * FROM variants WHERE product_id = $p AND active = 1 ORDER BY name COLLATE NOCASE`,
      { $p: productId },
    );
  }

  /** Active variants for many products at once (avoids N+1 in the catalog). */
  listActiveByProductIds(ids: string[]): Variant[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map((_, i) => `$id${i}`).join(", ");
    const params: Record<string, unknown> = {};
    ids.forEach((id, i) => (params[`$id${i}`] = id));
    return this.all<Variant>(
      `SELECT * FROM variants WHERE active = 1 AND product_id IN (${placeholders}) ORDER BY name COLLATE NOCASE`,
      params,
    );
  }

  insert(productId: string, input: VariantInput): Variant {
    const variant: Variant = {
      id: this.newId(),
      product_id: productId,
      sku: input.sku,
      name: input.name,
      attributes: "{}",
      price_cents: input.price_cents,
      stock: input.stock,
      low_stock_threshold: input.low_stock_threshold,
      active: input.active ? 1 : 0,
    };
    this.run(
      `INSERT INTO variants (id, product_id, sku, name, attributes, price_cents, stock, low_stock_threshold, active)
       VALUES ($id, $product_id, $sku, $name, $attributes, $price_cents, $stock, $low, $active)`,
      {
        $id: variant.id,
        $product_id: productId,
        $sku: variant.sku,
        $name: variant.name,
        $attributes: variant.attributes,
        $price_cents: variant.price_cents,
        $stock: variant.stock,
        $low: variant.low_stock_threshold,
        $active: variant.active,
      },
    );
    return variant;
  }

  update(id: string, input: VariantInput): void {
    this.run(
      `UPDATE variants SET name = $name, sku = $sku, price_cents = $price_cents,
        low_stock_threshold = $low, active = $active WHERE id = $id`,
      {
        $id: id,
        $name: input.name,
        $sku: input.sku,
        $price_cents: input.price_cents,
        $low: input.low_stock_threshold,
        $active: input.active ? 1 : 0,
      },
    );
  }

  skuExists(sku: string, exceptId?: string): boolean {
    const row = this.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM variants WHERE sku = $sku AND id != $id`,
      { $sku: sku, $id: exceptId ?? "" },
    );
    return (row?.n ?? 0) > 0;
  }
}

export const variantsRepo = new VariantsRepository();
