/**
 * Development seed: categories, products, variants (matches the mockups).
 * Run with `bun run seed`. Idempotent: skips if products already exist.
 */
import { categoriesRepo } from "../modules/categories/categories.db.ts";
import { productsRepo } from "../modules/products/products.db.ts";
import { variantsRepo } from "../modules/variants/variants.db.ts";
import { shippingRepo } from "../modules/shipping/shipping.db.ts";

function seedShipping(): void {
  if (shippingRepo.listRates().length > 0) return;
  shippingRepo.insertRate("Cundinamarca", "Bogotá", 1_200_000, 2);
  shippingRepo.insertRate("Antioquia", "Medellín", 1_500_000, 3);
  shippingRepo.insertRate("Valle del Cauca", "Cali", 1_500_000, 3);
  shippingRepo.insertRate("Atlántico", "Barranquilla", 1_800_000, 4);
  shippingRepo.insertRate("Santander", "Bucaramanga", 1_600_000, 4);
  // Free shipping above $200.000.
  shippingRepo.setConfig(20_000_000);
}

function main(): void {
  seedShipping();

  const existing = productsRepo.paginate({ pageSize: 1 });
  if (existing.total > 0) {
    console.log("Seed: ya hay productos, no se hace nada.");
    return;
  }

  const ropa = categoriesRepo.findBySlug("ropa") ?? categoriesRepo.insert("Ropa", "ropa");
  const accesorios =
    categoriesRepo.findBySlug("accesorios") ?? categoriesRepo.insert("Accesorios", "accesorios");

  const camiseta = productsRepo.insert(
    {
      title: "Camiseta Básica",
      description: "Camiseta de algodón 100% con cuello redondo y corte regular. Suave, transpirable y versátil.",
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

  const pantalon = productsRepo.insert(
    {
      title: "Pantalón Estampado Fresas",
      description: "Pantalón de algodón con estampado de fresas. Corte recto y cómodo, ideal para looks casuales.",
      price_cents: 8_990_000,
      discount_pct: 0,
      category_id: ropa.id,
      tags: ["pantalon", "ropa", "estampado", "fresas", "verano"],
      active: true,
    },
    null,
  );
  variantsRepo.insert(pantalon.id, { name: "Talla 30", sku: "PAN-30", price_cents: null, stock: 6, low_stock_threshold: 2, active: true });
  variantsRepo.insert(pantalon.id, { name: "Talla 32", sku: "PAN-32", price_cents: null, stock: 4, low_stock_threshold: 2, active: true });

  const carcasa = productsRepo.insert(
    {
      title: "Carcasa para Celular",
      description: "Carcasa de silicona flexible con bordes reforzados y acabado mate. Protección diaria.",
      price_cents: 2_990_000,
      discount_pct: 10,
      category_id: accesorios.id,
      tags: ["carcasa", "celular", "accesorios", "silicona"],
      active: true,
    },
    null,
  );
  variantsRepo.insert(carcasa.id, { name: "iPhone 15", sku: "CAR-IP15", price_cents: null, stock: 15, low_stock_threshold: 4, active: true });
  variantsRepo.insert(carcasa.id, { name: "Samsung S24", sku: "CAR-S24", price_cents: null, stock: 0, low_stock_threshold: 4, active: true });

  console.log("Seed: 2 categorías, 3 productos y sus variantes creados.");
}

main();
