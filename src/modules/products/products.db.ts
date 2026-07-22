/** Products table + repository (tech-spec §7). Images/tags stored as JSON text. */
import { db } from "../../db.ts";
import { Repository, normalizeSearch, type Page } from "../../core/repository.ts";

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  price_cents  INTEGER,
  discount_pct INTEGER NOT NULL DEFAULT 0,
  category_id  TEXT REFERENCES categories(id),
  tags         TEXT NOT NULL DEFAULT '[]',
  images       TEXT NOT NULL DEFAULT '[]',
  active       INTEGER NOT NULL DEFAULT 1,
  title_search TEXT NOT NULL DEFAULT '',
  created_by   TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
`);

export interface ProductImage {
  url: string;
  alt?: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price_cents: number | null;
  discount_pct: number;
  category_id: string | null;
  tags: string;
  images: string;
  active: number;
  title_search: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductInput {
  title: string;
  description: string;
  price_cents: number | null;
  discount_pct: number;
  category_id: string | null;
  tags: string[];
  active: boolean;
}

export function parseTags(product: Product): string[] {
  try {
    const v = JSON.parse(product.tags);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function parseImages(product: Product): ProductImage[] {
  try {
    const v = JSON.parse(product.images);
    return Array.isArray(v) ? (v as ProductImage[]) : [];
  } catch {
    return [];
  }
}

/** Effective unit price in cents after the product-level discount. */
export function effectivePriceCents(basePriceCents: number | null, discountPct: number): number | null {
  if (basePriceCents === null) return null;
  const pct = Math.max(0, Math.min(100, discountPct));
  return Math.round(basePriceCents * (1 - pct / 100));
}

/** Resolves the base price: variant override wins, then product price. */
export function resolveBasePriceCents(
  product: Pick<Product, "price_cents">,
  variant?: { price_cents: number | null } | null,
): number | null {
  if (variant && variant.price_cents !== null) return variant.price_cents;
  return product.price_cents;
}

/** Unit price after resolving base (variant→product) and applying discount. */
export function resolveUnitPriceCents(
  product: Pick<Product, "price_cents" | "discount_pct">,
  variant?: { price_cents: number | null } | null,
): number | null {
  return effectivePriceCents(resolveBasePriceCents(product, variant), product.discount_pct);
}

/**
 * Whether the product is sellable on the storefront:
 * active + at least one active variant with stock > 0 and a resolvable base price.
 */
export function isSellableOnStorefront(
  product: Product,
  variants: { active: number; stock: number; price_cents: number | null }[],
): boolean {
  if (product.active !== 1) return false;
  return variants.some(
    (v) =>
      v.active === 1 &&
      v.stock > 0 &&
      resolveBasePriceCents(product, v) !== null,
  );
}

class ProductsRepository extends Repository<Product & Record<string, unknown>> {
  readonly table = "products";

  insert(input: ProductInput, createdBy: string | null): Product {
    const ts = this.now();
    const product: Product = {
      id: this.newId(),
      title: input.title,
      description: input.description,
      price_cents: input.price_cents,
      discount_pct: input.discount_pct,
      category_id: input.category_id,
      tags: JSON.stringify(input.tags),
      images: "[]",
      active: input.active ? 1 : 0,
      title_search: normalizeSearch(`${input.title} ${input.tags.join(" ")}`),
      created_by: createdBy,
      created_at: ts,
      updated_at: ts,
    };
    this.run(
      `INSERT INTO products (id, title, description, price_cents, discount_pct, category_id, tags, images, active, title_search, created_by, created_at, updated_at)
       VALUES ($id, $title, $description, $price_cents, $discount_pct, $category_id, $tags, $images, $active, $title_search, $created_by, $created_at, $updated_at)`,
      {
        $id: product.id,
        $title: product.title,
        $description: product.description,
        $price_cents: product.price_cents,
        $discount_pct: product.discount_pct,
        $category_id: product.category_id,
        $tags: product.tags,
        $images: product.images,
        $active: product.active,
        $title_search: product.title_search,
        $created_by: product.created_by,
        $created_at: product.created_at,
        $updated_at: product.updated_at,
      },
    );
    return product;
  }

  update(id: string, input: ProductInput): void {
    this.run(
      `UPDATE products SET title = $title, description = $description, price_cents = $price_cents,
        discount_pct = $discount_pct, category_id = $category_id, tags = $tags, active = $active,
        title_search = $title_search, updated_at = $updated_at WHERE id = $id`,
      {
        $id: id,
        $title: input.title,
        $description: input.description,
        $price_cents: input.price_cents,
        $discount_pct: input.discount_pct,
        $category_id: input.category_id,
        $tags: JSON.stringify(input.tags),
        $active: input.active ? 1 : 0,
        $title_search: normalizeSearch(`${input.title} ${input.tags.join(" ")}`),
        $updated_at: this.now(),
      },
    );
  }

  setImages(id: string, images: ProductImage[]): void {
    this.run(`UPDATE products SET images = $images, updated_at = $u WHERE id = $id`, {
      $id: id,
      $images: JSON.stringify(images),
      $u: this.now(),
    });
  }

  /** Public catalog listing (active only), optional category + search. */
  listPublic(opts: { page?: number; search?: string; categoryId?: string }): Page<Product> {
    const params: Record<string, unknown> = {};
    let where = "active = 1";
    if (opts.categoryId) {
      where += " AND category_id = $cat";
      params.$cat = opts.categoryId;
    }
    return this.paginate({
      page: opts.page,
      pageSize: 12,
      search: opts.search,
      searchColumn: "title_search",
      where,
      params,
      orderBy: "created_at DESC",
    });
  }
}

export const productsRepo = new ProductsRepository();
