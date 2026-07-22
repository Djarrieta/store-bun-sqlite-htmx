/**
 * Development seed: content, shipping, categories, products, variants.
 * Run with `bun run seed`. Product seeding is skipped if products already exist;
 * content and shipping are always seeded idempotently.
 *
 * Scenarios covered:
 *   A — Single product price, sizes inherit (no variant images)
 *   B — Discount + variant price override
 *   C — Product price null, variants with own prices
 *   D — Multi-image per variant (carousel mockup)
 *   E — Out-of-stock variant (hidden from storefront)
 *   F — No price at all (admin-only, not in storefront)
 */
import { mkdir, readdir, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { categoriesRepo } from "../modules/categories/categories.db.ts";
import { productsRepo, type ProductImage } from "../modules/products/products.db.ts";
import { variantsRepo } from "../modules/variants/variants.db.ts";
import { shippingRepo } from "../modules/shipping/shipping.db.ts";
import { contentRepo } from "../modules/content/content.db.ts";
import { CONTENT_FIELDS } from "../modules/content/content.rules.ts";
import { flagsRepo } from "../modules/feature-flags/feature-flags.db.ts";
import { FLAGS } from "../modules/feature-flags/feature-flags.rules.ts";

function seedContent(): void {
  for (const f of CONTENT_FIELDS) contentRepo.ensureDefault(f.key, f.default);
}

function seedFlags(): void {
  for (const f of FLAGS) flagsRepo.ensureFlag(f.key, f.default);
}

function seedShipping(): void {
  if (shippingRepo.listRates().length > 0) return;
  shippingRepo.insertRate("Cundinamarca", "Bogotá", 1_200_000, 2);
  shippingRepo.insertRate("Antioquia", "Medellín", 1_500_000, 3);
  shippingRepo.insertRate("Valle del Cauca", "Cali", 1_500_000, 3);
  shippingRepo.insertRate("Atlántico", "Barranquilla", 1_800_000, 4);
  shippingRepo.insertRate("Santander", "Bucaramanga", 1_600_000, 4);
  shippingRepo.setConfig(20_000_000);
}

async function copySeedImages(): Promise<void> {
  const srcRoot = "seed-images";
  const destRoot = "public/uploads";
  await mkdir(destRoot, { recursive: true });

  async function walk(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const out: string[] = [];
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) out.push(...(await walk(full)));
      else if (e.isFile()) out.push(full);
    }
    return out;
  }

  const files = await walk(srcRoot);
  for (const src of files) {
    const base = src.split("/").pop()!;
    const dest = join(destRoot, base);
    const file = Bun.file(dest);
    if (await file.exists()) continue;
    await copyFile(src, dest);
  }
}

async function main(): Promise<void> {
  await copySeedImages();

  seedContent();
  seedFlags();
  seedShipping();

  const existing = productsRepo.paginate({ pageSize: 1 });
  if (existing.total > 0) {
    console.log("Seed: contenido y envíos actualizados; productos ya existen, no se crean nuevos.");
    return;
  }

  const ropa = categoriesRepo.findByName("Ropa") ?? categoriesRepo.insert("Ropa");
  const accesorios = categoriesRepo.findByName("Accesorios") ?? categoriesRepo.insert("Accesorios");

  // ── A: Single product price, sizes inherit ──────────────────────────
  const camiseta = productsRepo.insert(
    {
      title: "Camiseta Básica",
      description:
        "Camiseta de algodón 100% con cuello redondo y corte regular. Suave, transpirable y versátil.",
      price_cents: 5_990_000,
      discount_pct: 0,
      category_id: ropa.id,
      tags: ["camiseta", "ropa", "basica", "algodon", "unisex"],
      active: true,
    },
    null,
  );
  variantsRepo.insert(camiseta.id, { name: "Talla S", sku: "CAM-S", price_cents: null, stock: 12, low_stock_threshold: 3, active: true });
  variantsRepo.insert(camiseta.id, { name: "Talla M", sku: "CAM-M", price_cents: null, stock: 20, low_stock_threshold: 3, active: true });
  variantsRepo.insert(camiseta.id, { name: "Talla L", sku: "CAM-L", price_cents: null, stock: 8, low_stock_threshold: 3, active: true });

  // ── B: Discount + variant price override ────────────────────────────
  const carcasa = productsRepo.insert(
    {
      title: "Carcasa para Celular",
      description:
        "Carcasa de silicona flexible con bordes reforzados y acabado mate. Protección diaria.",
      price_cents: 2_990_000,
      discount_pct: 10,
      category_id: accesorios.id,
      tags: ["carcasa", "celular", "accesorios", "silicona"],
      active: true,
    },
    null,
  );
  // iPhone inherits product price (29.900 → 26.910 with 10% off)
  variantsRepo.insert(carcasa.id, { name: "iPhone 15", sku: "CAR-IP15", price_cents: null, stock: 15, low_stock_threshold: 4, active: true });
  // Samsung has its own higher price (34.900 → 31.410 with 10% off)
  variantsRepo.insert(carcasa.id, { name: "Samsung S24", sku: "CAR-S24", price_cents: 3_490_000, stock: 10, low_stock_threshold: 4, active: true });

  // ── C: Product price null, variants with own prices ─────────────────
  const accesoriosSet = productsRepo.insert(
    {
      title: "Set de Accesorios Mix",
      description: "Conjunto de accesorios para combinar. Cada pieza con precio individual.",
      price_cents: null,
      discount_pct: 0,
      category_id: accesorios.id,
      tags: ["accesorios", "set", "mix"],
      active: true,
    },
    null,
  );
  variantsRepo.insert(accesoriosSet.id, { name: "Collar Dorado", sku: "ACC-COL", price_cents: 4_500_000, stock: 5, low_stock_threshold: 1, active: true });
  variantsRepo.insert(accesoriosSet.id, { name: "Pulsera Plata", sku: "ACC-PUL", price_cents: 3_200_000, stock: 8, low_stock_threshold: 1, active: true });

  // ── D: Multi-image per variant (carousel mockup) ────────────────────
  const polo = productsRepo.insert(
    {
      title: "Polo Tejido Calado Manga Corta",
      description:
        "Polo tejido en punto calado con cuello camisero y manga corta. Prenda ligera y fresca, ideal para looks casuales y días soleados. Disponible en varios colores.",
      price_cents: 14_500_000,
      discount_pct: 0,
      category_id: ropa.id,
      tags: ["polo", "tejido", "calado", "manga corta", "ropa", "mujer"],
      active: true,
    },
    null,
  );
  // Product gets only the group photo
  productsRepo.setImages(polo.id, [
    { url: "/uploads/polo-todos.jpg", alt: "Polo tejido calado en todos los colores" },
  ]);
  // Each color variant gets its own image
  const poloAzul = variantsRepo.insert(polo.id, { name: "Azul Cielo", sku: "POLO-AZU", price_cents: null, stock: 8, low_stock_threshold: 3, active: true });
  variantsRepo.setImages(poloAzul.id, [{ url: "/uploads/polo-celeste.png", alt: "Polo tejido calado azul cielo" }]);
  const poloVino = variantsRepo.insert(polo.id, { name: "Vino", sku: "POLO-VIN", price_cents: null, stock: 6, low_stock_threshold: 3, active: true });
  variantsRepo.setImages(poloVino.id, [{ url: "/uploads/polo-vino.png", alt: "Polo tejido calado vino" }]);
  const poloCafe = variantsRepo.insert(polo.id, { name: "Café", sku: "POLO-CAF", price_cents: null, stock: 5, low_stock_threshold: 3, active: true });
  variantsRepo.setImages(poloCafe.id, [{ url: "/uploads/polo-cafe.jpg", alt: "Polo tejido calado café" }]);
  variantsRepo.insert(polo.id, { name: "Crema", sku: "POLO-CRE", price_cents: null, stock: 7, low_stock_threshold: 3, active: true });

  // ── E: Out-of-stock variant (hidden from storefront select/slides) ──
  const pantalon = productsRepo.insert(
    {
      title: "Pantalón Estampado Fresas",
      description:
        "Pantalón de algodón con estampado de fresas. Corte recto y cómodo, ideal para looks casuales.",
      price_cents: 8_990_000,
      discount_pct: 0,
      category_id: ropa.id,
      tags: ["pantalon", "ropa", "estampado", "fresas", "verano"],
      active: true,
    },
    null,
  );
  variantsRepo.insert(pantalon.id, { name: "Talla 30", sku: "PAN-30", price_cents: null, stock: 6, low_stock_threshold: 2, active: true });
  variantsRepo.insert(pantalon.id, { name: "Talla 32", sku: "PAN-32", price_cents: null, stock: 0, low_stock_threshold: 2, active: true });

  // ── F: No price at all (admin-only, not in storefront) ──────────────
  const sinPrecio = productsRepo.insert(
    {
      title: "Producto Borrador",
      description: "Producto sin precio. Solo visible en admin, no aparece en tienda.",
      price_cents: null,
      discount_pct: 0,
      category_id: null,
      tags: ["borrador"],
      active: true,
    },
    null,
  );
  variantsRepo.insert(sinPrecio.id, { name: "Única", sku: null, price_cents: null, stock: 0, low_stock_threshold: 0, active: true });

  console.log("Seed: contenido, envíos, 2 categorías, 6 productos (A–F) y variantes creados.");
}

main();
