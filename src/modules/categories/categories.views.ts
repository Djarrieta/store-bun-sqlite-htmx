/** Categories admin views. */
import { adminShell } from "../../views.ts";
import { escapeHtml, escapeAttr } from "../../core/http.ts";
import { can } from "../../core/permissions.ts";
import { dataTable, dataTableList, dataRow } from "../../components/table.ts";
import { textField, submitButton } from "../../components/forms.ts";
import type { Page } from "../../core/repository.ts";
import type { User } from "../../auth/auth.db.ts";
import { CATEGORIES_KEY } from "./categories.rules.ts";
import type { Category } from "./categories.db.ts";
import type { CategoryErrors, CategoryInput } from "./categories.rules.ts";

const BASE = "/admin/categorias";

function rowActions(user: User, cat: Category): string {
  const parts: string[] = [];
  if (can(user, CATEGORIES_KEY, "edit"))
    parts.push(`<a class="btn btn--outline btn--sm" href="${BASE}/${cat.id}/editar">Editar</a>`);
  if (can(user, CATEGORIES_KEY, "delete"))
    parts.push(
      `<button class="btn btn--danger btn--sm" hx-post="${BASE}/${cat.id}/eliminar" hx-confirm="¿Eliminar la categoría?" hx-target="#data-list" hx-swap="innerHTML">Eliminar</button>`,
    );
  return parts.join("");
}

export function categoriesListFragment(user: User, pageData: Page<Category>, q: string): string {
  return dataTableList({
    items: pageData.items,
    page: pageData.page,
    totalPages: pageData.totalPages,
    baseUrl: BASE,
    searchQuery: q,
    renderRow: (c) => dataRow({ title: c.name, meta: `<code>${escapeHtml(c.slug)}</code>`, actions: rowActions(user, c) }),
    emptyText: "No hay categorías todavía.",
  });
}

export function categoriesListPage(user: User, pageData: Page<Category>, q: string): string {
  const newBtn = can(user, CATEGORIES_KEY, "create")
    ? `<a class="btn" href="${BASE}/nueva">Nueva categoría</a>`
    : "";
  const body = `
    <div class="panel">
      <div class="row-between" style="margin-bottom:1rem"><h1 style="margin:0">Categorías</h1>${newBtn}</div>
      ${dataTable({
        items: pageData.items,
        page: pageData.page,
        totalPages: pageData.totalPages,
        baseUrl: BASE,
        searchQuery: q,
        searchPlaceholder: "Buscar categorías…",
        renderRow: (c) => dataRow({ title: c.name, meta: `<code>${escapeHtml(c.slug)}</code>`, actions: rowActions(user, c) }),
        emptyText: "No hay categorías todavía.",
      })}
    </div>`;
  return adminShell({ user, active: CATEGORIES_KEY, title: "Categorías", body });
}

export function categoryFormPage(
  user: User,
  opts: { category?: Category; values?: Partial<CategoryInput>; errors?: CategoryErrors } = {},
): string {
  const editing = Boolean(opts.category);
  const action = editing ? `${BASE}/${opts.category!.id}` : BASE;
  const v = opts.values ?? opts.category ?? {};
  const body = `
    <div class="panel" style="max-width:560px">
      <h1>${editing ? "Editar" : "Nueva"} categoría</h1>
      <form method="post" action="${action}" class="stack">
        ${textField({ name: "name", label: "Nombre", value: (v as CategoryInput).name ?? "", required: true, error: opts.errors?.name })}
        ${textField({ name: "slug", label: "Slug", value: (v as CategoryInput).slug ?? "", error: opts.errors?.slug, help: "Se genera automáticamente si lo dejas vacío." })}
        <div class="row-between">
          <a class="btn btn--outline" href="${BASE}">Cancelar</a>
          ${submitButton(editing ? "Guardar" : "Crear")}
        </div>
      </form>
    </div>`;
  return adminShell({ user, active: CATEGORIES_KEY, title: "Categoría", body });
}
