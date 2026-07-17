/** Inventory admin views: stock list, variant detail (adjust + movements). */
import { adminShell } from "../../views.ts";
import { escapeHtml } from "../../core/http.ts";
import { can } from "../../core/permissions.ts";
import { formatDateTime } from "../../core/format.ts";
import { dataTable, dataTableList, dataRow } from "../../components/table.ts";
import { badge } from "../../components/card.ts";
import { selectField, textField, submitButton } from "../../components/forms.ts";
import type { User } from "../../auth/auth.db.ts";
import { INVENTORY_KEY, REASON_LABELS, type AdjustErrors } from "./inventory.rules.ts";
import type { StockRow, MovementRow } from "./inventory.db.ts";

const BASE = "/admin/inventario";

interface StockList {
  items: StockRow[];
  page: number;
  totalPages: number;
  total: number;
}

function stockBadge(row: StockRow): string {
  if (row.low_stock_threshold > 0 && row.stock <= row.low_stock_threshold) {
    return badge(`Bajo stock: ${row.stock}`, row.stock === 0 ? "danger" : "warn");
  }
  return badge(`Stock: ${row.stock}`, "ok");
}

function renderStockRow(user: User, row: StockRow): string {
  const actions = can(user, INVENTORY_KEY, "adjust")
    ? `<a class="btn btn--outline btn--sm" href="${BASE}/${row.variant_id}">Ajustar</a>`
    : "";
  const meta = `${row.sku ? `<code>${escapeHtml(row.sku)}</code> · ` : ""}${escapeHtml(row.variant_name)} · ${stockBadge(row)}${row.active ? "" : " · inactiva"}`;
  return dataRow({ title: row.product_title, meta, actions });
}

export function inventoryListFragment(user: User, data: StockList, q: string, lowOnly: boolean): string {
  return dataTableList({
    items: data.items,
    page: data.page,
    totalPages: data.totalPages,
    baseUrl: BASE,
    searchQuery: q,
    extraParams: { low: lowOnly ? "1" : "" },
    renderRow: (row) => renderStockRow(user, row),
    emptyText: lowOnly ? "No hay variantes con bajo stock." : "No hay variantes.",
  });
}

export function inventoryListPage(user: User, data: StockList, q: string, lowOnly: boolean, lowCount: number): string {
  const toggle = lowOnly
    ? `<a class="btn btn--outline btn--sm" href="${BASE}">Ver todo</a>`
    : `<a class="btn btn--outline btn--sm" href="${BASE}?low=1">Solo bajo stock${lowCount ? ` (${lowCount})` : ""}</a>`;
  const alertBar =
    lowCount > 0 && !lowOnly
      ? `<div class="alert alert--warn">Hay ${lowCount} variante(s) con bajo stock. <a href="${BASE}?low=1">Ver</a></div>`
      : "";
  const body = `
    <div class="panel">
      <div class="row-between" style="margin-bottom:1rem"><h1 style="margin:0">Inventario</h1>${toggle}</div>
      ${alertBar}
      ${dataTable({
        items: data.items,
        page: data.page,
        totalPages: data.totalPages,
        baseUrl: BASE,
        searchQuery: q,
        searchPlaceholder: "Buscar por producto, variante o SKU…",
        extraParams: { low: lowOnly ? "1" : "" },
        renderRow: (row) => renderStockRow(user, row),
        emptyText: "No hay variantes.",
      })}
    </div>`;
  return adminShell({ user, active: INVENTORY_KEY, title: "Inventario", body });
}

export function inventoryDetailPage(
  user: User,
  row: StockRow,
  movements: MovementRow[],
  errors?: AdjustErrors,
): string {
  const canAdjust = can(user, INVENTORY_KEY, "adjust");
  const history = movements.length
    ? movements
        .map(
          (m) => `<div class="data-row">
            <div class="data-row__main">
              <div class="data-row__title">${m.delta > 0 ? "+" : ""}${m.delta} · ${escapeHtml(REASON_LABELS[m.reason] ?? m.reason)}</div>
              <div class="data-row__meta">${escapeHtml(formatDateTime(m.created_at))}${m.order_id ? ` · orden ${escapeHtml(m.order_id.slice(0, 8))}` : ""}</div>
            </div>
          </div>`,
        )
        .join("")
    : `<p class="muted">Sin movimientos registrados.</p>`;

  const adjustForm = canAdjust
    ? `<div class="panel" style="margin-bottom:1.5rem">
        <h2>Ajustar stock</h2>
        <form method="post" action="${BASE}/${row.variant_id}/ajustar" class="stack">
          ${textField({ name: "delta", label: "Cantidad (+ entrada / - salida)", type: "number", required: true, error: errors?.delta })}
          ${selectField({
            name: "reason",
            label: "Motivo",
            value: "adjust",
            options: Object.entries(REASON_LABELS)
              .filter(([k]) => k !== "sale")
              .map(([value, label]) => ({ value, label })),
            error: errors?.reason,
          })}
          ${submitButton("Aplicar ajuste")}
        </form>
      </div>`
    : "";

  const body = `
    <p class="muted"><a href="${BASE}">← Volver a inventario</a></p>
    <div class="row-between" style="margin-bottom:1rem">
      <h1 style="margin:0">${escapeHtml(row.product_title)}</h1>
      ${stockBadge(row)}
    </div>
    <div class="panel" style="margin-bottom:1.5rem">
      <p style="margin:0"><strong>Variante:</strong> ${escapeHtml(row.variant_name)}${row.sku ? ` · <code>${escapeHtml(row.sku)}</code>` : ""}</p>
      <p style="margin:0.5rem 0 0"><strong>Saldo actual:</strong> ${row.stock}${row.low_stock_threshold > 0 ? ` · alerta ≤ ${row.low_stock_threshold}` : ""}</p>
    </div>
    ${adjustForm}
    <div class="panel">
      <h2>Movimientos</h2>
      ${history}
    </div>`;
  return adminShell({ user, active: INVENTORY_KEY, title: "Ajustar inventario", body });
}
