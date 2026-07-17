/**
 * Responsive data list with debounced HTMX search and SQL-backed pagination.
 * `dataTable()` renders toolbar + list container; `dataTableList()` renders just
 * the rows + pagination fragment (returned for HTMX requests). Tech-spec §6, §12.
 */
import { escapeAttr, escapeHtml } from "../core/http.ts";

export interface DataTableOptions<T> {
  items: T[];
  page: number;
  totalPages: number;
  /** Base URL used for search + pagination (e.g. /admin/productos). */
  baseUrl: string;
  /** DOM id of the list container (default "data-list"). */
  listId?: string;
  searchQuery?: string;
  searchPlaceholder?: string;
  /** Render a `.data-row` for one item. */
  renderRow: (item: T) => string;
  /** Extra query params to preserve across search/pagination. */
  extraParams?: Record<string, string>;
  emptyText?: string;
}

function buildUrl(base: string, params: Record<string, string>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== "") usp.set(k, v);
  const qs = usp.toString();
  return qs ? `${base}?${qs}` : base;
}

export function dataTableList<T>(opts: DataTableOptions<T>): string {
  const listId = opts.listId ?? "data-list";
  const rows = opts.items.length
    ? opts.items.map(opts.renderRow).join("")
    : `<p class="muted">${escapeHtml(opts.emptyText ?? "Sin resultados.")}</p>`;

  const base = opts.baseUrl;
  const common = { q: opts.searchQuery ?? "", ...(opts.extraParams ?? {}) };
  const pager =
    opts.totalPages > 1
      ? `<div class="pagination">
          ${
            opts.page > 1
              ? `<a class="btn btn--outline btn--sm" hx-get="${escapeAttr(buildUrl(base, { ...common, page: String(opts.page - 1) }))}" hx-target="#${listId}" hx-swap="innerHTML" hx-push-url="true" href="#">Anterior</a>`
              : ""
          }
          <span class="muted">Página ${opts.page} de ${opts.totalPages}</span>
          ${
            opts.page < opts.totalPages
              ? `<a class="btn btn--outline btn--sm" hx-get="${escapeAttr(buildUrl(base, { ...common, page: String(opts.page + 1) }))}" hx-target="#${listId}" hx-swap="innerHTML" hx-push-url="true" href="#">Siguiente</a>`
              : ""
          }
        </div>`
      : "";

  return rows + pager;
}

export function dataTable<T>(opts: DataTableOptions<T>): string {
  const listId = opts.listId ?? "data-list";
  return `
  <div class="data-toolbar">
    <input class="input" type="search" name="q" value="${escapeAttr(opts.searchQuery ?? "")}"
      placeholder="${escapeAttr(opts.searchPlaceholder ?? "Buscar…")}"
      hx-get="${escapeAttr(opts.baseUrl)}" hx-target="#${listId}" hx-swap="innerHTML"
      hx-trigger="keyup changed delay:300ms, search" hx-push-url="true">
    <span class="htmx-indicator muted">Buscando…</span>
  </div>
  <div id="${listId}" class="data-table">${dataTableList(opts)}</div>`;
}

/** A standard `.data-row` with title, meta line, and action buttons. */
export function dataRow(o: { title: string; meta?: string; actions?: string }): string {
  return `<div class="data-row">
    <div class="data-row__main">
      <div class="data-row__title">${escapeHtml(o.title)}</div>
      ${o.meta ? `<div class="data-row__meta">${o.meta}</div>` : ""}
    </div>
    ${o.actions ? `<div class="data-row__actions">${o.actions}</div>` : ""}
  </div>`;
}
