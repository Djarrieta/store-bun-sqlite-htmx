/**
 * Development seed: content, shipping, categories, products, variants.
 * Run with `bun run seed`. Product seeding is skipped if products already exist;
 * content and shipping are always seeded idempotently.
 *
 * Productos sembrados (cada variante de color lleva su propia imagen, más una
 * foto grupal del producto):
 *   1 — Polo Tejido Calado Manga Corta (4 colores)
 *   2 — Top Tejido sin Mangas (5 colores)
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

  // ── Producto 1: Polo Tejido Calado (imagen por variante) ────────────
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

  // ── Producto 2: Top Tejido sin Mangas (imagen por variante) ─────────
  const top = productsRepo.insert(
    {
      title: "Top Tejido sin Mangas",
      description:
        "Top tejido sin mangas con cuello redondo y corte entallado. Punto acanalado ligero y fresco, ideal para looks casuales y días cálidos. Disponible en varios colores.",
      price_cents: 9_900_000,
      discount_pct: 0,
      category_id: ropa.id,
      tags: ["top", "tejido", "sin mangas", "acanalado", "ropa", "mujer"],
      active: true,
    },
    null,
  );
  // Foto grupal con todos los colores
  productsRepo.setImages(top.id, [
    { url: "/uploads/top-todos.png", alt: "Top tejido sin mangas en todos los colores" },
  ]);
  // Cada variante de color con su propia imagen
  const topLila = variantsRepo.insert(top.id, { name: "Lila", sku: "TOP-LIL", price_cents: null, stock: 9, low_stock_threshold: 3, active: true });
  variantsRepo.setImages(topLila.id, [{ url: "/uploads/top-lila.png", alt: "Top tejido sin mangas lila" }]);
  const topTaupe = variantsRepo.insert(top.id, { name: "Taupe", sku: "TOP-TAU", price_cents: null, stock: 7, low_stock_threshold: 3, active: true });
  variantsRepo.setImages(topTaupe.id, [{ url: "/uploads/top-taupe.png", alt: "Top tejido sin mangas taupe" }]);
  const topAmarillo = variantsRepo.insert(top.id, { name: "Amarillo", sku: "TOP-AMA", price_cents: null, stock: 6, low_stock_threshold: 3, active: true });
  variantsRepo.setImages(topAmarillo.id, [{ url: "/uploads/top-amarillo.png", alt: "Top tejido sin mangas amarillo" }]);
  const topVino = variantsRepo.insert(top.id, { name: "Vino", sku: "TOP-VIN", price_cents: null, stock: 5, low_stock_threshold: 3, active: true });
  variantsRepo.setImages(topVino.id, [{ url: "/uploads/top-vino.png", alt: "Top tejido sin mangas vino" }]);
  const topGris = variantsRepo.insert(top.id, { name: "Gris Oscuro", sku: "TOP-GRI", price_cents: null, stock: 8, low_stock_threshold: 3, active: true });
  variantsRepo.setImages(topGris.id, [{ url: "/uploads/top-gris-oscuro.jpg", alt: "Top tejido sin mangas gris oscuro" }]);

  console.log("Seed: contenido, envíos, 1 categoría, 2 productos y variantes creados.");
}

main();
