/** Products admin views: list, form, image section, variants section. */
import { adminShell } from "../../views.ts";
import { escapeHtml, escapeAttr } from "../../core/http.ts";
import { can } from "../../core/permissions.ts";
import { formatCop } from "../../core/format.ts";
import { dataTable, dataTableList, dataRow } from "../../components/table.ts";
import { textField, textareaField, selectField, checkboxField, fileField, submitButton } from "../../components/forms.ts";
import type { Page } from "../../core/repository.ts";
import type { User } from "../../auth/auth.db.ts";
import { PRODUCTS_KEY, VARIANTS_KEY, type ProductErrors, type VariantErrors } from "./products.rules.ts";
import { parseImages, parseTags, effectivePriceCents, type Product, type ProductInput } from "./products.db.ts";
import { variantsRepo, type Variant } from "../variants/variants.db.ts";
import type { Category } from "../categories/categories.db.ts";

const BASE = "/admin/productos";

const centsToPesos = (cents: number): string => String(Math.round(cents) / 100);

function rowActions(user: User, p: Product): string {
  const parts: string[] = [];
  if (can(user, PRODUCTS_KEY, "edit"))
    parts.push(`<a class="btn btn--outline btn--sm" href="${BASE}/${p.id}/editar">Editar</a>`);
  if (can(user, PRODUCTS_KEY, "delete"))
    parts.push(
      `<button class="btn btn--danger btn--sm" hx-post="${BASE}/${p.id}/eliminar" hx-confirm="¿Eliminar el producto?" hx-target="#data-list" hx-swap="innerHTML">Eliminar</button>`,
    );
  return parts.join("");
}

function productMeta(p: Product): string {
  const tags = parseTags(p);
  const price = formatCop(effectivePriceCents(p.price_cents, p.discount_pct));
  const status = p.active ? "" : ` · <span class="badge badge--warn">inactivo</span>`;
  return `${escapeHtml(price)}${tags.length ? ` · <span class="muted">${escapeHtml(tags.join(", "))}</span>` : ""}${status}`;
}

export function productsListFragment(user: User, pageData: Page<Product>, q: string): string {
  return dataTableList({
    items: pageData.items,
    page: pageData.page,
    totalPages: pageData.totalPages,
    baseUrl: BASE,
    searchQuery: q,
    renderRow: (p) => dataRow({ title: p.title, meta: productMeta(p), actions: rowActions(user, p) }),
    emptyText: "No hay productos todavía.",
  });
}

export function productsListPage(user: User, pageData: Page<Product>, q: string): string {
  const newBtn = can(user, PRODUCTS_KEY, "create") ? `<a class="btn" href="${BASE}/nuevo">Nuevo producto</a>` : "";
  const body = `
    <div class="panel">
      <div class="row-between" style="margin-bottom:1rem"><h1 style="margin:0">Gestionar productos</h1>${newBtn}</div>
      ${dataTable({
        items: pageData.items,
        page: pageData.page,
        totalPages: pageData.totalPages,
        baseUrl: BASE,
        searchQuery: q,
        searchPlaceholder: "Buscar productos…",
        renderRow: (p) => dataRow({ title: p.title, meta: productMeta(p), actions: rowActions(user, p) }),
        emptyText: "No hay productos todavía.",
      })}
    </div>`;
  return adminShell({ user, active: PRODUCTS_KEY, title: "Productos", body });
}

function baseFields(
  categories: Category[],
  values: Partial<ProductInput> & { priceRaw?: string },
  errors?: ProductErrors,
): string {
  return `
    ${textField({ name: "title", label: "Título", value: values.title ?? "", required: true, error: errors?.title })}
    ${textareaField({ name: "description", label: "Descripción", value: values.description ?? "" })}
    <div class="grid" style="grid-template-columns:repeat(auto-fit, minmax(220px, 1fr))">
      ${textField({ name: "price", label: "Precio (COP)", value: values.priceRaw ?? "", required: true, error: errors?.price, help: "Precio base en pesos." })}
      ${textField({ name: "discount_pct", label: "Descuento (%)", type: "number", value: String(values.discount_pct ?? 0), error: errors?.discount })}
    </div>
    ${selectField({
      name: "category_id",
      label: "Categoría",
      value: values.category_id ?? "",
      emptyLabel: "— Sin categoría —",
      options: categories.map((c) => ({ value: c.id, label: c.name })),
    })}
    ${textField({ name: "tags", label: "Etiquetas", value: (values.tags ?? []).join(", "), help: "Separadas por comas." })}
    ${checkboxField({ name: "active", label: "Publicado (visible en la tienda)", checked: values.active ?? true })}`;
}

export function newProductPage(
  user: User,
  categories: Category[],
  values: Partial<ProductInput> & { priceRaw?: string } = { active: true },
  errors?: ProductErrors,
): string {
  const body = `
    <div class="panel" style="max-width:640px">
      <h1>Nuevo producto</h1>
      <p class="muted">Tras crearlo podrás añadir imágenes y variantes.</p>
      <form method="post" action="${BASE}" class="stack">
        ${baseFields(categories, values, errors)}
        <div class="row-between"><a class="btn btn--outline" href="${BASE}">Cancelar</a>${submitButton("Crear producto")}</div>
      </form>
    </div>`;
  return adminShell({ user, active: PRODUCTS_KEY, title: "Nuevo producto", body });
}

export function imagesSection(product: Product): string {
  const images = parseImages(product);
  const thumbs = images.length
    ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.75rem">
        ${images
          .map(
            (img) => `<div class="panel" style="padding:0.5rem">
              <img src="${escapeAttr(img.url)}" alt="${escapeAttr(img.alt ?? "")}" style="aspect-ratio:1;object-fit:cover;border-radius:4px">
              <button class="btn btn--danger btn--sm btn--block" style="margin-top:0.5rem"
                hx-post="${BASE}/${product.id}/imagenes/eliminar" hx-vals='${escapeAttr(JSON.stringify({ url: img.url }))}'
                hx-target="#images-section" hx-swap="outerHTML">Quitar</button>
            </div>`,
          )
          .join("")}
      </div>`
    : `<p class="muted">Sin imágenes todavía.</p>`;

  return `<section id="images-section" class="panel" style="margin-top:1.5rem">
    <h2>Imágenes</h2>
    ${thumbs}
    <form hx-post="${BASE}/${product.id}/imagenes" hx-encoding="multipart/form-data" hx-target="#images-section" hx-swap="outerHTML" style="margin-top:1rem">
      ${fileField({ name: "image", label: "Añadir imagen", accept: "image/jpeg,image/png,image/webp", required: true, help: "JPG, PNG o WEBP (máx. 5 MB)." })}
      ${submitButton("Subir imagen")}
    </form>
  </section>`;
}

function variantRow(user: User, productId: string, v: Variant): string {
  const price = v.price_cents !== null ? formatCop(v.price_cents) : "(precio del producto)";
  const canEdit = can(user, VARIANTS_KEY, "edit");
  const actions = canEdit
    ? `<button class="btn btn--danger btn--sm" hx-post="${BASE}/${productId}/variantes/${v.id}/eliminar" hx-confirm="¿Eliminar variante?" hx-target="#variants-section" hx-swap="outerHTML">Eliminar</button>`
    : "";
  const meta = `${v.sku ? `<code>${escapeHtml(v.sku)}</code> · ` : ""}Stock: ${v.stock} · ${escapeHtml(price)}${v.active ? "" : " · inactiva"}`;
  return dataRow({ title: v.name, meta, actions });
}

export function variantsSection(user: User, product: Product, errors?: VariantErrors, values?: Record<string, string>): string {
  const variants = variantsRepo.listByProduct(product.id);
  const rows = variants.length ? variants.map((v) => variantRow(user, product.id, v)).join("") : `<p class="muted">Sin variantes. Crea al menos una para poder vender el producto.</p>`;
  const addForm = can(user, VARIANTS_KEY, "create")
    ? `<form hx-post="${BASE}/${product.id}/variantes" hx-target="#variants-section" hx-swap="outerHTML" style="margin-top:1rem;border-top:1px solid var(--border);padding-top:1rem">
        <h3>Añadir variante</h3>
        <div class="grid" style="grid-template-columns:repeat(auto-fit, minmax(220px, 1fr))">
          ${textField({ name: "name", label: "Nombre", value: values?.name ?? "", required: true, error: errors?.name, placeholder: "Talla M / Rojo" })}
          ${textField({ name: "sku", label: "SKU", value: values?.sku ?? "" })}
          ${textField({ name: "price", label: "Precio override (COP)", value: values?.price ?? "", help: "Vacío = usa el del producto." })}
          ${textField({ name: "stock", label: "Stock inicial", type: "number", value: values?.stock ?? "0", error: errors?.stock })}
          ${textField({ name: "low_stock_threshold", label: "Alerta de bajo stock", type: "number", value: values?.low_stock_threshold ?? "0", help: "0 = sin alerta." })}
        </div>
        ${checkboxField({ name: "active", label: "Variante activa", checked: true })}
        ${submitButton("Añadir variante")}
      </form>`
    : "";
  return `<section id="variants-section" class="panel" style="margin-top:1.5rem">
    <h2>Variantes</h2>
    ${rows}
    ${addForm}
  </section>`;
}

export function editProductPage(
  user: User,
  product: Product,
  categories: Category[],
  values?: Partial<ProductInput> & { priceRaw?: string },
  errors?: ProductErrors,
): string {
  const v = values ?? {
    title: product.title,
    description: product.description,
    priceRaw: centsToPesos(product.price_cents),
    discount_pct: product.discount_pct,
    category_id: product.category_id ?? "",
    tags: parseTags(product),
    active: product.active === 1,
  };
  const body = `
    <div class="row-between" style="margin-bottom:1rem">
      <h1 style="margin:0">Editar producto</h1>
      <a class="btn btn--outline btn--sm" href="/productos/${product.id}" target="_blank">Ver en tienda ↗</a>
    </div>
    <div style="max-width:640px;margin:0 auto">
      <div class="panel">
        <form method="post" action="${BASE}/${product.id}" class="stack">
          ${baseFields(categories, v, errors)}
          <div class="row-between"><a class="btn btn--outline" href="${BASE}">Volver</a>${submitButton("Guardar cambios")}</div>
        </form>
      </div>
      ${imagesSection(product)}
      ${variantsSection(user, product)}
    </div>`
  return adminShell({ user, active: PRODUCTS_KEY, title: "Editar producto", body });
}
