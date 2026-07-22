/** Products admin routes (CRUD + images + nested variants). */
import type { Router } from "../../core/router.ts";
import { html, fragment, redirect, notFound, badRequest } from "../../core/http.ts";
import { requirePermission } from "../../auth/index.ts";
import { saveImage } from "../../core/uploads.ts";
import { productsRepo, parseImages, type Product } from "./products.db.ts";
import { categoriesRepo } from "../categories/categories.db.ts";
import { variantsRepo, parseVariantImages } from "../variants/variants.db.ts";
import { PRODUCTS_KEY, VARIANTS_KEY, validateProduct, validateVariant } from "./products.rules.ts";
import {
  productsListPage,
  productsListFragment,
  newProductPage,
  editProductPage,
  imagesSection,
  variantsSection,
} from "./products.views.ts";

const BASE = "/admin/productos";
const UPLOAD_DIR = "public/uploads";

function categoryIdSet(): Set<string> {
  return new Set(categoriesRepo.listAll().map((c) => c.id));
}

export function registerProductsRoutes(router: Router): void {
  router.get(BASE, (ctx) => {
    const user = requirePermission(ctx, PRODUCTS_KEY, "view");
    if (user instanceof Response) return user;
    const q = ctx.query.get("q") ?? "";
    const pageNum = Number.parseInt(ctx.query.get("page") ?? "1", 10) || 1;
    const pageData = productsRepo.paginate({ page: pageNum, search: q, searchColumn: "title_search" });
    if (ctx.isHtmx) return fragment(productsListFragment(user, pageData, q));
    return html(productsListPage(user, pageData, q));
  });

  router.get(`${BASE}/nuevo`, (ctx) => {
    const user = requirePermission(ctx, PRODUCTS_KEY, "create");
    if (user instanceof Response) return user;
    return html(newProductPage(user, categoriesRepo.listAll()));
  });

  router.post(BASE, async (ctx) => {
    const user = requirePermission(ctx, PRODUCTS_KEY, "create");
    if (user instanceof Response) return user;
    const form = await ctx.req.formData();
    const { data, priceRaw, errors } = validateProduct(form, categoryIdSet());
    if (errors.title || errors.price || errors.discount) {
      return html(newProductPage(user, categoriesRepo.listAll(), { ...data, priceRaw }, errors), { status: 400 });
    }
    const product = productsRepo.insert(data, user.id);
    variantsRepo.insert(product.id, {
      name: "Única",
      sku: null,
      price_cents: null,
      stock: 0,
      low_stock_threshold: 0,
      active: true,
    });
    return redirect(`${BASE}/${product.id}/editar`);
  });

  router.get(`${BASE}/:id/editar`, (ctx) => {
    const user = requirePermission(ctx, PRODUCTS_KEY, "edit");
    if (user instanceof Response) return user;
    const product = productsRepo.findById(ctx.params.id!);
    if (!product) return notFound("Producto no encontrado.");
    return html(editProductPage(user, product, categoriesRepo.listAll()));
  });

  router.post(`${BASE}/:id`, async (ctx) => {
    const user = requirePermission(ctx, PRODUCTS_KEY, "edit");
    if (user instanceof Response) return user;
    const product = productsRepo.findById(ctx.params.id!);
    if (!product) return notFound("Producto no encontrado.");
    const form = await ctx.req.formData();
    const { data, priceRaw, errors } = validateProduct(form, categoryIdSet());
    if (errors.title || errors.price || errors.discount) {
      return html(editProductPage(user, product, categoriesRepo.listAll(), { ...data, priceRaw }, errors), { status: 400 });
    }
    productsRepo.update(product.id, data);
    return redirect(`${BASE}/${product.id}/editar`);
  });

  router.post(`${BASE}/:id/eliminar`, (ctx) => {
    const user = requirePermission(ctx, PRODUCTS_KEY, "delete");
    if (user instanceof Response) return user;
    productsRepo.deleteById(ctx.params.id!);
    const pageData = productsRepo.paginate({});
    return fragment(productsListFragment(user, pageData, ""));
  });

  // ---- Images ----
  router.post(`${BASE}/:id/imagenes`, async (ctx) => {
    const user = requirePermission(ctx, PRODUCTS_KEY, "edit");
    if (user instanceof Response) return user;
    const product = productsRepo.findById(ctx.params.id!);
    if (!product) return notFound("Producto no encontrado.");
    const form = await ctx.req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return badRequest("No se recibió imagen.");
    const result = await saveImage(file, UPLOAD_DIR);
    if (!result.ok) {
      return fragment(imagesSection(product).replace("<h2>Imágenes</h2>", `<h2>Imágenes</h2><div class="alert alert--error">${result.error}</div>`));
    }
    const images = parseImages(product);
    images.push({ url: `/uploads/${result.filename}`, alt: product.title });
    productsRepo.setImages(product.id, images);
    return fragment(imagesSection(productsRepo.findById(product.id) as Product));
  });

  router.post(`${BASE}/:id/imagenes/eliminar`, async (ctx) => {
    const user = requirePermission(ctx, PRODUCTS_KEY, "edit");
    if (user instanceof Response) return user;
    const product = productsRepo.findById(ctx.params.id!);
    if (!product) return notFound("Producto no encontrado.");
    const form = await ctx.req.formData();
    const url = String(form.get("url") ?? "");
    const images = parseImages(product).filter((img) => img.url !== url);
    productsRepo.setImages(product.id, images);
    return fragment(imagesSection(productsRepo.findById(product.id) as Product));
  });

  // ---- Variants (nested) ----
  router.post(`${BASE}/:id/variantes`, async (ctx) => {
    const user = requirePermission(ctx, VARIANTS_KEY, "create");
    if (user instanceof Response) return user;
    const product = productsRepo.findById(ctx.params.id!);
    if (!product) return notFound("Producto no encontrado.");
    const form = await ctx.req.formData();
    const { data, errors } = validateVariant(form);
    if (data.sku && variantsRepo.skuExists(data.sku)) errors.name = "Ese SKU ya existe.";
    if (errors.name || errors.stock) {
      const values = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
      return fragment(variantsSection(user, product, errors, values));
    }
    variantsRepo.insert(product.id, data);
    return fragment(variantsSection(user, product));
  });

  router.post(`${BASE}/:id/variantes/:vid/eliminar`, (ctx) => {
    const user = requirePermission(ctx, VARIANTS_KEY, "delete");
    if (user instanceof Response) return user;
    const product = productsRepo.findById(ctx.params.id!);
    if (!product) return notFound("Producto no encontrado.");
    const allVariants = variantsRepo.listByProduct(product.id);
    if (allVariants.length <= 1) {
      return fragment(
        variantsSection(user, product, { name: "Debe existir al menos una variante." }),
      );
    }
    variantsRepo.deleteById(ctx.params.vid!);
    return fragment(variantsSection(user, product));
  });

  // ---- Variant images ----
  router.post(`${BASE}/:id/variantes/:vid/imagenes`, async (ctx) => {
    const user = requirePermission(ctx, VARIANTS_KEY, "edit");
    if (user instanceof Response) return user;
    const product = productsRepo.findById(ctx.params.id!);
    if (!product) return notFound("Producto no encontrado.");
    const variant = variantsRepo.findById(ctx.params.vid!);
    if (!variant || variant.product_id !== product.id) return notFound("Variante no encontrada.");
    const form = await ctx.req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return badRequest("No se recibió imagen.");
    const result = await saveImage(file, UPLOAD_DIR);
    if (!result.ok) {
      return fragment(variantsSection(user, product).replace("<h2>Variantes</h2>", `<h2>Variantes</h2><div class="alert alert--error">${result.error}</div>`));
    }
    const images = parseVariantImages(variant);
    images.push({ url: `/uploads/${result.filename}`, alt: variant.name });
    variantsRepo.setImages(variant.id, images);
    return fragment(variantsSection(user, product));
  });

  router.post(`${BASE}/:id/variantes/:vid/imagenes/eliminar`, async (ctx) => {
    const user = requirePermission(ctx, VARIANTS_KEY, "edit");
    if (user instanceof Response) return user;
    const product = productsRepo.findById(ctx.params.id!);
    if (!product) return notFound("Producto no encontrado.");
    const variant = variantsRepo.findById(ctx.params.vid!);
    if (!variant || variant.product_id !== product.id) return notFound("Variante no encontrada.");
    const form = await ctx.req.formData();
    const url = String(form.get("url") ?? "");
    const images = parseVariantImages(variant).filter((img) => img.url !== url);
    variantsRepo.setImages(variant.id, images);
    return fragment(variantsSection(user, product));
  });
}
